# CSV Import 가이드

Supabase → Table Editor → 테이블 선택 → Import data from CSV

## 학점은행제

### hakjeom_consultations
| CSV 컬럼 | DB 컬럼 | 필수 |
|---|---|---|
| 이름 | name | ✅ |
| 연락처 | contact | ✅ |
| 학력 | education | |
| 상담사유 | reason | |
| 유입경로 | click_source | |
| 메모 | memo | |
| 상태 | status | (기본값: 상담대기) |
| 과목비용 | subject_cost | |
| 담당자 | manager | |
| 거주지역 | residence | |
| 희망과정 | hope_course | |
| 상담여부 | counsel_check | |

### agency_agreements
| CSV 컬럼 | DB 컬럼 | 필수 |
|---|---|---|
| 분류 | category | |
| 지역 | region | |
| 기관명 | institution_name | |
| 연락처 | contact | |
| 학점수수료 | credit_commission | |
| 민간수수료 | private_commission | |
| 담당자 | manager | |
| 메모 | memo | |
| 상태 | status | (기본값: 협약대기) |

### private_cert_consultations
| CSV 컬럼 | DB 컬럼 | 필수 |
|---|---|---|
| 이름 | name | ✅ |
| 연락처 | contact | ✅ |
| 학력 | education | |
| 희망과정 | hope_course | |
| 상담사유 | reason | |
| 유입경로 | click_source | |
| 메모 | memo | |
| 상담여부 | counsel_check | |
| 상태 | status | (기본값: 상담대기) |
| 과목비용 | subject_cost | |
| 담당자 | manager | |
| 거주지역 | residence | |
| 대분류 | major_category | |
| 맘카페활동 | mamcafe_activity | |

---

## 자격증 신청

### certificate_applications
| CSV 컬럼 | DB 컬럼 | 필수 |
|---|---|---|
| 이름 | name | ✅ |
| 연락처 | contact | ✅ |
| 주민앞자리 | birth_prefix | ✅ |
| 주소 | address | ✅ |
| 자격증목록 | certificates | ✅ (배열: {자격증1,자격증2}) |
| 현금영수증 | cash_receipt | |
| 사진URL | photo_url | |
| 주문번호 | order_id | |
| 결제금액 | amount | |
| 결제상태 | payment_status | (기본값: pending) |
| 결제방법 | pay_method | |
| 상세주소 | address_detail | |
| 확인여부 | is_checked | |
| 출처 | source | (기본값: bridge) |

---

## 실습/취업

### practice_consultations
| CSV 컬럼 | DB 컬럼 | 필수 |
|---|---|---|
| 이름 | name | ✅ |
| 연락처 | contact | ✅ |
| 유형 | type | (기본값: consultation) |
| 진행현황 | progress | |
| 취업상담여부 | employment_consulting | (true/false) |
| 취업연결여부 | employment_connection | (true/false) |
| 학생상태 | student_status | (기본값: 상담대기) |
| 실습처 | practice_place | |
| 자격증후취업 | employment_after_cert | |
| 학력 | education | |
| 희망과정 | hope_course | |
| 상담사유 | reason | |
| 유입경로 | click_source | |
| 메모 | memo | |
| 상태 | status | (기본값: 상담대기) |
| 담당자 | manager | |
| 거주지역 | residence | |
| 학습방법 | study_method | |
| 실습서비스 | service_practice | (true/false) |
| 취업서비스 | service_employment | (true/false) |
| 실습예정일 | practice_planned_date | (YYYYMM) |
| 취업희망시기 | employment_hope_time | |
| 고용지원금 | employment_support_fund | (true/false) |

### employment_applications
| CSV 컬럼 | DB 컬럼 | 필수 |
|---|---|---|
| 이름 | name | ✅ |
| 성별 | gender | ✅ (남/여) |
| 연락처 | contact | ✅ |
| 생년월일 | birth_date | ✅ |
| 주소 | address | ✅ |
| 희망직종 | desired_job_field | ✅ |
| 고용형태 | employment_types | ✅ (배열) |
| 이력서보유 | has_resume | ✅ (true/false) |
| 자격증 | certifications | |
| 결제금액 | payment_amount | (기본값: 110000) |
| 결제상태 | payment_status | (기본값: pending) |
| 유입경로 | click_source | |
| 상태 | status | (기본값: pending) |

### practice_applications
| CSV 컬럼 | DB 컬럼 | 필수 |
|---|---|---|
| 이름 | name | ✅ |
| 성별 | gender | ✅ (남/여) |
| 연락처 | contact | ✅ |
| 생년월일 | birth_date | ✅ |
| 주소 | address | ✅ |
| 실습유형 | practice_type | ✅ |
| 희망직종 | desired_job_field | ✅ |
| 이력서보유 | has_resume | (기본값: false) |
| 자격증 | certifications | |
| 결제금액 | payment_amount | (기본값: 110000) |
| 결제상태 | payment_status | (기본값: pending) |
| 유입경로 | click_source | |
| 상태 | status | (기본값: pending) |
| 메모 | memo | |
| 담당자 | manager | |
