-- 마케팅 소재 테이블
CREATE TABLE IF NOT EXISTS marketing_creatives (
  id BIGSERIAL PRIMARY KEY,
  division TEXT NOT NULL,
  channel TEXT NOT NULL,
  name TEXT NOT NULL,
  campaign TEXT,
  type TEXT NOT NULL,
  thumbnail_path TEXT,
  impressions BIGINT NOT NULL DEFAULT 0,
  clicks BIGINT NOT NULL DEFAULT 0,
  db_count BIGINT NOT NULL DEFAULT 0,
  registrations BIGINT NOT NULL DEFAULT 0,
  ad_cost NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT '활성',
  registered_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_creatives_division ON marketing_creatives (division);
CREATE INDEX IF NOT EXISTS idx_marketing_creatives_channel ON marketing_creatives (channel);
CREATE INDEX IF NOT EXISTS idx_marketing_creatives_registered_at ON marketing_creatives (registered_at DESC);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_marketing_creatives_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_marketing_creatives_updated_at ON marketing_creatives;
CREATE TRIGGER trg_marketing_creatives_updated_at
  BEFORE UPDATE ON marketing_creatives
  FOR EACH ROW
  EXECUTE FUNCTION update_marketing_creatives_updated_at();

-- Storage bucket: 'marketing-creatives' (Public)
-- Supabase 대시보드 > Storage 에서 'marketing-creatives' 버킷 생성 (Public 옵션 활성화)
