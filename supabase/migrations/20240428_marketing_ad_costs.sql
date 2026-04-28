-- marketing_ad_costs: 채널별 월간 광고비를 수기 입력/저장하는 테이블
CREATE TABLE IF NOT EXISTS marketing_ad_costs (
  id BIGSERIAL PRIMARY KEY,
  channel TEXT NOT NULL,
  year_month TEXT NOT NULL,           -- 'YYYY-MM' 형식
  ad_cost NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(channel, year_month)
);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_marketing_ad_costs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_marketing_ad_costs_updated_at
  BEFORE UPDATE ON marketing_ad_costs
  FOR EACH ROW
  EXECUTE FUNCTION update_marketing_ad_costs_updated_at();
