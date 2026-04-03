import { requireAuth, requireAuthFull } from '@/lib/auth/requireAuth'
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { logAction } from '@/lib/audit/logAction';

const TABLE = 'cert_students';

// ─── GET: 목록 조회 ──────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { errorResponse } = await requireAuthFull()
    if (errorResponse) return errorResponse

    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');
    const contact = searchParams.get('contact');
    const status = searchParams.get('status');

    let query = supabaseAdmin
      .from(TABLE)
      .select('*')
      .is('deleted_at', null)
      .or('is_draft.eq.false,is_draft.is.null')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false });

    if (name) query = query.ilike('name', `%${name}%`);
    if (contact) query = query.ilike('contact', `%${contact}%`);
    if (status && status !== 'all') query = query.eq('status', status);

    const [queryResult, memoResult] = await Promise.all([
      query,
      supabaseAdmin
        .from('memo_logs')
        .select('record_id, content, created_at')
        .eq('table_name', TABLE)
        .order('created_at', { ascending: false }),
    ]);

    if (queryResult.error) {
      console.error('[cert/students GET] Supabase error:', queryResult.error);
      return NextResponse.json({ error: 'Failed to fetch cert students' }, { status: 500 });
    }

    const items = queryResult.data || [];
    const countMap: Record<string, number> = {};
    const latestMemoMap: Record<string, string> = {};
    const latestMemoAtMap: Record<string, string> = {};
    for (const m of memoResult.data || []) {
      countMap[m.record_id] = (countMap[m.record_id] || 0) + 1;
      if (!latestMemoMap[m.record_id]) {
        latestMemoMap[m.record_id] = m.content;
        latestMemoAtMap[m.record_id] = m.created_at;
      }
    }
    const result = items.map(item => ({
      ...item,
      memo_count: countMap[String(item.id)] || 0,
      latest_memo: latestMemoMap[String(item.id)] ?? null,
      latest_memo_at: latestMemoAtMap[String(item.id)] ?? null,
    }));

    return NextResponse.json(result);
  } catch (err) {
    console.error('[cert/students GET] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST: 신규 등록 ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { user, errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse

    const body = await request.json();
    const { name, contact, click_source, course, completion_rate, status, manager, memo } = body;

    if (!name || !contact) {
      return NextResponse.json({ error: 'Name and contact are required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from(TABLE)
      .insert([{
        name,
        contact,
        click_source: click_source || null,
        course: course || null,
        completion_rate: completion_rate != null && completion_rate !== '' ? Number(completion_rate) : null,
        status: status || '과정안내',
        manager: manager || null,
        memo: memo || null,
      }])
      .select()
      .single();

    if (error) {
      console.error('[cert/students POST] Supabase error:', error);
      return NextResponse.json({ error: 'Failed to save cert student' }, { status: 500 });
    }

    await logAction({ user_id: user.id, user_email: user.email, action: 'create', resource: '민간자격증 학생관리', resource_id: String(data.id), detail: `${data.name} 학생 등록` });
    return NextResponse.json({ message: 'Created successfully', data }, { status: 201 });
  } catch (err) {
    console.error('[cert/students POST] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── PATCH: 필드 업데이트 ────────────────────────────────────────────────────

export async function PATCH(request: NextRequest) {
  try {
    const { user, errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse

    const body = await request.json();
    const { id, ids, ...fields } = body;

    if (ids && Array.isArray(ids)) {
      const { error } = await supabaseAdmin.from(TABLE).update(fields).in('id', ids);
      if (error) return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
      return NextResponse.json({ message: 'Updated successfully' });
    }

    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from(TABLE)
      .update(fields)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[cert/students PATCH] Supabase error:', error);
      return NextResponse.json({ error: 'Failed to update cert student' }, { status: 500 });
    }

    await logAction({ user_id: user.id, user_email: user.email, action: 'update', resource: '민간자격증 학생관리', resource_id: String(id), detail: '학생 정보 수정' });
    return NextResponse.json({ message: 'Updated successfully', data });
  } catch (err) {
    console.error('[cert/students PATCH] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE: 소프트 삭제 ─────────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const { user, errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse

    const body = await request.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids is required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from(TABLE)
      .update({ deleted_at: new Date().toISOString() })
      .in('id', ids);

    if (error) {
      console.error('[cert/students DELETE] Supabase error:', error);
      return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    }

    await logAction({ user_id: user.id, user_email: user.email, action: 'delete', resource: '민간자격증 학생관리', resource_id: ids.join(','), detail: `학생 ${ids.length}건 삭제` });
    return NextResponse.json({ message: 'Deleted successfully' });
  } catch (err) {
    console.error('[cert/students DELETE] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
