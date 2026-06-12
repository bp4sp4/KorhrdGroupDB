-- 민간자격증 매출파일 분류에 '집체교육' 추가
ALTER TABLE cert_sales DROP CONSTRAINT cert_sales_category_check;
ALTER TABLE cert_sales ADD CONSTRAINT cert_sales_category_check
  CHECK (category IN ('학점연계', '후납', '집체교육'));
