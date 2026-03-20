-- memo_logs: 상담별 메모 히스토리 테이블
CREATE TABLE IF NOT EXISTS memo_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name  TEXT        NOT NULL,   -- 'hakjeom_consultations' | 'private_cert_consultations' | 'practice_consultations' | 'practice_applications' | 'employment_applications' | 'agency_agreements'
  record_id   UUID        NOT NULL,
  content     TEXT        NOT NULL,
  author      TEXT,                   -- 작성자 이메일
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memo_logs_record ON memo_logs (table_name, record_id, created_at DESC);
