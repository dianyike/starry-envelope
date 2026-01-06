'use server'

import { revalidatePath } from 'next/cache'
import { createClient, getAuthUserId } from '@/lib/supabase/server'
import type { BottleType, BottleStatus } from '@/types/database'
import { z } from 'zod'

// 輸入驗證 schemas
const throwBottleSchema = z.object({
  content: z.string().min(1, '內容不能為空').max(500, '內容最多 500 字'),
  bottleType: z.enum(['normal', 'local', 'question', 'wish', 'vent', 'truth', 'secret', 'relay']),
  authorName: z.string().max(20, '名稱最多 20 字').optional(),
  imageUrl: z.string().url('無效的圖片網址').max(500).optional(),
  secretCode: z.string().max(50, '暗號最多 50 字').optional(),
  city: z.string().max(20, '城市名稱最多 20 字').optional(),
})

const replySchema = z.object({
  bottleId: z.string().uuid('無效的瓶子 ID'),
  content: z.string().min(1, '內容不能為空').max(140, '回覆最多 140 字'),
  authorName: z.string().max(20, '名稱最多 20 字').optional(),
})

const reportSchema = z.object({
  bottleId: z.string().uuid('無效的瓶子 ID'),
  reason: z.string().min(1, '原因不能為空').max(200, '原因最多 200 字'),
})

const fishBottleSchema = z.object({
  secretCode: z.string().max(50, '暗號最多 50 字').optional(),
})

const updateProfileSchema = z.object({
  nickname: z.string().max(20, '暱稱最多 20 字').optional(),
  city: z.string().max(20, '縣市名稱最多 20 字').nullable().optional(),
})

interface ThrowBottleInput {
  content: string
  bottleType: BottleType
  authorName?: string
  imageUrl?: string
  secretCode?: string
  city?: string
}

// 對外暴露的 Bottle 型別（不含 secret_code）
export interface Bottle {
  id: string
  author_id: string | null
  author_name: string | null
  content: string
  image_url: string | null
  bottle_type: BottleType
  city: string | null
  is_pushable: boolean
  relay_count: number
  current_holder_id: string | null
  status: BottleStatus
  created_at: string
}

// 明確列出要查詢的欄位（不含 secret_code）
const BOTTLE_SELECT_FIELDS = 'id, author_id, author_name, content, image_url, bottle_type, city, is_pushable, relay_count, current_holder_id, status, created_at'

async function ensureUserProfile(supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never, userId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .single()

  if (!profile) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('profiles').insert({
      id: userId,
      fishing_nets: 6,
      points: 0,
      nets_reset_at: new Date().toISOString(),
    })
  }
}

export async function throwBottle(input: ThrowBottleInput) {
  // 驗證輸入
  const parsed = throwBottleSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || '輸入驗證失敗' }
  }

  const supabase = await createClient()
  const userId = await getAuthUserId(supabase)

  await ensureUserProfile(supabase, userId)

  const isPushable = parsed.data.bottleType !== 'vent' // 發洩瓶不自動推送

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('bottles')
    .insert({
      author_id: userId,
      author_name: parsed.data.authorName || '匿名',
      content: parsed.data.content,
      bottle_type: parsed.data.bottleType,
      image_url: parsed.data.imageUrl,
      secret_code: parsed.data.secretCode,
      city: parsed.data.city,
      is_pushable: isPushable,
    })
    .select(BOTTLE_SELECT_FIELDS)
    .single()

  if (error) {
    return { error: (error as { message: string }).message }
  }

  revalidatePath('/throw')
  return { data: data as Bottle }
}

