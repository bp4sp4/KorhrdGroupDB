'use client'

import { useState, useRef, useEffect, FormEvent, ChangeEvent } from 'react'
import { X, Image as ImageIcon, Upload, Plus } from 'lucide-react'
import CustomSelect from './CustomSelect'
import styles from './CreativeRegisterModal.module.css'

const CHANNELS = [
  { value: 'meta', label: '메타 (Facebook/Instagram)' },
  { value: 'danggn', label: '당근' },
  { value: 'naver', label: '네이버' },
  { value: 'instagram', label: '인스타그램' },
  { value: 'youtube', label: '유튜브' },
  { value: 'kakao', label: '카카오' },
  { value: 'etc', label: '기타' },
]

const TYPE_PRESETS = ['혜택형', '신뢰형', '자극형', '정보전달형', '정의형']
const STATUSES = ['활성', '비활성', '테스트']

const DIVISION_KEY: Record<string, string> = {
  '학점은행제': 'nms',
  '민간자격증': 'cert',
  '유학': 'abroad',
}

const CUSTOM_TYPE_KEY = '__custom__'

export interface CreativeEditTarget {
  id: string
  channel: string
  name: string
  campaign: string
  type: string
  status: string
  registeredAt: string
  impressions: number
  clicks: number
  dbCount: number
  registrations: number
  adCost: number
  thumbnailUrl: string | null
}

interface Props {
  open: boolean
  division: string
  defaultChannel?: string
  editTarget?: CreativeEditTarget | null
  onClose: () => void
  onSuccess: () => void
}

