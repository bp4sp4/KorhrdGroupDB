# 한평생그룹 업무플랫폼 — 경영관리 시스템 기획서

> **목적**: 전자결재 + 사업부별 매출/지출 집계 + 간이 손익계산 기능을 사내 업무플랫폼에 내재화
> **기술 스택**: Next.js (App Router) + Supabase (Auth, DB, Storage, Realtime)
> **사용자 규모**: 10~30명
> **디자인 기조**: 토스 스타일 — 깔끔하고 직관적인 사용자 중심 UI
> **결재 작성 UI**: 기존 스타일 유지 (사진 첨부 포함, 리디자인 제외)

---

## 0. 조직 구조 및 권한 체계

### 0-1. 사업부 목록 (관리자가 추가/수정/삭제 가능)
| 코드 | 사업부명 |
|------|----------|
| MGT | 경영지원본부 |
| DEV | 개발본부 |
| BIZ | 사업본부 |

### 0-2. 직급 체계
사원 → 주임 → 대리 → 과장 → 팀장 → 본부장 → 임원 → 대표이사
*(관리자 설정 화면에서 직급 추가/수정 가능하도록 구현)*

### 0-3. 권한 등급
| 등급 | 접근 범위 | 대상 직급 (기본값) |
|------|-----------|-------------------|
| STAFF | 본인 작성 결재·매출만 조회 | 사원, 대리, 과장 |
| MANAGER | 소속 사업부 전체 조회 + 손익 대시보드 | 팀장, 본부장 |
| EXECUTIVE | 전체 사업부 조회 + 전체 손익 대시보드 | 임원, 대표이사 |
| ADMIN | 시스템 설정 + 사업부/직급/결재선 관리 | 지정된 관리자 |

> **구현 시 주의**: 권한은 역할(role) 기반으로 Supabase RLS 정책과 연동. 직급-권한 매핑은 관리자 설정에서 변경 가능하도록.

---

## 1. 사업부별 매출 집계 시스템

### 1-1. 목표
각 사업부의 실매출을 시스템 내에서 수집/정리하여 수기 입력 없이 확인 가능하게 한다.

### 1-2. 매출 데이터 입력 방식 (우선순위)
1. **수동 입력** (1차 필수): 폼 기반 매출 직접 등록
2. **엑셀/CSV 업로드** (1차 필수): 대량 데이터 일괄 등록, 컬럼 자동 매핑
3. **API 연동** (확장 - 구조만 준비): PG사/VAN사/오픈뱅킹 연동을 위한 인터페이스 레이어만 설계. 실제 연동은 추후.

### 1-3. 매출 데이터 필수 항목 (DB 스키마)
```
revenues 테이블
├── id: uuid (PK)
├── revenue_date: date (발생일) — NOT NULL
├── department_id: uuid (FK → departments) — NOT NULL
├── revenue_type: enum ('CARD', 'BANK_TRANSFER', 'OTHER') — 매출 구분
├── customer_name: text (고객명/거래처명) — NOT NULL
├── amount: bigint (금액, 원 단위) — NOT NULL
├── product_name: text (상품/과정명)
├── manager_id: uuid (FK → profiles, 담당자) — NOT NULL
├── memo: text (메모)
├── source: enum ('MANUAL', 'EXCEL_UPLOAD', 'API') — 입력 출처
├── upload_batch_id: uuid (일괄 업로드 시 배치 ID)
├── created_at: timestamptz
├── created_by: uuid (FK → profiles)
├── updated_at: timestamptz
├── updated_by: uuid (FK → profiles)
└── is_deleted: boolean (소프트 삭제)
```

### 1-4. 중복 방지 로직
- **복합 유니크 제약**: (revenue_date + department_id + customer_name + amount + product_name) 조합으로 중복 체크
- **엑셀 업로드 시**: 업로드 전 미리보기에서 기존 데이터와 중복 건 표시 → 사용자가 선택적으로 제외 가능
- **수동 입력 시**: 동일 조건 데이터 존재 시 경고 팝업 (강제 등록은 허용)

### 1-5. 조회 기능
- 사업부별 분리 조회 (필터)
- 기간 필터: 일별 / 주별 / 월별 / 사용자 정의 기간
- 담당자별 필터
- 매출 구분별 필터
- 키워드 검색 (고객명, 상품명)
- **엑셀 다운로드** 기능 필수

### 1-6. 엑셀 업로드 상세 플로우
1. 엑셀 파일 선택 및 업로드
2. 시스템이 컬럼 자동 매핑 시도 → 사용자 수동 매핑 수정 가능
3. 데이터 미리보기 (유효성 검사 결과 + 중복 체크 결과 표시)
4. 오류 행 표시 (필수값 누락, 형식 오류 등)
5. 확인 후 일괄 등록
6. 등록 결과 요약 (성공 N건, 실패 N건, 중복 제외 N건)

