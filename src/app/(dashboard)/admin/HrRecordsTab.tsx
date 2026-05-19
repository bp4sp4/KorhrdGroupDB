'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { CheckCircle2, XCircle, Clock, Search, Loader2 } from 'lucide-react'
import styles from './HrRecordsTab.module.css'

type Status = 'draft' | 'submitted' | 'approved' | 'rejected'

interface HrRecord {
  id: string
  user_id: number
  status: Status
  profile_image_url: string | null
  name_ko: string | null
  name_en: string | null
  gender: 'male' | 'female' | null
  rrn: string | null
  birth_date: string | null
  company_name: string | null
  joined_at: string | null
  company_address: string | null
  current_address: string | null
  phone: string | null
  work_phone: string | null
  email: string | null
  emergency_phone: string | null
  emergency_relation: string | null
  bank_name: string | null
  account_number: string | null
  account_holder: string | null
  education: { school?: string; start?: string; end?: string; degree?: string; major?: string }[]
  career: {
    org?: string
    position?: string
    work?: string
    start?: string
    end?: string
    months?: number
    notes?: string
    attachment_url?: string | null
    attachment_name?: string | null
  }[]
  certificates: { name?: string; grade?: string; number?: string; issued_at?: string; issuer?: string }[]
  submitted_at: string | null
  reviewed_at: string | null
  reject_reason: string | null
  author_name: string | null
  author_email: string | null
}

// Storage publicUrl에서 storage path를 추출해 다운로드 프록시 URL을 만든다
function buildHrDownloadUrl(url: string, name?: string | null): string {
  const marker = '/hr-profile-images/'
  const idx = url?.indexOf(marker)
  if (idx == null || idx === -1) return url
  const path = url.slice(idx + marker.length)
  const params = new URLSearchParams({
    path,
    filename: name ?? '경력증명서',
  })
  return `/api/hr-records/download?${params.toString()}`
}

const STATUS_LABELS: Record<Status, string> = {
  draft: '작성 중',
  submitted: '승인 대기',
  approved: '승인 완료',
  rejected: '반려',
}

export default function HrRecordsTab() {
  const [status, setStatus] = useState<'all' | Status>('submitted')
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<HrRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 10

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (status !== 'all') params.set('status', status)
      if (search.trim()) params.set('q', search.trim())
      const res = await fetch(`/api/admin/hr-records?${params.toString()}`)
      if (!res.ok) {
        setItems([])
        return
      }
      const data = await res.json()
      setItems(data.items ?? [])
    } finally {
      setLoading(false)
    }
  }, [status, search])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  // status/search 변경 시 1페이지로 리셋
  useEffect(() => {
    setPage(1)
  }, [status, search])

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pagedItems = items.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const opened = items.find((i) => i.id === openId) ?? null

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <div className={styles.tabRow}>
          {(['submitted', 'approved', 'rejected', 'draft', 'all'] as const).map(
            (s) => (
              <button
                key={s}
                type="button"
                className={`${styles.tabBtn} ${status === s ? styles.tabBtnActive : ''}`}
                onClick={() => setStatus(s)}
              >
                {s === 'all' ? '전체' : STATUS_LABELS[s]}
              </button>
            ),
          )}
        </div>
        <div className={styles.searchWrap}>
          <Search size={14} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="이름 / 이메일 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className={styles.loadingWrap}>
          <Loader2 className={styles.spinner} size={20} /> 불러오는 중...
        </div>
      ) : items.length === 0 ? (
        <div className={styles.empty}>해당 조건의 인사기록카드가 없습니다.</div>
      ) : (
        <>
          <div className={styles.tableCard}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>이름</th>
                  <th>이메일</th>
                  <th>제출일</th>
                  <th>상태</th>
                  <th>-</th>
                </tr>
              </thead>
              <tbody>
                {pagedItems.map((r) => (
                  <tr key={r.id}>
                    <td className={styles.nameCell}>
                      {r.name_ko ?? r.author_name ?? '-'}
                    </td>
                    <td>{r.author_email ?? '-'}</td>
                    <td>
                      {r.submitted_at
                        ? new Date(r.submitted_at).toLocaleString('ko-KR', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })
                        : '-'}
                    </td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                    <td>
                      <button
                        type="button"
                        className={styles.detailBtn}
                        onClick={() => setOpenId(r.id)}
                      >
                        상세보기
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={safePage}
            totalPages={totalPages}
            total={items.length}
            onChange={setPage}
          />
        </>
      )}

      {opened && (
        <DetailModal
          record={opened}
          onClose={() => setOpenId(null)}
          onChanged={async () => {
            await fetchList()
          }}
        />
      )}
    </div>
  )
}

// ─── 상세 모달 ──────────────────────────────────────────────────────────

