-- 修復 fish_bottle RPC 中 city 欄位歧義問題
-- 問題：RETURNS TABLE 的 city 欄位與 SELECT b.city 產生衝突
-- 解法：將表別名從 b 改為 bot，避免與輸出欄位名稱衝突

DROP FUNCTION IF EXISTS fish_bottle();

CREATE OR REPLACE FUNCTION fish_bottle()
RETURNS TABLE (
  id UUID,
  author_id UUID,
  author_name TEXT,
  content TEXT,
  image_url TEXT,
  bottle_type TEXT,
  status TEXT,
  city TEXT,
  is_pushable BOOLEAN,
  relay_count INT,
  current_holder_id UUID,
  created_at TIMESTAMPTZ,
  nets_remaining INT,
  is_new_bottle BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_city TEXT;
  v_fishing_nets INT;
  v_nets_reset_at TIMESTAMPTZ;
  v_should_reset BOOLEAN;
  v_bottle_id UUID;
  v_bottle_type TEXT;
  v_is_new BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 原子性取得並鎖定用戶 profile
  SELECT p.fishing_nets, p.nets_reset_at, p.city
  INTO v_fishing_nets, v_nets_reset_at, v_user_city
  FROM profiles p
  WHERE p.id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO profiles (id, fishing_nets, nets_reset_at)
    VALUES (v_user_id, 6, NOW())
    ON CONFLICT (id) DO NOTHING;
    v_fishing_nets := 6;
    v_nets_reset_at := NOW();
    v_user_city := NULL;
  END IF;

  v_should_reset := v_nets_reset_at IS NULL OR DATE(v_nets_reset_at) < CURRENT_DATE;

  IF v_should_reset THEN
    UPDATE profiles
    SET fishing_nets = 6, nets_reset_at = NOW()
    WHERE profiles.id = v_user_id;
    v_fishing_nets := 6;
  ELSIF v_fishing_nets <= 0 THEN
    RAISE EXCEPTION 'No fishing nets remaining';
  END IF;

  -- 分段查詢：先同縣市瓶
  IF v_user_city IS NOT NULL THEN
    SELECT bot.id, bot.bottle_type INTO v_bottle_id, v_bottle_type
    FROM bottles bot
    WHERE bot.status = 'floating'
      AND bot.author_id != v_user_id
      AND bot.bottle_type = 'local'
      AND bot.city = v_user_city
      AND (bot.bottle_type != 'relay' OR bot.current_holder_id IS NULL)
      AND NOT EXISTS (
        SELECT 1 FROM bottle_interactions bi
        WHERE bi.bottle_id = bot.id
          AND bi.user_id = v_user_id
          AND bi.interaction_type IN ('disliked', 'reported', 'thrown_back')
      )
    ORDER BY bot.created_at DESC
    LIMIT 1;
  END IF;

  -- 再一般瓶子
  IF v_bottle_id IS NULL THEN
    SELECT bot.id, bot.bottle_type INTO v_bottle_id, v_bottle_type
    FROM bottles bot
    WHERE bot.status = 'floating'
      AND bot.author_id != v_user_id
      AND bot.bottle_type != 'secret'
      AND (bot.bottle_type != 'relay' OR bot.current_holder_id IS NULL)
      AND NOT EXISTS (
        SELECT 1 FROM bottle_interactions bi
        WHERE bi.bottle_id = bot.id
          AND bi.user_id = v_user_id
          AND bi.interaction_type IN ('disliked', 'reported', 'thrown_back')
      )
    ORDER BY bot.created_at DESC
    LIMIT 1;
  END IF;

  IF v_bottle_id IS NULL THEN
    RAISE EXCEPTION 'No bottles available';
  END IF;

  IF v_bottle_type = 'relay' THEN
    v_is_new := TRUE;
  ELSE
    SELECT NOT EXISTS (
      SELECT 1 FROM bottle_interactions bi
      WHERE bi.user_id = v_user_id
        AND bi.bottle_id = v_bottle_id
        AND bi.interaction_type = 'picked'
    ) INTO v_is_new;
  END IF;

  IF v_is_new THEN
    UPDATE profiles
    SET fishing_nets = fishing_nets - 1
    WHERE profiles.id = v_user_id;
    v_fishing_nets := v_fishing_nets - 1;
  END IF;

  INSERT INTO bottle_interactions (bottle_id, user_id, interaction_type)
  VALUES (v_bottle_id, v_user_id, 'picked');

  IF v_bottle_type = 'relay' THEN
    UPDATE bottles
    SET current_holder_id = v_user_id, status = 'picked'
    WHERE bottles.id = v_bottle_id;
  END IF;

  RETURN QUERY
  SELECT
    bot.id,
    bot.author_id,
    bot.author_name,
    bot.content,
    bot.image_url,
    bot.bottle_type::TEXT,
    bot.status::TEXT,
    bot.city,
    bot.is_pushable,
    bot.relay_count,
    bot.current_holder_id,
    bot.created_at,
    v_fishing_nets,
    v_is_new
  FROM bottles bot
  WHERE bot.id = v_bottle_id;
END;
$$;

GRANT EXECUTE ON FUNCTION fish_bottle() TO authenticated;

COMMENT ON FUNCTION fish_bottle() IS '撈瓶子函數（修復 city 欄位歧義）';