---

## 2. 전자결재 시스템

### 2-1. 목표
다우오피스에서 처리하던 결재 흐름을 내부 플랫폼으로 이전. 지출 결재뿐 아니라 출장/인사/회계 관련 결재를 모두 포함.

### 2-2. 결재 문서 유형 및 결재선 템플릿

#### 카테고리: 출장
| 문서 유형 | 결재선 (기본) |
|-----------|--------------|
| 출장신청서 | 사원(신청자) → 경영지원본부장 → 대표이사 |
| 출장 업무 보고서 | 사원(신청자) → 경영지원본부장 → 대표이사 |

#### 카테고리: 인사 (3단계)
| 문서 유형 | 결재선 (기본) |
|-----------|--------------|
| 퇴사확정일 요청서 | 사원(신청자) → 경영지원본부장 → 대표이사 |
| 인수인계요청서 | 사원(신청자) → 경영지원본부장 → 대표이사 |
| 근태사유서 | 사원(신청자) → 경영지원본부장 → 대표이사 |

#### 카테고리: 인사 (2단계)
| 문서 유형 | 결재선 (기본) |
|-----------|--------------|
| 사원증 신청서 | 사원(신청자) → 경영지원본부장 |
| 휴가신청서 | 사원(신청자) → 경영지원본부장 |
| 명함 신청서 | 사원(신청자) → 경영지원본부장 |

#### 카테고리: 회계
| 문서 유형 | 결재선 (기본) |
|-----------|--------------|
| [적립금] 지출결의서 | 사원(신청자) → 경영지원본부장 → 대표이사 |
| [제휴] 입금요청서 | 사원(신청자) → 경영지원본부장 → 대표이사 |
| [제휴] 환불요청서 | 사원(신청자) → 경영지원본부장 → 대표이사 |
| [운영비] 입금요청서 | 사원(신청자) → 경영지원본부장 → 대표이사 |
| 법인카드 사용내역 제출서 | 사원(신청자) → 경영지원본부장 → 대표이사 |

### 2-3. 결재선 관리 (관리자 기능)
- **결재선 템플릿 CRUD**: 문서 유형별 기본 결재선을 관리자가 설정/수정
- **결재선 구성 요소**: 각 단계별 (결재자 지정 방식: 특정인 지정 / 직급 지정 / 부서장 자동)
- **결재 유형**: 순차 결재 (현재는 순차만, 추후 병렬 합의 확장 가능하도록 구조 설계)
- **문서 유형 추가/삭제**: 관리자가 새로운 결재 문서 유형을 만들 수 있어야 함
- **전결 규정 확장 준비**: 금액 기준 또는 직급 기준 전결 규정을 나중에 추가할 수 있는 테이블 구조

### 2-4. 결재 상태값
```
DRAFT (임시저장) → SUBMITTED (상신) → IN_PROGRESS (결재 진행 중)
  → APPROVED (승인 완료)
  → REJECTED (반려) → RESUBMITTED (재상신) → ...
  → CANCELLED (취소 - 상신자가 결재 진행 전 취소)
```

### 2-5. 결재 DB 스키마
```
-- 결재선 템플릿
approval_templates 테이블
├── id: uuid (PK)
├── document_type: text (문서 유형명) — NOT NULL, UNIQUE
├── category: text (카테고리: 출장/인사/회계 등)
├── steps: jsonb (결재 단계 배열)
│   예: [
│     { "step": 1, "type": "APPLICANT", "label": "신청자" },
│     { "step": 2, "type": "SPECIFIC_PERSON", "user_id": "xxx", "label": "경영지원본부장" },
│     { "step": 3, "type": "SPECIFIC_PERSON", "user_id": "yyy", "label": "대표이사" }
│   ]
├── is_active: boolean
├── created_at: timestamptz
└── updated_at: timestamptz

-- 결재 문서
approvals 테이블
├── id: uuid (PK)
├── document_number: text (문서번호, 자동 채번) — UNIQUE
├── template_id: uuid (FK → approval_templates)
├── document_type: text (문서 유형)
├── category: text (카테고리)
├── status: enum ('DRAFT','SUBMITTED','IN_PROGRESS','APPROVED','REJECTED','RESUBMITTED','CANCELLED')
├── applicant_id: uuid (FK → profiles, 신청자)
├── department_id: uuid (FK → departments, 사업부)
├── title: text (제목)
├── content: jsonb (문서 본문 — 유형별로 구조가 다름)
├── current_step: int (현재 결재 단계)
├── submitted_at: timestamptz
├── completed_at: timestamptz
├── created_at: timestamptz
└── updated_at: timestamptz

-- 결재 이력 (각 단계별)
approval_steps 테이블
├── id: uuid (PK)
├── approval_id: uuid (FK → approvals)
├── step_number: int (결재 단계 번호)
├── approver_id: uuid (FK → profiles, 결재자)
├── status: enum ('PENDING','APPROVED','REJECTED')
├── comment: text (결재 의견)
├── acted_at: timestamptz (처리 시각)
└── created_at: timestamptz

-- 첨부파일
approval_attachments 테이블
├── id: uuid (PK)
├── approval_id: uuid (FK → approvals)
├── file_name: text
├── file_path: text (Supabase Storage 경로)
├── file_size: bigint
├── file_type: text (MIME type)
├── created_at: timestamptz
└── created_by: uuid
```

