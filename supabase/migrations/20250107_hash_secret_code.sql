-- secret_code 雜湊化 + 嘗試次數限制
-- 使用 pgcrypto 的 bcrypt 進行雜湊儲存和比對

-- 1. 建立暗號嘗試次數追蹤表
CREATE TABLE IF NOT EXISTS secret_code_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 建立索引以加速查詢
CREATE INDEX IF NOT EXISTS idx_secret_code_attempts_user_time
ON secret_code_attempts (user_id, attempted_at DESC);

-- 啟用 RLS
ALTER TABLE secret_code_attempts ENABLE ROW LEVEL SECURITY;

-- RLS 政策：只能看自己的嘗試記錄
CREATE POLICY "attempts_select_own" ON secret_code_attempts
FOR SELECT USING (user_id = auth.uid());

-- 2. 建立雜湊儲存函數（給 throwBottle 使用）
CREATE OR REPLACE FUNCTION hash_secret_code(code TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF code IS NULL OR code = '' THEN
    RETURN NULL;
  END IF;
  RETURN extensions.crypt(code, extensions.gen_salt('bf', 8));
END;
$$;

-- 只允許已認證用戶呼叫
REVOKE ALL ON FUNCTION hash_secret_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION hash_secret_code(TEXT) TO authenticated;

-- 3. 更新 unlock_secret_bottle RPC：使用雜湊比對 + 嘗試次數限制
-- 先刪除舊函數（因為回傳型別有變更）
DROP FUNCTION IF EXISTS unlock_secret_bottle(TEXT);

CREATE OR REPLACE FUNCTION unlock_secret_bottle(code TEXT)
RETURNS TABLE (
  id UUID,
  author_id UUID,
  author_name TEXT,
  content TEXT,
  image_url TEXT,
  bottle_type bottle_type,
  city TEXT,
  is_pushable BOOLEAN,
  relay_count INTEGER,
  current_holder_id UUID,
  status bottle_status,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_bottle_id UUID;
  current_user_id UUID;
  attempt_count INT;
  one_hour_ago TIMESTAMPTZ;
BEGIN
  -- 取得當前用戶 ID
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 檢查過去一小時的嘗試次數
  one_hour_ago := NOW() - INTERVAL '1 hour';

  SELECT COUNT(*) INTO attempt_count
  FROM secret_code_attempts
  WHERE user_id = current_user_id
    AND attempted_at > one_hour_ago;

  -- 超過 5 次則拒絕
  IF attempt_count >= 5 THEN
    RAISE EXCEPTION 'Too many attempts. Please try again later.';
  END IF;

  -- 記錄這次嘗試
  INSERT INTO secret_code_attempts (user_id)
  VALUES (current_user_id);

  -- 找到符合暗號的漂流中暗號瓶（使用 bcrypt 比對）
  -- 排除自己的瓶子
  SELECT b.id INTO target_bottle_id
  FROM bottles b
  WHERE b.bottle_type = 'secret'
    AND b.status = 'floating'
    AND b.author_id <> current_user_id
    AND b.secret_code IS NOT NULL
    AND extensions.crypt(code, b.secret_code) = b.secret_code
  ORDER BY b.created_at DESC
  LIMIT 1;

  -- 如果沒找到，回傳空結果（不拋出錯誤，避免洩漏資訊）
  IF target_bottle_id IS NULL THEN
    RETURN;
  END IF;

  -- 成功找到：刪除該用戶的嘗試記錄（重置計數）
  DELETE FROM secret_code_attempts
  WHERE user_id = current_user_id;

  -- 建立授權記錄（如果已存在則忽略）
  INSERT INTO bottle_access (user_id, bottle_id)
  VALUES (current_user_id, target_bottle_id)
  ON CONFLICT (user_id, bottle_id) DO NOTHING;

  -- 回傳瓶子（不含 secret_code）
  RETURN QUERY
  SELECT
    b.id,
    b.author_id,
    b.author_name,
    b.content,
    b.image_url,
    b.bottle_type,
    b.city,
    b.is_pushable,
    b.relay_count,
    b.current_holder_id,
    b.status,
    b.created_at
  FROM bottles b
  WHERE b.id = target_bottle_id;
END;
$$;

-- 只允許已認證用戶呼叫
REVOKE ALL ON FUNCTION unlock_secret_bottle(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION unlock_secret_bottle(TEXT) TO authenticated;

-- 4. 遷移現有明文暗號為雜湊（如果有的話）
-- 注意：這是一次性遷移，將現有明文轉為 bcrypt 雜湊
UPDATE bottles
SET secret_code = extensions.crypt(secret_code, extensions.gen_salt('bf', 8))
WHERE bottle_type = 'secret'
  AND secret_code IS NOT NULL
  AND secret_code NOT LIKE '$2%';  -- 排除已經是 bcrypt 格式的

-- 5. 清理過期的嘗試記錄（可選：建立定期清理）
-- 刪除超過 24 小時的記錄
DELETE FROM secret_code_attempts
WHERE attempted_at < NOW() - INTERVAL '24 hours';

-- 6. 建立 trigger：INSERT 時自動雜湊 secret_code
CREATE OR REPLACE FUNCTION hash_secret_code_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 如果是暗號瓶且有 secret_code，進行雜湊
  IF NEW.bottle_type = 'secret' AND NEW.secret_code IS NOT NULL AND NEW.secret_code != '' THEN
    -- 檢查是否已經是 bcrypt 格式（避免重複雜湊）
    IF NEW.secret_code NOT LIKE '$2%' THEN
      NEW.secret_code := extensions.crypt(NEW.secret_code, extensions.gen_salt('bf', 8));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 建立 trigger
DROP TRIGGER IF EXISTS trigger_hash_secret_code ON bottles;
CREATE TRIGGER trigger_hash_secret_code
  BEFORE INSERT ON bottles
  FOR EACH ROW
  EXECUTE FUNCTION hash_secret_code_on_insert();

-- 加上註解
COMMENT ON TABLE secret_code_attempts IS '暗號瓶嘗試次數追蹤，用於防止暴力破解（5次/小時）';
COMMENT ON FUNCTION hash_secret_code(TEXT) IS '使用 bcrypt 雜湊暗號，用於儲存暗號瓶';
COMMENT ON FUNCTION unlock_secret_bottle(TEXT) IS '驗證暗號並解鎖暗號瓶，含嘗試次數限制（5次/小時）';
COMMENT ON FUNCTION hash_secret_code_on_insert() IS '自動在 INSERT 時雜湊暗號瓶的 secret_code';
