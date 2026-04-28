'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { CalendarDays, Search, Download, Plus, ChevronLeft, ChevronRight, Pencil, Trash2, Image as ImageIcon } from 'lucide-react'
import { DateRangeCalendar, type DateRange } from '@/components/DateRangeCalendar'
import CreativeRegisterModal, { type CreativeEditTarget } from './CreativeRegisterModal'
import styles from './CreativeTab.module.css'

const DIVISION_KEY: Record<string, string> = {
  '학점은행제': 'nms',
  '민간자격증': 'cert',
  '유학': 'abroad',
}

// ─── 타입 ─────────────────────────────────────────────────────────────────────

type ChannelKey = 'all' | 'meta' | 'danggn' | 'naver' | 'instagram' | 'youtube' | 'kakao' | 'etc'
type CreativeStatus = '활성' | '비활성' | '테스트'
type CreativeType = '혜택형' | '신뢰형' | '자극형' | '정보전달형' | '정의형'

interface Creative {
  id: string
  thumbnail?: string  // URL or data URL
  name: string
  campaign: string
  type: CreativeType
  channel: Exclude<ChannelKey, 'all'>
  impressions: number
  clicks: number
  dbCount: number
  registrations: number
  adCost: number
  status: CreativeStatus
  registeredAt: string  // YYYY-MM-DD
}

// ─── 상수 ─────────────────────────────────────────────────────────────────────

const CHANNELS: { key: ChannelKey; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'meta', label: '메타 (Facebook/Instagram)' },
  { key: 'danggn', label: '당근' },
  { key: 'naver', label: '네이버' },
  { key: 'instagram', label: '인스타그램' },
  { key: 'youtube', label: '유튜브' },
  { key: 'kakao', label: '카카오' },
  { key: 'etc', label: '기타' },
]

const STATUS_OPTIONS = ['전체 상태', '활성', '비활성', '테스트']
const TYPE_OPTIONS = ['전체 소재 유형', '혜택형', '신뢰형', '자극형', '정보전달형', '정의형']
const CAMPAIGN_OPTIONS = ['전체 캠페인']

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

// ─── 유틸 ─────────────────────────────────────────────────────────────────────

function fmt(n: number): string { return n.toLocaleString('ko-KR') }
function rate(num: number, den: number, digits = 1): string {
  if (den === 0) return '-'
  return `${((num / den) * 100).toFixed(digits)}%`
}
function costPer(adCost: number, denom: number): string {
  if (adCost === 0 || denom === 0) return '-'
  return `${fmt(Math.round(adCost / denom))}원`
}
function dateToYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ─── 커스텀 Select ────────────────────────────────────────────────────────────

interface CustomSelectProps {
  value: string
  options: string[]
  onChange: (value: string) => void
  minWidth?: number
}

