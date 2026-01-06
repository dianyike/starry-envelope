'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  fishBottle,
  replyToBottle,
  replyToRelayBottle,
  getRelayBottleReplies,
  throwBackBottle,
  dislikeBottle,
  reportBottle,
  toggleLikeBottle,
  hasLikedBottle,
  type Bottle,
  type Reply,
} from '@/lib/actions/bottle'
import { toast } from 'sonner'
import { FishingHook, RefreshCw, Heart } from 'lucide-react'
import { motion } from 'motion/react'

const BOTTLE_TYPE_LABELS: Record<string, string> = {
  normal: '普通瓶',
  local: '同縣市瓶',
  question: '提問瓶',
  wish: '祝願瓶',
  vent: '發洩瓶',
  truth: '真話瓶',
  secret: '暗號瓶',
  relay: '傳遞瓶',
}

interface FishBottleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FishBottleDialog({ open, onOpenChange }: FishBottleDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [bottle, setBottle] = useState<Bottle | null>(null)
  const [reply, setReply] = useState('')
  const [isReplying, setIsReplying] = useState(false)
  const [secretCode, setSecretCode] = useState('')
  const [relayReplies, setRelayReplies] = useState<Reply[]>([])
  const [isLoadingReplies, setIsLoadingReplies] = useState(false)
  const [hasLiked, setHasLiked] = useState(false)
  const [likesCount, setLikesCount] = useState(0)
  const [isLiking, setIsLiking] = useState(false)

  // 撈到傳遞瓶時載入對話鏈
  useEffect(() => {
    if (bottle?.bottle_type === 'relay') {
      let cancelled = false
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsLoadingReplies(true)
      getRelayBottleReplies(bottle.id)
        .then((data) => {
          if (!cancelled) setRelayReplies(data)
        })
        .finally(() => {
          if (!cancelled) setIsLoadingReplies(false)
        })
      return () => { cancelled = true }
    } else {
      setRelayReplies([])
    }
  }, [bottle])

  async function handleFish() {
    setIsLoading(true)
    const code = secretCode.trim() || undefined
    const result = await fishBottle(code)
    if ('error' in result) {
      if (code) {
        toast.error('找不到符合這個暗號的瓶子')
      } else {
        toast.error(result.error)
      }
    } else {
      setBottle(result.data)
      setLikesCount(result.data.likes_count)
      // 檢查是否已點讚
      const liked = await hasLikedBottle(result.data.id)
      setHasLiked(liked)
      toast.success(code ? '找到暗號瓶了！' : '撈到一個瓶子！')
    }
    setIsLoading(false)
  }

  async function handleReply() {
    if (!bottle || !reply.trim()) return
    setIsReplying(true)

    // 傳遞瓶使用專用的回覆函數
    const isRelay = bottle.bottle_type === 'relay'
    const result = isRelay
      ? await replyToRelayBottle(bottle.id, reply)
      : await replyToBottle(bottle.id, reply)

    if ('error' in result) {
      toast.error(result.error)
    } else {
      toast.success(isRelay ? '已傳遞！瓶子繼續漂流' : '回覆已發送！')
      setBottle(null)
      setReply('')
      setRelayReplies([])
    }
    setIsReplying(false)
  }

  async function handleThrowBack() {
    if (!bottle) return
    await throwBackBottle(bottle.id)
    toast.success('已扔回海裡')
    setBottle(null)
  }

  async function handleDislike() {
    if (!bottle) return
    await dislikeBottle(bottle.id)
    toast.success('已標記為厭惡')
    setBottle(null)
  }

  async function handleReport() {
    if (!bottle) return
    await reportBottle(bottle.id, '不當內容')
    toast.success('已檢舉')
    setBottle(null)
  }

  async function handleLike() {
    if (!bottle || isLiking) return
    setIsLiking(true)
    // Optimistic update
    const previousLiked = hasLiked
    const previousCount = likesCount
    setHasLiked(!hasLiked)
    setLikesCount(hasLiked ? likesCount - 1 : likesCount + 1)

    const result = await toggleLikeBottle(bottle.id)
    if ('error' in result) {
      // Rollback on error
      setHasLiked(previousLiked)
      setLikesCount(previousCount)
      toast.error(result.error)
    }
    setIsLiking(false)
  }

  function handleClose(isOpen: boolean) {
    if (!isOpen) {
      setBottle(null)
      setReply('')
      setSecretCode('')
      setHasLiked(false)
      setLikesCount(0)
    }
    onOpenChange(isOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        {!bottle ? (
          <>
            <DialogHeader>
              <DialogTitle>撈瓶子</DialogTitle>
              <DialogDescription>使用漁網從海裡撈起一個漂流瓶</DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center py-8">
              <FishingHook className="h-16 w-16 text-primary" />

              <div className="mt-6 w-full space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="secretCode" className="text-muted-foreground">
                    暗號（可選）
                  </Label>
                  <Input
                    id="secretCode"
                    value={secretCode}
                    onChange={(e) => setSecretCode(e.target.value)}
                    placeholder="輸入暗號撈取暗號瓶"
                  />
                  <p className="text-xs text-muted-foreground">
                    留空則撈取普通瓶子
                  </p>
                </div>

                <Button onClick={handleFish} className="w-full" size="lg" disabled={isLoading}>
                  {isLoading ? '撈取中...' : secretCode.trim() ? '搜尋暗號瓶' : '撈一個瓶子'}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle className="flex items-center gap-2">漂流瓶</DialogTitle>
                <Badge variant="secondary">
                  {BOTTLE_TYPE_LABELS[bottle.bottle_type] || bottle.bottle_type}
                </Badge>
              </div>
              <DialogDescription>
                來自 {bottle.author_name || '匿名'} ·{' '}
                {new Date(bottle.created_at).toLocaleDateString('zh-TW')}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <p className="whitespace-pre-wrap rounded-lg bg-muted/50 p-4 text-base">
                {bottle.content}
              </p>

              {/* 愛心按鈕 */}
              <motion.button
                onClick={handleLike}
                disabled={isLiking}
                whileTap={{ scale: 0.8 }}
                className="flex items-center gap-1.5 text-sm"
              >
                <motion.div
                  animate={hasLiked ? { scale: [1, 1.25, 1] } : { scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                >
                  <Heart
                    className={`h-5 w-5 transition-colors ${hasLiked ? 'fill-red-500 text-red-500' : 'text-muted-foreground hover:text-red-400'}`}
                  />
                </motion.div>
                <span className={hasLiked ? 'text-red-500' : 'text-muted-foreground'}>
                  {likesCount}
                </span>
              </motion.button>

              {/* 傳遞瓶：顯示對話鏈 */}
              {bottle.bottle_type === 'relay' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <RefreshCw className="h-4 w-4" />
                    <span>已傳遞 {bottle.relay_count} 次</span>
                  </div>

                  {isLoadingReplies ? (
                    <div className="text-center text-sm text-muted-foreground">
                      載入對話鏈...
                    </div>
                  ) : relayReplies.length > 0 ? (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">對話鏈</h4>
                      <div className="max-h-48 space-y-2 overflow-y-auto">
                        {relayReplies.map((r, idx) => (
                          <div key={r.id} className="rounded-lg border p-3 text-sm">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>#{idx + 1} {r.author_name || '匿名'}</span>
                              <span>{new Date(r.created_at).toLocaleDateString('zh-TW')}</span>
                            </div>
                            <p className="mt-1 whitespace-pre-wrap">{r.content}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

              <div className="space-y-2">
                <Textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder={bottle.bottle_type === 'relay' ? '加入你的話，繼續傳遞...' : '寫下你的回覆...'}
                  rows={3}
                  maxLength={140}
                />
                <div className="flex justify-end text-xs text-muted-foreground">
                  {reply.length}/140
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Button onClick={handleReply} className="w-full" disabled={isReplying || !reply.trim()}>
                  {isReplying ? '發送中...' : bottle.bottle_type === 'relay' ? '傳遞' : '回覆'}
                </Button>
                <div className="flex w-full gap-2">
                  <Button variant="outline" className="flex-1" onClick={handleThrowBack}>
                    扔回海裡
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={handleDislike}>
                    厭惡
                  </Button>
                  <Button variant="destructive" className="flex-1" onClick={handleReport}>
                    檢舉
                  </Button>
                </div>
                <Button variant="ghost" className="w-full" onClick={() => setBottle(null)}>
                  繼續撈瓶子
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
