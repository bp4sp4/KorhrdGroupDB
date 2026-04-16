import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { writeAuditLog } from '@/lib/management/auditLog'
import { requireManagementAccess } from '@/lib/auth/managementAccess'

export async function GET(request: NextRequest) {
  const access = await requireManagementAccess('revenue-upload', { allowOwn: true, emptyBody: { data: [], total: 0, page: 1, pageSize: 50 } })
  if (!access.ok) return access.response

  const sp = request.nextUrl.searchParams
  const dateStart = sp.get('date_start')
  const dateEnd = sp.get('date_end')
  const deptId = sp.get('department_id')
  const revenueType = sp.get('revenue_type')
  const search = sp.get('search')
  const page = parseInt(sp.get('page') ?? '1')
  const pageSize = 50

  // 'own' 스코프: 본인 사업부만 조회 허용 (사업부 미지정 시 빈 결과)
  if (access.scope === 'own') {
    const ownDept = access.appUser.department_id
    if (!ownDept) {
      return NextResponse.json({ data: [], total: 0, page, pageSize })
    }
    if (deptId && deptId !== ownDept) {
      return NextResponse.json({ data: [], total: 0, page, pageSize })
    }
  }

  let query = supabaseAdmin
    .from('revenues')
    .select(`
      *,
      department:departments(id, code, name)
    `, { count: 'exact' })
    .eq('is_deleted', false)

  if (access.scope === 'own' && access.appUser.department_id) {
    query = query.eq('department_id', access.appUser.department_id)
  }

  if (dateStart) query = query.gte('revenue_date', dateStart)
  if (dateEnd) query = query.lte('revenue_date', dateEnd)
  if (deptId) query = query.eq('department_id', deptId)
  if (revenueType) query = query.eq('revenue_type', revenueType)
  if (search) query = query.or(`customer_name.ilike.%${search}%,product_name.ilike.%${search}%`)

  query = query
    .order('revenue_date', { ascending: false })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  const { data, error, count } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    data: data ?? [],
    total: count ?? 0,
    page,
    pageSize,
  })
}

export async function POST(request: NextRequest) {
  const access = await requireManagementAccess('revenue-upload', { allowOwn: true })
  if (!access.ok) return access.response

  const userId = access.user.id

  const body = await request.json()
  const { revenue_date, department_id, revenue_type, customer_name, amount, product_name, manager_id, memo } = body

  if (!revenue_date || !customer_name || !amount) {
    return NextResponse.json({ error: '필수 항목을 입력해주세요.' }, { status: 400 })
  }

  // 'own' 스코프: 본인 사업부로 강제
  let effectiveDeptId: string | null = department_id || null
  if (access.scope === 'own') {
    const ownDept = access.appUser.department_id
    if (!ownDept) {
      return NextResponse.json({ error: '사업부가 지정되지 않아 등록할 수 없습니다.' }, { status: 403 })
    }
    if (department_id && department_id !== ownDept) {
      return NextResponse.json({ error: '본인 사업부 데이터만 등록할 수 있습니다.' }, { status: 403 })
    }
    effectiveDeptId = ownDept
  }

  const { data, error } = await supabaseAdmin
    .from('revenues')
    .insert({
      revenue_date,
      department_id: effectiveDeptId,
      revenue_type: revenue_type ?? 'CARD',
      customer_name,
      amount: Number(amount),
      product_name: product_name || null,
      manager_id: manager_id || null,
      memo: memo || null,
      source: 'MANUAL',
      created_by: userId,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: '동일한 매출 데이터가 이미 존재합니다.', duplicate: true }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 감사 로그 기록
  await writeAuditLog({
    userId,
    action: 'CREATE',
    targetType: 'revenues',
    targetId: data?.id,
    changes: { revenue_date, customer_name, amount: Number(amount), revenue_type },
    ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
  })

  return NextResponse.json(data, { status: 201 })
}
