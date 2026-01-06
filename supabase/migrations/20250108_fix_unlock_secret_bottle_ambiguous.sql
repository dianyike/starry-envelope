-- 修復 unlock_secret_bottle RPC：id 欄位歧義 + 新增 likes_count

DROP FUNCTION IF EXISTS unlock_secret_bottle(text);

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
  relay_count INT,
  current_holder_id UUID,
  status bottle_status,
  likes_count INT,
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

  -- 清理過期記錄
  DELETE FROM secret_code_attempts
  WHERE id IN (
    SELECT sca.id FROM secret_code_attempts sca
    WHERE sca.attempted_at < NOW() - INTERVAL '24 hours'
    LIMIT 100
  );

  -- 檢查過去一小時的嘗試次數
  SELECT COUNT(*) INTO attempt_count
  FROM secret_code_attempts sca
  WHERE sca.user_id = current_user_id
    AND sca.attempted_at > one_hour_ago;

  IF attempt_count >= 5 THEN
    RAISE EXCEPTION 'Too many attempts. Please try again later.';
  END IF;

  -- 記錄嘗試
  INSERT INTO secret_code_attempts (user_id)
  VALUES (current_user_id);

  -- 找到符合暗號的瓶子
  SELECT bot.id INTO target_bottle_id
  FROM bottles bot
  WHERE bot.bottle_type = 'secret'
    AND bot.status = 'floating'
    AND bot.author_id <> current_user_id
    AND bot.secret_code IS NOT NULL
    AND extensions.crypt(code, bot.secret_code) = bot.secret_code
  ORDER BY bot.created_at DESC
  LIMIT 1;

  IF target_bottle_id IS NULL THEN
    RETURN;
  END IF;

  -- 成功：刪除該用戶的嘗試記錄
  DELETE FROM secret_code_attempts sca
  WHERE sca.user_id = current_user_id;

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
    bot.id,
    bot.author_id,
    bot.author_name,
    bot.content,
    bot.image_url,
    bot.bottle_type,
    bot.city,
    bot.is_pushable,
    bot.relay_count,
    bot.current_holder_id,
    bot.status,
    bot.likes_count,
    bot.created_at
  FROM bottles bot
  WHERE bot.id = target_bottle_id;
END;
$$;

GRANT EXECUTE ON FUNCTION unlock_secret_bottle(text) TO authenticated;

COMMENT ON FUNCTION unlock_secret_bottle(text) IS '解鎖暗號瓶（修復 id 歧義 + likes_count）';
