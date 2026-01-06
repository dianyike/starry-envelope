-- 傳遞瓶回覆 RPC：回覆後自動繼續漂流
CREATE OR REPLACE FUNCTION relay_bottle_reply(
  p_bottle_id UUID,
  p_content TEXT,
  p_author_name TEXT DEFAULT '匿名'
)
RETURNS TABLE (
  success BOOLEAN,
  relay_count INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_bottle_type TEXT;
  v_current_holder UUID;
  v_new_relay_count INT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 驗證內容不為空且長度合法
  IF p_content IS NULL OR LENGTH(TRIM(p_content)) = 0 THEN
    RAISE EXCEPTION 'Content cannot be empty';
  END IF;

  IF LENGTH(p_content) > 140 THEN
    RAISE EXCEPTION 'Content too long (max 140 characters)';
  END IF;

  -- 驗證瓶子存在且為傳遞瓶，且用戶是當前傳遞者
  SELECT bottle_type, current_holder_id
  INTO v_bottle_type, v_current_holder
  FROM bottles
  WHERE id = p_bottle_id;

  IF v_bottle_type IS NULL THEN
    RAISE EXCEPTION 'Bottle not found';
  END IF;

  IF v_bottle_type != 'relay' THEN
    RAISE EXCEPTION 'Not a relay bottle';
  END IF;

  IF v_current_holder IS NULL OR v_current_holder != v_user_id THEN
    RAISE EXCEPTION 'Not the current holder';
  END IF;

  -- 插入回覆
  INSERT INTO replies (bottle_id, author_id, author_name, content)
  VALUES (p_bottle_id, v_user_id, COALESCE(NULLIF(TRIM(p_author_name), ''), '匿名'), p_content);

  -- 記錄互動
  INSERT INTO bottle_interactions (bottle_id, user_id, interaction_type)
  VALUES (p_bottle_id, v_user_id, 'replied');

  -- 更新瓶子：增加 relay_count，清空 current_holder，恢復漂流
  UPDATE bottles
  SET
    relay_count = bottles.relay_count + 1,
    current_holder_id = NULL,
    status = 'floating'
  WHERE id = p_bottle_id
  RETURNING bottles.relay_count INTO v_new_relay_count;

  RETURN QUERY SELECT TRUE, v_new_relay_count;
END;
$$;

-- 撤銷所有權限後重新授權
REVOKE ALL ON FUNCTION relay_bottle_reply(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION relay_bottle_reply(UUID, TEXT, TEXT) TO authenticated;

-- 傳遞瓶放棄 RPC：扔回海裡或厭惡時使用
CREATE OR REPLACE FUNCTION release_relay_bottle(p_bottle_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_bottle_type TEXT;
  v_current_holder UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 驗證瓶子存在且為傳遞瓶，且用戶是當前傳遞者
  SELECT bottle_type, current_holder_id
  INTO v_bottle_type, v_current_holder
  FROM bottles
  WHERE id = p_bottle_id;

  IF v_bottle_type IS NULL THEN
    RAISE EXCEPTION 'Bottle not found';
  END IF;

  IF v_bottle_type != 'relay' THEN
    -- 非傳遞瓶不需要特殊處理
    RETURN TRUE;
  END IF;

  IF v_current_holder IS NULL OR v_current_holder != v_user_id THEN
    -- 不是當前傳遞者，不需要處理
    RETURN TRUE;
  END IF;

  -- 清空 current_holder，恢復漂流
  UPDATE bottles
  SET
    current_holder_id = NULL,
    status = 'floating'
  WHERE id = p_bottle_id;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION release_relay_bottle(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION release_relay_bottle(UUID) TO authenticated;
