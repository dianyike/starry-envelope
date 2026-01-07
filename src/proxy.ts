import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// 🔒 SEC-003: 取得客戶端 IP（只信任平台提供的 header）
function getClientIp(request: NextRequest): string {
  // 1. Vercel 設置的真實 IP（不可被客戶端偽造）- 最可信
  const vercelForwardedFor = request.headers.get('x-vercel-forwarded-for')
  if (vercelForwardedFor) {
    return vercelForwardedFor.split(',')[0].trim()
  }

  // 2. Cloudflare 設置的真實 IP（不可被客戶端偽造）
  const cfConnectingIp = request.headers.get('cf-connecting-ip')
  if (cfConnectingIp) {
    return cfConnectingIp
  }

  // 3. Vercel 的 x-real-ip（由 Vercel 設置）
  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  // ⚠️ 不再信任 x-forwarded-for（可被偽造）
  // 在 Vercel/Cloudflare 環境下，上面的 header 已覆蓋所有情況
  // 如果都沒有，說明在本地開發或非標準環境

  // 無法取得 IP 時，使用 fallback
  // 這些請求會被施加更嚴格的限制
  return '__no_ip__'
}

// 🔒 取得用於 rate limiting 的請求指紋
function getRequestFingerprint(request: NextRequest): string {
  const ip = getClientIp(request)
  // 對於無法識別 IP 的請求，加入 User-Agent 作為輔助識別
  if (ip === '__no_ip__') {
    const ua = request.headers.get('user-agent')?.slice(0, 50) || 'unknown'
    return `__no_ip__:${ua}`
  }
  return ip
}

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 檢查是否有現有 session
  const {
    data: { user },
    error: getUserError,
  } = await supabase.auth.getUser()

  if (getUserError) {
    console.error('[Proxy] Failed to get user:', getUserError.message)
    // 繼續執行，讓 signInAnonymously 嘗試建立新 session
  }

  if (!user) {
    // 無 session，檢查 IP rate limit
    // 🔒 SEC-003: 使用請求指紋進行 rate limiting
    const fingerprint = getRequestFingerprint(request)
    const clientIp = getClientIp(request)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rateLimitData, error: rateLimitError } = await (supabase as any)
      .rpc('check_signup_rate_limit', { client_ip: fingerprint })
      .single() as { data: { allowed: boolean } | null; error: { message: string } | null }

    if (rateLimitError) {
      console.error('[Proxy] Rate limit check failed:', rateLimitError.message)
      // 檢查失敗時允許通過（避免阻擋合法用戶）
    } else if (rateLimitData?.allowed === false) {
      // 🔒 記錄被阻擋的請求（用於安全監控）
      console.warn('[Proxy] Rate limited request:', {
        ip: clientIp,
        fingerprint: fingerprint.slice(0, 80), // 限制日誌長度
        ua: request.headers.get('user-agent')?.slice(0, 100),
        timestamp: new Date().toISOString(),
      })
      return new NextResponse(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '60',
          },
        }
      )
    }

    // 建立匿名登入
    // 必須在 proxy 層執行，因為 Server Component 無法寫 cookie
    const { data, error: signInError } = await supabase.auth.signInAnonymously()

    // 🔒 SEC-011: 成功登入後 refresh session，防止 session 固定攻擊
    if (data?.user) {
      await supabase.auth.refreshSession()
    }

    if (signInError || !data.user) {
      console.error('[Proxy] Failed to create anonymous session:', signInError?.message || 'No user returned')

      // 根據請求類型返回適當的錯誤回應
      const acceptHeader = request.headers.get('accept') || ''
      const isHtmlRequest =
        acceptHeader.includes('text/html') ||
        acceptHeader.includes('text/x-component') ||
        acceptHeader === '*/*'

      if (isHtmlRequest) {
        // HTML 請求：返回友善的錯誤頁面
        return new NextResponse(
          `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>連線錯誤</title></head>
<body style="font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#0a0a0a;color:#fff">
<div style="text-align:center"><img src="/logo.png" alt="Logo" style="width:80px;height:80px;margin-bottom:1rem"><p>無法建立連線，請稍後再試</p>
<button onclick="location.reload()" style="margin-top:1rem;padding:0.5rem 1rem;cursor:pointer">重新整理</button></div>
</body></html>`,
          {
            status: 503,
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'no-store, must-revalidate',
            },
          }
        )
      }

      // API/JSON 請求
      return new NextResponse(
        JSON.stringify({ error: 'Failed to establish session' }),
        {
          status: 503,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, must-revalidate',
          },
        }
      )
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
