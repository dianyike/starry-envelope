-- 修復 replies INSERT 政策：必須先撈過瓶子才能回覆
-- 原政策只檢查 author_id = auth.uid()，導致任何用戶可對任意瓶子回覆

-- 刪除舊政策
DROP POLICY IF EXISTS "replies_insert_authenticated" ON replies;

-- 建立新政策：必須已撈過該瓶子（有 picked 互動記錄）才能回覆
CREATE POLICY "replies_insert_must_have_picked"
ON replies FOR INSERT
WITH CHECK (
  -- 確認是當前用戶
  auth.uid() IS NOT NULL
  AND auth.uid() = author_id
  -- 確認用戶已撈過這個瓶子
  AND EXISTS (
    SELECT 1 FROM bottle_interactions bi
    WHERE bi.bottle_id = replies.bottle_id
      AND bi.user_id = auth.uid()
      AND bi.interaction_type = 'picked'
  )
);

-- 加上註解說明
COMMENT ON POLICY "replies_insert_must_have_picked" ON replies IS
  '用戶必須已撈過瓶子（有 picked 互動記錄）才能回覆，防止未授權回覆';
