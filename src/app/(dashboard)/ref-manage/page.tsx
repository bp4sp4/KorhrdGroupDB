'use client'

import { useEffect, useState, useCallback } from 'react'
import { Copy, Check, Pencil, X, Save, UserPlus } from 'lucide-react'
import styles from './page.module.css'

interface MiniAdminUser {
  id: string
  username: string
  display_name: string | null
  ref_code: string | null
}

interface EditState {
  id: string
  display_name: string
  ref_code: string
}

export default function RefManagePage() {
  const [users, setUsers] = useState<MiniAdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [editState, setEditState] = useState<EditState | null>(null)
  const [saving, setSaving] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({ email: '', password: '', display_name: '', ref_code: '' })
  const [creating, setCreating] = useState(false)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/ref-manage')
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error || '조회 실패')
      }
      const data = await res.json()
      setUsers(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleCopyLink = async (refCode: string | null, id: string) => {
    if (!refCode) return
    const url = `https://creditprepayment.vercel.app/?ref=${refCode}`
    await navigator.clipboard.writeText(url)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleEditStart = (user: MiniAdminUser) => {
    setEditState({
      id: user.id,
      display_name: user.display_name ?? '',
      ref_code: user.ref_code ?? '',
    })
  }

  const handleEditCancel = () => {
    setEditState(null)
  }

  const handleEditSave = async () => {
    if (!editState) return
    setSaving(true)
    try {
      const res = await fetch('/api/ref-manage', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editState.id,
          display_name: editState.display_name,
          ref_code: editState.ref_code,
        }),
      })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error || '저장 실패')
      }
      await fetchUsers()
      setEditState(null)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  if (error) {
    return (
      <div className={styles.errorState}>
        <p>{error}</p>
      </div>
    )
  }

  const handleCreateSave = async () => {
    if (!createForm.email || !createForm.password) return
    setCreating(true)
    try {
      const res = await fetch('/api/ref-manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error || '생성 실패')
      }
      await fetchUsers()
      setShowCreateModal(false)
      setCreateForm({ email: '', password: '', display_name: '', ref_code: '' })
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '생성 중 오류가 발생했습니다.')
    } finally {
      setCreating(false)
    }
  }

  const editingUser = editState ? users.find(u => u.id === editState.id) : null

  return (
    <div className={styles.pageWrapper}>
      {/* 안내 + 생성 버튼 */}
      <div className={styles.headerRow}>
        <div className={styles.infoBanner}>
          미니어드민 계정의 이름과 ref 코드를 관리합니다. 링크를 복사해 담당자에게 전달하세요.
        </div>
        <button onClick={() => setShowCreateModal(true)} className={styles.createBtn}>
          <UserPlus size={16} />
          계정 생성
        </button>
      </div>

      {/* 테이블 */}
      <div className={styles.tableCard}>
        <div className={styles.tableOverflow}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>담당자명</th>
                <th className={styles.th}>계정 이메일</th>
                <th className={styles.th}>ref 코드</th>
                <th className={styles.th}>링크</th>
                <th className={styles.th}>수정</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className={`${styles.td} ${styles.tdCenter}`} colSpan={5}>
                    로딩 중...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td className={`${styles.td} ${styles.tdCenter}`} colSpan={5}>
                    등록된 미니어드민이 없습니다.
                  </td>
                </tr>
              ) : (
                users.map(user => (
                  <tr key={user.id}>
                    <td className={`${styles.td} ${styles.tdName}`}>
                      {user.display_name || <span className={styles.emptyPlaceholder}>-</span>}
                    </td>
                    <td className={`${styles.td} ${styles.tdEmail}`}>
                      {user.username}
                    </td>
                    <td className={styles.td}>
                      {user.ref_code ? (
                        <span className={styles.refCodeBadge}>{user.ref_code}</span>
                      ) : (
                        <span className={styles.refCodeEmpty}>미설정</span>
                      )}
                    </td>
                    <td className={styles.td}>
                      {user.ref_code ? (
                        <button
                          onClick={() => handleCopyLink(user.ref_code, user.id)}
                          className={`${styles.copyBtn} ${copiedId === user.id ? styles.copyBtnCopied : ''}`}
                        >
                          {copiedId === user.id ? <Check size={13} /> : <Copy size={13} />}
                          {copiedId === user.id ? '복사됨' : '링크 복사'}
                        </button>
                      ) : (
                        <span className={styles.linkNeeded}>ref 코드 필요</span>
                      )}
                    </td>
                    <td className={styles.td}>
                      <button onClick={() => handleEditStart(user)} className={styles.editBtn}>
                        <Pencil size={13} />
                        수정
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 계정 생성 모달 */}
      {showCreateModal && (
        <div className={styles.modalOverlay} onClick={() => setShowCreateModal(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>미니어드민 계정 생성</h2>
              <button onClick={() => setShowCreateModal(false)} className={styles.closeBtn}>
                <X size={20} />
              </button>
            </div>

            {[
              { label: '이메일 *', key: 'email', type: 'email', placeholder: 'example@email.com' },
              { label: '비밀번호 *', key: 'password', type: 'password', placeholder: '8자 이상 권장' },
              { label: '담당자명', key: 'display_name', type: 'text', placeholder: '홍길동' },
              { label: 'ref 코드', key: 'ref_code', type: 'text', placeholder: 'consultation' },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key} className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>{label}</label>
                <input
                  type={type}
                  value={createForm[key as keyof typeof createForm]}
                  onChange={e => setCreateForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className={`${styles.input} ${key === 'ref_code' ? styles.inputMono : ''}`}
                />
              </div>
            ))}

            <div className={styles.btnRow}>
              <button onClick={() => setShowCreateModal(false)} className={styles.cancelBtn}>
                취소
              </button>
              <button
                onClick={handleCreateSave}
                disabled={creating || !createForm.email || !createForm.password}
                className={styles.submitBtn}
              >
                <UserPlus size={15} />
                {creating ? '생성 중...' : '생성하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 수정 모달 */}
      {editState && editingUser && (
        <div className={styles.modalOverlay} onClick={handleEditCancel}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>미니어드민 수정</h2>
              <button onClick={handleEditCancel} className={styles.closeBtn}>
                <X size={20} />
              </button>
            </div>

            {/* 계정 이메일 (읽기전용) */}
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>계정 이메일</label>
              <div className={styles.readonlyField}>{editingUser.username}</div>
            </div>

            {/* 담당자명 */}
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>담당자명</label>
              <input
                value={editState.display_name}
                onChange={e => setEditState(s => s ? { ...s, display_name: e.target.value } : s)}
                placeholder="담당자명 입력"
                className={styles.input}
              />
            </div>

            {/* ref 코드 */}
            <div className={styles.fieldGroupLast}>
              <label className={styles.fieldLabel}>ref 코드</label>
              <input
                value={editState.ref_code}
                onChange={e => setEditState(s => s ? { ...s, ref_code: e.target.value } : s)}
                placeholder="ref 코드 입력"
                className={`${styles.input} ${styles.inputMono}`}
              />
            </div>

            {/* 버튼 */}
            <div className={styles.btnRow}>
              <button onClick={handleEditCancel} className={styles.cancelBtn}>
                취소
              </button>
              <button onClick={handleEditSave} disabled={saving} className={styles.submitBtn}>
                <Save size={15} />
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
