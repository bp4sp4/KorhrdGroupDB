-- migration 019 revert: notifications.user_id를 다시 uuid (auth.users FK)로 복구
-- 019가 적용된 경우에만 실행 필요

ALTER TABLE public.notifications
  DROP COLUMN IF EXISTS user_id;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON public.notifications(user_id);
