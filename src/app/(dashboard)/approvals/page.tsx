'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Plus, X, Check, XCircle, ChevronRight, ChevronDown, ChevronsRight, FileText, Clock, CheckCircle, Home, MoreVertical, Info, Eye, Save, Send, List, Paperclip, Download, AlignJustify, ChevronsUpDown, Search, ListChecks, ChevronFirst, ChevronLast } from 'lucide-react'
import { MdOutlineKeyboardArrowLeft, MdOutlineKeyboardArrowRight } from 'react-icons/md'
import type { Approval, ApprovalTemplate, ApprovalStep, Department } from '@/lib/management/types'
import {
  formatDate,
  getStatusLabel,
  getStatusColor,
  getStatusBg,
} from '@/lib/management/utils'
import styles from './page.module.css'
import d from './detailView.module.css'
import f from './formView.module.css'
import { getDocTemplate, ALL_TEMPLATE_FIELDS, buildDynamicTemplateConfigs } from './docTemplates'
import type { DocTemplateConfig } from './docTemplates'
import { ExpenseProofPanel, parseCardItems } from './templates/corporateCard'
import type { ApprovalFormTemplate } from '@/types/approvalForm'

// ---------------------------------------------------------------------------
// 타입 정의
// ---------------------------------------------------------------------------

type SidebarMenuKey =
  | 'home'
  | 'pending_approval'
  | 'received'
  | 'reference'
  | 'draft_box'
  | 'temp_box'
  | 'approved_box'
  | 'received_box'

type ViewType = 'home' | 'list' | 'detail' | 'new_template' | 'new_form'

interface SidebarMenu {
  key: SidebarMenuKey
  label: string
  apiTab?: 'mine' | 'pending' | 'completed' | 'reference'
}

interface ApprovalFormState {
  template: ApprovalTemplate | null
  title: string
  department_id: string
  content: Record<string, string>
  approver_ids: string[]
  reference_ids: string[]
}

interface AttachedFile {
  name: string
  url: string
  type: string
  size: number
}

interface LinkedProposal {
  id: string
  document_number: string | null
  title: string
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
      { key: 'reference', label: '참조/열람 대기 문서', apiTab: 'reference' as const },
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


// ---------------------------------------------------------------------------
// 서브 컴포넌트: ApprovalStatusBadge
// ---------------------------------------------------------------------------

function ApprovalStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={styles.status_badge}
      style={{ background: getStatusColor(status), color: '#fff' }}
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

type SortField = 'created_at' | 'completed_at' | 'category' | 'document_type' | 'title' | 'applicant' | 'document_number' | 'status'
type SortDir = 'asc' | 'desc'

const PAGE_SIZE = 10

function ApprovalTable({ approvals, onRowClick, emptyMessage = '문서가 없습니다.', compact = false }: ApprovalTableProps) {
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const sorted = [...approvals].sort((a, b) => {
    let va = '', vb = ''
    if (sortField === 'created_at') { va = a.created_at; vb = b.created_at }
    else if (sortField === 'completed_at') { va = a.completed_at ?? ''; vb = b.completed_at ?? '' }
    else if (sortField === 'category') { va = a.category ?? ''; vb = b.category ?? '' }
    else if (sortField === 'document_type') { va = a.document_type; vb = b.document_type }
    else if (sortField === 'title') { va = a.title; vb = b.title }
    else if (sortField === 'applicant') { va = (a.applicant as { display_name: string } | undefined)?.display_name ?? ''; vb = (b.applicant as { display_name: string } | undefined)?.display_name ?? '' }
    else if (sortField === 'document_number') { va = a.document_number ?? ''; vb = b.document_number ?? '' }
    else if (sortField === 'status') { va = a.status; vb = b.status }
    const cmp = va < vb ? -1 : va > vb ? 1 : 0
    return sortDir === 'asc' ? cmp : -cmp
  })

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronsUpDown size={12} className={styles.th_sort_icon} />
    return sortDir === 'asc'
      ? <ChevronDown size={12} className={styles.th_sort_icon_active} style={{ transform: 'rotate(180deg)' }} />
      : <ChevronDown size={12} className={styles.th_sort_icon_active} />
  }

  const SortTh = ({ field, label }: { field: SortField; label: string }) => (
    <th className={styles.th_sortable} onClick={() => handleSort(field)}>
      <span className={styles.th_inner}>{label} <SortIcon field={field} /></span>
    </th>
  )

  if (sorted.length === 0) {
    return (
      <div className={styles.table_empty}>
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className={styles.table_empty_icon}>
          <ellipse cx="40" cy="72" rx="24" ry="4" fill="#e5e7eb"/>
          <rect x="18" y="16" width="44" height="52" rx="6" fill="#f3f4f6" stroke="#d1d5db" strokeWidth="1.5"/>
          <rect x="26" y="28" width="28" height="3" rx="1.5" fill="#d1d5db"/>
          <rect x="26" y="36" width="20" height="3" rx="1.5" fill="#d1d5db"/>
          <rect x="26" y="44" width="24" height="3" rx="1.5" fill="#d1d5db"/>
          <circle cx="40" cy="20" r="8" fill="#fff" stroke="#d1d5db" strokeWidth="1.5"/>
          <circle cx="37" cy="19" r="1.5" fill="#9ca3af"/>
          <circle cx="43" cy="19" r="1.5" fill="#9ca3af"/>
          <path d="M37 23 Q40 25 43 23" stroke="#9ca3af" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
        </svg>
        <p className={styles.table_empty_text}>{emptyMessage}</p>
      </div>
    )
  }

