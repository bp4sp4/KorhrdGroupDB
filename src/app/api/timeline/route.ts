import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/requireAuth'
import { supabaseAdmin } from '@/lib/supabase/admin'

const TABLE_RESOURCE_MAP: Record<string, string> = {
  hakjeom_consultations:       '학점은행제 상담',
  private_cert_consultations:  '민간자격증 상담',
  practice_consultations:      '실습/취업 상담',
  practice_applications:       '실습섭외신청',
  employment_applications:     '취업신청',
  agency_agreements:           '기관협약',
  certificate_applications:    '자격증신청',
}

export type TimelineEventType = 'memo' | 'status_change' | 'create'

export interface TimelineEvent {
  id: string
  type: TimelineEventType
  author: string | null
  created_at: string
  // memo
  content?: string
  memoId?: string
  // status_change
  statusBefore?: string
  statusAfter?: string
}

export async function GET(req: NextRequest) {
  const { errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  const table = req.nextUrl.searchParams.get('table')
  const id    = req.nextUrl.searchParams.get('id')

  if (!table || !id || !TABLE_RESOURCE_MAP[table]) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  const resource = TABLE_RESOURCE_MAP[table]

  const [memoResult, auditResult] = await Promise.all([
    supabaseAdmin
      .from('memo_logs')
      .select('id, content, author, created_at')
      .eq('table_name', table)
      .eq('record_id', id)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('audit_logs')
      .select('id, action, user_email, meta, created_at')
      .eq('resource_id', id)
      .eq('resource', resource)
      .in('action', ['create', 'update'])
      .order('created_at', { ascending: false }),
  ])

  const memoEvents: TimelineEvent[] = (memoResult.data || []).map(m => ({
    id: `memo-${m.id}`,
    type: 'memo',
    author: m.author,
    created_at: m.created_at,
    content: m.content,
    memoId: m.id,
  }))

  const auditEvents: TimelineEvent[] = (auditResult.data || []).flatMap((a): TimelineEvent[] => {
    if (a.action === 'create') {
      return [{
        id: `audit-${a.id}`,
        type: 'create' as const,
        author: a.user_email,
        created_at: a.created_at,
      }]
    }

    const changes = (a.meta as Record<string, unknown> | null)
      ?.changes as Record<string, { before: unknown; after: unknown }> | undefined

    if (changes?.status) {
      return [{
        id: `audit-${a.id}`,
        type: 'status_change' as const,
        author: a.user_email,
        created_at: a.created_at,
        statusBefore: String(changes.status.before ?? ''),
        statusAfter:  String(changes.status.after  ?? ''),
      }]
    }

    return []
  })

  const events = [...memoEvents, ...auditEvents].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  return NextResponse.json(events)
}
