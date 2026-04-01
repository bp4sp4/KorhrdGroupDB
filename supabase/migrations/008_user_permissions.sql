-- 사용자별 섹션 접근 권한 테이블
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id bigserial PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  section text NOT NULL CHECK (section IN ('hakjeom', 'cert', 'practice')),
  scope text NOT NULL CHECK (scope IN ('all', 'own')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, section)
);
