import { NextResponse } from 'next/server'
import { requireAuthFull } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

// 어드민 정산용: edu_students + edu_student_admin(아이디) + 최신 메모(특이사항)
export async function GET() {
  const { appUser, errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse

  // 어드민(admin/master-admin)만 접근 허용
  const role = appUser.role
  if (role !== 'admin' && role !== 'master-admin') {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  // 학생 + 과정명
  const { data: students, error: stuErr } = await supabaseAdmin
    .from('edu_students')
    .select('id, name, phone, manager_name, education_center_name, course_id, cost, unit_price, class_start, registered_at, status, edu_courses(name)')
    .order('registered_at', { ascending: false })
  if (stuErr) {
    console.error('[admin/customers] students error', stuErr)
    return NextResponse.json({ error: stuErr.message }, { status: 500 })
  }

  const ids = (students ?? []).map((s) => s.id)
  if (ids.length === 0) return NextResponse.json([])

  // 학습자 아이디
  const { data: admins } = await supabaseAdmin
    .from('edu_student_admin')
    .select('student_id, learner_username')
    .in('student_id', ids)
  const adminMap = new Map<string, string | null>()
  for (const a of admins ?? []) adminMap.set(a.student_id as string, a.learner_username as string | null)

  // 최신 메모 (특이사항)
  const { data: memos } = await supabaseAdmin
    .from('edu_student_memos')
    .select('student_id, content, created_at')
    .in('student_id', ids)
    .order('created_at', { ascending: false })
  const memoMap = new Map<string, string>()
  for (const m of memos ?? []) {
    if (!memoMap.has(m.student_id as string)) memoMap.set(m.student_id as string, m.content as string)
  }

  const rows = (students ?? []).map((s) => {
    const cost = Number(s.cost ?? 0)
    const manualUnit = s.unit_price !== null && s.unit_price !== undefined ? Number(s.unit_price) : null
    // 1) 학생 데이터에 unit_price 직접 입력값이 있으면 우선 사용
    // 2) 없으면 자동 판별: 4.5만원(45,000) → 3.8만원(38,000) 순서
    const candidates: { unit: number; label: string }[] = [
      { unit: 45000, label: '4.5만원' },
      { unit: 38000, label: '3.8만원' },
    ]
    let unitPrice: number | null = null
    let unitLabel: string | null = null
    let subjectCount: number | null = null
    if (manualUnit && manualUnit > 0 && cost > 0) {
      unitPrice = manualUnit
      unitLabel = manualUnit === 45000 ? '4.5만원'
        : manualUnit === 38000 ? '3.8만원'
        : `${(manualUnit / 10000).toLocaleString('ko-KR')}만원`
      subjectCount = Number.isInteger(cost / manualUnit) ? cost / manualUnit : null
    } else if (cost > 0) {
      for (const c of candidates) {
        if (cost % c.unit === 0) {
          unitPrice = c.unit
          unitLabel = c.label
          subjectCount = cost / c.unit
          break
        }
      }
    }
    return {
      id: s.id,
      education_center_name: s.education_center_name ?? '',
      course_name: (s.edu_courses as { name?: string } | null)?.name ?? null,
      class_start: s.class_start ?? null,
      name: s.name,
      learner_username: adminMap.get(s.id) ?? null,
      phone: s.phone ?? null,
      cost,
      paid_at: s.registered_at ?? null, // 결제일 ≈ 등록일
      unit_price: unitPrice,
      unit_label: unitLabel,
      subject_count: subjectCount,
      manager_name: s.manager_name ?? null,
      memo: memoMap.get(s.id) ?? null,
      status: s.status,
    }
  })

  return NextResponse.json(rows)
}
