-- ============================================================
-- 학점은행제 통합 관리 시스템 - RLS 정책
-- ============================================================
-- 전략:
--   - 모든 테이블 RLS 활성화 (기본: anon 접근 전면 차단)
--   - service_role key는 RLS 자동 우회 (API 서버용)
--   - 공개 폼 제출 테이블만 anon INSERT 허용
-- ============================================================


-- ============================================================
-- RLS 활성화 (전체 테이블)
-- ============================================================

alter table public.app_users                  enable row level security;
alter table public.agency_agreements          enable row level security;
alter table public.hakjeom_consultations      enable row level security;
alter table public.credit_bank_contacts       enable row level security;
alter table public.private_cert_consultations enable row level security;
alter table public.csv_staging                enable row level security;
alter table public.certificate_applications   enable row level security;
alter table public.payment_logs               enable row level security;
alter table public.practice_consultations     enable row level security;
alter table public.employment_applications    enable row level security;
alter table public.practice_applications      enable row level security;
alter table public.channels                   enable row level security;
alter table public.orders                     enable row level security;
alter table public.payment_cancellations      enable row level security;


-- ============================================================
-- 관리자 전용 테이블 (anon 접근 완전 차단)
-- service_role key만 접근 가능
-- ============================================================

-- app_users: 완전 차단 (로그인 검증은 서버에서만)
-- agency_agreements: 관리자만
-- credit_bank_contacts: 관리자만
-- csv_staging: 관리자만
-- channels: 관리자만
-- orders: 관리자만
-- payment_logs: 관리자만
-- payment_cancellations: 관리자만
-- (정책 없음 = anon 전면 차단)


-- ============================================================
-- 공개 폼 제출 테이블 - anon INSERT만 허용
-- (Next.js 외부 landing page에서 폼 제출할 경우 대비)
-- ============================================================

-- 학점은행제 상담 접수
create policy "public_insert_hakjeom_consultations"
  on public.hakjeom_consultations
  for insert
  to anon
  with check (true);

-- 민간자격증 상담 접수
create policy "public_insert_private_cert_consultations"
  on public.private_cert_consultations
  for insert
  to anon
  with check (true);

-- 실습/취업 상담 접수
create policy "public_insert_practice_consultations"
  on public.practice_consultations
  for insert
  to anon
  with check (true);

-- 자격증 신청 (결제 포함)
create policy "public_insert_certificate_applications"
  on public.certificate_applications
  for insert
  to anon
  with check (true);

-- 취업 신청
create policy "public_insert_employment_applications"
  on public.employment_applications
  for insert
  to anon
  with check (true);

-- 실습 신청
create policy "public_insert_practice_applications"
  on public.practice_applications
  for insert
  to anon
  with check (true);


-- ============================================================
-- 참고
-- ============================================================
-- anon key로 SELECT/UPDATE/DELETE 시도 시 → 빈 결과 또는 오류 반환
-- service_role key로는 모든 작업 정상 동작 (RLS 우회)
-- 관리자 대시보드 API는 반드시 service_role key 사용할 것
-- ============================================================
