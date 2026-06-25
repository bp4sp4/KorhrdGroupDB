-- 영업 상담 가능/불가 토글 실시간 반영
-- AgentAvailability(문의 DB 상단 "영업 상담 가능 현황")가 app_settings 의
-- presence.consult_available.{uid} 키 변경을 Supabase Realtime(postgres_changes)으로 구독.
-- 기존 30초 폴링 → 실시간 push (user_presence 와 동일 패턴).
--
-- RLS 정책은 변경 없음: app_settings_read_all (SELECT, public, true) 가 이미 존재하므로
-- realtime 으로 추가 노출되는 데이터 없음 (publication 멤버십만 추가).
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings;
