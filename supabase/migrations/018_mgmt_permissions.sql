-- user_permissions 섹션 CHECK 제약 조건에 경영관리 섹션 추가
ALTER TABLE public.user_permissions
  DROP CONSTRAINT IF EXISTS user_permissions_section_check;

ALTER TABLE public.user_permissions
  ADD CONSTRAINT user_permissions_section_check
  CHECK (section IN (
    'hakjeom', 'cert', 'practice', 'duplicate', 'trash',
    'logs', 'ref-manage', 'assignment', 'allcare',
    'approvals', 'revenues', 'reports'
  ));
