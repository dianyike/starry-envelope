'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { getUserProfile, getBeachBottles } from '@/lib/actions/bottle'
import { TreePalm } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'

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

type Profile = {
  id: string
  nickname: string | null
  city: string | null
  fishing_nets: number
  points: number
}

type BeachItem = {
  id: string
  is_read: boolean
  created_at: string
  bottles: {
    id: string
    content: string
    author_name: string | null
    bottle_type: string
    created_at: string
  } | null
}

interface BeachDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BeachDialog({ open, onOpenChange }: BeachDialogProps) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [beachItems, setBeachItems] = useState<BeachItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    Promise.all([getUserProfile(), getBeachBottles()]).then(([profileData, beachData]) => {
      if (cancelled) return
      setProfile(profileData as Profile | null)
      setBeachItems(beachData as BeachItem[])
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>我的海灘</DialogTitle>
          <DialogDescription>歡迎回來，{profile?.nickname || '旅人'}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12">
            <Spinner className="size-5" />
            <span className="text-muted-foreground">載入中...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* User Stats */}
            <div className="flex gap-4 rounded-lg bg-muted/50 p-4 text-sm">
              <div>
                <span className="text-muted-foreground">今日漁網：</span>
                <span className="font-medium">{profile?.fishing_nets ?? 6} 個</span>
              </div>
              <div>
                <span className="text-muted-foreground">積分：</span>
                <span className="font-medium">{profile?.points ?? 0}</span>
              </div>
            </div>

            {/* Beach Bottles */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium">沖上岸的瓶子</h3>

              {beachItems && beachItems.length > 0 ? (
                beachItems.map((item) => {
                  const bottle = item.bottles
                  if (!bottle) return null

                  return (
                    <Card key={item.id} className={item.is_read ? 'opacity-70' : ''}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardDescription>來自 {bottle.author_name || '匿名'}</CardDescription>
                          <Badge variant="secondary">
                            {BOTTLE_TYPE_LABELS[bottle.bottle_type] || bottle.bottle_type}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="whitespace-pre-wrap">{bottle.content}</p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {new Date(bottle.created_at).toLocaleDateString('zh-TW')}
                        </p>
                      </CardContent>
                    </Card>
                  )
                })
              ) : (
                <div className="flex flex-col items-center py-8">
                  <TreePalm className="h-12 w-12 text-muted-foreground" />
                  <p className="mt-4 text-muted-foreground">海灘上還沒有瓶子</p>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
