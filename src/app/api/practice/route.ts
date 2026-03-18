import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// practice_consultations 테이블의 레코드 타입
export type PracticeConsultationStatus =
  | '상담대기'
  | '상담중'
  | '보류'
  | '등록대기'
  | '등록완료'

export type PracticeConsultationType = 'consultation' | 'practice' | 'employment'

export interface PracticeConsultation {
  id: number
  name: string
  contact: string
  type: PracticeConsultationType | null
  progress: string | null
  employment_consulting: boolean
  employment_connection: boolean
  student_status: string | null
  practice_place: string | null
  employment_after_cert: string | null
  education: string | null
  hope_course: string | null
  reason: string | null
  click_source: string | null
  memo: string | null
  status: PracticeConsultationStatus
  subject_cost: number | null
  manager: string | null
  residence: string | null
  study_method: string | null
  address: string | null
  is_completed: boolean | null
  notes: string | null
  service_practice: boolean
  service_employment: boolean
  practice_planned_date: string | null
  employment_hope_time: string | null
  employment_support_fund: boolean | null
  created_at: string
  updated_at: string
}

/**
 * GET /api/practice
 * 쿼리 파라미터:
 *   - search: 이름 또는 연락처 검색 (부분 일치)
 *   - status: 상태 필터 (상담대기 | 상담중 | 보류 | 등록대기 | 등록완료)
 *   - type: 유형 필터 (consultation | practice | employment)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const search = searchParams.get('search')?.trim() ?? ''
    const status = searchParams.get('status') ?? ''
    const type = searchParams.get('type') ?? ''

    let query = supabaseAdmin
      .from('practice_consultations')
      .select('*')
      .order('created_at', { ascending: false })

    // 이름 또는 연락처 검색 (OR 조건)
    if (search) {
      query = query.or(`name.ilike.%${search}%,contact.ilike.%${search}%`)
    }

    // 상태 필터
    if (status) {
      query = query.eq('status', status)
    }

    // 유형 필터
    if (type) {
      query = query.eq('type', type)
    }

    const { data, error } = await query

    if (error) {
      console.error('[GET /api/practice] Supabase error:', error)
      return NextResponse.json(
        { error: '데이터를 불러오는데 실패했습니다.', detail: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error('[GET /api/practice] Unexpected error:', err)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/practice
 * 바디: { name, contact, ...선택 필드 }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, contact, ...rest } = body as Partial<PracticeConsultation> & { name: string; contact: string }

    if (!name?.trim() || !contact?.trim()) {
      return NextResponse.json({ error: '이름과 연락처는 필수입니다.' }, { status: 400 })
    }

    const ALLOWED_INSERT_FIELDS: (keyof PracticeConsultation)[] = [
      'type', 'education', 'hope_course', 'residence', 'address', 'study_method',
      'progress', 'practice_place', 'employment_after_cert', 'student_status',
      'reason', 'click_source', 'memo', 'manager', 'subject_cost',
      'service_practice', 'service_employment', 'employment_hope_time',
      'employment_support_fund', 'practice_planned_date',
    ]

    const insertPayload: Record<string, unknown> = { name: name.trim(), contact: contact.trim(), status: '상담대기' }
    for (const key of ALLOWED_INSERT_FIELDS) {
      if (key in rest) insertPayload[key] = (rest as Record<string, unknown>)[key]
    }

    const { data, error } = await supabaseAdmin
      .from('practice_consultations')
      .insert(insertPayload)
      .select()
      .single()

    if (error) {
      console.error('[POST /api/practice] Supabase error:', error)
      return NextResponse.json({ error: '저장에 실패했습니다.', detail: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('[POST /api/practice] Unexpected error:', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

/**
 * PATCH /api/practice
 * 바디: { id: number, ...업데이트할 필드 }
 * id 필드는 필수. 업데이트 가능 필드: status, memo, manager, notes, progress, practice_place,
 *   employment_hope_time, practice_planned_date, subject_cost, is_completed
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...fields } = body as { id: number } & Partial<PracticeConsultation>

    if (!id) {
      return NextResponse.json(
        { error: 'id는 필수 항목입니다.' },
        { status: 400 }
      )
    }

    // 업데이트 허용 필드만 추출 (보안: 임의 필드 업데이트 방지)
    const ALLOWED_FIELDS: (keyof PracticeConsultation)[] = [
      'status',
      'memo',
      'manager',
      'notes',
      'progress',
      'practice_place',
      'employment_hope_time',
      'practice_planned_date',
      'subject_cost',
      'is_completed',
      'service_practice',
      'service_employment',
      'employment_support_fund',
      'type',
      'education',
      'hope_course',
      'residence',
      'address',
      'study_method',
    ]

    const updatePayload: Partial<PracticeConsultation> = {}
    for (const key of ALLOWED_FIELDS) {
      if (key in fields) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(updatePayload as any)[key] = (fields as any)[key]
      }
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json(
        { error: '업데이트할 필드가 없습니다.' },
        { status: 400 }
      )
    }

    // updated_at 자동 갱신
    const { data, error } = await supabaseAdmin
      .from('practice_consultations')
      .update({ ...updatePayload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[PATCH /api/practice] Supabase error:', error)
      return NextResponse.json(
        { error: '업데이트에 실패했습니다.', detail: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('[PATCH /api/practice] Unexpected error:', err)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/practice
 * 바디: { ids: number[] }
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { ids } = body as { ids: number[] }

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids 배열이 필요합니다.' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('practice_consultations')
      .delete()
      .in('id', ids)
      .select()

    if (error) {
      console.error('[DELETE /api/practice] Supabase error:', error)
      return NextResponse.json(
        { error: '삭제에 실패했습니다.', detail: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ message: '삭제되었습니다.', data })
  } catch (err) {
    console.error('[DELETE /api/practice] Unexpected error:', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
