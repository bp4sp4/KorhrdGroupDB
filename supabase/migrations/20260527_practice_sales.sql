-- 실습 사업부 매출파일 (practice_sales)
-- practice_applications(payment_status='paid')를 base로 사용자 입력 overlay
-- 분류 = '실습' (자동 임포트) | '후납' (수동 등록)

CREATE TABLE IF NOT EXISTS practice_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_application_id UUID REFERENCES practice_applications(id) ON DELETE SET NULL,
  student_name TEXT NOT NULL,
  phone TEXT,
  manager_name TEXT,
  category TEXT NOT NULL DEFAULT '실습'
    CHECK (category IN ('실습', '후납')),
  total_amount INTEGER,
  payment_method TEXT
    CHECK (payment_method IS NULL OR payment_method IN ('bank_transfer', 'card')),
  payment_date DATE,
  cohort TEXT,
  process_number TEXT,
  issue_date DATE,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  refund_status TEXT NOT NULL DEFAULT '정상'
    CHECK (refund_status IN ('정상', '당월 환불', '환불', '정산', '보류')),
  refund_date DATE,
  is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS practice_sales_practice_application_id_uniq
  ON practice_sales(practice_application_id)
  WHERE practice_application_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS practice_sales_payment_date_idx ON practice_sales(payment_date);
CREATE INDEX IF NOT EXISTS practice_sales_manager_name_idx ON practice_sales(manager_name);
CREATE INDEX IF NOT EXISTS practice_sales_refund_status_idx ON practice_sales(refund_status);
CREATE INDEX IF NOT EXISTS practice_sales_category_idx ON practice_sales(category);
CREATE INDEX IF NOT EXISTS practice_sales_is_hidden_idx ON practice_sales(is_hidden) WHERE is_hidden = TRUE;

CREATE OR REPLACE FUNCTION practice_sales_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS practice_sales_updated_at_trigger ON practice_sales;
CREATE TRIGGER practice_sales_updated_at_trigger
  BEFORE UPDATE ON practice_sales
  FOR EACH ROW
  EXECUTE FUNCTION practice_sales_set_updated_at();

ALTER TABLE practice_sales ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE practice_sales IS '실습 사업부 매출파일 — practice_applications(paid) overlay';

-- user_permissions / position_permissions CHECK 갱신 (practice-sales 추가)
ALTER TABLE user_permissions DROP CONSTRAINT IF EXISTS user_permissions_section_check;
ALTER TABLE user_permissions ADD CONSTRAINT user_permissions_section_check
  CHECK (section = ANY (ARRAY[
    'hakjeom'::text, 'edu-sales'::text, 'edu-students'::text,
    'cert'::text, 'cert-sales'::text,
    'practice'::text, 'practice-sales'::text,
    'allcare'::text, 'abroad'::text,
    'duplicate'::text, 'trash'::text, 'logs'::text,
    'ref-manage'::text, 'assignment'::text, 'links'::text,
    'marketing'::text, 'approvals'::text, 'revenues'::text,
    'revenue-upload'::text, 'reports'::text, 'bankaccount'::text,
    'task-board'::text, 'me-leave'::text
  ]));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'position_permissions_section_check'
  ) THEN
    ALTER TABLE position_permissions DROP CONSTRAINT position_permissions_section_check;
    ALTER TABLE position_permissions ADD CONSTRAINT position_permissions_section_check
      CHECK (section = ANY (ARRAY[
        'hakjeom'::text, 'edu-sales'::text, 'edu-students'::text,
        'cert'::text, 'cert-sales'::text,
        'practice'::text, 'practice-sales'::text,
        'allcare'::text, 'abroad'::text,
        'duplicate'::text, 'trash'::text, 'logs'::text,
        'ref-manage'::text, 'assignment'::text, 'links'::text,
        'marketing'::text, 'approvals'::text, 'revenues'::text,
        'revenue-upload'::text, 'reports'::text, 'bankaccount'::text,
        'task-board'::text, 'me-leave'::text
      ]));
  END IF;
END $$;
