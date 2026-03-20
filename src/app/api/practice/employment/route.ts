import { requireAuth } from '@/lib/auth/requireAuth'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { logAction } from '@/lib/audit/logAction'

// employment_applications 테이블 타입 (korhrdsocialform의 구조 참조)
export interface EmploymentApplication {
  id: string
  name: string
  gender: string | null
  contact: string
  birth_date: string | null
  address: string | null
  address_detail: string | null
  desired_job_field: string | null
  employment_types: string[]
  has_resume: boolean | null
  certifications: string | null
  payment_amount: number
  payment_status: string
  payment_id: string | null
  privacy_agreed: boolean
  terms_agreed: boolean
  click_source: string | null
  status: string
  memo: string | null
  manager: string | null
  created_at: string
}

/**
 * GET /api/practice/employment
 * 쿼리 파라미터:
 *   - search: name 또는 contact 검색 (부분 일치)
 *   - status: 상태 필터
 *   - payment_status: 결제 상태 필터
 */
export async function GET(request: NextRequest) {
  try {
    const { user: _user, errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse
    const { searchParams } = request.nextUrl
    const search = searchParams.get('search')?.trim() ?? ''
    const status = searchParams.get('status') ?? ''
    const paymentStatus = searchParams.get('payment_status') ?? ''

    let query = supabaseAdmin
      .from('employment_applications')
      .select('*')
      .order('created_at', { ascending: false })

    if (search) {
      const clean = search.replace(/-/g, '')
      let hyphenated = ''
      if (/^\d{4,}$/.test(clean)) {
        hyphenated = clean.length >= 10
          ? `${clean.slice(0,3)}-${clean.slice(3,7)}-${clean.slice(7)}`
          : `${clean.slice(0,3)}-${clean.slice(3)}`
      }
      const contactPatterns = [search, ...(hyphenated && hyphenated !== search ? [hyphenated] : [])]
      const orParts = [`name.ilike.%${search}%`, ...contactPatterns.map(p => `contact.ilike.%${p}%`)]
      query = query.or(orParts.join(','))
    }

    if (status) {
      query = query.eq('status', status)
    }

    if (paymentStatus) {
      query = query.eq('payment_status', paymentStatus)
    }

    const { data, error } = await query

    if (error) {
      console.error('[GET /api/practice/employment] Supabase error:', error)
      return NextResponse.json(
        { error: '데이터를 불러오는데 실패했습니다.', detail: error.message },
        { status: 500 }
      )
    }

    const items = data ?? [];
    if (items.length > 0) {
      const ids = items.map(item => String(item.id));
      const { data: memoRows } = await supabaseAdmin
        .from('memo_logs')
        .select('record_id')
        .eq('table_name', 'employment_applications')
        .in('record_id', ids);
      const countMap: Record<string, number> = {};
      for (const m of memoRows || []) {
        countMap[m.record_id] = (countMap[m.record_id] || 0) + 1;
      }
      return NextResponse.json(items.map(item => ({ ...item, memo_count: countMap[String(item.id)] || 0 })));
    }
    return NextResponse.json(items)
  } catch (err) {
    console.error('[GET /api/practice/employment] Unexpected error:', err)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/practice/employment
 * 관리자가 수동으로 취업신청 추가
 */
export async function POST(request: NextRequest) {
  try {
    const { user, errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse
    const body = await request.json()
    const { name, gender, contact, birth_date, address, address_detail, desired_job_field, employment_types, has_resume, certifications, click_source, manager, memo } = body

    if (!name || !contact) {
      return NextResponse.json({ error: '이름과 연락처는 필수입니다.' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('employment_applications')
      .insert([{
        name, gender: gender || null, contact,
        birth_date: birth_date || null,
        address: address || null, address_detail: address_detail || null,
        desired_job_field: desired_job_field || null,
        employment_types: employment_types || [],
        has_resume: has_resume ?? null,
        certifications: certifications || null,
        click_source: click_source || null,
        manager: manager || null,
        memo: memo || null,
        payment_amount: 0,
        payment_status: 'confirmed',
        privacy_agreed: true,
        terms_agreed: true,
        status: 'pending',
      }])
      .select()
      .single()

    if (error) {
      console.error('[POST /api/practice/employment] Supabase error:', error)
      return NextResponse.json({ error: '등록에 실패했습니다.', detail: error.message }, { status: 500 })
    }

    await logAction({ user_id: user.id, user_email: user.email, action: 'create', resource: '취업신청', resource_id: String(data.id), detail: `${data.name} 취업신청 등록` })
    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('[POST /api/practice/employment] Unexpected error:', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

/**
 * PATCH /api/practice/employment
 * 바디: { id: string, ...업데이트할 필드 }
 * 업데이트 허용 필드: status, memo, manager, payment_status
 */
export async function PATCH(request: NextRequest) {
  try {
    const { user, errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse
    const body = await request.json()
    const { id, ...fields } = body as { id: string } & Partial<EmploymentApplication>

    if (!id) {
      return NextResponse.json({ error: 'id는 필수 항목입니다.' }, { status: 400 })
    }

    const ALLOWED_FIELDS: (keyof EmploymentApplication)[] = [
      'status', 'memo', 'manager', 'payment_status',
      'name', 'gender', 'contact', 'birth_date',
      'address', 'address_detail',
      'desired_job_field', 'employment_types', 'has_resume', 'certifications', 'click_source',
    ]

    const updatePayload: Partial<EmploymentApplication> = {}
    for (const key of ALLOWED_FIELDS) {
      if (key in fields) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(updatePayload as any)[key] = (fields as any)[key]
      }
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: '업데이트할 필드가 없습니다.' }, { status: 400 })
    }

    const { data: current } = await supabaseAdmin.from('employment_applications').select('*').eq('id', id).single()

    const { data, error } = await supabaseAdmin
      .from('employment_applications')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[PATCH /api/practice/employment] Supabase error:', error)
      return NextResponse.json(
        { error: '업데이트에 실패했습니다.', detail: error.message },
        { status: 500 }
      )
    }

    const changes: Record<string, { before: unknown; after: unknown }> = {}
    for (const [key, newVal] of Object.entries(updatePayload as Record<string, unknown>)) {
      changes[key] = { before: (current as Record<string, unknown>)?.[key] ?? null, after: newVal }
    }
    await logAction({ user_id: user.id, user_email: user.email, action: 'update', resource: '취업신청', resource_id: String(id), detail: `${current?.name ?? `ID ${id}`} 수정`, meta: { changes } })
    return NextResponse.json(data)
  } catch (err) {
    console.error('[PATCH /api/practice/employment] Unexpected error:', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

/**
 * DELETE /api/practice/employment
 * 바디: { ids: string[] }
 */
export async function DELETE(request: NextRequest) {
  try {
    const { user, errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse
    const body = await request.json()
    const { ids } = body as { ids: string[] }

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids 배열이 필요합니다.' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('employment_applications')
      .delete()
      .in('id', ids)
      .select()

    if (error) {
      console.error('[DELETE /api/practice/employment] Supabase error:', error)
      return NextResponse.json(
        { error: '삭제에 실패했습니다.', detail: error.message },
        { status: 500 }
      )
    }

    await logAction({ user_id: user.id, user_email: user.email, action: 'delete', resource: '취업신청', resource_id: ids.join(','), detail: `${ids.length}건 삭제`, meta: { ids } })
    return NextResponse.json({ message: '삭제되었습니다.', data })
  } catch (err) {
    console.error('[DELETE /api/practice/employment] Unexpected error:', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
