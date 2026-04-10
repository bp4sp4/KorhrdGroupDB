'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import ImageViewer from './ImageViewer'
import styles from './page.module.css'

const PROGRAM_LABEL: Record<string, string> = {
  '3week': '3주 프로그램', '10week': '10주 프로그램',
  philippines_cebu_solo: '필리핀 세부 나홀로',
  usa_newjersey_solo: '미국 뉴저지 나홀로',
  canada_vancouver_solo: '캐나다 밴쿠버-써리 나홀로',
  uk_solo: '영국 나홀로',
  nz_auckland_solo: '뉴질랜드 오클랜드 나홀로',
  nz_hamilton_solo_4w: '뉴질랜드 해밀턴 나홀로 4주',
  nz_hamilton_parent_4w: '뉴질랜드 해밀턴 부모동반 4주',
  nz_hamilton_solo_3w: '뉴질랜드 해밀턴 나홀로 3주',
  nz_hamilton_parent_3w: '뉴질랜드 해밀턴 부모동반 3주',
  nz_hamilton_solo_10w: '뉴질랜드 해밀턴 나홀로 10주',
  nz_hamilton_parent_10w: '뉴질랜드 해밀턴 부모동반 10주',
}
const SCHOOL_LABEL: Record<string, string> = {
  elementary: '초등학교', middle: '중학교', high: '고등학교', university: '대학교',
}
const STATUS_LABEL: Record<string, string> = {
  draft: '임시저장', submitted: '신청완료', reviewing: '검토중', approved: '승인', rejected: '반려',
}
const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  draft:     { bg: '#F2F4F6', color: '#8B95A1' },
  submitted: { bg: '#EBF3FF', color: '#0051FF' },
  reviewing: { bg: '#FFF8E8', color: '#E08A00' },
  approved:  { bg: '#E9FAF0', color: '#00B04F' },
  rejected:  { bg: '#FFF0F0', color: '#F04452' },
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AppData = Record<string, any>

type SignedUrls = {
  passportUrl: string | null
  idPhotoUrl: string | null
  guardianPassportUrl: string | null
  guardianPhotoUrl: string | null
  participantSigUrl: string | null
  guardianSigUrl: string | null
}

type ImageEntry = {
  label: string
  url: string | null
  field: string
  urlKey: keyof SignedUrls
}

type EditCtx = {
  editMode: boolean
  editData: AppData
  setEditData: React.Dispatch<React.SetStateAction<AppData>>
  appId: string
  onImageUpload: (urlKey: keyof SignedUrls, newUrl: string) => void
}

const EditContext = createContext<EditCtx | null>(null)

