-- memo_logs.table_name CHECK 제약에 practice_applicants 추가
-- (실습학생 상세화면 메모가 제약 위반으로 저장 실패하던 문제 수정)
ALTER TABLE memo_logs DROP CONSTRAINT IF EXISTS memo_logs_table_name_check;
ALTER TABLE memo_logs ADD CONSTRAINT memo_logs_table_name_check CHECK (
  table_name = ANY (ARRAY[
    'hakjeom_consultations',
    'private_cert_consultations',
    'practice_consultations',
    'practice_applications',
    'practice_applicants',
    'employment_applications',
    'agency_agreements',
    'certificate_applications',
    'cert_students'
  ])
);
