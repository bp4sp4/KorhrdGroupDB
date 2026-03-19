# 올케어 CSV 내보내기 → 임포트 체크리스트

## 1단계: SQL 스키마 먼저 실행

Supabase SQL Editor: https://supabase.com/dashboard/project/mipzevxfqacbheqojrwa/sql/new

→ `docs/allcare-schema.sql` 전체 붙여넣기 후 실행

생성되는 테이블:
- `allcare_users`
- `allcare_subscriptions`
- `allcare_payments`
- `allcare_custom_payment_requests`
- VIEW `allcare_user_details`

---

## 2단계: 올케어 Supabase에서 CSV 내보내기

대시보드: https://supabase.com/dashboard/project/ujqaqulgmoonhlwiwezm/editor

Table Editor → 각 테이블 → 우상단 "..." → **Export to CSV**

| 순서 | 원본 테이블명 | 임포트할 테이블명 | 주의사항 |
|------|--------------|------------------|----------|
| 1 | `users` | `allcare_users` | `id` 컬럼 그대로 유지 (UUID) |
| 2 | `subscriptions` | `allcare_subscriptions` | `user_id` FK → `allcare_users.id` |
| 3 | `payments` | `allcare_payments` | `user_id` FK → `allcare_users.id` |
| 4 | `custom_payment_requests` | `allcare_custom_payment_requests` | `user_id` FK → `allcare_users.id` |

> ⚠️ **반드시 users → subscriptions → payments → custom_payment_requests 순서로 임포트**
> (FK 제약 때문에 users가 먼저 있어야 함)

---

## 3단계: CSV 임포트

Supabase Table Editor → 해당 테이블 클릭 → **Import data from CSV**

또는 SQL Editor에서:
```sql
COPY allcare_users FROM '/path/to/users.csv' CSV HEADER;
```

---

## 컬럼 매핑 (원본 → 신규)

### users → allcare_users
| 원본 컬럼 | allcare_users 컬럼 |
|-----------|-------------------|
| id | id |
| email | email |
| name | name |
| phone | phone |
| provider | provider |
| practice_matching_access | practice_matching_access |
| created_at | created_at |

### subscriptions → allcare_subscriptions
| 원본 컬럼 | allcare_subscriptions 컬럼 |
|-----------|---------------------------|
| id | id |
| user_id | user_id |
| plan | plan |
| status | status |
| amount | amount |
| billing_cycle | billing_cycle |
| start_date | start_date |
| next_billing_date | next_billing_date |
| end_date | end_date |
| cancelled_at | cancelled_at |
| payapp_bill_key | payapp_bill_key |
| payapp_trade_id | payapp_trade_id |
| payment_type | payment_type |
| card_name | card_name |
| payment_method_name | payment_method_name |
| scheduled_plan | scheduled_plan |
| scheduled_amount | scheduled_amount |
| created_at | created_at |

### payments → allcare_payments
| 원본 컬럼 | allcare_payments 컬럼 |
|-----------|----------------------|
| id | id |
| user_id | user_id |
| order_id | order_id |
| trade_id | trade_id |
| amount | amount |
| good_name | good_name |
| customer_phone | customer_phone |
| status | status |
| payment_method | payment_method |
| approved_at | approved_at |
| error_code | error_code |
| error_message | error_message |
| created_at | created_at |

### custom_payment_requests → allcare_custom_payment_requests
| 원본 컬럼 | allcare_custom_payment_requests 컬럼 |
|-----------|-------------------------------------|
| id | id |
| user_id | user_id |
| subject | subject |
| subject_count | subject_count |
| amount | amount |
| status | status |
| memo | memo |
| order_id | order_id |
| paid_at | paid_at |
| created_at | created_at |
