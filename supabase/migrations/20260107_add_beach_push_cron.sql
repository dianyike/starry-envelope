-- =====================================================
-- 海灘瓶子推送功能
-- 每天自動推送 0~3 瓶到用戶海灘
-- =====================================================

-- 1. 啟用必要的擴展
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. 為 beach 表添加唯一約束（避免重複推送同一瓶子給同一用戶）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'beach_user_bottle_unique'
  ) THEN
    ALTER TABLE beach ADD CONSTRAINT beach_user_bottle_unique
    UNIQUE (user_id, bottle_id);
  END IF;
END $$;

-- 3. 建立推送瓶子的 RPC 函數
CREATE OR REPLACE FUNCTION push_bottles_to_beach()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user RECORD;
  v_push_count INT;
  v_total_pushed INT := 0;
  v_total_users INT := 0;
  v_bottle_ids UUID[];
BEGIN
  -- 遍歷最近 7 天有活動的用戶
  FOR v_user IN
    SELECT id FROM profiles
    WHERE created_at >= NOW() - INTERVAL '7 days'
  LOOP
    v_total_users := v_total_users + 1;

    -- 隨機決定推送數量 (0~3)
    v_push_count := floor(random() * 4)::INT;

    IF v_push_count = 0 THEN
      CONTINUE;
    END IF;

    -- 取得可推送的瓶子（排除自己的、已互動過的、已在海灘的）
    SELECT ARRAY_AGG(b.id)
    INTO v_bottle_ids
    FROM (
      SELECT id
      FROM bottles
      WHERE status = 'floating'
        AND is_pushable = true
        AND author_id != v_user.id
        AND id NOT IN (
          SELECT bottle_id FROM bottle_interactions WHERE user_id = v_user.id
        )
        AND id NOT IN (
          SELECT bottle_id FROM beach WHERE user_id = v_user.id
        )
      ORDER BY random()
      LIMIT v_push_count
    ) b;

    -- 如果有可推送的瓶子，插入到海灘
    IF v_bottle_ids IS NOT NULL AND array_length(v_bottle_ids, 1) > 0 THEN
      INSERT INTO beach (user_id, bottle_id, is_read)
      SELECT v_user.id, unnest(v_bottle_ids), false
      ON CONFLICT (user_id, bottle_id) DO NOTHING;

      v_total_pushed := v_total_pushed + array_length(v_bottle_ids, 1);
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'pushed', v_total_pushed,
    'users', v_total_users
  );
END;
$$;

-- 🔒 SEC-001: 限制 RPC 執行權限（只允許 service_role）
REVOKE EXECUTE ON FUNCTION push_bottles_to_beach() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION push_bottles_to_beach() FROM anon;
REVOKE EXECUTE ON FUNCTION push_bottles_to_beach() FROM authenticated;
GRANT EXECUTE ON FUNCTION push_bottles_to_beach() TO service_role;

-- 4. 建立 cron job（每天早上 8:00 UTC+8 = 00:00 UTC 執行）
-- 🔒 SEC-002: 使用獨立 cron_secret 驗證（不暴露 service_role_key）
SELECT cron.schedule(
  'push-bottles-to-beach',  -- job 名稱
  '0 0 * * *',              -- 每天 00:00 UTC (台灣時間 08:00)
  $$
  SELECT net.http_post(
    url := 'https://jbqvqievsuzwlmgeenbq.supabase.co/functions/v1/push-bottles',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'cron_secret'
      )
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- =====================================================
-- 🔒 安全設定步驟（需要在 Supabase Dashboard 執行）
-- =====================================================
--
-- 1. 產生並存入 cron_secret（用於 cron job 驗證）：
--    前往 Dashboard > Vault，新增 secret：
--    - Name: cron_secret
--    - Secret: 自行產生一個強隨機字串（例如：openssl rand -base64 32）
--
-- 2. 設定 Edge Function 環境變數：
--    前往 Dashboard > Edge Functions > push-bottles > Settings
--    新增環境變數：
--    - CRON_SECRET: （與 Vault 中的 cron_secret 相同）
--
-- 3. 部署 Edge Function：
--    supabase functions deploy push-bottles --project-ref jbqvqievsuzwlmgeenbq
--
-- 4. 驗證 cron job：
--    SELECT * FROM cron.job;
--
-- =====================================================