export async function fishBottle(secretCode?: string): Promise<{ error: string } | { data: Bottle }> {
  // 驗證輸入
  const parsed = fishBottleSchema.safeParse({ secretCode })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || '輸入驗證失敗' }
  }

  const supabase = await createClient()

  if (parsed.data.secretCode) {
    // 有輸入暗號：呼叫 RPC 解鎖暗號瓶
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .rpc('unlock_secret_bottle', { code: parsed.data.secretCode })
      .single() as { data: Bottle | null; error: { message: string } | null }

    if (error) {
      if (error.message === 'Too many attempts. Please try again later.') {
        return { error: '嘗試次數過多，請一小時後再試' }
      }
      return { error: '找不到符合這個暗號的瓶子' }
    }

    if (!data) {
      return { error: '找不到符合這個暗號的瓶子' }
    }

    revalidatePath('/fish')
    return { data }
  }

  // 沒輸入暗號：呼叫優化的 RPC 撈普通瓶子
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .rpc('fish_bottle')
    .single() as {
    data: (Bottle & { nets_remaining: number; is_new_bottle: boolean }) | null
    error: { message: string; code?: string } | null
  }

  if (error) {
    if (error.message === 'No fishing nets remaining') {
      return { error: '今日漁網已用完，明天再來吧！' }
    }
    if (error.message === 'No bottles available') {
      return { error: '海裡沒有瓶子了，稍後再試試吧！' }
    }
    return { error: error.message }
  }

  if (!data) {
    return { error: '海裡沒有瓶子了，稍後再試試吧！' }
  }

  // 移除 RPC 額外回傳的欄位
  const { nets_remaining: _, is_new_bottle: __, ...bottle } = data

  revalidatePath('/fish')
  return { data: bottle as Bottle }
}

export async function replyToBottle(bottleId: string, content: string, authorName?: string) {
  // 驗證輸入
  const parsed = replySchema.safeParse({ bottleId, content, authorName })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || '輸入驗證失敗' }
  }

  const supabase = await createClient()
  const userId = await getAuthUserId(supabase)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('replies').insert({
    bottle_id: parsed.data.bottleId,
    author_id: userId,
    author_name: parsed.data.authorName || '匿名',
    content: parsed.data.content,
  })

  if (error) {
    return { error: (error as { message: string }).message }
  }

  // 記錄互動
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('bottle_interactions').insert({
    bottle_id: parsed.data.bottleId,
    user_id: userId,
    interaction_type: 'replied',
  })

  revalidatePath('/fish')
  revalidatePath('/beach')
  return { success: true }
}

export async function throwBackBottle(bottleId: string) {
  const supabase = await createClient()
  const userId = await getAuthUserId(supabase)

  // 記錄互動
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('bottle_interactions').insert({
    bottle_id: bottleId,
    user_id: userId,
    interaction_type: 'thrown_back',
  })

  // 如果是傳遞瓶，釋放 holder 讓瓶子繼續漂流
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).rpc('release_relay_bottle', { p_bottle_id: bottleId })

  revalidatePath('/fish')
  revalidatePath('/beach')
  return { success: true }
}

export async function dislikeBottle(bottleId: string) {
  const supabase = await createClient()
  const userId = await getAuthUserId(supabase)

  // 記錄互動
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('bottle_interactions').insert({
    bottle_id: bottleId,
    user_id: userId,
    interaction_type: 'disliked',
  })

  // 從海灘移除
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('beach').delete().eq('bottle_id', bottleId).eq('user_id', userId)

  // 如果是傳遞瓶，釋放 holder 讓瓶子繼續漂流
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).rpc('release_relay_bottle', { p_bottle_id: bottleId })

  revalidatePath('/fish')
  revalidatePath('/beach')
  return { success: true }
}

export async function reportBottle(bottleId: string, reason: string) {
  // 驗證輸入
  const parsed = reportSchema.safeParse({ bottleId, reason })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || '輸入驗證失敗' }
  }

  const supabase = await createClient()
  const userId = await getAuthUserId(supabase)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('reports').insert({
    bottle_id: parsed.data.bottleId,
    reporter_id: userId,
    reason: parsed.data.reason,
  })

  if (error) {
    return { error: (error as { message: string }).message }
  }

  // 記錄互動
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from('bottle_interactions').insert({
    bottle_id: parsed.data.bottleId,
    user_id: userId,
    interaction_type: 'reported',
  })

  revalidatePath('/fish')
  revalidatePath('/beach')
  return { success: true }
}

