// 달력 주차 계산 유틸 (월~일 기준, 한국 캘린더 관례)
// "1일이 포함된 월~일 주 = 1주차"
//   예) 2026-05-01(금) → 1주차 = 4/27(월) ~ 5/3(일)
//                       2주차 = 5/4(월) ~ 5/10(일)
//                       3주차 = 5/11(월) ~ 5/17(일)
//                       ...
//   6주차가 생기는 달(예: 1일이 일요일) 의 6주차 데이터는 5주차로 클램프.
//
// 반환값: 0~4 (1주차=0, 5주차=4)
export function getCalendarWeekIndex(
  year: number,
  month: number, // 1~12
  day: number,
): number {
  const mondayOf = (d: Date) => {
    const dow = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const offset = dow === 0 ? -6 : 1 - dow;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset);
  };

  const target = new Date(year, month - 1, day);
  const targetMonday = mondayOf(target);

  const firstDayOfMonth = new Date(year, month - 1, 1);
  const firstWeekMonday = mondayOf(firstDayOfMonth);

  const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
  const diff = targetMonday.getTime() - firstWeekMonday.getTime();
  const weekIdx = Math.round(diff / MS_PER_WEEK);

  // 0~4 로 클램프 (6주차 발생 시 5주차로 합산)
  return Math.min(4, Math.max(0, weekIdx));
}
