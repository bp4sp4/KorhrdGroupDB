import { requireAuth } from '@/lib/auth/requireAuth'
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { logAction } from '@/lib/audit/logAction';

// 소스 테이블 → 표시 이름 매핑
const SOURCE_LABEL: Record<string, string> = {
  hakjeom_consultations: '학점은행제 상담',
  private_cert_consultations: '민간자격증 상담',
  certificate_applications: '자격증 신청',
  agency_agreements: '기관협약',
};


const TABLES = Object.keys(SOURCE_LABEL);

// ─── GET: 휴지통 목록 전체 조회 ──────────────────────────────────────────────

export async function GET() {
  try {
    const { user: _user, errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse
    const results: {
      id: string | number;
      source_table: string;
      source_label: string;
      name: string;
      contact: string | null;
      deleted_at: string;
    }[] = [];

    for (const table of TABLES) {
      if (table === 'agency_agreements') {
        const { data, error } = await supabaseAdmin
          .from('agency_agreements')
          .select('id, institution_name, contact, deleted_at')
          .not('deleted_at', 'is', null)
          .order('deleted_at', { ascending: false });

        if (error) { console.error(`[trash GET] ${table} error:`, error); continue; }

        for (const row of data ?? []) {
          results.push({
            id: row.id,
            source_table: table,
            source_label: SOURCE_LABEL[table],
            name: row.institution_name ?? '-',
            contact: row.contact ?? null,
            deleted_at: row.deleted_at,
          });
        }
      } else {
        const { data, error } = await supabaseAdmin
          .from(table as 'hakjeom_consultations' | 'private_cert_consultations' | 'certificate_applications')
          .select('id, name, contact, deleted_at')
          .not('deleted_at', 'is', null)
          .order('deleted_at', { ascending: false });

        if (error) { console.error(`[trash GET] ${table} error:`, error); continue; }

        for (const row of data ?? []) {
          results.push({
            id: row.id,
            source_table: table,
            source_label: SOURCE_LABEL[table],
            name: row.name ?? '-',
            contact: row.contact ?? null,
            deleted_at: row.deleted_at,
          });
        }
      }
    }

    // 삭제일 최신순 정렬
    results.sort((a, b) => new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime());

    return NextResponse.json(results);
  } catch (err) {
    console.error('[trash GET] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── PATCH: 복원 ─────────────────────────────────────────────────────────────
// body: { source_table: string, ids: (string|number)[] }

export async function PATCH(request: NextRequest) {
  try {
    const { user, errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse
    const body = await request.json();
    const { source_table, ids } = body;

    if (!source_table || !TABLES.includes(source_table)) {
      return NextResponse.json({ error: '유효하지 않은 테이블입니다.' }, { status: 400 });
    }
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids가 필요합니다.' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from(source_table)
      .update({ deleted_at: null })
      .in('id', ids);

    if (error) {
      console.error('[trash PATCH] Supabase error:', error);
      return NextResponse.json({ error: '복원에 실패했습니다.' }, { status: 500 });
    }

    await logAction({ user_id: user.id, user_email: user.email, action: 'restore', resource: '휴지통', resource_id: ids.join(','), detail: `${SOURCE_LABEL[source_table] ?? source_table} ${ids.length}건 복원`, meta: { source_table, ids } });
    return NextResponse.json({ message: '복원 완료' });
  } catch (err) {
    console.error('[trash PATCH] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE: 영구 삭제 ────────────────────────────────────────────────────────
// body: { source_table: string, ids: (string|number)[] }
// body: { all: true } → 휴지통 전체 비우기

export async function DELETE(request: NextRequest) {
  try {
    const { user, errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse
    const body = await request.json();
    const { source_table, ids, all } = body;

    // 전체 비우기
    if (all === true) {
      for (const table of TABLES) {
        await supabaseAdmin
          .from(table)
          .delete()
          .not('deleted_at', 'is', null);
      }
      await logAction({ user_id: user.id, user_email: user.email, action: 'hard_delete', resource: '휴지통', detail: '휴지통 전체 비우기' });
      return NextResponse.json({ message: '휴지통 전체 비우기 완료' });
    }

    if (!source_table || !TABLES.includes(source_table)) {
      return NextResponse.json({ error: '유효하지 않은 테이블입니다.' }, { status: 400 });
    }
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids가 필요합니다.' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from(source_table)
      .delete()
      .in('id', ids)
      .not('deleted_at', 'is', null); // 안전장치: 소프트 삭제된 것만 영구 삭제

    if (error) {
      console.error('[trash DELETE] Supabase error:', error);
      return NextResponse.json({ error: '영구 삭제에 실패했습니다.' }, { status: 500 });
    }

    await logAction({ user_id: user.id, user_email: user.email, action: 'hard_delete', resource: '휴지통', resource_id: ids.join(','), detail: `${SOURCE_LABEL[source_table] ?? source_table} ${ids.length}건 영구 삭제`, meta: { source_table, ids } });
    return NextResponse.json({ message: '영구 삭제 완료' });
  } catch (err) {
    console.error('[trash DELETE] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