function DetailModal({
  record,
  onClose,
  onChanged,
}: {
  record: HrRecord
  onClose: () => void
  onChanged: () => Promise<void>
}) {
  const [processing, setProcessing] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const handleApprove = async () => {
    if (!confirm('이 인사기록카드를 승인하시겠습니까?')) return
    setProcessing(true)
    try {
      const res = await fetch(`/api/admin/hr-records/${record.id}/approve`, {
        method: 'POST',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '승인 실패' }))
        alert(err.error ?? '승인 실패')
        return
      }
      await onChanged()
      onClose()
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      alert('반려 사유를 입력해주세요.')
      return
    }
    setProcessing(true)
    try {
      const res = await fetch(`/api/admin/hr-records/${record.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason.trim() }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: '반려 실패' }))
        alert(err.error ?? '반려 실패')
        return
      }
      await onChanged()
      onClose()
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitleWrap}>
            <h2 className={styles.modalTitle}>
              {record.name_ko ?? record.author_name ?? '-'} 의 인사기록카드
            </h2>
            <StatusBadge status={record.status} />
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className={styles.modalBody}>
          {/* 기초자료 */}
          <Section title="1. 기초자료">
            <div className={styles.profileRow}>
              {record.profile_image_url ? (
                <Image
                  src={record.profile_image_url}
                  alt="프로필"
                  width={100}
                  height={100}
                  className={styles.profileImg}
                  unoptimized
                />
              ) : (
                <div className={styles.profilePlaceholder}>사진 없음</div>
              )}
              <div className={styles.detailGrid}>
                <Detail label="한글 이름" value={record.name_ko} />
                <Detail label="영문 이름" value={record.name_en} />
                <Detail
                  label="성별"
                  value={
                    record.gender === 'male'
                      ? '남자'
                      : record.gender === 'female'
                        ? '여자'
                        : null
                  }
                />
                <Detail label="주민번호" value={record.rrn} />
                <Detail label="생년월일" value={record.birth_date} />
                <Detail label="입사일" value={record.joined_at} />
                <Detail label="직장명" value={record.company_name} />
                <Detail label="휴대폰" value={record.phone} />
                <Detail label="업무폰" value={record.work_phone} />
                <Detail label="이메일" value={record.email} />
                <Detail label="직장주소" value={record.company_address} fullWidth />
                <Detail label="현주소" value={record.current_address} fullWidth />
                <Detail label="비상전화" value={record.emergency_phone} />
                <Detail label="비상관계" value={record.emergency_relation} />
              </div>
            </div>
            <div className={styles.detailGrid3}>
              <Detail label="은행" value={record.bank_name} />
              <Detail label="계좌번호" value={record.account_number} />
              <Detail
                label="예금주 (본인 여부 확인)"
                value={record.account_holder}
                emphasize={
                  !!record.account_holder &&
                  !!record.name_ko &&
                  record.account_holder !== record.name_ko
                    ? 'warn'
                    : undefined
                }
              />
            </div>
            {record.account_holder &&
              record.name_ko &&
              record.account_holder !== record.name_ko && (
                <div className={styles.warningInline}>
                  ⚠️ 예금주명({record.account_holder})과 한글이름({record.name_ko})이 다릅니다.
                  본인 명의가 아니면 반려해주세요.
                </div>
              )}
          </Section>

          {/* 학력 */}
          <Section title="2. 학력사항">
            {record.education.length === 0 ? (
              <div className={styles.modalEmpty}>등록된 학력이 없습니다.</div>
            ) : (
              <table className={styles.subTable}>
                <thead>
                  <tr>
                    <th>학교명</th>
                    <th>입학</th>
                    <th>졸업</th>
                    <th>학위</th>
                    <th>전공</th>
                  </tr>
                </thead>
                <tbody>
                  {record.education.map((e, i) => (
                    <tr key={i}>
                      <td>{e.school ?? '-'}</td>
                      <td>{e.start ?? '-'}</td>
                      <td>{e.end ?? '-'}</td>
                      <td>{e.degree ?? '-'}</td>
                      <td>{e.major ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          {/* 경력 */}
          <Section title="3. 경력사항">
            {record.career.length === 0 ? (
              <div className={styles.modalEmpty}>등록된 경력이 없습니다.</div>
            ) : (
              <table className={styles.subTable}>
                <thead>
                  <tr>
                    <th>기관명</th>
                    <th>직위</th>
                    <th>업무</th>
                    <th>시작</th>
                    <th>종료</th>
                    <th>개월</th>
                    <th>비고</th>
                    <th>증명서</th>
                  </tr>
                </thead>
                <tbody>
                  {record.career.map((c, i) => (
                    <tr key={i}>
                      <td>{c.org ?? '-'}</td>
                      <td>{c.position ?? '-'}</td>
                      <td>{c.work ?? '-'}</td>
                      <td>{c.start ?? '-'}</td>
                      <td>{c.end ?? '-'}</td>
                      <td>{c.months != null ? `${c.months}개월` : '-'}</td>
                      <td>{c.notes ?? '-'}</td>
                      <td>
                        {c.attachment_url ? (
                          <a
                            href={buildHrDownloadUrl(
                              c.attachment_url,
                              c.attachment_name,
                            )}
                            download={c.attachment_name ?? '경력증명서'}
                          >
                            📎 {c.attachment_name ?? '다운로드'}
                          </a>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          {/* 자격 */}
          <Section title="4. 자격사항 및 교육수료">
            {record.certificates.length === 0 ? (
              <div className={styles.modalEmpty}>등록된 자격이 없습니다.</div>
            ) : (
              <table className={styles.subTable}>
                <thead>
                  <tr>
                    <th>자격증명</th>
                    <th>급수</th>
                    <th>번호</th>
                    <th>취득일</th>
                    <th>인가기관</th>
                  </tr>
                </thead>
                <tbody>
                  {record.certificates.map((c, i) => (
                    <tr key={i}>
                      <td>{c.name ?? '-'}</td>
                      <td>{c.grade ?? '-'}</td>
                      <td>{c.number ?? '-'}</td>
                      <td>{c.issued_at ?? '-'}</td>
                      <td>{c.issuer ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          {record.reject_reason && (
            <div className={styles.prevReject}>
              <strong>이전 반려 사유:</strong> {record.reject_reason}
            </div>
          )}
        </div>

        {/* 푸터 */}
        {record.status === 'submitted' || record.status === 'rejected' ? (
          <div className={styles.modalFooter}>
            {showReject ? (
              <div className={styles.rejectForm}>
                <textarea
                  className={styles.rejectInput}
                  placeholder="반려 사유를 입력하세요 (필수)"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                />
                <div className={styles.rejectActions}>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={() => {
                      setShowReject(false)
                      setRejectReason('')
                    }}
                    disabled={processing}
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    className={styles.btnReject}
                    onClick={handleReject}
                    disabled={processing}
                  >
                    {processing ? '처리 중...' : '반려 확정'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className={styles.btnReject}
                  onClick={() => setShowReject(true)}
                  disabled={processing}
                >
                  <XCircle size={14} /> 반려
                </button>
                <button
                  type="button"
                  className={styles.btnApprove}
                  onClick={handleApprove}
                  disabled={processing}
                >
                  <CheckCircle2 size={14} />{' '}
                  {processing ? '처리 중...' : '승인'}
                </button>
              </>
            )}
          </div>
        ) : (
          <div className={styles.modalFooter}>
            <span className={styles.footerInfo}>
              {record.status === 'approved'
                ? '이미 승인된 카드입니다.'
                : '아직 제출되지 않은 카드입니다.'}
            </span>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={onClose}
            >
              닫기
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── 보조 ──────────────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      {children}
    </section>
  )
}

function Detail({
  label,
  value,
  fullWidth,
  emphasize,
}: {
  label: string
  value: string | null | undefined
  fullWidth?: boolean
  emphasize?: 'warn'
}) {
  return (
    <div className={`${styles.detail} ${fullWidth ? styles.detailFull : ''}`}>
      <span className={styles.detailLabel}>{label}</span>
      <span
        className={`${styles.detailValue} ${emphasize === 'warn' ? styles.detailValueWarn : ''}`}
      >
        {value || '-'}
      </span>
    </div>
  )
}

function Pagination({
  page,
  totalPages,
  total,
  onChange,
}: {
  page: number
  totalPages: number
  total: number
  onChange: (p: number) => void
}) {
  if (totalPages <= 1) {
    return (
      <div className={styles.paginationWrap}>
        <span className={styles.paginationInfo}>총 {total}건</span>
      </div>
    )
  }
  // 페이지 번호 윈도우 (현재 페이지 기준 ±2)
  const pages: number[] = []
  const start = Math.max(1, page - 2)
  const end = Math.min(totalPages, page + 2)
  for (let i = start; i <= end; i++) pages.push(i)

  return (
    <div className={styles.paginationWrap}>
      <span className={styles.paginationInfo}>
        총 {total}건 · {page} / {totalPages} 페이지
      </span>
      <div className={styles.paginationButtons}>
        <button
          type="button"
          className={styles.paginationBtn}
          onClick={() => onChange(1)}
          disabled={page === 1}
        >
          처음
        </button>
        <button
          type="button"
          className={styles.paginationBtn}
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page === 1}
        >
          이전
        </button>
        {pages.map((p) => (
          <button
            key={p}
            type="button"
            className={`${styles.paginationBtn} ${p === page ? styles.paginationBtnActive : ''}`}
            onClick={() => onChange(p)}
          >
            {p}
          </button>
        ))}
        <button
          type="button"
          className={styles.paginationBtn}
          onClick={() => onChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
        >
          다음
        </button>
        <button
          type="button"
          className={styles.paginationBtn}
          onClick={() => onChange(totalPages)}
          disabled={page === totalPages}
        >
          마지막
        </button>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, { cls: string; icon: React.ReactNode }> = {
    draft: { cls: styles.badgeDraft, icon: null },
    submitted: { cls: styles.badgeSubmitted, icon: <Clock size={11} /> },
    approved: { cls: styles.badgeApproved, icon: <CheckCircle2 size={11} /> },
    rejected: { cls: styles.badgeRejected, icon: <XCircle size={11} /> },
  }
  return (
    <span className={`${styles.badge} ${map[status].cls}`}>
      {map[status].icon}
      {STATUS_LABELS[status]}
    </span>
  )
}
