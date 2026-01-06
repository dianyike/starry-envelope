-- 建立暗號瓶授權表：記錄哪些用戶已解鎖哪些暗號瓶
CREATE TABLE IF NOT EXISTS bottle_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bottle_id UUID NOT NULL REFERENCES bottles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, bottle_id)
);

-- 建立索引加速查詢
CREATE INDEX IF NOT EXISTS idx_bottle_access_user_bottle
ON bottle_access (user_id, bottle_id);

CREATE INDEX IF NOT EXISTS idx_bottle_access_bottle_id
ON bottle_access (bottle_id);

-- RLS 政策：用戶只能查看/刪除自己的授權記錄
-- 注意：不提供 INSERT policy，授權只能透過 unlock_secret_bottle RPC 寫入
ALTER TABLE bottle_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own access"
ON bottle_access FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can delete own access"
ON bottle_access FOR DELETE
USING (user_id = auth.uid());
