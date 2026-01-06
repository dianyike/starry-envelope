import { getAuthUserId } from '@/lib/supabase/server'

/**
 * 取得當前用戶 ID
 * 使用 Supabase Auth 匿名登入，確保身分可信且 RLS 可用
 */
export async function getUserId(): Promise<string> {
  return getAuthUserId()
}
