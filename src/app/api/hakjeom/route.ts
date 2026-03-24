import { requireAuth } from '@/lib/auth/requireAuth'
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { logAction } from '@/lib/audit/logAction';

// ─── 타입 정의 ───────────────────────────────────────────────────────────────

type HakjeomStatus = '상담대기' | '상담중' | '보류' | '등록대기' | '등록완료';

interface HakjeomUpdatePayload {
  status?: HakjeomStatus;
  memo?: string | null;
  manager?: string | null;
  counsel_check?: string | null;
  subject_cost?: number | null;
  name?: string;
  contact?: string;
  education?: string | null;
  reason?: string | null;
  click_source?: string | null;
  residence?: string | null;
  hope_course?: string | null;
}

const TABLE = 'hakjeom_consultations';

// ─── GET: 목록 조회 (name, contact, status, major_category, reason, counsel_check 지원) ──

export async function GET(request: NextRequest) {
  try {
    const { user: _user, errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Supabase configuration missing' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');
    const contact = searchParams.get('contact');
    const status = searchParams.get('status');

    let query = supabaseAdmin
      .from(TABLE)
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false });

    if (name) query = query.ilike('name', `%${name}%`);
    if (contact) query = query.ilike('contact', `%${contact}%`);
    if (status && status !== 'all') query = query.eq('status', status);

    // 데이터 + 메모를 병렬로 조회
    const [queryResult, memoResult] = await Promise.all([
      query,
      supabaseAdmin
        .from('memo_logs')
        .select('record_id, content')
        .eq('table_name', TABLE)
        .order('created_at', { ascending: false }),
    ]);

    if (queryResult.error) {
      console.error('[hakjeom GET] Supabase error:', queryResult.error);
      return NextResponse.json({ error: 'Failed to fetch hakjeom consultations' }, { status: 500 });
    }

    const items = queryResult.data || [];

    // memo_count + 최신 메모 내용 병합
    const countMap: Record<string, number> = {};
    const latestMemoMap: Record<string, string> = {};
    for (const m of memoResult.data || []) {
      countMap[m.record_id] = (countMap[m.record_id] || 0) + 1;
      if (!latestMemoMap[m.record_id]) latestMemoMap[m.record_id] = m.content;
    }
    const result = items.map(item => ({
      ...item,
      memo_count: countMap[String(item.id)] || 0,
      latest_memo: latestMemoMap[String(item.id)] ?? null,
    }));

    return NextResponse.json(result);
  } catch (err) {
    console.error('[hakjeom GET] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST: 신규 등록 ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { user, errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Supabase configuration missing' }, { status: 500 });
    }

    const body = await request.json();
    const {
      name, contact, education, hope_course, reason,
      click_source, residence, subject_cost, manager, memo, counsel_check, status,
    } = body;

    if (!name || !contact) {
      return NextResponse.json({ error: 'Name and contact are required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from(TABLE)
      .insert([{
        name,
        contact,
        education: education || null,
        hope_course: hope_course || null,
        reason: reason || null,
        click_source: click_source || null,
        residence: residence || null,
        subject_cost: subject_cost ? parseInt(String(subject_cost).replace(/,/g, ''), 10) || null : null,
        manager: manager || null,
        memo: memo || null,
        counsel_check: counsel_check || null,
        status: status || '상담대기',
      }])
      .select()
      .single();

    if (error) {
      console.error('[hakjeom POST] Supabase error:', error);
      return NextResponse.json({ error: 'Failed to save hakjeom consultation' }, { status: 500 });
    }

    await logAction({ user_id: user.id, user_email: user.email, action: 'create', resource: '학점은행제 상담', resource_id: String(data.id), detail: `${data.name} 상담 등록` });
    return NextResponse.json({ message: 'Created successfully', data }, { status: 201 });
  } catch (err) {
    console.error('[hakjeom POST] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── PATCH: 필드 업데이트 (id 필수) ─────────────────────────────────────────

export async function PATCH(request: NextRequest) {
  try {
    const { user, errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Supabase configuration missing' }, { status: 500 });
    }

    const body = await request.json();
    const {
      id, ids, status, memo, manager, counsel_check, subject_cost,
      name, contact, education, reason, click_source, residence, hope_course,
    } = body;

    // 일괄 담당자 배정
    if (Array.isArray(ids) && ids.length > 0 && manager !== undefined) {
      const { error } = await supabaseAdmin
        .from(TABLE)
        .update({ manager: manager || null })
        .in('id', ids)
      if (error) return NextResponse.json({ error: 'Failed to bulk update manager' }, { status: 500 })
      await logAction({ user_id: user.id, user_email: user.email, action: 'update', resource: '학점은행제 상담', resource_id: ids.join(','), detail: `${ids.length}건 담당자 일괄 배정: ${manager || '없음'}`, meta: { ids, manager } })
      return NextResponse.json({ message: 'Bulk manager updated' })
    }

    // 일괄 유입경로 배정
    if (Array.isArray(ids) && ids.length > 0 && click_source !== undefined) {
      const { error } = await supabaseAdmin
        .from(TABLE)
        .update({ click_source: click_source || null })
        .in('id', ids)
      if (error) return NextResponse.json({ error: 'Failed to bulk update click_source' }, { status: 500 })
      await logAction({ user_id: user.id, user_email: user.email, action: 'update', resource: '학점은행제 상담', resource_id: ids.join(','), detail: `${ids.length}건 유입경로 일괄 배정: ${click_source || '없음'}`, meta: { ids, click_source } })
      return NextResponse.json({ message: 'Bulk click_source updated' })
    }

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const updateData: HakjeomUpdatePayload = {};

    if (status !== undefined) updateData.status = status;
    if (memo !== undefined) updateData.memo = memo || null;
    if (manager !== undefined) updateData.manager = manager || null;
    if (counsel_check !== undefined) updateData.counsel_check = counsel_check || null;
    if (subject_cost !== undefined) {
      updateData.subject_cost = subject_cost
        ? parseInt(String(subject_cost).replace(/,/g, ''), 10) || null
        : null;
    }
    if (name !== undefined) updateData.name = name;
    if (contact !== undefined) updateData.contact = contact;
    if (education !== undefined) updateData.education = education || null;
    if (reason !== undefined) updateData.reason = reason || null;
    if (click_source !== undefined) updateData.click_source = click_source || null;
    if (residence !== undefined) updateData.residence = residence || null;
    if (hope_course !== undefined) updateData.hope_course = hope_course || null;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'At least one field is required for update' }, { status: 400 });
    }

    const { data: current } = await supabaseAdmin.from(TABLE).select('*').eq('id', id).single();

    const { data, error } = await supabaseAdmin
      .from(TABLE)
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[hakjeom PATCH] Supabase error:', error);
      return NextResponse.json({ error: 'Failed to update hakjeom consultation' }, { status: 500 });
    }

    const changes: Record<string, { before: unknown; after: unknown }> = {};
    for (const [key, newVal] of Object.entries(updateData as Record<string, unknown>)) {
      changes[key] = { before: (current as Record<string, unknown>)?.[key] ?? null, after: newVal };
    }
    await logAction({ user_id: user.id, user_email: user.email, action: 'update', resource: '학점은행제 상담', resource_id: String(id), detail: `${current?.name ?? `ID ${id}`} 수정`, meta: { changes } });
    return NextResponse.json({ message: 'Updated successfully', data });
  } catch (err) {
    console.error('[hakjeom PATCH] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE: 일괄 삭제 (ids 배열 필수) ──────────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const { user, errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Supabase configuration missing' }, { status: 500 });
    }

    const body = await request.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'IDs array is required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from(TABLE)
      .update({ deleted_at: new Date().toISOString() })
      .in('id', ids)
      .select();

    if (error) {
      console.error('[hakjeom DELETE] Supabase error:', error);
      return NextResponse.json({ error: 'Failed to move to trash' }, { status: 500 });
    }

    await logAction({ user_id: user.id, user_email: user.email, action: 'delete', resource: '학점은행제 상담', resource_id: ids.join(','), detail: `${ids.length}건 휴지통 이동`, meta: { ids } });
    return NextResponse.json({ message: 'Moved to trash', data });
  } catch (err) {
    console.error('[hakjeom DELETE] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
