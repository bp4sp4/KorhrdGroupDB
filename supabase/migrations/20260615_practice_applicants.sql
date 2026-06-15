-- 실습 사업부 "실습신청자" 목록 (학점연계 문의 DB 패턴)
-- 데이터는 CSV 로 직접 import. 앱에서는 조회/상태변경/편집만 수행.
CREATE TABLE IF NOT EXISTS practice_applicants (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  seq_no             integer,                              -- 번호 (CSV 원본 번호, 선택)
  name               text NOT NULL,                        -- 이름
  contact            text,                                 -- 연락처
  birth_date         text,                                 -- 생년월일
  address            text,                                 -- 주소
  desired_date       text,                                 -- 희망날짜
  practice_type      text,                                 -- 실습종류
  desired_weekday    text,                                 -- 희망요일
  recognition_period text,                                 -- 실습 세미나 인정기간
  training_center    text,                                 -- 실습교육원
  field_institution  text,                                 -- 현장실습기관
  status             text NOT NULL DEFAULT '추후진행예정', -- 입금완료 / 추후진행예정 / 재연계
  counsel_content    text,                                 -- 상담내용
  amount             integer DEFAULT 33000,                -- 결제금액 (기본 33,000)
  manager            text,                                 -- 담당자 (선택)
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_practice_applicants_status
  ON practice_applicants(status);
CREATE INDEX IF NOT EXISTS idx_practice_applicants_created_at
  ON practice_applicants(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_practice_applicants_name
  ON practice_applicants(name);

-- updated_at 자동 갱신
CREATE OR REPLACE FUNCTION set_practice_applicants_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_practice_applicants_updated_at ON practice_applicants;
CREATE TRIGGER trg_practice_applicants_updated_at
  BEFORE UPDATE ON practice_applicants
  FOR EACH ROW EXECUTE FUNCTION set_practice_applicants_updated_at();

-- 서버(supabaseAdmin, service_role)로만 접근. 클라이언트 직접 접근 차단.
ALTER TABLE practice_applicants ENABLE ROW LEVEL SECURITY;
