import { NextRequest, NextResponse } from 'next/server'
import { requireAuthFull } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

// 실습 사업부 "실습신청자" API
// 데이터는 CSV 로 직접 import. 여기서는 조회 / 상태변경 / 편집 / 삭제만 담당.

export const STATUS_OPTIONS = [
  // 현행 상태값 (상세/상태변경 팝업과 동일)
  '입금대기',
  '입금완료',
  '교육원 연계',
  '교육원 연계 완료',
  '교육원 재연계',
  '기관 연계',
  '기관 연계 완료',
  '기관 재연계',
  '실습 연기',
  '실습 완료',
  '환불',
  // 레거시 값 (기존 데이터 호환)
  '확인필요',
  '추후진행예정',
  '재연계',
] as const

// 카테고리 구분 (페이지)
export const CATEGORY_OPTIONS = ['타과정', '사회복지사', '완료', '환불'] as const

// 편집 가능한 컬럼 (id / created_at / updated_at 제외)
const EDITABLE_FIELDS = [
  'category',
  'seq_no',
  'name',
  'contact',
  'birth_date',
  'address',
  'desired_date',
  'practice_type',
  'desired_weekday',
  'recognition_period',
  'training_center',
  'field_institution',
  'status',
  'counsel_content',
  'certifications',
  'amount',
  'manager',
  'gender',
  'cash_receipt_number',
  'own_car',
  'desired_semester',
  'grade_report_date',
  'center_open_date',
] as const

const SELECT_COLS =
  'id, category, seq_no, name, contact, birth_date, address, desired_date, practice_type, desired_weekday, recognition_period, training_center, field_institution, status, counsel_content, certifications, amount, manager, gender, cash_receipt_number, own_car, desired_semester, grade_report_date, center_open_date, created_at, updated_at'

// GET /api/practice-applicants?category=... — 목록 (정렬: 번호 → 생성일)
export async function GET(request: NextRequest) {
  const { errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse

  const category = new URL(request.url).searchParams.get('category')

  let query = supabaseAdmin
    .from('practice_applicants')
    .select(SELECT_COLS)
    .order('seq_no', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(5000)

  if (category) query = query.eq('category', category)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ rows: data ?? [] })
}

// PATCH /api/practice-applicants — { id, patch: {...} }
export async function PATCH(request: NextRequest) {
  const { errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse

  const body = (await request.json().catch(() => null)) as {
    id?: number
    patch?: Record<string, unknown>
  } | null
  const id = Number(body?.id)
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 })
  }

  const patch: Record<string, unknown> = {}
  for (const key of EDITABLE_FIELDS) {
    if (body?.patch && key in body.patch) {
      let v = body.patch[key]
      if (v === '') v = null
      if ((key === 'seq_no' || key === 'amount') && v !== null) {
        const n = Number(v)
        v = Number.isFinite(n) ? n : null
      }
      patch[key] = v
    }
  }

  if (
    typeof patch.status === 'string' &&
    !STATUS_OPTIONS.includes(patch.status as (typeof STATUS_OPTIONS)[number])
  ) {
    return NextResponse.json({ error: '잘못된 상태값입니다.' }, { status: 400 })
  }

  if (
    typeof patch.category === 'string' &&
    !CATEGORY_OPTIONS.includes(patch.category as (typeof CATEGORY_OPTIONS)[number])
  ) {
    return NextResponse.json({ error: '잘못된 카테고리입니다.' }, { status: 400 })
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: '변경할 항목이 없습니다.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('practice_applicants')
    .update(patch)
    .eq('id', id)
    .select(SELECT_COLS)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ row: data })
}

// POST /api/practice-applicants — { patch: {...} } 신규 추가
export async function POST(request: NextRequest) {
  const { errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse

  const body = (await request.json().catch(() => null)) as {
    patch?: Record<string, unknown>
  } | null

  const patch: Record<string, unknown> = {}
  for (const key of EDITABLE_FIELDS) {
    if (body?.patch && key in body.patch) {
      let v = body.patch[key]
      if (v === '') v = null
      if ((key === 'seq_no' || key === 'amount') && v !== null) {
        const n = Number(v)
        v = Number.isFinite(n) ? n : null
      }
      patch[key] = v
    }
  }

  if (typeof patch.name !== 'string' || !patch.name.trim()) {
    return NextResponse.json({ error: '이름은 필수입니다.' }, { status: 400 })
  }
  if (
    typeof patch.status === 'string' &&
    !STATUS_OPTIONS.includes(patch.status as (typeof STATUS_OPTIONS)[number])
  ) {
    return NextResponse.json({ error: '잘못된 상태값입니다.' }, { status: 400 })
  }
  if (
    typeof patch.category === 'string' &&
    !CATEGORY_OPTIONS.includes(patch.category as (typeof CATEGORY_OPTIONS)[number])
  ) {
    return NextResponse.json({ error: '잘못된 카테고리입니다.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('practice_applicants')
    .insert(patch)
    .select(SELECT_COLS)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ row: data })
}

// DELETE /api/practice-applicants?id=123  또는  ?ids=1,2,3 (다중 삭제)
export async function DELETE(request: NextRequest) {
  const { errorResponse } = await requireAuthFull()
  if (errorResponse) return errorResponse

  const params = new URL(request.url).searchParams
  const idsParam = params.get('ids')
  const ids = (
    idsParam ? idsParam.split(',') : [params.get('id') ?? '']
  )
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n))

  if (ids.length === 0) {
    return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('practice_applicants')
    .delete()
    .in('id', ids)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, deleted: ids.length })
}
