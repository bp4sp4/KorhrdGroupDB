import { requireAuth, requireAuthFull } from '@/lib/auth/requireAuth'
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { logAction } from '@/lib/audit/logAction';
import { sendAlimtalk, parsePhones } from '@/lib/kakao';

// ─── 담당자 display_name → phone ─────────────────────────────────────────────
async function getPhoneByDisplayName(displayName: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('app_users')
    .select('phone')
    .eq('display_name', displayName)
    .maybeSingle()
  if (error || !data?.phone) return null
  return data.phone
}

// ─── 알림 헬퍼 ────────────────────────────────────────────────────────────────

// Supabase auth 유저 목록 캐시 (요청 단위)
let _authUsersCache: { id: string; email?: string }[] | null = null
async function getAuthUsers() {
  if (_authUsersCache) return _authUsersCache
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
  if (error) { console.error('[getAuthUsers]', error); return [] }
  _authUsersCache = data.users
  return data.users
}

// email → Supabase auth UUID
async function getUidByEmail(email: string): Promise<string | null> {
  const users = await getAuthUsers()
  return users.find(u => u.email === email)?.id ?? null
}

// display_name → Supabase auth UUID
async function getUidByDisplayName(displayName: string): Promise<string | null> {
  const { data: appUser, error } = await supabaseAdmin
    .from('app_users')
    .select('username')
    .eq('display_name', displayName)
    .maybeSingle()
  if (error || !appUser?.username) {
    console.error('[getUidByDisplayName] app_users 조회 실패:', displayName, error)
    return null
  }
  const uid = await getUidByEmail(appUser.username)
  if (!uid) console.error('[getUidByDisplayName] auth 유저 없음:', appUser.username)
  return uid
}

// admin/master-admin 유저 전체 UUID
async function getAdminUids(): Promise<string[]> {
  const { data: admins, error } = await supabaseAdmin
    .from('app_users')
    .select('username')
    .in('role', ['admin', 'master-admin'])
  if (error || !admins?.length) {
    console.error('[getAdminUids] 조회 실패:', error)
    return []
  }
  const uids = await Promise.all(admins.map(a => getUidByEmail(a.username)))
  return uids.filter(Boolean) as string[]
}

// ─── 타입 정의 ───────────────────────────────────────────────────────────────

type HakjeomStatus = '부재중/추후통화' | '상담대기' | '상담완료-높음' | '상담완료-중간' | '상담완료-낮음' | '보류' | '등록완료' | '취소' | `기타(${string})` | '기타';

const COUNSEL_COMPLETE_STATUSES: HakjeomStatus[] = ['상담완료-높음', '상담완료-중간', '상담완료-낮음'];

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
  counsel_completed_at?: string | null;
  current_situation?: string | null;
  reaction_point?: string | null;
  contact_scheduled_at?: string | null;
}

const TABLE = 'hakjeom_consultations';

// ─── GET: 목록 조회 (name, contact, status, major_category, reason, counsel_check 지원) ──