export default function ApplicationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [app, setApp] = useState<AppData | null>(null)
  const [signedUrls, setSignedUrls] = useState<SignedUrls | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editData, setEditData] = useState<AppData>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/abroad/applications/${id}`)
      .then(r => {
        if (r.status === 404) { setNotFound(true); return null }
        return r.ok ? r.json() : null
      })
      .then(data => {
        if (data) {
          setApp(data.app)
          setSignedUrls(data.signedUrls)
        }
      })
      .finally(() => setLoading(false))
  }, [id])

  const handleEditStart = () => {
    setEditData({ ...app })
    setSaveError(null)
    setEditMode(true)
  }

  const handleCancel = () => {
    setEditMode(false)
    setSaveError(null)
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      const payload = { ...editData }
      if (typeof payload.allergies === 'string') {
        payload.allergies = payload.allergies
          ? payload.allergies.split(',').map((s: string) => s.trim()).filter(Boolean)
          : []
      }
      const res = await fetch(`/api/abroad/applications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json()
        setSaveError(err.error ?? '저장에 실패했습니다.')
        return
      }
      const data = await res.json()
      setApp(data.app)
      setEditMode(false)
    } catch {
      setSaveError('네트워크 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleImageUpload = (urlKey: keyof SignedUrls, newUrl: string) => {
    setSignedUrls(prev => prev ? { ...prev, [urlKey]: newUrl } : prev)
  }

  if (loading) return <div className={styles.loadingWrap}>불러오는 중...</div>
  if (notFound || !app) return <div className={styles.loadingWrap}>신청서를 찾을 수 없습니다.</div>

  const displayData = editMode ? editData : app
  const sc = STATUS_COLOR[displayData.status] ?? STATUS_COLOR.draft
  const urls = signedUrls!

  return (
    <EditContext.Provider value={{ editMode, editData, setEditData, appId: id, onImageUpload: handleImageUpload }}>
      <div className={styles.pageWrap}>
        <div className={styles.topBar}>
          <button className={styles.backBtn} onClick={() => router.push('/abroad')}>
            ← 신청서 목록
          </button>
          <div className={styles.topBarRight}>
            {editMode ? (
              <>
                {saveError && <span className={styles.saveError}>{saveError}</span>}
                <button className={styles.btnCancel} onClick={handleCancel} disabled={saving}>
                  취소
                </button>
                <button className={styles.btnSave} onClick={handleSave} disabled={saving}>
                  {saving ? '저장 중...' : '저장'}
                </button>
              </>
            ) : (
              <>
                <span className={styles.statusBadge} style={{ background: sc.bg, color: sc.color }}>
                  {STATUS_LABEL[app.status] ?? app.status}
                </span>
                <button className={styles.btnEdit} onClick={handleEditStart}>
                  수정
                </button>
              </>
            )}
          </div>
        </div>

        {/* 타이틀 카드 */}
        <div className={styles.titleCard}>
          <div>
            <p className={styles.pageTitle}>{displayData.name ?? '-'}</p>
            <p className={styles.pageSub}>
              {PROGRAM_LABEL[displayData.program ?? ''] ?? displayData.program ?? '-'}
              &nbsp;·&nbsp;
              {new Date(app.created_at).toLocaleString('ko-KR')} 신청
            </p>
          </div>
          {editMode && (
            <div className={styles.editStatusRow}>
              <label className={styles.editStatusLabel}>상태</label>
              <select
                className={styles.fieldSelect}
                value={editData.status ?? ''}
                onChange={e => setEditData(prev => ({ ...prev, status: e.target.value }))}
              >
                {Object.entries(STATUS_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className={styles.grid}>

          {/* 참가자 기본정보 */}
          <Card title="참가자 기본정보">
            <F label="한국 이름"   v={displayData.name}        fk="name" />
            <F label="영어 이름"   v={displayData.english_name} fk="english_name" />
            <F label="성별"        v={displayData.gender}       fk="gender" />
            <F label="혈액형"      v={displayData.blood_type}   fk="blood_type" />
            <F label="생년월일"    v={displayData.birth_date}   fk="birth_date" />
            <F label="출생 도시"   v={displayData.birth_city}   fk="birth_city" />
            <F label="이메일"      v={displayData.email}        fk="email" />
            <F label="연락처"      v={displayData.phone}        fk="phone" />
            <Fselect
              label="학교 종류"
              fk="school_type"
              options={Object.entries(SCHOOL_LABEL).map(([k, v]) => ({ value: k, label: v }))}
              v={SCHOOL_LABEL[displayData.school_type ?? ''] ?? displayData.school_type}
            />
            <F label="학교"        v={displayData.school}       fk="school" />
            <F label="학년"        v={displayData.school_grade} fk="school_grade" />
            <F label="주소"        v={[displayData.address, displayData.address_detail].filter(Boolean).join(' ')} fk="address" />
            {editMode && <F label="상세주소" v={editData.address_detail} fk="address_detail" />}
          </Card>

          {/* 해외 출국용 정보 */}
          <Card
            title="해외 출국용 정보"
            images={[
              { label: '여권사본',  url: urls.passportUrl, field: 'passport',  urlKey: 'passportUrl' },
              { label: '증명사진',  url: urls.idPhotoUrl,  field: 'id_photo',  urlKey: 'idPhotoUrl' },
            ]}
          >
            <F label="여권 영문명" v={displayData.passport_name}   fk="passport_name" />
            <F label="여권번호"    v={displayData.passport_number} fk="passport_number" />
            <F label="여권만료일"  v={displayData.passport_expiry} fk="passport_expiry" />
          </Card>

          {/* 보호자 정보 */}
          <Card
            title="보호자 정보"
            images={[
              { label: '보호자 여권사본', url: urls.guardianPassportUrl, field: 'guardian_passport', urlKey: 'guardianPassportUrl' },
              { label: '보호자 증명사진', url: urls.guardianPhotoUrl,    field: 'guardian_photo',    urlKey: 'guardianPhotoUrl' },
            ]}
          >
            <F label="이름"      v={displayData.guardian_name}       fk="guardian_name" />
            <F label="연락처"    v={displayData.guardian_phone}      fk="guardian_phone" />
            <F label="이메일"    v={displayData.guardian_email}      fk="guardian_email" />
            <F label="출생 도시" v={displayData.guardian_birth_city} fk="guardian_birth_city" />
          </Card>

          {/* 홈스테이 정보 */}
          <Card title="홈스테이 정보">
            <F label="영어 수준" v={displayData.english_level} fk="english_level" />
            <F label="수영 레벨" v={displayData.swim_level}    fk="swim_level" />
            <F
              label="알러지"
              v={Array.isArray(displayData.allergies) ? displayData.allergies.join(', ') : displayData.allergies}
              fk="allergies"
              allergyField
            />
            <F label="자기소개"           v={displayData.self_intro}      fk="self_intro"      text />
            <F label="가족소개"           v={displayData.family_intro}    fk="family_intro"    text />
            <F label="홈스테이 고려사항"  v={displayData.homestay_notes}  fk="homestay_notes"  text />
            <F label="성격"               v={displayData.personality}     fk="personality"     text />
            <F label="취미"               v={displayData.hobbies}         fk="hobbies"         text />
            <F label="특기"               v={displayData.special_notes}   fk="special_notes"   text />
            <F label="건강/음식 주의사항" v={displayData.health_notes}    fk="health_notes"    text />
            <F label="참고사항"           v={displayData.extra_notes}     fk="extra_notes"     text />
          </Card>

          {/* 참가 동의 */}
          <Card
            title="참가 동의"
            images={[
              { label: '참가자 서명', url: urls.participantSigUrl, field: 'participant_sig', urlKey: 'participantSigUrl' },
              { label: '보호자 서명', url: urls.guardianSigUrl,    field: 'guardian_sig',    urlKey: 'guardianSigUrl' },
            ]}
          >
            <Agree label="참가자 동의"   v={app.agreed_terms} />
            <Agree label="보호자 동의"   v={app.agreed_privacy} />
            <Agree label="환불규정 확인" v={app.agreed_media} />
          </Card>

        </div>
      </div>
    </EditContext.Provider>
  )
}

function Card({ title, children, images }: {
  title: string
  children: React.ReactNode
  images?: ImageEntry[]
}) {
  const ctx = useContext(EditContext)
  const editMode = ctx?.editMode ?? false

  const viewImages = images?.filter(i => i.url) as { label: string; url: string }[] | undefined

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardDot} />
        <h2 className={styles.cardTitle}>{title}</h2>
      </div>
      <div className={styles.fields}>{children}</div>
      {images && (
        editMode
          ? <ImageEditSection images={images} />
          : viewImages && viewImages.length > 0 && <ImageViewer images={viewImages} />
      )}
    </div>
  )
}

function ImageEditSection({ images }: { images: ImageEntry[] }) {
  const ctx = useContext(EditContext)!
  const [uploading, setUploading] = useState<string | null>(null)
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const handleFile = async (field: string, urlKey: keyof SignedUrls, file: File) => {
    setUploading(field)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('field', field)
      const res = await fetch(`/api/abroad/applications/${ctx.appId}/upload`, {
        method: 'POST',
        body: fd,
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error ?? '업로드에 실패했습니다.')
        return
      }
      if (data.signedUrl) {
        ctx.onImageUpload(urlKey, data.signedUrl)
      }
    } catch {
      alert('네트워크 오류가 발생했습니다.')
    } finally {
      setUploading(null)
      // input 초기화
      const input = inputRefs.current[field]
      if (input) input.value = ''
    }
  }

  return (
    <div className={styles.imagesSection}>
      {images.map(img => (
        <div key={img.field} className={styles.imageWrap}>
          <p className={styles.imageLabel}>{img.label}</p>
          {img.url && (
            <div className={styles.imageThumbWrap}>
              <img src={img.url} alt={img.label} className={styles.imageThumb} />
            </div>
          )}
          <label className={`${styles.imgBtn} ${uploading === img.field ? styles.imgBtnUploading : ''}`}>
            {uploading === img.field ? '업로드 중...' : img.url ? '사진 교체' : '사진 업로드'}
            <input
              ref={el => { inputRefs.current[img.field] = el }}
              type="file"
              accept="image/*,.pdf"
              className={styles.hiddenInput}
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) handleFile(img.field, img.urlKey, file)
              }}
              disabled={!!uploading}
            />
          </label>
        </div>
      ))}
    </div>
  )
}

