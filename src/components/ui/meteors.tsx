"use client"

import React, { useEffect, useState } from "react"

import { cn } from "@/lib/utils"

interface MeteorsProps {
  number?: number
  minDelay?: number
  maxDelay?: number
  minDuration?: number
  maxDuration?: number
  angle?: number
  /** 流星頭部大小 px（預設 2） */
  headSize?: number
  /** 流星尾巴長度 px（預設 50） */
  tailLength?: number
  /** 流星頭部顏色（預設 #8CE4FF） */
  color?: string
  /** 流星尾巴顏色（預設 white） */
  tailColor?: string
  className?: string
}

export const Meteors = ({
  number = 20,
  minDelay = 0.2,
  maxDelay = 1.2,
  minDuration = 2,
  maxDuration = 10,
  angle = 215,
  headSize = 4.4,
  tailLength = 92,
  color = "#8CE4FF",
  tailColor = "white",
  className,
}: MeteorsProps) => {
  const [meteorStyles, setMeteorStyles] = useState<Array<React.CSSProperties>>(
    []
  )

  useEffect(() => {
    const styles = [...new Array(number)].map(() => ({
      "--angle": -angle + "deg",
      top: "-5%",
      left: `calc(0% + ${Math.floor(Math.random() * window.innerWidth)}px)`,
      animationDelay: Math.random() * (maxDelay - minDelay) + minDelay + "s",
      animationDuration:
        Math.floor(Math.random() * (maxDuration - minDuration) + minDuration) +
        "s",
    }))
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMeteorStyles(styles)
  }, [number, minDelay, maxDelay, minDuration, maxDuration, angle])

  return (
    <>
      {[...meteorStyles].map((style, idx) => (
        // Meteor Head
        <span
          key={idx}
          style={{
            ...style,
            width: `${headSize}px`,
            height: `${headSize}px`,
            backgroundColor: color,
          }}
          className={cn(
            "animate-meteor pointer-events-none absolute rotate-[var(--angle)] rounded-full shadow-[0_0_0_1px_#ffffff10]",
            className
          )}
        >
          {/* Meteor Tail */}
          <div
            className="pointer-events-none absolute top-1/2 -z-10 h-px -translate-y-1/2"
            style={{
              width: `${tailLength}px`,
              background: `linear-gradient(to right, ${tailColor}, transparent)`,
            }}
          />
        </span>
      ))}
    </>
  )
}
