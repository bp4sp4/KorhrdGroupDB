-- ============================================================
-- 올케어 시스템 DB 스키마
-- 대상 Supabase: https://supabase.com/dashboard/project/mipzevxfqacbheqojrwa
-- 실행 방법: SQL Editor에서 전체 붙여넣기 후 실행
-- ============================================================


-- ============================================================
-- 1. allcare_users (회원)
-- ============================================================
CREATE TABLE IF NOT EXISTS allcare_users (
  id            UUID PRIMARY KEY,                          -- 원본 user id (CSV의 id 그대로)
  email         TEXT NOT NULL,
  name          TEXT,
  phone         TEXT,
  avatar_url    TEXT,
  provider      TEXT,                                      -- email | google | kakao | naver
  practice_matching_access BOOLEAN DEFAULT FALSE,          -- 실습매칭 열람권
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_allcare_users_email    ON allcare_users(email);
CREATE INDEX IF NOT EXISTS idx_allcare_users_phone    ON allcare_users(phone);
CREATE INDEX IF NOT EXISTS idx_allcare_users_created  ON allcare_users(created_at DESC);

ALTER TABLE allcare_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allcare_users_service_role" ON allcare_users FOR ALL USING (true);


-- ============================================================
-- 2. allcare_subscriptions (구독)
-- ============================================================
CREATE TABLE IF NOT EXISTS allcare_subscriptions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID REFERENCES allcare_users(id) ON DELETE CASCADE,
  plan                 TEXT,                               -- 플랜명 (예: basic, standard, premium)
  status               TEXT NOT NULL
                         CHECK (status IN ('active', 'cancel_scheduled', 'cancelled', 'expired')),
  amount               INTEGER DEFAULT 0,                  -- 결제 금액 (원)
  billing_cycle        TEXT DEFAULT 'monthly',             -- monthly
  start_date           TIMESTAMPTZ,
  next_billing_date    TIMESTAMPTZ,
  end_date             TIMESTAMPTZ,
  cancelled_at         TIMESTAMPTZ,
  payapp_bill_key      TEXT,                               -- PayApp 정기결제 키 (rebill_no)
  payapp_trade_id      TEXT,                               -- PayApp 거래번호
  payment_type         INTEGER,                            -- 1=신용카드, 6=계좌이체, 15=카카오페이, 16=네이버페이, 25=토스페이
  card_name            TEXT,                               -- 신용카드명
  payment_method_name  TEXT,                               -- 결제수단 표시명 (삼성카드, 카카오페이 등)
  scheduled_plan       TEXT,                               -- 다음 결제 시 변경될 플랜
  scheduled_amount     INTEGER,                            -- 다음 결제 시 변경될 금액
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_allcare_subs_user_id   ON allcare_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_allcare_subs_status    ON allcare_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_allcare_subs_created   ON allcare_subscriptions(created_at DESC);

ALTER TABLE allcare_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allcare_subscriptions_service_role" ON allcare_subscriptions FOR ALL USING (true);


-- ============================================================
-- 3. allcare_payments (결제 이력)
-- ============================================================
CREATE TABLE IF NOT EXISTS allcare_payments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES allcare_users(id) ON DELETE SET NULL,
  order_id         TEXT,                                   -- 주문번호 (PKG-xxx, CUSTOM-xxx 등)
  trade_id         TEXT,                                   -- PayApp 거래번호 (mul_no)
  amount           INTEGER NOT NULL DEFAULT 0,
  good_name        TEXT,                                   -- 상품명
  customer_phone   TEXT,
  status           TEXT NOT NULL,                          -- completed | failed | cancelled | refunded | refund_requested | plan_change
  payment_method   TEXT,                                   -- payapp | internal
  approved_at      TIMESTAMPTZ,
  error_code       TEXT,
  error_message    TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_allcare_payments_user_id    ON allcare_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_allcare_payments_approved   ON allcare_payments(approved_at DESC);
CREATE INDEX IF NOT EXISTS idx_allcare_payments_order_id   ON allcare_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_allcare_payments_status     ON allcare_payments(status);

ALTER TABLE allcare_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allcare_payments_service_role" ON allcare_payments FOR ALL USING (true);


-- ============================================================
-- 4. allcare_custom_payment_requests (단과반 결제 요청)
-- ============================================================
CREATE TABLE IF NOT EXISTS allcare_custom_payment_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES allcare_users(id) ON DELETE CASCADE,
  subject       TEXT NOT NULL,                             -- 과목 이름/내용
  subject_count INTEGER NOT NULL DEFAULT 1,                -- 과목 수
  amount        INTEGER NOT NULL,                          -- 결제 금액 (원)
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'paid', 'cancelled')),
  memo          TEXT,                                      -- 관리자 메모
  order_id      TEXT,                                      -- PayApp 주문번호
  paid_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_allcare_custom_user_id  ON allcare_custom_payment_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_allcare_custom_status   ON allcare_custom_payment_requests(status);

ALTER TABLE allcare_custom_payment_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allcare_custom_service_role" ON allcare_custom_payment_requests FOR ALL USING (true);


-- ============================================================
-- 5. 조회용 VIEW (admin_user_details 대체)
--    회원 + 최신 구독 정보를 한번에 조회
-- ============================================================
CREATE OR REPLACE VIEW allcare_user_details AS
SELECT
  u.id                           AS user_id,
  u.email,
  u.name,
  u.phone,
  u.provider,
  u.practice_matching_access,
  u.created_at                   AS registered_at,
  s.id                           AS subscription_id,
  s.status                       AS subscription_status,
  s.plan,
  s.amount,
  s.billing_cycle,
  s.start_date,
  s.next_billing_date,
  s.end_date,
  s.cancelled_at,
  s.payment_method_name,
  s.scheduled_plan,
  s.scheduled_amount
FROM allcare_users u
LEFT JOIN LATERAL (
  SELECT *
  FROM allcare_subscriptions
  WHERE user_id = u.id
    AND status IN ('active', 'cancel_scheduled')
  ORDER BY created_at DESC
  LIMIT 1
) s ON true;
