export type QuizCategory = 'failure' | 'backup' | 'encryption' | 'extra'

export interface QuizItem {
  id: number
  category: QuizCategory
  question: string
  answer: string
  keywords: string[]
}

export const CATEGORY_LABELS: Record<QuizCategory, string> = {
  failure: '장애처리',
  backup: '백업/복구',
  encryption: '암호화',
  extra: '추가 보안',
}

export const QUIZ_ITEMS: QuizItem[] = [
  {
    id: 1,
    category: 'failure',
    question: '네트워크 장애가 발생하면 어떻게 감지하고 대응하나요?',
    answer:
      'SMS와 모니터링 Tool로 1차 감지하고, 담당자·관리자 실시간 모니터링으로 보완합니다. 감지 후 Ping과 장비 상태 확인 → IDC 전담 엔지니어가 회선/장비/시스템 중 어느 부분 장애인지 판별 → 담당자/담당SE 유선통보 → 1시간 이내 응급조치, 24시간 이내 정상복구가 원칙입니다.',
    keywords: ['SMS', '모니터링', 'IDC', '1시간 응급조치', '24시간 정상복구'],
  },
  {
    id: 2,
    category: 'failure',
    question: '시스템 장애 처리 절차를 설명해주세요.',
    answer:
      'SE가 상태확인 후 (1)네트워크 장애-NMS 확인, (2)Server HW-HDD 등 물리적 확인, (3)DB 장애-DB 섹션 확인, (4)기타(해킹 등)으로 분류합니다. 장애 Part 선별 → 담당자 유선통보 → IDC 엔지니어 원인 파악 및 선조치 → 서비스 상태 확인 → 보고 → 이력관리 순으로 처리합니다.',
    keywords: ['SE 상태확인', 'NMS', '4분류', '담당자 통보', '이력관리'],
  },
  {
    id: 3,
    category: 'failure',
    question: '장애 복구 SLA는 어떻게 되나요?',
    answer: '장애 접수 후 1시간 이내 응급조치, 24시간 이내 정상 복구를 기준으로 운영합니다.',
    keywords: ['1시간', '24시간', 'SLA'],
  },
  {
    id: 4,
    category: 'failure',
    question: '동일 장애 재발 방지는 어떻게 하나요?',
    answer:
      '결과보고 후 장애 이력관리 시스템에 등록하여, 동일 장애 발생 시 신속 처리 및 사전 예방 자료로 활용합니다.',
    keywords: ['이력관리 시스템', '재발 방지'],
  },
  {
    id: 5,
    category: 'backup',
    question: '백업 정책은 어떻게 구성되어 있나요?',
    answer:
      '시스템 백업(OS·Data·응용 프로그램), DBMS 백업(On-line/Off-line/Export-Import), Network 백업(Image Configuration) 3단계로 분리 운영하며, 자동 백업 시스템을 구성하여 장애시간을 최소화합니다.',
    keywords: ['3단계', '시스템/DBMS/Network', '자동 백업'],
  },
  {
    id: 6,
    category: 'backup',
    question: '백업은 얼마나 자주 수행되며, 어디에 보관되나요?',
    answer:
      '일별 자동 백업이 수행되며, 백업본은 별도 저장소에 안전 보관되고 백업 결과는 관리/보고 프로세스로 검증됩니다. (※ 실제 주기/저장소 위치는 운영팀 정책 확인 필요)',
    keywords: ['일별 자동 백업', '별도 저장소', '검증'],
  },
  {
    id: 7,
    category: 'backup',
    question: '어떤 장애 유형이 복구 대상인가요?',
    answer:
      '하드웨어 고장(OS 에러), DBMS 에러, 어플리케이션 에러, 사용자 실수, 천재지변까지 포괄적으로 대응합니다. 복구 수행 후 장애 분석/보고를 통해 시스템/DBMS 정상 운영을 확인합니다.',
    keywords: ['HW/OS/DBMS/앱/사용자실수/천재지변', '복구 후 보고'],
  },
  {
    id: 8,
    category: 'encryption',
    question: '회원 비밀번호는 어떻게 저장되나요?',
    answer:
      'KISA 제공 SHA-256 해시 알고리즘으로 단방향 암호화하여 저장합니다. KISA_SHA256.Encrypt() 함수를 사용하며, SALT 값을 추가해 동일 비밀번호도 다른 해시값이 생성됩니다. 복호화 불가능한 구조로 관리자도 비밀번호를 알 수 없습니다.',
    keywords: ['KISA SHA-256', '단방향', 'SALT', '복호화 불가'],
  },
  {
    id: 9,
    category: 'encryption',
    question: '주민번호는 어떻게 보호되나요?',
    answer:
      'KISA 제공 양방향 암호화 라이브러리(KISAUtil.Encrypt/Decrypt)로 SEED 128bit 암호화하여 저장합니다. 본인확인 등 필요 시에만 복호화하여 사용합니다.',
    keywords: ['KISAUtil', '양방향', 'SEED 128bit'],
  },
  {
    id: 10,
    category: 'encryption',
    question: '전화번호, 주소, 이메일 같은 개인정보 암호화는?',
    answer:
      'MS-SQL 2019의 ENCRYPTBYPASSPHRASE/DECRYPTBYPASSPHRASE 함수를 사용한 대칭키 양방향 암호화로 처리합니다. varbinary 형식으로 저장되며, 동일 Passphrase로만 복호화 가능합니다.',
    keywords: ['MS-SQL 2019', 'ENCRYPTBYPASSPHRASE', '대칭키', 'varbinary'],
  },
  {
    id: 11,
    category: 'encryption',
    question: 'KISA SHA-256을 선택한 이유는?',
    answer:
      '국가 공인기관(한국인터넷진흥원) 제공의 검증된 라이브러리이고, 개인정보보호법·정보통신망법에서 권장하는 안전한 암호 알고리즘이기 때문입니다. C/C++, Java, ASP, JSP, PHP 등 다양한 언어 소스코드 제공으로 호환성도 확보됩니다.',
    keywords: ['KISA 공인', '개인정보보호법', '다국어 지원'],
  },
  {
    id: 12,
    category: 'encryption',
    question: '단방향과 양방향 암호화 적용 기준은?',
    answer:
      '비밀번호처럼 비교만 필요한 정보는 단방향(SHA-256), 본인확인이나 표시가 필요한 주민번호·전화번호·주소·이메일은 양방향(SEED 128bit / MS-SQL 대칭키) 암호화를 적용합니다.',
    keywords: ['비교용 → 단방향', '본인확인/표시 → 양방향'],
  },
  {
    id: 13,
    category: 'encryption',
    question: '암호화 키(Passphrase)는 어떻게 관리되나요?',
    answer:
      'Passphrase는 소스코드에 노출되지 않도록 별도 환경설정 파일/보안 저장소에서 관리하며, 접근 권한이 있는 인원만 조회 가능합니다. 정기적인 키 변경 정책을 운영합니다. (※ 실제 키 관리 정책은 보안팀 확인 필요)',
    keywords: ['소스코드 미노출', '보안 저장소', '정기 키 변경'],
  },
  {
    id: 14,
    category: 'extra',
    question: '개인정보 접근 로그는 기록되나요?',
    answer:
      '개인정보보호법에 따라 개인정보 접근/조회/수정/삭제 이력은 모두 로그 테이블에 기록되며, 일정 기간(최소 1년) 보관됩니다.',
    keywords: ['접근/조회/수정/삭제 로그', '최소 1년 보관'],
  },
  {
    id: 15,
    category: 'extra',
    question: '관리자 권한은 어떻게 분리되어 있나요?',
    answer:
      '관리자 등급별(master-admin / admin / mini-admin)로 권한이 분리되어 있고, 메뉴/기능별 접근 권한과 데이터 범위(전체/소속/본인)를 세분화하여 관리합니다.',
    keywords: ['3단계 권한', '메뉴/기능별', '데이터 범위'],
  },
  {
    id: 16,
    category: 'extra',
    question: '보안 사고 발생 시 신고 체계는?',
    answer:
      '사고 인지 즉시 개인정보보호 책임자에게 보고 → 영향도 평가 → 24시간 이내 KISA·개인정보보호위원회 신고 → 정보주체 통지 → 후속 조치 및 재발방지 대책 수립 단계로 대응합니다.',
    keywords: ['책임자 보고', '24시간 이내 신고', '정보주체 통지'],
  },
  {
    id: 17,
    category: 'extra',
    question: '외부 침입 시도(DDoS, SQL Injection 등) 대응은?',
    answer:
      'WAF(웹방화벽), IPS, DDoS 방어 장비를 통한 1차 차단, 어플리케이션 레벨에서 Prepared Statement·입력값 검증·XSS 필터링으로 2차 방어합니다. 침입 시도는 보안 로그로 기록·모니터링됩니다.',
    keywords: ['WAF/IPS/DDoS 장비', 'Prepared Statement', '입력값 검증', 'XSS 필터'],
  },
]

