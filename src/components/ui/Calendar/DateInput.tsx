'use client'

import { useRef, useState, useEffect } from 'react'
import { parse, format, isValid } from 'date-fns'
import { CalendarDays } from 'lucide-react'
import { Calendar } from './index'
import styles from './DateInput.module.css'

interface DateInputProps {
  value?: string          // 'YYYY-MM-DD'
  onChange?: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

function parseDate(str: string): Date | undefined {
  if (!str) return undefined
  const d = parse(str, 'yyyy-MM-dd', new Date())
  return isValid(d) ? d : undefined
}

function formatDisplay(str: string): string {
  const d = parseDate(str)
  return d ? format(d, 'yyyy.MM.dd') : ''
}

export function DateInput({
  value = '',
  onChange,
  placeholder = '날짜 선택',
  className,
  disabled,
}: DateInputProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  // 외부 클릭 시 닫기
  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const display = formatDisplay(value)
  const selected = parseDate(value)

  function handleSelect(date: Date | undefined) {
    onChange?.(date ? format(date, 'yyyy-MM-dd') : '')
    setOpen(false)
  }

  return (
    <div ref={wrapRef} className={`${styles.wrap} ${className ?? ''}`}>
      <button
        type="button"
        className={`${styles.trigger} ${!display ? styles.trigger_placeholder : ''} ${open ? styles.trigger_open : ''}`}
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
      >
        <CalendarDays size={13} className={styles.icon} />
        <span>{display || placeholder}</span>
      </button>

      {open && (
        <div className={styles.popover}>
          <Calendar
            value={selected}
            onChange={handleSelect}
          />
        </div>
      )}
    </div>
  )
}
