'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, X, Trash2, Pencil, RotateCcw, UserPlus } from 'lucide-react'
import styles from './page.module.css'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Department {
  id: string
  code: string
  name: string
  is_active: boolean
  sort_order: number
}

interface Position {
  id: string
  name: string
  sort_order: number
  is_active: boolean
}

interface ExpenseCategory {
  id: string
  name: string
  sort_order: number
  is_active: boolean
}

interface ApprovalStep {
  step: number
  type: 'APPLICANT' | 'SPECIFIC_PERSON'
  user_id?: string
  label: string
}

interface ApprovalTemplate {
  id: string
  document_type: string
  category: string
  steps: ApprovalStep[]
  is_active: boolean
}

interface AppUser {
  id: string
  display_name: string
}

// ─── Account Type ─────────────────────────────────────────────────────────────

type AccountRole = 'master-admin' | 'admin' | 'mini-admin' | 'staff'

interface Account {
  id: string
  username: string
  display_name: string | null
  role: AccountRole
  is_active: boolean
  created_at: string
  position_id: string | null
  department_id: string | null
  phone: string | null
}

interface AccountForm {
  email: string
  password: string
  display_name: string
  role: AccountRole
  position_id: string
  department_id: string
  phone: string
}

const emptyAccountForm: AccountForm = {
  email: '',
  password: '',
  display_name: '',
  role: 'staff',
  position_id: '',
  department_id: '',
  phone: '',
}

const ROLE_LABELS: Record<AccountRole, string> = {
  'master-admin': '마스터 어드민',
  admin: '어드민',
  'mini-admin': '미니 어드민',
  staff: '없음',
}

// ─── Tab Type ─────────────────────────────────────────────────────────────────

type TabKey = 'departments' | 'positions' | 'expense-categories' | 'approval-templates' | 'accounts' | 'permissions'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'departments', label: '사업부' },
  { key: 'positions', label: '직급' },
  { key: 'expense-categories', label: '지출 분류' },
  { key: 'approval-templates', label: '결재선 템플릿' },
  { key: 'accounts', label: '계정 관리' },
  { key: 'permissions', label: '권한 관리' },
]

const CATEGORIES = ['출장', '인사', '회계']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCategoryStyle(category: string) {
  if (category === '인사') return styles.categoryBadgeHR
  if (category === '회계') return styles.categoryBadgeAccounting
  return ''
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // URL의 tab 파라미터로 초기 탭 결정 (사이드바 '계정 관리' 링크 지원)
  const tabParam = searchParams.get('tab')
  const initialTab: TabKey =
    tabParam === 'accounts' ? 'accounts' : 'departments'

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab)
  const [visitedTabs, setVisitedTabs] = useState<Set<TabKey>>(new Set([initialTab]))

  const handleTabChange = (key: TabKey) => {
    setActiveTab(key)
    setVisitedTabs(prev => new Set([...prev, key]))
    // accounts 탭 선택 시 URL에 파라미터 반영
    if (key === 'accounts') {
      router.replace('/admin?tab=accounts', { scroll: false })
    } else {
      router.replace('/admin', { scroll: false })
    }
  }

  return (
    <div className={styles.pageWrap}>
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>관리자 설정</h2>
      </div>

      <div className={styles.tabBar}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`${styles.tabBtn} ${activeTab === tab.key ? styles.tabBtnActive : ''}`}
            onClick={() => handleTabChange(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {visitedTabs.has('departments') && (
        <div className={activeTab !== 'departments' ? styles.tabHidden : undefined}>
          <DepartmentsTab />
        </div>
      )}
      {visitedTabs.has('positions') && (
        <div className={activeTab !== 'positions' ? styles.tabHidden : undefined}>
          <PositionsTab />
        </div>
      )}
      {visitedTabs.has('expense-categories') && (
        <div className={activeTab !== 'expense-categories' ? styles.tabHidden : undefined}>
          <ExpenseCategoriesTab />
        </div>
      )}
      {visitedTabs.has('approval-templates') && (
        <div className={activeTab !== 'approval-templates' ? styles.tabHidden : undefined}>
          <ApprovalTemplatesTab />
        </div>
      )}
      {visitedTabs.has('accounts') && (
        <div className={activeTab !== 'accounts' ? styles.tabHidden : undefined}>
          <AccountsTab />
        </div>
      )}
      {visitedTabs.has('permissions') && (
        <div className={activeTab !== 'permissions' ? styles.tabHidden : undefined}>
          <PermissionsTab />
        </div>
      )}
    </div>
  )
}

// ─── Departments Tab ──────────────────────────────────────────────────────────

interface DeptForm {
  code: string
  name: string
}

const emptyDeptForm: DeptForm = { code: '', name: '' }