export async function getUserProfile() {
  const supabase = await createClient()
  const userId = await getAuthUserId(supabase)

  // 使用 upsert 確保 profile 存在，同時取得資料（單次查詢）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from('profiles')
    .upsert({
      id: userId,
      fishing_nets: 6,
      points: 0,
      nets_reset_at: new Date().toISOString(),
    }, { onConflict: 'id', ignoreDuplicates: true })
    .select('id, nickname, city, fishing_nets, points')
    .eq('id', userId)
    .single() as { data: { id: string; nickname: string | null; city: string | null; fishing_nets: number; points: number } | null }

  return profile
}

export async function updateProfile(input: { nickname?: string; city?: string | null }) {
  const parsed = updateProfileSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || '輸入驗證失敗' }
  }

  const supabase = await createClient()
  const userId = await getAuthUserId(supabase)

  // 建立更新物件，只包含有值的欄位
  const updateData: { nickname?: string; city?: string | null } = {}
  if (parsed.data.nickname !== undefined) {
    updateData.nickname = parsed.data.nickname || undefined
  }
  if (parsed.data.city !== undefined) {
    updateData.city = parsed.data.city
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('profiles')
    .update(updateData)
    .eq('id', userId)

  if (error) {
    return { error: (error as { message: string }).message }
  }

  revalidatePath('/')
  return { success: true }
}

