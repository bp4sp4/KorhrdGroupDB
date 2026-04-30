-- 맘카페 관리 테이블
CREATE TABLE IF NOT EXISTS mom_cafes (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,                 -- 맘카페 이름
  contact TEXT,                       -- 관계자 연락처
  bank_name TEXT,                     -- 은행명
  account_number TEXT,                -- 입금 계좌
  account_holder TEXT,                -- 예금주명
  monthly_payment NUMERIC NOT NULL DEFAULT 0,  -- 월 납부액
  total_payment NUMERIC NOT NULL DEFAULT 0,    -- 총 납부액
  contract_start DATE,                -- 계약기간 시작
  contract_end DATE,                  -- 계약기간 끝
  expense_note TEXT,                  -- 비용처리
  writing_note TEXT,                  -- 글작성
  special_note TEXT,                  -- 특이사항
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE mom_cafes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS authenticated_all_mom_cafes ON mom_cafes;
CREATE POLICY authenticated_all_mom_cafes ON mom_cafes
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_mom_cafes_name ON mom_cafes (name);
CREATE INDEX IF NOT EXISTS idx_mom_cafes_created_at ON mom_cafes (created_at DESC);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_mom_cafes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mom_cafes_updated_at ON mom_cafes;
CREATE TRIGGER trg_mom_cafes_updated_at
  BEFORE UPDATE ON mom_cafes
  FOR EACH ROW
  EXECUTE FUNCTION update_mom_cafes_updated_at();
