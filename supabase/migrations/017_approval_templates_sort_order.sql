-- approval_templates 에 sort_order 컬럼 추가 후 순서 지정

ALTER TABLE public.approval_templates
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 999;

-- 기존 회계 항목 순서 업데이트 (스크린샷 기준)
UPDATE public.approval_templates SET sort_order = 1  WHERE document_type = '법인카드 사용내역 제출서' AND category = '회계';
UPDATE public.approval_templates SET sort_order = 2  WHERE document_type = '[결의서] 지출결의서'       AND category = '회계';
UPDATE public.approval_templates SET sort_order = 3  WHERE document_type = '[품의서] 지출품의서'       AND category = '회계';
UPDATE public.approval_templates SET sort_order = 4  WHERE document_type = '[제휴] 입금요청서'         AND category = '회계';
UPDATE public.approval_templates SET sort_order = 5  WHERE document_type = '[적립금] 지출결의서'       AND category = '회계';
UPDATE public.approval_templates SET sort_order = 6  WHERE document_type = '[제휴] 환불요청서'         AND category = '회계';

-- 없는 항목 추가 ([결의서] 지출결의서, [품의서] 지출품의서)
INSERT INTO public.approval_templates (document_type, category, sort_order, steps)
SELECT '[결의서] 지출결의서', '회계', 2, '[{"step":1,"type":"APPLICANT","label":"신청자"},{"step":2,"type":"DEPARTMENT_HEAD","label":"경영지원본부장"},{"step":3,"type":"DEPARTMENT_HEAD","label":"대표이사"}]'
WHERE NOT EXISTS (SELECT 1 FROM public.approval_templates WHERE document_type = '[결의서] 지출결의서' AND category = '회계');

INSERT INTO public.approval_templates (document_type, category, sort_order, steps)
SELECT '[품의서] 지출품의서', '회계', 3, '[{"step":1,"type":"APPLICANT","label":"신청자"},{"step":2,"type":"DEPARTMENT_HEAD","label":"경영지원본부장"},{"step":3,"type":"DEPARTMENT_HEAD","label":"대표이사"}]'
WHERE NOT EXISTS (SELECT 1 FROM public.approval_templates WHERE document_type = '[품의서] 지출품의서' AND category = '회계');