### 2-6. 지출 결재 작성 시 필수 입력 항목
지출 관련 결재 문서(지출결의서, 법인카드 사용내역 등)의 `content` jsonb 구조:
```json
{
  "expense_date": "2025-01-15",
  "applicant_name": "홍길동",
  "department_id": "uuid",
  "expense_category": "광고비",
  "expense_detail": "네이버 검색광고 1월분",
  "amount": 1500000,
  "payment_method": "CORPORATE_CARD",
  "vendor": "네이버(주)",
  "memo": "1월 학점은행제 키워드 광고"
}
```

### 2-7. 지출 분류 (관리자가 추가/수정 가능)
```
expense_categories 테이블
├── id: uuid (PK)
├── name: text — NOT NULL, UNIQUE
├── description: text
├── is_active: boolean
└── sort_order: int

기본값:
- 광고비
- 인건비
- 외주비
- 시스템/솔루션비
- 교육운영비
- 수수료
- 임차료/관리비
- 기타
```

### 2-8. 결제 수단
`CORPORATE_CARD` (법인카드) | `BANK_TRANSFER` (계좌이체) | `CASH` (현금) | `OTHER` (기타)

### 2-9. 첨부파일 규격
- 허용 형식: PDF, JPG, JPEG, PNG, HEIC, GIF
- 최대 용량: 파일당 10MB
- 최대 개수: 건당 10개
- 미리보기: 이미지는 썸네일 미리보기, PDF는 1페이지 미리보기
- 저장: Supabase Storage `approvals/{approval_id}/` 경로

### 2-10. 결재 완료 시 자동 처리
- **지출 결재가 최종 승인되면**: `expenses` 테이블에 자동 INSERT (손익계산에 반영)
- **반려 시**: 반려 사유 필수 입력, 신청자에게 알림 발송, 수정 후 재상신 가능

### 2-11. 결재 완료 후 자동 반영되는 지출 테이블
```
expenses 테이블
├── id: uuid (PK)
├── approval_id: uuid (FK → approvals) — 결재 문서와 연결
├── expense_date: date — NOT NULL
├── department_id: uuid (FK → departments) — NOT NULL
├── category_id: uuid (FK → expense_categories)
├── detail: text
├── amount: bigint — NOT NULL
├── payment_method: enum
├── vendor: text
├── memo: text
├── created_at: timestamptz
└── is_deleted: boolean
```

---

## 3. 사업부별 실시간 간이 손익계산서 대시보드

### 3-1. 목표
매출/지출 데이터가 누적되면 사업부별 간이 손익 현황이 자동으로 표시되도록 한다.

### 3-2. 대시보드 상단 요약 카드 (전체 + 사업부별)
| 카드 | 계산 방식 |
|------|-----------|
| 오늘 매출 | SUM(revenues.amount) WHERE revenue_date = TODAY |
| 이번달 누적 매출 | SUM(revenues.amount) WHERE 이번달 |
| 이번달 누적 지출 | SUM(expenses.amount) WHERE 이번달 |
| 현재 추정 수익 | 이번달 누적 매출 - 이번달 누적 지출 |
| 이익률 | (추정 수익 / 누적 매출) × 100 |
| 전월 대비 증감 | (이번달 매출 - 전월 매출) / 전월 매출 × 100 |

### 3-3. 간이 손익계산서 항목 (사업부별)
```
[총매출]
  카드 매출
  계좌 매출
  기타 매출

[총지출]
  광고비
  인건비
  외주비
  시스템/솔루션비
  교육운영비
  수수료
  임차료/관리비
  기타

[매출총이익] = 총매출 - 총지출
[이익률] = 매출총이익 / 총매출 × 100
[전월 대비 증감률]
```

