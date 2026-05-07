-- 등록완료 시점 추적용 컬럼 추가
-- 상담완료-높음/중간/낮음 → 등록완료(또는 지인등록) 전환 분석용
-- 상태가 '등록완료' 또는 '지인등록'으로 바뀔 때 API에서 자동 기록

ALTER TABLE hakjeom_consultations
  ADD COLUMN IF NOT EXISTS registered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_counsel_level TEXT;

ALTER TABLE private_cert_consultations
  ADD COLUMN IF NOT EXISTS registered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_counsel_level TEXT;

-- 인덱스 (전환 분석 쿼리 성능)
CREATE INDEX IF NOT EXISTS idx_hakjeom_consultations_registered_at
  ON hakjeom_consultations (registered_at)
  WHERE registered_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_private_cert_consultations_registered_at
  ON private_cert_consultations (registered_at)
  WHERE registered_at IS NOT NULL;

-- 기존 데이터 backfill (옵션) — created_at으로 임시 마킹
-- ⚠️ 실제 등록 시점이 아니므로 통계상 부정확. 새 데이터만 정확히 추적하려면 이 UPDATE 부분은 생략 가능.
UPDATE hakjeom_consultations
  SET registered_at = created_at
  WHERE status IN ('등록완료', '지인등록')
    AND registered_at IS NULL;

UPDATE private_cert_consultations
  SET registered_at = created_at
  WHERE status IN ('등록완료', '지인등록')
    AND registered_at IS NULL;
