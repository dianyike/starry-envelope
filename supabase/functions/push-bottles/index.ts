import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * 海灘瓶子推送 Edge Function
 * 只允許 pg_cron 使用獨立 CRON_SECRET 呼叫
 *
 * 安全措施：
 * 1. 只允許 POST 方法
 * 2. 使用獨立 CRON_SECRET 驗證（不暴露 service_role_key）
 * 3. 不暴露 CORS（內部呼叫不需要）
 * 4. RPC 層級限制只有 service_role 可執行
 */

Deno.serve(async (req) => {
  // 🔒 SEC-001: 只允許 POST 方法
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    // 🔒 SEC-002: 驗證環境變數
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const cronSecret = Deno.env.get('CRON_SECRET')

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!cronSecret) {
      console.error('CRON_SECRET not configured')
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // 🔒 SEC-003: 使用獨立 CRON_SECRET 驗證（不暴露 service_role_key）
    const authHeader = req.headers.get('Authorization')
    const expectedAuth = `Bearer ${cronSecret}`

    if (authHeader !== expectedAuth) {
      console.warn('Unauthorized access attempt')
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // 使用 service_role 建立 Supabase client（內部使用，不暴露給外部）
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // 呼叫 RPC 執行推送邏輯
    const { data, error } = await supabase.rpc('push_bottles_to_beach')

    if (error) {
      console.error('RPC error:', error)
      return new Response(JSON.stringify({ error: 'Push failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    console.log('Push result:', data)

    return new Response(
      JSON.stringify({
        success: true,
        ...data
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
