'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, X, Check, XCircle } from 'lucide-react'
import type { Approval, ApprovalTemplate, Department } from '@/lib/management/types'
import {
  formatDate,
  formatAmount,
  getStatusLabel,
  getStatusColor,
  getStatusBg,
  getPaymentMethodLabel,
} from '@/lib/management/utils'
import styles from './page.module.css'

type Tab = 'mine' | 'pending' | 'completed'

const TABS: { key: Tab; label: string }[] = [
  { key: 'mine', label: '내가 작성한' },
  { key: 'pending', label: '내가 결재할' },
  { key: 'completed', label: '완료' },
]

interface ApprovalFormState {
  step: 'select_type' | 'fill_form'
  template: ApprovalTemplate | null
  title: string
  department_id: string
  content: Record<string, string>
  approver_ids: string[]
  action: 'draft' | 'submit'
}

const EXPENSE_CONTENT_FIELDS = [
  { key: 'expense_date', label: '지출일', type: 'date', required: true },
  { key: 'expense_category', label: '지출 항목', type: 'text', required: true },
  { key: 'expense_detail', label: '세부 내역', type: 'text', required: true },
  { key: 'amount', label: '금액 (원)', type: 'number', required: true },
  { key: 'payment_method', label: '결제 수단', type: 'select', required: true,
    options: [
      { value: 'CORPORATE_CARD', label: '법인카드' },
      { value: 'BANK_TRANSFER', label: '계좌이체' },
      { value: 'CASH', label: '현금' },
      { value: 'OTHER', label: '기타' },
    ]
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

function getContentFields(template: ApprovalTemplate | null) {
  if (!template) return []
  if (template.category === '회계') return EXPENSE_CONTENT_FIELDS
  if (template.category === '출장') return TRAVEL_CONTENT_FIELDS
  return HR_CONTENT_FIELDS
}

export default function ApprovalsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('mine')
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [loading, setLoading] = useState(false)

  const [templates, setTemplates] = useState<ApprovalTemplate[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [users, setUsers] = useState<{ id: string; display_name: string }[]>([])

  const [showNewModal, setShowNewModal] = useState(false)
  const [formState, setFormState] = useState<ApprovalFormState>({
    step: 'select_type',
    template: null,
    title: '',
    department_id: '',
    content: {},
    approver_ids: [],
    action: 'submit',
  })
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [selectedApproval, setSelectedApproval] = useState<Approval | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [actionComment, setActionComment] = useState('')
  const [actioning, setActioning] = useState(false)
  const [myUserId, setMyUserId] = useState<string | null>(null)

  const fetchApprovals = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/management/approvals?tab=${activeTab}`)
    if (res.ok) {
      const data = await res.json()
      setApprovals(data)
    }
    setLoading(false)
  }, [activeTab])

  useEffect(() => { fetchApprovals() }, [fetchApprovals])

  useEffect(() => {
    fetch('/api/management/approvals/templates').then(r => r.json()).then(setTemplates).catch(() => {})
    fetch('/api/management/departments').then(r => r.json()).then(setDepartments).catch(() => {})
    fetch('/api/management/users').then(r => r.json()).then(setUsers).catch(() => {})
    fetch('/api/auth/me').then(r => r.json()).then(d => setMyUserId(d.id ?? null)).catch(() => {})
  }, [])

  const templatesByCategory = templates.reduce<Record<string, ApprovalTemplate[]>>((acc, t) => {
    if (!acc[t.category]) acc[t.category] = []
    acc[t.category].push(t)
    return acc
  }, {})

  const handleSelectTemplate = (tpl: ApprovalTemplate) => {
    setFormState({
      step: 'fill_form',
      template: tpl,
      title: tpl.document_type,
      department_id: '',
      content: {},
      approver_ids: [],
      action: 'submit',
    })
  }

  const handleSubmitNew = async () => {
    const { template, title, content, approver_ids, action, department_id } = formState
    if (!template || !title) { setFormError('필수 항목을 입력해주세요.'); return }

    const contentFields = getContentFields(template)
    for (const f of contentFields) {
      if (f.required && !content[f.key]) {
        setFormError(`'${f.label}'을(를) 입력해주세요.`)
        return
      }
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
      setShowNewModal(false)
      fetchApprovals()
    } else {
      const err = await res.json()
      setFormError(err.error ?? '저장 실패')
    }
  }

  const handleAction = async (action: 'approve' | 'reject') => {
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
      setShowDetailModal(false)
      setActionComment('')
      fetchApprovals()
    } else {
      const err = await res.json()
      alert(err.error ?? '처리 실패')
    }
  }

  const openDetail = async (approval: Approval) => {
    const res = await fetch(`/api/management/approvals/${approval.id}`)
    if (res.ok) {
      const data = await res.json()
      setSelectedApproval(data)
      setShowDetailModal(true)
    }
  }

  const sortedSteps = selectedApproval?.steps?.slice().sort((a, b) => a.step_number - b.step_number) ?? []
  const currentStep = sortedSteps.find(
    (s) => s.step_number === selectedApproval?.current_step && s.status === 'PENDING'
  )
  const canAct = currentStep?.approver_id === myUserId &&
    ['IN_PROGRESS', 'SUBMITTED'].includes(selectedApproval?.status ?? '')

  const contentFields = getContentFields(formState.template)

  return (
    <div className={styles.page_wrap}>
      {/* 헤더 */}
      <div className={styles.page_header}>
        <h2 className={styles.page_title}>전자결재</h2>
        <button className={styles.btn_primary} onClick={() => {
          setFormState({ step: 'select_type', template: null, title: '', department_id: '', content: {}, approver_ids: [], action: 'submit' })
          setFormError('')
          setShowNewModal(true)
        }}>
          <Plus size={14} /> 새 결재
        </button>
      </div>

      {/* 탭 */}
      <div className={styles.tab_bar}>
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`${styles.tab_btn} ${activeTab === t.key ? styles.tab_btn_active : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 목록 */}
      <div className={styles.table_wrap}>
        {loading ? (
          <div className={styles.empty_state}>불러오는 중...</div>
        ) : approvals.length === 0 ? (
          <div className={styles.empty_state}>결재 문서가 없습니다.</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>문서번호</th>
                <th>문서유형</th>
                <th>사업부</th>
                <th>신청자</th>
                <th>상태</th>
                <th>작성일</th>
              </tr>
            </thead>
            <tbody>
              {approvals.map((a) => (
                <tr key={a.id} className={styles.table_row_clickable} onClick={() => openDetail(a)}>
                  <td>
                    <span className={styles.doc_number}>{a.document_number ?? '-'}</span>
                  </td>
                  <td>
                    <p className={styles.doc_type_category}>{a.category}</p>
                    <p className={styles.doc_title}>{a.document_type}</p>
                  </td>
                  <td className={styles.text_secondary}>{a.department?.name ?? '-'}</td>
                  <td>{(a.applicant as { display_name: string } | undefined)?.display_name ?? '-'}</td>
                  <td>
                    <span
                      className={styles.status_badge}
                      style={{ color: getStatusColor(a.status), background: getStatusBg(a.status) }}
                    >
                      {getStatusLabel(a.status)}
                    </span>
                  </td>
                  <td className={styles.text_secondary}>{formatDate(a.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 새 결재 모달 */}
      {showNewModal && (
        <div className={styles.modal_overlay} onClick={(e) => e.target === e.currentTarget && setShowNewModal(false)}>
          <div className={`${styles.modal} ${styles.modal_wide}`}>
            <div className={styles.modal_header}>
              <div>
                <h3 className={styles.modal_title}>
                  {formState.step === 'select_type' ? '결재 문서 유형 선택' : formState.template?.document_type}
                </h3>
                {formState.step === 'fill_form' && (
                  <p className={styles.modal_subtitle}>{formState.template?.category}</p>
                )}
              </div>
              <button className={styles.modal_close} onClick={() => setShowNewModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className={styles.modal_body}>
              {formState.step === 'select_type' ? (
                Object.entries(templatesByCategory).map(([category, tpls]) => (
                  <div key={category} className={styles.doc_category}>
                    <p className={styles.doc_category_label}>{category}</p>
                    <div className={styles.doc_type_grid}>
                      {tpls.map((tpl) => (
                        <button
                          key={tpl.id}
                          className={`${styles.doc_type_chip} ${formState.template?.id === tpl.id ? styles.doc_type_chip_selected : ''}`}
                          onClick={() => handleSelectTemplate(tpl)}
                        >
                          {tpl.document_type}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <>
                  <div className={styles.form_row_2}>
                    <div className={styles.form_row}>
                      <label className={`${styles.form_label} ${styles.form_label_required}`}>제목</label>
                      <input
                        className={styles.form_input}
                        value={formState.title}
                        onChange={(e) => setFormState({ ...formState, title: e.target.value })}
                      />
                    </div>
                    <div className={styles.form_row}>
                      <label className={styles.form_label}>사업부</label>
                      <select
                        className={styles.form_select}
                        value={formState.department_id}
                        onChange={(e) => setFormState({ ...formState, department_id: e.target.value })}
                      >
                        <option value=''>선택</option>
                        {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                  </div>

                  {contentFields.map((f) => (
                    <div key={f.key} className={styles.form_row}>
                      <label className={`${styles.form_label} ${f.required ? styles.form_label_required : ''}`}>
                        {f.label}
                      </label>
                      {f.type === 'textarea' ? (
                        <textarea
                          className={styles.form_textarea}
                          value={formState.content[f.key] ?? ''}
                          onChange={(e) => setFormState({ ...formState, content: { ...formState.content, [f.key]: e.target.value } })}
                        />
                      ) : f.type === 'select' ? (
                        <select
                          className={styles.form_select}
                          value={formState.content[f.key] ?? ''}
                          onChange={(e) => setFormState({ ...formState, content: { ...formState.content, [f.key]: e.target.value } })}
                        >
                          <option value=''>선택</option>
                          {(f as { options?: { value: string; label: string }[] }).options?.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={f.type}
                          className={styles.form_input}
                          value={formState.content[f.key] ?? ''}
                          onChange={(e) => setFormState({ ...formState, content: { ...formState.content, [f.key]: e.target.value } })}
                        />
                      )}
                    </div>
                  ))}

                  {/* 결재자 선택 */}
                  <div className={styles.form_row}>
                    <label className={styles.form_label}>결재자 (순서대로 추가)</label>
                    <div className={styles.approver_list}>
                      {formState.approver_ids.map((uid, idx) => {
                        const u = users.find(x => x.id === uid)
                        return (
                          <div key={idx} className={styles.approver_item}>
                            <div className={styles.approver_step_num}>{idx + 1}</div>
                            <span className={styles.approver_label}>{u?.display_name ?? uid}</span>
                            <button
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--toss-text-tertiary)' }}
                              onClick={() => setFormState({ ...formState, approver_ids: formState.approver_ids.filter((_, i) => i !== idx) })}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        )
                      })}
                      <select
                        className={styles.form_select}
                        value=''
                        onChange={(e) => {
                          if (e.target.value && !formState.approver_ids.includes(e.target.value)) {
                            setFormState({ ...formState, approver_ids: [...formState.approver_ids, e.target.value] })
                          }
                        }}
                      >
                        <option value=''>+ 결재자 추가</option>
                        {users.map((u) => <option key={u.id} value={u.id}>{u.display_name}</option>)}
                      </select>
                    </div>
                  </div>

                  {formError && <p className={styles.error_msg}>{formError}</p>}
                </>
              )}
            </div>

            {formState.step === 'fill_form' && (
              <div className={styles.modal_footer}>
                <button className={styles.btn_secondary} onClick={() => setFormState({ ...formState, step: 'select_type' })}>
                  이전
                </button>
                <button
                  className={styles.btn_secondary}
                  onClick={() => { setFormState({ ...formState, action: 'draft' }); handleSubmitNew() }}
                  disabled={submitting}
                >
                  임시저장
                </button>
                <button
                  className={styles.btn_primary}
                  onClick={() => { setFormState((p) => ({ ...p, action: 'submit' })); handleSubmitNew() }}
                  disabled={submitting || formState.approver_ids.length === 0}
                >
                  {submitting ? '처리 중...' : '상신'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 결재 상세 모달 */}
      {showDetailModal && selectedApproval && (
        <div className={styles.modal_overlay} onClick={(e) => e.target === e.currentTarget && setShowDetailModal(false)}>
          <div className={`${styles.modal} ${styles.modal_wide}`}>
            <div className={styles.modal_header}>
              <div>
                <h3 className={styles.modal_title}>{selectedApproval.document_type}</h3>
                <p className={styles.modal_subtitle}>{selectedApproval.document_number ?? '미상신'}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  className={styles.status_badge}
                  style={{ color: getStatusColor(selectedApproval.status), background: getStatusBg(selectedApproval.status) }}
                >
                  {getStatusLabel(selectedApproval.status)}
                </span>
                <button className={styles.modal_close} onClick={() => setShowDetailModal(false)}>
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className={styles.modal_body}>
              {/* 메타 정보 */}
              <div className={styles.detail_meta}>
                <div className={styles.detail_meta_item}>
                  <span className={styles.detail_meta_label}>신청자</span>
                  <span className={styles.detail_meta_value}>
                    {(selectedApproval.applicant as { display_name: string } | undefined)?.display_name ?? '-'}
                  </span>
                </div>
                <div className={styles.detail_meta_item}>
                  <span className={styles.detail_meta_label}>사업부</span>
                  <span className={styles.detail_meta_value}>{selectedApproval.department?.name ?? '-'}</span>
                </div>
                <div className={styles.detail_meta_item}>
                  <span className={styles.detail_meta_label}>작성일</span>
                  <span className={styles.detail_meta_value}>{formatDate(selectedApproval.created_at)}</span>
                </div>
                {selectedApproval.submitted_at && (
                  <div className={styles.detail_meta_item}>
                    <span className={styles.detail_meta_label}>상신일</span>
                    <span className={styles.detail_meta_value}>{formatDate(selectedApproval.submitted_at)}</span>
                  </div>
                )}
              </div>

              {/* 문서 내용 */}
              {Object.keys(selectedApproval.content).length > 0 && (
                <div className={styles.content_section}>
                  <p className={styles.content_section_title}>문서 내용</p>
                  <div className={styles.content_grid}>
                    {Object.entries(selectedApproval.content).map(([key, val]) => {
                      const fieldDef = [...EXPENSE_CONTENT_FIELDS, ...TRAVEL_CONTENT_FIELDS, ...HR_CONTENT_FIELDS]
                        .find(f => f.key === key)
                      const label = fieldDef?.label ?? key
                      let display = String(val)
                      if (key === 'amount') display = formatAmount(Number(val))
                      if (key === 'payment_method') display = getPaymentMethodLabel(String(val))
                      return (
                        <div key={key} className={styles.content_item}>
                          <span className={styles.content_item_label}>{label}</span>
                          <span className={styles.content_item_value}>{display}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* 결재선 */}
              {sortedSteps.length > 0 && (
                <div className={styles.content_section}>
                  <p className={styles.content_section_title}>결재선</p>
                  <div className={styles.steps_timeline}>
                    {sortedSteps.map((step) => (
                      <div key={step.id} className={styles.step_item}>
                        <div className={`${styles.step_icon_wrap} ${
                          step.status === 'APPROVED' ? styles.step_icon_approved
                          : step.status === 'REJECTED' ? styles.step_icon_rejected
                          : styles.step_icon_pending
                        }`}>
                          {step.status === 'APPROVED' ? '✓' : step.status === 'REJECTED' ? '✗' : step.step_number}
                        </div>
                        <div className={styles.step_content}>
                          <p className={styles.step_name}>
                            {step.step_number}단계 — {(step.approver as { display_name: string } | undefined)?.display_name ?? '-'}
                          </p>
                          <p className={styles.step_time}>
                            {step.status === 'PENDING' ? '대기 중'
                              : step.status === 'APPROVED' ? `승인 · ${step.acted_at ? formatDate(step.acted_at) : ''}`
                              : `반려 · ${step.acted_at ? formatDate(step.acted_at) : ''}`}
                          </p>
                          {step.comment && (
                            <div className={styles.step_comment}>{step.comment}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 결재 액션 */}
              {canAct && (
                <div className={styles.comment_wrap}>
                  <label className={styles.comment_label}>결재 의견 (선택)</label>
                  <textarea
                    className={styles.form_textarea}
                    placeholder='결재 의견을 입력하세요. 반려 시 필수입니다.'
                    value={actionComment}
                    onChange={(e) => setActionComment(e.target.value)}
                  />
                </div>
              )}
            </div>

            {canAct && (
              <div className={styles.modal_footer}>
                <button className={styles.btn_secondary} onClick={() => setShowDetailModal(false)}>닫기</button>
                <button
                  className={styles.btn_danger}
                  onClick={() => handleAction('reject')}
                  disabled={actioning}
                >
                  <XCircle size={14} /> 반려
                </button>
                <button
                  className={styles.btn_primary}
                  onClick={() => handleAction('approve')}
                  disabled={actioning}
                >
                  <Check size={14} /> 승인
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
