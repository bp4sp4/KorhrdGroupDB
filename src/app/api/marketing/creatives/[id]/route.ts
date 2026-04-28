import { requireAuth } from '@/lib/auth/requireAuth'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

const BUCKET = 'marketing-creatives'

function publicUrl(path: string | null): string | null {
  if (!path) return null
  const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path)
  return data?.publicUrl ?? null
}

async function ensureBucket(): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: buckets, error: listErr } = await supabaseAdmin.storage.listBuckets()
  if (listErr) return { ok: false, error: listErr.message }
  if ((buckets ?? []).some((b) => b.name === BUCKET)) return { ok: true }
  const { error: createErr } = await supabaseAdmin.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  })
  if (createErr) return { ok: false, error: createErr.message }
  return { ok: true }
}

// ─── PATCH: 소재 수정 (multipart/form-data) ───────────────────────────────────
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse

    const { id } = await params

    const formData = await request.formData()
    const updateData: Record<string, unknown> = {}

    const channel = formData.get('channel'); if (channel) updateData.channel = String(channel)
    const name = formData.get('name'); if (name) updateData.name = String(name).trim()
    const campaignRaw = formData.get('campaign')
    if (campaignRaw !== null) updateData.campaign = String(campaignRaw).trim() || null
    const type = formData.get('type'); if (type) updateData.type = String(type)
    const status = formData.get('status'); if (status) updateData.status = String(status)
    const registeredAt = formData.get('registered_at'); if (registeredAt) updateData.registered_at = String(registeredAt)

    const numFields: [string, string][] = [
      ['impressions', 'impressions'],
      ['clicks', 'clicks'],
      ['db_count', 'db_count'],
      ['registrations', 'registrations'],
      ['ad_cost', 'ad_cost'],
    ]
    for (const [field, col] of numFields) {
      const v = formData.get(field)
      if (v !== null && v !== '') updateData[col] = Number(v)
    }

    // 썸네일 처리 — 새 파일이면 교체, remove_thumbnail=1 이면 제거
    const thumbnail = formData.get('thumbnail') as File | null
    const removeThumbnail = formData.get('remove_thumbnail') === '1'

    if (thumbnail && thumbnail.size > 0) {
      const ensure = await ensureBucket()
      if (!ensure.ok) {
        return NextResponse.json({ error: `버킷 생성 실패: ${ensure.error}` }, { status: 500 })
      }
      // 기존 썸네일 path 조회
      const { data: existing } = await supabaseAdmin
        .from('marketing_creatives')
        .select('thumbnail_path, division, channel')
        .eq('id', id)
        .single()

      const ext = thumbnail.name.split('.').pop()?.toLowerCase() ?? 'jpg'
      const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
      const newChannel = (updateData.channel as string) ?? existing?.channel ?? 'etc'
      const path = `${existing?.division ?? 'nms'}/${newChannel}/${fileName}`

      const buffer = Buffer.from(await thumbnail.arrayBuffer())
      const { error: uploadError } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(path, buffer, { contentType: thumbnail.type || 'image/jpeg', upsert: false })

      if (uploadError) {
        return NextResponse.json({ error: `썸네일 업로드 실패: ${uploadError.message}` }, { status: 400 })
      }
      updateData.thumbnail_path = path

      // 기존 파일 정리
      if (existing?.thumbnail_path) {
        await supabaseAdmin.storage.from(BUCKET).remove([existing.thumbnail_path]).catch(() => {})
      }
    } else if (removeThumbnail) {
      const { data: existing } = await supabaseAdmin
        .from('marketing_creatives')
        .select('thumbnail_path')
        .eq('id', id)
        .single()
      if (existing?.thumbnail_path) {
        await supabaseAdmin.storage.from(BUCKET).remove([existing.thumbnail_path]).catch(() => {})
      }
      updateData.thumbnail_path = null
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: '수정할 항목이 없습니다.' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('marketing_creatives')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      console.error('[creatives PATCH] update error:', error)
      return NextResponse.json({ error: '수정 실패' }, { status: 500 })
    }

    return NextResponse.json({ id: String(data.id), thumbnailUrl: publicUrl(data.thumbnail_path) })
  } catch (err) {
    console.error('[creatives PATCH] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── DELETE: 소재 삭제 ────────────────────────────────────────────────────────
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse

    const { id } = await params

    // 썸네일 path 조회 후 삭제
    const { data: existing } = await supabaseAdmin
      .from('marketing_creatives')
      .select('thumbnail_path')
      .eq('id', id)
      .single()

    if (existing?.thumbnail_path) {
      await supabaseAdmin.storage.from(BUCKET).remove([existing.thumbnail_path]).catch(() => {})
    }

    const { error } = await supabaseAdmin
      .from('marketing_creatives')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[creatives DELETE] error:', error)
      return NextResponse.json({ error: '삭제 실패' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[creatives DELETE] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