function DepartmentsTab() {
  const [items, setItems] = useState<Department[]>([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<Department | null>(null)
  const [form, setForm] = useState<DeptForm>(emptyDeptForm)
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/departments')
    if (res.ok) setItems(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchItems() }, [fetchItems])

  const openAdd = () => {
    setEditTarget(null)
    setForm(emptyDeptForm)
    setFormError('')
    setShowModal(true)
  }

  const openEdit = (item: Department) => {
    setEditTarget(item)
    setForm({ code: item.code, name: item.name })
    setFormError('')
    setShowModal(true)
  }

  const handleSubmit = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      setFormError('코드와 사업부명을 입력해주세요.')
      return
    }
    setSubmitting(true)
    setFormError('')

    const url = editTarget ? `/api/admin/departments/${editTarget.id}` : '/api/admin/departments'
    const method = editTarget ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    setSubmitting(false)
    if (res.ok) {
      setShowModal(false)
      fetchItems()
    } else {
      const err = await res.json()
      setFormError(err.error ?? '저장에 실패했습니다.')
    }
  }

  const handleToggleActive = async (item: Department) => {
    const res = await fetch(`/api/admin/departments/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !item.is_active }),
    })
    if (res.ok) fetchItems()
  }

  return (
    <>
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>사업부 관리</h3>
          <button className={styles.btnPrimary} onClick={openAdd}>
            <Plus size={14} /> 추가
          </button>
        </div>

        {loading ? (
          <div className={styles.emptyState}>불러오는 중...</div>
        ) : items.length === 0 ? (
          <div className={styles.emptyState}>등록된 사업부가 없습니다.</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>코드</th>
                <th>사업부명</th>
                <th>상태</th>
                <th>액션</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className={!item.is_active ? styles.rowInactive : ''}>
                  <td><code>{item.code}</code></td>
                  <td>{item.name}</td>
                  <td>
                    <span className={`${styles.statusBadge} ${item.is_active ? styles.statusActive : styles.statusInactive}`}>
                      {item.is_active ? '활성' : '비활성'}
                    </span>
                  </td>
                  <td>
                    <div className={styles.actionGroup}>
                      <button className={styles.btnEdit} onClick={() => openEdit(item)}>
                        <Pencil size={12} /> 수정
                      </button>
                      {item.is_active ? (
                        <button className={styles.btnDelete} onClick={() => handleToggleActive(item)}>
                          <Trash2 size={12} /> 비활성화
                        </button>
                      ) : (
                        <button className={styles.btnRestore} onClick={() => handleToggleActive(item)}>
                          <RotateCcw size={12} /> 복원
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className={styles.modalOverlay} onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>{editTarget ? '사업부 수정' : '사업부 추가'}</h3>
              <button className={styles.modalClose} onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formRow2}>
                <div className={styles.formRow}>
                  <label className={`${styles.formLabel} ${styles.formLabelRequired}`}>코드</label>
                  <input
                    className={styles.formInput}
                    placeholder="예: MGT"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className={styles.formRow}>
                  <label className={`${styles.formLabel} ${styles.formLabelRequired}`}>사업부명</label>
                  <input
                    className={styles.formInput}
                    placeholder="예: 경영지원본부"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
              </div>
              {formError && <p className={styles.errorMsg}>{formError}</p>}
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnSecondary} onClick={() => setShowModal(false)}>취소</button>
              <button className={styles.btnPrimary} onClick={handleSubmit} disabled={submitting}>
                {submitting ? '저장 중...' : editTarget ? '수정' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Positions Tab ────────────────────────────────────────────────────────────

interface PositionForm {
  name: string
  sort_order: string
}

const emptyPositionForm: PositionForm = { name: '', sort_order: '' }

function PositionsTab() {
  const [items, setItems] = useState<Position[]>([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<Position | null>(null)
  const [form, setForm] = useState<PositionForm>(emptyPositionForm)
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/positions')
    if (res.ok) setItems(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchItems() }, [fetchItems])

  const openAdd = () => {
    setEditTarget(null)
    setForm(emptyPositionForm)
    setFormError('')
    setShowModal(true)
  }

  const openEdit = (item: Position) => {
    setEditTarget(item)
    setForm({ name: item.name, sort_order: String(item.sort_order) })
    setFormError('')
    setShowModal(true)
  }

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.sort_order) {
      setFormError('직급명과 순서를 입력해주세요.')
      return
    }
    setSubmitting(true)
    setFormError('')

    const payload = { name: form.name.trim(), sort_order: Number(form.sort_order) }
    const url = editTarget ? `/api/admin/positions/${editTarget.id}` : '/api/admin/positions'
    const method = editTarget ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    setSubmitting(false)
    if (res.ok) {
      setShowModal(false)
      fetchItems()
    } else {
      const err = await res.json()
      setFormError(err.error ?? '저장에 실패했습니다.')
    }
  }

  const handleToggleActive = async (item: Position) => {
    const res = await fetch(`/api/admin/positions/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !item.is_active }),
    })
    if (res.ok) fetchItems()
  }

  return (
    <>
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>직급 관리</h3>
          <button className={styles.btnPrimary} onClick={openAdd}>
            <Plus size={14} /> 추가
          </button>
        </div>

        {loading ? (
          <div className={styles.emptyState}>불러오는 중...</div>
        ) : items.length === 0 ? (
          <div className={styles.emptyState}>등록된 직급이 없습니다.</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>순서</th>
                <th>직급명</th>
                <th>상태</th>
                <th>액션</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className={!item.is_active ? styles.rowInactive : ''}>
                  <td>{item.sort_order}</td>
                  <td>{item.name}</td>
                  <td>
                    <span className={`${styles.statusBadge} ${item.is_active ? styles.statusActive : styles.statusInactive}`}>
                      {item.is_active ? '활성' : '비활성'}
                    </span>
                  </td>
                  <td>
                    <div className={styles.actionGroup}>
                      <button className={styles.btnEdit} onClick={() => openEdit(item)}>
                        <Pencil size={12} /> 수정
                      </button>
                      {item.is_active ? (
                        <button className={styles.btnDelete} onClick={() => handleToggleActive(item)}>
                          <Trash2 size={12} /> 비활성화
                        </button>
                      ) : (
                        <button className={styles.btnRestore} onClick={() => handleToggleActive(item)}>
                          <RotateCcw size={12} /> 복원
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className={styles.modalOverlay} onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>{editTarget ? '직급 수정' : '직급 추가'}</h3>
              <button className={styles.modalClose} onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formRow2}>
                <div className={styles.formRow}>
                  <label className={`${styles.formLabel} ${styles.formLabelRequired}`}>직급명</label>
                  <input
                    className={styles.formInput}
                    placeholder="예: 대리"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className={styles.formRow}>
                  <label className={`${styles.formLabel} ${styles.formLabelRequired}`}>순서</label>
                  <input
                    type="number"
                    className={styles.formInput}
                    placeholder="예: 3"
                    value={form.sort_order}
                    onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                  />
                </div>
              </div>
              {formError && <p className={styles.errorMsg}>{formError}</p>}
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnSecondary} onClick={() => setShowModal(false)}>취소</button>
              <button className={styles.btnPrimary} onClick={handleSubmit} disabled={submitting}>
                {submitting ? '저장 중...' : editTarget ? '수정' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Expense Categories Tab ───────────────────────────────────────────────────

interface CategoryForm {
  name: string
  sort_order: string
}

const emptyCategoryForm: CategoryForm = { name: '', sort_order: '' }

function ExpenseCategoriesTab() {
  const [items, setItems] = useState<ExpenseCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<ExpenseCategory | null>(null)
  const [form, setForm] = useState<CategoryForm>(emptyCategoryForm)
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/expense-categories')
    if (res.ok) setItems(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { fetchItems() }, [fetchItems])

  const openAdd = () => {
    setEditTarget(null)
    setForm(emptyCategoryForm)
    setFormError('')
    setShowModal(true)
  }

  const openEdit = (item: ExpenseCategory) => {
    setEditTarget(item)
    setForm({ name: item.name, sort_order: String(item.sort_order) })
    setFormError('')
    setShowModal(true)
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setFormError('분류명을 입력해주세요.')
      return
    }
    setSubmitting(true)
    setFormError('')

    const payload = { name: form.name.trim(), sort_order: Number(form.sort_order) || 0 }
    const url = editTarget ? `/api/admin/expense-categories/${editTarget.id}` : '/api/admin/expense-categories'
    const method = editTarget ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    setSubmitting(false)
    if (res.ok) {
      setShowModal(false)
      fetchItems()
    } else {
      const err = await res.json()
      setFormError(err.error ?? '저장에 실패했습니다.')
    }
  }

  const handleToggleActive = async (item: ExpenseCategory) => {
    const res = await fetch(`/api/admin/expense-categories/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !item.is_active }),
    })
    if (res.ok) fetchItems()
  }

  return (
    <>
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>지출 분류</h3>
          <button className={styles.btnPrimary} onClick={openAdd}>
            <Plus size={14} /> 추가
          </button>
        </div>

        {loading ? (
          <div className={styles.emptyState}>불러오는 중...</div>
        ) : items.length === 0 ? (
          <div className={styles.emptyState}>등록된 지출 분류가 없습니다.</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>순서</th>
                <th>분류명</th>
                <th>상태</th>
                <th>액션</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className={!item.is_active ? styles.rowInactive : ''}>
                  <td>{item.sort_order}</td>
                  <td>{item.name}</td>
                  <td>
                    <span className={`${styles.statusBadge} ${item.is_active ? styles.statusActive : styles.statusInactive}`}>
                      {item.is_active ? '활성' : '비활성'}
                    </span>
                  </td>
                  <td>
                    <div className={styles.actionGroup}>
                      <button className={styles.btnEdit} onClick={() => openEdit(item)}>
                        <Pencil size={12} /> 수정
                      </button>
                      {item.is_active ? (
                        <button className={styles.btnDelete} onClick={() => handleToggleActive(item)}>
                          <Trash2 size={12} /> 비활성화
                        </button>
                      ) : (
                        <button className={styles.btnRestore} onClick={() => handleToggleActive(item)}>
                          <RotateCcw size={12} /> 복원
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className={styles.modalOverlay} onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>{editTarget ? '지출 분류 수정' : '지출 분류 추가'}</h3>
              <button className={styles.modalClose} onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formRow2}>
                <div className={styles.formRow}>
                  <label className={`${styles.formLabel} ${styles.formLabelRequired}`}>분류명</label>
                  <input
                    className={styles.formInput}
                    placeholder="예: 광고비"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className={styles.formRow}>
                  <label className={styles.formLabel}>순서</label>
                  <input
                    type="number"
                    className={styles.formInput}
                    placeholder="예: 1"
                    value={form.sort_order}
                    onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                  />
                </div>
              </div>
              {formError && <p className={styles.errorMsg}>{formError}</p>}
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnSecondary} onClick={() => setShowModal(false)}>취소</button>
              <button className={styles.btnPrimary} onClick={handleSubmit} disabled={submitting}>
                {submitting ? '저장 중...' : editTarget ? '수정' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Approval Templates Tab ───────────────────────────────────────────────────

interface TemplateForm {
  document_type: string
  category: string
  steps: ApprovalStep[]
}

function makeDefaultSteps(): ApprovalStep[] {
  return [
    { step: 1, type: 'APPLICANT', label: '신청자' },
    { step: 2, type: 'SPECIFIC_PERSON', user_id: '', label: '' },
  ]
}

function ApprovalTemplatesTab() {
  const [items, setItems] = useState<ApprovalTemplate[]>([])
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<ApprovalTemplate | null>(null)
  const [form, setForm] = useState<TemplateForm>({ document_type: '', category: '출장', steps: makeDefaultSteps() })
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/approval-templates')
    if (res.ok) setItems(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchItems()
    fetch('/api/management/users')
      .then((r) => r.ok ? r.json() : [])
      .then(setUsers)
      .catch(() => {})
  }, [fetchItems])

  const openAdd = () => {
    setEditTarget(null)
    setForm({ document_type: '', category: '출장', steps: makeDefaultSteps() })
    setFormError('')
    setShowModal(true)
  }

  const openEdit = (item: ApprovalTemplate) => {
    setEditTarget(item)
    setForm({
      document_type: item.document_type,
      category: item.category,
      steps: item.steps.map((s) => ({ ...s })),
    })
    setFormError('')
    setShowModal(true)
  }

  const handleSubmit = async () => {
    if (!form.document_type.trim()) {
      setFormError('문서 유형을 입력해주세요.')
      return
    }
    // 2번 이후 단계에서 사용자가 미선택인 경우 검증
    const invalidStep = form.steps.find(
      (s) => s.type === 'SPECIFIC_PERSON' && !s.user_id
    )
    if (invalidStep) {
      setFormError(`${invalidStep.step}단계 결재자를 선택해주세요.`)
      return
    }

    setSubmitting(true)
    setFormError('')

    // label을 사용자 display_name으로 자동 설정
    const stepsWithLabel = form.steps.map((s) => {
      if (s.type === 'APPLICANT') return { ...s, label: '신청자' }
      const user = users.find((u) => u.id === s.user_id)
      return { ...s, label: user?.display_name ?? '' }
    })

    const payload = { document_type: form.document_type.trim(), category: form.category, steps: stepsWithLabel }
    const url = editTarget ? `/api/admin/approval-templates/${editTarget.id}` : '/api/admin/approval-templates'
    const method = editTarget ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    setSubmitting(false)
    if (res.ok) {
      setShowModal(false)
      fetchItems()
    } else {
      const err = await res.json()
      setFormError(err.error ?? '저장에 실패했습니다.')
    }
  }

  const handleToggleActive = async (item: ApprovalTemplate) => {
    const method = item.is_active ? 'DELETE' : 'PATCH'
    const body = item.is_active ? undefined : JSON.stringify({ is_active: true })
    const res = await fetch(`/api/admin/approval-templates/${item.id}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body,
    })
    if (res.ok) fetchItems()
  }

  // Steps editor helpers
  const updateStep = (index: number, patch: Partial<ApprovalStep>) => {
    setForm((prev) => {
      const steps = prev.steps.map((s, i) => i === index ? { ...s, ...patch } : s)
      return { ...prev, steps }
    })
  }

  const addStep = () => {
    setForm((prev) => ({
      ...prev,
      steps: [
        ...prev.steps,
        { step: prev.steps.length + 1, type: 'SPECIFIC_PERSON', user_id: '', label: '' },
      ],
    }))
  }

  const removeStep = (index: number) => {
    setForm((prev) => {
      const steps = prev.steps
        .filter((_, i) => i !== index)
        .map((s, i) => ({ ...s, step: i + 1 }))
      return { ...prev, steps }
    })
  }

  return (
    <>
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>결재선 템플릿</h3>
          <button className={styles.btnPrimary} onClick={openAdd}>
            <Plus size={14} /> 추가
          </button>
        </div>

        {loading ? (
          <div className={styles.emptyState}>불러오는 중...</div>
        ) : items.length === 0 ? (
          <div className={styles.emptyState}>등록된 결재선 템플릿이 없습니다.</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>문서 유형</th>
                <th>카테고리</th>
                <th>결재 단계</th>
                <th>상태</th>
                <th>액션</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className={!item.is_active ? styles.rowInactive : ''}>
                  <td>{item.document_type}</td>
                  <td>
                    <span className={`${styles.categoryBadge} ${getCategoryStyle(item.category)}`}>
                      {item.category}
                    </span>
                  </td>
                  <td>
                    <div className={styles.stepsSummary}>
                      {item.steps.map((s, i) => {
                        const resolvedName = s.type === 'APPLICANT'
                          ? '신청자'
                          : (users.find((u) => u.id === s.user_id)?.display_name ?? '-')
                        return (
                          <span key={s.step}>
                            <span className={styles.stepChip}>{resolvedName}</span>
                            {i < item.steps.length - 1 && <span className={styles.stepArrow}>›</span>}
                          </span>
                        )
                      })}
                    </div>
                  </td>
                  <td>
                    <span className={`${styles.statusBadge} ${item.is_active ? styles.statusActive : styles.statusInactive}`}>
                      {item.is_active ? '활성' : '비활성'}
                    </span>
                  </td>
                  <td>
                    <div className={styles.actionGroup}>
                      <button className={styles.btnEdit} onClick={() => openEdit(item)}>
                        <Pencil size={12} /> 수정
                      </button>
                      {item.is_active ? (
                        <button className={styles.btnDelete} onClick={() => handleToggleActive(item)}>
                          <Trash2 size={12} /> 비활성화
                        </button>
                      ) : (
                        <button className={styles.btnRestore} onClick={() => handleToggleActive(item)}>
                          <RotateCcw size={12} /> 복원
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className={styles.modalOverlay} onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className={`${styles.modal} ${styles.modalLarge}`}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>{editTarget ? '결재선 템플릿 수정' : '결재선 템플릿 추가'}</h3>
              <button className={styles.modalClose} onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formRow2}>
                <div className={styles.formRow}>
                  <label className={`${styles.formLabel} ${styles.formLabelRequired}`}>문서 유형명</label>
                  <input
                    className={styles.formInput}
                    placeholder="예: 출장신청서"
                    value={form.document_type}
                    onChange={(e) => setForm({ ...form, document_type: e.target.value })}
                  />
                </div>
                <div className={styles.formRow}>
                  <label className={`${styles.formLabel} ${styles.formLabelRequired}`}>카테고리</label>
                  <select
                    className={styles.formSelect}
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className={styles.stepsEditor}>
                <span className={styles.stepsEditorLabel}>결재 단계</span>
                {form.steps.map((step, index) => (
                  <div key={step.step} className={styles.stepRow}>
                    <span className={`${styles.stepNum} ${index === 0 ? styles.stepNumFirst : ''}`}>
                      {step.step}
                    </span>
                    <span className={styles.stepLabel}>
                      {index === 0 ? '신청자' : `${step.step}단계`}
                    </span>
                    {index === 0 ? (
                      <input
                        className={styles.stepInput}
                        value="신청자 (자동)"
                        disabled
                      />
                    ) : (
                      <select
                        className={styles.stepSelect}
                        value={step.user_id ?? ''}
                        onChange={(e) => updateStep(index, { user_id: e.target.value })}
                      >
                        <option value="">결재자 선택</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>{u.display_name}</option>
                        ))}
                      </select>
                    )}
                    {index > 0 && (
                      <button className={styles.btnRemoveStep} onClick={() => removeStep(index)}>
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
                <button className={styles.btnAddStep} onClick={addStep}>
                  <Plus size={12} /> 단계 추가
                </button>
              </div>

              {formError && <p className={styles.errorMsg}>{formError}</p>}
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnSecondary} onClick={() => setShowModal(false)}>취소</button>
              <button className={styles.btnPrimary} onClick={handleSubmit} disabled={submitting}>
                {submitting ? '저장 중...' : editTarget ? '수정' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Accounts Tab ─────────────────────────────────────────────────────────────

interface Position { id: string; name: string; sort_order: number }
interface Department { id: string; name: string; code: string; is_active: boolean }

function AccountsTab() {
  const [items, setItems] = useState<Account[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<Account | null>(null)
  const [form, setForm] = useState<AccountForm>(emptyAccountForm)
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/accounts')
    if (res.ok) setItems(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchItems()
    fetch('/api/admin/positions').then(r => r.ok ? r.json() : []).then(setPositions).catch(() => {})
    fetch('/api/admin/departments').then(r => r.ok ? r.json() : []).then(setDepartments).catch(() => {})
  }, [fetchItems])

  const openAdd = () => {
    setEditTarget(null)
    setForm(emptyAccountForm)
    setFormError('')
    setShowModal(true)
  }

  const openEdit = (item: Account) => {
    setEditTarget(item)
    setForm({
      email: item.username,
      password: '',
      display_name: item.display_name ?? '',
      role: item.role,
      position_id: item.position_id ?? '',
      department_id: item.department_id ?? '',
      phone: item.phone ?? '',
    })
    setFormError('')
    setShowModal(true)
  }

  const handleSubmit = async () => {
    if (!form.display_name.trim()) {
      setFormError('표시이름은 필수입니다.')
      return
    }
    if (!editTarget && (!form.email.trim() || !form.password.trim())) {
      setFormError('이메일과 비밀번호는 필수입니다.')
      return
    }
    setSubmitting(true)
    setFormError('')

    let res: Response
    if (editTarget) {
      res = await fetch(`/api/admin/accounts/${editTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: form.display_name.trim(),
          role: form.role,
          position_id: form.position_id || null,
          department_id: form.department_id || null,
          phone: form.phone.trim() || null,
        }),
      })
    } else {
      res = await fetch('/api/admin/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email.trim(),
          password: form.password,
          display_name: form.display_name.trim(),
          role: form.role,
          position_id: form.position_id || null,
          department_id: form.department_id || null,
          phone: form.phone.trim() || null,
        }),
      })
    }

    setSubmitting(false)
    if (res.ok) {
      setShowModal(false)
      fetchItems()
    } else {
      const err = await res.json()
      setFormError(err.error ?? (editTarget ? '수정에 실패했습니다.' : '계정 생성에 실패했습니다.'))
    }
  }

  const handleToggleActive = async (item: Account) => {
    const res = await fetch(`/api/admin/accounts/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !item.is_active }),
    })
    if (res.ok) fetchItems()
  }

  const positionMap = Object.fromEntries(positions.map(p => [p.id, p.name]))
  const deptMap = Object.fromEntries(departments.map(d => [d.id, d.name]))

  return (
    <>
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>계정 관리</h3>
          <button className={styles.btnPrimary} onClick={openAdd}>
            <UserPlus size={14} /> 계정 추가
          </button>
        </div>

        {loading ? (
          <div className={styles.emptyState}>불러오는 중...</div>
        ) : items.length === 0 ? (
          <div className={styles.emptyState}>등록된 계정이 없습니다.</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>이메일</th>
                <th>표시이름</th>
                <th>휴대폰</th>
                <th>직급</th>
                <th>사업부</th>
                <th>역할</th>
                <th>상태</th>
                <th>액션</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className={!item.is_active ? styles.rowInactive : ''}>
                  <td>{item.username}</td>
                  <td>{item.display_name}</td>
                  <td>{item.phone || '-'}</td>
                  <td>{(item.position_id && positionMap[item.position_id]) || '-'}</td>
                  <td>{(item.department_id && deptMap[item.department_id]) || '-'}</td>
                  <td>
                    <span className={`${styles.statusBadge} ${styles.roleBadge}`}>
                      {ROLE_LABELS[item.role] ?? item.role}
                    </span>
                  </td>
                  <td>
                    <span className={`${styles.statusBadge} ${item.is_active ? styles.statusActive : styles.statusInactive}`}>
                      {item.is_active ? '활성' : '비활성'}
                    </span>
                  </td>
                  <td>
                    <div className={styles.actionGroup}>
                      <button className={styles.btnEdit} onClick={() => openEdit(item)}>
                        <Pencil size={12} /> 수정
                      </button>
                      {item.is_active ? (
                        <button className={styles.btnDelete} onClick={() => handleToggleActive(item)}>
                          <Trash2 size={12} /> 비활성화
                        </button>
                      ) : (
                        <button className={styles.btnRestore} onClick={() => handleToggleActive(item)}>
                          <RotateCcw size={12} /> 활성화
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className={styles.modalOverlay} onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>{editTarget ? '계정 수정' : '계정 추가'}</h3>
              <button className={styles.modalClose} onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className={styles.modalBody}>
              {!editTarget && (
                <>
                  <div className={styles.formRow}>
                    <label className={`${styles.formLabel} ${styles.formLabelRequired}`}>이메일</label>
                    <input
                      type="email"
                      className={styles.formInput}
                      placeholder="예: user@example.com"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                  </div>
                  <div className={styles.formRow}>
                    <label className={`${styles.formLabel} ${styles.formLabelRequired}`}>비밀번호</label>
                    <input
                      type="password"
                      className={styles.formInput}
                      placeholder="8자 이상 입력"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                    />
                  </div>
                </>
              )}
              <div className={styles.formRow2}>
                <div className={styles.formRow}>
                  <label className={`${styles.formLabel} ${styles.formLabelRequired}`}>표시이름</label>
                  <input
                    className={styles.formInput}
                    placeholder="예: 홍길동"
                    value={form.display_name}
                    onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                  />
                </div>
                <div className={styles.formRow}>
                  <label className={`${styles.formLabel} ${styles.formLabelRequired}`}>역할</label>
                  <select
                    className={styles.formSelect}
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value as AccountRole })}
                  >
                    <option value="staff">없음</option>
                    <option value="admin">어드민</option>
                    <option value="mini-admin">미니 어드민</option>
                    <option value="master-admin">마스터 어드민</option>
                  </select>
                </div>
              </div>
              <div className={styles.formRow2}>
                <div className={styles.formRow}>
                  <label className={styles.formLabel}>직급</label>
                  <select
                    className={styles.formSelect}
                    value={form.position_id}
                    onChange={(e) => setForm({ ...form, position_id: e.target.value })}
                  >
                    <option value="">선택 안 함</option>
                    {[...positions].filter(p => p.is_active).sort((a, b) => a.sort_order - b.sort_order).map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.formRow}>
                  <label className={styles.formLabel}>사업부</label>
                  <select
                    className={styles.formSelect}
                    value={form.department_id}
                    onChange={(e) => setForm({ ...form, department_id: e.target.value })}
                  >
                    <option value="">선택 안 함</option>
                    {departments.filter(d => d.is_active).map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className={styles.formRow}>
                <label className={styles.formLabel}>휴대폰 (알림톡/SMS 수신용)</label>
                <input
                  type="tel"
                  className={styles.formInput}
                  placeholder="010-1234-5678"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              {formError && <p className={styles.errorMsg}>{formError}</p>}
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnSecondary} onClick={() => setShowModal(false)}>취소</button>
              <button className={styles.btnPrimary} onClick={handleSubmit} disabled={submitting}>
                {submitting ? '처리 중...' : editTarget ? '수정' : '계정 추가'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Permissions Tab ──────────────────────────────────────────────────────────

interface UserWithPermissions {
  id: number
  display_name: string | null
  username: string
  role: string
  position_id?: string | null
  position_name?: string | null
  base_permissions?: { section: string; scope: string; allowed_tabs?: string[] | null }[]
  overrides?: { section: string; scope: string; allowed_tabs?: string[] | null }[]
  permissions: { section: string; scope: string; allowed_tabs?: string[] | null }[]
}

interface PermissionSection {
  key: string
  label: string
  description: string
  allowOwn: boolean
  group: '교육운영' | '시스템' | '경영관리'
}

const PERMISSION_SECTIONS: PermissionSection[] = [
  { key: 'hakjeom',    label: '학점은행제 사업부', description: '상담 목록 조회·수정',     allowOwn: true,  group: '교육운영' },
  { key: 'cert',       label: '민간자격증 사업부', description: '상담 목록 조회·수정',     allowOwn: false, group: '교육운영' },
  { key: 'practice',   label: '실습/취업',         description: '실습·취업 상담 조회·수정', allowOwn: true,  group: '교육운영' },
  { key: 'allcare',    label: '올케어 관리자',      description: '올케어 데이터 관리',      allowOwn: false, group: '교육운영' },
  { key: 'abroad',     label: '한평생유학',         description: '유학 신청·결제 관리',     allowOwn: false, group: '교육운영' },
  { key: 'duplicate',  label: '중복 조회',          description: '연락처 중복 조회',        allowOwn: false, group: '시스템' },
  { key: 'trash',      label: '삭제 목록',          description: '휴지통·영구삭제',         allowOwn: false, group: '시스템' },
  { key: 'logs',       label: '로그 관리',          description: '작업 로그 열람',          allowOwn: false, group: '시스템' },
  { key: 'ref-manage', label: '어드민 관리',        description: '기준 데이터 관리',        allowOwn: false, group: '시스템' },
  { key: 'assignment', label: '배정 현황',          description: '담당자 배정 통계 열람',   allowOwn: false, group: '시스템' },
  { key: 'approvals',  label: '전자결재',           description: '전자결재 열람·처리',      allowOwn: false, group: '경영관리' },
  { key: 'revenues',   label: '팀별 매출 관리',      description: '사업부별 매출 현황 열람 (담당: 사원/주임은 본인 사업부만, 대리 이상은 전체)',  allowOwn: true,  group: '경영관리' },
  { key: 'revenue-upload', label: '매출 데이터 관리', description: '매출 데이터 업로드·관리 (담당: 본인 사업부만)', allowOwn: true,  group: '경영관리' },
  { key: 'reports',      label: '손익 리포트',        description: '손익 리포트 열람',              allowOwn: false, group: '경영관리' },
  { key: 'bankaccount', label: '계좌조회',           description: '팝빌 계좌 거래내역 조회 (이사 이상)', allowOwn: false, group: '경영관리' },
]

// 탭 제한을 지원하는 섹션과 해당 탭 목록
const TAB_RESTRICTION_SECTIONS: {
  sectionKey: string
  label: string
  tabs: { value: string; label: string }[]
}[] = [
  {
    sectionKey: 'cert',
    label: '민간자격증 사업부',
    tabs: [
      { value: 'hakjeom',          label: '학점연계 신청' },
      { value: 'edu',              label: '교육원' },
      { value: 'private-cert',     label: '민간자격증' },
      { value: 'student-mgmt',     label: '학생관리' },
      { value: 'student-contact',  label: '연락예정' },
      { value: 'counsel-template', label: '상담 템플릿' },
      { value: 'stats',            label: '통계' },
    ],
  },
  {
    sectionKey: 'hakjeom',
    label: '학점은행제 사업부',
    tabs: [
      { value: 'hakjeom',      label: '학점은행제' },
      { value: 'agency',       label: '기관협약' },
      { value: 'bulk',         label: '일괄등록' },
      { value: 'counsel_done', label: '연락예정' },
      { value: 'stats',        label: '통계' },
    ],
  },
]

const SCOPE_OPTIONS = {
  none: { label: '접근 불가', color: 'scopeNone' },
  all: { label: '전체 열람', color: 'scopeAll' },
  own: { label: '담당 건만', color: 'scopeOwn' },
} as const

type ScopeKey = keyof typeof SCOPE_OPTIONS

const ROLE_DISPLAY: Record<string, { label: string; cls: string }> = {
  'master-admin': { label: '마스터', cls: 'roleMaster' },
  admin: { label: '어드민', cls: 'roleAdmin' },
  'mini-admin': { label: '미니어드민', cls: 'roleMini' },
  staff: { label: '스태프', cls: 'roleStaff' },
}

function PermissionsTab() {
  const [users, setUsers] = useState<UserWithPermissions[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [saving, setSaving] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/permissions')
    if (res.ok) setUsers(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    setTimeout(() => {
      fetchUsers()
      fetch('/api/admin/positions').then(r => r.ok ? r.json() : []).then(setPositions).catch(() => {})
    }, 0)
  }, [fetchUsers])

  const getScope = (user: UserWithPermissions, section: string): ScopeKey => {
    return (user.permissions.find(p => p.section === section)?.scope ?? 'none') as ScopeKey
  }

  const getBaseScope = (user: UserWithPermissions, section: string): ScopeKey => {
    return (user.base_permissions?.find(p => p.section === section)?.scope ?? 'none') as ScopeKey
  }

  const hasOverride = (user: UserWithPermissions, section: string) => {
    return Boolean(user.overrides?.some(p => p.section === section))
  }

  const handleChange = async (userId: number, section: string, scope: ScopeKey) => {
    // 낙관적 업데이트 (롤백용 스냅샷 저장)
    const prev = users
    setUsers(cur => cur.map(u => {
      if (u.id !== userId) return u
      const filteredPermissions = u.permissions.filter(p => p.section !== section)
      const filteredOverrides = (u.overrides ?? []).filter(p => p.section !== section)
      return {
        ...u,
        permissions: [...filteredPermissions, { section, scope }],
        overrides: [...filteredOverrides, { section, scope }],
      }
    }))

    const key = `${userId}-${section}`
    setSaving(key)
    try {
      const res = await fetch('/api/admin/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, section, scope }),
      })
      if (!res.ok) {
        // 저장 실패 시 원래 상태로 되돌림
        setUsers(prev)
      } else {
        window.dispatchEvent(new Event('permissions-updated'))
      }
    } catch {
      setUsers(prev)
    } finally {
      setSaving(null)
    }
  }

  const handleResetOverride = async (userId: number, section: string) => {
    const prev = users
    setUsers(cur => cur.map(u => {
      if (u.id !== userId) return u
      const basePermission = u.base_permissions?.find(p => p.section === section)
      const nextPermissions = u.permissions.filter(p => p.section !== section)
      return {
        ...u,
        permissions: basePermission ? [...nextPermissions, basePermission] : nextPermissions,
        overrides: (u.overrides ?? []).filter(p => p.section !== section),
      }
    }))

    const key = `${userId}-${section}-reset`
    setSaving(key)
    try {
      const res = await fetch('/api/admin/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, section, clear_override: true }),
      })
      if (!res.ok) setUsers(prev)
      else window.dispatchEvent(new Event('permissions-updated'))
    } catch {
      setUsers(prev)
    } finally {
      setSaving(null)
    }
  }

  const handleBasePermissionChange = async (positionId: string, section: string, scope: ScopeKey) => {
    const prev = users
    setUsers(cur => cur.map(user => {
      if (user.position_id !== positionId) return user
      const nextBasePermissions = (user.base_permissions ?? []).map(permission =>
        permission.section === section ? { ...permission, scope } : permission
      )
      const overridden = Boolean(user.overrides?.some(permission => permission.section === section))
      const nextPermissions = overridden
        ? user.permissions
        : user.permissions.map(permission =>
            permission.section === section ? { ...permission, scope } : permission
          )

      return {
        ...user,
        base_permissions: nextBasePermissions,
        permissions: nextPermissions,
      }
    }))

    const key = `position-${positionId}-${section}`
    setSaving(key)
    try {
      const res = await fetch('/api/admin/position-permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position_id: positionId, section, scope }),
      })
      if (!res.ok) setUsers(prev)
      else window.dispatchEvent(new Event('permissions-updated'))
    } catch {
      setUsers(prev)
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return (
      <div className={styles.permLoadingWrap}>
        <p className={styles.permLoadingText}>불러오는 중...</p>
      </div>
    )
  }

  if (users.length === 0) {
    return (
      <div className={styles.permEmptyWrap}>
        <p className={styles.permEmptyText}>관리할 계정이 없습니다.</p>
        <p className={styles.permEmptyHint}>계정 관리 탭에서 스태프 계정을 먼저 추가해주세요.</p>
      </div>
    )
  }

  // 탭 제한 저장
  const handleTabRestriction = async (userId: number, sectionKey: string, allowedTabs: string[] | null) => {
    setUsers(cur => cur.map(u => {
      if (u.id !== userId) return u
      return {
        ...u,
        permissions: u.permissions.map(p =>
          p.section === sectionKey ? { ...p, allowed_tabs: allowedTabs } : p
        ),
      }
    }))
    const key = `${userId}-${sectionKey}-tabs`
    setSaving(key)
    try {
      await fetch('/api/admin/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, section: sectionKey, allowed_tabs: allowedTabs }),
      })
      window.dispatchEvent(new Event('permissions-updated'))
    } finally {
      setSaving(null)
    }
  }

  const PERM_GROUPS: { key: '교육운영' | '시스템' | '경영관리' }[] = [
    { key: '경영관리' },
    { key: '교육운영' },
    { key: '시스템' },
  ]

  const positionNames = positions
    .filter(position => position.is_active)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(position => position.name)

  const groupedPositions = [
    ...positionNames.map(positionName => ({
      name: positionName,
      positionId: positions.find(position => position.name === positionName)?.id ?? null,
      users: users.filter(user => (user.position_name ?? '직급 미지정') === positionName),
    })),
    {
      name: '직급 미지정',
      positionId: null,
      users: users.filter(user => !user.position_name),
    },
  ].filter(group => group.users.length > 0)

  const activePositionName = selectedPosition && groupedPositions.some(group => group.name === selectedPosition)
    ? selectedPosition
    : groupedPositions[0]?.name ?? null

  const activeGroup = groupedPositions.find(group => group.name === activePositionName) ?? null
  const basePermissionSource = activeGroup?.users[0]?.base_permissions ?? []

  return (
    <div className={styles.permWrap}>
      <div className={styles.permIntroCard}>
        <div>
          <h3 className={styles.permIntroTitle}>직급별 권한 기준</h3>
          <p className={styles.permIntroText}>
            권한은 직급 기본값을 기준으로 보고, 필요한 사람만 상세에서 개별 예외를 주는 방식으로 관리합니다.
          </p>
        </div>
      </div>

      <div className={styles.positionGrid}>
        {groupedPositions.map(group => {
          const overrideCount = group.users.reduce((count, user) => count + (user.overrides?.length ?? 0), 0)
          return (
            <button
              key={group.name}
              type="button"
              className={`${styles.positionCard} ${activePositionName === group.name ? styles.positionCardActive : ''}`}
              onClick={() => setSelectedPosition(group.name)}
            >
              <div className={styles.positionCardHeader}>
                <span className={styles.positionCardTitle}>{group.name}</span>
                <span className={styles.positionCardCount}>{group.users.length}명</span>
              </div>
              <p className={styles.positionCardText}>
                기본 권한 {group.users[0]?.base_permissions?.filter(permission => permission.scope !== 'none').length ?? 0}개
              </p>
              <p className={styles.positionCardText}>
                개별 예외 {overrideCount}건
              </p>
            </button>
          )
        })}
      </div>

      {activeGroup && (
        <div className={styles.permDetailCard}>
          <div className={styles.permDetailHeader}>
            <div>
              <h3 className={styles.permDetailTitle}>{activeGroup.name} 권한 상세</h3>
              <p className={styles.permDetailText}>
                이 직급의 기본권한과 사용자별 개별 예외를 한 화면에서 관리합니다.
              </p>
            </div>
            <span className={styles.permDetailMeta}>대상 사용자 {activeGroup.users.length}명</span>
          </div>

          {PERM_GROUPS.map(group => {
            const groupSections = PERMISSION_SECTIONS.filter(section => section.group === group.key)
            return (
              <div key={group.key} className={styles.positionSection}>
                <div className={styles.positionSectionHeader}>
                  <span className={styles.positionSectionTitle}>{group.key}</span>
                </div>
                <div className={styles.positionPermissionList}>
                  {groupSections.map(section => {
                    const baseScope = (basePermissionSource.find(permission => permission.section === section.key)?.scope ?? 'none') as ScopeKey
                    const isSavingBase = activeGroup.positionId ? saving === `position-${activeGroup.positionId}-${section.key}` : false
                    return (
                      <div key={section.key} className={styles.positionPermissionRow}>
                        <div className={styles.positionPermissionLabelWrap}>
                          <span className={styles.positionPermissionLabel}>{section.label}</span>
                          <span className={styles.positionPermissionHint}>{section.description}</span>
                        </div>
                        {activeGroup.positionId ? (
                          <select
                            className={styles.permScopeSelect}
                            data-scope={baseScope}
                            value={baseScope}
                            disabled={isSavingBase}
                            onChange={(e) => handleBasePermissionChange(activeGroup.positionId as string, section.key, e.target.value as ScopeKey)}
                          >
                            <option value="none">접근 불가</option>
                            <option value="all">전체 열람</option>
                            {section.allowOwn && <option value="own">담당 건만</option>}
                          </select>
                        ) : (
                          <span className={`${styles.positionPermissionBadge} ${styles[`scopeBadge${baseScope === 'all' ? 'All' : baseScope === 'own' ? 'Own' : 'None'}`]}`}>
                            기본값 {SCOPE_OPTIONS[baseScope].label}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          <div className={styles.userOverrideSection}>
            <div className={styles.positionSectionHeader}>
              <span className={styles.positionSectionTitle}>사용자별 개별 예외</span>
              <span className={styles.positionSectionHint}>기본값과 다르게 보여야 하는 사람만 수정하면 됩니다.</span>
            </div>
            <div className={styles.userOverrideList}>
              {activeGroup.users.map(user => {
                const roleInfo = ROLE_DISPLAY[user.role] ?? { label: user.role, cls: 'roleStaff' }
                return (
                  <div key={user.id} className={styles.userOverrideCard}>
                    <div className={styles.permCardHeader}>
                      <div className={styles.permUserAvatar}>
                        {(user.display_name ?? user.username).slice(0, 1)}
                      </div>
                      <div className={styles.permUserMeta}>
                        <span className={styles.permUserName}>{user.display_name ?? user.username}</span>
                        <span className={`${styles.permRoleBadge} ${styles[roleInfo.cls]}`}>{roleInfo.label}</span>
                        <span className={styles.permUserEmail}>{user.username}</span>
                      </div>
                    </div>

                    {PERM_GROUPS.map(group => {
                      const groupSections = PERMISSION_SECTIONS.filter(section => section.group === group.key)
                      return (
                        <div key={`${user.id}-${group.key}`} className={styles.permCardGroup}>
                          <div className={styles.permCardGroupLabel}>{group.key}</div>
                          {groupSections.map(sec => {
                            const currentScope = getScope(user, sec.key)
                            const baseScope = getBaseScope(user, sec.key)
                            const overridden = hasOverride(user, sec.key)
                            const isSaving = saving === `${user.id}-${sec.key}` || saving === `${user.id}-${sec.key}-reset`
                            return (
                              <div key={`${user.id}-${sec.key}`} className={styles.permCardRow}>
                                <div className={styles.permCardRowLabelWrap}>
                                  <span className={styles.permCardRowLabel}>{sec.label}</span>
                                  <span className={styles.permCardRowHint}>
                                    기본값 {SCOPE_OPTIONS[baseScope].label}{overridden ? ' · 개별예외 적용중' : ''}
                                  </span>
                                </div>
                                <div className={styles.permCardRowActions}>
                                  <select
                                    className={styles.permScopeSelect}
                                    data-scope={currentScope}
                                    value={currentScope}
                                    disabled={isSaving}
                                    onChange={(e) => handleChange(user.id, sec.key, e.target.value as ScopeKey)}
                                  >
                                    <option value="none">접근 불가</option>
                                    <option value="all">전체 열람</option>
                                    {sec.allowOwn && <option value="own">담당 건만</option>}
                                  </select>
                                  {overridden && (
                                    <button
                                      type="button"
                                      className={styles.btnSecondary}
                                      onClick={() => handleResetOverride(user.id, sec.key)}
                                      disabled={isSaving}
                                    >
                                      기본값 복원
                                    </button>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}

                    {TAB_RESTRICTION_SECTIONS.map(({ sectionKey, label, tabs }) => {
                      const perm = user.permissions.find(permission => permission.section === sectionKey)
                      if (!perm || perm.scope === 'none') return null
                      const allowedTabs: string[] | null = perm.allowed_tabs ?? null
                      const isSavingTabs = saving === `${user.id}-${sectionKey}-tabs`
                      return (
                        <div key={`${user.id}-${sectionKey}-tabs`} className={styles.userTabRestrict}>
                          <div className={styles.userTabRestrictHeader}>
                            <span className={styles.userTabRestrictTitle}>{label} 탭 제한</span>
                            {isSavingTabs && <span className={styles.tabRestrictSaving}>저장 중...</span>}
                          </div>
                          <div className={styles.tabPillGroup}>
                            {tabs.map(tab => {
                              const isChecked = allowedTabs === null || allowedTabs.includes(tab.value)
                              const handleToggle = () => {
                                const currentAllowed = allowedTabs ?? tabs.map(t => t.value)
                                let next: string[]
                                if (isChecked) {
                                  next = currentAllowed.filter(value => value !== tab.value)
                                } else {
                                  next = [...currentAllowed, tab.value]
                                }
                                const allSelected = tabs.every(item => next.includes(item.value))
                                handleTabRestriction(user.id, sectionKey, allSelected ? null : next)
                              }
                              return (
                                <label
                                  key={`${user.id}-${sectionKey}-${tab.value}`}
                                  className={`${styles.tabPill} ${isChecked ? styles.tabPillOn : styles.tabPillOff}`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={handleToggle}
                                    className={styles.tabPillInput}
                                  />
                                  {tab.label}
                                </label>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