  return (
    <table className={`${styles.table} ${compact ? styles.table_compact : ''}`}>
      <thead>
        <tr>
          {!compact && <th className={styles.th_check}><input type="checkbox" /></th>}
          <SortTh field="created_at" label="기안일" />
          {!compact && <SortTh field="completed_at" label="완료일" />}
          {!compact && <SortTh field="category" label="구분" />}
          <SortTh field="document_type" label="결재양식" />
          <SortTh field="title" label="제목" />
          {!compact && <SortTh field="applicant" label="기안자" />}
          <SortTh field="document_number" label="문서번호" />
          <SortTh field="status" label="결재상태" />
        </tr>
      </thead>
      <tbody>
        {sorted.map((a) => (
          <tr
            key={a.id}
            className={styles.table_row_clickable}
            onClick={() => onRowClick(a)}
          >
            {!compact && <td className={styles.td_check} onClick={e => e.stopPropagation()}><input type="checkbox" /></td>}
            <td className={styles.cell_date}>{formatDate(a.created_at)}</td>
            {!compact && <td className={styles.cell_date}>{a.completed_at ? formatDate(a.completed_at) : '-'}</td>}
            {!compact && <td className={styles.cell_category}>{a.category ?? '-'}</td>}
            <td><span className={styles.cell_doc_type}>{a.document_type}</span></td>
            <td className={styles.cell_title}>{a.title}</td>
            {!compact && <td className={styles.cell_applicant}>{(a.applicant as { display_name: string } | undefined)?.display_name ?? '-'}</td>}
            <td className={styles.cell_doc_number}>{a.document_number ?? '-'}</td>
            <td><ApprovalStatusBadge status={a.status} /></td>
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
  const [dynamicConfigs, setDynamicConfigs] = useState<DocTemplateConfig[]>([])
  const [dynamicForms, setDynamicForms] = useState<ApprovalFormTemplate[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [users, setUsers] = useState<{ id: string; display_name: string; department_id?: string | null }[]>([])
  const [myUserId, setMyUserId] = useState<string | null>(null)
  const [myDepartmentId, setMyDepartmentId] = useState<string | null>(null)
  const [myRole, setMyRole] = useState<string | null>(null)

  // 상세 뷰
  const [selectedApproval, setSelectedApproval] = useState<Approval | null>(null)
  const [actionComment, setActionComment] = useState('')
  const [actioning, setActioning] = useState(false)
  const [resyncingExpense, setResyncingExpense] = useState(false)

  // 상세 뷰 패널 탭
  const [detailPanelTab, setDetailPanelTab] = useState<'steps' | 'info'>('steps')

  // 양식 선택 모달
  // 결재선 모달
  const [approverModalOpen, setApproverModalOpen] = useState(false)
  const [approverModalDraft, setApproverModalDraft] = useState<string[]>([])
  const [orgSearch, setOrgSearch] = useState('')
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set())
  const [apmDropBefore, setApmDropBefore] = useState<number | null>(null) // 드롭 삽입 위치
  const [apmDraggingRowIdx, setApmDraggingRowIdx] = useState<number | null>(null) // 우측 행 드래그
  const apmIsDragging = useRef(false) // 드래그 중 클릭 이벤트 차단용

  // 참조자 모달
  const [refModalOpen, setRefModalOpen] = useState(false)
  const [refModalDraft, setRefModalDraft] = useState<string[]>([])
  const refIsDragging = useRef(false)

  const [templateModalOpen, setTemplateModalOpen] = useState(false)
  const [modalCategory, setModalCategory] = useState<string | null>(null)
  const [modalSelectedTemplate, setModalSelectedTemplate] = useState<ApprovalTemplate | null>(null)
  const [modalSearch, setModalSearch] = useState('')
  const [modalDepartmentId, setModalDepartmentId] = useState('')

  // 새 결재 플로우
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [formState, setFormState] = useState<ApprovalFormState>({
    template: null,
    title: '',
    department_id: '',
    content: {},
    approver_ids: [],
    reference_ids: [],
  })
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // 파일 첨부
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const [fileDragOver, setFileDragOver] = useState(false)

  // 결재선 드래그 순서 변경
  const [approverDragIdx, setApproverDragIdx] = useState<number | null>(null)

  // 임시저장 편집 모드
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null)

  // 품의서 연동 (지출결의서 전용)
  const [linkedProposal, setLinkedProposal] = useState<LinkedProposal | null>(null)
  const [proposalModalOpen, setProposalModalOpen] = useState(false)
  const [proposalCandidates, setProposalCandidates] = useState<Approval[]>([])
  const [proposalLoadingCandidates, setProposalLoadingCandidates] = useState(false)

  // 연동 품의서 미리보기 팝업
  const [linkedProposalView, setLinkedProposalView] = useState<Approval | null>(null)
  const [linkedProposalViewLoading, setLinkedProposalViewLoading] = useState(false)

  // 리스트 뷰 - 검색/페이지네이션/서브탭
  const [listPage, setListPage] = useState(1)
  const [listSearch, setListSearch] = useState('')
  const [listSearchField, setListSearchField] = useState<'title' | 'document_type' | 'document_number'>('title')
  const [refSubTab, setRefSubTab] = useState<'all' | 'reference'>('all')

  const handleContentChange = useCallback((key: string, value: string) => {
    setFormState((prev) => {
      const nextContent = { ...prev.content, [key]: value }
      // 동적 양식의 문서제목 필드는 approval.title 과 동기화
      if (key === '__title__') {
        return { ...prev, title: value, content: nextContent }
      }
      return { ...prev, content: nextContent }
    })
  }, [])

  // 미리보기
  const [previewOpen, setPreviewOpen] = useState(false)

  // 이미지 라이트박스
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

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

  const fetchListData = useCallback(async (apiTab: 'mine' | 'pending' | 'completed' | 'reference') => {
    setListLoading(true)
    const res = await fetch(`/api/management/approvals?tab=${apiTab}`)
    if (res.ok) setListApprovals(await res.json())
    setListLoading(false)
  }, [])

  useEffect(() => {
    fetchHomeData()
    fetch('/api/management/approvals/templates').then(r => r.json()).then(setTemplates).catch(() => {})
    fetch('/api/approvals/forms').then(r => r.json()).then((forms: ApprovalFormTemplate[]) => {
      if (Array.isArray(forms)) {
        setDynamicForms(forms)
        setDynamicConfigs(buildDynamicTemplateConfigs(forms))
      }
    }).catch(() => {})
    fetch('/api/management/departments').then(r => r.json()).then(setDepartments).catch(() => {})
    fetch('/api/management/users').then(r => r.json()).then(setUsers).catch(() => {})
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      setMyUserId(d.id ?? null)
      setMyDepartmentId(d.departmentId ?? null)
      setMyRole(d.role ?? null)
    }).catch(() => {})
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
    setListPage(1)
    setListSearch('')
    setRefSubTab('all')
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
    if (!res.ok) return
    const data = await res.json()

    if (data.status === 'DRAFT') {
      // 임시저장 문서 → 편집 폼으로 열기
      const template = templates.find(t => t.id === data.template_id) ?? null
      const rawAttachments = data.content['_attachments']
      const existingAttachments: AttachedFile[] = Array.isArray(rawAttachments) ? (rawAttachments as AttachedFile[]) : []
      const rawLinked = (data.content as Record<string, unknown>)['_linked_proposal']
      const existingLinked = (rawLinked && typeof rawLinked === 'object')
        ? (rawLinked as LinkedProposal)
        : null
      const { _attachments, _linked_proposal, ...restContent } = data.content as Record<string, unknown>
      void _attachments
      void _linked_proposal

      setFormState({
        template,
        title: data.title,
        department_id: String(data.department_id ?? ''),
        content: Object.fromEntries(
          Object.entries(restContent).map(([k, v]) => [k, String(v ?? '')])
        ),
        approver_ids: [],
        reference_ids: Array.isArray(data.reference_ids) ? data.reference_ids.map(String) : [],
      })
      setAttachedFiles(existingAttachments)
      setLinkedProposal(existingLinked)
      setEditingDraftId(data.id)
      setFormError('')
      setCurrentView('new_form')
    } else {
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
    setModalCategory(null)
    setModalSelectedTemplate(null)
    setModalSearch('')
    setModalDepartmentId(myDepartmentId ?? '')
    setTemplateModalOpen(true)
  }

  const handleTemplateModalConfirm = () => {
    if (!modalSelectedTemplate) return
    setTemplateModalOpen(false)
    setSelectedCategory(null)
    const isDynamic = modalSelectedTemplate.document_type.startsWith('custom_')
    setFormState({
      template: modalSelectedTemplate,
      title: isDynamic ? '' : modalSelectedTemplate.document_type,
      department_id: modalDepartmentId,
      content: {},
      approver_ids: [],
      reference_ids: [],
    })
    setFormError('')
    setAttachedFiles([])
    setUploadingFiles(false)
    setEditingDraftId(null)
    setLinkedProposal(null)
    setCurrentView('new_form')
  }

  const uploadFiles = async (files: File[]) => {
    const validFiles = files.filter(f => f instanceof File)
    if (!validFiles.length) return
    setUploadingFiles(true)
    const fd = new FormData()
    validFiles.forEach(file => fd.append('files', file))
    const res = await fetch('/api/management/approvals/upload', { method: 'POST', body: fd })
    if (res.ok) {
      const { files: uploaded } = await res.json()
      setAttachedFiles(prev => [...prev, ...(uploaded as AttachedFile[])])
    } else {
      const text = await res.text()
      let msg = '파일 업로드 실패'
      try { msg = JSON.parse(text).error ?? msg } catch { /* empty body */ }
      alert(msg)
    }
    setUploadingFiles(false)
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    await uploadFiles(files)
    e.target.value = ''
  }

  const handleFileDrop = async (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setFileDragOver(false)
    const files = Array.from(e.dataTransfer.items)
      .filter(item => item.kind === 'file')
      .map(item => item.getAsFile())
      .filter((file): file is File => file !== null && file.size >= 0)
    await uploadFiles(files)
  }

  const removeAttachedFile = (idx: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== idx))
  }

  // ── 품의서 연동 ────────────────────────────────────────────────
  const openProposalLinkModal = useCallback(async () => {
    setProposalModalOpen(true)
    setProposalLoadingCandidates(true)
    const [completedRes, mineRes] = await Promise.all([
      fetch('/api/management/approvals?tab=completed'),
      fetch('/api/management/approvals?tab=mine'),
    ])
    const completed: Approval[] = completedRes.ok ? await completedRes.json() : []
    const mine: Approval[] = mineRes.ok ? await mineRes.json() : []

    const isProposalType = (a: Approval) =>
      a.document_type.replace(/\s/g, '') === '[품의서]지출품의서'
    const isResolutionType = (a: Approval) =>
      a.document_type.replace(/\s/g, '') === '[결의서]지출결의서'

    // 본인 + 승인 완료 품의서
    const approvedProposals = completed.filter(
      a => String(a.applicant_id) === String(myUserId) && isProposalType(a) && a.status === 'APPROVED'
    )

    // 이미 다른 결의서가 연동한 품의서는 제외 (편집 중인 결의서는 예외)
    const linkedIds = new Set<string>()
    const seen = new Set<string>()
    for (const a of [...mine, ...completed]) {
      if (seen.has(String(a.id))) continue
      seen.add(String(a.id))
      if (!isResolutionType(a)) continue
      if (editingDraftId && String(a.id) === String(editingDraftId)) continue
      const lp = (a.content as Record<string, unknown> | null)?.['_linked_proposal'] as LinkedProposal | undefined
      if (lp?.id) linkedIds.add(String(lp.id))
    }
    setProposalCandidates(approvedProposals.filter(p => !linkedIds.has(String(p.id))))
    setProposalLoadingCandidates(false)
  }, [myUserId, editingDraftId])

  const applyProposalLink = (p: Approval) => {
    const content = (p.content ?? {}) as Record<string, unknown>
    const get = (k: string) => (content[k] != null ? String(content[k]) : '')

    const filled: Record<string, string> = {}
    if (get('belong_dept')) filled.belong_dept = get('belong_dept')
    if (get('vendor_name')) filled.vendor_name = get('vendor_name')
    if (get('contact')) filled.vendor_phone = get('contact')
    if (get('purpose')) filled.detail = get('purpose')
    if (get('amount')) filled.amount = get('amount')
    if (get('cost_type')) filled.cost_type = get('cost_type')
    if (get('special_note')) filled.special_note = get('special_note')

    setFormState(prev => ({
      ...prev,
      content: { ...prev.content, ...filled },
    }))

    // 품의서 첨부파일 복사
    const rawAtt = content['_attachments']
    const proposalFiles: AttachedFile[] = Array.isArray(rawAtt) ? (rawAtt as AttachedFile[]) : []
    if (proposalFiles.length) {
      setAttachedFiles(prev => {
        const seen = new Set(prev.map(f => f.url))
        return [...prev, ...proposalFiles.filter(f => !seen.has(f.url))]
      })
    }

    setLinkedProposal({
      id: String(p.id),
      document_number: p.document_number ?? null,
      title: p.title,
    })
    setProposalModalOpen(false)
  }

  const handleUnlinkProposal = () => {
    setLinkedProposal(null)
  }

  const handleSelectTemplate = (tpl: ApprovalTemplate) => {
    const isDynamic = tpl.document_type.startsWith('custom_')
    setFormState({
      template: tpl,
      title: isDynamic ? '' : tpl.document_type,
      department_id: '',
      content: {},
      approver_ids: [],
      reference_ids: [],
    })
    setLinkedProposal(null)
    setCurrentView('new_form')
  }

  const handleSubmitNewApproval = async (action: 'draft' | 'submit') => {
    const { template, title, content, approver_ids, reference_ids, department_id } = formState
    if (!template || !title) {
      setFormError('필수 항목을 입력해주세요.')
      return
    }

    const templateConfig = getDocTemplate(template, dynamicConfigs)
    for (const f of (templateConfig?.fields ?? [])) {
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

    const mergedContent: Record<string, unknown> = { ...content }
    if (attachedFiles.length > 0) mergedContent._attachments = attachedFiles
    if (linkedProposal) mergedContent._linked_proposal = linkedProposal

    let res: Response
    if (editingDraftId) {
      // 기존 임시저장 수정
      res = await fetch(`/api/management/approvals/${editingDraftId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          department_id: department_id || null,
          content: mergedContent,
          approver_ids: action === 'submit' ? approver_ids : [],
          reference_ids,
          action,
        }),
      })
    } else {
      // 새 결재 생성
      res = await fetch('/api/management/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: template.id,
          document_type: template.document_type,
          category: template.category,
          title,
          department_id: department_id || null,
          content: mergedContent,
          approver_ids: action === 'submit' ? approver_ids : [],
          reference_ids,
          action,
        }),
      })
    }

    setSubmitting(false)
    if (res.ok) {
      setEditingDraftId(null)
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
  const canResyncExpense =
    !!selectedApproval &&
    selectedApproval.status === 'APPROVED' &&
    ['admin', 'master-admin'].includes(myRole ?? '')

  const HOME_LIMIT = 5
  const inProgressApprovals = mineApprovals.filter(a =>
    ['SUBMITTED', 'IN_PROGRESS'].includes(a.status)
  )
  const doneApprovals = mineApprovals.filter(a =>
    ['APPROVED', 'REJECTED', 'CANCELLED'].includes(a.status)
  )

  const formTemplateConfig = getDocTemplate(formState.template, dynamicConfigs)
  const formIsDynamic = !!formState.template?.document_type.startsWith('custom_')
  const formDynamicName = formIsDynamic
    ? (dynamicForms.find((fo) => fo.document_type === formState.template?.document_type)?.name ?? null)
    : null
  const formHeadingTitle = formIsDynamic
    ? (formState.title?.trim() || formDynamicName || '(문서 제목을 입력하세요)')
    : (formState.template?.document_type ?? '')

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
            if (item.key === 'pending_approval') {
              count = pendingApprovals.filter(a => {
                const myStep = a.steps?.find(s => String(s.approver_id) === String(myUserId))
                return myStep && myStep.step_number > a.current_step
              }).length
            } else if (item.key === 'received') {
              count = pendingApprovals.filter(a => {
                const myStep = a.steps?.find(s => String(s.approver_id) === String(myUserId))
                return myStep && myStep.step_number === a.current_step
              }).length
            } else if (item.key === 'reference') {
              count = pendingApprovals.filter(a =>
                Array.isArray(a.reference_ids) && a.reference_ids.map(String).includes(String(myUserId))
              ).length
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
            {inProgressApprovals.length > HOME_LIMIT && (
              <button
                className={styles.btn_more}
                onClick={() => handleSidebarMenuClick({ key: 'draft_box', label: '기안 문서함', apiTab: 'mine' })}
              >
                더보기 →
              </button>
            )}
          </div>
        </div>
        {homeLoading ? (
          <div className={styles.section_loading}>불러오는 중...</div>
        ) : (
          <ApprovalTable
            approvals={inProgressApprovals.slice(0, HOME_LIMIT)}
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
            {doneApprovals.length > HOME_LIMIT && (
              <button
                className={styles.btn_more}
                onClick={() => handleSidebarMenuClick({ key: 'approved_box', label: '결재 문서함', apiTab: 'completed' })}
              >
                더보기 →
              </button>
            )}
          </div>
        </div>
        {homeLoading ? (
          <div className={styles.section_loading}>불러오는 중...</div>
        ) : (
          <ApprovalTable
            approvals={doneApprovals.slice(0, HOME_LIMIT)}
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

  const filteredListApprovals = (() => {
    if (activeMenuKey === 'pending_approval') {
      // 내 step_number > current_step → 아직 내 차례 아님
      return listApprovals.filter(a => {
        const myStep = a.steps?.find(s => String(s.approver_id) === String(myUserId))
        return myStep && myStep.step_number > a.current_step
      })
    }
    if (activeMenuKey === 'received') {
      // 내 step_number === current_step → 지금 내 차례
      return listApprovals.filter(a => {
        const myStep = a.steps?.find(s => String(s.approver_id) === String(myUserId))
        return myStep && myStep.step_number === a.current_step
      })
    }
    return listApprovals
  })()

  const PAGE_SIZE = 10

  const searchedListApprovals = (() => {
    let list = filteredListApprovals
    if (listSearch.trim()) {
      const q = listSearch.trim().toLowerCase()
      list = list.filter(a => {
        if (listSearchField === 'title') return a.title.toLowerCase().includes(q)
        if (listSearchField === 'document_type') return a.document_type.toLowerCase().includes(q)
        if (listSearchField === 'document_number') return (a.document_number ?? '').toLowerCase().includes(q)
        return false
      })
    }
    return list
  })()

  const totalListPages = Math.max(1, Math.ceil(searchedListApprovals.length / PAGE_SIZE))
  const pagedListApprovals = searchedListApprovals.slice((listPage - 1) * PAGE_SIZE, listPage * PAGE_SIZE)

  const renderListView = () => (
    <div className={styles.view_list}>
      {/* 헤더 + 검색 */}
      <div className={styles.view_list_header}>
        <h2 className={styles.view_title}>{getListViewTitle()}</h2>
        <div className={styles.list_search_bar}>
          <select className={styles.list_search_select} value={listSearchField} onChange={e => setListSearchField(e.target.value as 'title' | 'document_type' | 'document_number')}>
            <option value="title">제목</option>
            <option value="document_type">결재양식</option>
            <option value="document_number">문서번호</option>
          </select>
          <input
            className={styles.list_search_input}
            placeholder="검색"
            value={listSearch}
            onChange={e => { setListSearch(e.target.value); setListPage(1) }}
          />
          <button className={styles.list_search_btn}><Search size={14}/></button>
        </div>
      </div>

      {/* 서브탭 (참조/열람 대기 문서) */}
      {activeMenuKey === 'reference' && (
        <div className={styles.list_sub_tabs}>
          <button
            className={`${styles.list_sub_tab} ${refSubTab === 'all' ? styles.list_sub_tab_active : ''}`}
            onClick={() => { setRefSubTab('all'); setListPage(1) }}
          >전체</button>
          <button
            className={`${styles.list_sub_tab} ${refSubTab === 'reference' ? styles.list_sub_tab_active : ''}`}
            onClick={() => { setRefSubTab('reference'); setListPage(1) }}
          >참조</button>
        </div>
      )}

      {/* 테이블 */}
      <div className={styles.table_wrap}>
        {listLoading ? (
          <div className={styles.section_loading}>불러오는 중...</div>
        ) : (
          <ApprovalTable
            approvals={pagedListApprovals}
            onRowClick={handleRowClick}
            emptyMessage="문서가 없습니다."
          />
        )}
      </div>

      {/* 페이지네이션 */}
      <div className={styles.list_pagination}>
        <button className={styles.page_btn} onClick={() => setListPage(1)} disabled={listPage === 1}><ChevronFirst size={14}/></button>
        <button className={styles.page_btn} onClick={() => setListPage(p => Math.max(1, p - 1))} disabled={listPage === 1}><MdOutlineKeyboardArrowLeft size={16}/></button>
        {Array.from({ length: totalListPages }, (_, i) => i + 1)
          .filter(p => p === 1 || p === totalListPages || Math.abs(p - listPage) <= 2)
          .reduce<(number | '...')[]>((acc, p, i, arr) => {
            if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push('...')
            acc.push(p)
            return acc
          }, [])
          .map((p, i) =>
            p === '...'
              ? <span key={`e${i}`} className={styles.page_ellipsis}>…</span>
              : <button key={p} className={`${styles.page_btn} ${listPage === p ? styles.page_current : ''}`} onClick={() => setListPage(p as number)}>{p}</button>
          )}
        <button className={styles.page_btn} onClick={() => setListPage(p => Math.min(totalListPages, p + 1))} disabled={listPage === totalListPages}><MdOutlineKeyboardArrowRight size={16}/></button>
        <button className={styles.page_btn} onClick={() => setListPage(totalListPages)} disabled={listPage === totalListPages}><ChevronLast size={14}/></button>
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

    const handleResyncExpense = async () => {
      if (!selectedApproval) return
      setResyncingExpense(true)
      try {
        const res = await fetch('/api/management/approvals/resync-expenses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ approvalId: selectedApproval.id }),
        })
        const json = await res.json()
        if (!res.ok) {
          alert(json.error ?? '손익 재반영에 실패했습니다.')
          return
        }
        const result = Array.isArray(json.results) ? json.results[0] : null
        if (result?.synced) {
          alert(`손익 재반영이 완료되었습니다. 반영 건수: ${result.count ?? 0}건`)
        } else {
          alert(result?.error ?? '반영된 지출 항목이 없습니다.')
        }
      } catch {
        alert('손익 재반영 중 오류가 발생했습니다.')
      } finally {
        setResyncingExpense(false)
      }
    }

    return (
      <div className={d.view_detail}>
        {/* 상단 액션바 */}
        <div className={d.detail_action_bar}>
          <button
            className={d.detail_back_btn}
            onClick={() => {
              if (currentView === 'detail') {
                setCurrentView(activeMenuKey === 'home' ? 'home' : 'list')
              }
            }}
          >
            <ChevronRight size={14} className={d.icon_rotate_180} />
            목록으로
          </button>
          <div className={d.detail_action_bar_right}>
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
            {canResyncExpense && (
              <button
                className={styles.btn_secondary}
                onClick={handleResyncExpense}
                disabled={resyncingExpense}
              >
                {resyncingExpense ? '재반영 중...' : '손익 재반영'}
              </button>
            )}
          </div>
        </div>

        {/* 종이 문서 + 우측 패널 */}
        <div className={d.detail_body}>
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

              {/* 연동 품의서 (지출결의서) */}
              {(() => {
                const raw = (selectedApproval.content as Record<string, unknown>)?.['_linked_proposal']
                if (!raw || typeof raw !== 'object') return null
                const lp = raw as LinkedProposal
                if (!lp.id) return null
                return (
                  <table className={styles.linkedProposalTable}>
                    <thead>
                      <tr>
                        <th colSpan={2} className={styles.linkedProposalHeader}>연동 품의서</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className={styles.linkedProposalLabelCell}>문서번호</td>
                        <td className={styles.linkedProposalValueCell}>
                          <button
                            type="button"
                            className={styles.linkedProposalLinkBtn}
                            onClick={async () => {
                              setLinkedProposalViewLoading(true)
                              setLinkedProposalView({ id: lp.id } as Approval)
                              const res = await fetch(`/api/management/approvals/${lp.id}`)
                              if (res.ok) {
                                setLinkedProposalView(await res.json())
                              } else {
                                setLinkedProposalView(null)
                                alert('품의서를 불러올 수 없습니다.')
                              }
                              setLinkedProposalViewLoading(false)
                            }}
                          >
                            {lp.document_number ?? '문서번호 없음'}
                          </button>
                          <span className={styles.linkedProposalSubtitle}>{lp.title}</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                )
              })()}

              {/* 본문 테이블 — 템플릿 레지스트리에서 자동 처리 */}
              {(() => {
                const cfg = getDocTemplate(selectedApproval, dynamicConfigs)
                if (!cfg) return null
                const content = selectedApproval.content as Record<string, unknown>
                return <cfg.BodySection content={content} departments={departments} />
              })()}

              {/* 첨부파일 미리보기 */}
              {(() => {
                const raw = selectedApproval.content['_attachments']
                const files: AttachedFile[] = Array.isArray(raw) ? (raw as AttachedFile[]) : []
                if (!files.length) return null
                return (
                  <div className={styles.doc_file_attach_section}>
                    <p className={styles.doc_file_attach_title}>파일첨부</p>
                    <div className={d.doc_file_list}>
                      {files.map((file, i) => (
                        <div key={i} className={d.doc_file_item}>
                          {file.type.startsWith('image/') ? (
                            <button
                              type="button"
                              className={d.doc_file_thumb_btn}
                              onClick={() => setLightboxUrl(file.url)}
                            >
                              <img src={file.url} alt={file.name} className={d.doc_file_thumb} />
                            </button>
                          ) : (
                            <span className={d.doc_file_icon}>
                              {file.type === 'application/pdf' ? '📕' : '📄'}
                            </span>
                          )}
                          <div className={d.doc_file_info}>
                            <span className={d.doc_file_name}>{file.name}</span>
                            <span className={d.doc_file_size}>{(file.size / 1024).toFixed(1)} KB</span>
                          </div>
                          <a
                            href={file.url}
                            download={file.name}
                            className={styles.doc_file_download_btn}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Download size={12} />
                            다운로드
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}

              {/* 결재 의견 입력 (canAct 일 때) */}
              {canAct && (
                <div className={d.doc_comment_section}>
                  <label className={d.doc_comment_label}>
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

          {/* 법인카드 사용내역 제출서: 우측 증빙 패널 */}
          {(() => {
            const cfg = getDocTemplate(selectedApproval, dynamicConfigs)
            if (cfg?.id !== 'corporate-card') return null
            const content = selectedApproval.content as Record<string, unknown>
            return (
              <aside className={styles.doc_proof_aside}>
                <ExpenseProofPanel cardItems={parseCardItems(content)} />
              </aside>
            )
          })()}

          {/* 이미지 라이트박스 */}
          {lightboxUrl && (
            <div className={d.lightbox_overlay} onClick={() => setLightboxUrl(null)}>
              <button className={d.lightbox_close} onClick={() => setLightboxUrl(null)}>
                <X size={20} />
              </button>
              <img
                src={lightboxUrl}
                alt="미리보기"
                className={d.lightbox_img}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}

          {/* 우측 결재선 패널 */}
          <div className={d.detail_panel}>
            {/* 탭 */}
            <div className={d.detail_panel_tabs}>
              <button
                className={`${d.detail_panel_tab} ${detailPanelTab === 'steps' ? d.detail_panel_tab_active : ''}`}
                onClick={() => setDetailPanelTab('steps')}
              >
                결재선
              </button>
              <button
                className={`${d.detail_panel_tab} ${detailPanelTab === 'info' ? d.detail_panel_tab_active : ''}`}
                onClick={() => setDetailPanelTab('info')}
              >
                문서정보
              </button>
            </div>

            {/* 탭 본문 */}
            <div className={d.detail_panel_body}>
              {detailPanelTab === 'steps' ? (
                /* 결재선 탭 */
                <div className={d.steps_list}>
                  {sortedSteps.map((step) => {
                    const isActive =
                      step.step_number === selectedApproval.current_step &&
                      step.status === 'PENDING'
                    return (
                      <div
                        key={step.id}
                        className={`${d.step_item} ${
                          step.status === 'APPROVED'
                            ? d.step_item_approved
                            : step.status === 'REJECTED'
                            ? d.step_item_rejected
                            : isActive
                            ? d.step_item_active
                            : d.step_item_waiting
                        }`}
                      >
                        <div className={d.step_badge}>
                          {step.status === 'APPROVED' ? (
                            <Check size={12} />
                          ) : step.status === 'REJECTED' ? (
                            <X size={12} />
                          ) : (
                            <span>{step.step_number}</span>
                          )}
                        </div>
                        <div className={d.step_info}>
                          <p className={d.step_approver}>
                            {(step.approver as { display_name: string } | undefined)?.display_name ?? '-'}
                          </p>
                          <p className={d.step_status_text}>
                            {step.status === 'PENDING'
                              ? isActive
                                ? '결재 대기 중'
                                : '대기'
                              : step.status === 'APPROVED'
                              ? `승인 · ${step.acted_at ? formatDate(step.acted_at) : ''}`
                              : `반려 · ${step.acted_at ? formatDate(step.acted_at) : ''}`}
                          </p>
                          {step.comment && (
                            <p className={d.step_comment}>{step.comment}</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  {sortedSteps.length === 0 && (
                    <p className={d.steps_empty}>결재선 정보가 없습니다.</p>
                  )}
                </div>
              ) : (
                /* 문서정보 탭 */
                <div className={d.doc_info_list}>
                  <div className={d.doc_info_row}>
                    <span className={d.doc_info_row_label}>카테고리</span>
                    <span className={d.doc_info_row_value}>{selectedApproval.category}</span>
                  </div>
                  <div className={d.doc_info_row}>
                    <span className={d.doc_info_row_label}>문서양식</span>
                    <span className={d.doc_info_row_value}>{selectedApproval.document_type}</span>
                  </div>
                  <div className={d.doc_info_row}>
                    <span className={d.doc_info_row_label}>제목</span>
                    <span className={d.doc_info_row_value}>{selectedApproval.title}</span>
                  </div>
                  <div className={d.doc_info_row}>
                    <span className={d.doc_info_row_label}>문서번호</span>
                    <span className={d.doc_info_row_value}>
                      {selectedApproval.document_number ?? '-'}
                    </span>
                  </div>
                  <div className={d.doc_info_row}>
                    <span className={d.doc_info_row_label}>기안자</span>
                    <span className={d.doc_info_row_value}>{applicantName}</span>
                  </div>
                  <div className={d.doc_info_row}>
                    <span className={d.doc_info_row_label}>기안일</span>
                    <span className={d.doc_info_row_value}>
                      {formatDate(selectedApproval.created_at)}
                    </span>
                  </div>
                  {selectedApproval.submitted_at && (
                    <div className={d.doc_info_row}>
                      <span className={d.doc_info_row_label}>상신일</span>
                      <span className={d.doc_info_row_value}>
                        {formatDate(selectedApproval.submitted_at)}
                      </span>
                    </div>
                  )}
                  {selectedApproval.completed_at && (
                    <div className={d.doc_info_row}>
                      <span className={d.doc_info_row_label}>완료일</span>
                      <span className={d.doc_info_row_value}>
                        {formatDate(selectedApproval.completed_at)}
                      </span>
                    </div>
                  )}
                  <div className={d.doc_info_row}>
                    <span className={d.doc_info_row_label}>결재 상태</span>
                    <span className={d.doc_info_row_value}>
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
    <div className={f.view_new_template}>
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

      <div className={f.template_selector}>
        {/* 카테고리 좌측 트리 */}
        <div className={f.template_categories}>
          <p className={f.template_categories_title}>카테고리</p>
          {Object.keys(templatesByCategory).map((cat) => (
            <button
              key={cat}
              className={`${f.template_category_item} ${selectedCategory === cat ? f.template_category_active : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
              <ChevronRight size={14} />
            </button>
          ))}
        </div>

        {/* 양식 목록 우측 */}
        <div className={f.template_list}>
          {selectedCategory ? (
            <>
              <p className={f.template_list_title}>{selectedCategory}</p>
              <div className={f.template_grid}>
                {(templatesByCategory[selectedCategory] ?? []).map((tpl) => (
                  <button
                    key={tpl.id}
                    className={f.template_card}
                    onClick={() => handleSelectTemplate(tpl)}
                  >
                    <FileText size={20} className={f.template_card_icon} />
                    <span className={f.template_card_name}>{tpl.document_type}</span>
                    <span className={f.template_card_category}>{tpl.category}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className={f.template_placeholder}>
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
      <div className={f.view_new_form}>
        {/* 작성 헤더 */}
        <div className={f.new_form_header}>
          <div>
            <p className={f.new_form_category}>{formState.template?.category}</p>
            <h2 className={f.new_form_title}>
              {formHeadingTitle}
              {editingDraftId && <span className={f.draft_editing_badge}>임시저장 편집 중</span>}
            </h2>
          </div>
          <div className={f.new_form_actions}>
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
              {editingDraftId ? '수정 저장' : '임시저장'}
            </button>
            <button
              className={styles.btn_secondary}
              onClick={() => setPreviewOpen(true)}
            >
              미리보기
            </button>
            <button
              className={styles.btn_secondary}
              onClick={() => {
                setApproverModalDraft([...formState.approver_ids])
                setOrgSearch('')
                setExpandedDepts(new Set(departments.map(d => String(d.id))))
                setApproverModalOpen(true)
              }}
            >
              결재선추가
            </button>
            <button
              className={styles.btn_secondary}
              onClick={() => {
                setRefModalDraft([...formState.reference_ids])
                setOrgSearch('')
                setExpandedDepts(new Set(departments.map(d => String(d.id))))
                setRefModalOpen(true)
              }}
            >
              참조자추가
            </button>
            <button
              className={styles.btn_secondary}
              onClick={() => {
                setEditingDraftId(null)
                setCurrentView(editingDraftId ? 'list' : 'new_template')
              }}
            >
              취소
            </button>
          </div>
        </div>

        {/* 종이 문서 + 증빙 패널 (법인카드일 때만 우측 패널) */}
        <div className={styles.doc_with_aside}>
        <div className={styles.doc_scroll_area}>
          <div className={styles.doc_paper}>
            {/* 문서 제목 */}
            <h2 className={styles.doc_title}>{formHeadingTitle}</h2>

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
                  {formState.reference_ids.length > 0 && (
                    <tr>
                      <td className={styles.doc_info_label}>참조자</td>
                      <td>
                        <div className={styles.doc_reference_cell}>
                          {formState.reference_ids.map((uid, idx) => {
                            const u = users.find(x => String(x.id) === uid)
                            return (
                              <span key={idx} className={styles.doc_reference_chip}>
                                {u?.display_name ?? uid}
                                <button
                                  className={styles.doc_reference_chip_remove}
                                  onClick={() => setFormState({ ...formState, reference_ids: formState.reference_ids.filter((_, i) => i !== idx) })}
                                ><X size={10} /></button>
                              </span>
                            )
                          })}
                        </div>
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td className={styles.doc_info_label}>제목</td>
                    <td>
                      <span className={styles.doc_info_input}>{formState.title}</span>
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

            {/* 품의서 연동 (지출결의서 전용) */}
            {formTemplateConfig?.id === 'expense-resolution' && (
              <table className={styles.linkedProposalTable}>
                <thead>
                  <tr>
                    <th colSpan={2} className={styles.linkedProposalHeader}>연동 품의서</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className={styles.linkedProposalLabelCell}>품의서</td>
                    <td className={styles.linkedProposalValueCell}>
                      {linkedProposal ? (
                        <>
                          <button
                            type="button"
                            className={styles.linkedProposalLinkBtn}
                            onClick={async () => {
                              setLinkedProposalViewLoading(true)
                              setLinkedProposalView({ id: linkedProposal.id } as Approval)
                              const res = await fetch(`/api/management/approvals/${linkedProposal.id}`)
                              if (res.ok) {
                                setLinkedProposalView(await res.json())
                              } else {
                                setLinkedProposalView(null)
                                alert('품의서를 불러올 수 없습니다.')
                              }
                              setLinkedProposalViewLoading(false)
                            }}
                          >
                            {linkedProposal.document_number ?? '문서번호 없음'}
                          </button>
                          <span className={styles.linkedProposalSubtitle}>{linkedProposal.title}</span>
                          <button
                            type="button"
                            className={styles.linkedProposalUnlinkBtn}
                            onClick={handleUnlinkProposal}
                          >
                            연동 해제
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className={styles.linkedProposalSelectBtn}
                          onClick={openProposalLinkModal}
                        >
                          품의서 선택
                        </button>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}

            {/* 본문 테이블 — 템플릿 레지스트리에서 자동 처리 */}
            {formTemplateConfig && (
              <formTemplateConfig.BodySection
                content={formState.content as Record<string, unknown>}
                onChange={handleContentChange}
                departments={departments}
              />
            )}

            {/* 파일첨부 (supportsAttachments 템플릿만 표시) */}
            {formTemplateConfig?.supportsAttachments && (
              <div className={styles.doc_file_attach_section}>
                <div className={f.doc_file_attach_label_row}>
                  <span className={styles.doc_file_attach_title}>파일첨부</span>
                </div>
                <div className={`${f.doc_file_attach_box} ${uploadingFiles ? f.doc_file_attach_uploading : ''}`}>
                  <label
                    className={`${f.doc_file_drop_zone} ${fileDragOver ? f.doc_file_drop_zone_over : ''}`}
                    onDragOver={(e) => { e.preventDefault(); setFileDragOver(true) }}
                    onDragLeave={() => setFileDragOver(false)}
                    onDrop={handleFileDrop}
                  >
                    <input type="file" multiple className={f.doc_file_attach_input} onChange={handleFileSelect} disabled={uploadingFiles} />
                    <Paperclip size={14} className={f.doc_file_drop_icon} />
                    <span>
                      {uploadingFiles ? '업로드 중...' : (
                        <>이 곳에 파일을 드래그 하세요. 또는 <span className={f.doc_file_select_link}>파일선택</span>
                          {attachedFiles.length > 0 && (
                            <span className={f.doc_file_total_size}> ({(attachedFiles.reduce((s, file) => s + file.size, 0) / 1024).toFixed(0)}KB)</span>
                          )}
                        </>
                      )}
                    </span>
                  </label>
                  {attachedFiles.map((file, i) => (
                    <div key={i} className={f.doc_file_row}>
                      <button type="button" className={f.doc_file_remove} onClick={() => removeAttachedFile(i)}><X size={12} /></button>
                      <span className={f.doc_file_row_icon}>{file.type.startsWith('image/') ? '🖼' : file.type === 'application/pdf' ? '📕' : '📄'}</span>
                      <span className={f.doc_file_row_name}>{file.name}</span>
                      <span className={f.doc_file_row_size}>({(file.size / 1024).toFixed(0)}Byte)</span>
                      <a href={file.url} download={file.name} className={styles.doc_file_download_btn}>다운로드</a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 결재선 설정 */}
            <div className={f.doc_approver_section}>
              <p className={f.doc_approver_section_title}>결재선</p>
              <div className={f.doc_approver_list}>
                {/* 기안자 */}
                <div className={f.doc_approver_list_item}>
                  <div className={f.doc_approver_list_name}>{myUser?.display_name ?? '-'}</div>
                  {myDept && <div className={f.doc_approver_list_dept}>{myDept.name}</div>}
                  <div className={f.doc_approver_list_role}>기안</div>
                </div>
                {/* 결재자 */}
                {formState.approver_ids.map((uid, idx) => {
                  const u = users.find(x => String(x.id) === uid)
                  const dept = departments.find(d => String(d.id) === String(u?.department_id))
                  return (
                    <div
                      key={idx}
                      className={`${f.doc_approver_list_item} ${approverDragIdx === idx ? f.doc_approver_chip_dragging : ''}`}
                      draggable
                      onDragStart={() => setApproverDragIdx(idx)}
                      onDragOver={(e) => { e.preventDefault() }}
                      onDrop={(e) => {
                        e.preventDefault()
                        if (approverDragIdx === null || approverDragIdx === idx) return
                        const newIds = [...formState.approver_ids]
                        const [moved] = newIds.splice(approverDragIdx, 1)
                        newIds.splice(idx, 0, moved)
                        setFormState({ ...formState, approver_ids: newIds })
                        setApproverDragIdx(null)
                      }}
                      onDragEnd={() => setApproverDragIdx(null)}
                    >
                      <div className={f.doc_approver_list_name}>{u?.display_name ?? uid}</div>
                      {dept && <div className={f.doc_approver_list_dept}>{dept.name}</div>}
                      <div className={f.doc_approver_list_role}>결재 예정</div>
                      <button
                        className={f.doc_approver_chip_remove}
                        onClick={() => setFormState({ ...formState, approver_ids: formState.approver_ids.filter((_, i) => i !== idx) })}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>


            {formError && <p className={styles.error_msg}>{formError}</p>}
          </div>
        </div>
        {formTemplateConfig?.id === 'corporate-card' && (
          <aside className={styles.doc_proof_aside}>
            <ExpenseProofPanel
              cardItems={parseCardItems(formState.content as Record<string, unknown>)}
              onAddItem={(picked) => {
                const content = formState.content as Record<string, unknown>
                const raw = content['card_items']
                let list: Array<Record<string, string>> = []
                try {
                  const parsed = raw ? JSON.parse(String(raw)) : []
                  if (Array.isArray(parsed)) list = parsed
                } catch {}
                const isEmptyRow = (row: Record<string, string>) =>
                  !row.date && !row.card_last4 && !row.dept && !row.user &&
                  !row.merchant && !row.detail && !row.amount
                const emptyIdx = list.findIndex(isEmptyRow)
                const newRow = {
                  date: picked.date,
                  card_last4: picked.cardLast4 ?? '',
                  dept: String(myDept?.id ?? ''),
                  user: myUser?.display_name ?? '',
                  merchant: picked.merchant,
                  detail: '',
                  amount: picked.amount,
                }
                if (emptyIdx >= 0) {
                  list[emptyIdx] = newRow
                } else {
                  list.push(newRow)
                }
                handleContentChange('card_items', JSON.stringify(list))
              }}
              onRemoveItem={(picked) => {
                const content = formState.content as Record<string, unknown>
                const raw = content['card_items']
                let list: Array<Record<string, string>> = []
                try {
                  const parsed = raw ? JSON.parse(String(raw)) : []
                  if (Array.isArray(parsed)) list = parsed
                } catch {}
                const idx = list.findIndex(
                  (r) => r.date === picked.date && Number(r.amount) === Number(picked.amount),
                )
                if (idx < 0) return
                list.splice(idx, 1)
                handleContentChange('card_items', JSON.stringify(list))
              }}
            />
          </aside>
        )}
        </div>

        {/* 하단 액션바 */}
        <div className={f.new_form_footer}>
          <div className={f.new_form_footer_left}>
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
              {editingDraftId ? '수정 저장' : '임시저장'}
            </button>
            <button
              className={styles.btn_secondary}
              onClick={() => setPreviewOpen(true)}
            >
              미리보기
            </button>
            <button
              className={styles.btn_secondary}
              onClick={() => {
                setApproverModalDraft([...formState.approver_ids])
                setOrgSearch('')
                setExpandedDepts(new Set(departments.map(d => String(d.id))))
                setApproverModalOpen(true)
              }}
            >
              결재선추가
            </button>
            <button
              className={styles.btn_secondary}
              onClick={() => {
                setRefModalDraft([...formState.reference_ids])
                setOrgSearch('')
                setExpandedDepts(new Set(departments.map(d => String(d.id))))
                setRefModalOpen(true)
              }}
            >
              참조자추가
            </button>
            <button
              className={styles.btn_secondary}
              onClick={() => {
                setEditingDraftId(null)
                setCurrentView(editingDraftId ? 'list' : 'new_template')
              }}
            >
              취소
            </button>
          </div>
          <div className={f.new_form_footer_right}>
            <select className={f.form_footer_autosave}>
              <option>자동저장안함</option>
              <option>30초마다 저장</option>
              <option>1분마다 저장</option>
            </select>
            <button
              className={styles.btn_secondary}
              onClick={() => {
                setEditingDraftId(null)
                setCurrentView('home')
                setActiveMenuKey('home')
              }}
            >
              목록
            </button>
          </div>
        </div>

        {/* 미리보기 모달 */}
        {previewOpen && (
          <div className={f.preview_overlay} onClick={() => setPreviewOpen(false)}>
            <div className={f.preview_modal} onClick={(e) => e.stopPropagation()}>
              <div className={f.preview_modal_header}>
                <span className={f.preview_modal_title}>미리보기</span>
                <div className={f.preview_modal_header_actions}>
                  <button
                    className={styles.btn_secondary}
                    onClick={() => {
                      setApproverModalDraft([...formState.approver_ids])
                      setOrgSearch('')
                      setExpandedDepts(new Set(departments.map(d => String(d.id))))
                      setApproverModalOpen(true)
                    }}
                  >결재선추가</button>
                  <button
                    className={styles.btn_secondary}
                    onClick={() => {
                      setRefModalDraft([...formState.reference_ids])
                      setOrgSearch('')
                      setExpandedDepts(new Set(departments.map(d => String(d.id))))
                      setRefModalOpen(true)
                    }}
                  >참조자추가</button>
                  <button className={f.preview_modal_close} onClick={() => setPreviewOpen(false)}>
                    <X size={18} />
                  </button>
                </div>
              </div>
              <div className={f.preview_modal_body}>
                <div className={styles.doc_paper}>
                  <h2 className={styles.doc_title}>{formHeadingTitle}</h2>
                  <div className={styles.doc_header_area}>
                    <table className={styles.doc_info_table}>
                      <tbody>
                        <tr><td className={styles.doc_info_label}>작성일자</td><td>{new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })}</td></tr>
                        <tr><td className={styles.doc_info_label}>신청부서</td><td>{departments.find(d => String(d.id) === formState.department_id)?.name ?? '-'}</td></tr>
                        <tr><td className={styles.doc_info_label}>신청자</td><td>{users.find(u => String(u.id) === String(myUserId))?.display_name ?? '-'}</td></tr>
                        {formState.reference_ids.length > 0 && (
                          <tr>
                            <td className={styles.doc_info_label}>참조자</td>
                            <td>
                              <div className={styles.doc_reference_cell}>
                                {formState.reference_ids.map((uid, idx) => {
                                  const u = users.find(x => String(x.id) === uid)
                                  return (
                                    <span key={idx} className={styles.doc_reference_chip}>
                                      {u?.display_name ?? uid}
                                    </span>
                                  )
                                })}
                              </div>
                            </td>
                          </tr>
                        )}
                        <tr><td className={styles.doc_info_label}>제목</td><td>{formState.title}</td></tr>
                      </tbody>
                    </table>
                    <table className={styles.doc_approval_box}>
                      <tbody>
                        <tr>
                          <td className={styles.doc_approval_label} rowSpan={3}>결재선</td>
                          {formState.approver_ids.length > 0 ? formState.approver_ids.map((uid, idx) => (
                            <td key={idx} className={styles.doc_approval_name_cell}>{users.find(u => String(u.id) === uid)?.display_name ?? '-'}</td>
                          )) : <td className={styles.doc_approval_empty_cell}>미지정</td>}
                        </tr>
                        <tr>{formState.approver_ids.length > 0 ? formState.approver_ids.map((_, idx) => <td key={idx} className={styles.doc_approval_status_cell}></td>) : <td className={styles.doc_approval_status_cell}></td>}</tr>
                        <tr>{formState.approver_ids.length > 0 ? formState.approver_ids.map((_, idx) => <td key={idx} className={styles.doc_approval_status_cell}></td>) : <td className={styles.doc_approval_status_cell}></td>}</tr>
                      </tbody>
                    </table>
                  </div>
                  {/* 미리보기 본문 — 레지스트리에서 읽기 전용 렌더 */}
                  {formTemplateConfig && (
                    <formTemplateConfig.BodySection
                      content={formState.content as Record<string, unknown>}
                      departments={departments}
                    />
                  )}
                  {attachedFiles.length > 0 && (
                    <div className={styles.doc_file_attach_section}>
                      <p className={styles.doc_file_attach_title}>파일첨부</p>
                      {attachedFiles.map((file, i) => (
                        <div key={i} className={f.doc_file_row}>
                          <span className={f.doc_file_row_icon}>{file.type.startsWith('image/') ? '🖼' : '📄'}</span>
                          <span className={f.doc_file_row_name}>{file.name}</span>
                          <span className={f.doc_file_row_size}>({(file.size / 1024).toFixed(0)}KB)</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
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

  const filteredTemplates = modalSearch.trim()
    ? templates.filter(t => t.document_type.includes(modalSearch.trim()) || t.category.includes(modalSearch.trim()))
    : modalCategory ? (templatesByCategory[modalCategory] ?? []) : []

  const templateModal = templateModalOpen && typeof document !== 'undefined' ? createPortal(
    <div
      className={styles.tplOverlay}
      onMouseDown={e => { if (e.target === e.currentTarget) setTemplateModalOpen(false) }}
    >
      <div className={styles.tplModal}>
        {/* 헤더 */}
        <div className={styles.tplHeader}>
          <span className={styles.tplTitle}>결재양식 선택</span>
          <button className={styles.tplClose} onClick={() => setTemplateModalOpen(false)} aria-label="닫기">
            <X size={16} />
          </button>
        </div>

        {/* 바디 */}
        <div className={styles.tplBody}>
          {/* 좌측 트리 */}
          <div className={styles.tplLeft}>
            <div className={styles.tplSearch}>
              <input
                className={styles.tplSearchInput}
                placeholder="양식 검색"
                value={modalSearch}
                onChange={e => { setModalSearch(e.target.value); setModalCategory(null) }}
              />
            </div>
            <div className={styles.tplTree}>
              {modalSearch.trim() ? (
                filteredTemplates.map(tpl => (
                  <button
                    key={tpl.id}
                    className={`${styles.tplTreeLeaf} ${modalSelectedTemplate?.id === tpl.id ? styles.tplTreeLeafActive : ''}`}
                    onClick={() => setModalSelectedTemplate(tpl)}
                  >
                    <FileText size={13} />
                    {tpl.document_type}
                  </button>
                ))
              ) : (
                Object.keys(templatesByCategory).map(cat => (
                  <div key={cat} className={styles.tplTreeGroup}>
                    <button
                      className={`${styles.tplTreeCategory} ${modalCategory === cat ? styles.tplTreeCategoryOpen : ''}`}
                      onClick={() => setModalCategory(c => c === cat ? null : cat)}
                    >
                      <ChevronRight size={13} className={`${styles.tplChevron} ${modalCategory === cat ? styles.tplChevronOpen : ''}`} />
                      {cat}
                    </button>
                    {modalCategory === cat && (templatesByCategory[cat] ?? []).map(tpl => (
                      <button
                        key={tpl.id}
                        className={`${styles.tplTreeLeaf} ${modalSelectedTemplate?.id === tpl.id ? styles.tplTreeLeafActive : ''}`}
                        onClick={() => setModalSelectedTemplate(tpl)}
                      >
                        <FileText size={13} />
                        {tpl.document_type}
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 우측 상세 */}
          <div className={styles.tplRight}>
            <p className={styles.tplDetailTitle}>상세정보</p>
            {modalSelectedTemplate ? (
              <div className={styles.tplDetailRows}>
                <div className={styles.tplDetailRow}>
                  <span className={styles.tplDetailLabel}>양식명</span>
                  <span className={styles.tplDetailValue}>{modalSelectedTemplate.document_type}</span>
                </div>
                <div className={styles.tplDetailRow}>
                  <span className={styles.tplDetailLabel}>카테고리</span>
                  <span className={styles.tplDetailValue}>{modalSelectedTemplate.category}</span>
                </div>
                <div className={styles.tplDetailRow}>
                  <span className={styles.tplDetailLabel}>보존연한</span>
                  <span className={styles.tplDetailValue}>5년</span>
                </div>
                <div className={styles.tplDetailRow}>
                  <span className={styles.tplDetailLabel}>소속</span>
                  <div className={styles.tplDetailValue}>
                    <select
                      className={styles.tplDetailSelect}
                      value={modalDepartmentId}
                      onChange={e => setModalDepartmentId(e.target.value)}
                    >
                      <option value="">선택</option>
                      {departments.map(dep => (
                        <option key={dep.id} value={String(dep.id)}>{dep.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ) : (
              <p className={styles.tplDetailEmpty}>좌측에서 양식을 선택하세요.</p>
            )}
          </div>
        </div>

        {/* 푸터 */}
        <div className={styles.tplFooter}>
          <button
            className={styles.tplBtnConfirm}
            onClick={handleTemplateModalConfirm}
            disabled={!modalSelectedTemplate}
          >
            확인
          </button>
          <button className={styles.tplBtnCancel} onClick={() => setTemplateModalOpen(false)}>
            취소
          </button>
        </div>
      </div>
    </div>,
    document.body
  ) : null

  const proposalModal = proposalModalOpen && typeof document !== 'undefined' ? createPortal(
    <div
      className={styles.tplOverlay}
      onMouseDown={e => { if (e.target === e.currentTarget) setProposalModalOpen(false) }}
    >
      <div className={styles.proposalModal}>
        <div className={styles.tplHeader}>
          <span className={styles.tplTitle}>품의서 선택</span>
          <button
            className={styles.tplClose}
            onClick={() => setProposalModalOpen(false)}
            aria-label="닫기"
          >
            <X size={16} />
          </button>
        </div>
        <div className={styles.proposalModalBody}>
          {proposalLoadingCandidates ? (
            <p className={styles.proposalModalEmpty}>불러오는 중...</p>
          ) : proposalCandidates.length === 0 ? (
            <p className={styles.proposalModalEmpty}>연동 가능한 승인 완료 품의서가 없습니다.</p>
          ) : (
            <ul className={styles.proposalList}>
              {proposalCandidates.map(p => {
                const c = (p.content ?? {}) as Record<string, unknown>
                const vendor = c['vendor_name'] ? String(c['vendor_name']) : ''
                const amount = c['amount'] ? Number(c['amount']).toLocaleString() : ''
                return (
                  <li key={p.id} className={styles.proposalItem}>
                    <button
                      type="button"
                      className={styles.proposalItemBtn}
                      onClick={() => applyProposalLink(p)}
                    >
                      <div className={styles.proposalItemTop}>
                        <span className={styles.proposalItemNumber}>
                          {p.document_number ?? '문서번호 없음'}
                        </span>
                        <span className={styles.proposalItemDate}>
                          {p.completed_at ? formatDate(p.completed_at) : formatDate(p.created_at)}
                        </span>
                      </div>
                      <p className={styles.proposalItemTitle}>{p.title}</p>
                      {(vendor || amount) && (
                        <p className={styles.proposalItemMeta}>
                          {vendor && <span>{vendor}</span>}
                          {vendor && amount && <span className={styles.proposalItemDot}>·</span>}
                          {amount && <span>{amount}원</span>}
                        </p>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body
  ) : null

  const linkedProposalModal = linkedProposalView && typeof document !== 'undefined' ? createPortal(
    <div
      className={styles.tplOverlay}
      onMouseDown={e => { if (e.target === e.currentTarget) setLinkedProposalView(null) }}
    >
      <div className={styles.linkedProposalViewModal}>
        <div className={styles.tplHeader}>
          <span className={styles.tplTitle}>
            {linkedProposalView.document_number
              ? `${linkedProposalView.document_number} · ${linkedProposalView.document_type ?? '품의서'}`
              : '품의서 미리보기'}
          </span>
          <button
            className={styles.tplClose}
            onClick={() => setLinkedProposalView(null)}
            aria-label="닫기"
          >
            <X size={16} />
          </button>
        </div>
        <div className={styles.linkedProposalViewBody}>
          {linkedProposalViewLoading || !linkedProposalView.document_type ? (
            <p className={styles.proposalModalEmpty}>불러오는 중...</p>
          ) : (
            <>
              <h3 className={styles.linkedProposalViewTitle}>{linkedProposalView.title}</h3>
              {(() => {
                const cfg = getDocTemplate(linkedProposalView, dynamicConfigs)
                if (!cfg) return <p className={styles.proposalModalEmpty}>표시할 양식이 없습니다.</p>
                const content = (linkedProposalView.content ?? {}) as Record<string, unknown>
                return <cfg.BodySection content={content} departments={departments} />
              })()}
              {(() => {
                const raw = (linkedProposalView.content as Record<string, unknown>)?.['_attachments']
                const files: AttachedFile[] = Array.isArray(raw) ? (raw as AttachedFile[]) : []
                if (!files.length) return null
                return (
                  <div className={styles.linkedProposalViewFiles}>
                    <p className={styles.linkedProposalViewFilesLabel}>품의서 첨부파일</p>
                    {files.map((file, i) => (
                      <div key={i} className={styles.linkedProposalViewFileRow}>
                        <span>{file.type.startsWith('image/') ? '🖼' : file.type === 'application/pdf' ? '📕' : '📄'}</span>
                        <span className={styles.linkedProposalViewFileName}>{file.name}</span>
                        <span className={styles.linkedProposalViewFileSize}>({(file.size / 1024).toFixed(0)}KB)</span>
                        <a href={file.url} download={file.name} className={styles.doc_file_download_btn}>
                          다운로드
                        </a>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  ) : null

  const myUser = users.find(u => String(u.id) === String(myUserId))
  const myDept = departments.find(d => String(d.id) === String(myUser?.department_id))

  const usersByDept = departments.map(dept => ({
    dept,
    members: users.filter(u => String(u.department_id) === String(dept.id)),
  })).filter(g => g.members.length > 0)

  const ungrouped = users.filter(u => !u.department_id || !departments.find(d => String(d.id) === String(u.department_id)))

  const searchedUsers = orgSearch.trim()
    ? users.filter(u => u.display_name.includes(orgSearch.trim()))
    : null

  const approverModal = approverModalOpen && typeof document !== 'undefined' ? createPortal(
    <div className={styles.apmOverlay} onMouseDown={e => { if (e.target === e.currentTarget) setApproverModalOpen(false) }}>
      <div className={styles.apmModal}>
        {/* 헤더 */}
        <div className={styles.apmHeader}>
          <span className={styles.apmTitle}>결재 정보</span>
          <button className={styles.apmClose} onClick={() => setApproverModalOpen(false)}><X size={16} /></button>
        </div>

        {/* 바디 */}
        <div className={styles.apmBody}>
          {/* 좌측 조직도 */}
          <div className={styles.apmLeft}>
            <div className={styles.apmSearch}>
              <input
                className={styles.apmSearchInput}
                placeholder="이름, 부서 검색"
                value={orgSearch}
                onChange={e => setOrgSearch(e.target.value)}
              />
            </div>
            <div className={styles.apmTree}>
              {searchedUsers ? (
                searchedUsers.map(u => {
                  const dept = departments.find(d => String(d.id) === String(u.department_id))
                  const added = approverModalDraft.includes(String(u.id))
                  return (
                    <button
                      key={u.id}
                      draggable={!added}
                      className={`${styles.apmTreeUser} ${added ? styles.apmTreeUserAdded : ''}`}
                      onDragStart={(e) => { e.dataTransfer.setData('apmUserId', String(u.id)); e.dataTransfer.effectAllowed = 'copy'; apmIsDragging.current = true }}
                      onDragEnd={() => { setTimeout(() => { apmIsDragging.current = false }, 0) }}
                      onClick={() => { if (!added && !apmIsDragging.current) setApproverModalDraft(prev => [...prev, String(u.id)]) }}
                    >
                      <div className={styles.apmUserAvatar}>{u.display_name[0]}</div>
                      <div className={styles.apmUserInfo}>
                        <span className={styles.apmUserName}>{u.display_name}</span>
                        {dept && <span className={styles.apmUserDept}>{dept.name}</span>}
                      </div>
                      {added && <CheckCircle size={14} className={styles.apmUserCheck} />}
                    </button>
                  )
                })
              ) : (
                <>
                  {usersByDept.map(({ dept, members }) => (
                    <div key={dept.id} className={styles.apmTreeGroup}>
                      <button
                        className={styles.apmTreeDept}
                        onClick={() => setExpandedDepts(prev => {
                          const s = new Set(prev)
                          s.has(String(dept.id)) ? s.delete(String(dept.id)) : s.add(String(dept.id))
                          return s
                        })}
                      >
                        <ChevronDown size={14} className={`${styles.apmChevron} ${expandedDepts.has(String(dept.id)) ? styles.apmChevronOpen : ''}`} />
                        {dept.name}
                        <span className={styles.apmDeptCount}>{members.length}</span>
                      </button>
                      {expandedDepts.has(String(dept.id)) && members.map(u => {
                        const added = approverModalDraft.includes(String(u.id))
                        return (
                          <button
                            key={u.id}
                            draggable={!added}
                            className={`${styles.apmTreeUser} ${added ? styles.apmTreeUserAdded : ''}`}
                            onDragStart={(e) => { e.dataTransfer.setData('apmUserId', String(u.id)); e.dataTransfer.effectAllowed = 'copy'; apmIsDragging.current = true }}
                      onDragEnd={() => { setTimeout(() => { apmIsDragging.current = false }, 0) }}
                            onClick={() => { if (!added && !apmIsDragging.current) setApproverModalDraft(prev => [...prev, String(u.id)]) }}
                          >
                            <div className={styles.apmUserAvatar}>{u.display_name[0]}</div>
                            <div className={styles.apmUserInfo}>
                              <span className={styles.apmUserName}>{u.display_name}</span>
                            </div>
                            {added && <CheckCircle size={14} className={styles.apmUserCheck} />}
                          </button>
                        )
                      })}
                    </div>
                  ))}
                  {ungrouped.map(u => {
                    const added = approverModalDraft.includes(String(u.id))
                    return (
                      <button
                        key={u.id}
                        draggable={!added}
                        className={`${styles.apmTreeUser} ${added ? styles.apmTreeUserAdded : ''}`}
                        onDragStart={(e) => { e.dataTransfer.setData('apmUserId', String(u.id)); e.dataTransfer.effectAllowed = 'copy'; apmIsDragging.current = true }}
                      onDragEnd={() => { setTimeout(() => { apmIsDragging.current = false }, 0) }}
                        onClick={() => { if (!added && !apmIsDragging.current) setApproverModalDraft(prev => [...prev, String(u.id)]) }}
                      >
                        <div className={styles.apmUserAvatar}>{u.display_name[0]}</div>
                        <div className={styles.apmUserInfo}>
                          <span className={styles.apmUserName}>{u.display_name}</span>
                        </div>
                        {added && <CheckCircle size={14} className={styles.apmUserCheck} />}
                      </button>
                    )
                  })}
                </>
              )}
            </div>
          </div>

          {/* 우측 결재선 테이블 */}
          <div
            className={styles.apmRight}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const userId = e.dataTransfer.getData('apmUserId')
              if (userId && !approverModalDraft.includes(userId)) {
                setApproverModalDraft(prev => [...prev, userId])
              }
              setApmDropBefore(null)
              setApmDraggingRowIdx(null)
            }}
          >
            <table className={styles.apmTable}>
              <thead>
                <tr>
                  <th style={{ width: 32, padding: 0 }}></th>
                  <th>타입</th>
                  <th>이름</th>
                  <th>부서</th>
                  <th>상태</th>
                  <th style={{ width: 32, padding: 0 }}></th>
                </tr>
              </thead>
              <tbody>
                {/* 신청 */}
                <tr className={styles.apmSectionRow}>
                  <td colSpan={6}>신청</td>
                </tr>
                <tr>
                  <td className={styles.apmArrow}><ChevronsRight size={16} /></td>
                  <td><span className={styles.apmTypeLabel}>기안</span></td>
                  <td>{myUser?.display_name ?? '-'}</td>
                  <td>{myDept?.name ?? '-'}</td>
                  <td></td>
                  <td></td>
                </tr>

                {/* 승인 */}
                <tr className={styles.apmSectionRow}>
                  <td colSpan={6}>승인</td>
                </tr>
                {approverModalDraft.length === 0 ? (
                  <tr
                    onDragOver={(e) => { e.preventDefault(); setApmDropBefore(0) }}
                    onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setApmDropBefore(null) }}
                    onDrop={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      const userId = e.dataTransfer.getData('apmUserId')
                      if (userId && !approverModalDraft.includes(userId)) setApproverModalDraft([userId])
                      setApmDropBefore(null)
                    }}
                  >
                    <td className={styles.apmArrow}><ChevronsRight size={16} /></td>
                    <td colSpan={5} className={`${styles.apmEmptyRow} ${apmDropBefore === 0 ? styles.apmEmptyRowDrop : ''}`}>
                      {apmDropBefore === 0 ? '여기에 놓으세요' : '드래그하여 결재선을 추가할 수 있습니다.'}
                    </td>
                  </tr>
                ) : (
                  <>
                    {approverModalDraft.map((uid, idx) => {
                      const u = users.find(x => String(x.id) === uid)
                      const dept = departments.find(d => String(d.id) === String(u?.department_id))
                      return (
                        <tr
                          key={idx}
                          draggable
                          className={`${apmDraggingRowIdx === idx ? styles.apmRowDragging : ''} ${apmDropBefore === idx ? styles.apmRowDropAbove : ''}`}
                          onDragStart={(e) => { e.dataTransfer.setData('apmRowIdx', String(idx)); setApmDraggingRowIdx(idx) }}
                          onDragEnd={() => { setApmDraggingRowIdx(null); setApmDropBefore(null) }}
                          onDragOver={(e) => { e.preventDefault(); setApmDropBefore(idx) }}
                          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setApmDropBefore(null) }}
                          onDrop={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            const userId = e.dataTransfer.getData('apmUserId')
                            const rowIdxStr = e.dataTransfer.getData('apmRowIdx')
                            if (userId && !approverModalDraft.includes(userId)) {
                              const next = [...approverModalDraft]
                              next.splice(idx, 0, userId)
                              setApproverModalDraft(next)
                            } else if (rowIdxStr !== '') {
                              const fromIdx = parseInt(rowIdxStr)
                              if (fromIdx !== idx) {
                                const next = [...approverModalDraft]
                                const [moved] = next.splice(fromIdx, 1)
                                next.splice(fromIdx < idx ? idx - 1 : idx, 0, moved)
                                setApproverModalDraft(next)
                              }
                            }
                            setApmDropBefore(null)
                            setApmDraggingRowIdx(null)
                          }}
                        >
                          <td className={styles.apmArrow}><ChevronsRight size={16} /></td>
                          <td><span className={styles.apmTypeLabel}>결재</span></td>
                          <td>{u?.display_name ?? uid}</td>
                          <td>{dept?.name ?? '-'}</td>
                          <td className={styles.apmStatus}>예정</td>
                          <td>
                            <button
                              className={styles.apmDeleteBtn}
                              onClick={() => setApproverModalDraft(prev => prev.filter((_, i) => i !== idx))}
                            >
                              <X size={13} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                    {/* 마지막 행 아래 드롭존 */}
                    <tr
                      className={styles.apmDropAppendRow}
                      onDragOver={(e) => { e.preventDefault(); setApmDropBefore(approverModalDraft.length) }}
                      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setApmDropBefore(null) }}
                      onDrop={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        const userId = e.dataTransfer.getData('apmUserId')
                        const rowIdxStr = e.dataTransfer.getData('apmRowIdx')
                        if (userId && !approverModalDraft.includes(userId)) {
                          setApproverModalDraft(prev => [...prev, userId])
                        } else if (rowIdxStr !== '') {
                          const fromIdx = parseInt(rowIdxStr)
                          const next = [...approverModalDraft]
                          const [moved] = next.splice(fromIdx, 1)
                          next.push(moved)
                          setApproverModalDraft(next)
                        }
                        setApmDropBefore(null)
                        setApmDraggingRowIdx(null)
                      }}
                    >
                      
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 푸터 */}
        <div className={styles.apmFooter}>
          <div />
          <div className={styles.apmFooterRight}>
            <button
              className={styles.apmBtnConfirm}
              onClick={() => {
                setFormState({ ...formState, approver_ids: approverModalDraft })
                setApproverModalOpen(false)
              }}
            >
              확인
            </button>
            <button className={styles.apmBtnCancel} onClick={() => setApproverModalOpen(false)}>취소</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  ) : null

  const refModal = refModalOpen && typeof document !== 'undefined' ? createPortal(
    <div className={styles.apmOverlay} onMouseDown={e => { if (e.target === e.currentTarget) setRefModalOpen(false) }}>
      <div className={styles.apmModal}>
        <div className={styles.apmHeader}>
          <span className={styles.apmTitle}>참조자 추가</span>
          <button className={styles.apmClose} onClick={() => setRefModalOpen(false)}><X size={16} /></button>
        </div>
        <div className={styles.apmBody}>
          {/* 좌측 조직도 */}
          <div className={styles.apmLeft}>
            <div className={styles.apmSearch}>
              <input
                className={styles.apmSearchInput}
                placeholder="이름, 부서 검색"
                value={orgSearch}
                onChange={e => setOrgSearch(e.target.value)}
              />
            </div>
            <div className={styles.apmTree}>
              {usersByDept.map(({ dept, members }) => (
                <div key={dept.id} className={styles.apmTreeGroup}>
                  <button
                    className={styles.apmTreeDept}
                    onClick={() => setExpandedDepts(prev => {
                      const s = new Set(prev); s.has(String(dept.id)) ? s.delete(String(dept.id)) : s.add(String(dept.id)); return s
                    })}
                  >
                    <ChevronDown size={14} className={`${styles.apmChevron} ${expandedDepts.has(String(dept.id)) ? styles.apmChevronOpen : ''}`} />
                    {dept.name}
                    <span className={styles.apmDeptCount}>{members.length}</span>
                  </button>
                  {expandedDepts.has(String(dept.id)) && members.map(u => {
                    const added = refModalDraft.includes(String(u.id))
                    return (
                      <button
                        key={u.id}
                        draggable={!added}
                        className={`${styles.apmTreeUser} ${added ? styles.apmTreeUserAdded : ''}`}
                        onDragStart={(e) => { e.dataTransfer.setData('apmUserId', String(u.id)); e.dataTransfer.effectAllowed = 'copy'; refIsDragging.current = true }}
                        onDragEnd={() => { setTimeout(() => { refIsDragging.current = false }, 0) }}
                        onClick={() => { if (!added && !refIsDragging.current) setRefModalDraft(prev => [...prev, String(u.id)]) }}
                      >
                        <div className={styles.apmUserAvatar}>{u.display_name[0]}</div>
                        <div className={styles.apmUserInfo}>
                          <span className={styles.apmUserName}>{u.display_name}</span>
                        </div>
                        {added && <CheckCircle size={14} className={styles.apmUserCheck} />}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
          {/* 우측 참조자 목록 */}
          <div
            className={styles.apmRight}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const userId = e.dataTransfer.getData('apmUserId')
              if (userId && !refModalDraft.includes(userId)) setRefModalDraft(prev => [...prev, userId])
            }}
          >
            <table className={styles.apmTable}>
              <thead>
                <tr>
                  <th style={{ width: 32, padding: 0 }}></th>
                  <th>이름</th>
                  <th>부서</th>
                  <th style={{ width: 32, padding: 0 }}></th>
                </tr>
              </thead>
              <tbody>
                {refModalDraft.length === 0 ? (
                  <tr>
                    <td><ChevronsRight size={16} /></td>
                    <td colSpan={3} className={styles.apmEmptyRow}>드래그하여 참조자를 추가할 수 있습니다.</td>
                  </tr>
                ) : refModalDraft.map((uid, idx) => {
                  const u = users.find(x => String(x.id) === uid)
                  const dept = departments.find(d => String(d.id) === String(u?.department_id))
                  return (
                    <tr key={idx}>
                      <td className={styles.apmArrow}><ChevronsRight size={16} /></td>
                      <td>{u?.display_name ?? uid}</td>
                      <td>{dept?.name ?? '-'}</td>
                      <td>
                        <button className={styles.apmDeleteBtn} onClick={() => setRefModalDraft(prev => prev.filter((_, i) => i !== idx))}>
                          <X size={13} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div className={styles.apmFooter}>
          <div />
          <div className={styles.apmFooterRight}>
            <button className={styles.apmBtnConfirm} onClick={() => { setFormState({ ...formState, reference_ids: refModalDraft }); setRefModalOpen(false) }}>확인</button>
            <button className={styles.apmBtnCancel} onClick={() => setRefModalOpen(false)}>취소</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  ) : null

  return (
    <div className={styles.page_layout}>
      {renderSidebar()}
      <main className={styles.main_area}>
        {renderMainContent()}
      </main>
      {templateModal}
      {approverModal}
      {refModal}
      {proposalModal}
      {linkedProposalModal}
    </div>
  )
}
