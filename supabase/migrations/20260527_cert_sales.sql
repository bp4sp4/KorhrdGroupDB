-- 민간자격증 사업부 매출파일 (cert_sales)
-- certificate_applications (source='bridge' AND payment_status='paid')를 base로
-- 사용자 입력 필드(과목수, 특이사항, 처리번호 등)를 overlay 저장.
-- 분류 = '학점연계' (자동 임포트) | '후납' (수동 등록)

CREATE TABLE IF NOT EXISTS cert_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 연결: 학점연계 신청 1건당 매출 row 1개 (NULL이면 후납/수동 orphan)
  cert_application_id UUID REFERENCES certificate_applications(id) ON DELETE SET NULL,

  -- 학생 정보 (cert_application_id가 NULL인 후납 케이스 보존용)
  student_name TEXT NOT NULL,
  phone TEXT,
  manager_name TEXT,

  -- 분류: 학점연계(자동) | 후납(수동)
  category TEXT NOT NULL DEFAULT '학점연계'
    CHECK (category IN ('학점연계', '후납')),

  -- 매출 정보
  unit_price INTEGER DEFAULT 5000,           -- 단가 (기본 5000)
  subject_count INTEGER,                     -- 과목수 (수동 입력)
  total_amount INTEGER,                      -- 결제금액
  payment_method TEXT
    CHECK (payment_method IS NULL OR payment_method IN ('bank_transfer', 'card')),
  payment_date DATE,                         -- 결제일
  cohort TEXT,                               -- 개강반 (YYYY-MM-DD 또는 'M월')

  -- 발행 정보
  notes TEXT,                                -- 특이사항
  process_number TEXT,                       -- (현)처리번호
  issue_date DATE,                           -- (현)발급일자
  is_published BOOLEAN NOT NULL DEFAULT FALSE,

  -- 환불 상태
  refund_status TEXT NOT NULL DEFAULT '정상'
    CHECK (refund_status IN ('정상', '당월 환불', '환불', '정산', '보류')),
  refund_date DATE,

  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- cert_application_id는 학점연계 신청 1건당 매출 1건이도록 UNIQUE (NULL 다중 허용 — 후납 orphan용)
CREATE UNIQUE INDEX IF NOT EXISTS cert_sales_cert_application_id_uniq
  ON cert_sales(cert_application_id)
  WHERE cert_application_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS cert_sales_payment_date_idx ON cert_sales(payment_date);
CREATE INDEX IF NOT EXISTS cert_sales_manager_name_idx ON cert_sales(manager_name);
CREATE INDEX IF NOT EXISTS cert_sales_refund_status_idx ON cert_sales(refund_status);
CREATE INDEX IF NOT EXISTS cert_sales_category_idx ON cert_sales(category);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION cert_sales_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cert_sales_updated_at_trigger ON cert_sales;
CREATE TRIGGER cert_sales_updated_at_trigger
  BEFORE UPDATE ON cert_sales
  FOR EACH ROW
  EXECUTE FUNCTION cert_sales_set_updated_at();
