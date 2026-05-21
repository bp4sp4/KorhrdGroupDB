-- DB 기본 timezone을 Asia/Seoul (KST)로 설정
-- TIMESTAMPTZ는 UTC로 내부 저장되지만, Dashboard/raw SQL 조회 시 KST로 표시됨
-- 앱 코드는 ISO 문자열(UTC offset 포함)을 주고받으므로 영향 없음
-- NOW(), CURRENT_DATE, CURRENT_TIMESTAMP 등이 KST 기준으로 동작
ALTER DATABASE postgres SET TIMEZONE TO 'Asia/Seoul';
