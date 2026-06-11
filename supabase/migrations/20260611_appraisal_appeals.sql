-- 인사고과 이의제기 (appraisal_appeals)
-- 피평가자가 제출 완료된 본인 평가에 이의제기 + 근거 자료 첨부.
-- 평가자가 재평가 후 재제출하면 status='resolved' 처리.

CREATE TABLE IF NOT EXISTS appraisal_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id uuid NOT NULL REFERENCES appraisal_evaluations(id) ON DELETE CASCADE,
  user_id bigint NOT NULL,                -- 이의제기자 (피평가자, app_users.id)
  content text NOT NULL,                  -- 이의 내용
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{name, url, type, size}]
  status text NOT NULL DEFAULT 'pending', -- pending(처리 대기) | resolved(재평가 완료)
  resolved_by bigint,                     -- 처리한 평가자 (app_users.id)
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appraisal_appeals_evaluation ON appraisal_appeals(evaluation_id);
CREATE INDEX IF NOT EXISTS idx_appraisal_appeals_user ON appraisal_appeals(user_id);

ALTER TABLE appraisal_appeals ENABLE ROW LEVEL SECURITY;

-- 첨부파일 버킷 (공개 읽기 — 기존 approval-attachments 와 동일 패턴)
INSERT INTO storage.buckets (id, name, public)
VALUES ('appraisal-appeals', 'appraisal-appeals', true)
ON CONFLICT (id) DO NOTHING;
