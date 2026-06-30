-- marketing_ad_costs_weekly: 채널별 "주간" 광고비를 수기 입력/저장하는 테이블
-- 월간(marketing_ad_costs)과 별개로 운영. week_start = 해당 주 월요일(DATE).

-- updated_at 자동 갱신 함수 (월간 테이블과 공용 — 없을 수 있으니 멱등 생성)
CREATE OR REPLACE FUNCTION update_marketing_ad_costs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS marketing_ad_costs_weekly (
  id BIGSERIAL PRIMARY KEY,
  division TEXT NOT NULL DEFAULT 'nms',  -- 'nms' | 'cert' | 'abroad'
  channel TEXT NOT NULL,
  week_start DATE NOT NULL,              -- 해당 주 월요일
  ad_cost NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(division, channel, week_start)
);

CREATE INDEX IF NOT EXISTS idx_marketing_ad_costs_weekly_division
  ON marketing_ad_costs_weekly (division);

-- updated_at 자동 갱신 (월간 테이블과 동일 트리거 함수 재사용)
DROP TRIGGER IF EXISTS trg_marketing_ad_costs_weekly_updated_at ON marketing_ad_costs_weekly;
CREATE TRIGGER trg_marketing_ad_costs_weekly_updated_at
  BEFORE UPDATE ON marketing_ad_costs_weekly
  FOR EACH ROW
  EXECUTE FUNCTION update_marketing_ad_costs_updated_at();
