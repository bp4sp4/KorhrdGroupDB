-- 인사고과 평가 작성 (appraisal_evaluations)
-- 규정 제6조 평가 권한:
--   팀 역량평가  : 사업본부장(직책 '본부장')이 본부 내 팀별로 작성
--   개인 역량평가: 팀원 → 팀장(teams.leader_user_id) 작성 / 팀장 → 사업본부장 작성

-- 1) 팀장 지정 컬럼
ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS leader_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL;

COMMENT ON COLUMN teams.leader_user_id IS '팀장 (인사고과 개인역량평가 작성자)';

-- 2) 평가 작성 테이블
CREATE TABLE IF NOT EXISTS appraisal_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES appraisal_forms(id) ON DELETE CASCADE,
  sheet_key TEXT NOT NULL CHECK (sheet_key IN ('team', 'personal')),
  target_team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  target_user_id BIGINT REFERENCES app_users(id) ON DELETE CASCADE,
  evaluator_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  -- 블록별/세부지표별 점수: [[5,4,null,...], ...] (양식 blocks 순서와 동일)
  scores JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted')),
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (sheet_key = 'team' AND target_team_id IS NOT NULL AND target_user_id IS NULL) OR
    (sheet_key = 'personal' AND target_user_id IS NOT NULL AND target_team_id IS NULL)
  )
);

-- 같은 고과표에서 같은 대상은 1건 (팀/개인 각각)
CREATE UNIQUE INDEX IF NOT EXISTS appraisal_evaluations_team_target_uniq
  ON appraisal_evaluations (form_id, target_team_id) WHERE sheet_key = 'team';
CREATE UNIQUE INDEX IF NOT EXISTS appraisal_evaluations_personal_target_uniq
  ON appraisal_evaluations (form_id, target_user_id) WHERE sheet_key = 'personal';
CREATE INDEX IF NOT EXISTS appraisal_evaluations_form_idx
  ON appraisal_evaluations (form_id);
CREATE INDEX IF NOT EXISTS appraisal_evaluations_evaluator_idx
  ON appraisal_evaluations (evaluator_id);

CREATE OR REPLACE FUNCTION appraisal_evaluations_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS appraisal_evaluations_updated_at_trigger ON appraisal_evaluations;
CREATE TRIGGER appraisal_evaluations_updated_at_trigger
  BEFORE UPDATE ON appraisal_evaluations
  FOR EACH ROW
  EXECUTE FUNCTION appraisal_evaluations_set_updated_at();

-- 서비스 롤(API)만 접근
ALTER TABLE appraisal_evaluations ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE appraisal_evaluations IS '인사고과 평가 작성 — 팀역량(본부장), 개인역량(팀장/본부장)';
