'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import styles from './CustomSelect.module.css'

interface Option {
  value: string
  label: string
}

interface Props {
  value: string
  options: (string | Option)[]
  onChange: (value: string) => void
  ariaLabel?: string
  placeholder?: string
  fullWidth?: boolean
  minWidth?: number
  size?: 'sm' | 'md'
}

function normalize(opts: (string | Option)[]): Option[] {
  return opts.map((o) => typeof o === 'string' ? { value: o, label: o } : o)
}

export default function CustomSelect({ value, options, onChange, ariaLabel, placeholder, fullWidth, minWidth, size = 'md' }: Props) {
  const [open, setOpen] = useState(false)
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({})
  const [mounted, setMounted] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLUListElement>(null)
  const opts = normalize(options)
  const selectedLabel = opts.find((o) => o.value === value)?.label ?? value ?? placeholder ?? '선택'

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node
      if (wrapRef.current?.contains(t)) return
      if (panelRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // 패널 위치 계산 (fixed positioning, 부모 overflow에 잘리지 않도록)
  const updatePanelPos = () => {
    const el = wrapRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const panelMaxH = 280
    const showAbove = spaceBelow < panelMaxH && rect.top > spaceBelow
    setPanelStyle({
      position: 'fixed',
      left: rect.left,
      width: rect.width,
      ...(showAbove ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
      zIndex: 9999,
    })
  }

  useEffect(() => {
    if (!open) return
    updatePanelPos()
    window.addEventListener('resize', updatePanelPos)
    window.addEventListener('scroll', updatePanelPos, true)
    return () => {
      window.removeEventListener('resize', updatePanelPos)
      window.removeEventListener('scroll', updatePanelPos, true)
    }
  }, [open])

  const wrapStyle: React.CSSProperties = {}
  if (fullWidth) wrapStyle.width = '100%'
  if (minWidth) wrapStyle.minWidth = `${minWidth}px`

  return (
    <div ref={wrapRef} className={styles.wrap} style={wrapStyle}>
      <button
        type="button"
        className={`${styles.btn} ${size === 'sm' ? styles.btn_sm : ''} ${open ? styles.btn_open : ''}`}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.value}>{selectedLabel}</span>
        <span className={`${styles.chevron} ${open ? styles.chevron_open : ''}`} aria-hidden>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      {open && mounted && createPortal(
        <ul ref={panelRef} className={styles.panel} role="listbox" style={panelStyle}>
          {opts.map((opt) => {
            const isSelected = opt.value === value
            return (
              <li key={opt.value} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  className={`${styles.option} ${isSelected ? styles.option_active : ''}`}
                  onClick={() => { onChange(opt.value); setOpen(false) }}
                >
                  <span>{opt.label}</span>
                  {isSelected && (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                      <path d="M3 7.5L5.5 10L11 4.5" stroke="#3182F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              </li>
            )
          })}
        </ul>,
        document.body
      )}
    </div>
  )
}