function F({ label, v, text, fk, allergyField }: {
  label: string
  v: string | null | undefined
  text?: boolean
  fk?: string
  allergyField?: boolean
}) {
  const ctx = useContext(EditContext)
  const editMode = ctx?.editMode ?? false
  const editData = ctx?.editData ?? {}
  const setEditData = ctx?.setEditData

  if (editMode && fk && setEditData) {
    const rawVal = allergyField
      ? (Array.isArray(editData[fk]) ? editData[fk].join(', ') : (editData[fk] ?? ''))
      : (editData[fk] ?? '')

    const handleChange = (val: string) => {
      setEditData(prev => ({ ...prev, [fk]: val }))
    }

    return (
      <div className={styles.fieldRowEdit}>
        <span className={styles.fieldLabel}>{label}</span>
        {text ? (
          <textarea
            className={styles.fieldTextarea}
            value={rawVal}
            onChange={e => handleChange(e.target.value)}
            rows={3}
          />
        ) : (
          <input
            className={styles.fieldInput}
            type="text"
            value={rawVal}
            onChange={e => handleChange(e.target.value)}
          />
        )}
      </div>
    )
  }

  if (!v) return null
  return (
    <div className={styles.fieldRow}>
      <span className={styles.fieldLabel}>{label}</span>
      <span className={text ? styles.fieldValueText : styles.fieldValue}>{v}</span>
    </div>
  )
}

function Fselect({ label, v, fk, options }: {
  label: string
  v: string | null | undefined
  fk: string
  options: { value: string; label: string }[]
}) {
  const ctx = useContext(EditContext)
  const editMode = ctx?.editMode ?? false
  const editData = ctx?.editData ?? {}
  const setEditData = ctx?.setEditData

  if (editMode && setEditData) {
    return (
      <div className={styles.fieldRowEdit}>
        <span className={styles.fieldLabel}>{label}</span>
        <select
          className={styles.fieldSelect}
          value={editData[fk] ?? ''}
          onChange={e => setEditData(prev => ({ ...prev, [fk]: e.target.value }))}
        >
          <option value="">선택</option>
          {options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    )
  }

  if (!v) return null
  return (
    <div className={styles.fieldRow}>
      <span className={styles.fieldLabel}>{label}</span>
      <span className={styles.fieldValue}>{v}</span>
    </div>
  )
}

function Agree({ label, v }: { label: string; v: boolean }) {
  return (
    <div className={styles.fieldRow}>
      <span className={styles.fieldLabel}>{label}</span>
      {v
        ? <span className={styles.agreeYes}>✓ 동의</span>
        : <span className={styles.agreeNo}>✗ 미동의</span>
      }
    </div>
  )
}
