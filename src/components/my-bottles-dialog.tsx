'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  getMyBottles,
  markRepliesAsRead,
  retrieveBottle,
  deleteBottle,
  refloatBottle,
  type BottleWithReplies,
} from '@/lib/actions/bottle'
import { triggerNavbarRefresh } from '@/components/staggered-menu'
import { BottleWine } from 'lucide-react'
import { toast } from 'sonner'

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

const STATUS_LABELS: Record<string, string> = {
  floating: '漂流中',
  picked: '已被撈起',
  retrieved: '已收回',
  deleted: '已刪除',
}

interface MyBottlesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MyBottlesDialog({ open, onOpenChange }: MyBottlesDialogProps) {
  const [bottles, setBottles] = useState<BottleWithReplies[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    getMyBottles().then((data) => {
      if (cancelled) return
      setBottles(data)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [open])

  const handleMarkAsRead = async (bottleId: string) => {
    const result = await markRepliesAsRead(bottleId)
    if ('error' in result) return

    setBottles((prev) =>
      prev.map((bottle) =>
        bottle.id === bottleId
          ? {
              ...bottle,
              replies: bottle.replies.map((r) => ({ ...r, is_read: true })),
            }
          : bottle
      )
    )

    triggerNavbarRefresh()
  }

  const handleRetrieve = async (bottleId: string) => {
    const result = await retrieveBottle(bottleId)
    if ('error' in result) {
      toast.error(result.error)
      return
    }

    setBottles((prev) =>
      prev.map((bottle) =>
        bottle.id === bottleId ? { ...bottle, status: 'retrieved' } : bottle
      )
    )
    toast.success('瓶子已收回')
  }

  const handleDeleteClick = (bottleId: string) => {
    setDeleteConfirm(bottleId)
  }

  const handleRefloat = async (bottleId: string) => {
    const result = await refloatBottle(bottleId)
    if ('error' in result) {
      toast.error(result.error)
      return
    }

    setBottles((prev) =>
      prev.map((bottle) =>
        bottle.id === bottleId ? { ...bottle, status: 'floating' } : bottle
      )
    )
    toast.success('瓶子已重新漂流')
  }

  const confirmDelete = async () => {
    if (!deleteConfirm) return

    const result = await deleteBottle(deleteConfirm)
    if ('error' in result) {
      toast.error(result.error)
      setDeleteConfirm(null)
      return
    }

    setBottles((prev) => prev.filter((bottle) => bottle.id !== deleteConfirm))
    setDeleteConfirm(null)
    toast.success('瓶子已刪除')
  }

  const getUnreadCount = (bottle: BottleWithReplies) =>
    bottle.replies.filter((r) => !r.is_read).length

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>我的瓶子</DialogTitle>
          <DialogDescription>查看你扔出去的瓶子和收到的回覆</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <span className="text-muted-foreground">載入中...</span>
          </div>
        ) : bottles.length > 0 ? (
          <Accordion type="single" collapsible className="space-y-2">
            {bottles.map((bottle) => {
              const unreadCount = getUnreadCount(bottle)

              return (
                <AccordionItem
                  key={bottle.id}
                  value={bottle.id}
                  className="rounded-lg border bg-card px-4"
                >
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex w-full items-center justify-between pr-4">
                      <div className="flex flex-col items-start gap-1">
                        <p className="line-clamp-1 text-left text-sm font-normal">
                          {bottle.content}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="secondary" className="text-xs">
                            {BOTTLE_TYPE_LABELS[bottle.bottle_type]}
                          </Badge>
                          <span>{STATUS_LABELS[bottle.status]}</span>
                          <span>
                            {new Date(bottle.created_at).toLocaleDateString('zh-TW')}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {bottle.replies.length > 0 && (
                          <span className="text-sm text-muted-foreground">
                            {bottle.replies.length} 則回覆
                          </span>
                        )}
                        {unreadCount > 0 && (
                          <Badge
                            variant="destructive"
                            className="h-5 min-w-5 rounded-full px-1.5 font-mono text-xs tabular-nums"
                          >
                            {unreadCount}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pb-4">
                      <div className="rounded-lg bg-muted/50 p-4">
                        <p className="whitespace-pre-wrap text-sm">{bottle.content}</p>
                      </div>

                      {bottle.replies.length > 0 ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium">回覆</h4>
                            {unreadCount > 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMarkAsRead(bottle.id)}
                              >
                                標記全部已讀
                              </Button>
                            )}
                          </div>
                          {bottle.replies.map((reply) => (
                            <div
                              key={reply.id}
                              className={`rounded-lg border p-3 ${
                                !reply.is_read
                                  ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950'
                                  : ''
                              }`}
                            >
                              <div className="mb-1 flex items-center justify-between">
                                <span className="text-xs font-medium">
                                  {reply.author_name || '匿名'}
                                </span>
                                <div className="flex items-center gap-2">
                                  {!reply.is_read && (
                                    <Badge variant="default" className="text-xs">
                                      新
                                    </Badge>
                                  )}
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(reply.created_at).toLocaleDateString('zh-TW')}
                                  </span>
                                </div>
                              </div>
                              <p className="whitespace-pre-wrap text-sm">{reply.content}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-center text-sm text-muted-foreground">
                          還沒有人回覆這個瓶子
                        </p>
                      )}

                      {/* 收回/刪除按鈕 */}
                      <div className="flex justify-end gap-2 border-t pt-4">
                        {bottle.status === 'floating' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRetrieve(bottle.id)}
                          >
                            收回瓶子
                          </Button>
                        )}
                        {bottle.status === 'retrieved' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRefloat(bottle.id)}
                            >
                              重新漂流
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteClick(bottle.id)}
                            >
                              刪除瓶子
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )
            })}
          </Accordion>
        ) : (
          <div className="flex flex-col items-center py-12">
            <BottleWine className="h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">你還沒有扔過瓶子</p>
          </div>
        )}
      </DialogContent>
    </Dialog>

    <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>確定要刪除這個瓶子嗎？</AlertDialogTitle>
          <AlertDialogDescription>
            刪除後將無法復原，瓶子和所有回覆都會被永久刪除。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-white">
            確定刪除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}