function CustomSelect({ value, options, onChange, minWidth }: CustomSelectProps) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

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

  return (
    <div ref={wrapRef} className={styles.select_wrap} style={minWidth ? { minWidth: `${minWidth}px` } : undefined}>
      <button
        type="button"
        className={`${styles.select_btn} ${open ? styles.select_btn_open : ''}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.select_value}>{value}</span>
        <span className={`${styles.select_chevron} ${open ? styles.select_chevron_open : ''}`} aria-hidden>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      {open && (
        <ul className={styles.select_panel}>
          {options.map((opt) => (
            <li key={opt}>
              <button
                type="button"
                className={`${styles.select_option} ${opt === value ? styles.select_option_active : ''}`}
                onClick={() => { onChange(opt); setOpen(false) }}
              >
                <span>{opt}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

interface CreativeTabProps {
  division: string  // '학점은행제' | '민간자격증' | '유학' (헤더 표시용)
}

export default function CreativeTab({ division }: CreativeTabProps) {
  const [activeChannel, setActiveChannel] = useState<ChannelKey>('all')
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const [showCalendar, setShowCalendar] = useState(false)
  const [campaignFilter, setCampaignFilter] = useState('전체 캠페인')
  const [statusFilter, setStatusFilter] = useState('전체 상태')
  const [typeFilter, setTypeFilter] = useState('전체 소재 유형')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  // 데이터 fetch
  const [creatives, setCreatives] = useState<Creative[]>([])
  const [loading, setLoading] = useState(false)
  const [registerOpen, setRegisterOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<CreativeEditTarget | null>(null)

  const fetchCreatives = useCallback(async () => {
    setLoading(true)
    try {
      const divKey = DIVISION_KEY[division] ?? 'nms'
      const res = await fetch(`/api/marketing/creatives?division=${divKey}`)
      if (!res.ok) throw new Error('데이터 조회 실패')
      const data = await res.json()
      type ApiCreative = {
        id: string; channel: string; name: string; campaign: string | null
        type: string; thumbnailUrl: string | null
        impressions: number; clicks: number; dbCount: number; registrations: number; adCost: number
        status: string; registeredAt: string
      }
      const mapped: Creative[] = (data as ApiCreative[]).map((r) => ({
        id: r.id,
        thumbnail: r.thumbnailUrl ?? undefined,
        name: r.name,
        campaign: r.campaign ?? '',
        type: r.type as CreativeType,
        channel: r.channel as Exclude<ChannelKey, 'all'>,
        impressions: r.impressions,
        clicks: r.clicks,
        dbCount: r.dbCount,
        registrations: r.registrations,
        adCost: r.adCost,
        status: r.status as CreativeStatus,
        registeredAt: r.registeredAt,
      }))
      setCreatives(mapped)
    } catch (err) {
      console.error('[CreativeTab] fetch:', err)
    } finally {
      setLoading(false)
    }
  }, [division])

  useEffect(() => {
    fetchCreatives()
  }, [fetchCreatives])

  const handleEdit = (c: Creative) => {
    setEditTarget({
      id: c.id,
      channel: c.channel,
      name: c.name,
      campaign: c.campaign,
      type: c.type,
      status: c.status,
      registeredAt: c.registeredAt,
      impressions: c.impressions,
      clicks: c.clicks,
      dbCount: c.dbCount,
      registrations: c.registrations,
      adCost: c.adCost,
      thumbnailUrl: c.thumbnail ?? null,
    })
    setRegisterOpen(true)
  }

  const handleDelete = async (c: Creative) => {
    if (!confirm(`"${c.name}" 소재를 삭제할까요?`)) return
    try {
      const res = await fetch(`/api/marketing/creatives/${c.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        alert(body.error ?? '삭제 실패')
        return
      }
      fetchCreatives()
    } catch (err) {
      console.error('[CreativeTab] delete:', err)
      alert('삭제 중 오류가 발생했습니다.')
    }
  }

  const calendarWrapRef = useRef<HTMLDivElement>(null)

  // 캘린더 외부 클릭 시 닫기
  useEffect(() => {
    if (!showCalendar) return
    const onClick = (e: MouseEvent) => {
      if (calendarWrapRef.current && !calendarWrapRef.current.contains(e.target as Node)) setShowCalendar(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [showCalendar])

  // 필터 적용
  const filtered = useMemo(() => {
    return creatives.filter((c) => {
      if (activeChannel !== 'all' && c.channel !== activeChannel) return false
      if (statusFilter !== '전체 상태' && c.status !== statusFilter) return false
      if (typeFilter !== '전체 소재 유형' && c.type !== typeFilter) return false
      if (campaignFilter !== '전체 캠페인' && c.campaign !== campaignFilter) return false
      if (searchQuery && !c.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
      if (dateRange?.from && dateRange?.to) {
        const reg = c.registeredAt
        if (reg < dateToYmd(dateRange.from) || reg > dateToYmd(dateRange.to)) return false
      }
      return true
    })
  }, [creatives, activeChannel, statusFilter, typeFilter, campaignFilter, searchQuery, dateRange])

  // 페이지네이션
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)

  // 날짜 라벨
  const dateLabel = dateRange?.from && dateRange?.to
    ? `${dateToYmd(dateRange.from)} ~ ${dateToYmd(dateRange.to)}`
    : '기간 선택'

  // 엑셀 다운로드
  const handleExcelDownload = () => {
    const headers = ['소재명', '캠페인', '소재 유형', '노출수', '클릭수', 'CTR(%)', 'DB수', '등록수', '등록률(%)', '광고비(원)', '등록당 비용(원)', '상태', '등록일']
    const rows = filtered.map((c) => [
      c.name, c.campaign, c.type, c.impressions, c.clicks,
      c.impressions > 0 ? Number(((c.clicks / c.impressions) * 100).toFixed(1)) : '',
      c.dbCount, c.registrations,
      c.dbCount > 0 ? Number(((c.registrations / c.dbCount) * 100).toFixed(1)) : '',
      c.adCost,
      c.adCost > 0 && c.registrations > 0 ? Math.round(c.adCost / c.registrations) : '',
      c.status, c.registeredAt,
    ])
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '소재목록')
    XLSX.writeFile(wb, `${division}_소재관리_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const channelLabel = CHANNELS.find((ch) => ch.key === activeChannel)?.label ?? '전체'

  return (
    <div className={styles.wrap}>
      {/* 페이지 헤더 (타이틀 + 액션) */}
      <div className={styles.page_header}>
        <h1 className={styles.page_title}>
          <span className={styles.page_division}>{division}</span>
          <span className={styles.page_feature}>소재별 성과</span>
        </h1>
        <div className={styles.header_actions}>
          <button type="button" className={styles.btn_secondary} onClick={handleExcelDownload}>
            <Download size={14} /> 엑셀 다운로드
          </button>
          <button type="button" className={styles.btn_primary} onClick={() => setRegisterOpen(true)}>
            <Plus size={14} /> 소재 등록
          </button>
        </div>
      </div>

      <CreativeRegisterModal
        open={registerOpen}
        division={division}
        defaultChannel={activeChannel}
        editTarget={editTarget}
        onClose={() => { setRegisterOpen(false); setEditTarget(null) }}
        onSuccess={fetchCreatives}
      />

      {/* 채널 탭 */}
      <div className={styles.channel_tabs}>
        {CHANNELS.map((ch) => {
          const count = ch.key === 'all'
            ? creatives.length
            : creatives.filter((c) => c.channel === ch.key).length
          return (
            <button
              key={ch.key}
              type="button"
              className={`${styles.channel_tab} ${activeChannel === ch.key ? styles.channel_tab_active : ''}`}
              onClick={() => { setActiveChannel(ch.key); setPage(1) }}
            >
              <span>{ch.label}</span>
              {count > 0 && <span className={styles.channel_tab_badge}>{count}</span>}
            </button>
          )
        })}
      </div>

      {/* 필터 행 */}
      <div className={styles.filter_row}>
        <div ref={calendarWrapRef} className={styles.date_picker_wrap}>
          <button type="button" className={styles.date_btn} onClick={() => setShowCalendar((v) => !v)}>
            <CalendarDays size={14} />
            <span>{dateLabel}</span>
          </button>
          {showCalendar && (
            <div className={styles.date_popover}>
              <DateRangeCalendar
                value={dateRange}
                onChange={setDateRange}
                onConfirm={(r) => { setDateRange(r); setShowCalendar(false) }}
                onReset={() => setDateRange(undefined)}
              />
            </div>
          )}
        </div>

        <CustomSelect value={campaignFilter} options={CAMPAIGN_OPTIONS} onChange={setCampaignFilter} minWidth={140} />
        <CustomSelect value={statusFilter} options={STATUS_OPTIONS} onChange={setStatusFilter} minWidth={120} />
        <CustomSelect value={typeFilter} options={TYPE_OPTIONS} onChange={setTypeFilter} minWidth={140} />

        <div className={styles.search_wrap}>
          <Search size={14} className={styles.search_icon} />
          <input
            type="text"
            className={styles.search_input}
            placeholder="소재명 검색"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* 소재 순위 TOP 5 (등록수 기준 내림차순) */}
      {filtered.length > 0 && (
        <div className={styles.ranking_section}>
          <div className={styles.ranking_list}>
            {[...filtered]
              .sort((a, b) => {
                if (b.registrations !== a.registrations) return b.registrations - a.registrations
                return b.dbCount - a.dbCount
              })
              .slice(0, 5)
              .map((c, idx) => {
                const regRate = c.dbCount > 0 ? `${((c.registrations / c.dbCount) * 100).toFixed(1)}%` : '-'
                const cpa = c.adCost > 0 && c.registrations > 0 ? Math.round(c.adCost / c.registrations) : null
                return (
                  <button key={`rank-${c.id}`} type="button" className={styles.ranking_row} onClick={() => handleEdit(c)}>
                    <span className={`${styles.rank_badge} ${idx < 3 ? styles[`rank_${idx + 1}`] : styles.rank_default}`}>
                      {idx + 1}
                    </span>
                    <div className={styles.rank_thumb_wrap}>
                      {c.thumbnail
                        ? <img src={c.thumbnail} alt={c.name} className={styles.rank_thumb} />
                        : <div className={styles.rank_thumb_empty}><ImageIcon size={18} /></div>}
                    </div>
                    <div className={styles.rank_info}>
                      <p className={styles.rank_name}>{c.name}</p>
                      <p className={styles.rank_campaign}>
                        {c.campaign || '—'} · <span className={styles.rank_type}>{c.type}</span>
                      </p>
                    </div>
                    <div className={styles.rank_metrics}>
                      <div className={styles.rm_item}>
                        <span className={styles.rm_label}>DB</span>
                        <span className={styles.rm_value}>{fmt(c.dbCount)}</span>
                      </div>
                      <div className={styles.rm_item}>
                        <span className={styles.rm_label}>등록</span>
                        <span className={styles.rm_value_strong}>{fmt(c.registrations)}</span>
                      </div>
                      <div className={styles.rm_item}>
                        <span className={styles.rm_label}>등록률</span>
                        <span className={styles.rm_value}>{regRate}</span>
                      </div>
                      <div className={styles.rm_item}>
                        <span className={styles.rm_label}>CPA</span>
                        <span className={styles.rm_value}>{cpa !== null ? `${fmt(cpa)}원` : '-'}</span>
                      </div>
                    </div>
                  </button>
                )
              })}
          </div>
        </div>
      )}

      {/* 소재 목록 테이블 */}
      <div className={styles.list_section}>
        <div className={styles.list_header}>
          <h2 className={styles.list_title}>소재 목록 ({channelLabel})</h2>
          <span className={styles.list_count}>{loading ? '불러오는 중...' : `전체 ${fmt(filtered.length)}건`}</span>
        </div>

        <div className={styles.table_wrap}>
          <div className={styles.table_overflow}>
            <table className={styles.table}>
              <thead>
                <tr className={styles.thead_row}>
                  <th className={styles.th_thumb}>소재 미리보기</th>
                  <th className={styles.th}>소재명</th>
                  <th className={styles.th}>캠페인</th>
                  <th className={styles.th}>소재 유형</th>
                  <th className={styles.th_num}>노출수</th>
                  <th className={styles.th_num}>클릭수</th>
                  <th className={styles.th_num}>CTR</th>
                  <th className={styles.th_num}>DB수</th>
                  <th className={styles.th_num}>등록수</th>
                  <th className={styles.th_num}>등록률</th>
                  <th className={styles.th_num}>광고비</th>
                  <th className={styles.th_num}>등록당 비용</th>
                  <th className={styles.th}>상태</th>
                  <th className={styles.th}>등록일</th>
                  <th className={styles.th}>관리</th>
                </tr>
              </thead>
              <tbody>
                {paged.length === 0 && (
                  <tr>
                    <td colSpan={15} className={styles.empty_cell}>
                      <p className={styles.empty_emoji}>📭</p>
                      <p className={styles.empty_text}>등록된 소재가 없습니다.</p>
                      <p className={styles.empty_hint}>우측 상단 [소재 등록] 버튼으로 추가하세요.</p>
                    </td>
                  </tr>
                )}
                {paged.map((c) => (
                  <tr key={c.id} className={styles.tbody_row}>
                    <td className={styles.td_thumb}>
                      {c.thumbnail
                        ? <img src={c.thumbnail} alt={c.name} className={styles.thumb_img} />
                        : <div className={styles.thumb_empty}>—</div>}
                    </td>
                    <td className={styles.td}>{c.name}</td>
                    <td className={styles.td}>{c.campaign}</td>
                    <td className={styles.td}>
                      <span className={`${styles.type_badge} ${styles[`type_${c.type}`]}`}>{c.type}</span>
                    </td>
                    <td className={styles.td_num}>{fmt(c.impressions)}</td>
                    <td className={styles.td_num}>{fmt(c.clicks)}</td>
                    <td className={styles.td_num}>{rate(c.clicks, c.impressions)}</td>
                    <td className={styles.td_num}>{fmt(c.dbCount)}</td>
                    <td className={styles.td_num}>{fmt(c.registrations)}</td>
                    <td className={styles.td_num}>{rate(c.registrations, c.dbCount)}</td>
                    <td className={styles.td_num}>{c.adCost > 0 ? `${fmt(c.adCost)}원` : '-'}</td>
                    <td className={styles.td_num}>{costPer(c.adCost, c.registrations)}</td>
                    <td className={styles.td}>
                      <span className={`${styles.status_badge} ${styles[`status_${c.status}`]}`}>{c.status}</span>
                    </td>
                    <td className={styles.td}>{c.registeredAt}</td>
                    <td className={styles.td}>
                      <div className={styles.row_actions}>
                        <button type="button" className={styles.icon_btn} onClick={() => handleEdit(c)} aria-label="수정">
                          <Pencil size={14} />
                        </button>
                        <button type="button" className={`${styles.icon_btn} ${styles.icon_btn_danger}`} onClick={() => handleDelete(c)} aria-label="삭제">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 페이지네이션 */}
        {filtered.length > 0 && (
          <div className={styles.pagination_row}>
            <div className={styles.pagination_size}>
              <CustomSelect
                value={`${pageSize}개씩 보기`}
                options={PAGE_SIZE_OPTIONS.map((s) => `${s}개씩 보기`)}
                onChange={(v) => { setPageSize(Number(v.replace(/[^0-9]/g, ''))); setPage(1) }}
                minWidth={130}
              />
            </div>
            <div className={styles.pagination}>
              <button type="button" className={styles.page_btn} onClick={() => setPage(1)} disabled={page === 1}>
                <ChevronLeft size={14} /><ChevronLeft size={14} />
              </button>
              <button type="button" className={styles.page_btn} onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const num = i + 1
                return (
                  <button
                    key={num}
                    type="button"
                    className={`${styles.page_num} ${page === num ? styles.page_num_active : ''}`}
                    onClick={() => setPage(num)}
                  >
                    {num}
                  </button>
                )
              })}
              <button type="button" className={styles.page_btn} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                <ChevronRight size={14} />
              </button>
              <button type="button" className={styles.page_btn} onClick={() => setPage(totalPages)} disabled={page === totalPages}>
                <ChevronRight size={14} /><ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
