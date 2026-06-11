-- 고과표 양식 팀 지정 (NULL = 전사 공통)
-- 평가 작성 탭에서 양식의 적용 팀에 해당하는 대상만 노출된다.

ALTER TABLE appraisal_forms
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES teams(id) ON DELETE SET NULL;
COMMENT ON COLUMN appraisal_forms.team_id IS '적용 팀 (NULL = 전사 공통)';

-- 인사고과 운영 시작은 2026년 3분기 — 기존 2분기 테스트 평가를 3분기로 이동
UPDATE appraisal_evaluations SET period = '2026-Q3' WHERE period = '2026-Q2';