export default function CreativeRegisterModal({ open, division, defaultChannel, editTarget, onClose, onSuccess }: Props) {
  const isEdit = Boolean(editTarget)

  const [name, setName] = useState('')
  const [campaign, setCampaign] = useState('')
  const [channel, setChannel] = useState('meta')
  const [type, setType] = useState('혜택형')
  const [typeMode, setTypeMode] = useState<'preset' | 'custom'>('preset')
  const [customType, setCustomType] = useState('')
  const [status, setStatus] = useState('활성')
  const [registeredAt, setRegisteredAt] = useState(new Date().toISOString().slice(0, 10))
  const [impressions, setImpressions] = useState('')
  const [clicks, setClicks] = useState('')
  const [dbCount, setDbCount] = useState('')
  const [registrations, setRegistrations] = useState('')
  const [adCost, setAdCost] = useState('')
  const [thumbnail, setThumbnail] = useState<File | null>(null)
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null)
  const [removeExistingThumb, setRemoveExistingThumb] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    if (editTarget) {
      setName(editTarget.name)
      setCampaign(editTarget.campaign)
      setChannel(editTarget.channel)
      if (TYPE_PRESETS.includes(editTarget.type)) {
        setType(editTarget.type); setTypeMode('preset'); setCustomType('')
      } else {
        setType(editTarget.type); setTypeMode('custom'); setCustomType(editTarget.type)
      }
      setStatus(editTarget.status)
      setRegisteredAt(editTarget.registeredAt)
      setImpressions(String(editTarget.impressions || ''))
      setClicks(String(editTarget.clicks || ''))
      setDbCount(String(editTarget.dbCount || ''))
      setRegistrations(String(editTarget.registrations || ''))
      setAdCost(String(editTarget.adCost || ''))
      setThumbnail(null)
      setThumbnailPreview(editTarget.thumbnailUrl)
      setRemoveExistingThumb(false)
    } else {
      setName(''); setCampaign('')
      setChannel(defaultChannel && defaultChannel !== 'all' ? defaultChannel : 'meta')
      setType('혜택형'); setTypeMode('preset'); setCustomType('')
      setStatus('활성')
      setRegisteredAt(new Date().toISOString().slice(0, 10))
      setImpressions(''); setClicks(''); setDbCount(''); setRegistrations(''); setAdCost('')
      setThumbnail(null); setThumbnailPreview(null); setRemoveExistingThumb(false)
    }
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [open, editTarget, defaultChannel])

  if (!open) return null

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('이미지 파일만 업로드 가능합니다.'); return }
    if (file.size > 5 * 1024 * 1024) { setError('5MB 이하의 파일만 업로드 가능합니다.'); return }
    setError(null)
    setThumbnail(file)
    setRemoveExistingThumb(false)
    const reader = new FileReader()
    reader.onload = () => setThumbnailPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleRemoveThumb = () => {
    setThumbnail(null)
    setThumbnailPreview(null)
    if (isEdit && editTarget?.thumbnailUrl) setRemoveExistingThumb(true)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleTypeSelect = (v: string) => {
    if (v === CUSTOM_TYPE_KEY) {
      setTypeMode('custom')
      if (!customType) setCustomType('')
    } else {
      setTypeMode('preset')
      setType(v)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('소재명을 입력해주세요.'); return }

    const finalType = typeMode === 'custom' ? customType.trim() : type
    if (!finalType) { setError('소재 유형을 입력해주세요.'); return }

    setSubmitting(true)
    setError(null)

    try {
      const fd = new FormData()
      if (!isEdit) fd.append('division', DIVISION_KEY[division] ?? 'nms')
      fd.append('channel', channel)
      fd.append('name', name.trim())
      fd.append('campaign', campaign.trim())
      fd.append('type', finalType)
      fd.append('status', status)
      fd.append('registered_at', registeredAt)
      fd.append('impressions', impressions || '0')
      fd.append('clicks', clicks || '0')
      fd.append('db_count', dbCount || '0')
      fd.append('registrations', registrations || '0')
      fd.append('ad_cost', adCost || '0')
      if (thumbnail) fd.append('thumbnail', thumbnail)
      if (removeExistingThumb) fd.append('remove_thumbnail', '1')

      const url = isEdit ? `/api/marketing/creatives/${editTarget!.id}` : '/api/marketing/creatives'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, body: fd })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? (isEdit ? '수정 실패' : '등록 실패'))
      }
      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류')
    } finally {
      setSubmitting(false)
    }
  }

  const typeOptions = [
    ...TYPE_PRESETS.map((t) => ({ value: t, label: t })),
    { value: CUSTOM_TYPE_KEY, label: '+ 직접 입력' },
  ]
  const typeSelectValue = typeMode === 'custom' ? CUSTOM_TYPE_KEY : type

  return (
    <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <div className={styles.header}>
          <h2 className={styles.title}>{isEdit ? '소재 수정' : '소재 등록'} — {division}</h2>
          <button type="button" className={styles.close_btn} onClick={onClose} aria-label="닫기">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* 썸네일 */}
          <div className={styles.thumb_section}>
            <label className={styles.label}>썸네일</label>
            {thumbnailPreview ? (
              <div className={styles.thumb_preview_wrap}>
                <img src={thumbnailPreview} alt="썸네일 미리보기" className={styles.thumb_preview} />
                <button type="button" className={styles.thumb_remove} onClick={handleRemoveThumb}>
                  <X size={14} /> 제거
                </button>
              </div>
            ) : (
              <button type="button" className={styles.thumb_drop} onClick={() => fileInputRef.current?.click()}>
                <ImageIcon size={28} />
                <span className={styles.thumb_drop_main}>이미지 업로드</span>
                <span className={styles.thumb_drop_hint}>클릭하여 선택 (최대 5MB)</span>
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleFileChange} />
          </div>

          <div className={styles.grid}>
            <div className={styles.field}>
              <label className={styles.label}>소재명 *</label>
              <input type="text" className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 사회복지사_혜택형_A" required />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>캠페인</label>
              <input type="text" className={styles.input} value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="예: 자격증광고_5월" />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>채널 *</label>
              <CustomSelect
                value={channel}
                options={CHANNELS}
                onChange={setChannel}
                fullWidth
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>소재 유형 *</label>
              {typeMode === 'preset' ? (
                <CustomSelect
                  value={typeSelectValue}
                  options={typeOptions}
                  onChange={handleTypeSelect}
                  fullWidth
                />
              ) : (
                <div className={styles.custom_type_row}>
                  <input
                    type="text"
                    className={styles.input}
                    value={customType}
                    onChange={(e) => setCustomType(e.target.value)}
                    placeholder="유형 직접 입력"
                    autoFocus
                  />
                  <button
                    type="button"
                    className={styles.custom_type_back}
                    onClick={() => { setTypeMode('preset'); setType(TYPE_PRESETS[0]); setCustomType('') }}
                    aria-label="기본 목록으로"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
            <div className={styles.field}>
              <label className={styles.label}>상태</label>
              <CustomSelect
                value={status}
                options={STATUSES}
                onChange={setStatus}
                fullWidth
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>등록일</label>
              <input type="date" className={styles.input} value={registeredAt} onChange={(e) => setRegisteredAt(e.target.value)} />
            </div>
          </div>

          <div className={styles.section_title}>성과 지표</div>
          <div className={styles.grid}>
            <div className={styles.field}>
              <label className={styles.label}>노출수</label>
              <input type="number" min={0} className={styles.input} value={impressions} onChange={(e) => setImpressions(e.target.value)} placeholder="0" />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>클릭수</label>
              <input type="number" min={0} className={styles.input} value={clicks} onChange={(e) => setClicks(e.target.value)} placeholder="0" />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>DB수</label>
              <input type="number" min={0} className={styles.input} value={dbCount} onChange={(e) => setDbCount(e.target.value)} placeholder="0" />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>등록수</label>
              <input type="number" min={0} className={styles.input} value={registrations} onChange={(e) => setRegistrations(e.target.value)} placeholder="0" />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>광고비 (원)</label>
              <input type="number" min={0} className={styles.input} value={adCost} onChange={(e) => setAdCost(e.target.value)} placeholder="0" />
            </div>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.footer}>
            <button type="button" className={styles.btn_cancel} onClick={onClose} disabled={submitting}>취소</button>
            <button type="submit" className={styles.btn_submit} disabled={submitting}>
              {isEdit ? <Plus size={14} /> : <Upload size={14} />}
              {submitting ? (isEdit ? '수정 중...' : '등록 중...') : (isEdit ? '수정' : '등록')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
