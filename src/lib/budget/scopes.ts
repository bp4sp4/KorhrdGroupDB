import { supabaseAdmin } from '@/lib/supabase/admin'

// 사이드바 사업부 메뉴 ↔ 예산 범위(본부 + 선택적 팀) 매핑.
// 공용 통장은 본부 단위로 연동돼 있고, 팀 분류(team)로 각 사업부에 귀속시킨다.
// 매핑 수정은 여기 한 곳만 바꾸면 된다.
export interface BudgetScopeDef {
  key: string // URL ?scope= 값
  label: string // 화면 제목
  deptCode: string // departments.code (MGT / DEV / BIZ)
  teamName?: string // teams.name — 없으면 본부 전체
}

export const BUDGET_SCOPES: BudgetScopeDef[] = [
  { key: 'mgt', label: '경영지원본부', deptCode: 'MGT' },
  { key: 'dev', label: '마케팅개발본부', deptCode: 'DEV' },
  { key: 'hakjeom', label: '학점은행제 사업부', deptCode: 'BIZ', teamName: '학사팀' },
  { key: 'cert', label: '민간자격증 사업부', deptCode: 'BIZ', teamName: '민간팀' },
  { key: 'practice', label: '실습 사업부', deptCode: 'BIZ', teamName: '실습팀' },
]

export interface ResolvedScope {
  key: string
  label: string
  departmentId: string
  teamId: string | null
}

/** scope 키 → 본부 id + 팀 id 해석 (없으면 null) */
export async function resolveScope(scopeKey: string | null | undefined): Promise<ResolvedScope | null> {
  if (!scopeKey) return null
  const def = BUDGET_SCOPES.find((s) => s.key === scopeKey)
  if (!def) return null

  const { data: dept } = await supabaseAdmin
    .from('departments')
    .select('id')
    .eq('code', def.deptCode)
    .maybeSingle()
  if (!dept) return null

  let teamId: string | null = null
  if (def.teamName) {
    const { data: team } = await supabaseAdmin
      .from('teams')
      .select('id')
      .eq('department_id', dept.id)
      .eq('name', def.teamName)
      .maybeSingle()
    teamId = team?.id ?? null
  }

  return { key: def.key, label: def.label, departmentId: dept.id, teamId }
}
