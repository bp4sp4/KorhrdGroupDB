-- 교육원 프리셋 과목 구분 컬럼 추가
ALTER TABLE edu_subjects ADD COLUMN IF NOT EXISTS is_from_preset boolean NOT NULL DEFAULT false;

-- 교육원 프리셋 표시 (student_id IS NULL = 공통 프리셋)
UPDATE edu_subjects SET is_from_preset = true WHERE student_id IS NULL;

-- 학생별 전공선택(subject_type='선택') → 교양으로 이동
UPDATE edu_subjects
SET category = '교양', subject_type = null
WHERE student_id IS NOT NULL AND subject_type = '선택';
