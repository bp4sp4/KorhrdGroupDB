-- 학점은행제 문의 DB: 빠른상담 관련 전용 컬럼
-- (기존엔 counsel_check 텍스트에 "빠른상담 / 선호시간:..." 형태로 욱여넣던 것을 분리)
ALTER TABLE public.hakjeom_consultations
  ADD COLUMN IF NOT EXISTS fast_consultation boolean NOT NULL DEFAULT false;   -- 빠른상담 체크

ALTER TABLE public.hakjeom_consultations
  ADD COLUMN IF NOT EXISTS preferred_times text[];                              -- 상담 선호 시간 (복수)

ALTER TABLE public.hakjeom_consultations
  ADD COLUMN IF NOT EXISTS consult_time_memo text;                             -- 상담 시간 관련 메모

COMMENT ON COLUMN public.hakjeom_consultations.fast_consultation IS '빠른상담 신청 여부';
COMMENT ON COLUMN public.hakjeom_consultations.preferred_times    IS '상담 선호 시간대 (예: {10:00~13:00,14:00~17:00})';
COMMENT ON COLUMN public.hakjeom_consultations.consult_time_memo  IS '상담 시간 관련 메모';
