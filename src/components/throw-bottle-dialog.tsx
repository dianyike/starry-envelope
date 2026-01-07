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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { throwBottle, getUserProfile } from '@/lib/actions/bottle'
import { toast } from 'sonner'
import { Spinner } from '@/components/ui/spinner'
import type { BottleType } from '@/types/database'

const TAIWAN_CITIES = [
  '台北市', '新北市', '桃園市', '台中市', '台南市', '高雄市',
  '基隆市', '新竹市', '嘉義市',
  '新竹縣', '苗栗縣', '彰化縣', '南投縣', '雲林縣', '嘉義縣',
  '屏東縣', '宜蘭縣', '花蓮縣', '台東縣', '澎湖縣', '金門縣', '連江縣',
] as const

const BOTTLE_TYPES: { value: BottleType; label: string; description: string }[] = [
  { value: 'normal', label: '普通瓶', description: '隨機漂流到任何人' },
  { value: 'local', label: '同縣市瓶', description: '只發送給同縣市的人' },
  { value: 'question', label: '提問瓶', description: '向其他人提出問題' },
  { value: 'wish', label: '祝願瓶', description: '發送你的祝福' },
  { value: 'vent', label: '發洩瓶', description: '不會自動推送，只能被撈到' },
  { value: 'truth', label: '真話瓶', description: '分享真心話' },
  { value: 'secret', label: '暗號瓶', description: '只有相同暗號的人能收到' },
  { value: 'relay', label: '傳遞瓶', description: '讓話題由多人傳遞' },
]

interface ThrowBottleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ThrowBottleDialog({ open, onOpenChange }: ThrowBottleDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [bottleType, setBottleType] = useState<BottleType>('normal')
  const [content, setContent] = useState('')
  const [authorName, setAuthorName] = useState('')
  const [defaultNickname, setDefaultNickname] = useState('')
  const [secretCode, setSecretCode] = useState('')
  const [city, setCity] = useState('')

  // 開啟時載入用戶暱稱
  useEffect(() => {
    if (open && !defaultNickname) {
      getUserProfile().then((profile) => {
        if (profile?.nickname) {
          setDefaultNickname(profile.nickname)
          setAuthorName(profile.nickname)
        }
      })
    }
  }, [open, defaultNickname])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (content.length === 0) {
      toast.error('請輸入內容')
      return
    }

    if (content.length > 500) {
      toast.error('內容不能超過 500 字')
      return
    }

    setIsLoading(true)
    const result = await throwBottle({
      content,
      bottleType,
      authorName: authorName || undefined,
      secretCode: secretCode || undefined,
      city: city || undefined,
    })

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('瓶子已扔出！')
      setContent('')
      setAuthorName(defaultNickname)
      setSecretCode('')
      setCity('')
      setBottleType('normal')
      onOpenChange(false)
    }
    setIsLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>扔一個瓶子</DialogTitle>
          <DialogDescription>寫下你想說的話，讓它漂向遠方</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="authorName">你的名字（可選）</Label>
            <Input
              id="authorName"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="匿名"
            />
          </div>

          <div className="space-y-2">
            <Label>瓶子類型</Label>
            <Select value={bottleType} onValueChange={(v) => setBottleType(v as BottleType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BOTTLE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div>
                      <span className="font-medium">{type.label}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {type.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {bottleType === 'secret' && (
            <div className="space-y-2">
              <Label htmlFor="secretCode">暗號</Label>
              <Input
                id="secretCode"
                value={secretCode}
                onChange={(e) => setSecretCode(e.target.value)}
                placeholder="輸入暗號"
                required
              />
            </div>
          )}

          {bottleType === 'local' && (
            <div className="space-y-2">
              <Label>縣市</Label>
              <Select value={city} onValueChange={setCity} required>
                <SelectTrigger>
                  <SelectValue placeholder="選擇縣市" />
                </SelectTrigger>
                <SelectContent>
                  {TAIWAN_CITIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="content">內容</Label>
              <span
                className={`text-xs ${content.length > 500 ? 'text-red-500' : 'text-muted-foreground'}`}
              >
                {content.length}/500
              </span>
            </div>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="寫下你想說的話..."
              rows={4}
              maxLength={500}
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? <><Spinner /> 扔出中...</> : '扔出瓶子'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
