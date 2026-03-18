'use client'

import { useEffect, useState, useCallback } from 'react'
import { Copy, Check, Pencil, X, Save, UserPlus } from 'lucide-react'
import styles from '../hakjeom/page.module.css'

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
      <div style={{ padding: 40, textAlign: 'center', color: '#991b1b' }}>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 안내 + 생성 버튼 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          flex: 1,
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: 'var(--toss-radius-card)',
          padding: '12px 16px',
          fontSize: 13,
          color: '#1e40af',
        }}>
          미니어드민 계정의 이름과 ref 코드를 관리합니다. 링크를 복사해 담당자에게 전달하세요.
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '10px 18px',
            fontSize: 14,
            fontWeight: 600,
            border: 'none',
            borderRadius: 10,
            background: '#3182f6',
            color: '#fff',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          <UserPlus size={16} />
          계정 생성
        </button>
      </div>

      {/* 테이블 */}
      <div style={{
        background: 'var(--toss-card-bg)',
        border: '1px solid var(--toss-border)',
        borderRadius: 'var(--toss-radius-card)',
        boxShadow: 'var(--toss-shadow-card)',
        overflow: 'hidden',
      }}>
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
                  <td className={styles.td} colSpan={5} style={{ textAlign: 'center', padding: 40 }}>
                    로딩 중...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td className={styles.td} colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--toss-text-tertiary)' }}>
                    등록된 미니어드민이 없습니다.
                  </td>
                </tr>
              ) : (
                users.map(user => (
                  <tr key={user.id}>
                    <td className={styles.td} style={{ fontWeight: 600 }}>
                      {user.display_name || <span style={{ color: 'var(--toss-text-tertiary)' }}>-</span>}
                    </td>
                    <td className={styles.td} style={{ color: 'var(--toss-text-secondary)', fontSize: 13 }}>
                      {user.username}
                    </td>
                    <td className={styles.td}>
                      {user.ref_code ? (
                        <span style={{
                          fontFamily: 'monospace',
                          fontSize: 13,
                          background: '#f3f4f6',
                          padding: '2px 8px',
                          borderRadius: 4,
                        }}>
                          {user.ref_code}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--toss-text-tertiary)', fontSize: 13 }}>미설정</span>
                      )}
                    </td>
                    <td className={styles.td}>
                      {user.ref_code ? (
                        <button
                          onClick={() => handleCopyLink(user.ref_code, user.id)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '5px 12px',
                            fontSize: 12,
                            border: '1px solid var(--toss-border)',
                            borderRadius: 6,
                            background: copiedId === user.id ? '#d1fae5' : '#fff',
                            color: copiedId === user.id ? '#065f46' : 'var(--toss-text-secondary)',
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                          }}
                        >
                          {copiedId === user.id ? <Check size={13} /> : <Copy size={13} />}
                          {copiedId === user.id ? '복사됨' : '링크 복사'}
                        </button>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--toss-text-tertiary)' }}>ref 코드 필요</span>
                      )}
                    </td>
                    <td className={styles.td}>
                      <button
                        onClick={() => handleEditStart(user)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '5px 10px',
                          fontSize: 12,
                          border: '1px solid var(--toss-border)',
                          borderRadius: 6,
                          background: '#fff',
                          color: 'var(--toss-text-secondary)',
                          cursor: 'pointer',
                        }}
                      >
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

      {/* 수정 팝업 모달 */}
      {/* 계정 생성 모달 */}
      {showCreateModal && (
        <div
          onClick={() => setShowCreateModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: 16,
              padding: '28px 32px',
              width: 400,
              boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>미니어드민 계정 생성</h2>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--toss-text-tertiary)', padding: 4 }}>
                <X size={20} />
              </button>
            </div>

            {[
              { label: '이메일 *', key: 'email', type: 'email', placeholder: 'example@email.com' },
              { label: '비밀번호 *', key: 'password', type: 'password', placeholder: '8자 이상 권장' },
              { label: '담당자명', key: 'display_name', type: 'text', placeholder: '홍길동' },
              { label: 'ref 코드', key: 'ref_code', type: 'text', placeholder: 'consultation' },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key} style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--toss-text-secondary)', marginBottom: 6 }}>
                  {label}
                </label>
                <input
                  type={type}
                  value={createForm[key as keyof typeof createForm]}
                  onChange={e => setCreateForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid var(--toss-border)',
                    borderRadius: 8,
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box',
                    fontFamily: key === 'ref_code' ? 'monospace' : 'inherit',
                  }}
                />
              </div>
            ))}

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{
                  flex: 1, padding: '11px 0', fontSize: 14, fontWeight: 600,
                  border: '1px solid var(--toss-border)', borderRadius: 8,
                  background: '#fff', color: 'var(--toss-text-secondary)', cursor: 'pointer',
                }}
              >
                취소
              </button>
              <button
                onClick={handleCreateSave}
                disabled={creating || !createForm.email || !createForm.password}
                style={{
                  flex: 1, padding: '11px 0', fontSize: 14, fontWeight: 600,
                  border: 'none', borderRadius: 8,
                  background: (creating || !createForm.email || !createForm.password) ? '#93c5fd' : '#3182f6',
                  color: '#fff',
                  cursor: (creating || !createForm.email || !createForm.password) ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
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
        <div
          onClick={handleEditCancel}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: 16,
              padding: '28px 32px',
              width: 400,
              boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
            }}
          >
            {/* 모달 헤더 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--toss-text-primary)' }}>
                미니어드민 수정
              </h2>
              <button
                onClick={handleEditCancel}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--toss-text-tertiary)', padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* 계정 이메일 (읽기전용) */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--toss-text-secondary)', marginBottom: 6 }}>
                계정 이메일
              </label>
              <div style={{
                padding: '10px 12px',
                background: '#f9fafb',
                border: '1px solid var(--toss-border)',
                borderRadius: 8,
                fontSize: 14,
                color: 'var(--toss-text-tertiary)',
              }}>
                {editingUser.username}
              </div>
            </div>

            {/* 담당자명 */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--toss-text-secondary)', marginBottom: 6 }}>
                담당자명
              </label>
              <input
                value={editState.display_name}
                onChange={e => setEditState(s => s ? { ...s, display_name: e.target.value } : s)}
                placeholder="담당자명 입력"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid var(--toss-border)',
                  borderRadius: 8,
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* ref 코드 */}
            <div style={{ marginBottom: 28 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--toss-text-secondary)', marginBottom: 6 }}>
                ref 코드
              </label>
              <input
                value={editState.ref_code}
                onChange={e => setEditState(s => s ? { ...s, ref_code: e.target.value } : s)}
                placeholder="ref 코드 입력"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid var(--toss-border)',
                  borderRadius: 8,
                  fontSize: 14,
                  fontFamily: 'monospace',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* 버튼 */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleEditCancel}
                style={{
                  flex: 1,
                  padding: '11px 0',
                  fontSize: 14,
                  fontWeight: 600,
                  border: '1px solid var(--toss-border)',
                  borderRadius: 8,
                  background: '#fff',
                  color: 'var(--toss-text-secondary)',
                  cursor: 'pointer',
                }}
              >
                취소
              </button>
              <button
                onClick={handleEditSave}
                disabled={saving}
                style={{
                  flex: 1,
                  padding: '11px 0',
                  fontSize: 14,
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: 8,
                  background: saving ? '#93c5fd' : '#3182f6',
                  color: '#fff',
                  cursor: saving ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
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
