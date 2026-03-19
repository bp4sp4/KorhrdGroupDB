import { requireAuth } from '@/lib/auth/requireAuth'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export interface PracticeApplication {
  id: string
  name: string
  gender: string | null
  contact: string
  birth_date: string | null
  address: string | null
  address_detail: string | null
  zonecode: string | null
  practice_type: string | null
  desired_job_field: string | null
  employment_types: string[] | null
  has_resume: boolean
  certifications: string | null
  payment_amount: number | null
  payment_status: string | null
  payment_id: string | null
  privacy_agreed: boolean
  terms_agreed: boolean
  click_source: string | null
  status: string
  memo: string | null
  manager: string | null
  created_at: string
  updated_at: string
}

/**
 * GET /api/practice/applications
 */
export async function GET(request: NextRequest) {
  try {
    const { user: _user, errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse
    const { searchParams } = request.nextUrl
    const search = searchParams.get('search')?.trim() ?? ''
    const status = searchParams.get('status') ?? ''

    let query = supabaseAdmin
      .from('practice_applications')
      .select('*')
      .order('created_at', { ascending: false })

    if (search) {
      query = query.or(`name.ilike.%${search}%,contact.ilike.%${search}%`)
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
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

/**
 * POST /api/practice/applications
 * 관리자 수동 등록
 */
export async function POST(request: NextRequest) {
  try {
    const { user: _user, errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse
    const body = await request.json()
    const { name, gender, contact, birth_date, address, address_detail, practice_type, desired_job_field, employment_types, has_resume, certifications, manager, memo } = body

    if (!name || !contact) {
      return NextResponse.json({ error: '이름과 연락처는 필수입니다.' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('practice_applications')
      .insert([{
        name, gender: gender || null, contact,
        birth_date: birth_date || null,
        address: address || null, address_detail: address_detail || null,
        practice_type: practice_type || null,
        desired_job_field: desired_job_field || null,
        employment_types: employment_types || [],
        has_resume: has_resume ?? false,
        certifications: certifications || null,
        manager: manager || null, memo: memo || null,
        payment_amount: 0, payment_status: 'confirmed',
        privacy_agreed: true, terms_agreed: true, status: '대기',
      }])
      .select()
      .single()

    if (error) {
      console.error('[POST /api/practice/applications] Supabase error:', error)
      return NextResponse.json({ error: '등록에 실패했습니다.', detail: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('[POST /api/practice/applications] Unexpected error:', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

/**
 * PATCH /api/practice/applications
 */
export async function PATCH(request: NextRequest) {
  try {
    const { user: _user, errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse
    const body = await request.json()
    const { id, ...fields } = body as { id: string } & Partial<PracticeApplication>

    if (!id) {
      return NextResponse.json({ error: 'id는 필수 항목입니다.' }, { status: 400 })
    }

    const ALLOWED_FIELDS: (keyof PracticeApplication)[] = [
      'status', 'memo', 'manager',
      'practice_type', 'desired_job_field', 'employment_types',
      'certifications', 'payment_amount', 'payment_status', 'click_source',
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
 */
export async function DELETE(request: NextRequest) {
  try {
    const { user: _user, errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse
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
