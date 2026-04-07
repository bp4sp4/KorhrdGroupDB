-- notifications.user_id를 auth.users UUID → app_users.id bigint로 변경
-- 기존 UUID FK는 app_users 테이블과 직접 연결이 없어 알림이 조회되지 않는 버그 수정

ALTER TABLE public.notifications
  DROP COLUMN IF EXISTS user_id;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS user_id bigint REFERENCES public.app_users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON public.notifications(user_id);
