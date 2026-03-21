import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/requireAuth'

export async function GET(req: NextRequest) {
  const auth = await requireAuth()
  if (auth.errorResponse) return auth.errorResponse

  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] })
  }

  const pattern = `%${q}%`

  // 학점은행제 상담
  const hakjeomPromise = supabaseAdmin
    .from('hakjeom_consultations')
    .select('id, name, contact, status, manager')
    .is('deleted_at', null)
    .or(`name.ilike.${pattern},contact.ilike.${pattern}`)
    .order('created_at', { ascending: false })
    .limit(5)

  // 민간자격증 상담
  const certConsultPromise = supabaseAdmin
    .from('private_cert_consultations')
    .select('id, name, contact, status, manager')
    .is('deleted_at', null)
    .or(`name.ilike.${pattern},contact.ilike.${pattern}`)
    .order('created_at', { ascending: false })
    .limit(5)

  // 자격증 신청
  const certAppPromise = supabaseAdmin
    .from('certificate_applications')
    .select('id, name, contact, payment_status')
    .is('deleted_at', null)
    .or(`name.ilike.${pattern},contact.ilike.${pattern}`)
    .order('created_at', { ascending: false })
    .limit(5)

  // 기관협약
  const agencyPromise = supabaseAdmin
    .from('agency_agreements')
    .select('id, institution_name, contact, status, manager')
    .is('deleted_at', null)
    .or(`institution_name.ilike.${pattern},contact.ilike.${pattern}`)
    .order('created_at', { ascending: false })
    .limit(5)

  // 실습 상담
  const practicePromise = supabaseAdmin
    .from('practice_consultations')
    .select('id, name, contact, status, manager')
    .is('deleted_at', null)
    .or(`name.ilike.${pattern},contact.ilike.${pattern}`)
    .order('created_at', { ascending: false })
    .limit(5)

  const [hakjeom, certConsult, certApp, agency, practice] = await Promise.all([
    hakjeomPromise, certConsultPromise, certAppPromise, agencyPromise, practicePromise,
  ])

  const results: Array<{
    category: string
    categoryLabel: string
    link: string
    id: string | number
    name: string
    sub: string
    status?: string
  }> = []

  hakjeom.data?.forEach(r => results.push({
    category: 'hakjeom', categoryLabel: '학점은행제',
    link: '/hakjeom', id: r.id,
    name: r.name, sub: r.contact ?? '', status: r.status,
  }))

  certConsult.data?.forEach(r => results.push({
    category: 'cert-consult', categoryLabel: '민간자격증 상담',
    link: '/cert', id: r.id,
    name: r.name, sub: r.contact ?? '', status: r.status,
  }))

  certApp.data?.forEach(r => results.push({
    category: 'cert-app', categoryLabel: '자격증 신청',
    link: '/cert', id: r.id,
    name: r.name, sub: r.contact ?? '', status: r.payment_status,
  }))

  agency.data?.forEach(r => results.push({
    category: 'agency', categoryLabel: '기관협약',
    link: '/hakjeom', id: r.id,
    name: r.institution_name, sub: r.contact ?? '', status: r.status,
  }))

  practice.data?.forEach(r => results.push({
    category: 'practice', categoryLabel: '실습/취업',
    link: '/practice', id: r.id,
    name: r.name, sub: r.contact ?? '', status: r.status,
  }))

  return NextResponse.json({ results })
}
