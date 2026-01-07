-- =====================================================
-- 🔒 安全修復：更新 cron job 使用獨立 cron_secret
-- =====================================================

-- 1. 刪除舊的 cron job
SELECT cron.unschedule('push-bottles-to-beach');

-- 2. 建立新的 cron job（使用 cron_secret 而非 service_role_key）
SELECT cron.schedule(
  'push-bottles-to-beach',
  '0 0 * * *',
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

-- 驗證：SELECT * FROM cron.job WHERE jobname = 'push-bottles-to-beach';
