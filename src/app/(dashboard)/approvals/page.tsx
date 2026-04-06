'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, X, Check, XCircle, ChevronRight, FileText, Clock, CheckCircle, Home, MoreVertical, Info } from 'lucide-react'
import type { Approval, ApprovalTemplate, ApprovalStep, Department } from '@/lib/management/types'
import {
  formatDate,
  formatAmount,
  getStatusLabel,
  getStatusColor,
  getStatusBg,
  getPaymentMethodLabel,
} from '@/lib/management/utils'
import styles from './page.module.css'

// ---------------------------------------------------------------------------
// 타입 정의
// ---------------------------------------------------------------------------

type SidebarMenuKey =
  | 'home'
  | 'pending_approval'
  | 'received'
  | 'draft_box'
  | 'temp_box'
  | 'approved_box'
  | 'received_box'

type ViewType = 'home' | 'list' | 'detail' | 'new_template' | 'new_form'

interface SidebarMenu {
  key: SidebarMenuKey
  label: string
  apiTab?: 'mine' | 'pending' | 'completed'
}

interface ApprovalFormState {
  template: ApprovalTemplate | null
  title: string
  department_id: string
  content: Record<string, string>
  approver_ids: string[]
}

// ---------------------------------------------------------------------------
// 상수
// ---------------------------------------------------------------------------

const SIDEBAR_GROUPS: { label: string; items: SidebarMenu[] }[] = [

  {
    label: '결재하기',
    items: [
      { key: 'pending_approval', label: '결재 대기 문서', apiTab: 'pending' },
      { key: 'received', label: '결재 수신 문서', apiTab: 'pending' },
    ],
  },
  {
    label: '개인문서함',
    items: [
      { key: 'draft_box', label: '기안 문서함', apiTab: 'mine' },
      { key: 'temp_box', label: '임시 저장함', apiTab: 'mine' },
      { key: 'approved_box', label: '결재 문서함', apiTab: 'completed' },
      { key: 'received_box', label: '수신 문서함', apiTab: 'completed' },
    ],
  },
]

const EXPENSE_CONTENT_FIELDS = [
  { key: 'expense_date', label: '지출일', type: 'date', required: true },
  { key: 'expense_category', label: '지출 항목', type: 'text', required: true },
  { key: 'expense_detail', label: '세부 내역', type: 'text', required: true },
  { key: 'amount', label: '금액 (원)', type: 'number', required: true },
  {
    key: 'payment_method',
    label: '결제 수단',
    type: 'select',
    required: true,
    options: [
      { value: 'CORPORATE_CARD', label: '법인카드' },
      { value: 'BANK_TRANSFER', label: '계좌이체' },
      { value: 'CASH', label: '현금' },
      { value: 'OTHER', label: '기타' },
    ],
  },
  { key: 'vendor', label: '거래처', type: 'text' },
  { key: 'memo', label: '메모', type: 'textarea' },
]

const TRAVEL_CONTENT_FIELDS = [
  { key: 'travel_start', label: '출발일', type: 'date', required: true },
  { key: 'travel_end', label: '복귀일', type: 'date', required: true },
  { key: 'destination', label: '목적지', type: 'text', required: true },
  { key: 'purpose', label: '출장 목적', type: 'text', required: true },
  { key: 'amount', label: '예상 경비 (원)', type: 'number' },
  { key: 'memo', label: '비고', type: 'textarea' },
]

const HR_CONTENT_FIELDS = [
  { key: 'reason', label: '사유', type: 'text', required: true },
  { key: 'start_date', label: '시작일', type: 'date', required: true },
  { key: 'end_date', label: '종료일', type: 'date' },
  { key: 'memo', label: '비고', type: 'textarea' },
]

const ALL_FIELDS = [...EXPENSE_CONTENT_FIELDS, ...TRAVEL_CONTENT_FIELDS, ...HR_CONTENT_FIELDS]

function getContentFields(template: ApprovalTemplate | null) {
  if (!template) return []
  if (template.category === '회계') return EXPENSE_CONTENT_FIELDS
  if (template.category === '출장') return TRAVEL_CONTENT_FIELDS
  return HR_CONTENT_FIELDS
}

// ---------------------------------------------------------------------------
// 서브 컴포넌트: ApprovalStatusBadge
// ---------------------------------------------------------------------------

function ApprovalStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={styles.status_badge}
      style={{ color: getStatusColor(status) }}
    >
      {getStatusLabel(status)}
    </span>
  )
}

// ---------------------------------------------------------------------------
// 서브 컴포넌트: ApprovalTable
// ---------------------------------------------------------------------------

interface ApprovalTableProps {
  approvals: Approval[]
  onRowClick: (approval: Approval) => void
  emptyMessage?: string
  compact?: boolean
}

