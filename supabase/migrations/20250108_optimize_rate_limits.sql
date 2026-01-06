-- 優化 rate limit 機制
-- 1. signup_rate_limits 改用 bucket 計數（原子性）
-- 2. secret_code_attempts 加索引優化清理

-- ============================================
-- 1. 重構 signup_rate_limits 為 bucket 計數
-- ============================================

-- 刪除舊表
DROP TABLE IF EXISTS signup_rate_limits;

-- 建立新表：每個 IP + 時間 bucket 一筆記錄
CREATE TABLE signup_rate_limits (
  ip_address TEXT NOT NULL,
  bucket TIMESTAMPTZ NOT NULL,  -- 1 分鐘為一個 bucket
  count INT NOT NULL DEFAULT 1,
  PRIMARY KEY (ip_address, bucket)
);

-- 建立過期清理用索引
CREATE INDEX idx_signup_rate_limits_bucket
ON signup_rate_limits (bucket);

-- 重新定義 RPC：使用 UPSERT 確保原子性
DROP FUNCTION IF EXISTS check_signup_rate_limit(TEXT);

CREATE OR REPLACE FUNCTION check_signup_rate_limit(client_ip TEXT)
RETURNS TABLE (allowed BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_bucket TIMESTAMPTZ;
  current_count INT;
BEGIN
  -- 空 IP 視為允許
  IF client_ip IS NULL OR client_ip = '' THEN
    RETURN QUERY SELECT TRUE;
    RETURN;
  END IF;

  -- 計算當前 bucket（每分鐘一個）
  current_bucket := date_trunc('minute', NOW());

  -- 原子性 UPSERT：增加計數並回傳
  INSERT INTO signup_rate_limits (ip_address, bucket, count)
  VALUES (client_ip, current_bucket, 1)
  ON CONFLICT (ip_address, bucket)
  DO UPDATE SET count = signup_rate_limits.count + 1
  RETURNING signup_rate_limits.count INTO current_count;

  -- 順便清理過期 bucket（> 5 分鐘，使用索引）
  DELETE FROM signup_rate_limits
  WHERE bucket < NOW() - INTERVAL '5 minutes';

  -- 檢查是否超限
  IF current_count > 10 THEN
    RETURN QUERY SELECT FALSE;
  ELSE
    RETURN QUERY SELECT TRUE;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION check_signup_rate_limit(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION check_signup_rate_limit(TEXT) TO authenticated;

-- ============================================
-- 2. 優化 secret_code_attempts 清理
-- ============================================

-- 加索引加速清理查詢
CREATE INDEX IF NOT EXISTS idx_secret_code_attempts_time
ON secret_code_attempts (attempted_at);

-- 更新 unlock_secret_bottle：限制清理範圍避免全表掃描
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
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  one_hour_ago := NOW() - INTERVAL '1 hour';

  -- 清理過期記錄（使用索引 + LIMIT 避免長時間鎖表）
  DELETE FROM secret_code_attempts
  WHERE id IN (
    SELECT id FROM secret_code_attempts
    WHERE attempted_at < NOW() - INTERVAL '24 hours'
    LIMIT 100
  );

  -- 檢查過去一小時的嘗試次數
  SELECT COUNT(*) INTO attempt_count
  FROM secret_code_attempts
  WHERE user_id = current_user_id
    AND attempted_at > one_hour_ago;

  IF attempt_count >= 5 THEN
    RAISE EXCEPTION 'Too many attempts. Please try again later.';
  END IF;

  -- 記錄嘗試
  INSERT INTO secret_code_attempts (user_id)
  VALUES (current_user_id);

  -- 找到符合暗號的瓶子
  SELECT b.id INTO target_bottle_id
  FROM bottles b
  WHERE b.bottle_type = 'secret'
    AND b.status = 'floating'
    AND b.author_id <> current_user_id
    AND b.secret_code IS NOT NULL
    AND extensions.crypt(code, b.secret_code) = b.secret_code
  ORDER BY b.created_at DESC
  LIMIT 1;

  IF target_bottle_id IS NULL THEN
    RETURN;
  END IF;

  -- 成功：刪除該用戶的嘗試記錄
  DELETE FROM secret_code_attempts
  WHERE user_id = current_user_id;

  -- 建立授權記錄
  INSERT INTO bottle_access (user_id, bottle_id)
  VALUES (current_user_id, target_bottle_id)
  ON CONFLICT (user_id, bottle_id) DO NOTHING;

  -- 建立 picked 互動記錄
  INSERT INTO bottle_interactions (bottle_id, user_id, interaction_type)
  VALUES (target_bottle_id, current_user_id, 'picked')
  ON CONFLICT DO NOTHING;

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

REVOKE ALL ON FUNCTION unlock_secret_bottle(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION unlock_secret_bottle(TEXT) TO authenticated;

-- ============================================
-- 註解
-- ============================================
COMMENT ON TABLE signup_rate_limits IS 'IP 限流 bucket 計數（原子性 UPSERT）';
COMMENT ON FUNCTION check_signup_rate_limit(TEXT) IS '原子性 IP 限流檢查（10次/分鐘）';
COMMENT ON FUNCTION unlock_secret_bottle(TEXT) IS '驗證暗號並解鎖暗號瓶（含 picked 互動 + 限量清理）';
