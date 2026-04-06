-- notifications 테이블에 user_id 컬럼 추가
-- 특정 사용자 대상 알림(user_id 있음) vs 전체 공지(user_id NULL) 구분

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON public.notifications(user_id);
