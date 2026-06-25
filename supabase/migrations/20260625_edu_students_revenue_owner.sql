-- 매출 귀속 전용 담당자(revenue_owner) — 관리 담당(manager_name)과 분리.
--   매출파일/매출 집계 = revenue_owner 기준, 관리/업무/건수 = manager_name 기준.
--   목적: 등록학생 관리 담당자를 바꿔도 매출 귀속은 그대로 유지.
ALTER TABLE public.edu_students ADD COLUMN IF NOT EXISTS revenue_owner text;

-- 기존 전체 백필: 현재 매출 귀속(=manager_name) 그대로 보존 (변경으로 바뀌는 사람 0명)
UPDATE public.edu_students SET revenue_owner = manager_name WHERE revenue_owner IS NULL;

-- 신규 등록 시 revenue_owner 비면 manager_name 자동 복사 (등록 담당에게 매출 귀속)
CREATE OR REPLACE FUNCTION public.edu_students_set_revenue_owner()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.revenue_owner IS NULL THEN
    NEW.revenue_owner := NEW.manager_name;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_edu_students_revenue_owner ON public.edu_students;
CREATE TRIGGER trg_edu_students_revenue_owner
  BEFORE INSERT ON public.edu_students
  FOR EACH ROW EXECUTE FUNCTION public.edu_students_set_revenue_owner();
