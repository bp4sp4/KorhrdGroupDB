-- 보육/평생교육사/한국어교원 통합 카테고리를 3개로 분리 (practice_type 기준)
UPDATE practice_applicants SET category = '보육교사'
  WHERE category = '보육교사/평생교육사/한국어교원' AND practice_type LIKE '%보육%';
UPDATE practice_applicants SET category = '평생교육사'
  WHERE category = '보육교사/평생교육사/한국어교원' AND practice_type LIKE '%평교%';
UPDATE practice_applicants SET category = '한국어교원'
  WHERE category = '보육교사/평생교육사/한국어교원' AND practice_type LIKE '%한국어%';
-- 분류 못한 잔여분은 보육교사로
UPDATE practice_applicants SET category = '보육교사'
  WHERE category = '보육교사/평생교육사/한국어교원';

-- 기본값 변경
ALTER TABLE practice_applicants ALTER COLUMN category SET DEFAULT '보육교사';
