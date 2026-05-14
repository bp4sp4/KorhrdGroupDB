import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

// 문의 DB(hakjeom_consultations)에서 이름+전화번호 매칭으로
// 가장 최근의 활성 row를 찾아 등록학생관리 모달에 자동 채울 정보 반환
// GET /api/edu/lookup-consultation?name=...&phone=...
export async function GET(request: NextRequest) {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const { searchParams } = new URL(request.url)
  const name = (searchParams.get('name') ?? '').trim()
  const phoneRaw = (searchParams.get('phone') ?? '').trim()
  const phoneDigits = phoneRaw.replace(/\D/g, '')

  if (!name || phoneDigits.length < 10) {
    return NextResponse.json({ found: false })
  }

  // 전화번호는 저장 시 하이픈 유무가 섞일 수 있어 두 패턴 모두 매칭
  const dashed =
    phoneDigits.length === 11
      ? `${phoneDigits.slice(0, 3)}-${phoneDigits.slice(3, 7)}-${phoneDigits.slice(7)}`
      : phoneDigits.length === 10
        ? `${phoneDigits.slice(0, 3)}-${phoneDigits.slice(3, 6)}-${phoneDigits.slice(6)}`
        : phoneRaw

  const { data, error } = await supabaseAdmin
    .from('hakjeom_consultations')
    .select('id, name, contact, education, hope_course, manager, subject_cost, memo, residence, status')
    .eq('name', name)
    .in('contact', [phoneDigits, dashed, phoneRaw])
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ found: false })
  }

  return NextResponse.json({
    found: true,
    consultation: {
      id: data.id,
      name: data.name,
      contact: data.contact,
      education: data.education,
      hope_course: data.hope_course,
      manager: data.manager,
      subject_cost: data.subject_cost,
      memo: data.memo,
      residence: data.residence,
      status: data.status,
    },
  })
}