### 3-4. 차트 및 시각화
- **매출/지출 추이**: 일별 / 주별 / 월별 라인 차트 (recharts 사용)
- **사업부별 비교**: 바 차트 (사업부 간 매출/지출/수익 비교)
- **비용 비중**: 도넛 차트 (광고비, 인건비, 운영비 등 비율)
- **기간 선택**: 날짜 범위 피커 (기본값: 이번달)

### 3-5. 대시보드 접근 권한
| 권한 등급 | 볼 수 있는 범위 |
|-----------|----------------|
| STAFF | 대시보드 접근 불가 (또는 본인 매출 실적만) |
| MANAGER | 소속 사업부 손익만 |
| EXECUTIVE | 전체 사업부 손익 + 사업부 간 비교 |
| ADMIN | 전체 + 시스템 설정 |

### 3-6. 엑셀 내보내기
- 손익계산서를 엑셀로 다운로드 가능
- 기간, 사업부 선택 후 다운로드
- 형식: 표준 손익계산서 양식

---

## 4. 알림 시스템

### 4-1. 인앱 알림 (1차 필수)
```
notifications 테이블
├── id: uuid (PK)
├── user_id: uuid (FK → profiles, 수신자)
├── type: enum ('APPROVAL_SUBMITTED','APPROVAL_APPROVED','APPROVAL_REJECTED','SYSTEM')
├── title: text
├── message: text
├── link: text (클릭 시 이동할 경로)
├── is_read: boolean (default: false)
├── created_at: timestamptz
└── read_at: timestamptz
```

### 4-2. 알림 발생 시점
| 이벤트 | 수신자 | 메시지 예시 |
|--------|--------|------------|
| 결재 상신 | 다음 단계 결재자 | "[홍길동]님이 [출장신청서]를 상신했습니다" |
| 결재 승인 (중간) | 다음 단계 결재자 + 신청자 | "[김팀장]님이 승인했습니다. 다음 결재자: [대표이사]" |
| 최종 승인 | 신청자 | "[출장신청서]가 최종 승인되었습니다" |
| 결재 반려 | 신청자 | "[출장신청서]가 반려되었습니다. 사유: ..." |

### 4-3. 이메일 알림 (1차 포함)
- 결재 상신/승인/반려 시 수신자에게 이메일 발송
- Supabase Edge Function + Resend 또는 유사 이메일 서비스 사용
- 이메일에 바로가기 링크 포함

### 4-4. Supabase Realtime 활용
- 결재 상태 변경 시 실시간 UI 업데이트 (Realtime subscription)
- 알림 뱃지 실시간 반영

---

## 5. 감사 로그 (Audit Trail)

### 5-1. 필요성
경영 관련 데이터의 무결성을 위해 모든 주요 액션을 기록.

### 5-2. 감사 로그 테이블
```
audit_logs 테이블
├── id: uuid (PK)
├── user_id: uuid (FK → profiles, 행위자)
├── action: enum ('CREATE','UPDATE','DELETE','APPROVE','REJECT','LOGIN','EXPORT')
├── target_type: text (대상 테이블: 'revenues', 'expenses', 'approvals' 등)
├── target_id: uuid (대상 레코드 ID)
├── changes: jsonb (변경 전/후 데이터)
│   예: { "before": { "amount": 100000 }, "after": { "amount": 150000 } }
├── ip_address: text
├── created_at: timestamptz
```

### 5-3. 기록 대상
- 매출 데이터 생성/수정/삭제
- 결재 상신/승인/반려/취소
- 지출 데이터 수정
- 권한 변경
- 엑셀 다운로드 (누가 언제 어떤 데이터를 내보냈는지)

---

## 6. 관리자 설정 화면

### 6-1. 필요한 설정 메뉴
- **사업부 관리**: 추가/수정/삭제/정렬
- **직급 관리**: 추가/수정/삭제/정렬
- **사용자 관리**: 사용자 등록, 사업부/직급 배정, 권한 등급 설정, 비활성화
- **결재선 템플릿 관리**: 문서 유형별 결재선 설정/수정
- **지출 분류 관리**: 카테고리 추가/수정/삭제
- **시스템 설정**: 문서번호 채번 규칙, 첨부파일 용량 제한 등

---

## 7. 주요 화면 목록

