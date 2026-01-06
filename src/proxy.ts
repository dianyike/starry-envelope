import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// 取得客戶端 IP（優先使用不可偽造的 header）
function getClientIp(request: NextRequest): string {
  // Vercel 設置的真實 IP（不可被客戶端偽造）
  const vercelForwardedFor = request.headers.get('x-vercel-forwarded-for')
  if (vercelForwardedFor) {
    return vercelForwardedFor.split(',')[0].trim()
  }

  // Cloudflare 設置的真實 IP（不可被客戶端偽造）
  const cfConnectingIp = request.headers.get('cf-connecting-ip')
  if (cfConnectingIp) {
    return cfConnectingIp
  }

  // Vercel 的 x-real-ip（由 Vercel 設置）
  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  // x-forwarded-for 可能被偽造，放在最後且只在有其他驗證時使用
  // 在 Vercel 環境下，上面的 header 應該已經覆蓋大部分情況
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }

  // 無法取得 IP 時，使用 fallback（這些請求會被單獨追蹤）
  return '__no_ip__'
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
    const clientIp = getClientIp(request)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rateLimitData, error: rateLimitError } = await (supabase as any)
      .rpc('check_signup_rate_limit', { client_ip: clientIp })
      .single() as { data: { allowed: boolean } | null; error: { message: string } | null }

    if (rateLimitError) {
      console.error('[Proxy] Rate limit check failed:', rateLimitError.message)
      // 檢查失敗時允許通過（避免阻擋合法用戶）
    } else if (rateLimitData?.allowed === false) {
      console.warn('[Proxy] Rate limited IP:', clientIp)
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
