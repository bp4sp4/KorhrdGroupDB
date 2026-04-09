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
