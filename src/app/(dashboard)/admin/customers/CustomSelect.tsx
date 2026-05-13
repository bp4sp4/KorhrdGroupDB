'use client'

import { useEffect, useRef, useState } from 'react'
import styles from './CustomSelect.module.css'

export interface SelectOption {
  value: string
  label: string
}

interface Props {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  minWidth?: number
}

export default function CustomSelect({ value, onChange, options, placeholder = '선택', minWidth = 120 }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selectedLabel = options.find((o) => o.value === value)?.label ?? placeholder

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleSelect = (val: string) => {
    onChange(val)
    setOpen(false)
  }

  return (
    <div className={styles.wrap} ref={ref} style={{ minWidth }}>
      <button
        type="button"
        className={`${styles.trigger} ${open ? styles.trigger_open : ''} ${value && value !== 'all' && value !== '' ? styles.trigger_active : ''}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.trigger_label}>{selectedLabel}</span>
        <svg className={`${styles.arrow} ${open ? styles.arrow_up : ''}`} width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div className={styles.dropdown}>
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`${styles.option} ${opt.value === value ? styles.option_selected : ''}`}
              onClick={() => handleSelect(opt.value)}
            >
              {opt.value === value && (
                <svg className={styles.check} width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
