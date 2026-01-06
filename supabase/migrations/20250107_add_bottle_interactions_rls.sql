-- bottle_interactions RLS 政策
-- 確保用戶只能存取自己的互動記錄

-- 確保 RLS 已啟用
ALTER TABLE bottle_interactions ENABLE ROW LEVEL SECURITY;

-- 刪除可能存在的舊政策
DROP POLICY IF EXISTS "interactions_select_own" ON bottle_interactions;
DROP POLICY IF EXISTS "interactions_insert_own" ON bottle_interactions;
DROP POLICY IF EXISTS "interactions_delete_bottle_author" ON bottle_interactions;

-- 1. SELECT: 用戶只能查看自己的互動記錄
CREATE POLICY "interactions_select_own"
ON bottle_interactions FOR SELECT
USING (user_id = auth.uid());

-- 2. INSERT: 用戶只能建立自己的互動記錄
CREATE POLICY "interactions_insert_own"
ON bottle_interactions FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND user_id = auth.uid()
);

-- 3. DELETE: 瓶子作者可以刪除該瓶子的所有互動記錄（用於刪除瓶子時清理）
CREATE POLICY "interactions_delete_bottle_author"
ON bottle_interactions FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM bottles b
    WHERE b.id = bottle_interactions.bottle_id
      AND b.author_id = auth.uid()
  )
);

-- 加上註解
COMMENT ON POLICY "interactions_select_own" ON bottle_interactions IS
  '用戶只能查看自己的互動記錄';
COMMENT ON POLICY "interactions_insert_own" ON bottle_interactions IS
  '用戶只能建立自己的互動記錄';
COMMENT ON POLICY "interactions_delete_bottle_author" ON bottle_interactions IS
  '瓶子作者可以刪除該瓶子的所有互動記錄';
