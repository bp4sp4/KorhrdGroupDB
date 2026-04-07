-- app_users 테이블에 소속 부서 컬럼 추가
ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES departments(id) ON DELETE SET NULL;
