'use server'

import { headers } from 'next/headers'

/**
 * CSRF 保護驗證
 * 檢查 Origin/Referer header 是否來自同一個 host
 * 防止跨站請求偽造攻擊
 */
export async function verifyCsrf(): Promise<void> {
  const headersList = await headers()
  const origin = headersList.get('origin')
  const referer = headersList.get('referer')
  const host = headersList.get('host')

  // 開發環境檢查
  const isDev = process.env.NODE_ENV === 'development'

  // 如果沒有 host，無法驗證
  if (!host) {
    console.warn('[CSRF] Missing host header')
    // 開發環境允許通過，生產環境阻擋
    if (!isDev) {
      throw new Error('CSRF validation failed: Missing host header')
    }
    return
  }

  // 檢查 Origin header（優先）
  if (origin) {
    try {
      const originHost = new URL(origin).host
      if (originHost === host) {
        return // 驗證通過
      }
      // Origin 不匹配
      console.warn('[CSRF] Origin mismatch:', { origin, host })
      throw new Error('CSRF validation failed: Invalid origin')
    } catch (e) {
      if (e instanceof Error && e.message.includes('CSRF')) {
        throw e
      }
      // URL 解析失敗
      console.warn('[CSRF] Invalid origin URL:', origin)
      throw new Error('CSRF validation failed: Invalid origin format')
    }
  }

  // Fallback: 檢查 Referer header
  if (referer) {
    try {
      const refererHost = new URL(referer).host
      if (refererHost === host) {
        return // 驗證通過
      }
      // Referer 不匹配
      console.warn('[CSRF] Referer mismatch:', { referer, host })
      throw new Error('CSRF validation failed: Invalid referer')
    } catch (e) {
      if (e instanceof Error && e.message.includes('CSRF')) {
        throw e
      }
      // URL 解析失敗
      console.warn('[CSRF] Invalid referer URL:', referer)
      throw new Error('CSRF validation failed: Invalid referer format')
    }
  }

  // 都沒有 Origin 和 Referer
  // 某些合法情況可能沒有這些 header（如 same-origin 的 GET 請求）
  // 但 POST 請求通常應該有，所以記錄警告
  console.warn('[CSRF] Missing origin and referer headers')

  // 對於 Server Actions (POST)，如果沒有 Origin/Referer 是可疑的
  // 但為了相容性，開發環境允許通過
  if (!isDev) {
    throw new Error('CSRF validation failed: Missing origin/referer')
  }
}
