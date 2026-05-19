// 근속 연차 기반 연간 휴가 발생량 계산
//
// 규칙:
//  - 1년 미만(1년차): 만근 개월 수마다 1일씩, 최대 11일
//  - 2~3년차(만 1~2년): 15일
//  - 4~5년차(만 3~4년): 16일
//  - 6~7년차(만 5~6년): 17일
//  - 8~9년차(만 7~8년): 18일
//  - 10~11년차(만 9~10년): 19일
//  - 12~13년차(만 11~12년): 20일
//  - 14~15년차(만 13~14년): 21일
//  - 16~17년차(만 15~16년): 22일
//  - 18~19년차(만 17~18년): 23일
//  - 20~21년차(만 19~20년): 24일
//  - 22년차 이상(만 21년 이상): 25일 (최대)
//
// 만 N년 ↔ (N+1)년차 매핑 — 입사 후 만 1년이 되는 날 2년차 진입

export function senorityYears(joined: Date, asOf: Date): number {
  let years = asOf.getFullYear() - joined.getFullYear()
  const monthDiff = asOf.getMonth() - joined.getMonth()
  const dayDiff = asOf.getDate() - joined.getDate()
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) years--
  return Math.max(0, years)
}

export function monthsWorked(joined: Date, asOf: Date): number {
  let months = (asOf.getFullYear() - joined.getFullYear()) * 12
  months += asOf.getMonth() - joined.getMonth()
  // 만근 — 입사 일자 기준으로 한 달이 지나야 1 증가
  if (asOf.getDate() < joined.getDate()) months--
  return Math.max(0, months)
}

// 현재 연차의 기본 발생량 (1년차 11일 누적 미포함)
function currentYearBase(years: number): number {
  if (years <= 2) return 15
  if (years <= 4) return 16
  if (years <= 6) return 17
  if (years <= 8) return 18
  if (years <= 10) return 19
  if (years <= 12) return 20
  if (years <= 14) return 21
  if (years <= 16) return 22
  if (years <= 18) return 23
  if (years <= 20) return 24
  return 25
}

export function getAnnualGrant(joinedDate: Date, asOf: Date): number {
  const years = senorityYears(joinedDate, asOf)
  // 1년 미만: 만근 개월 수만큼, 최대 11
  if (years === 0) {
    const months = monthsWorked(joinedDate, asOf)
    return Math.min(11, Math.max(0, months))
  }
  // 1년 이상: 매년 입사일에 그 해 base가 추가 누적되는 방식
  //   - 1년차 (만근 종료까지) = 11
  //   - 만 N년 도달 시점마다 currentYearBase(N) 가산
  let total = 11
  for (let i = 1; i <= years; i++) {
    total += currentYearBase(i)
  }
  return total
}

// 'YYYY-MM-DD' 또는 'YYYY-MM-DD...' 문자열을 Date 로 파싱
export function parseJoinDate(joinedAt: string | null | undefined): Date | null {
  if (!joinedAt) return null
  const m = String(joinedAt).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (!y || !mo || !d) return null
  const date = new Date(y, mo - 1, d)
  if (Number.isNaN(date.getTime())) return null
  return date
}
