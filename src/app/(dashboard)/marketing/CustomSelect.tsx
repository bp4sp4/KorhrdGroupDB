'use client'

import { useState, useEffect, useRef } from 'react'
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
}

function normalize(opts: (string | Option)[]): Option[] {
  return opts.map((o) => typeof o === 'string' ? { value: o, label: o } : o)
}

export default function CustomSelect({ value, options, onChange, ariaLabel, placeholder, fullWidth, minWidth }: Props) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const opts = normalize(options)
  const selectedLabel = opts.find((o) => o.value === value)?.label ?? value ?? placeholder ?? '선택'

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const wrapStyle: React.CSSProperties = {}
  if (fullWidth) wrapStyle.width = '100%'
  if (minWidth) wrapStyle.minWidth = `${minWidth}px`

  return (
    <div ref={wrapRef} className={styles.wrap} style={wrapStyle}>
      <button
        type="button"
        className={`${styles.btn} ${open ? styles.btn_open : ''}`}
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
      {open && (
        <ul className={styles.panel} role="listbox">
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
        </ul>
      )}
    </div>
  )
}