export async function getBeachBottles() {
  const supabase = await createClient()
  const userId = await getAuthUserId(supabase)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: beachItems } = await (supabase as any)
    .from('beach')
    .select(`
      id,
      is_read,
      created_at,
      bottles (
        id,
        content,
        author_name,
        bottle_type,
        created_at
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20)

  return beachItems || []
}

export interface Reply {
  id: string
  author_id: string | null
  author_name: string | null
  content: string
  is_read: boolean
  created_at: string
}

export interface BottleWithReplies extends Bottle {
  replies: Reply[]
}

export async function getMyBottles(): Promise<BottleWithReplies[]> {
  const supabase = await createClient()
  const userId = await getAuthUserId(supabase)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: bottles } = await (supabase as any)
    .from('bottles')
    .select(`
      ${BOTTLE_SELECT_FIELDS},
      replies (
        id,
        author_id,
        author_name,
        content,
        is_read,
        created_at
      )
    `)
    .eq('author_id', userId)
    .order('created_at', { ascending: false })
    .order('created_at', { ascending: false, referencedTable: 'replies' })
    .limit(50)
    .limit(20, { referencedTable: 'replies' }) // 每個瓶子最多顯示 20 則回覆

  return (bottles || []) as BottleWithReplies[]
}

export async function getUnreadRepliesCount(): Promise<number> {
  const supabase = await createClient()

  // 使用 RPC 快速取得未讀數量（O(B) 而非 O(R)）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .rpc('get_unread_replies_count')
    .single() as { data: { count: number } | null; error: { message: string } | null }

  if (error) {
    console.error('Failed to get unread count:', error.message)
    return 0
  }

  return data?.count || 0
}

export async function markRepliesAsRead(bottleId: string) {
  const supabase = await createClient()
  const userId = await getAuthUserId(supabase)

  // 確認瓶子屬於該用戶
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: bottle } = await (supabase as any)
    .from('bottles')
    .select('id')
    .eq('id', bottleId)
    .eq('author_id', userId)
    .single()

  if (!bottle) return { error: '無權限' }

  // 標記該瓶子的所有回覆為已讀
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('replies')
    .update({ is_read: true })
    .eq('bottle_id', bottleId)

  revalidatePath('/my-bottles')
  return { success: true }
}

export async function retrieveBottle(bottleId: string) {
  const supabase = await createClient()
  const userId = await getAuthUserId(supabase)

  // 確認瓶子屬於該用戶且正在漂流
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: bottle } = await (supabase as any)
    .from('bottles')
    .select('id, status')
    .eq('id', bottleId)
    .eq('author_id', userId)
    .single() as { data: { id: string; status: string } | null }

  if (!bottle) {
    return { error: '找不到瓶子或無權限' }
  }

  if (bottle.status !== 'floating') {
    return { error: '只能收回漂流中的瓶子' }
  }

  // 更新狀態為 retrieved
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('bottles')
    .update({ status: 'retrieved' })
    .eq('id', bottleId)
    .eq('author_id', userId)

  if (error) {
    return { error: (error as { message: string }).message }
  }

  revalidatePath('/my-bottles')
  return { success: true }
}

export async function deleteBottle(bottleId: string) {
  const supabase = await createClient()
  const userId = await getAuthUserId(supabase)

  // 確認瓶子屬於該用戶且已收回
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: bottle } = await (supabase as any)
    .from('bottles')
    .select('id, status')
    .eq('id', bottleId)
    .eq('author_id', userId)
    .single() as { data: { id: string; status: string } | null }

  if (!bottle) {
    return { error: '找不到瓶子或無權限' }
  }

  if (bottle.status !== 'retrieved') {
    return { error: '只能刪除已收回的瓶子' }
  }

  // 刪除相關回覆
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('replies')
    .delete()
    .eq('bottle_id', bottleId)

  // 刪除相關互動記錄
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('bottle_interactions')
    .delete()
    .eq('bottle_id', bottleId)

  // 刪除瓶子
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('bottles')
    .delete()
    .eq('id', bottleId)
    .eq('author_id', userId)

  if (error) {
    return { error: (error as { message: string }).message }
  }

  revalidatePath('/my-bottles')
  return { success: true }
}

export async function refloatBottle(bottleId: string) {
  const supabase = await createClient()
  const userId = await getAuthUserId(supabase)

  // 確認瓶子屬於該用戶且已收回
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: bottle } = await (supabase as any)
    .from('bottles')
    .select('id, status')
    .eq('id', bottleId)
    .eq('author_id', userId)
    .single() as { data: { id: string; status: string } | null }

  if (!bottle) {
    return { error: '找不到瓶子或無權限' }
  }

  if (bottle.status !== 'retrieved') {
    return { error: '只能重新漂流已收回的瓶子' }
  }

  // 更新狀態為 floating
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('bottles')
    .update({ status: 'floating' })
    .eq('id', bottleId)
    .eq('author_id', userId)

  if (error) {
    return { error: (error as { message: string }).message }
  }

  revalidatePath('/my-bottles')
  return { success: true }
}

// ===== 傳遞瓶相關函數 =====

export async function replyToRelayBottle(bottleId: string, content: string, authorName?: string) {
  const parsed = replySchema.safeParse({ bottleId, content, authorName })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || '輸入驗證失敗' }
  }

  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .rpc('relay_bottle_reply', {
      p_bottle_id: parsed.data.bottleId,
      p_content: parsed.data.content,
      p_author_name: parsed.data.authorName || '匿名',
    })
    .single() as { data: { success: boolean; relay_count: number } | null; error: { message: string } | null }

  if (error) {
    if (error.message === 'Not the current holder') {
      return { error: '你不是當前傳遞者' }
    }
    return { error: error.message }
  }

  if (!data) {
    return { error: '回覆失敗' }
  }

  revalidatePath('/fish')
  return { success: true, relayCount: data.relay_count }
}

export async function getRelayBottleReplies(bottleId: string): Promise<Reply[]> {
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('replies')
    .select('id, author_id, author_name, content, is_read, created_at')
    .eq('bottle_id', bottleId)
    .order('created_at', { ascending: true })
    .limit(100) // 限制最多 100 則回覆

  return (data || []) as Reply[]
}
