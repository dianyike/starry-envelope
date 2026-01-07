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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getUserProfile, updateProfile } from '@/lib/actions/bottle'
import { toast } from 'sonner'
import { User, MapPin, Fish } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'

const TAIWAN_CITIES = [
  '台北市', '新北市', '桃園市', '台中市', '台南市', '高雄市',
  '基隆市', '新竹市', '嘉義市',
  '新竹縣', '苗栗縣', '彰化縣', '南投縣', '雲林縣', '嘉義縣',
  '屏東縣', '宜蘭縣', '花蓮縣', '台東縣', '澎湖縣', '金門縣', '連江縣',
] as const

interface ProfileDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ProfileDialog({ open, onOpenChange }: ProfileDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [nickname, setNickname] = useState('')
  const [city, setCity] = useState<string>('')
  const [fishingNets, setFishingNets] = useState(0)

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsLoading(true)
      getUserProfile()
        .then((profile) => {
          if (profile) {
            setNickname(profile.nickname || '')
            setCity(profile.city || '')
            setFishingNets(profile.fishing_nets)
          }
        })
        .finally(() => setIsLoading(false))
    }
  }, [open])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSaving(true)

    const result = await updateProfile({
      nickname: nickname || undefined,
      city: city || null,
    })

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('個人資料已更新')
      onOpenChange(false)
    }
    setIsSaving(false)
  }

  function handleClearCity() {
    setCity('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            個人資料
          </DialogTitle>
          <DialogDescription>設定你的暱稱和所在縣市</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-8">
            <Spinner className="size-5" />
            <span className="text-muted-foreground">載入中...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-lg bg-muted/50 p-4">
              <div className="flex items-center gap-2 text-sm">
                <Fish className="h-4 w-4 text-primary" />
                <span>今日剩餘漁網：</span>
                <span className="font-medium text-primary">{fishingNets}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nickname">暱稱</Label>
              <Input
                id="nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="匿名"
                maxLength={20}
              />
              <p className="text-xs text-muted-foreground">
                用於顯示在你扔出的瓶子上
              </p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                所在縣市
              </Label>
              <Select value={city} onValueChange={setCity}>
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
              {city && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClearCity}
                  className="text-xs text-muted-foreground hover:text-red-500"
                >
                  清除縣市設定
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                設定後可優先收到同縣市的瓶子
              </p>
            </div>

            <Button type="submit" className="w-full" disabled={isSaving}>
              {isSaving ? <><Spinner /> 儲存中...</> : '儲存'}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
