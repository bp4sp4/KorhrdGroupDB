-- 인사고과 분기(period) — 평가주기 분기별(년 4회) 지원
-- 같은 고과표라도 분기마다 별도 평가를 작성한다.

ALTER TABLE appraisal_evaluations
  ADD COLUMN IF NOT EXISTS period TEXT NOT NULL DEFAULT '2026-Q2'
  CHECK (period ~ '^\d{4}-Q[1-4]$');

COMMENT ON COLUMN appraisal_evaluations.period IS '평가 분기 (YYYY-Qn)';

-- 기본값은 백필용 — 이후 API가 항상 명시 입력
ALTER TABLE appraisal_evaluations ALTER COLUMN period DROP DEFAULT;

-- 같은 고과표·같은 분기에서 같은 대상은 1건
DROP INDEX IF EXISTS appraisal_evaluations_team_target_uniq;
DROP INDEX IF EXISTS appraisal_evaluations_personal_target_uniq;
CREATE UNIQUE INDEX IF NOT EXISTS appraisal_evaluations_team_target_uniq
  ON appraisal_evaluations (form_id, period, target_team_id) WHERE sheet_key = 'team';
CREATE UNIQUE INDEX IF NOT EXISTS appraisal_evaluations_personal_target_uniq
  ON appraisal_evaluations (form_id, period, target_user_id) WHERE sheet_key = 'personal';
CREATE INDEX IF NOT EXISTS appraisal_evaluations_period_idx
  ON appraisal_evaluations (period);