export interface ReferenceItem {
  title: string
  content: string[]
}

export const REFERENCE_ITEMS: ReferenceItem[] = [
  {
    title: '1. 네트워크 장애 대처방안',
    content: [
      'SMS/모니터링 툴 1차 탐지',
      'IDC 전담 엔지니어가 회선·장비·시스템 영역 판별',
      '담당자 유선 통보',
      '1시간 이내 응급조치 / 24시간 이내 정상 복구',
      '복구 후 결과보고 및 이력관리',
    ],
  },
  {
    title: '2. 시스템 장애 대처방안',
    content: [
      'SE 상태확인 → 네트워크·서버·DB·기타(해킹) 영역 분류',
      '담당자 유선 통보',
      'IDC 엔지니어 원인 파악 및 선조치',
      '1시간 응급조치 / 24시간 정상 복구',
      '서비스 상태 확인 → 결과 보고 → 이력관리',
    ],
  },
  {
    title: '3. 백업/복구 절차',
    content: [
      '시스템 백업: OS · Data · 응용프로그램',
      'DBMS 백업: Online / Offline / Export-Import',
      '네트워크 백업: Image · Configuration',
      '3개 영역 분리 자동화',
      '장애 유형(HW · OS · DBMS · 앱 · 사용자 실수 · 천재지변)별 복구 → 분석/보고 → 정상 운영 확인',
    ],
  },
  {
    title: '4. 암호화 처리방식 (KISA SHA-256)',
    content: [
      '한국인터넷진흥원(KISA) 제공 SHA-256 해시 알고리즘',
      '회원 패스워드: 단방향 / 주민번호: 양방향',
      '단방향: KISA_SHA256.Encrypt(평문암호)',
      '주민번호: KISAUtil.Encrypt() / KISAUtil.Decrypt()',
      'SALT 추가 → 동일 비밀번호도 다른 해시값',
      '제공 언어: C/C++, Java, ASP, JSP, PHP',
    ],
  },
  {
    title: '5. MS-SQL 2019 양방향 암호화',
    content: [
      '적용: 전화번호, 휴대폰번호, 주소, 이메일',
      'ENCRYPTBYPASSPHRASE / DECRYPTBYPASSPHRASE (대칭키)',
      '동일 Passphrase 필수, 반환형식 varbinary',
      '암호화: SELECT ENCRYPTBYPASSPHRASE(대칭키, 평문)',
      '복호화: SELECT DECRYPTBYPASSPHRASE(대칭키, 암호문)',
    ],
  },
]
