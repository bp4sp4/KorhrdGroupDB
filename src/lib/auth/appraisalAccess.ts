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

// 평가 현황 열람 권한 — 경영실장/master-admin + 사업본부장(departments.head_user_id)
// 본부장은 열람 전용 (양식 수정·평가 재오픈/삭제는 canEditAppraisal 필요)
export async function canViewAppraisalOverview(appUser: {
  id: number
  role: string
  position_id?: string | null
}): Promise<boolean> {
  if (await canEditAppraisal(appUser)) return true

  const { data } = await supabaseAdmin
    .from('departments')
    .select('id')
    .eq('head_user_id', appUser.id)
    .eq('is_active', true)
    .limit(1)
  return (data ?? []).length > 0
}
