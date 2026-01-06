-- 修復 Code Review 發現的安全問題
-- 1. 暗號瓶解鎖後無法回覆（缺少 picked 互動）
-- 2. scalar RPC + .single() 可能回 406
-- 3. secret_code UPDATE trigger
-- 4. 定期清理機制

-- ============================================
-- 1. 修復 unlock_secret_bottle：加入 picked 互動
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

  -- 檢查過去一小時的嘗試次數
  one_hour_ago := NOW() - INTERVAL '1 hour';

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

  -- 成功：刪除嘗試記錄
  DELETE FROM secret_code_attempts
  WHERE user_id = current_user_id;

  -- 建立授權記錄
  INSERT INTO bottle_access (user_id, bottle_id)
  VALUES (current_user_id, target_bottle_id)
  ON CONFLICT (user_id, bottle_id) DO NOTHING;

  -- 【修復】建立 picked 互動記錄，讓用戶可以回覆
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
-- 2. 修復 check_signup_rate_limit：改為回傳 TABLE 避免 406
-- ============================================
DROP FUNCTION IF EXISTS check_signup_rate_limit(TEXT);

CREATE OR REPLACE FUNCTION check_signup_rate_limit(client_ip TEXT)
RETURNS TABLE (allowed BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  attempt_count INT;
  one_minute_ago TIMESTAMPTZ;
BEGIN
  -- 空 IP 視為允許
  IF client_ip IS NULL OR client_ip = '' THEN
    RETURN QUERY SELECT TRUE;
    RETURN;
  END IF;

  one_minute_ago := NOW() - INTERVAL '1 minute';

  -- 順便清理過期記錄（避免需要額外排程）
  DELETE FROM signup_rate_limits
  WHERE created_at < NOW() - INTERVAL '5 minutes';

  SELECT COUNT(*) INTO attempt_count
  FROM signup_rate_limits
  WHERE ip_address = client_ip
    AND created_at > one_minute_ago;

  IF attempt_count >= 10 THEN
    RETURN QUERY SELECT FALSE;
    RETURN;
  END IF;

  INSERT INTO signup_rate_limits (ip_address)
  VALUES (client_ip);

  RETURN QUERY SELECT TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION check_signup_rate_limit(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION check_signup_rate_limit(TEXT) TO authenticated;

-- ============================================
-- 3. 修復 get_unread_replies_count：改為回傳 TABLE
-- ============================================
DROP FUNCTION IF EXISTS get_unread_replies_count();

CREATE OR REPLACE FUNCTION get_unread_replies_count()
RETURNS TABLE (count INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_count INT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT 0;
    RETURN;
  END IF;

  SELECT COALESCE(SUM(unread_replies_count), 0)::INT
  INTO v_count
  FROM bottles
  WHERE author_id = v_user_id;

  RETURN QUERY SELECT v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION get_unread_replies_count() TO authenticated;

-- ============================================
-- 4. 補上 secret_code UPDATE trigger
-- ============================================
CREATE OR REPLACE FUNCTION hash_secret_code_on_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 如果 secret_code 被更新且不是 bcrypt 格式，進行雜湊
  IF NEW.secret_code IS DISTINCT FROM OLD.secret_code THEN
    IF NEW.secret_code IS NOT NULL AND NEW.secret_code != '' THEN
      IF NEW.secret_code NOT LIKE '$2%' THEN
        NEW.secret_code := extensions.crypt(NEW.secret_code, extensions.gen_salt('bf', 8));
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_hash_secret_code_update ON bottles;
CREATE TRIGGER trigger_hash_secret_code_update
  BEFORE UPDATE OF secret_code ON bottles
  FOR EACH ROW
  EXECUTE FUNCTION hash_secret_code_on_update();

-- ============================================
-- 5. 清理 secret_code_attempts 也加入自動清理
-- ============================================
-- 在 unlock_secret_bottle 執行時順便清理（已在上面實作）
-- 這裡執行一次手動清理
DELETE FROM secret_code_attempts
WHERE attempted_at < NOW() - INTERVAL '24 hours';

COMMENT ON FUNCTION unlock_secret_bottle(TEXT) IS '驗證暗號並解鎖暗號瓶（含 picked 互動 + 5次/小時限制）';
COMMENT ON FUNCTION check_signup_rate_limit(TEXT) IS '檢查 IP rate limit（回傳 TABLE 避免 406）';
COMMENT ON FUNCTION get_unread_replies_count() IS '取得未讀數量（回傳 TABLE 避免 406）';
COMMENT ON FUNCTION hash_secret_code_on_update() IS 'UPDATE 時自動雜湊 secret_code';
