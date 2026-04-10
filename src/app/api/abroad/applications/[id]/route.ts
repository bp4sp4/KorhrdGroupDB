import { requireAuth } from '@/lib/auth/requireAuth'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

async function signed(path: string | null) {
  if (!path) return null
  const { data } = await supabaseAdmin.storage
    .from('application-files')
    .createSignedUrl(path, 3600)
  return data?.signedUrl ?? null
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const { id } = await params
  const body = await request.json()

  const ALLOWED_FIELDS = [
    'status', 'program',
    'name', 'english_name', 'gender', 'blood_type', 'birth_date', 'birth_city',
    'email', 'phone', 'school_type', 'school', 'school_grade', 'address', 'address_detail',
    'passport_name', 'passport_number', 'passport_expiry',
    'guardian_name', 'guardian_phone', 'guardian_email', 'guardian_birth_city',
    'english_level', 'swim_level', 'allergies',
    'self_intro', 'family_intro', 'homestay_notes', 'personality',
    'hobbies', 'special_notes', 'health_notes', 'extra_notes',
  ]

  const updates: Record<string, unknown> = {}
  for (const key of ALLOWED_FIELDS) {
    if (key in body) updates[key] = body[key]
  }

  const { data, error } = await supabaseAdmin
    .from('applications')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ app: data })
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const { id } = await params

  const { data: app, error } = await supabaseAdmin
    .from('applications')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !app) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const [passportUrl, idPhotoUrl, guardianPassportUrl, guardianPhotoUrl, participantSigUrl, guardianSigUrl] =
    await Promise.all([
      signed(app.passport_file_url),
      signed(app.id_photo_url),
      signed(app.guardian_passport_url),
      signed(app.guardian_photo_url),
      signed(app.participant_sig_url),
      signed(app.guardian_sig_url),
    ])

  return NextResponse.json({
    app,
    signedUrls: { passportUrl, idPhotoUrl, guardianPassportUrl, guardianPhotoUrl, participantSigUrl, guardianSigUrl },
  })
}
