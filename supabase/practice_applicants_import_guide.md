# 실습신청자 CSV import 가이드 (practice_applicants)

Supabase Table Editor → `practice_applicants` 테이블 → **Insert → Import data from CSV** 로 업로드합니다.
(CSV 헤더가 한글이면 자동 매칭이 안 되므로, 업로드 화면에서 컬럼을 직접 매핑하거나
 아래 **영문 헤더**로 CSV 1행을 작성하세요.)

## 컬럼 매핑

| CSV 헤더(권장, 영문) | 한글 의미 | 비고 |
|----------------------|-----------|------|
| `seq_no`             | 번호      | 숫자. 없으면 비워두면 화면에서 자동 순번 표시 |
| `name`               | 이름      | **필수** |
| `contact`            | 연락처    | |
| `birth_date`         | 생년월일  | 자유 형식(예: 1990.01.01) |
| `address`            | 주소      | |
| `desired_date`       | 희망날짜  | |
| `practice_type`      | 실습종류  | |
| `desired_weekday`    | 희망요일  | |
| `recognition_period` | 실습 세미나 인정기간 | |
| `training_center`    | 실습교육원 | |
| `field_institution`  | 현장실습기관 | |
| `status`             | 상태      | `입금완료` / `추후진행예정` / `재연계` 중 하나. 비우면 `추후진행예정` |
| `counsel_content`    | 상담내용  | |
| `amount`             | 결제금액  | 숫자만(예: `33000`). 비우면 기본 33000 |
| `manager`            | 담당자    | 선택 |

## 주의

- `id`, `created_at`, `updated_at` 은 **CSV에 넣지 마세요** (자동 생성).
- `amount` 는 콤마 없이 숫자만 (`33,000` ❌ → `33000` ✅).
- `status` 는 정확히 세 값 중 하나여야 화면 칩/필터가 동작합니다.
