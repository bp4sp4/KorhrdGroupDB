import { requireAuth } from '@/lib/auth/requireAuth'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export interface CreativeRow {
  id: string
  division: string
  channel: string
  name: string
  campaign: string | null
  type: string
  thumbnailUrl: string | null
  impressions: number
  clicks: number
  dbCount: number
  registrations: number
  adCost: number
  status: string
  registeredAt: string
}

const BUCKET = 'marketing-creatives'

function publicUrl(path: string | null): string | null {
  if (!path) return null
  const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path)
  return data?.publicUrl ?? null
}

/** 버킷이 없으면 public 버킷으로 자동 생성 */
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

// ─── GET: 소재 목록 ───────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse

    const { searchParams } = new URL(request.url)
    const division = searchParams.get('division')

    let query = supabaseAdmin
      .from('marketing_creatives')
      .select('*')
      .order('registered_at', { ascending: false })
      .order('id', { ascending: false })

    if (division) query = query.eq('division', division)

    const { data, error } = await query
    if (error) {
      console.error('[creatives GET] error:', error)
      return NextResponse.json({ error: '데이터 조회 실패' }, { status: 500 })
    }

    const result: CreativeRow[] = (data ?? []).map((r) => ({
      id: String(r.id),
      division: r.division,
      channel: r.channel,
      name: r.name,
      campaign: r.campaign,
      type: r.type,
      thumbnailUrl: publicUrl(r.thumbnail_path),
      impressions: Number(r.impressions),
      clicks: Number(r.clicks),
      dbCount: Number(r.db_count),
      registrations: Number(r.registrations),
      adCost: Number(r.ad_cost),
      status: r.status,
      registeredAt: r.registered_at,
    }))

    return NextResponse.json(result)
  } catch (err) {
    console.error('[creatives GET] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── POST: 소재 등록 (multipart/form-data) ────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const { errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse

    const formData = await request.formData()
    const division = String(formData.get('division') ?? '')
    const channel = String(formData.get('channel') ?? '')
    const name = String(formData.get('name') ?? '').trim()
    const campaign = String(formData.get('campaign') ?? '').trim() || null
    const type = String(formData.get('type') ?? '')
    const status = String(formData.get('status') ?? '활성')
    const registeredAt = String(formData.get('registered_at') ?? '') || new Date().toISOString().slice(0, 10)
    const impressions = Number(formData.get('impressions') ?? 0)
    const clicks = Number(formData.get('clicks') ?? 0)
    const dbCount = Number(formData.get('db_count') ?? 0)
    const registrations = Number(formData.get('registrations') ?? 0)
    const adCost = Number(formData.get('ad_cost') ?? 0)
    const thumbnail = formData.get('thumbnail') as File | null

    if (!division || !channel || !name || !type) {
      return NextResponse.json({ error: 'division, channel, name, type 은 필수입니다.' }, { status: 400 })
    }

    // 썸네일 업로드 (있으면)
    let thumbnailPath: string | null = null
    if (thumbnail && thumbnail.size > 0) {
      const ensure = await ensureBucket()
      if (!ensure.ok) {
        return NextResponse.json({ error: `버킷 생성 실패: ${ensure.error}` }, { status: 500 })
      }
      const ext = thumbnail.name.split('.').pop()?.toLowerCase() ?? 'jpg'
      const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
      const path = `${division}/${channel}/${fileName}`

      const buffer = Buffer.from(await thumbnail.arrayBuffer())
      const { error: uploadError } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(path, buffer, {
          contentType: thumbnail.type || 'image/jpeg',
          upsert: false,
        })

      if (uploadError) {
        console.error('[creatives POST] storage error:', uploadError)
        return NextResponse.json({ error: `썸네일 업로드 실패: ${uploadError.message}` }, { status: 400 })
      }
      thumbnailPath = path
    }

    const { data, error } = await supabaseAdmin
      .from('marketing_creatives')
      .insert({
        division, channel, name, campaign, type,
        thumbnail_path: thumbnailPath,
        impressions, clicks,
        db_count: dbCount,
        registrations,
        ad_cost: adCost,
        status,
        registered_at: registeredAt,
      })
      .select('*')
      .single()

    if (error) {
      console.error('[creatives POST] insert error:', error)
      return NextResponse.json({ error: '저장 실패' }, { status: 500 })
    }

    return NextResponse.json({
      id: String(data.id),
      thumbnailUrl: publicUrl(data.thumbnail_path),
    }, { status: 201 })
  } catch (err) {
    console.error('[creatives POST] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
