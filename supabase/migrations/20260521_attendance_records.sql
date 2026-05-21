-- 출퇴근 관리 테이블
-- 근무: 10:00 ~ 19:00 (점심 13:00 ~ 14:00 1시간 제외)
-- 야근: 19:30부터 인정
-- 인정 출근 시간: clock_in_at < 10:00 인 경우 10:00으로 캡

CREATE TABLE IF NOT EXISTS attendance_records (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  date DATE NOT NULL,                              -- KST 기준 근무일
  clock_in_at TIMESTAMPTZ NOT NULL,                -- 실제 출근 버튼 누른 시각
  clock_out_at TIMESTAMPTZ,                        -- 실제 퇴근 버튼 누른 시각 (null = 아직 미퇴근)
  recognized_clock_in TIMESTAMPTZ NOT NULL,        -- 인정 출근 (10:00 이전이면 10:00으로 캡)
  recognized_clock_out TIMESTAMPTZ,                -- 인정 퇴근 (= clock_out_at)
  work_minutes INT NOT NULL DEFAULT 0,             -- 정규 근무 분 (점심 제외)
  overtime_minutes INT NOT NULL DEFAULT 0,         -- 야근 분 (19:30 이후)
  edited_by_admin BOOLEAN NOT NULL DEFAULT FALSE,
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance_records (user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records (date DESC);

-- updated_at 자동 갱신
CREATE OR REPLACE FUNCTION attendance_records_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS attendance_records_updated_at ON attendance_records;
CREATE TRIGGER attendance_records_updated_at
BEFORE UPDATE ON attendance_records
FOR EACH ROW EXECUTE FUNCTION attendance_records_set_updated_at();
