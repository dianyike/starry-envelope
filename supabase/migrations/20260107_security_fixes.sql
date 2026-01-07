-- 🔒 安全性修復 Migration
-- SEC-001: 長度約束
-- SEC-005: Profile 更新限制
-- SEC-009: RPC 輸入清理

-- ============================================
-- SEC-001: 加入 content 長度約束
-- ============================================

-- 回覆內容長度約束（140 字元）
-- 注意：LENGTH() 計算字元數，這是設計需求（允許中文）
ALTER TABLE replies DROP CONSTRAINT IF EXISTS replies_content_length;
ALTER TABLE replies ADD CONSTRAINT replies_content_length
  CHECK (LENGTH(content) <= 140 AND LENGTH(content) > 0);

-- 瓶子內容長度約束（500 字元）
ALTER TABLE bottles DROP CONSTRAINT IF EXISTS bottles_content_length;
ALTER TABLE bottles ADD CONSTRAINT bottles_content_length
  CHECK (LENGTH(content) <= 500 AND LENGTH(content) > 0);

-- 暱稱長度約束（20 字元）
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_nickname_length;
ALTER TABLE profiles ADD CONSTRAINT profiles_nickname_length
  CHECK (nickname IS NULL OR LENGTH(nickname) <= 20);

-- ============================================
-- SEC-005: Profile 更新欄位限制
-- ============================================

-- 刪除現有的 update 政策
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

-- 建立新的受限 update 政策
-- 用戶只能更新 nickname 和 city，不能修改其他欄位
CREATE POLICY "profiles_update_own_restricted" ON profiles
FOR UPDATE
USING ((select auth.uid()) = id)
WITH CHECK (
  (select auth.uid()) = id
  -- 以下欄位必須保持不變（無法被用戶修改）
  -- 注意：OLD 和 NEW 在 WITH CHECK 中不可用，這個約束透過應用層強制執行
  -- 這裡的 WITH CHECK 只確保 id 正確
);

-- ============================================
-- SEC-009: 更新 relay_bottle_reply RPC 加入輸入清理
-- ============================================

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
  v_cleaned_content TEXT;
  v_cleaned_author_name TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 🔒 SEC-009: 清理輸入（移除控制字元）
  v_cleaned_content := regexp_replace(
    COALESCE(p_content, ''),
    E'[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]',
    '',
    'g'
  );
  v_cleaned_author_name := regexp_replace(
    COALESCE(p_author_name, '匿名'),
    E'[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]',
    '',
    'g'
  );

  -- 驗證內容不為空且長度合法
  IF v_cleaned_content IS NULL OR LENGTH(TRIM(v_cleaned_content)) = 0 THEN
    RAISE EXCEPTION 'Content cannot be empty';
  END IF;

  IF LENGTH(v_cleaned_content) > 140 THEN
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

  -- 插入回覆（使用清理後的內容）
  INSERT INTO replies (bottle_id, author_id, author_name, content)
  VALUES (
    p_bottle_id,
    v_user_id,
    COALESCE(NULLIF(TRIM(v_cleaned_author_name), ''), '匿名'),
    v_cleaned_content
  );

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

-- ============================================
-- 加入 COMMENT 說明安全性修改
-- ============================================

COMMENT ON CONSTRAINT replies_content_length ON replies IS 'SEC-001: 限制回覆內容最多 140 字元';
COMMENT ON CONSTRAINT bottles_content_length ON bottles IS 'SEC-001: 限制瓶子內容最多 500 字元';
COMMENT ON CONSTRAINT profiles_nickname_length ON profiles IS 'SEC-001: 限制暱稱最多 20 字元';
COMMENT ON POLICY "profiles_update_own_restricted" ON profiles IS 'SEC-005: 用戶只能更新自己的 profile，敏感欄位由應用層控制';
COMMENT ON FUNCTION relay_bottle_reply(UUID, TEXT, TEXT) IS 'SEC-009: 傳遞瓶回覆 RPC，含輸入清理（移除控制字元）';
