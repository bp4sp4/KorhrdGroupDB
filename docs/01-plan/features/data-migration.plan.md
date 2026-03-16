# Plan: 데이터 마이그레이션 (기존 DB → 통합 DB)

**작성일:** 2026-03-16
**작성자:** Claude
**상태:** Plan

---

## 1. 배경 및 목적

기존에 서비스별로 분리되어 있던 Supabase 프로젝트 DB를 하나의 통합 DB(`hakjeom-bank-web`)로 마이그레이션한다.
통합 DB 스키마(`001_initial_schema.sql`)는 이미 설계되어 있으며, 기존 데이터를 손실 없이 이전하는 것이 목표이다.

---

## 2. 기존 프로젝트별 DB 현황

### 2-1. korhrdsocial (학점은행제 + 민간자격증)

| 기존 테이블 | 통합 DB 테이블 | 비고 |
|---|---|---|
| `consultations` | `hakjeom_consultations` | **테이블명 변경** |
| `agency_agreements` | `agency_agreements` | 동일 |
| `private_cert_consultations` | `private_cert_consultations` | 동일 |
| `csv_staging` | `csv_staging` | 동일 |
| `channels` | ❌ 없음 | **통합 스키마에 미포함 → 확인 필요** |

### 2-2. creaditbridge (자격증 신청 + 결제)

| 기존 테이블 | 통합 DB 테이블 | 비고 |
|---|---|---|
| `certificate_applications` | `certificate_applications` | 동일 |
| `payment_logs` | `payment_logs` | 동일 |
| `orders` | ❌ 없음 | **통합 스키마에 미포함 → 확인 필요** |
| `payment_cancellations` | ❌ 없음 | **통합 스키마에 미포함 → 확인 필요** |
| `photos` | ❌ 없음 | **통합 스키마에 미포함 → 확인 필요** |

### 2-3. korhrdsocialform (실습/취업)

| 기존 테이블 | 통합 DB 테이블 | 비고 |
|---|---|---|
| `consultations` | `practice_consultations` | **테이블명 변경** |
| `practice_applications` | `practice_applications` | 동일 |
| `employment_applications` | `employment_applications` | 동일 |

---

## 3. 주요 이슈 및 결정 사항

### ⚠️ 이슈 1: 테이블명 변경 (컬럼 호환성 확인 필요)

- `korhrdsocial.consultations` → `hakjeom_consultations`
  → consultations 컬럼 구조가 hakjeom_consultations와 완전히 일치하는지 확인 필요
- `korhrdsocialform.consultations` → `practice_consultations`
  → consultations 컬럼 구조가 practice_consultations와 완전히 일치하는지 확인 필요

### ⚠️ 이슈 2: creaditbridge 미포함 테이블 처리

다음 테이블들이 통합 스키마에 없음:
- `orders` - creaditbridge 자체 결제 주문 테이블
- `payment_cancellations` - 결제 취소 로그
- `photos` - 사진 업로드 관련

**결정 필요:** 통합 스키마에 추가할지 / 별도 관리할지

### ⚠️ 이슈 3: korhrdsocial `channels` 테이블

학점은행제 DB에 `channels` 테이블이 존재하나 통합 스키마에 미포함.
**결정 필요:** 통합 스키마에 추가할지 / 데이터 버릴지

### ⚠️ 이슈 4: ID 충돌 가능성

- `hakjeom_consultations`, `practice_consultations` 등 `bigserial` ID는 새로운 시퀀스로 자동 부여됨
  → 기존 ID 숫자가 바뀔 수 있음 (외부에서 ID를 직접 참조하는 경우 주의)
- `certificate_applications`는 `uuid` → ID 충돌 없음 ✅

### ⚠️ 이슈 5: 마이그레이션 순서 (FK 의존성)

`payment_logs`는 `certificate_applications.id`를 FK로 참조 → 반드시 certificate_applications 먼저 이전

---

## 4. 마이그레이션 순서 (안전한 순서)

```
1. app_users (로그인 계정) - 수동 생성 권장
2. agency_agreements
3. hakjeom_consultations (← consultations from korhrdsocial)
4. private_cert_consultations
5. csv_staging
6. credit_bank_contacts (신규 데이터 있으면)
7. certificate_applications (← creaditbridge)
8. payment_logs (← creaditbridge, certificate_applications 이후)
9. practice_consultations (← consultations from korhrdsocialform)
10. practice_applications
11. employment_applications
```

---

## 5. 마이그레이션 방법 (선택)

### 옵션 A: Supabase SQL 직접 실행 (권장)
- 기존 Supabase → `pg_dump` → 통합 Supabase에 import
- 빠르고 정확하지만 Service Role Key 및 DB 접근 필요

### 옵션 B: SQL INSERT 스크립트 생성
- 기존 DB에서 SELECT로 데이터 추출 → INSERT 스크립트 생성
- 테이블명 변경, 컬럼 매핑 처리 포함

### 옵션 C: Node.js 마이그레이션 스크립트
- 두 Supabase 클라이언트를 동시에 연결해 read → write
- 대용량 데이터 배치 처리 가능

---

## 6. 다음 단계

1. 사용자 확인: 미포함 테이블 처리 방법 결정 (channels, orders, payment_cancellations, photos)
2. 컬럼 구조 비교 (Design 단계)
3. 마이그레이션 스크립트 작성 (Do 단계)
4. 테스트 마이그레이션 후 검증

---

## 7. 참고 파일

- 통합 스키마: `supabase/migrations/001_initial_schema.sql`
- 기존 학점은행제: `/Users/korhrd/Documents/GitHub/korhrdsocial`
- 기존 자격증신청: `/Users/korhrd/Documents/GitHub/creaditbridge`
- 기존 실습/취업: `/Users/korhrd/Documents/GitHub/korhrdsocialform`
