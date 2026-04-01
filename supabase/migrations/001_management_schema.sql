-- ============================================================
-- MANAGEMENT SYSTEM SCHEMA
-- 경영관리 시스템 DB 스키마
-- ============================================================

-- 사업부
CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  is_active boolean DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

INSERT INTO departments (code, name, sort_order) VALUES
  ('MGT', '경영지원본부', 1),
  ('DEV', '개발본부', 2),
  ('BIZ', '사업본부', 3)
ON CONFLICT (code) DO NOTHING;

-- 지출 분류
CREATE TABLE IF NOT EXISTS expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  is_active boolean DEFAULT true,
  sort_order int DEFAULT 0
);

INSERT INTO expense_categories (name, sort_order) VALUES
  ('광고비', 1), ('인건비', 2), ('외주비', 3),
  ('시스템/솔루션비', 4), ('교육운영비', 5),
  ('수수료', 6), ('임차료/관리비', 7), ('기타', 8)
ON CONFLICT (name) DO NOTHING;

-- 매출
CREATE TABLE IF NOT EXISTS revenues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revenue_date date NOT NULL,
  department_id uuid REFERENCES departments(id),
  revenue_type text CHECK (revenue_type IN ('CARD', 'BANK_TRANSFER', 'OTHER')) NOT NULL DEFAULT 'CARD',
  customer_name text NOT NULL,
  amount bigint NOT NULL,
  product_name text,
  manager_id uuid,
  memo text,
  source text CHECK (source IN ('MANUAL', 'EXCEL_UPLOAD', 'API')) DEFAULT 'MANUAL',
  upload_batch_id uuid,
  created_at timestamptz DEFAULT now(),
  created_by uuid,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid,
  is_deleted boolean DEFAULT false
);

-- 결재선 템플릿
CREATE TABLE IF NOT EXISTS approval_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type text NOT NULL UNIQUE,
  category text NOT NULL,
  steps jsonb NOT NULL DEFAULT '[]',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

INSERT INTO approval_templates (document_type, category, steps) VALUES
  ('출장신청서', '출장', '[{"step":1,"type":"APPLICANT","label":"신청자"},{"step":2,"type":"DEPARTMENT_HEAD","label":"경영지원본부장"},{"step":3,"type":"DEPARTMENT_HEAD","label":"대표이사"}]'),
  ('출장 업무 보고서', '출장', '[{"step":1,"type":"APPLICANT","label":"신청자"},{"step":2,"type":"DEPARTMENT_HEAD","label":"경영지원본부장"},{"step":3,"type":"DEPARTMENT_HEAD","label":"대표이사"}]'),
  ('퇴사확정일 요청서', '인사', '[{"step":1,"type":"APPLICANT","label":"신청자"},{"step":2,"type":"DEPARTMENT_HEAD","label":"경영지원본부장"},{"step":3,"type":"DEPARTMENT_HEAD","label":"대표이사"}]'),
  ('인수인계요청서', '인사', '[{"step":1,"type":"APPLICANT","label":"신청자"},{"step":2,"type":"DEPARTMENT_HEAD","label":"경영지원본부장"},{"step":3,"type":"DEPARTMENT_HEAD","label":"대표이사"}]'),
  ('근태사유서', '인사', '[{"step":1,"type":"APPLICANT","label":"신청자"},{"step":2,"type":"DEPARTMENT_HEAD","label":"경영지원본부장"},{"step":3,"type":"DEPARTMENT_HEAD","label":"대표이사"}]'),
  ('사원증 신청서', '인사', '[{"step":1,"type":"APPLICANT","label":"신청자"},{"step":2,"type":"DEPARTMENT_HEAD","label":"경영지원본부장"}]'),
  ('휴가신청서', '인사', '[{"step":1,"type":"APPLICANT","label":"신청자"},{"step":2,"type":"DEPARTMENT_HEAD","label":"경영지원본부장"}]'),
  ('명함 신청서', '인사', '[{"step":1,"type":"APPLICANT","label":"신청자"},{"step":2,"type":"DEPARTMENT_HEAD","label":"경영지원본부장"}]'),
  ('[적립금] 지출결의서', '회계', '[{"step":1,"type":"APPLICANT","label":"신청자"},{"step":2,"type":"DEPARTMENT_HEAD","label":"경영지원본부장"},{"step":3,"type":"DEPARTMENT_HEAD","label":"대표이사"}]'),
  ('[제휴] 입금요청서', '회계', '[{"step":1,"type":"APPLICANT","label":"신청자"},{"step":2,"type":"DEPARTMENT_HEAD","label":"경영지원본부장"},{"step":3,"type":"DEPARTMENT_HEAD","label":"대표이사"}]'),
  ('[제휴] 환불요청서', '회계', '[{"step":1,"type":"APPLICANT","label":"신청자"},{"step":2,"type":"DEPARTMENT_HEAD","label":"경영지원본부장"},{"step":3,"type":"DEPARTMENT_HEAD","label":"대표이사"}]'),
  ('[운영비] 입금요청서', '회계', '[{"step":1,"type":"APPLICANT","label":"신청자"},{"step":2,"type":"DEPARTMENT_HEAD","label":"경영지원본부장"},{"step":3,"type":"DEPARTMENT_HEAD","label":"대표이사"}]'),
  ('법인카드 사용내역 제출서', '회계', '[{"step":1,"type":"APPLICANT","label":"신청자"},{"step":2,"type":"DEPARTMENT_HEAD","label":"경영지원본부장"},{"step":3,"type":"DEPARTMENT_HEAD","label":"대표이사"}]')
ON CONFLICT (document_type) DO NOTHING;

-- 결재 문서
CREATE TABLE IF NOT EXISTS approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_number text UNIQUE,
  template_id uuid REFERENCES approval_templates(id),
  document_type text NOT NULL,
  category text NOT NULL,
  status text CHECK (status IN ('DRAFT','SUBMITTED','IN_PROGRESS','APPROVED','REJECTED','RESUBMITTED','CANCELLED')) DEFAULT 'DRAFT',
  applicant_id uuid NOT NULL,
  department_id uuid REFERENCES departments(id),
  title text NOT NULL,
  content jsonb DEFAULT '{}',
  current_step int DEFAULT 0,
  submitted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 결재 단계별 이력
CREATE TABLE IF NOT EXISTS approval_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id uuid REFERENCES approvals(id) ON DELETE CASCADE,
  step_number int NOT NULL,
  approver_id uuid NOT NULL,
  status text CHECK (status IN ('PENDING','APPROVED','REJECTED')) DEFAULT 'PENDING',
  comment text,
  acted_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 결재 첨부파일
CREATE TABLE IF NOT EXISTS approval_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id uuid REFERENCES approvals(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  file_type text,
  created_at timestamptz DEFAULT now(),
  created_by uuid
);

-- 지출 (결재 완료 시 자동 반영)
CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id uuid REFERENCES approvals(id),
  expense_date date NOT NULL,
  department_id uuid REFERENCES departments(id),
  category_id uuid REFERENCES expense_categories(id),
  detail text,
  amount bigint NOT NULL,
  payment_method text CHECK (payment_method IN ('CORPORATE_CARD','BANK_TRANSFER','CASH','OTHER')) DEFAULT 'CORPORATE_CARD',
  vendor text,
  memo text,
  created_at timestamptz DEFAULT now(),
  is_deleted boolean DEFAULT false
);
