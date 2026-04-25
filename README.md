# 한평생오피스

> 사내 업무 통합 관리 시스템

한국HRD그룹의 교육 운영, 경영 관리, 전자결재 등 사내 업무 전반을 통합 관리하는 웹 애플리케이션입니다.

## 기술 스택

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Database**: Supabase
- **Styling**: CSS Modules, Tailwind CSS
- **Charts**: Recharts, Ant Design Charts
- **Deployment**: Vercel

## 주요 기능

### 교육 운영

| 기능 | 설명 |
|------|------|
| **학점은행제 사업부** | 문의DB, 등록학생, 기관협약, 일괄등록, 연락예정, 통계 |
| **민간자격증 사업부** | 학점연계 신청, 교육원, 민간자격증, 학생관리, 일괄등록, 통계 |
| **유학 사업부** | 회원 목록, 간편상담, 신청서 목록, 결제 목록 |
| **실습/취업** | 상담신청, 실습섭외신청, 취업신청 |
| **올케어 관리자** | 회원 목록, 결제 내역, 통계 |

### 경영 관리

| 기능 | 설명 |
|------|------|
| **팀별 매출 관리** | 통합 통계, 학점은행제/민간자격증/유학 매출 |
| **매출 데이터 관리** | 매출 데이터 업로드 및 관리 |
| **계좌조회** | 법인 계좌 조회 |
| **전자결재** | 휴가, 출장, 지출, 사직서 등 결재 양식 |
| **손익 리포트** | 경영 대시보드 및 리포트 |

### 시스템

| 기능 | 설명 |
|------|------|
| **중복 조회** | 학생/회원 중복 데이터 검색 |
| **배정 현황** | 담당자 배정 현황 |
| **로그 관리** | 시스템 활동 로그 |
| **어드민 관리** | 계정, 부서, 직급, 권한 설정 |
| **링크모음** | 사내 주요 링크 관리 |

## 시작하기

### 환경 변수 설정

프로젝트 루트에 `.env` 파일을 생성하고 다음 변수를 설정합니다.

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_SITE_URL=your_site_url
```

### 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build

# 프로덕션 서버 실행
npm start
```

개발 서버 실행 후 [http://localhost:3000](http://localhost:3000)에서 확인할 수 있습니다.

## 프로젝트 구조

```
src/
├── app/
│   ├── (auth)/          # 로그인
│   ├── (dashboard)/     # 대시보드 페이지
│   │   ├── hakjeom/     # 학점은행제
│   │   ├── cert/        # 민간자격증
│   │   ├── abroad/      # 유학
│   │   ├── practice/    # 실습/취업
│   │   ├── allcare/     # 올케어
│   │   ├── approvals/   # 전자결재
│   │   ├── revenues/    # 매출 관리
│   │   ├── reports/     # 손익 리포트
│   │   ├── admin/       # 시스템 설정
│   │   └── ...
│   └── api/             # API 라우트
├── components/
│   ├── layout/          # Sidebar, Header 등
│   └── ui/              # 공통 UI 컴포넌트
└── lib/                 # Supabase 클라이언트 등 유틸리티
```
