import { requireAuth } from '@/lib/auth/requireAuth'
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

// ─── 타입 정의 ───────────────────────────────────────────────────────────────

type AgencyStatus = '협약대기' | '협약중' | '보류' | '협약완료';

interface AgencyUpdatePayload {
  category?: string | null;
  region?: string | null;
  institution_name?: string | null;
  contact?: string | null;
  credit_commission?: string | null;
  private_commission?: string | null;
  manager?: string | null;
  memo?: string | null;
  status?: AgencyStatus;
}

const TABLE = 'agency_agreements';

// ─── GET: 목록 조회 ──────────────────────────────────────────────────────────

export async function GET() {
  try {
    const { user: _user, errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Supabase configuration missing' }, { status: 500 });
    }

    const { data, error } = await supabaseAdmin
      .from(TABLE)
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false });

    if (error) {
      console.error('[hakjeom/agency GET] Supabase error:', error);
      return NextResponse.json({ error: 'Failed to fetch agency agreements' }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (err) {
    console.error('[hakjeom/agency GET] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST: 신규 등록 ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { user: _user, errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Supabase configuration missing' }, { status: 500 });
    }

    const body = await request.json();
    const {
      category, region, institution_name, contact,
      credit_commission, private_commission, manager, memo, status,
    } = body;

    if (!institution_name) {
      return NextResponse.json({ error: 'Institution name is required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from(TABLE)
      .insert([{
        category: category || null,
        region: region || null,
        institution_name,
        contact: contact || null,
        credit_commission: credit_commission || null,
        private_commission: private_commission || null,
        manager: manager || null,
        memo: memo || null,
        status: status || '협약대기',
      }])
      .select()
      .single();

    if (error) {
      console.error('[hakjeom/agency POST] Supabase error:', error);
      return NextResponse.json({ error: 'Failed to save agency agreement' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Created successfully', data }, { status: 201 });
  } catch (err) {
    console.error('[hakjeom/agency POST] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── PATCH: 필드 업데이트 ────────────────────────────────────────────────────

export async function PATCH(request: NextRequest) {
  try {
    const { user: _user, errorResponse } = await requireAuth()
    if (errorResponse) return errorResponse
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Supabase configuration missing' }, { status: 500 });
    }

    const body = await request.json();
    const {
      id, category, region, institution_name, contact,
      credit_commission, private_commission, manager, memo, status,
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const updateData: AgencyUpdatePayload = {};

    if (category !== undefined) updateData.category = category || null;
    if (region !== undefined) updateData.region = region || null;
    if (institution_name !== undefined) updateData.institution_name = institution_name || null;
    if (contact !== undefined) updateData.contact = contact || null;
    if (credit_commission !== undefined) updateData.credit_commission = credit_commission || null;
    if (private_commission !== undefined) updateData.private_commission = private_commission || null;
    if (manager !== undefined) updateData.manager = manager || null;
    if (memo !== undefined) updateData.memo = memo || null;
    if (status !== undefined) updateData.status = status;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'At least one field is required for update' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from(TABLE)
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[hakjeom/agency PATCH] Supabase error:', error);
      return NextResponse.json({ error: 'Failed to update agency agreement' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Updated successfully', data });
  } catch (err) {
    console.error('[hakjeom/agency PATCH] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE: 일괄 삭제 ───────────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const { user: _user, errorResponse } = await requireAuth()
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
      console.error('[hakjeom/agency DELETE] Supabase error:', error);
      return NextResponse.json({ error: 'Failed to move to trash' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Moved to trash', data });
  } catch (err) {
    console.error('[hakjeom/agency DELETE] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
