-- 보안: RLS 미적용(UNRESTRICTED) 2개 테이블에 RLS 활성화
-- 두 테이블 모두 서버 API(api/budget/*)에서 supabaseAdmin(service_role)로만 접근.
-- service_role은 RLS를 우회하므로 서버 동작은 영향 없음.
-- 정책을 추가하지 않음 = anon/authenticated 직접 접근 전면 차단 (다른 관리자 테이블과 동일 패턴).
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_budgets ENABLE ROW LEVEL SECURITY;
