-- 네이버 웍스 OAuth 2.0 Authorization Code Flow 사용자 토큰 저장
-- Service Account(JWT) 가 아닌 사용자 본인이 동의해서 발급받은 토큰을 저장
-- 토큰 유효: access_token 1시간, refresh_token 90일

CREATE TABLE IF NOT EXISTS naverworks_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  scope TEXT,                                       -- 발급된 scope (예: 'mail mail.read user.read')
  token_type TEXT NOT NULL DEFAULT 'Bearer',
  expires_at TIMESTAMPTZ NOT NULL,                  -- access_token 만료 시각
  refresh_expires_at TIMESTAMPTZ,                   -- refresh_token 만료 (90일 후 추정, optional)
  works_user_email TEXT,                            -- 네이버 웍스에서 인증한 메일 주소 (참고용)
  works_user_id TEXT,                               -- 네이버 웍스의 userId (UUID)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)                                  -- 사용자당 토큰 1개
);

CREATE INDEX IF NOT EXISTS idx_nwtokens_user ON naverworks_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_nwtokens_expires ON naverworks_tokens (expires_at);

-- updated_at 자동 갱신
CREATE OR REPLACE FUNCTION naverworks_tokens_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS naverworks_tokens_updated_at ON naverworks_tokens;
CREATE TRIGGER naverworks_tokens_updated_at
BEFORE UPDATE ON naverworks_tokens
FOR EACH ROW EXECUTE FUNCTION naverworks_tokens_set_updated_at();
