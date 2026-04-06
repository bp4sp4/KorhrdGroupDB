'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, X, Check, XCircle, ChevronRight, FileText, Clock, CheckCircle, Home, MoreVertical, Info, Eye, Save, Send, List, Paperclip, Download, AlignJustify } from 'lucide-react'
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
import { getDocTemplate, ALL_TEMPLATE_FIELDS } from './docTemplates'

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

interface AttachedFile {
  name: string
  url: string
  type: string
  size: number
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

  // 파일 첨부
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
  const [uploadingFiles, setUploadingFiles] = useState(false)

  // 임시저장 편집 모드
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null)

  const handleContentChange = useCallback((key: string, value: string) => {
    setFormState((prev) => ({ ...prev, content: { ...prev.content, [key]: value } }))
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
    if (!res.ok) return
    const data = await res.json()

    if (data.status === 'DRAFT') {
      // 임시저장 문서 → 편집 폼으로 열기
      const template = templates.find(t => t.id === data.template_id) ?? null
      const rawAttachments = data.content['_attachments']
      const existingAttachments: AttachedFile[] = Array.isArray(rawAttachments) ? (rawAttachments as AttachedFile[]) : []
      const { _attachments, ...restContent } = data.content as Record<string, unknown>
      void _attachments

      setFormState({
        template,
        title: data.title,
        department_id: String(data.department_id ?? ''),
        content: Object.fromEntries(
          Object.entries(restContent).map(([k, v]) => [k, String(v ?? '')])
        ),
        approver_ids: [],
      })
      setAttachedFiles(existingAttachments)
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
    setSelectedCategory(null)
    setFormState({ template: null, title: '', department_id: '', content: {}, approver_ids: [] })
    setFormError('')
    setAttachedFiles([])
    setUploadingFiles(false)
    setEditingDraftId(null)
    setCurrentView('new_template')
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploadingFiles(true)
    const fd = new FormData()
    files.forEach(f => fd.append('files', f))
    const res = await fetch('/api/management/approvals/upload', { method: 'POST', body: fd })
    if (res.ok) {
      const { files: uploaded } = await res.json()
      setAttachedFiles(prev => [...prev, ...(uploaded as AttachedFile[])])
    } else {
      const err = await res.json()
      alert(err.error ?? '파일 업로드 실패')
    }
    setUploadingFiles(false)
    e.target.value = ''
  }

  const removeAttachedFile = (idx: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== idx))
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

    const templateConfig = getDocTemplate(template)
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

    const mergedContent = attachedFiles.length > 0
      ? { ...content, _attachments: attachedFiles }
      : content

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

  const inProgressApprovals = mineApprovals.filter(a =>
    ['SUBMITTED', 'IN_PROGRESS'].includes(a.status)
  )
  const doneApprovals = mineApprovals.filter(a =>
    ['APPROVED', 'REJECTED', 'CANCELLED'].includes(a.status)
  )

  const formTemplateConfig = getDocTemplate(formState.template)

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

              {/* 본문 테이블 — 템플릿 레지스트리에서 자동 처리 */}
              {(() => {
                const cfg = getDocTemplate(selectedApproval)
                if (!cfg) return null
                return (
                  <cfg.BodySection
                    content={selectedApproval.content as Record<string, unknown>}
                  />
                )
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
              {formState.template?.document_type}
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
                setEditingDraftId(null)
                setCurrentView(editingDraftId ? 'list' : 'new_template')
              }}
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

            {/* 본문 테이블 — 템플릿 레지스트리에서 자동 처리 */}
            {formTemplateConfig && (
              <formTemplateConfig.BodySection
                content={formState.content as Record<string, unknown>}
                onChange={handleContentChange}
              />
            )}

            {/* 파일첨부 (supportsAttachments 템플릿만 표시) */}
            {formTemplateConfig?.supportsAttachments && (
              <div className={styles.doc_file_attach_section}>
                <div className={f.doc_file_attach_label_row}>
                  <span className={styles.doc_file_attach_title}>파일첨부</span>
                </div>
                <div className={`${f.doc_file_attach_box} ${uploadingFiles ? f.doc_file_attach_uploading : ''}`}>
                  <label className={f.doc_file_drop_zone}>
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
              <div className={f.doc_approver_chain}>
                {formState.approver_ids.map((uid, idx) => {
                  const u = users.find(x => String(x.id) === uid)
                  return (
                    <div key={idx} className={f.doc_approver_chip}>
                      <div className={f.doc_approver_chip_step}>{idx + 1}</div>
                      <span className={f.doc_approver_chip_name}>{u?.display_name ?? uid}</span>
                      <button
                        className={f.doc_approver_chip_remove}
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
              <div className={f.doc_approver_add_row}>
                <select
                  className={f.doc_approver_add_select}
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
                <button className={f.preview_modal_close} onClick={() => setPreviewOpen(false)}>
                  <X size={18} />
                </button>
              </div>
              <div className={f.preview_modal_body}>
                <div className={styles.doc_paper}>
                  <h2 className={styles.doc_title}>{formState.template?.document_type}</h2>
                  <div className={styles.doc_header_area}>
                    <table className={styles.doc_info_table}>
                      <tbody>
                        <tr><td className={styles.doc_info_label}>작성일자</td><td>{new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })}</td></tr>
                        <tr><td className={styles.doc_info_label}>신청부서</td><td>{departments.find(d => String(d.id) === formState.department_id)?.name ?? '-'}</td></tr>
                        <tr><td className={styles.doc_info_label}>신청자</td><td>{users.find(u => String(u.id) === String(myUserId))?.display_name ?? '-'}</td></tr>
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

  return (
    <div className={styles.page_layout}>
      {renderSidebar()}
      <main className={styles.main_area}>
        {renderMainContent()}
      </main>
    </div>
  )
}
