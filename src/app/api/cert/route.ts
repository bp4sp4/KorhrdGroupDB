import { requireAuth } from '@/lib/auth/requireAuth'
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { logAction } from '@/lib/audit/logAction';

// 결제 상태 타입
type PaymentStatus = 'pending' | 'paid' | 'failed' | 'cancelled';

// 업데이트 가능한 필드 타입
interface CertUpdatePayload {
  is_checked?: boolean;
  payment_status?: PaymentStatus;
  name?: string;
  contact?: string;
  birth_prefix?: string;
  address?: string;
  address_main?: string;
  address_detail?: string;
  certificates?: string[];
  cash_receipt?: string;
  amount?: number | null;
  mul_no?: string | null;
  pay_method?: string | null;
  source?: string | null;
}

// GET: 전체 목록 조회
// 쿼리 파라미터:
//   - name: 이름 검색 (부분 일치)
//   - contact: 연락처 검색 (부분 일치)
//   - payment_status: 결제 상태 필터 (paid | pending | failed | cancelled | all)
//   - source: 출처 탭 필터 (hakjeom | edu | all)
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
    const paymentStatus = searchParams.get('payment_status');
    // source 탭 필터: 'hakjeom' = 학점연계, 'edu' = 교육원, 나머지(all/없음) = 전체
    const sourceTab = searchParams.get('source_tab');

    let query = supabaseAdmin
      .from('certificate_applications')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (name) {
      query = query.ilike('name', `%${name}%`);
    }

    if (contact) {
      const clean = contact.replace(/-/g, '')
      let hyphenated = ''
      if (/^\d{4,}$/.test(clean)) {
        hyphenated = clean.length >= 10
          ? `${clean.slice(0,3)}-${clean.slice(3,7)}-${clean.slice(7)}`
          : `${clean.slice(0,3)}-${clean.slice(3)}`
      }
      if (hyphenated && hyphenated !== contact) {
        query = query.or(`contact.ilike.%${contact}%,contact.ilike.%${hyphenated}%`)
      } else {
        query = query.ilike('contact', `%${contact}%`)
      }
    }

    if (paymentStatus && paymentStatus !== 'all') {
      query = query.eq('payment_status', paymentStatus);
    }

    // source 탭 필터링
    // 'hakjeom' 탭: source = 'bridge' (학점연계 신청)
    // 'edu' 탭: source = 'prepayment' (교육원)
    if (sourceTab && sourceTab !== 'all') {
      const sourceMap: Record<string, string> = { hakjeom: 'bridge', edu: 'prepayment' };
      const dbSource = sourceMap[sourceTab] ?? sourceTab;
      query = query.eq('source', dbSource);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[cert GET] Supabase error:', error);
      return NextResponse.json({ error: 'Failed to fetch certificate applications' }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error('[cert GET] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH: 필드 업데이트 (id 필수)
export async function PATCH(request: NextRequest) {
  try {
    const { user, errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Supabase configuration missing' }, { status: 500 });
    }

    const body = await request.json();
    const {
      id,
      is_checked,
      payment_status,
      name,
      contact,
      birth_prefix,
      address,
      address_main,
      address_detail,
      certificates,
      cash_receipt,
      amount,
      mul_no,
      pay_method,
      source,
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const updateData: CertUpdatePayload = {};

    if (is_checked !== undefined) updateData.is_checked = is_checked;
    if (payment_status !== undefined) updateData.payment_status = payment_status;
    if (name !== undefined) updateData.name = name;
    if (contact !== undefined) updateData.contact = contact;
    if (birth_prefix !== undefined) updateData.birth_prefix = birth_prefix;
    if (address !== undefined) updateData.address = address;
    if (address_main !== undefined) updateData.address_main = address_main;
    if (address_detail !== undefined) updateData.address_detail = address_detail;
    if (certificates !== undefined) updateData.certificates = certificates;
    if (cash_receipt !== undefined) updateData.cash_receipt = cash_receipt;
    if (amount !== undefined) updateData.amount = amount ?? null;
    if (mul_no !== undefined) updateData.mul_no = mul_no ?? null;
    if (pay_method !== undefined) updateData.pay_method = pay_method ?? null;
    if (source !== undefined) updateData.source = source ?? null;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'At least one field is required for update' }, { status: 400 });
    }

    const { data: current } = await supabaseAdmin.from('certificate_applications').select('*').eq('id', id).single();

    const { data, error } = await supabaseAdmin
      .from('certificate_applications')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[cert PATCH] Supabase error:', error);
      return NextResponse.json({ error: 'Failed to update certificate application' }, { status: 500 });
    }

    const changes: Record<string, { before: unknown; after: unknown }> = {};
    for (const [key, newVal] of Object.entries(updateData as Record<string, unknown>)) {
      changes[key] = { before: (current as Record<string, unknown>)?.[key] ?? null, after: newVal };
    }
    await logAction({ user_id: user.id, user_email: user.email, action: 'update', resource: '자격증신청', resource_id: String(id), detail: `${current?.name ?? `ID ${id}`} 수정`, meta: { changes } });
    return NextResponse.json({ message: 'Updated successfully', data });
  } catch (err) {
    console.error('[cert PATCH] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: 일괄 삭제 (ids 배열 필수)
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
      return NextResponse.json({ error: 'IDs are required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('certificate_applications')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', ids);

    if (error) {
      console.error('[cert DELETE] Supabase error:', error);
      return NextResponse.json({ error: 'Failed to move to trash' }, { status: 500 });
    }

    await logAction({ user_id: user.id, user_email: user.email, action: 'delete', resource: '자격증신청', resource_id: ids.join(','), detail: `${ids.length}건 휴지통 이동`, meta: { ids } });
    return NextResponse.json({ message: 'Moved to trash' });
  } catch (err) {
    console.error('[cert DELETE] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: 신규 신청 추가 (FormData - 사진 포함)
export async function POST(request: NextRequest) {
  try {
    const { user, errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Supabase configuration missing' }, { status: 500 });
    }

    const formData = await request.formData();
    const name = formData.get('name') as string | null;
    const contact = formData.get('contact') as string | null;
    const birth_prefix = formData.get('birth_prefix') as string | null;
    const address = formData.get('address') as string | null;
    const address_detail = formData.get('address_detail') as string | null;
    const certificatesRaw = formData.get('certificates') as string | null;
    const cash_receipt = formData.get('cash_receipt') as string | null;
    const source = formData.get('source') as string | null;
    const amountRaw = formData.get('amount') as string | null;
    const photo = formData.get('photo') as File | null;

    if (!name || !contact) {
      return NextResponse.json({ error: '이름과 연락처는 필수입니다.' }, { status: 400 });
    }

    const certificates = certificatesRaw ? JSON.parse(certificatesRaw) : [];
    const amount = amountRaw ? Number(amountRaw) : null;

    // 사진 업로드
    let photo_url: string | null = null;
    if (photo && photo.size > 0) {
      const ext = photo.name.split('.').pop() || 'jpg';
      const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const buffer = Buffer.from(await photo.arrayBuffer());

      const { error: uploadError } = await supabaseAdmin.storage
        .from('photos')
        .upload(fileName, buffer, { contentType: photo.type });

      if (uploadError) {
        console.error('[cert POST] Photo upload error:', uploadError);
      } else {
        photo_url = fileName;
      }
    }

    const { data, error } = await supabaseAdmin
      .from('certificate_applications')
      .insert({
        name,
        contact,
        birth_prefix: birth_prefix || null,
        address: address || '',
        address_detail: address_detail || null,
        certificates,
        cash_receipt: cash_receipt || null,
        source: source || null,
        amount,
        photo_url,
        payment_status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('[cert POST] Supabase error:', error);
      return NextResponse.json({ error: 'Failed to create certificate application' }, { status: 500 });
    }

    await logAction({ user_id: user.id, user_email: user.email, action: 'create', resource: '자격증신청', resource_id: String(data.id), detail: `${data.name} 신청 등록` });
    return NextResponse.json({ message: 'Created successfully', data }, { status: 201 });
  } catch (err) {
    console.error('[cert POST] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
