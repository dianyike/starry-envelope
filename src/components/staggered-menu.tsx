'use client'

import { useCallback, useLayoutEffect, useRef, useState, useEffect } from 'react'
import Image from 'next/image'
import { gsap } from 'gsap'
import { Badge } from '@/components/ui/badge'
import { SparklesText } from '@/components/ui/sparkles-text'
import { getUnreadRepliesCount } from '@/lib/actions/bottle'
import './staggered-menu.css'

// 自訂事件名稱
const REFRESH_UNREAD_EVENT = 'refresh-unread-count'

// 觸發 Navbar 更新的函數（供其他元件使用）
export function triggerNavbarRefresh() {
  window.dispatchEvent(new Event(REFRESH_UNREAD_EVENT))
}

export type DialogType = 'throw' | 'fish' | 'my-bottles' | 'beach' | 'profile'

interface MenuItem {
  key: DialogType
  label: string
  showBadge?: boolean
}

interface StaggeredMenuProps {
  onOpenDialog?: (dialog: DialogType) => void
}

const NAV_ITEMS: MenuItem[] = [
  { key: 'throw', label: '扔瓶子' },
  { key: 'fish', label: '撈瓶子' },
  { key: 'my-bottles', label: '我的瓶子', showBadge: true },
  { key: 'beach', label: '海灘' },
  { key: 'profile', label: '個人資料' },
]

