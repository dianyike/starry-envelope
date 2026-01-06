-- 優化的撈瓶子 RPC：一次資料庫呼叫完成所有邏輯
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
  v_fishing_nets INT;
  v_nets_reset_at TIMESTAMPTZ;
  v_should_reset BOOLEAN;
  v_bottle_id UUID;
  v_is_new BOOLEAN;
BEGIN
  -- 取得當前用戶 ID
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 取得用戶的漁網資訊
  SELECT fishing_nets, nets_reset_at
  INTO v_fishing_nets, v_nets_reset_at
  FROM profiles
  WHERE profiles.id = v_user_id;

  -- 如果用戶不存在，建立 profile
  IF NOT FOUND THEN
    INSERT INTO profiles (id, fishing_nets, nets_reset_at)
    VALUES (v_user_id, 6, NOW())
    ON CONFLICT (id) DO NOTHING;
    v_fishing_nets := 6;
    v_nets_reset_at := NOW();
  END IF;

  -- 檢查是否需要重置漁網（每日重置）
  v_should_reset := v_nets_reset_at IS NULL OR DATE(v_nets_reset_at) < CURRENT_DATE;

  IF v_should_reset THEN
    UPDATE profiles
    SET fishing_nets = 6, nets_reset_at = NOW()
    WHERE profiles.id = v_user_id;
    v_fishing_nets := 6;
  ELSIF v_fishing_nets <= 0 THEN
    RAISE EXCEPTION 'No fishing nets remaining';
  END IF;

  -- 撈瓶子：排除自己的、排除 disliked/reported/thrown_back 的
  SELECT b.id INTO v_bottle_id
  FROM bottles b
  WHERE b.status = 'floating'
    AND b.author_id != v_user_id
    AND b.bottle_type != 'secret'  -- 排除暗號瓶
    AND b.id NOT IN (
      SELECT bi.bottle_id
      FROM bottle_interactions bi
      WHERE bi.user_id = v_user_id
        AND bi.interaction_type IN ('disliked', 'reported', 'thrown_back')
    )
  ORDER BY b.created_at DESC
  LIMIT 1;

  IF v_bottle_id IS NULL THEN
    RAISE EXCEPTION 'No bottles available';
  END IF;

  -- 檢查是否已撈過這個瓶子
  SELECT EXISTS (
    SELECT 1 FROM bottle_interactions bi
    WHERE bi.user_id = v_user_id
      AND bi.bottle_id = v_bottle_id
      AND bi.interaction_type = 'picked'
  ) INTO v_is_new;
  v_is_new := NOT v_is_new;

  -- 只有新瓶子才扣漁網
  IF v_is_new THEN
    UPDATE profiles
    SET fishing_nets = fishing_nets - 1
    WHERE profiles.id = v_user_id;
    v_fishing_nets := v_fishing_nets - 1;
  END IF;

  -- 記錄互動
  INSERT INTO bottle_interactions (bottle_id, user_id, interaction_type)
  VALUES (v_bottle_id, v_user_id, 'picked');

  -- 回傳瓶子資料
  RETURN QUERY
  SELECT
    b.id,
    b.author_id,
    b.author_name,
    b.content,
    b.image_url,
    b.bottle_type::TEXT,
    b.status::TEXT,
    b.city,
    b.created_at,
    v_fishing_nets,
    v_is_new
  FROM bottles b
  WHERE b.id = v_bottle_id;
END;
$$;

-- 授權給已認證用戶
GRANT EXECUTE ON FUNCTION fish_bottle() TO authenticated;
