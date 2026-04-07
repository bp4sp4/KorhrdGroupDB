-- approvals 테이블에 reference_ids (참조자) 컬럼 추가
ALTER TABLE public.approvals
  DROP COLUMN IF EXISTS reference_ids;

ALTER TABLE public.approvals
  ADD COLUMN reference_ids bigint[] DEFAULT '{}';