export function StaggeredMenu({ onOpenDialog }: StaggeredMenuProps) {
  const [open, setOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const openRef = useRef(false)
  const panelRef = useRef<HTMLElement>(null)
  const preLayersRef = useRef<HTMLDivElement>(null)
  const preLayerElsRef = useRef<HTMLDivElement[]>([])
  const plusHRef = useRef<HTMLSpanElement>(null)
  const plusVRef = useRef<HTMLSpanElement>(null)
  const iconRef = useRef<HTMLSpanElement>(null)
  const textInnerRef = useRef<HTMLSpanElement>(null)
  const textWrapRef = useRef<HTMLSpanElement>(null)
  const [textLines, setTextLines] = useState(['選單', '關閉'])

  const openTlRef = useRef<gsap.core.Timeline | null>(null)
  const closeTweenRef = useRef<gsap.core.Tween | null>(null)
  const spinTweenRef = useRef<gsap.core.Tween | null>(null)
  const textCycleAnimRef = useRef<gsap.core.Tween | null>(null)
  const colorTweenRef = useRef<gsap.core.Tween | null>(null)
  const toggleBtnRef = useRef<HTMLButtonElement>(null)
  const busyRef = useRef(false)
  const itemEntranceTweenRef = useRef<gsap.core.Tween | null>(null)

  const position = 'right'
  const offscreenX = 100 // positive for right, negative for left
  const colors = ['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.6)']
  const menuButtonColor = '#ffffff'
  const openMenuButtonColor = '#1c1917'
  const accentColor = '#7c3aed'

  // 載入未讀數量
  const loadUnreadCount = useCallback(async () => {
    const count = await getUnreadRepliesCount()
    setUnreadCount(count)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadUnreadCount()
    window.addEventListener(REFRESH_UNREAD_EVENT, loadUnreadCount)
    const interval = setInterval(loadUnreadCount, 30000)
    return () => {
      clearInterval(interval)
      window.removeEventListener(REFRESH_UNREAD_EVENT, loadUnreadCount)
    }
  }, [loadUnreadCount])

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const panel = panelRef.current
      const preContainer = preLayersRef.current
      const plusH = plusHRef.current
      const plusV = plusVRef.current
      const icon = iconRef.current
      const textInner = textInnerRef.current
      if (!panel || !plusH || !plusV || !icon || !textInner) return

      let preLayers: HTMLDivElement[] = []
      if (preContainer) {
        preLayers = Array.from(preContainer.querySelectorAll('.sm-prelayer')) as HTMLDivElement[]
      }
      preLayerElsRef.current = preLayers

      gsap.set([panel, ...preLayers], { xPercent: offscreenX })
      gsap.set(plusH, { transformOrigin: '50% 50%', rotate: 0 })
      gsap.set(plusV, { transformOrigin: '50% 50%', rotate: 90 })
      gsap.set(icon, { rotate: 0, transformOrigin: '50% 50%' })
      gsap.set(textInner, { yPercent: 0 })
      if (toggleBtnRef.current) gsap.set(toggleBtnRef.current, { color: menuButtonColor })
    })
    return () => ctx.revert()
  }, [menuButtonColor, offscreenX])

  const buildOpenTimeline = useCallback(() => {
    const panel = panelRef.current
    const layers = preLayerElsRef.current
    if (!panel) return null

    openTlRef.current?.kill()
    if (closeTweenRef.current) {
      closeTweenRef.current.kill()
      closeTweenRef.current = null
    }
    itemEntranceTweenRef.current?.kill()

    const itemEls = Array.from(panel.querySelectorAll('.sm-panel-itemLabel'))
    const numberEls = Array.from(panel.querySelectorAll('.sm-panel-list[data-numbering] .sm-panel-item'))

    const layerStates = layers.map(el => ({ el, start: Number(gsap.getProperty(el, 'xPercent')) }))
    const panelStart = Number(gsap.getProperty(panel, 'xPercent'))

    if (itemEls.length) {
      gsap.set(itemEls, { yPercent: 140, rotate: 10 })
    }
    if (numberEls.length) {
      gsap.set(numberEls, { '--sm-num-opacity': 0 })
    }

    const tl = gsap.timeline({ paused: true })

    layerStates.forEach((ls, i) => {
      tl.fromTo(ls.el, { xPercent: ls.start }, { xPercent: 0, duration: 0.5, ease: 'power4.out' }, i * 0.07)
    })
    const lastTime = layerStates.length ? (layerStates.length - 1) * 0.07 : 0
    const panelInsertTime = lastTime + (layerStates.length ? 0.08 : 0)
    const panelDuration = 0.65
    tl.fromTo(
      panel,
      { xPercent: panelStart },
      { xPercent: 0, duration: panelDuration, ease: 'power4.out' },
      panelInsertTime
    )

    if (itemEls.length) {
      const itemsStartRatio = 0.15
      const itemsStart = panelInsertTime + panelDuration * itemsStartRatio
      tl.to(
        itemEls,
        {
          yPercent: 0,
          rotate: 0,
          duration: 1,
          ease: 'power4.out',
          stagger: { each: 0.1, from: 'start' }
        },
        itemsStart
      )
      if (numberEls.length) {
        tl.to(
          numberEls,
          {
            duration: 0.6,
            ease: 'power2.out',
            '--sm-num-opacity': 1,
            stagger: { each: 0.08, from: 'start' }
          },
          itemsStart + 0.1
        )
      }
    }

    openTlRef.current = tl
    return tl
  }, [])

  const playOpen = useCallback(() => {
    if (busyRef.current) return
    busyRef.current = true
    const tl = buildOpenTimeline()
    if (tl) {
      tl.eventCallback('onComplete', () => {
        busyRef.current = false
      })
      tl.play(0)
    } else {
      busyRef.current = false
    }
  }, [buildOpenTimeline])

  const playClose = useCallback(() => {
    openTlRef.current?.kill()
    openTlRef.current = null
    itemEntranceTweenRef.current?.kill()

    const panel = panelRef.current
    const layers = preLayerElsRef.current
    if (!panel) return

    const all = [...layers, panel]
    closeTweenRef.current?.kill()
    closeTweenRef.current = gsap.to(all, {
      xPercent: offscreenX,
      duration: 0.32,
      ease: 'power3.in',
      overwrite: 'auto',
      onComplete: () => {
        const itemEls = Array.from(panel.querySelectorAll('.sm-panel-itemLabel'))
        if (itemEls.length) {
          gsap.set(itemEls, { yPercent: 140, rotate: 10 })
        }
        const numberEls = Array.from(panel.querySelectorAll('.sm-panel-list[data-numbering] .sm-panel-item'))
        if (numberEls.length) {
          gsap.set(numberEls, { '--sm-num-opacity': 0 })
        }
        busyRef.current = false
      }
    })
  }, [offscreenX])

  const animateIcon = useCallback((opening: boolean) => {
    const icon = iconRef.current
    if (!icon) return
    spinTweenRef.current?.kill()
    if (opening) {
      spinTweenRef.current = gsap.to(icon, { rotate: 225, duration: 0.8, ease: 'power4.out', overwrite: 'auto' })
    } else {
      spinTweenRef.current = gsap.to(icon, { rotate: 0, duration: 0.35, ease: 'power3.inOut', overwrite: 'auto' })
    }
  }, [])

  const animateColor = useCallback(
    (opening: boolean) => {
      const btn = toggleBtnRef.current
      if (!btn) return
      colorTweenRef.current?.kill()
      const targetColor = opening ? openMenuButtonColor : menuButtonColor
      colorTweenRef.current = gsap.to(btn, {
        color: targetColor,
        delay: 0.18,
        duration: 0.3,
        ease: 'power2.out'
      })
    },
    [openMenuButtonColor, menuButtonColor]
  )

  const animateText = useCallback((opening: boolean) => {
    const inner = textInnerRef.current
    if (!inner) return
    textCycleAnimRef.current?.kill()

    const currentLabel = opening ? '選單' : '關閉'
    const targetLabel = opening ? '關閉' : '選單'
    const cycles = 3
    const seq = [currentLabel]
    let last = currentLabel
    for (let i = 0; i < cycles; i++) {
      last = last === '選單' ? '關閉' : '選單'
      seq.push(last)
    }
    if (last !== targetLabel) seq.push(targetLabel)
    seq.push(targetLabel)
    setTextLines(seq)

    gsap.set(inner, { yPercent: 0 })
    const lineCount = seq.length
    const finalShift = ((lineCount - 1) / lineCount) * 100
    textCycleAnimRef.current = gsap.to(inner, {
      yPercent: -finalShift,
      duration: 0.5 + lineCount * 0.07,
      ease: 'power4.out'
    })
  }, [])

  const toggleMenu = useCallback(() => {
    const target = !openRef.current
    openRef.current = target
    setOpen(target)
    if (target) {
      playOpen()
    } else {
      playClose()
    }
    animateIcon(target)
    animateColor(target)
    animateText(target)
  }, [playOpen, playClose, animateIcon, animateColor, animateText])

  const closeMenu = useCallback(() => {
    if (openRef.current) {
      openRef.current = false
      setOpen(false)
      playClose()
      animateIcon(false)
      animateColor(false)
      animateText(false)
    }
  }, [playClose, animateIcon, animateColor, animateText])

  useEffect(() => {
    if (!open) return

    const handleClickOutside = (event: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        toggleBtnRef.current &&
        !toggleBtnRef.current.contains(event.target as Node)
      ) {
        closeMenu()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open, closeMenu])

  const handleItemClick = (key: DialogType) => {
    closeMenu()
    onOpenDialog?.(key)
  }

  return (
    <div
      className="staggered-menu-wrapper fixed-wrapper"
      style={{ '--sm-accent': accentColor } as React.CSSProperties}
      data-position={position}
      data-open={open || undefined}
    >
      <div ref={preLayersRef} className="sm-prelayers" aria-hidden="true">
        {colors.map((c, i) => (
          <div key={i} className="sm-prelayer" style={{ background: c }} />
        ))}
      </div>

      <header className="staggered-menu-header" aria-label="Main navigation header">
        <div className="sm-logo" aria-label="Logo">
          <Image
            src="/logo.png"
            alt="星夜信封"
            draggable={false}
            width={36}
            height={36}
          />
          <SparklesText
            className={`ml-2 text-3xl font-bold drop-shadow-md ${open ? 'text-black sm:text-gray-200' : 'text-gray-200'}`}
            colors={{ first: '#F4F4F4', second: '#f472b6' }}
            sparklesCount={6}
          >
            星夜信封
          </SparklesText>
        </div>

        <button
          ref={toggleBtnRef}
          className="sm-toggle"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="staggered-menu-panel"
          onClick={toggleMenu}
          type="button"
        >
          <span ref={textWrapRef} className="sm-toggle-textWrap" aria-hidden="true">
            <span ref={textInnerRef} className="sm-toggle-textInner">
              {textLines.map((l, i) => (
                <span className="sm-toggle-line" key={i}>
                  {l}
                </span>
              ))}
            </span>
          </span>
          <span ref={iconRef} className="sm-icon" aria-hidden="true">
            <span ref={plusHRef} className="sm-icon-line" />
            <span ref={plusVRef} className="sm-icon-line sm-icon-line-v" />
          </span>
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500" />
          )}
        </button>
      </header>

      <aside id="staggered-menu-panel" ref={panelRef} className="staggered-menu-panel" aria-hidden={!open}>
        <div className="sm-panel-inner">
          <ul className="sm-panel-list" role="list" data-numbering>
            {NAV_ITEMS.map((item, idx) => (
              <li className="sm-panel-itemWrap" key={item.key}>
                <button
                  className="sm-panel-item"
                  aria-label={item.label}
                  data-index={idx + 1}
                  onClick={() => handleItemClick(item.key)}
                  type="button"
                >
                  <span className="sm-panel-itemLabel">
                    {item.label}
                    {item.showBadge && unreadCount > 0 && (
                      <Badge variant="destructive" className="ml-3 text-base">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </Badge>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  )
}

export default StaggeredMenu
