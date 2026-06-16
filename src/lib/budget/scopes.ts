import { supabaseAdmin } from '@/lib/supabase/admin'

// 사이드바 사업부 메뉴 ↔ 예산 범위 매핑.
// 각 사업부는 '특정 통장(계좌)' 기준으로 사용예산을 본다.
// 같은 본부 소속이면 팀과 무관하게 열람 가능(접근은 본부 단위).
// 매핑 수정은 여기 한 곳만 바꾸면 된다.
export interface BudgetScopeDef {
  key: string // URL ?scope= 값
  label: string // 화면 제목
  deptCode: string // 소속 본부 코드 (MGT / DEV / BIZ) — 한도·접근 기준
  accountNumbers: string[] // 이 사업부가 보는 통장(계좌)들
}

export const BUDGET_SCOPES: BudgetScopeDef[] = [
  { key: 'hakjeom', label: '학점은행제 사업부', deptCode: 'BIZ', accountNumbers: ['140015307601'] },
  { key: 'cert', label: '민간자격증 사업부', deptCode: 'BIZ', accountNumbers: ['140016284987'] },
  { key: 'practice', label: '실습 사업부', deptCode: 'BIZ', accountNumbers: ['140016285078'] },
  { key: 'dev', label: '마케팅개발본부', deptCode: 'DEV', accountNumbers: ['140014910339'] },
]

export interface ResolvedScope {
  key: string
  label: string
  departmentId: string
  accountNumbers: string[]
}

/** scope 키 → 본부 id + 계좌 목록 해석 */
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

  return {
    key: def.key,
    label: def.label,
    departmentId: dept.id,
    accountNumbers: def.accountNumbers,
  }
}
