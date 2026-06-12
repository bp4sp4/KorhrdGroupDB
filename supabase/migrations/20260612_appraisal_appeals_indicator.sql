-- 이의제기 항목 연결 — 특정 세부지표에 대한 이의제기 (null = 평가 전체)
-- block_index/indicator_index: 평가서 blocks[bi].indicators[ii] 위치
-- indicator_text: 제출 시점의 지표 문구 스냅샷 (양식 수정에도 표시 보존)
ALTER TABLE appraisal_appeals
  ADD COLUMN IF NOT EXISTS block_index int,
  ADD COLUMN IF NOT EXISTS indicator_index int,
  ADD COLUMN IF NOT EXISTS indicator_text text;
