'use client'

// 학점은행제(nms) 대시보드 전용 — 상담 데이터(/api/hakjeom/stats) 기반
// 유입 경로 / 시간 패턴 / 맘카페 세부 통계 섹션.
// (기존 학점은행제 통계 탭의 동일 분석을 마케팅 대시보드로 통합)

import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  BarChart, Bar, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import { parseClickSource } from '@/app/(dashboard)/hakjeom/_cafe'
import styles from './HakjeomInflowSections.module.css'

interface StatRow {
  click_source: string | null
  created_at: string
  status: string
}

const BAR_COLORS = ['#3182F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#F43F5E', '#94A3B8']

function toKstDate(iso: string): Date {
  const d = new Date(iso)
  d.setHours(d.getHours() + 9)
  return d
}
function kstYmd(iso: string): string {
  const d = toKstDate(iso)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

export default function HakjeomInflowSections({
  start,
  end,
}: {
  start: string
  end: string
}) {
  const [rows, setRows] = useState<StatRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/hakjeom/stats?type=hakjeom')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => {
        if (!cancelled) setRows(Array.isArray(d) ? d : [])
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // 대시보드 선택 기간으로 필터 (KST 일자 기준)
  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (!r.created_at) return false
        const d = kstYmd(r.created_at)
        return d >= start && d <= end
      }),
    [rows, start, end],
  )

  // ── 유입 경로 분포 ──
  const srcData = useMemo(() => {
    const map: Record<string, number> = {}
    for (const r of filtered) {
      const major = parseClickSource(r.click_source).major || '바로폼'
      map[major] = (map[major] ?? 0) + 1
    }
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }))
  }, [filtered])
  const srcTotal = srcData.reduce((s, d) => s + d.value, 0)

  // ── 시간 패턴 (시간대별) ──
  const hourData = useMemo(
    () =>
      Array.from({ length: 24 }, (_, h) => ({
        hour: `${String(h).padStart(2, '0')}시`,
        count: filtered.filter((r) => toKstDate(r.created_at).getUTCHours() === h).length,
      })),
    [filtered],
  )
  const peakCount = hourData.length ? Math.max(...hourData.map((d) => d.count)) : 0
  const peaks = hourData.filter((d) => d.count === peakCount && peakCount > 0)

  // ── 맘카페 세부 ──
  const mamcafeData = useMemo(() => {
    const map: Record<string, number> = {}
    for (const r of filtered) {
      const { major, minor } = parseClickSource(r.click_source)
      if (major !== '맘카페') continue
      const key = minor || '미입력'
      map[key] = (map[key] ?? 0) + 1
    }
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }))
  }, [filtered])
  const mamcafeTotal = mamcafeData.reduce((s, d) => s + d.value, 0)

  if (loading) {
    return <div className={styles.loading}>유입 데이터 로딩 중...</div>
  }

  return (
    <div className={styles.wrap}>
      {/* 유입 경로 */}
      <section className={styles.card}>
        <div className={styles.cardHead}>
          <span className={styles.cardTitle}>유입 경로</span>
          <span className={styles.cardSub}>전체 {srcTotal.toLocaleString()}건</span>
        </div>
        {srcData.length === 0 ? (
          <div className={styles.empty}>데이터가 없습니다</div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(180, srcData.length * 34)}>
            <BarChart data={srcData} layout="vertical" margin={{ left: 8, right: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f3f6" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#8b95a1' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 12, fill: '#4e5968' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v) => [`${Number(v).toLocaleString()}건`, '유입']} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
                {srcData.map((_, i) => (
                  <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      {/* 시간 패턴 */}
      <section className={styles.card}>
        <div className={styles.cardHead}>
          <span className={styles.cardTitle}>시간 패턴</span>
          <span className={styles.cardSub}>
            {peaks.length > 0 ? `피크 ${peaks.map((p) => p.hour).join(', ')}` : '데이터 없음'}
          </span>
        </div>
        {srcTotal === 0 ? (
          <div className={styles.empty}>데이터가 없습니다</div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={hourData} margin={{ left: -16, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f3f6" vertical={false} />
              <XAxis dataKey="hour" interval={1} tick={{ fontSize: 10, fill: '#8b95a1' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#8b95a1' }} axisLine={false} tickLine={false} width={32} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v) => [`${Number(v).toLocaleString()}건`, '유입']} />
              <Bar dataKey="count" radius={[3, 3, 0, 0]} barSize={10}>
                {hourData.map((d, i) => (
                  <Cell key={i} fill={peaks.some((p) => p.hour === d.hour) ? '#3182F6' : '#dbeafe'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      {/* 맘카페 */}
      <section className={styles.card}>
        <div className={styles.cardHead}>
          <span className={styles.cardTitle}>맘카페</span>
          <span className={styles.cardSub}>전체 {mamcafeTotal.toLocaleString()}건</span>
        </div>
        {mamcafeData.length === 0 ? (
          <div className={styles.empty}>맘카페 유입 데이터가 없습니다</div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(180, mamcafeData.length * 32)}>
            <BarChart data={mamcafeData} layout="vertical" margin={{ left: 8, right: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f3f6" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#8b95a1' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={96} tick={{ fontSize: 12, fill: '#4e5968' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v) => [`${Number(v).toLocaleString()}건`, '유입']} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={14} fill="#8B5CF6" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>
    </div>
  )
}
