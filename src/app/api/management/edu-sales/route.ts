import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireManagementAccess, isRevenueOwnAllowedForDivision } from '@/lib/auth/managementAccess'

interface EduStudentRow {
  id: string
  name: string | null
  education_center_name: string | null
  manager_name: string | null
  cost: number | null
  status: string | null
  registered_at: string | null
  edu_courses: { name: string | null } | null
}

// 교육원(학점은행제 사업부) 월별 매출 조회
// edu_students.cost 합산, registered_at 기준, 환불/삭제예정 제외
// GET /api/management/edu-sales?year=2026&month=4
export async function GET(request: NextRequest) {
  const emptyBody = { year: 0, month: 0, totalRevenue: 0, count: 0, students: [] }
  const access = await requireManagementAccess('revenues', { allowOwn: true, emptyBody })
  if (!access.ok) return access.response

  if (access.scope === 'own') {
    const allowed = await isRevenueOwnAllowedForDivision(access.appUser.department_id, 'nms', access.appUser.position_id)
    if (!allowed) return NextResponse.json(emptyBody)
  }

  const sp = request.nextUrl.searchParams
  const year = parseInt(sp.get('year') ?? String(new Date().getFullYear()))
  const month = parseInt(sp.get('month') ?? String(new Date().getMonth() + 1))

  const pad = (n: number) => String(n).padStart(2, '0')
  const lastDay = new Date(year, month, 0).getDate()
  const startDate = `${year}-${pad(month)}-01`
  const endDate = `${year}-${pad(month)}-${pad(lastDay)}T23:59:59+09:00`

  const { data, error } = await supabaseAdmin
    .from('edu_students')
    .select('id, name, education_center_name, manager_name, cost, status, registered_at, edu_courses(name)')
    .gte('registered_at', startDate)
    .lte('registered_at', endDate)
    .not('status', 'in', '("환불","삭제예정")')
    .order('registered_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []) as unknown as EduStudentRow[]
  const totalRevenue = rows.reduce((sum, r) => sum + (Number(r.cost) || 0), 0)
  const count = rows.length

  const students = rows.map((r) => ({
    id: r.id,
    name: r.name,
    education_center_name: r.education_center_name,
    course_name: r.edu_courses?.name ?? null,
    manager_name: r.manager_name,
    cost: Number(r.cost) || 0,
    status: r.status,
    registered_at: r.registered_at,
  }))

  return NextResponse.json(
    { year, month, totalRevenue, count, students },
    {
      headers: {
        'Cache-Control': 'private, s-maxage=60, stale-while-revalidate=300',
      },
    }
  )
}
