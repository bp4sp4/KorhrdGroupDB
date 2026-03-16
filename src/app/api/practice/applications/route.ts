import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// practice_applications 테이블 타입 (korhrdsocialform의 구조 참조)
export interface PracticeApplication {
  id: string
  student_name: string
  gender: string | null
  contact: string
  birth_date: string | null
  residence_area: string | null
  address: string | null
  practice_start_date: string | null
  grade_report_date: string | null
  preferred_semester: string | null
  practice_type: string | null
  preferred_days: string | null
  has_car: boolean
  cash_receipt_number: string | null
  privacy_agreed: boolean
  practice_place: string | null
  click_source: string | null
  status: string
  memo: string | null
  manager: string | null
  created_at: string
  updated_at: string
}

/**
 * GET /api/practice/applications
 * 쿼리 파라미터:
 *   - search: student_name 또는 contact 검색 (부분 일치)
 *   - status: 상태 필터
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const search = searchParams.get('search')?.trim() ?? ''
    const status = searchParams.get('status') ?? ''

    let query = supabaseAdmin
      .from('practice_applications')
      .select('*')
      .order('created_at', { ascending: false })

    if (search) {
      query = query.or(`student_name.ilike.%${search}%,contact.ilike.%${search}%`)
    }

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) {
      console.error('[GET /api/practice/applications] Supabase error:', error)
      return NextResponse.json(
        { error: '데이터를 불러오는데 실패했습니다.', detail: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error('[GET /api/practice/applications] Unexpected error:', err)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/practice/applications
 * 바디: { id: string, ...업데이트할 필드 }
 * 업데이트 허용 필드: status, memo, manager, practice_place
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...fields } = body as { id: string } & Partial<PracticeApplication>

    if (!id) {
      return NextResponse.json({ error: 'id는 필수 항목입니다.' }, { status: 400 })
    }

    const ALLOWED_FIELDS: (keyof PracticeApplication)[] = [
      'status',
      'memo',
      'manager',
      'practice_place',
    ]

    const updatePayload: Partial<PracticeApplication> = {}
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
      .from('practice_applications')
      .update({ ...updatePayload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[PATCH /api/practice/applications] Supabase error:', error)
      return NextResponse.json(
        { error: '업데이트에 실패했습니다.', detail: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('[PATCH /api/practice/applications] Unexpected error:', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

/**
 * DELETE /api/practice/applications
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
      .from('practice_applications')
      .delete()
      .in('id', ids)
      .select()

    if (error) {
      console.error('[DELETE /api/practice/applications] Supabase error:', error)
      return NextResponse.json(
        { error: '삭제에 실패했습니다.', detail: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ message: '삭제되었습니다.', data })
  } catch (err) {
    console.error('[DELETE /api/practice/applications] Unexpected error:', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
