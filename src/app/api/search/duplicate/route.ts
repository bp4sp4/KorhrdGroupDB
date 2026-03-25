import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/requireAuth'

const TABLE_LABELS: Record<string, string> = {
  hakjeom_consultations: '학점은행제 상담',
  private_cert_consultations: '민간자격증 상담',
  certificate_applications: '자격증 신청',
  agency_agreements: '기관협약',
  practice_consultations: '실습/취업',
}

const TABLE_LINKS: Record<string, { link: string; tab: string }> = {
  hakjeom_consultations: { link: '/hakjeom', tab: 'hakjeom' },
  private_cert_consultations: { link: '/cert', tab: 'private-cert' },
  certificate_applications: { link: '/cert', tab: 'hakjeom' },
  agency_agreements: { link: '/hakjeom', tab: 'agency' },
  practice_consultations: { link: '/practice', tab: 'consultation' },
}

// 연락처 정규화: 숫자만 추출
function normalizeContact(contact: string | null): string {
  if (!contact) return ''
  return contact.replace(/\D/g, '')
}

export async function GET() {
  const auth = await requireAuth()
  if (auth.errorResponse) return auth.errorResponse

  const [hakjeom, certConsult, certApp, agency, practice] = await Promise.all([
    supabaseAdmin
      .from('hakjeom_consultations')
      .select('id, name, contact, status, manager, created_at')
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),

    supabaseAdmin
      .from('private_cert_consultations')
      .select('id, name, contact, status, manager, created_at')
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),

    supabaseAdmin
      .from('certificate_applications')
      .select('id, name, contact, payment_status, source, created_at')
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),

    supabaseAdmin
      .from('agency_agreements')
      .select('id, institution_name, contact, status, manager, created_at')
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),

    supabaseAdmin
      .from('practice_consultations')
      .select('id, name, contact, status, manager, created_at')
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
  ])

  type Entry = {
    table: string
    tableLabel: string
    link: string
    tab: string
    id: string | number
    name: string
    contact: string
    contactNorm: string
    status: string | null
    manager?: string | null
    createdAt: string
  }

  const allEntries: Entry[] = []

  hakjeom.data?.forEach(r => allEntries.push({
    table: 'hakjeom_consultations',
    tableLabel: TABLE_LABELS.hakjeom_consultations,
    ...TABLE_LINKS.hakjeom_consultations,
    id: r.id, name: r.name ?? '', contact: r.contact ?? '',
    contactNorm: normalizeContact(r.contact),
    status: r.status, manager: r.manager, createdAt: r.created_at,
  }))

  certConsult.data?.forEach(r => allEntries.push({
    table: 'private_cert_consultations',
    tableLabel: TABLE_LABELS.private_cert_consultations,
    ...TABLE_LINKS.private_cert_consultations,
    id: r.id, name: r.name ?? '', contact: r.contact ?? '',
    contactNorm: normalizeContact(r.contact),
    status: r.status, manager: r.manager, createdAt: r.created_at,
  }))

  certApp.data?.forEach(r => allEntries.push({
    table: 'certificate_applications',
    tableLabel: TABLE_LABELS.certificate_applications,
    ...TABLE_LINKS.certificate_applications,
    id: r.id, name: r.name ?? '', contact: r.contact ?? '',
    contactNorm: normalizeContact(r.contact),
    status: r.payment_status, createdAt: r.created_at,
  }))

  agency.data?.forEach(r => allEntries.push({
    table: 'agency_agreements',
    tableLabel: TABLE_LABELS.agency_agreements,
    ...TABLE_LINKS.agency_agreements,
    id: r.id, name: r.institution_name ?? '', contact: r.contact ?? '',
    contactNorm: normalizeContact(r.contact),
    status: r.status, manager: r.manager, createdAt: r.created_at,
  }))

  practice.data?.forEach(r => allEntries.push({
    table: 'practice_consultations',
    tableLabel: TABLE_LABELS.practice_consultations,
    ...TABLE_LINKS.practice_consultations,
    id: r.id, name: r.name ?? '', contact: r.contact ?? '',
    contactNorm: normalizeContact(r.contact),
    status: r.status, manager: r.manager, createdAt: r.created_at,
  }))

  // 이름 + 정규화된 연락처를 키로 그룹화
  // 같은 테이블 안에서는 가장 최신 1건만 유지 (pending→paid 같은 상태 변화로 인한 중복 방지)
  const groups = new Map<string, Entry[]>()
  for (const entry of allEntries) {
    if (!entry.name || !entry.contactNorm || entry.contactNorm.length < 9) continue
    const key = `${entry.name.trim()}::${entry.contactNorm}`
    if (!groups.has(key)) groups.set(key, [])
    const bucket = groups.get(key)!
    const existingInSameTable = bucket.findIndex(e => e.table === entry.table)
    if (existingInSameTable >= 0) {
      // 같은 테이블에 이미 있으면 더 최신 건으로 교체
      if (entry.createdAt > bucket[existingInSameTable].createdAt) {
        bucket[existingInSameTable] = entry
      }
    } else {
      bucket.push(entry)
    }
  }

  // 2건 이상인 그룹만 중복으로 판단
  type DuplicateGroup = {
    key: string
    name: string
    contact: string
    count: number
    tableCount: number
    entries: Omit<Entry, 'contactNorm'>[]
  }

  const duplicates: DuplicateGroup[] = []
  for (const [key, entries] of groups) {
    if (entries.length < 2) continue
    const tableSet = new Set(entries.map(e => e.table))
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const cleanEntries = entries.map(({ contactNorm: _, ...rest }) => rest)
    duplicates.push({
      key,
      name: entries[0].name,
      contact: entries[0].contact,
      count: entries.length,
      tableCount: tableSet.size,
      entries: cleanEntries,
    })
  }

  // 중복 건수 내림차순 정렬
  duplicates.sort((a, b) => b.count - a.count)

  return NextResponse.json({ duplicates, totalPeople: duplicates.length })
}
