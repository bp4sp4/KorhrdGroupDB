import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

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
    const { searchParams } = request.nextUrl
    const search = searchParams.get('search')?.trim() ?? ''
    const status = searchParams.get('status') ?? ''
    const paymentStatus = searchParams.get('payment_status') ?? ''

    let query = supabaseAdmin
      .from('employment_applications')
      .select('*')
      .order('created_at', { ascending: false })

    if (search) {
      query = query.or(`name.ilike.%${search}%,contact.ilike.%${search}%`)
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

    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error('[GET /api/practice/employment] Unexpected error:', err)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/practice/employment
 * 바디: { id: string, ...업데이트할 필드 }
 * 업데이트 허용 필드: status, memo, manager, payment_status
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...fields } = body as { id: string } & Partial<EmploymentApplication>

    if (!id) {
      return NextResponse.json({ error: 'id는 필수 항목입니다.' }, { status: 400 })
    }

    const ALLOWED_FIELDS: (keyof EmploymentApplication)[] = [
      'status',
      'memo',
      'manager',
      'payment_status',
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

    return NextResponse.json({ message: '삭제되었습니다.', data })
  } catch (err) {
    console.error('[DELETE /api/practice/employment] Unexpected error:', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
