import { supabaseAdmin } from '@/lib/supabase/admin'

// 인사고과표 수정 권한 — 경영실장(직책) 또는 master-admin 만 허용
export const APPRAISAL_EDITOR_POSITION = '경영실장'

export async function canEditAppraisal(appUser: {
  role: string
  position_id?: string | null
}): Promise<boolean> {
  if (appUser.role === 'master-admin') return true
  if (!appUser.position_id) return false

  const { data } = await supabaseAdmin
    .from('positions')
    .select('name')
    .eq('id', appUser.position_id)
    .maybeSingle()

  return data?.name === APPRAISAL_EDITOR_POSITION
}
