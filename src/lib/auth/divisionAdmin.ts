import { supabaseAdmin } from '@/lib/supabase/admin'

// 부서 관리자(division admin) 접근 가능 사용자 목록 결정.
//
// 규칙:
//   - master-admin / admin           → 전사 모든 활성 사용자
//   - is_division_admin = true 사용자 → 자신과 같은 department_id 의 활성 사용자
//   - 그 외                          → 본인만 (또는 빈 배열 — 호출부에서 결정)
//
// 반환: 접근 가능한 app_users.id 배열
export async function getAccessibleUserIds(currentUser: {
  id: number
  role: string
  department_id?: string | null
  is_division_admin?: boolean
}): Promise<{
  scope: 'all' | 'division' | 'self' | 'none'
  userIds: number[]
  departmentId: string | null
}> {
  const role = currentUser.role
  const isGlobalAdmin = role === 'master-admin' || role === 'admin'

  if (isGlobalAdmin) {
    const { data } = await supabaseAdmin
      .from('app_users')
      .select('id')
      .eq('is_active', true)
    return {
      scope: 'all',
      userIds: (data ?? []).map((r) => r.id as number),
      departmentId: null,
    }
  }

  if (currentUser.is_division_admin && currentUser.department_id) {
    const deptId = currentUser.department_id
    const { data } = await supabaseAdmin
      .from('app_users')
      .select('id')
      .eq('department_id', deptId)
      .eq('is_active', true)
    return {
      scope: 'division',
      userIds: (data ?? []).map((r) => r.id as number),
      departmentId: deptId,
    }
  }

  return { scope: 'self', userIds: [currentUser.id], departmentId: null }
}

// 현재 사용자가 work-journal 관리자 화면을 볼 수 있는지 여부.
// (전사 admin 또는 부서 관리자)
export function canAccessWorkJournalAdmin(currentUser: {
  role: string
  is_division_admin?: boolean
}): boolean {
  if (currentUser.role === 'master-admin' || currentUser.role === 'admin')
    return true
  return !!currentUser.is_division_admin
}
