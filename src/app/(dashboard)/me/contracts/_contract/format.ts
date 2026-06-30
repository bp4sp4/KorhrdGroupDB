// 계약서 입력 자동 포맷

// 주민번호 — 앞 6자리 - 뒤 7자리 (######-#######)
export function formatRRN(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 13);
  return d.length > 6 ? `${d.slice(0, 6)}-${d.slice(6)}` : d;
}

// 연락처 — 010-4자리-4자리 (3-4-4). 그 외 자리수도 자연스럽게 하이픈.
export function formatPhone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

// 금액 — 3자리마다 천단위 쉼표 (저장은 숫자만, 표시용)
export function comma(v: string): string {
  return String(v)
    .replace(/[^0-9]/g, "")
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
