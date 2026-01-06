-- 匿名登入 IP 限流：防止機器人批量建立帳號
-- 使用資料庫追蹤 IP 的匿名登入次數（10次/分鐘）

-- 1. 建立 IP 登入記錄表
CREATE TABLE IF NOT EXISTS signup_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 建立索引加速查詢
CREATE INDEX IF NOT EXISTS idx_signup_rate_limits_ip_time
ON signup_rate_limits (ip_address, created_at DESC);

-- 不啟用 RLS（只由 RPC 存取）
ALTER TABLE signup_rate_limits DISABLE ROW LEVEL SECURITY;

-- 2. 建立 rate limit 檢查 RPC
-- 回傳 TRUE = 允許，FALSE = 被限制
CREATE OR REPLACE FUNCTION check_signup_rate_limit(client_ip TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  attempt_count INT;
  one_minute_ago TIMESTAMPTZ;
BEGIN
  -- 空 IP 視為允許（避免阻擋合法請求）
  IF client_ip IS NULL OR client_ip = '' THEN
    RETURN TRUE;
  END IF;

  one_minute_ago := NOW() - INTERVAL '1 minute';

  -- 計算過去一分鐘的登入次數
  SELECT COUNT(*) INTO attempt_count
  FROM signup_rate_limits
  WHERE ip_address = client_ip
    AND created_at > one_minute_ago;

  -- 超過 10 次則拒絕
  IF attempt_count >= 10 THEN
    RETURN FALSE;
  END IF;

  -- 記錄這次嘗試
  INSERT INTO signup_rate_limits (ip_address)
  VALUES (client_ip);

  RETURN TRUE;
END;
$$;

-- 允許 anon 呼叫（因為尚未登入）
GRANT EXECUTE ON FUNCTION check_signup_rate_limit(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION check_signup_rate_limit(TEXT) TO authenticated;

-- 3. 清理過期記錄的函數（可由 cron job 呼叫）
CREATE OR REPLACE FUNCTION cleanup_signup_rate_limits()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM signup_rate_limits
  WHERE created_at < NOW() - INTERVAL '5 minutes';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- 4. 初始清理
SELECT cleanup_signup_rate_limits();

COMMENT ON TABLE signup_rate_limits IS '匿名登入 IP 限流追蹤（10次/分鐘）';
COMMENT ON FUNCTION check_signup_rate_limit(TEXT) IS '檢查 IP 是否可以建立新匿名帳號';
COMMENT ON FUNCTION cleanup_signup_rate_limits() IS '清理過期的 rate limit 記錄';
