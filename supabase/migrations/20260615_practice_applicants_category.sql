-- 실습신청자 카테고리 구분
--   보육교사/평생교육사/한국어교원 · 사회복지사 · 완료 · 환불
ALTER TABLE practice_applicants
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT '보육교사/평생교육사/한국어교원';

CREATE INDEX IF NOT EXISTS idx_practice_applicants_category
  ON practice_applicants(category);
