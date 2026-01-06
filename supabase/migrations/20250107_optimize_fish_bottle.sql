-- 優化 fish_bottle RPC：NOT EXISTS + 原子性漁網扣減 + 分段查詢
-- 解決：
-- 1. NOT IN 子查詢效能問題 → 改用 NOT EXISTS
-- 2. 漁網扣減非原子性 → 使用 SELECT FOR UPDATE
-- 3. 條件式 ORDER BY 破壞索引 → 分段查詢（先同縣市，再全域）

-- 先刪除舊函數
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
  -- 取得當前用戶 ID
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 原子性取得並鎖定用戶 profile（防止併發超領）
  SELECT fishing_nets, nets_reset_at, city
  INTO v_fishing_nets, v_nets_reset_at, v_user_city
  FROM profiles
  WHERE profiles.id = v_user_id
  FOR UPDATE;

  -- 如果用戶不存在，建立 profile
  IF NOT FOUND THEN
    INSERT INTO profiles (id, fishing_nets, nets_reset_at)
    VALUES (v_user_id, 6, NOW())
    ON CONFLICT (id) DO NOTHING;
    v_fishing_nets := 6;
    v_nets_reset_at := NOW();
    v_user_city := NULL;
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

  -- 分段查詢策略：
  -- 第一階段：嘗試撈同縣市瓶（如果用戶有設定縣市）
  IF v_user_city IS NOT NULL THEN
    SELECT b.id, b.bottle_type INTO v_bottle_id, v_bottle_type
    FROM bottles b
    WHERE b.status = 'floating'
      AND b.author_id != v_user_id
      AND b.bottle_type = 'local'
      AND b.city = v_user_city
      AND (b.bottle_type != 'relay' OR b.current_holder_id IS NULL)
      -- 使用 NOT EXISTS 取代 NOT IN（效能更好）
      AND NOT EXISTS (
        SELECT 1 FROM bottle_interactions bi
        WHERE bi.bottle_id = b.id
          AND bi.user_id = v_user_id
          AND bi.interaction_type IN ('disliked', 'reported', 'thrown_back')
      )
    ORDER BY b.created_at DESC
    LIMIT 1;
  END IF;

  -- 第二階段：如果沒有同縣市瓶，撈一般瓶子
  IF v_bottle_id IS NULL THEN
    SELECT b.id, b.bottle_type INTO v_bottle_id, v_bottle_type
    FROM bottles b
    WHERE b.status = 'floating'
      AND b.author_id != v_user_id
      AND b.bottle_type != 'secret'
      AND (b.bottle_type != 'relay' OR b.current_holder_id IS NULL)
      AND NOT EXISTS (
        SELECT 1 FROM bottle_interactions bi
        WHERE bi.bottle_id = b.id
          AND bi.user_id = v_user_id
          AND bi.interaction_type IN ('disliked', 'reported', 'thrown_back')
      )
    ORDER BY b.created_at DESC
    LIMIT 1;
  END IF;

  IF v_bottle_id IS NULL THEN
    RAISE EXCEPTION 'No bottles available';
  END IF;

  -- 檢查是否已撈過這個瓶子（傳遞瓶除外）
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

  -- 只有新瓶子才扣漁網（原子性已由 FOR UPDATE 保證）
  IF v_is_new THEN
    UPDATE profiles
    SET fishing_nets = fishing_nets - 1
    WHERE profiles.id = v_user_id;
    v_fishing_nets := v_fishing_nets - 1;
  END IF;

  -- 記錄互動
  INSERT INTO bottle_interactions (bottle_id, user_id, interaction_type)
  VALUES (v_bottle_id, v_user_id, 'picked');

  -- 如果是傳遞瓶，設定當前傳遞者並將狀態改為 picked
  IF v_bottle_type = 'relay' THEN
    UPDATE bottles
    SET current_holder_id = v_user_id, status = 'picked'
    WHERE bottles.id = v_bottle_id;
  END IF;

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
    b.is_pushable,
    b.relay_count,
    b.current_holder_id,
    b.created_at,
    v_fishing_nets,
    v_is_new
  FROM bottles b
  WHERE b.id = v_bottle_id;
END;
$$;

-- 授權給已認證用戶
GRANT EXECUTE ON FUNCTION fish_bottle() TO authenticated;

-- 加上效能相關索引（如果不存在）
-- 複合索引：加速 NOT EXISTS 子查詢
CREATE INDEX IF NOT EXISTS idx_bottle_interactions_exclusion
ON bottle_interactions (bottle_id, user_id, interaction_type)
WHERE interaction_type IN ('disliked', 'reported', 'thrown_back');

-- 局部索引：加速同縣市瓶查詢
CREATE INDEX IF NOT EXISTS idx_bottles_local_city
ON bottles (city, created_at DESC)
WHERE bottle_type = 'local' AND status = 'floating';

-- 局部索引：加速一般瓶子查詢
CREATE INDEX IF NOT EXISTS idx_bottles_floating_general
ON bottles (created_at DESC)
WHERE status = 'floating' AND bottle_type != 'secret';

COMMENT ON FUNCTION fish_bottle() IS '優化的撈瓶子函數：NOT EXISTS + FOR UPDATE 原子性 + 分段查詢';
