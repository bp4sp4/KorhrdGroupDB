-- 개인 인사고과 평가자(본부장/팀장) 마무리 피드백(총평)
-- 개인평가 제출(확정) 후 평가자가 작성/수정 → 직원이 /me/appraisal 에서 점수와 함께 열람.
-- 작성 API: PUT /api/appraisal-evaluations/{id}/feedback
ALTER TABLE public.appraisal_evaluations
  ADD COLUMN IF NOT EXISTS feedback text,
  ADD COLUMN IF NOT EXISTS feedback_at timestamptz;
