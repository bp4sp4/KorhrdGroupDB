import { requireAuth } from '@/lib/auth/requireAuth'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// POST: 사진 업로드 및 photo_url 업데이트
export async function POST(request: NextRequest) {
  try {
    const { errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse

    const formData = await request.formData()
    const id = formData.get('id') as string | null
    const photo = formData.get('photo') as File | null

    if (!id) {
      return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 })
    }
    if (!photo || photo.size === 0) {
      return NextResponse.json({ error: '사진 파일이 필요합니다.' }, { status: 400 })
    }

    const ext = photo.name.split('.').pop() || 'jpg'
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
    const buffer = Buffer.from(await photo.arrayBuffer())

    const { error: uploadError } = await supabaseAdmin.storage
      .from('photos')
      .upload(fileName, buffer, { contentType: photo.type })

    if (uploadError) {
      console.error('[cert/photo POST] Upload error:', uploadError)
      return NextResponse.json({ error: '사진 업로드에 실패했습니다.' }, { status: 500 })
    }

    const { data, error } = await supabaseAdmin
      .from('certificate_applications')
      .update({ photo_url: fileName })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: '사진 URL 저장에 실패했습니다.' }, { status: 500 })
    }

    return NextResponse.json({ photo_url: fileName, data })
  } catch (err) {
    console.error('[cert/photo POST] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
