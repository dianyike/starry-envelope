-- 刪除舊的 SELECT 政策
DROP POLICY IF EXISTS "bottles_select_floating_or_own" ON bottles;

-- 建立新的 SELECT 政策：保護暗號瓶
-- 1. 自己的瓶子可以看
-- 2. 漂流中的非暗號瓶可以看
-- 3. 暗號瓶只有作者或已解鎖的人可以看
CREATE POLICY "bottles_select_with_secret_protection"
ON bottles FOR SELECT
USING (
  author_id = auth.uid()
  OR (
    status = 'floating'
    AND bottle_type <> 'secret'
  )
  OR (
    bottle_type = 'secret'
    AND EXISTS (
      SELECT 1 FROM bottle_access
      WHERE bottle_access.bottle_id = bottles.id
        AND bottle_access.user_id = auth.uid()
    )
  )
);
