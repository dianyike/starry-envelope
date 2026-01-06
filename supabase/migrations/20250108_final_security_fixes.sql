-- 最終安全修復（確保在所有 20250107 migration 之後執行）
-- 1. unlock_secret_bottle 加入 picked 互動（讓暗號瓶可回覆）
-- 2. secret_code_attempts 自動清理

-- ============================================
-- 1. 最終版 unlock_secret_bottle（含 picked 互動 + 自動清理）
-- ============================================
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

  -- 順便清理過期的嘗試記錄（> 24 小時）
  DELETE FROM secret_code_attempts
  WHERE attempted_at < NOW() - INTERVAL '24 hours';

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

  -- 找到符合暗號的瓶子（bcrypt 比對）
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

  -- 建立 picked 互動記錄（讓用戶可以回覆）
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

COMMENT ON FUNCTION unlock_secret_bottle(TEXT) IS
  '驗證暗號並解鎖暗號瓶（含 picked 互動 + 5次/小時限制 + 自動清理）';
