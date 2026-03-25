import { requireAuth } from '@/lib/auth/requireAuth';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

// GET: channels 테이블에서 mamcafe/danggeun 목록 조회
export async function GET() {
  const { errorResponse } = await requireAuth();
  if (errorResponse) return errorResponse;

  const { data, error } = await supabaseAdmin
    .from('channels')
    .select('id, name, type')
    .in('type', ['mamcafe', 'danggeun'])
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const cafes = (data ?? []).filter(r => r.type === 'mamcafe').map(r => r.name as string);
  const danggeun = (data ?? []).filter(r => r.type === 'danggeun').map(r => r.name as string);

  return NextResponse.json({ cafes, danggeun });
}

// POST: channels 테이블에 새 항목 추가
export async function POST(request: NextRequest) {
  const { errorResponse } = await requireAuth();
  if (errorResponse) return errorResponse;

  const { type, name } = await request.json();
  if (!type || !name || !['mamcafe', 'danggeun'].includes(type)) {
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('channels')
    .insert({ id: name, name, type });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// DELETE: channels 테이블에서 항목 삭제
export async function DELETE(request: NextRequest) {
  const { errorResponse } = await requireAuth();
  if (errorResponse) return errorResponse;

  const { type, name } = await request.json();
  if (!type || !name) {
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('channels')
    .delete()
    .eq('name', name)
    .eq('type', type);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
