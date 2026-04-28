-- marketing_ad_costs 에 division 컬럼 추가 (학점은행제/민간자격증/유학 구분)
ALTER TABLE marketing_ad_costs
  ADD COLUMN IF NOT EXISTS division TEXT NOT NULL DEFAULT 'nms';

-- 기존 unique constraint 제거 후 division 포함하여 재생성
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'marketing_ad_costs_channel_year_month_key'
  ) THEN
    ALTER TABLE marketing_ad_costs DROP CONSTRAINT marketing_ad_costs_channel_year_month_key;
  END IF;
END $$;

ALTER TABLE marketing_ad_costs
  ADD CONSTRAINT marketing_ad_costs_division_channel_year_month_key
  UNIQUE (division, channel, year_month);

CREATE INDEX IF NOT EXISTS idx_marketing_ad_costs_division ON marketing_ad_costs (division);
