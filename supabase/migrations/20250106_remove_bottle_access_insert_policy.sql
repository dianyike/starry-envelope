-- 移除 INSERT policy，防止用戶直接寫入 bottle_access 繞過暗號驗證
-- 授權只能透過 unlock_secret_bottle RPC 寫入
DROP POLICY IF EXISTS "Users can insert own access" ON bottle_access;
