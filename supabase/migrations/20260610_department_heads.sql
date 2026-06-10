-- 조직 구조 단일화
--   팀 소속  : app_users.team_id (계정 관리에서 지정 — 기존 그대로, 업무일지와 공유)
--   팀장     : teams.leader_user_id (팀 탭에서 해당 팀 소속자 중 지정)
--   본부장   : departments.head_user_id (사업부 탭에서 지정) — 직책 추론 대신 명시 지정

ALTER TABLE departments
  ADD COLUMN IF NOT EXISTS head_user_id BIGINT REFERENCES app_users(id) ON DELETE SET NULL;

COMMENT ON COLUMN departments.head_user_id IS '사업본부장 (인사고과 팀역량평가·팀장 개인역량평가 작성자)';
