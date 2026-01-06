-- 傳遞瓶支援：新增 current_holder_id 欄位

-- 新增欄位：記錄當前傳遞者
ALTER TABLE bottles
ADD COLUMN IF NOT EXISTS current_holder_id UUID REFERENCES auth.users(id);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_bottles_current_holder
ON bottles (current_holder_id)
WHERE bottle_type = 'relay';

CREATE INDEX IF NOT EXISTS idx_bottles_relay_floating
ON bottles (bottle_type, status)
WHERE bottle_type = 'relay' AND status = 'floating';

-- 更新 replies 的 RLS 政策：傳遞瓶的回覆可被當前傳遞者查看
-- 先刪除舊政策（如果存在）
DROP POLICY IF EXISTS "replies_select_bottle_author" ON replies;
DROP POLICY IF EXISTS "replies_select_policy" ON replies;

-- 建立新的 SELECT 政策
CREATE POLICY "replies_select_policy"
ON replies FOR SELECT
USING (
  -- 非傳遞瓶：只有瓶子作者可以看回覆
  EXISTS (
    SELECT 1 FROM bottles b
    WHERE b.id = replies.bottle_id
      AND b.author_id = auth.uid()
      AND b.bottle_type != 'relay'
  )
  OR
  -- 傳遞瓶：當前傳遞者可以看所有歷史回覆
  EXISTS (
    SELECT 1 FROM bottles b
    WHERE b.id = replies.bottle_id
      AND b.bottle_type = 'relay'
      AND b.current_holder_id = auth.uid()
  )
  OR
  -- 傳遞瓶：原作者可以看所有回覆
  EXISTS (
    SELECT 1 FROM bottles b
    WHERE b.id = replies.bottle_id
      AND b.bottle_type = 'relay'
      AND b.author_id = auth.uid()
  )
);

-- 更新 bottles 的 SELECT 政策以包含 current_holder_id
DROP POLICY IF EXISTS "bottles_select_own_or_floating" ON bottles;
DROP POLICY IF EXISTS "bottles_select_policy" ON bottles;

CREATE POLICY "bottles_select_policy"
ON bottles FOR SELECT
USING (
  -- 自己的瓶子
  author_id = auth.uid()
  OR
  -- 漂流中的非暗號瓶
  (status = 'floating' AND bottle_type != 'secret')
  OR
  -- 已解鎖的暗號瓶
  (
    bottle_type = 'secret'
    AND EXISTS (
      SELECT 1 FROM bottle_access
      WHERE bottle_access.bottle_id = bottles.id
        AND bottle_access.user_id = auth.uid()
    )
  )
  OR
  -- 傳遞瓶：當前傳遞者可以看
  (bottle_type = 'relay' AND current_holder_id = auth.uid())
);

-- 更新 bottles 的 UPDATE 政策：允許傳遞瓶更新 current_holder_id
DROP POLICY IF EXISTS "bottles_update_own" ON bottles;
DROP POLICY IF EXISTS "bottles_update_policy" ON bottles;

CREATE POLICY "bottles_update_policy"
ON bottles FOR UPDATE
USING (
  author_id = auth.uid()
)
WITH CHECK (
  author_id = auth.uid()
);
