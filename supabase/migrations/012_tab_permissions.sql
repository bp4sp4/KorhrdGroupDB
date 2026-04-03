-- user_permissions 테이블에 탭별 세부 제한 컬럼 추가
ALTER TABLE public.user_permissions
  ADD COLUMN IF NOT EXISTS allowed_tabs jsonb NULL;

-- allcare 섹션 추가를 위해 CHECK constraint 업데이트
ALTER TABLE public.user_permissions
  DROP CONSTRAINT IF EXISTS user_permissions_section_check;

ALTER TABLE public.user_permissions
  ADD CONSTRAINT user_permissions_section_check
  CHECK (section IN (
    'hakjeom', 'cert', 'practice',
    'duplicate', 'trash', 'logs', 'ref-manage', 'assignment',
    'allcare'
  ));
