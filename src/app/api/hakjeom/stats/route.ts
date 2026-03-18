import { requireAuth } from '@/lib/auth/requireAuth'
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

// ─── 타입 ────────────────────────────────────────────────────────────────────

type StatsType = 'hakjeom' | 'private_cert' | 'all';

// ─── GET: 통계용 데이터 전체 반환 ─────────────────────────────────────────────
// Query params: type=hakjeom|private_cert|all (default: hakjeom)

export async function GET(request: NextRequest) {
  try {
    const { user: _user, errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Supabase configuration missing' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const type = (searchParams.get('type') ?? 'hakjeom') as StatsType;

    const SELECT_FIELDS = 'id, status, click_source, hope_course, counsel_check, created_at';

    if (type === 'hakjeom') {
      const { data, error } = await supabaseAdmin
        .from('hakjeom_consultations')
        .select(SELECT_FIELDS)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[stats GET] hakjeom error:', error);
        return NextResponse.json({ error: 'Failed to fetch hakjeom stats' }, { status: 500 });
      }

      return NextResponse.json(data ?? []);
    }

    if (type === 'private_cert') {
      const { data, error } = await supabaseAdmin
        .from('private_cert_consultations')
        .select(SELECT_FIELDS)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[stats GET] private_cert error:', error);
        return NextResponse.json({ error: 'Failed to fetch private cert stats' }, { status: 500 });
      }

      return NextResponse.json(data ?? []);
    }

    // type === 'all': 두 테이블 병합
    const [hakjeomResult, certResult] = await Promise.all([
      supabaseAdmin
        .from('hakjeom_consultations')
        .select(SELECT_FIELDS)
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('private_cert_consultations')
        .select(SELECT_FIELDS)
        .order('created_at', { ascending: false }),
    ]);

    if (hakjeomResult.error || certResult.error) {
      console.error('[stats GET] combined error:', hakjeomResult.error, certResult.error);
      return NextResponse.json({ error: 'Failed to fetch combined stats' }, { status: 500 });
    }

    const combined = [
      ...(hakjeomResult.data ?? []),
      ...(certResult.data ?? []),
    ].sort((a, b) => b.created_at.localeCompare(a.created_at));

    return NextResponse.json(combined);
  } catch (err) {
    console.error('[stats GET] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