### 7-1. 전체 화면 리스트
```
/ (대시보드 — 권한에 따라 다른 뷰)

/revenues (매출 관리)
  /revenues/list (매출 목록 조회)
  /revenues/new (매출 수동 등록)
  /revenues/upload (엑셀 업로드)
  /revenues/[id] (매출 상세)

/approvals (전자결재)
  /approvals/list (결재 목록 — 탭: 내가 작성/내가 결재할/완료)
  /approvals/new (결재 작성 — 문서 유형 선택 후 폼)
  /approvals/[id] (결재 상세 — 결재선 진행 현황 + 승인/반려 버튼)

/expenses (지출 관리)
  /expenses/list (지출 목록 조회)
  /expenses/[id] (지출 상세)

/reports (손익 리포트)
  /reports/dashboard (간이 손익 대시보드)
  /reports/pnl (사업부별 손익계산서)

/admin (관리자 설정)
  /admin/departments (사업부 관리)
  /admin/positions (직급 관리)
  /admin/users (사용자 관리)
  /admin/approval-templates (결재선 템플릿 관리)
  /admin/expense-categories (지출 분류 관리)

/notifications (알림 목록)
```

### 7-2. UI/UX 디자인 원칙
- **토스 스타일**: 큰 텍스트, 넉넉한 여백, 카드 기반 레이아웃, 부드러운 애니메이션
- **색상**: 메인 블루 계열 + 그레이 톤, 수익은 파랑, 손실은 빨강
- **모바일 대응**: 결재 승인/반려는 모바일에서도 가능하도록 반응형 필수
- **로딩 상태**: 스켈레톤 UI 적용
- **에러 처리**: 토스트 메시지 + 인라인 에러 (폼 검증)
- **접근성**: 키보드 네비게이션, 충분한 색상 대비

---

## 8. 기술 구현 가이드

### 8-1. Supabase 설정
- **Auth**: 이메일/비밀번호 기반 로그인 (소셜 로그인 불필요)
- **RLS**: 모든 테이블에 Row Level Security 적용, 권한 등급 기반
- **Storage**: `approvals` 버킷 (결재 첨부파일)
- **Realtime**: `notifications`, `approvals` 테이블 구독
- **Edge Functions**: 이메일 알림 발송, 문서번호 채번

### 8-2. 프론트엔드 라이브러리
- **UI**: shadcn/ui + Tailwind CSS + 웬만해서 module.css로 불가피할때만 Tailwind css 사용 + Bem기법 예) style={styles.table_wrapper} 언더바하나로 통일
- **차트**: recharts
- **날짜**: date-fns
- **폼**: react-hook-form + zod (유효성 검사)
- **상태관리**: zustand 또는 React Query (서버 상태)
- **엑셀**: xlsx (SheetJS) — 업로드 파싱 + 다운로드 생성
- **테이블**: @tanstack/react-table

### 8-3. 문서번호 채번 규칙
```
{카테고리코드}-{연도}{월}-{순번(4자리)}
예: HR-202501-0001, ACC-202501-0015, BT-202501-0003
```
카테고리 코드: 출장(BT), 인사(HR), 회계(ACC)

### 8-4. 확장성을 위한 설계 원칙
- 사업부, 직급, 지출분류는 모두 별도 테이블로 관리 (하드코딩 금지)
- 결재선은 jsonb 기반 템플릿으로 유연하게 구성
- API 연동 레이어는 Strategy Pattern으로 설계 (추후 PG/VAN/오픈뱅킹 어댑터 추가 용이)
- 전결 규정 테이블 구조 미리 설계 (1차에서는 비활성)

---

## 9. 개발 우선순위 (페이즈)

### Phase 1 (MVP — 핵심 기능)
1. 조직/사용자/권한 기본 세팅 (Auth + profiles + RLS)
2. 사업부/직급/지출분류 관리자 설정
3. 매출 수동 입력 + 엑셀 업로드 + 조회
4. 전자결재 (작성 → 상신 → 승인/반려 → 완료)
5. 결재 완료 시 지출 자동 반영
6. 간이 손익 대시보드 (기본)
7. 인앱 알림

### Phase 2 (안정화 + 편의)
1. 이메일 알림
2. 감사 로그
3. 엑셀 다운로드 (매출/지출/손익)
4. 대시보드 차트 고도화
5. 모바일 반응형 최적화

### Phase 3 (확장)
1. API 연동 (매출 자동 수집)
2. 전결 규정
3. 병렬 결재 (합의)
4. 슬랙/카카오톡 알림 연동

---

## 10. 참고 사항

- **기존 시스템 연동**: 다우오피스에서 마이그레이션 시, 기존 결재 데이터 CSV 임포트 기능 고려
- **백업**: Supabase 자동 백업 활용, 추가로 주 1회 수동 백업 권장
- **테스트**: 결재 플로우는 반드시 E2E 테스트 작성 (결재선 순서, 상태 전이, RLS 권한)