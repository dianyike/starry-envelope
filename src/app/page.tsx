'use client'

import { useState } from 'react'
import { Meteors } from '@/components/ui/meteors'
import { Highlighter } from '@/components/ui/highlighter'
import { StaggeredMenu, type DialogType } from '@/components/staggered-menu'
import { ThrowBottleDialog } from '@/components/throw-bottle-dialog'
import { FishBottleDialog } from '@/components/fish-bottle-dialog'
import { MyBottlesDialog } from '@/components/my-bottles-dialog'
import { BeachDialog } from '@/components/beach-dialog'
import { ProfileDialog } from '@/components/profile-dialog'

export default function Home() {
  const [openDialog, setOpenDialog] = useState<DialogType | null>(null)

  function handleOpenDialog(dialog: DialogType) {
    setOpenDialog(dialog)
  }

  function handleCloseDialog() {
    setOpenDialog(null)
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* 背景圖片 */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/starry-pier.png')" }}
      />

      {/* 流星特效 */}
      <Meteors number={99} angle={208} />

      {/* 標題區域 */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 pb-32 text-center sm:pb-40">
        <h1 className="text-3xl font-bold leading-tight text-white drop-shadow-lg sm:text-4xl md:text-5xl lg:text-6xl">
          <Highlighter action="underline" color="#FF9800" strokeWidth={2} animationDuration={800}>在宇宙與海之間</Highlighter>，寄一封自己
        </h1>
        <p className="mt-4 text-base text-white/80 drop-shadow-md sm:text-lg md:text-xl lg:text-2xl">
          把你的<Highlighter action="highlight" color="rgba(124, 58, 237, 0.4)" strokeWidth={2} animationDuration={800}>心意裝瓶</Highlighter>，讓海替你傳遞
        </p>
      </div>

      {/* 導覽列 */}
      <StaggeredMenu onOpenDialog={handleOpenDialog} />

      {/* 對話框 */}
      <ThrowBottleDialog open={openDialog === 'throw'} onOpenChange={(open) => !open && handleCloseDialog()} />
      <FishBottleDialog open={openDialog === 'fish'} onOpenChange={(open) => !open && handleCloseDialog()} />
      <MyBottlesDialog open={openDialog === 'my-bottles'} onOpenChange={(open) => !open && handleCloseDialog()} />
      <BeachDialog open={openDialog === 'beach'} onOpenChange={(open) => !open && handleCloseDialog()} />
      <ProfileDialog open={openDialog === 'profile'} onOpenChange={(open) => !open && handleCloseDialog()} />
    </div>
  )
}
