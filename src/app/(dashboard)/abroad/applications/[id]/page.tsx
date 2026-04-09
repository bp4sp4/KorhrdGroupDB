'use client'

import { useEffect, useState } from 'react'
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

export default function ApplicationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [app, setApp] = useState<AppData | null>(null)
  const [signedUrls, setSignedUrls] = useState<SignedUrls | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

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

  if (loading) return <div className={styles.loadingWrap}>불러오는 중...</div>
  if (notFound || !app) return <div className={styles.loadingWrap}>신청서를 찾을 수 없습니다.</div>

  const sc = STATUS_COLOR[app.status] ?? STATUS_COLOR.draft
  const urls = signedUrls!

  return (
    <div className={styles.pageWrap}>
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={() => router.push('/abroad')}>
          ← 신청서 목록
        </button>
        <span className={styles.statusBadge} style={{ background: sc.bg, color: sc.color }}>
          {STATUS_LABEL[app.status] ?? app.status}
        </span>
      </div>

      {/* 타이틀 카드 */}
      <div className={styles.titleCard}>
        <div>
          <p className={styles.pageTitle}>{app.name ?? '-'}</p>
          <p className={styles.pageSub}>
            {PROGRAM_LABEL[app.program ?? ''] ?? app.program ?? '-'}
            &nbsp;·&nbsp;
            {new Date(app.created_at).toLocaleString('ko-KR')} 신청
          </p>
        </div>
      </div>

      <div className={styles.grid}>

        {/* 참가자 기본정보 */}
        <Card title="참가자 기본정보">
          <F label="한국 이름"   v={app.name} />
          <F label="영어 이름"   v={app.english_name} />
          <F label="성별"        v={app.gender} />
          <F label="혈액형"      v={app.blood_type} />
          <F label="생년월일"    v={app.birth_date} />
          <F label="출생 도시"   v={app.birth_city} />
          <F label="이메일"      v={app.email} />
          <F label="연락처"      v={app.phone} />
          <F label="학교 종류"   v={SCHOOL_LABEL[app.school_type ?? ''] ?? app.school_type} />
          <F label="학교"        v={app.school} />
          <F label="학년"        v={app.school_grade} />
          <F label="주소"        v={[app.address, app.address_detail].filter(Boolean).join(' ')} />
        </Card>

        {/* 해외 출국용 정보 */}
        <Card
          title="해외 출국용 정보"
          images={[
            { label: '여권사본', url: urls.passportUrl },
            { label: '증명사진', url: urls.idPhotoUrl },
          ]}
        >
          <F label="여권 영문명" v={app.passport_name} />
          <F label="여권번호"    v={app.passport_number} />
          <F label="여권만료일"  v={app.passport_expiry} />
        </Card>

        {/* 보호자 정보 */}
        <Card
          title="보호자 정보"
          images={[
            { label: '보호자 여권사본', url: urls.guardianPassportUrl },
            { label: '보호자 증명사진', url: urls.guardianPhotoUrl },
          ]}
        >
          <F label="이름"      v={app.guardian_name} />
          <F label="연락처"    v={app.guardian_phone} />
          <F label="이메일"    v={app.guardian_email} />
          <F label="출생 도시" v={app.guardian_birth_city} />
        </Card>

        {/* 홈스테이 정보 */}
        <Card title="홈스테이 정보">
          <F label="영어 수준"          v={app.english_level} />
          <F label="수영 레벨"          v={app.swim_level} />
          <F label="알러지"             v={Array.isArray(app.allergies) ? app.allergies.join(', ') : app.allergies} />
          <F label="자기소개"           v={app.self_intro}       text />
          <F label="가족소개"           v={app.family_intro}     text />
          <F label="홈스테이 고려사항"  v={app.homestay_notes}   text />
          <F label="성격"               v={app.personality}      text />
          <F label="취미"               v={app.hobbies}          text />
          <F label="특기"               v={app.special_notes}    text />
          <F label="건강/음식 주의사항" v={app.health_notes}     text />
          <F label="참고사항"           v={app.extra_notes}      text />
        </Card>

        {/* 참가 동의 */}
        <Card
          title="참가 동의"
          images={[
            { label: '참가자 서명', url: urls.participantSigUrl },
            { label: '보호자 서명', url: urls.guardianSigUrl },
          ]}
        >
          <Agree label="참가자 동의"   v={app.agreed_terms} />
          <Agree label="보호자 동의"   v={app.agreed_privacy} />
          <Agree label="환불규정 확인" v={app.agreed_media} />
        </Card>

      </div>
    </div>
  )
}

function Card({ title, children, images }: {
  title: string
  children: React.ReactNode
  images?: { label: string; url: string | null }[]
}) {
  const validImages = images?.filter(i => i.url) as { label: string; url: string }[] | undefined
  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardDot} />
        <h2 className={styles.cardTitle}>{title}</h2>
      </div>
      <div className={styles.fields}>{children}</div>
      {validImages && validImages.length > 0 && (
        <ImageViewer images={validImages} />
      )}
    </div>
  )
}

function F({ label, v, text }: { label: string; v: string | null | undefined; text?: boolean }) {
  if (!v) return null
  return (
    <div className={styles.fieldRow}>
      <span className={styles.fieldLabel}>{label}</span>
      <span className={text ? styles.fieldValueText : styles.fieldValue}>{v}</span>
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