export async function GET(request: NextRequest) {
  try {
    const { appUser, errorResponse } = await requireAuthFull()
    if (errorResponse) return errorResponse
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Supabase configuration missing' }, { status: 500 });
    }

    const isFullAccess = appUser.role === 'master-admin' || appUser.role === 'admin'
    let managerFilter: string | null = null
    if (!isFullAccess) {
      const { data: perm, error: permError } = await supabaseAdmin
        .from('user_permissions')
        .select('scope')
        .eq('user_id', appUser.id)
        .eq('section', 'hakjeom')
        .maybeSingle()
      if (permError) {
        // 테이블 미생성 등 오류 시 전체 열람 허용
      } else if (!perm || perm.scope === 'none') {
        return NextResponse.json([])
      } else if (perm.scope === 'own') {
        managerFilter = appUser.display_name ?? ''
      }
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

    if (managerFilter !== null) query = query.eq('manager', managerFilter);
    if (name) query = query.ilike('name', `%${name}%`);
    if (contact) query = query.ilike('contact', `%${contact}%`);
    if (status && status !== 'all') query = query.eq('status', status);

    // 데이터 + 메모를 병렬로 조회
    const [queryResult, memoResult] = await Promise.all([
      query,
      supabaseAdmin
        .from('memo_logs')
        .select('record_id, content, created_at')
        .eq('table_name', TABLE)
        .order('created_at', { ascending: false }),
    ]);

    if (queryResult.error) {
      console.error('[hakjeom GET] Supabase error:', queryResult.error);
      return NextResponse.json({ error: 'Failed to fetch hakjeom consultations' }, { status: 500 });
    }

    const items = queryResult.data || [];

    // memo_count + 최신 메모 내용 + 최신 메모 날짜 병합
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
      click_source, residence, subject_cost, manager, memo, counsel_check, status, current_situation,
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
        current_situation: current_situation || null,
        status: status || '상담대기',
      }])
      .select()
      .single();

    if (error) {
      console.error('[hakjeom POST] Supabase error:', error);
      return NextResponse.json({ error: 'Failed to save hakjeom consultation' }, { status: 500 });
    }

    await logAction({ user_id: user.id, user_email: user.email, action: 'create', resource: '학점은행제 상담', resource_id: String(data.id), detail: `${data.name} 상담 등록` });

    // 신규 신청 → 관리자 전원에게 알림 (실패해도 응답에 영향 없음)
    getAdminUids().then(adminUids => {
      if (adminUids.length > 0) {
        supabaseAdmin.from('notifications').insert(
          adminUids.map(uid => ({
            user_id: uid,
            type: 'NEW_CONSULTATION',
            title: '새 학점은행제 상담 신청',
            message: `${data.name}님이 학점은행제 상담을 신청했습니다.`,
            link: `/hakjeom?highlight=${data.id}`,
            is_read: false,
          }))
        ).then()
      }
    }).catch(() => {})

    // 신규 문의 SMS 발송 (env 수신자 고정)
    // 신규 문의 알림톡 — 고객 + 관리자 전원에게 승인 템플릿 그대로 발송
    const newInquiryReceivers = [
      ...(data.contact ? [String(data.contact)] : []),
      ...parsePhones(process.env.ALIGO_NEW_INQUIRY_PHONES),
    ]
    if (newInquiryReceivers.length > 0) {
      sendAlimtalk({ receivers: newInquiryReceivers })
        .catch((e) => console.error('[hakjeom POST] 알림톡 실패:', e))
    }

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
      name, contact, education, reason, click_source, residence, hope_course, current_situation, reaction_point,
      contact_scheduled_at,
    } = body;

    // 일괄 담당자 배정
    if (Array.isArray(ids) && ids.length > 0 && manager !== undefined) {
      const { data: appUser } = await supabaseAdmin
        .from('app_users')
        .select('id, role')
        .eq('username', user.email)
        .maybeSingle()
      const isAdmin = appUser?.role === 'master-admin' || appUser?.role === 'admin'
      let canAssign = isAdmin
      if (!isAdmin && appUser?.id) {
        const { data: perm } = await supabaseAdmin
          .from('user_permissions')
          .select('scope')
          .eq('user_id', appUser.id)
          .eq('section', 'hakjeom')
          .maybeSingle()
        canAssign = perm?.scope === 'all'
      }
      if (!canAssign) {
        return NextResponse.json(
          { error: '담당자 일괄 배정 권한이 없습니다.' },
          { status: 403 }
        )
      }

      const { error } = await supabaseAdmin
        .from(TABLE)
        .update({ manager: manager || null })
        .in('id', ids)
      if (error) return NextResponse.json({ error: 'Failed to bulk update manager' }, { status: 500 })
      await logAction({ user_id: user.id, user_email: user.email, action: 'update', resource: '학점은행제 상담', resource_id: ids.join(','), detail: `${ids.length}건 담당자 일괄 배정: ${manager || '없음'}`, meta: { ids, manager } })

      // 담당자 일괄 배정 알림
      if (manager) {
        const uid = await getUidByDisplayName(manager)
        if (uid) {
          const { error: nErr } = await supabaseAdmin.from('notifications').insert({
            user_id: uid,
            type: 'MANAGER_ASSIGNED',
            title: '담당자 배정',
            message: `${ids.length}건이 담당으로 배정되었습니다.`,
            link: `/hakjeom`,
            is_read: false,
          })
          if (nErr) console.error('[PATCH bulk] MANAGER_ASSIGNED 알림 실패:', nErr)
        }
        // SMS: 담당자 phone으로 발송
        const phone = await getPhoneByDisplayName(manager)
        if (phone) {
          sendAlimtalk({ receivers: phone })
            .catch((e) => console.error('[PATCH bulk] 알림톡 실패:', e))
        }
      }
      return NextResponse.json({ message: 'Bulk manager updated' })
    }

    // 일괄 상태 변경
    if (Array.isArray(ids) && ids.length > 0 && status !== undefined && manager === undefined && click_source === undefined) {
      const { error } = await supabaseAdmin
        .from(TABLE)
        .update({ status })
        .in('id', ids)
      if (error) return NextResponse.json({ error: 'Failed to bulk update status' }, { status: 500 })

      // 지인소개 대분류는 등록완료 대신 기타 상태로 처리
      if (status === '등록완료') {
        const { data: jiinRecords } = await supabaseAdmin
          .from(TABLE)
          .select('id')
          .in('id', ids)
          .like('click_source', '지인소개%')
        if (jiinRecords && jiinRecords.length > 0) {
          await supabaseAdmin
            .from(TABLE)
            .update({ status: '기타' })
            .in('id', jiinRecords.map(r => r.id))
        }
      }

      await logAction({ user_id: user.id, user_email: user.email, action: 'update', resource: '학점은행제 상담', resource_id: ids.join(','), detail: `${ids.length}건 상태 일괄 변경: ${status}`, meta: { ids, status } })
      return NextResponse.json({ message: 'Bulk status updated' })
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

    if (status !== undefined) {
      updateData.status = status;
      // 상담완료 상태로 변경 시 시각 기록, 다른 상태로 변경 시 초기화
      if (COUNSEL_COMPLETE_STATUSES.includes(status as HakjeomStatus)) {
        updateData.counsel_completed_at = new Date().toISOString();
      } else {
        updateData.counsel_completed_at = null;
      }
    }
    if (memo !== undefined) {
      updateData.memo = memo || null;
      // 메모 작성 시 상담완료 우선노출 해제 (현재 상태 확인 필요)
      const { data: cur } = await supabaseAdmin.from(TABLE).select('status').eq('id', id).maybeSingle();
      if (cur && COUNSEL_COMPLETE_STATUSES.includes(cur.status as HakjeomStatus)) {
        updateData.counsel_completed_at = null;
      }
    }
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
    if (current_situation !== undefined) updateData.current_situation = current_situation || null;
    if (reaction_point !== undefined) updateData.reaction_point = reaction_point || null;
    if (contact_scheduled_at !== undefined) updateData.contact_scheduled_at = contact_scheduled_at;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'At least one field is required for update' }, { status: 400 });
    }

    const { data: current } = await supabaseAdmin.from(TABLE).select('*').eq('id', id).single();

    // 지인소개 대분류는 등록완료 대신 기타로 처리
    if (status === '등록완료' && current?.click_source?.startsWith('지인소개')) {
      updateData.status = '기타';
    }

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

    // 연락예정일 설정 → 담당자에게 알림
    if (contact_scheduled_at && data?.manager) {
      const uid = await getUidByDisplayName(data.manager)
      if (uid) {
        const { error: nErr } = await supabaseAdmin.from('notifications').insert({
          user_id: uid,
          type: 'CONTACT_SCHEDULED',
          title: '연락 예정',
          message: `${data.name}님 — ${contact_scheduled_at.slice(0, 10)} 연락 예정`,
          link: `/hakjeom?tab=counsel_done&highlight=${id}`,
          is_read: false,
        })
        if (nErr) console.error('[PATCH] CONTACT_SCHEDULED 알림 실패:', nErr)
      }
    }

    // 담당자 배정 → 새 담당자에게 알림
    if (manager && data && current?.manager !== manager) {
      const uid = await getUidByDisplayName(manager)
      if (uid) {
        const { error: nErr } = await supabaseAdmin.from('notifications').insert({
          user_id: uid,
          type: 'MANAGER_ASSIGNED',
          title: '담당자 배정',
          message: `${data.name}님 담당으로 배정되었습니다.`,
          link: `/hakjeom?highlight=${id}`,
          is_read: false,
        })
        if (nErr) console.error('[PATCH] MANAGER_ASSIGNED 알림 실패:', nErr)
      }
      // SMS: 담당자 phone으로 발송
      const phone = await getPhoneByDisplayName(manager)
      if (phone) {
        sendAlimtalk({ receivers: phone })
          .catch((e) => console.error('[PATCH] 알림톡 실패:', e))
      }
    }

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
    const { ids, reason } = body as { ids: (number | string)[]; reason?: string };

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'IDs array is required' }, { status: 400 });
    }

    const trimmedReason = typeof reason === 'string' ? reason.trim() : '';
    if (!trimmedReason) {
      return NextResponse.json({ error: '삭제 사유를 입력해주세요.' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from(TABLE)
      .update({ deleted_at: new Date().toISOString(), delete_reason: trimmedReason })
      .in('id', ids)
      .select();

    if (error) {
      console.error('[hakjeom DELETE] Supabase error:', error);
      return NextResponse.json({ error: 'Failed to move to trash' }, { status: 500 });
    }

    await logAction({
      user_id: user.id,
      user_email: user.email,
      action: 'delete',
      resource: '학점은행제 상담',
      resource_id: ids.join(','),
      detail: `${ids.length}건 휴지통 이동 (사유: ${trimmedReason})`,
      meta: { ids, reason: trimmedReason },
    });
    return NextResponse.json({ message: 'Moved to trash', data });
  } catch (err) {
    console.error('[hakjeom DELETE] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
