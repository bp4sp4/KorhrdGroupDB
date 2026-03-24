import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/requireAuth'

// 숫자만 입력 시 대시 삽입 패턴 생성 (010-46 형식으로 변환)
// 예: "01046" → "%010-46%", "01046001234" → "%010-4600-1234%"
function buildContactFilter(q: string, pattern: string): string {
  const base = `contact.ilike.${pattern}`
  if (!/^\d+$/.test(q) || q.length <= 3) return base

  const prefix = q.slice(0, 3)
  const rest = q.slice(3)

  // 모바일 번호 형식: 010/011/016/017/018/019
  const isMobile = ['010', '011', '016', '017', '018', '019'].includes(prefix)

  if (isMobile && rest.length >= 5) {
    // 두 번째 대시도 삽입: 010-XXXX-XXXX
    const dashPattern = `%${prefix}-${rest.slice(0, 4)}-${rest.slice(4)}%`
    return `${base},contact.ilike.${dashPattern}`
  }

  // 첫 번째 대시만 삽입
  const dashPattern = `%${prefix}-${rest}%`
  return `${base},contact.ilike.${dashPattern}`
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth.errorResponse) return auth.errorResponse

  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] })
  }

  const pattern = `%${q}%`
  const contactFilter = buildContactFilter(q, pattern)

  // 학점은행제 상담
  const hakjeomPromise = supabaseAdmin
    .from('hakjeom_consultations')
    .select('id, name, contact, status, manager')
    .is('deleted_at', null)
    .or(`name.ilike.${pattern},${contactFilter}`)
    .order('created_at', { ascending: false })
    .limit(5)

  // 민간자격증 상담
  const certConsultPromise = supabaseAdmin
    .from('private_cert_consultations')
    .select('id, name, contact, status, manager')
    .is('deleted_at', null)
    .or(`name.ilike.${pattern},${contactFilter}`)
    .order('created_at', { ascending: false })
    .limit(5)

  // 자격증 신청 (source 포함)
  const certAppPromise = supabaseAdmin
    .from('certificate_applications')
    .select('id, name, contact, payment_status, source')
    .is('deleted_at', null)
    .or(`name.ilike.${pattern},${contactFilter}`)
    .order('created_at', { ascending: false })
    .limit(5)

  // 기관협약
  const agencyPromise = supabaseAdmin
    .from('agency_agreements')
    .select('id, institution_name, contact, status, manager')
    .is('deleted_at', null)
    .or(`institution_name.ilike.${pattern},${contactFilter}`)
    .order('created_at', { ascending: false })
    .limit(5)

  // 실습 상담
  const practicePromise = supabaseAdmin
    .from('practice_consultations')
    .select('id, name, contact, status, manager')
    .is('deleted_at', null)
    .or(`name.ilike.${pattern},${contactFilter}`)
    .order('created_at', { ascending: false })
    .limit(5)

  const [hakjeom, certConsult, certApp, agency, practice] = await Promise.all([
    hakjeomPromise, certConsultPromise, certAppPromise, agencyPromise, practicePromise,
  ])

  // cert app source → tab 매핑
  const certSourceToTab: Record<string, string> = { bridge: 'hakjeom', prepayment: 'edu' }

  const results: Array<{
    category: string
    categoryLabel: string
    link: string
    tab?: string
    id: string | number
    name: string
    sub: string
    status?: string
  }> = []

  hakjeom.data?.forEach(r => results.push({
    category: 'hakjeom', categoryLabel: '학점은행제',
    link: '/hakjeom', tab: 'hakjeom', id: r.id,
    name: r.name, sub: r.contact ?? '', status: r.status,
  }))

  certConsult.data?.forEach(r => results.push({
    category: 'cert-consult', categoryLabel: '민간자격증 상담',
    link: '/cert', tab: 'private-cert', id: r.id,
    name: r.name, sub: r.contact ?? '', status: r.status,
  }))

  certApp.data?.forEach(r => results.push({
    category: 'cert-app', categoryLabel: '자격증 신청',
    link: '/cert', tab: certSourceToTab[r.source ?? ''] ?? 'hakjeom', id: r.id,
    name: r.name, sub: r.contact ?? '', status: r.payment_status,
  }))

  agency.data?.forEach(r => results.push({
    category: 'agency', categoryLabel: '기관협약',
    link: '/hakjeom', tab: 'agency', id: r.id,
    name: r.institution_name, sub: r.contact ?? '', status: r.status,
  }))

  practice.data?.forEach(r => results.push({
    category: 'practice', categoryLabel: '실습/취업',
    link: '/practice', tab: 'practice', id: r.id,
    name: r.name, sub: r.contact ?? '', status: r.status,
  }))

  return NextResponse.json({ results })
}
