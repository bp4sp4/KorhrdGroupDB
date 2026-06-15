-- 보육교사 / 평생교육사 / 한국어교원 → '타과정' 하나로 병합
UPDATE practice_applicants SET category = '타과정'
  WHERE category IN ('보육교사', '평생교육사', '한국어교원', '보육교사/평생교육사/한국어교원');

ALTER TABLE practice_applicants ALTER COLUMN category SET DEFAULT '타과정';
