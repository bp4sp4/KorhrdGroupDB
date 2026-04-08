'use client'

import React, { useRef, useState, useEffect } from 'react'
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
  align?: 'left' | 'right'      // 팝오버 좌우 정렬 (기본 left)
  direction?: 'down' | 'up'    // 팝오버 열리는 방향 (기본 down)
  variant?: 'input' | 'button' // 트리거 스타일 (기본 input)
  label?: string               // variant="button" 일 때 버튼 텍스트 (기본 "연락예정")
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

const CALENDAR_HEIGHT = 310 // 달력 팝오버 예상 높이 (px)

export function DateInput({
  value = '',
  onChange,
  placeholder = '날짜 선택',
  className,
  disabled,
  align = 'left',
  direction,          // 미지정 시 자동 감지
  variant = 'input',
  label = '연락예정',
}: DateInputProps) {
  const [open, setOpen] = useState(false)
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({})
  const wrapRef = useRef<HTMLDivElement>(null)

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

  function handleToggle() {
    if (disabled) return
    if (!open && wrapRef.current) {
      const rect = wrapRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      const resolvedDirection = direction ?? (spaceBelow < CALENDAR_HEIGHT && spaceAbove > CALENDAR_HEIGHT ? 'up' : 'down')

      const style: React.CSSProperties = { position: 'fixed', zIndex: 9999 }
      if (resolvedDirection === 'up') {
        style.bottom = window.innerHeight - rect.top + 6
      } else {
        style.top = rect.bottom + 6
      }
      if (align === 'right') {
        style.right = window.innerWidth - rect.right
      } else {
        style.left = rect.left
      }
      setPopoverStyle(style)
    }
    setOpen(v => !v)
  }

  const display = formatDisplay(value)
  const selected = parseDate(value)

  function handleSelect(date: Date | undefined) {
    onChange?.(date ? format(date, 'yyyy-MM-dd') : '')
    setOpen(false)
  }

  return (
    <div ref={wrapRef} className={`${styles.wrap} ${className ?? ''}`}>
      {variant === 'button' ? (
        display ? (
          // 날짜 있을 때: [날짜 텍스트 | ×] 한 덩어리
          <div className={styles.scheduleBtnWithX}>
            <button
              type="button"
              className={styles.scheduleBtnDate}
              onClick={handleToggle}
              disabled={disabled}
            >
              {display}
            </button>
            <button
              type="button"
              className={styles.scheduleBtnX}
              onClick={(e) => { e.stopPropagation(); onChange?.('') }}
              disabled={disabled}
              aria-label="해제"
            >×</button>
          </div>
        ) : (
          // 날짜 없을 때: "연락예정" 버튼
          <button
            type="button"
            className={styles.scheduleBtn}
            onClick={handleToggle}
            disabled={disabled}
          >
            {label}
          </button>
        )
      ) : (
        // 인풋 스타일 (기본)
        <button
          type="button"
          className={`${styles.trigger} ${!display ? styles.trigger_placeholder : ''} ${open ? styles.trigger_open : ''}`}
          onClick={handleToggle}
          disabled={disabled}
        >
          <CalendarDays size={13} className={styles.icon} />
          <span>{display || placeholder}</span>
        </button>
      )}

      {open && (
        <div className={styles.popoverFixed} style={popoverStyle}>
          <Calendar
            value={selected}
            onChange={handleSelect}
          />
        </div>
      )}
    </div>
  )
}
