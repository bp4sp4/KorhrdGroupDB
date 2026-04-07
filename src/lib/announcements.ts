export interface Announcement {
  id: number
  date: string
  title: string
  items: string[]
}

const ANNOUNCEMENTS: Announcement[] = [
  {
    id: 5,
    date: '2026-04-07',
    title: '연락 예정 배너 신기능',
    items: [
      '오늘 연락해야 할 상담자가 있으면 페이지 상단에 배너가 자동으로 표시돼요.',
      '배너를 닫으면 당일 하루 동안 다시 표시되지 않아요.',
      '날짜가 지난 연락 예정은 빨간색으로 강조돼요.',
    ],
  },
  {
    id: 4,
    date: '2026-04-07',
    title: '알림 팝업 및 공지 기능 추가',
    items: [
      '알림창이 팝업 모달로 개선됐어요.',
      '공지 탭에서 시스템 업데이트 내역을 확인할 수 있어요.',
    ],
  },
  {
    id: 3,
    date: '2026-04-07',
    title: '상단 배너 로딩 속도 개선',
    items: [
      '연락 예정 배너가 페이지 재방문 시 즉시 표시돼요.',
    ],
  },
  {
    id: 2,
    date: '2026-03-28',
    title: '엑셀 다운로드 기능 개선',
    items: [
      '학점은행제 · 자격증 페이지 엑셀 다운로드 항목이 업데이트됐어요.',
    ],
  },
  {
    id: 1,
    date: '2026-03-20',
    title: '알림 · 빠른검색 기능 추가',
    items: [
      '헤더에서 알림을 실시간으로 받을 수 있어요.',
      '빠른검색(Cmd+K)으로 원하는 메뉴로 빠르게 이동할 수 있어요.',
    ],
  },
]

export default ANNOUNCEMENTS