function ApprovalTable({ approvals, onRowClick, emptyMessage = '문서가 없습니다.', compact = false }: ApprovalTableProps) {
  if (approvals.length === 0) {
    return <div className={styles.table_empty}>{emptyMessage}</div>
  }

  return (
    <table className={`${styles.table} ${compact ? styles.table_compact : ''}`}>
      <thead>
        <tr>
          <th>기안일</th>
          <th>결재양식</th>
          <th>제목</th>
          <th>문서번호</th>
          <th>결재상태</th>
        </tr>
      </thead>
      <tbody>
        {approvals.map((a) => (
          <tr
            key={a.id}
            className={styles.table_row_clickable}
            onClick={() => onRowClick(a)}
          >
            <td className={styles.cell_date}>{formatDate(a.created_at)}</td>
            <td>
              <span className={styles.cell_category}>{a.category}</span>
              <span className={styles.cell_doc_type}>{a.document_type}</span>
            </td>
            <td className={styles.cell_title}>{a.title}</td>
            <td className={styles.cell_doc_number}>{a.document_number ?? '-'}</td>
            <td>
              <ApprovalStatusBadge status={a.status} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ---------------------------------------------------------------------------
// 서브 컴포넌트: ApprovalStepsPanel (결재선 우측 패널)
// ---------------------------------------------------------------------------

interface ApprovalStepsPanelProps {
  steps: ApprovalStep[]
  currentStep: number
}

function ApprovalStepsPanel({ steps, currentStep }: ApprovalStepsPanelProps) {
  const sorted = [...steps].sort((a, b) => a.step_number - b.step_number)

  return (
    <div className={styles.steps_panel}>
      <div className={styles.steps_panel_header}>결재선</div>
      <div className={styles.steps_list}>
        {sorted.map((step) => {
          const isActive = step.step_number === currentStep && step.status === 'PENDING'
          return (
            <div
              key={step.id}
              className={`${styles.step_item} ${
                step.status === 'APPROVED'
                  ? styles.step_item_approved
                  : step.status === 'REJECTED'
                  ? styles.step_item_rejected
                  : isActive
                  ? styles.step_item_active
                  : styles.step_item_waiting
              }`}
            >
              <div className={styles.step_badge}>
                {step.status === 'APPROVED' ? (
                  <Check size={12} />
                ) : step.status === 'REJECTED' ? (
                  <X size={12} />
                ) : (
                  <span>{step.step_number}</span>
                )}
              </div>
              <div className={styles.step_info}>
                <p className={styles.step_approver}>
                  {(step.approver as { display_name: string } | undefined)?.display_name ?? '-'}
                </p>
                <p className={styles.step_status_text}>
                  {step.status === 'PENDING'
                    ? isActive ? '결재 대기 중' : '대기'
                    : step.status === 'APPROVED'
                    ? `승인 · ${step.acted_at ? formatDate(step.acted_at) : ''}`
                    : `반려 · ${step.acted_at ? formatDate(step.acted_at) : ''}`}
                </p>
                {step.comment && (
                  <p className={styles.step_comment}>{step.comment}</p>
                )}
              </div>
            </div>
          )
        })}
        {sorted.length === 0 && (
          <p className={styles.steps_empty}>결재선 정보가 없습니다.</p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 메인 페이지 컴포넌트
// ---------------------------------------------------------------------------

export default function ApprovalsPage() {
  // 뷰 상태
  const [currentView, setCurrentView] = useState<ViewType>('home')
  const [activeMenuKey, setActiveMenuKey] = useState<SidebarMenuKey>('home')

  // 데이터
  const [mineApprovals, setMineApprovals] = useState<Approval[]>([])
  const [pendingApprovals, setPendingApprovals] = useState<Approval[]>([])
  const [completedApprovals, setCompletedApprovals] = useState<Approval[]>([])
  const [listApprovals, setListApprovals] = useState<Approval[]>([])
  const [listLoading, setListLoading] = useState(false)
  const [homeLoading, setHomeLoading] = useState(false)

  // 마스터 데이터
  const [templates, setTemplates] = useState<ApprovalTemplate[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [users, setUsers] = useState<{ id: string; display_name: string }[]>([])
  const [myUserId, setMyUserId] = useState<string | null>(null)

  // 상세 뷰
  const [selectedApproval, setSelectedApproval] = useState<Approval | null>(null)
  const [actionComment, setActionComment] = useState('')
  const [actioning, setActioning] = useState(false)

  // 상세 뷰 패널 탭
  const [detailPanelTab, setDetailPanelTab] = useState<'steps' | 'info'>('steps')

  // 새 결재 플로우
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [formState, setFormState] = useState<ApprovalFormState>({
    template: null,
    title: '',
    department_id: '',
    content: {},
    approver_ids: [],
  })
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // ---------------------------------------------------------------------------
  // 데이터 페치
  // ---------------------------------------------------------------------------

  const fetchHomeData = useCallback(async () => {
    setHomeLoading(true)
    const [mineRes, pendingRes, completedRes] = await Promise.all([
      fetch('/api/management/approvals?tab=mine'),
      fetch('/api/management/approvals?tab=pending'),
      fetch('/api/management/approvals?tab=completed'),
    ])
    if (mineRes.ok) setMineApprovals(await mineRes.json())
    if (pendingRes.ok) setPendingApprovals(await pendingRes.json())
    if (completedRes.ok) setCompletedApprovals(await completedRes.json())
    setHomeLoading(false)
  }, [])

  const fetchListData = useCallback(async (apiTab: 'mine' | 'pending' | 'completed') => {
    setListLoading(true)
    const res = await fetch(`/api/management/approvals?tab=${apiTab}`)
    if (res.ok) setListApprovals(await res.json())
    setListLoading(false)
  }, [])

  useEffect(() => {
    fetchHomeData()
    fetch('/api/management/approvals/templates').then(r => r.json()).then(setTemplates).catch(() => {})
    fetch('/api/management/departments').then(r => r.json()).then(setDepartments).catch(() => {})
    fetch('/api/management/users').then(r => r.json()).then(setUsers).catch(() => {})
    fetch('/api/auth/me').then(r => r.json()).then(d => setMyUserId(d.id ?? null)).catch(() => {})
  }, [fetchHomeData])

  // ---------------------------------------------------------------------------
  // 이벤트 핸들러
  // ---------------------------------------------------------------------------

  const handleSidebarMenuClick = (menu: SidebarMenu) => {
    if (menu.key === 'home') {
      handleHomeClick()
      return
    }
    setActiveMenuKey(menu.key)
    if (menu.apiTab) {
      setCurrentView('list')
      fetchListData(menu.apiTab)
    }
  }

  const handleHomeClick = () => {
    setActiveMenuKey('home')
    setCurrentView('home')
    fetchHomeData()
  }

  const handleRowClick = async (approval: Approval) => {
    const res = await fetch(`/api/management/approvals/${approval.id}`)
    if (res.ok) {
      const data = await res.json()
      setSelectedApproval(data)
      setActionComment('')
      setCurrentView('detail')
    }
  }

  const handleApprovalAction = async (action: 'approve' | 'reject' | 'cancel') => {
    if (!selectedApproval) return
    if (action === 'reject' && !actionComment) {
      alert('반려 사유를 입력해주세요.')
      return
    }
    setActioning(true)
    const res = await fetch(`/api/management/approvals/${selectedApproval.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, comment: actionComment }),
    })
    setActioning(false)
    if (res.ok) {
      // 상세 뷰를 갱신하기 위해 다시 fetch
      const updated = await fetch(`/api/management/approvals/${selectedApproval.id}`)
      if (updated.ok) setSelectedApproval(await updated.json())
      setActionComment('')
      fetchHomeData()
    } else {
      const err = await res.json()
      alert(err.error ?? '처리 실패')
    }
  }

  const handleNewApprovalStart = () => {
    setSelectedCategory(null)
    setFormState({ template: null, title: '', department_id: '', content: {}, approver_ids: [] })
    setFormError('')
    setCurrentView('new_template')
  }

  const handleSelectTemplate = (tpl: ApprovalTemplate) => {
    setFormState({
      template: tpl,
      title: tpl.document_type,
      department_id: '',
      content: {},
      approver_ids: [],
    })
    setCurrentView('new_form')
  }

  const handleSubmitNewApproval = async (action: 'draft' | 'submit') => {
    const { template, title, content, approver_ids, department_id } = formState
    if (!template || !title) {
      setFormError('필수 항목을 입력해주세요.')
      return
    }

    const contentFields = getContentFields(template)
    for (const f of contentFields) {
      if (f.required && !content[f.key]) {
        setFormError(`'${f.label}'을(를) 입력해주세요.`)
        return
      }
    }

    if (action === 'submit' && approver_ids.length === 0) {
      setFormError('결재자를 최소 1명 이상 추가해주세요.')
      return
    }

    setSubmitting(true)
    setFormError('')
    const res = await fetch('/api/management/approvals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template_id: template.id,
        document_type: template.document_type,
        category: template.category,
        title,
        department_id: department_id || null,
        content,
        approver_ids: action === 'submit' ? approver_ids : [],
        action,
      }),
    })
    setSubmitting(false)
    if (res.ok) {
      fetchHomeData()
      setCurrentView('home')
      setActiveMenuKey('home')
    } else {
      const err = await res.json()
      setFormError(err.error ?? '저장 실패')
    }
  }

  // ---------------------------------------------------------------------------
  // 파생 상태
  // ---------------------------------------------------------------------------

  const templatesByCategory = templates.reduce<Record<string, ApprovalTemplate[]>>((acc, t) => {
    if (!acc[t.category]) acc[t.category] = []
    acc[t.category].push(t)
    return acc
  }, {})

  const sortedSteps = selectedApproval?.steps?.slice().sort((a, b) => a.step_number - b.step_number) ?? []
  const currentStepObj = sortedSteps.find(
    (s) => s.step_number === selectedApproval?.current_step && s.status === 'PENDING'
  )
  const canAct =
    currentStepObj?.approver_id === myUserId &&
    ['IN_PROGRESS', 'SUBMITTED'].includes(selectedApproval?.status ?? '')

  const canCancel =
    selectedApproval?.applicant_id === myUserId &&
    ['DRAFT', 'SUBMITTED'].includes(selectedApproval?.status ?? '')

  const inProgressApprovals = mineApprovals.filter(a =>
    ['SUBMITTED', 'IN_PROGRESS'].includes(a.status)
  )
  const doneApprovals = mineApprovals.filter(a =>
    ['APPROVED', 'REJECTED', 'CANCELLED'].includes(a.status)
  )

  const contentFields = getContentFields(formState.template)

  // ---------------------------------------------------------------------------
  // 렌더: 사이드바
  // ---------------------------------------------------------------------------

  const renderSidebar = () => (
    <aside className={styles.sidebar}>
      {/* 사이드바 제목 */}
      <div className={styles.sidebar_header}>
        <button className={styles.sidebar_title_btn} onClick={handleHomeClick}>전자결재</button>
        
      </div>

      {/* 새 결재 버튼 */}
      <button className={styles.sidebar_new_btn} onClick={handleNewApprovalStart}>
        새 결재 진행
      </button>

      {/* 메뉴 그룹 */}
      {SIDEBAR_GROUPS.map((group) => (
        <div key={group.label} className={styles.sidebar_group}>
          <p className={styles.sidebar_group_label}>{group.label}</p>
          {group.items.map((item) => {
            const isActive = activeMenuKey === item.key
            // 배지 카운트 계산
            let count = 0
            if (item.key === 'pending_approval' || item.key === 'received') {
              count = pendingApprovals.length
            }
            return (
              <button
                key={item.key}
                className={`${styles.sidebar_menu_item} ${isActive ? styles.sidebar_menu_active : ''}`}
                onClick={() => handleSidebarMenuClick(item)}
              >
                <span className={styles.sidebar_menu_label}>{item.label}</span>
                {count > 0 && (
                  <span className={styles.sidebar_badge}>{count}</span>
                )}
              </button>
            )
          })}
        </div>
      ))}
    </aside>
  )

  // ---------------------------------------------------------------------------
  // 렌더: 홈 뷰
  // ---------------------------------------------------------------------------

  const renderHomeView = () => (
    <div className={styles.view_home}>
      <div className={styles.home_page_title}>전자결재 홈</div>

      {/* 결재할 문서 섹션 */}
      <section className={styles.home_section}>
        
          <div className={styles.home_section_title_row}>
            
            
          </div>
      
        {homeLoading ? (
          <div className={styles.section_loading}>불러오는 중...</div>
        ) : (
          <ApprovalTable
            approvals={pendingApprovals}
            onRowClick={handleRowClick}
            emptyMessage="결재 대기 중인 문서가 없습니다."
            compact
          />
        )}
      </section>

      {/* 기안 진행 문서 섹션 */}
      <section className={styles.home_section}>
        <div className={styles.home_section_header}>
          <div className={styles.home_section_title_row}>
            <h3 className={styles.home_section_title}>기안 진행 문서</h3>
            
          </div>
        </div>
        {homeLoading ? (
          <div className={styles.section_loading}>불러오는 중...</div>
        ) : (
          <ApprovalTable
            approvals={inProgressApprovals}
            onRowClick={handleRowClick}
            emptyMessage="진행 중인 기안 문서가 없습니다."
            compact
          />
        )}
      </section>

      {/* 완료 문서 섹션 */}
      <section className={styles.home_section}>
        <div className={styles.home_section_header}>
          <div className={styles.home_section_title_row}>
            <h3 className={styles.home_section_title}>완료 문서</h3>
            
          </div>
        </div>
        {homeLoading ? (
          <div className={styles.section_loading}>불러오는 중...</div>
        ) : (
          <ApprovalTable
            approvals={doneApprovals}
            onRowClick={handleRowClick}
            emptyMessage="완료된 문서가 없습니다."
            compact
          />
        )}
      </section>
    </div>
  )

  // ---------------------------------------------------------------------------
  // 렌더: 문서 목록 뷰
  // ---------------------------------------------------------------------------

  const getListViewTitle = () => {
    const found = SIDEBAR_GROUPS.flatMap(g => g.items).find(i => i.key === activeMenuKey)
    return found?.label ?? '문서함'
  }

  const renderListView = () => (
    <div className={styles.view_list}>
      <div className={styles.view_list_header}>
        <h2 className={styles.view_title}>{getListViewTitle()}</h2>
      </div>
      <div className={styles.table_wrap}>
        {listLoading ? (
          <div className={styles.section_loading}>불러오는 중...</div>
        ) : (
          <ApprovalTable
            approvals={listApprovals}
            onRowClick={handleRowClick}
            emptyMessage="문서가 없습니다."
          />
        )}
      </div>
    </div>
  )

  // ---------------------------------------------------------------------------
  // 렌더: 문서 상세 뷰
  // ---------------------------------------------------------------------------

  const renderDetailView = () => {
    if (!selectedApproval) return null

    const applicantName =
      (selectedApproval.applicant as { display_name: string } | undefined)?.display_name ?? '-'

    return (
      <div className={styles.view_detail}>
        {/* 상단 액션바 */}
        <div className={styles.detail_action_bar}>
          <button
            className={styles.detail_back_btn}
            onClick={() => {
              if (currentView === 'detail') {
                setCurrentView(activeMenuKey === 'home' ? 'home' : 'list')
              }
            }}
          >
            <ChevronRight size={14} className={styles.icon_rotate_180} />
            목록으로
          </button>
          <div className={styles.detail_action_bar_right}>
            <ApprovalStatusBadge status={selectedApproval.status} />
            {canAct && (
              <>
                <button
                  className={styles.btn_danger}
                  onClick={() => handleApprovalAction('reject')}
                  disabled={actioning}
                >
                  <XCircle size={14} />
                  반려
                </button>
                <button
                  className={styles.btn_primary}
                  onClick={() => handleApprovalAction('approve')}
                  disabled={actioning}
                >
                  <Check size={14} />
                  승인
                </button>
              </>
            )}
            {canCancel && (
              <button
                className={styles.btn_secondary}
                onClick={() => handleApprovalAction('cancel')}
                disabled={actioning}
              >
                취소
              </button>
            )}
          </div>
        </div>

        {/* 종이 문서 + 우측 패널 */}
        <div className={styles.detail_body}>
          {/* 종이 문서 스크롤 영역 */}
          <div className={styles.doc_scroll_area}>
            <div className={styles.doc_paper}>
              {/* 문서 제목 */}
              <h2 className={styles.doc_title}>{selectedApproval.document_type}</h2>

              {/* 헤더 영역: 정보 테이블 + 결재란 */}
              <div className={styles.doc_header_area}>
                {/* 좌측: 문서 정보 테이블 */}
                <table className={styles.doc_info_table}>
                  <tbody>
                    <tr>
                      <td className={styles.doc_info_label}>작성일자</td>
                      <td>{formatDate(selectedApproval.created_at)}</td>
                    </tr>
                    <tr>
                      <td className={styles.doc_info_label}>신청부서</td>
                      <td>{selectedApproval.department?.name ?? '-'}</td>
                    </tr>
                    <tr>
                      <td className={styles.doc_info_label}>신청자</td>
                      <td>{applicantName}</td>
                    </tr>
                    <tr>
                      <td className={styles.doc_info_label}>문서번호</td>
                      <td>{selectedApproval.document_number ?? '-'}</td>
                    </tr>
                  </tbody>
                </table>

                {/* 우측: 결재란 그리드 */}
                <table className={styles.doc_approval_box}>
                  <tbody>
                    <tr>
                      <td className={styles.doc_approval_label} rowSpan={3}>결재</td>
                      {sortedSteps.length > 0 ? (
                        sortedSteps.map((step) => (
                          <td key={step.id} className={styles.doc_approval_name_cell}>
                            {(step.approver as { display_name: string } | undefined)?.display_name ?? '-'}
                          </td>
                        ))
                      ) : (
                        <td className={styles.doc_approval_empty_cell}>미지정</td>
                      )}
                    </tr>
                    <tr>
                      {sortedSteps.length > 0 ? (
                        sortedSteps.map((step) => (
                          <td key={step.id} className={styles.doc_approval_status_cell}>
                            {step.status === 'APPROVED'
                              ? '승인'
                              : step.status === 'REJECTED'
                              ? '반려'
                              : step.step_number === selectedApproval.current_step
                              ? '대기 중'
                              : '대기'}
                          </td>
                        ))
                      ) : (
                        <td className={styles.doc_approval_status_cell}></td>
                      )}
                    </tr>
                    <tr>
                      {sortedSteps.length > 0 ? (
                        sortedSteps.map((step) => (
                          <td key={step.id} className={styles.doc_approval_status_cell}>
                            {step.acted_at ? formatDate(step.acted_at) : ''}
                          </td>
                        ))
                      ) : (
                        <td className={styles.doc_approval_status_cell}></td>
                      )}
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 본문 테이블 */}
              {Object.keys(selectedApproval.content).length > 0 && (
                <table className={styles.doc_body_table}>
                  <tbody>
                    {Object.entries(selectedApproval.content).map(([key, val]) => {
                      const fieldDef = ALL_FIELDS.find(f => f.key === key)
                      const label = fieldDef?.label ?? key
                      let display = String(val)
                      if (key === 'amount') display = formatAmount(Number(val))
                      if (key === 'payment_method') display = getPaymentMethodLabel(String(val))
                      return (
                        <tr key={key}>
                          <td className={styles.doc_field_label}>{label}</td>
                          <td>
                            <span className={styles.doc_field_value_text}>{display}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}

              {/* 결재 의견 입력 (canAct 일 때) */}
              {canAct && (
                <div className={styles.doc_comment_section}>
                  <label className={styles.doc_comment_label}>
                    결재 의견 (선택, 반려 시 필수)
                  </label>
                  <textarea
                    className={styles.form_textarea}
                    placeholder="결재 의견을 입력하세요."
                    value={actionComment}
                    onChange={(e) => setActionComment(e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>

          {/* 우측 결재선 패널 */}
          <div className={styles.detail_panel}>
            {/* 탭 */}
            <div className={styles.detail_panel_tabs}>
              <button
                className={`${styles.detail_panel_tab} ${detailPanelTab === 'steps' ? styles.detail_panel_tab_active : ''}`}
                onClick={() => setDetailPanelTab('steps')}
              >
                결재선
              </button>
              <button
                className={`${styles.detail_panel_tab} ${detailPanelTab === 'info' ? styles.detail_panel_tab_active : ''}`}
                onClick={() => setDetailPanelTab('info')}
              >
                문서정보
              </button>
            </div>

            {/* 탭 본문 */}
            <div className={styles.detail_panel_body}>
              {detailPanelTab === 'steps' ? (
                /* 결재선 탭 */
                <div className={styles.steps_list}>
                  {sortedSteps.map((step) => {
                    const isActive =
                      step.step_number === selectedApproval.current_step &&
                      step.status === 'PENDING'
                    return (
                      <div
                        key={step.id}
                        className={`${styles.step_item} ${
                          step.status === 'APPROVED'
                            ? styles.step_item_approved
                            : step.status === 'REJECTED'
                            ? styles.step_item_rejected
                            : isActive
                            ? styles.step_item_active
                            : styles.step_item_waiting
                        }`}
                      >
                        <div className={styles.step_badge}>
                          {step.status === 'APPROVED' ? (
                            <Check size={12} />
                          ) : step.status === 'REJECTED' ? (
                            <X size={12} />
                          ) : (
                            <span>{step.step_number}</span>
                          )}
                        </div>
                        <div className={styles.step_info}>
                          <p className={styles.step_approver}>
                            {(step.approver as { display_name: string } | undefined)?.display_name ?? '-'}
                          </p>
                          <p className={styles.step_status_text}>
                            {step.status === 'PENDING'
                              ? isActive
                                ? '결재 대기 중'
                                : '대기'
                              : step.status === 'APPROVED'
                              ? `승인 · ${step.acted_at ? formatDate(step.acted_at) : ''}`
                              : `반려 · ${step.acted_at ? formatDate(step.acted_at) : ''}`}
                          </p>
                          {step.comment && (
                            <p className={styles.step_comment}>{step.comment}</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  {sortedSteps.length === 0 && (
                    <p className={styles.steps_empty}>결재선 정보가 없습니다.</p>
                  )}
                </div>
              ) : (
                /* 문서정보 탭 */
                <div className={styles.doc_info_list}>
                  <div className={styles.doc_info_row}>
                    <span className={styles.doc_info_row_label}>카테고리</span>
                    <span className={styles.doc_info_row_value}>{selectedApproval.category}</span>
                  </div>
                  <div className={styles.doc_info_row}>
                    <span className={styles.doc_info_row_label}>문서양식</span>
                    <span className={styles.doc_info_row_value}>{selectedApproval.document_type}</span>
                  </div>
                  <div className={styles.doc_info_row}>
                    <span className={styles.doc_info_row_label}>제목</span>
                    <span className={styles.doc_info_row_value}>{selectedApproval.title}</span>
                  </div>
                  <div className={styles.doc_info_row}>
                    <span className={styles.doc_info_row_label}>문서번호</span>
                    <span className={styles.doc_info_row_value}>
                      {selectedApproval.document_number ?? '-'}
                    </span>
                  </div>
                  <div className={styles.doc_info_row}>
                    <span className={styles.doc_info_row_label}>기안자</span>
                    <span className={styles.doc_info_row_value}>{applicantName}</span>
                  </div>
                  <div className={styles.doc_info_row}>
                    <span className={styles.doc_info_row_label}>기안일</span>
                    <span className={styles.doc_info_row_value}>
                      {formatDate(selectedApproval.created_at)}
                    </span>
                  </div>
                  {selectedApproval.submitted_at && (
                    <div className={styles.doc_info_row}>
                      <span className={styles.doc_info_row_label}>상신일</span>
                      <span className={styles.doc_info_row_value}>
                        {formatDate(selectedApproval.submitted_at)}
                      </span>
                    </div>
                  )}
                  {selectedApproval.completed_at && (
                    <div className={styles.doc_info_row}>
                      <span className={styles.doc_info_row_label}>완료일</span>
                      <span className={styles.doc_info_row_value}>
                        {formatDate(selectedApproval.completed_at)}
                      </span>
                    </div>
                  )}
                  <div className={styles.doc_info_row}>
                    <span className={styles.doc_info_row_label}>결재 상태</span>
                    <span className={styles.doc_info_row_value}>
                      <ApprovalStatusBadge status={selectedApproval.status} />
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // 렌더: 양식 선택 뷰
  // ---------------------------------------------------------------------------

  const renderNewTemplateView = () => (
    <div className={styles.view_new_template}>
      <div className={styles.view_list_header}>
        <h2 className={styles.view_title}>결재 문서 양식 선택</h2>
        <button
          className={styles.btn_secondary}
          onClick={() => {
            setCurrentView('home')
            setActiveMenuKey('home')
          }}
        >
          <X size={14} />
          취소
        </button>
      </div>

      <div className={styles.template_selector}>
        {/* 카테고리 좌측 트리 */}
        <div className={styles.template_categories}>
          <p className={styles.template_categories_title}>카테고리</p>
          {Object.keys(templatesByCategory).map((cat) => (
            <button
              key={cat}
              className={`${styles.template_category_item} ${selectedCategory === cat ? styles.template_category_active : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
              <ChevronRight size={14} />
            </button>
          ))}
        </div>

        {/* 양식 목록 우측 */}
        <div className={styles.template_list}>
          {selectedCategory ? (
            <>
              <p className={styles.template_list_title}>{selectedCategory}</p>
              <div className={styles.template_grid}>
                {(templatesByCategory[selectedCategory] ?? []).map((tpl) => (
                  <button
                    key={tpl.id}
                    className={styles.template_card}
                    onClick={() => handleSelectTemplate(tpl)}
                  >
                    <FileText size={20} className={styles.template_card_icon} />
                    <span className={styles.template_card_name}>{tpl.document_type}</span>
                    <span className={styles.template_card_category}>{tpl.category}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className={styles.template_placeholder}>
              <FileText size={32} />
              <p>좌측에서 카테고리를 선택하세요.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  // ---------------------------------------------------------------------------
  // 렌더: 문서 작성 뷰
  // ---------------------------------------------------------------------------

  const renderNewFormView = () => {
    // 오늘 날짜 (작성일자 자동 표시용)
    const todayStr = new Date().toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })

    // 현재 로그인 유저 이름
    const myUserName = users.find(u => String(u.id) === String(myUserId))?.display_name ?? '-'

    return (
      <div className={styles.view_new_form}>
        {/* 작성 헤더 */}
        <div className={styles.new_form_header}>
          <div>
            <p className={styles.new_form_category}>{formState.template?.category}</p>
            <h2 className={styles.new_form_title}>{formState.template?.document_type}</h2>
          </div>
          <div className={styles.new_form_actions}>
            <button
              className={styles.btn_primary}
              onClick={() => handleSubmitNewApproval('submit')}
              disabled={submitting || formState.approver_ids.length === 0}
            >
              {submitting ? '처리 중...' : '결재요청'}
            </button>
            <button
              className={styles.btn_secondary}
              onClick={() => handleSubmitNewApproval('draft')}
              disabled={submitting}
            >
              임시저장
            </button>
            <button
              className={styles.btn_secondary}
              onClick={() => {}}
            >
              미리보기
            </button>
            <button
              className={styles.btn_secondary}
              onClick={() => setCurrentView('new_template')}
            >
              취소
            </button>
          </div>
        </div>

        {/* 종이 문서 스크롤 영역 */}
        <div className={styles.doc_scroll_area}>
          <div className={styles.doc_paper}>
            {/* 문서 제목 */}
            <h2 className={styles.doc_title}>{formState.template?.document_type}</h2>

            {/* 헤더 영역: 정보 테이블 + 결재란 */}
            <div className={styles.doc_header_area}>
              {/* 좌측: 문서 정보 테이블 */}
              <table className={styles.doc_info_table}>
                <tbody>
                  <tr>
                    <td className={styles.doc_info_label}>작성일자</td>
                    <td>{todayStr}</td>
                  </tr>
                  <tr>
                    <td className={styles.doc_info_label}>신청부서</td>
                    <td>
                      <select
                        className={styles.doc_info_select}
                        value={formState.department_id}
                        onChange={(e) => setFormState({ ...formState, department_id: e.target.value })}
                      >
                        <option value="">선택</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                  <tr>
                    <td className={styles.doc_info_label}>신청자</td>
                    <td>{myUserName}</td>
                  </tr>
                  <tr>
                    <td className={styles.doc_info_label}>제목</td>
                    <td>
                      <input
                        className={styles.doc_info_input}
                        value={formState.title}
                        placeholder="문서 제목 입력"
                        onChange={(e) => setFormState({ ...formState, title: e.target.value })}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* 우측: 결재란 그리드 */}
              <table className={styles.doc_approval_box}>
                <tbody>
                  <tr>
                    <td className={styles.doc_approval_label} rowSpan={3}>결재선</td>
                    {formState.approver_ids.length > 0 ? (
                      formState.approver_ids.map((uid, idx) => {
                        const u = users.find(x => String(x.id) === uid)
                        return (
                          <td key={idx} className={styles.doc_approval_name_cell}>
                            {u?.display_name ?? uid}
                          </td>
                        )
                      })
                    ) : (
                      <td className={styles.doc_approval_empty_cell}>미지정</td>
                    )}
                  </tr>
                  <tr>
                    {formState.approver_ids.length > 0 ? (
                      formState.approver_ids.map((_, idx) => (
                        <td key={idx} className={styles.doc_approval_status_cell}></td>
                      ))
                    ) : (
                      <td className={styles.doc_approval_status_cell}></td>
                    )}
                  </tr>
                  <tr>
                    {formState.approver_ids.length > 0 ? (
                      formState.approver_ids.map((_, idx) => (
                        <td key={idx} className={styles.doc_approval_status_cell}></td>
                      ))
                    ) : (
                      <td className={styles.doc_approval_status_cell}></td>
                    )}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 본문 테이블 */}
            <table className={styles.doc_body_table}>
              <tbody>
                {contentFields.map((f) => {
                  const isRequired = f.required === true
                  return (
                    <tr key={f.key}>
                      <td
                        className={`${styles.doc_field_label} ${isRequired ? styles.doc_field_label_required : ''}`}
                      >
                        {f.label}
                      </td>
                      <td>
                        {f.type === 'textarea' ? (
                          <textarea
                            className={styles.doc_body_textarea}
                            value={formState.content[f.key] ?? ''}
                            placeholder={`${f.label} 입력`}
                            onChange={(e) =>
                              setFormState({
                                ...formState,
                                content: { ...formState.content, [f.key]: e.target.value },
                              })
                            }
                          />
                        ) : f.type === 'select' ? (
                          <select
                            className={styles.doc_body_select}
                            value={formState.content[f.key] ?? ''}
                            onChange={(e) =>
                              setFormState({
                                ...formState,
                                content: { ...formState.content, [f.key]: e.target.value },
                              })
                            }
                          >
                            <option value="">선택</option>
                            {(f as { options?: { value: string; label: string }[] }).options?.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={f.type}
                            className={styles.doc_body_input}
                            value={formState.content[f.key] ?? ''}
                            placeholder={`${f.label} 입력`}
                            onChange={(e) =>
                              setFormState({
                                ...formState,
                                content: { ...formState.content, [f.key]: e.target.value },
                              })
                            }
                          />
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* 결재선 설정 */}
            <div className={styles.doc_approver_section}>
              <p className={styles.doc_approver_section_title}>결재선</p>
              <div className={styles.doc_approver_chain}>
                {formState.approver_ids.map((uid, idx) => {
                  const u = users.find(x => String(x.id) === uid)
                  return (
                    <div key={idx} className={styles.doc_approver_chip}>
                      <div className={styles.doc_approver_chip_step}>{idx + 1}</div>
                      <span className={styles.doc_approver_chip_name}>{u?.display_name ?? uid}</span>
                      <button
                        className={styles.doc_approver_chip_remove}
                        onClick={() =>
                          setFormState({
                            ...formState,
                            approver_ids: formState.approver_ids.filter((_, i) => i !== idx),
                          })
                        }
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )
                })}
              </div>
              <div className={styles.doc_approver_add_row}>
                <select
                  className={styles.doc_approver_add_select}
                  value=""
                  onChange={(e) => {
                    if (e.target.value && !formState.approver_ids.includes(e.target.value)) {
                      setFormState({
                        ...formState,
                        approver_ids: [...formState.approver_ids, e.target.value],
                      })
                    }
                  }}
                >
                  <option value="">+ 결재자 추가</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.display_name}</option>
                  ))}
                </select>
              </div>
            </div>

            {formError && <p className={styles.error_msg}>{formError}</p>}
          </div>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // 렌더: 메인
  // ---------------------------------------------------------------------------

  const renderMainContent = () => {
    switch (currentView) {
      case 'home': return renderHomeView()
      case 'list': return renderListView()
      case 'detail': return renderDetailView()
      case 'new_template': return renderNewTemplateView()
      case 'new_form': return renderNewFormView()
      default: return renderHomeView()
    }
  }

  return (
    <div className={styles.page_layout}>
      {renderSidebar()}
      <main className={styles.main_area}>
        {renderMainContent()}
      </main>
    </div>
  )
}
