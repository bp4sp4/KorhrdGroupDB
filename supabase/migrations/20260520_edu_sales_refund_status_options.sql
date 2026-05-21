-- 매출파일 환불 상태 옵션 확장
-- 기존: 정상 | 환불대기 | 환불완료
-- 신규: 정상 | 당월 환불 | 환불 | 정산 | 보류
-- 기존 데이터 마이그레이션: 환불대기 → 당월 환불, 환불완료 → 환불

-- 1) 기존 데이터 값 변환 (제약 변경 전에 먼저 변환)
UPDATE edu_sales SET refund_status = '당월 환불' WHERE refund_status = '환불대기';
UPDATE edu_sales SET refund_status = '환불' WHERE refund_status = '환불완료';

-- 2) 기존 check constraint 삭제 + 새 constraint 추가
ALTER TABLE edu_sales DROP CONSTRAINT IF EXISTS edu_sales_refund_status_check;
ALTER TABLE edu_sales
  ADD CONSTRAINT edu_sales_refund_status_check
  CHECK (refund_status IN ('정상', '당월 환불', '환불', '정산', '보류'));
