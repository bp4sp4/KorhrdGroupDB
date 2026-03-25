'use client'

import { useRef } from 'react'
import styles from './MemoHoverBadge.module.css'

interface Props {
  text: string
}

export default function MemoHoverBadge({ text }: Props) {
  const ref = useRef<HTMLSpanElement>(null)
  const tooltipRef = useRef<HTMLSpanElement>(null)

  if (!text || text === '-') return <>{text}</>

  const handleMouseEnter = (e: React.MouseEvent) => {
    const el = ref.current
    if (!el || el.scrollWidth <= el.clientWidth) return
    const tip = tooltipRef.current
    if (!tip) return
    tip.style.left = `${e.clientX}px`
    tip.style.top = `${e.clientY - 12}px`
    tip.style.display = 'block'
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    const tip = tooltipRef.current
    if (!tip || tip.style.display === 'none') return
    tip.style.left = `${e.clientX}px`
    tip.style.top = `${e.clientY - 12}px`
  }

  const handleMouseLeave = () => {
    const tip = tooltipRef.current
    if (tip) tip.style.display = 'none'
  }

  return (
    <span
      ref={ref}
      className={styles.wrap}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {text}
      <span ref={tooltipRef} className={styles.tooltip} style={{ display: 'none' }}>
        <span className={styles.tooltipContent}>{text}</span>
      </span>
    </span>
  )
}
