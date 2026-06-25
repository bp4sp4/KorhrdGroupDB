-- 상담 시작 버튼 클릭 시각.
--   · 워크스페이스 카드/상세 패널: 연락처(contact) blur 해제 기준 (클릭 전 가림 → 클릭 후 공개)
--   · 문의 DB: 응답시간 = consult_started_at − manager_assigned_at
-- 최초 클릭 시 1회만 기록 (API PATCH 에서 기존 값 있으면 덮어쓰기 차단).
ALTER TABLE public.hakjeom_consultations
  ADD COLUMN IF NOT EXISTS consult_started_at timestamptz;
