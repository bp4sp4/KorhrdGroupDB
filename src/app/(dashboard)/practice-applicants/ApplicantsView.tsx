"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DateInput } from "@/components/ui/Calendar/DateInput";
import { DateRangeCalendar, type DateRange } from "@/components/DateRangeCalendar";
import MemoTimeline from "@/components/ui/MemoTimeline";
import styles from "./page.module.css";

// ─── 헤더 아이콘 (디자인 SVG) ──────────────────────────────────────
function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fillRule="evenodd" clipRule="evenodd" d="M8.98174 2.13047C9.09891 2.24767 9.16474 2.40661 9.16474 2.57234C9.16474 2.73807 9.09891 2.89701 8.98174 3.01422L4.29716 7.6988C4.23525 7.76072 4.16175 7.80984 4.08086 7.84335C3.99997 7.87687 3.91326 7.89412 3.8257 7.89412C3.73814 7.89412 3.65144 7.87687 3.57054 7.84335C3.48965 7.80984 3.41615 7.76072 3.35424 7.6988L1.02674 5.37172C0.967049 5.31406 0.919435 5.2451 0.886679 5.16884C0.853924 5.09259 0.836682 5.01058 0.835961 4.92759C0.83524 4.8446 0.851054 4.7623 0.882479 4.68549C0.913905 4.60868 0.960313 4.5389 1.019 4.48022C1.07768 4.42154 1.14746 4.37513 1.22427 4.3437C1.30108 4.31228 1.38338 4.29646 1.46637 4.29718C1.54936 4.29791 1.63137 4.31515 1.70762 4.3479C1.78387 4.38066 1.85284 4.42827 1.91049 4.48797L3.82549 6.40297L8.09758 2.13047C8.15562 2.07239 8.22454 2.02631 8.30039 1.99488C8.37625 1.96344 8.45755 1.94727 8.53966 1.94727C8.62177 1.94727 8.70308 1.96344 8.77893 1.99488C8.85478 2.02631 8.9237 2.07239 8.98174 2.13047Z" fill="#0084FE" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fillRule="evenodd" clipRule="evenodd" d="M7.62451 1.26172C7.89358 1.26192 8.1123 1.4804 8.1123 1.74951V2.01172H9.49951C9.7613 2.01172 10.0123 2.11599 10.1975 2.30103C10.3827 2.48622 10.4868 2.73786 10.4868 2.99976V9.49927C10.4868 9.76112 10.3826 10.0121 10.1975 10.1973C10.0123 10.3825 9.76141 10.4866 9.49951 10.4866H2.49976C2.23786 10.4866 1.98622 10.3825 1.80103 10.1973C1.61604 10.0121 1.51172 9.76101 1.51172 9.49927V2.99976C1.51172 2.73785 1.61583 2.48622 1.80103 2.30103C1.98622 2.11583 2.23785 2.01172 2.49976 2.01172H3.88696V1.74951C3.88696 1.48027 4.10552 1.26172 4.37476 1.26172C4.64383 1.26192 4.86255 1.4804 4.86255 1.74951V2.01172H7.13745V1.74951C7.13745 1.48035 7.35538 1.26185 7.62451 1.26172ZM2.4873 9.49927C2.4873 9.50254 2.48868 9.50572 2.49097 9.50806C2.4933 9.51032 2.4965 9.51172 2.49976 9.51172H9.49951C9.50283 9.51172 9.50596 9.5104 9.5083 9.50806C9.51059 9.50572 9.51196 9.50254 9.51196 9.49927V5.48706H2.4873V9.49927ZM2.49097 2.99097C2.48862 2.99331 2.4873 2.99644 2.4873 2.99976V4.51147H9.51196V2.99976C9.51196 2.9965 9.51057 2.9933 9.5083 2.99097C9.50596 2.98862 9.50283 2.9873 9.49951 2.9873H8.1123V3.24951C8.1123 3.51863 7.89358 3.73711 7.62451 3.7373C7.35538 3.73717 7.13745 3.51867 7.13745 3.24951V2.9873H4.86255V3.24951C4.86255 3.51863 4.64383 3.73711 4.37476 3.7373C4.10552 3.7373 3.88696 3.51875 3.88696 3.24951V2.9873H2.49976C2.49644 2.9873 2.49331 2.98862 2.49097 2.99097Z" fill="#8995A2" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g clipPath="url(#applicants_search_clip)">
        <path d="M8.875 5.5C8.87499 5.05681 8.78777 4.61795 8.61816 4.2085C8.44858 3.79909 8.20005 3.42713 7.88672 3.11377C7.57331 2.80036 7.20099 2.55145 6.7915 2.38184C6.38207 2.21227 5.94315 2.125 5.5 2.125C5.05682 2.12501 4.61795 2.21224 4.2085 2.38184C3.79901 2.55145 3.42718 2.80036 3.11377 3.11377C2.48084 3.7467 2.12503 4.6049 2.125 5.5C2.125 6.39513 2.48081 7.25376 3.11377 7.88672C3.74669 8.51956 4.60497 8.87497 5.5 8.875C6.39513 8.875 7.25376 8.51967 7.88672 7.88672C8.20013 7.57331 8.44855 7.20099 8.61816 6.7915C8.78775 6.38205 8.875 5.94318 8.875 5.5ZM10.125 5.5C10.125 6.10738 10.0054 6.70888 9.77295 7.27002C9.62071 7.63756 9.4213 7.98249 9.18164 8.29785L10.9419 10.0581C11.186 10.3022 11.186 10.6978 10.9419 10.9419C10.6978 11.186 10.3022 11.186 10.0581 10.9419L8.29785 9.18164C7.49767 9.78975 6.51638 10.125 5.5 10.125C4.27338 10.125 3.09684 9.63786 2.22949 8.77051C1.36218 7.90314 0.875 6.7266 0.875 5.5C0.875027 4.27338 1.36214 3.09684 2.22949 2.22949C2.65894 1.80005 3.16889 1.45948 3.72998 1.22705C4.29109 0.994631 4.89266 0.875014 5.5 0.875C6.10736 0.875 6.70889 0.994627 7.27002 1.22705C7.83112 1.45947 8.34105 1.80006 8.77051 2.22949C9.19993 2.65892 9.54052 3.16892 9.77295 3.72998C10.0054 4.29109 10.125 4.89266 10.125 5.5Z" fill="#8995A2" />
      </g>
      <defs>
        <clipPath id="applicants_search_clip">
          <rect width="12" height="12" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g clipPath="url(#applicants_plus_clip)">
        <path d="M6.02248 0.76172C6.38004 0.762738 6.66939 1.05373 6.66855 1.41121L6.65909 5.33925L10.5876 5.33046C10.9446 5.32992 11.2351 5.61794 11.2363 5.97522C11.2372 6.33262 10.9483 6.62352 10.5909 6.62471L6.65571 6.63418L6.64558 10.6163C6.64443 10.9737 6.35353 11.2625 5.99613 11.2617C5.6389 11.2604 5.3492 10.9696 5.35006 10.6122L5.36087 6.63755L1.38578 6.64769C1.02862 6.64826 0.737526 6.35948 0.73633 6.00226C0.735503 5.64491 1.02509 5.35402 1.3824 5.35276L5.36357 5.34195L5.37371 1.40783C5.37472 1.05067 5.66504 0.761176 6.02248 0.76172Z" fill="white" />
      </g>
      <defs>
        <clipPath id="applicants_plus_clip">
          <rect width="12" height="12" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
}

// 과정 필터 (practice_type → 과정 그룹)
const COURSE_TABS: { key: string; label: string }[] = [
  { key: "사회복지사", label: "사회복지사" },
  { key: "보육교사", label: "보육교사" },
  { key: "한국어교원", label: "한국어 교원" },
  { key: "평생교육사", label: "평생교육사" },
  { key: "기타", label: "기타" },
];

function courseOf(pt: string | null): string {
  if (!pt) return "기타";
  // 기존 표기 흡수: "사복", "사복(120)", "사복(160)" 등도 사회복지사로
  if (pt.startsWith("사회복지사") || pt.startsWith("사복")) return "사회복지사";
  if (pt.startsWith("보육교사")) return "보육교사";
  if (pt.startsWith("한국어교원")) return "한국어교원";
  if (pt.startsWith("평생교육사")) return "평생교육사";
  return "기타";
}

// 상태 탭 (디자인 순서)
const STATUS_TABS = [
  "입금대기",
  "입금완료",
  "교육원 연계",
  "교육원 연계 완료",
  "교육원 재연계",
  "기관 연계",
  "기관 연계 완료",
  "기관 재연계",
  "실습 연기",
  "실습 완료",
  "환불",
];

// 상태별 색상 (디자인 스펙)
const STATUS_PILL: Record<string, { bg: string; color: string }> = {
  입금대기: { bg: "#F3F4F6", color: "#6B7684" },
  입금완료: { bg: "#EAF3FF", color: "#0084FE" },
  "교육원 연계": { bg: "#F3F4F6", color: "#6B7684" },
  "교육원 연계 완료": { bg: "#E0F7FA", color: "#0277BD" },
  "교육원 재연계": { bg: "#FFFDE7", color: "#F57F17" },
  "기관 연계": { bg: "#F3F4F6", color: "#6B7684" },
  "기관 연계 완료": { bg: "#E0F7FA", color: "#0277BD" },
  "기관 재연계": { bg: "#FFFDE7", color: "#F57F17" },
  "실습 연기": { bg: "#F9F3FF", color: "#7C3AED" },
  "실습 완료": { bg: "#D4FDE7", color: "#00A63D" },
  환불: { bg: "#FEE2E2", color: "#DC2626" },
};
function statusPill(s: string): { bg: string; color: string } {
  return STATUS_PILL[s] ?? { bg: "#F3F4F6", color: "#6B7684" };
}

// 옛 상태값 집합 — 이 값이면 아직 새 상태로 정리 전(= category 연동 대상)
const OLD_STATUS_SET: Set<string> = new Set([
  "입금완료",
  "확인필요",
  "추후진행예정",
  "재연계",
]);

// 표시용 상태 — 옛 상태값인 기존 category(완료/환불) 건만 새 상태 탭으로 연동.
// 팝업으로 새 상태값이 들어오면 그 값을 그대로 사용.
function effectiveStatus(r: Applicant): string {
  if (OLD_STATUS_SET.has(r.status)) {
    if (r.category === "완료") return "실습 완료";
    if (r.category === "환불") return "환불";
  }
  return r.status;
}

// 상태변경 팝업 그룹 (디자인)
const STATUS_GROUPS: { label: string; options: string[] }[] = [
  { label: "입금", options: ["입금대기", "입금완료", "환불"] },
  { label: "교육원", options: ["교육원 연계", "교육원 연계 완료", "교육원 재연계"] },
  { label: "기관", options: ["기관 연계", "기관 연계 완료", "기관 재연계"] },
  { label: "실습", options: ["실습 완료", "실습 연기"] },
];

// 상태 태그 표시 그룹 (디자인 — 그룹 사이 세로 구분선)
const STATUS_TAG_GROUPS: string[][] = [
  ["입금대기", "입금완료"],
  ["교육원 연계", "교육원 연계 완료", "교육원 재연계"],
  ["기관 연계", "기관 연계 완료", "기관 재연계"],
  ["실습 완료", "실습 연기"],
  ["환불"],
];

// 희망실습일 정렬 아이콘
function SortIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7 7C7 7.17405 6.93086 7.34097 6.80779 7.46404C6.68472 7.58711 6.5178 7.65625 6.34375 7.65625H2.625C2.45095 7.65625 2.28403 7.58711 2.16096 7.46404C2.03789 7.34097 1.96875 7.17405 1.96875 7C1.96875 6.82595 2.03789 6.65903 2.16096 6.53596C2.28403 6.41289 2.45095 6.34375 2.625 6.34375H6.34375C6.5178 6.34375 6.68472 6.41289 6.80779 6.53596C6.93086 6.65903 7 6.82595 7 7ZM2.625 4.15625H9.84375C10.0178 4.15625 10.1847 4.08711 10.3078 3.96404C10.4309 3.84097 10.5 3.67405 10.5 3.5C10.5 3.32595 10.4309 3.15903 10.3078 3.03596C10.1847 2.91289 10.0178 2.84375 9.84375 2.84375H2.625C2.45095 2.84375 2.28403 2.91289 2.16096 3.03596C2.03789 3.15903 1.96875 3.32595 1.96875 3.5C1.96875 3.67405 2.03789 3.84097 2.16096 3.96404C2.28403 4.08711 2.45095 4.15625 2.625 4.15625ZM5.46875 9.84375H2.625C2.45095 9.84375 2.28403 9.91289 2.16096 10.036C2.03789 10.159 1.96875 10.326 1.96875 10.5C1.96875 10.674 2.03789 10.841 2.16096 10.964C2.28403 11.0871 2.45095 11.1562 2.625 11.1562H5.46875C5.6428 11.1562 5.80972 11.0871 5.93279 10.964C6.05586 10.841 6.125 10.674 6.125 10.5C6.125 10.326 6.05586 10.159 5.93279 10.036C5.80972 9.91289 5.6428 9.84375 5.46875 9.84375ZM12.7143 8.7232C12.6533 8.66202 12.5809 8.61348 12.5011 8.58036C12.4213 8.54724 12.3358 8.53018 12.2495 8.53018C12.1631 8.53018 12.0776 8.54724 11.9978 8.58036C11.918 8.61348 11.8456 8.66202 11.7846 8.7232L10.7188 9.78906V6.125C10.7188 5.95095 10.6496 5.78403 10.5265 5.66096C10.4035 5.53789 10.2365 5.46875 10.0625 5.46875C9.88845 5.46875 9.72153 5.53789 9.59846 5.66096C9.47539 5.78403 9.40625 5.95095 9.40625 6.125V9.78906L8.3393 8.72156C8.21601 8.59828 8.0488 8.52902 7.87445 8.52902C7.7001 8.52902 7.53289 8.59828 7.40961 8.72156C7.28633 8.84485 7.21706 9.01206 7.21706 9.18641C7.21706 9.36076 7.28633 9.52797 7.40961 9.65125L9.59711 11.8387C9.65808 11.8999 9.73052 11.9485 9.81029 11.9816C9.89006 12.0147 9.97558 12.0318 10.062 12.0318C10.1483 12.0318 10.2338 12.0147 10.3136 11.9816C10.3934 11.9485 10.4658 11.8999 10.5268 11.8387L12.7143 9.65125C12.8374 9.52818 12.9065 9.36127 12.9065 9.18723C12.9065 9.01319 12.8374 8.84627 12.7143 8.7232Z" fill="#1F2937" />
    </svg>
  );
}

// 상태변경 (선택 액션 바)
function SwapIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M9.33118 7.20665C9.60772 6.93011 10.0561 6.93011 10.3326 7.20665L12.4569 9.33091C12.7333 9.60746 12.7334 10.0559 12.4569 10.3324L10.3326 12.4566C10.0561 12.7331 9.60773 12.7331 9.33118 12.4566C9.05464 12.1801 9.05464 11.7317 9.33118 11.4552L10.2463 10.54H2.04236C1.65133 10.54 1.33408 10.2227 1.33398 9.83165C1.33398 9.44056 1.65127 9.12327 2.04236 9.12327H10.2463L9.33118 8.20811C9.05465 7.93159 9.05469 7.48319 9.33118 7.20665ZM3.66589 1.54136C3.94242 1.26484 4.39081 1.26488 4.66736 1.54136C4.9439 1.8179 4.9439 2.26629 4.66736 2.54283L3.7522 3.45799H11.9562C12.3472 3.45803 12.6645 3.77535 12.6646 4.16636C12.6646 4.55743 12.3472 4.8747 11.9562 4.87474H3.7522L4.66736 5.7899C4.94388 6.06642 4.94384 6.51482 4.66736 6.79136C4.39082 7.0679 3.94243 7.0679 3.66589 6.79136L1.54163 4.66709C1.26514 4.39055 1.2651 3.94215 1.54163 3.66563L3.66589 1.54136Z" fill="#8995A2" />
    </svg>
  );
}

// 상세 모달 — 이름 수정 연필
function PencilIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.4993 16.6678C17.9596 16.6678 18.3327 17.0409 18.3327 17.5011C18.3326 17.9613 17.9595 18.3344 17.4993 18.3344H2.49935C2.03918 18.3344 1.66613 17.9613 1.66602 17.5011C1.66602 17.0409 2.03911 16.6678 2.49935 16.6678H17.4993Z" fill="#7A8086" />
      <path fillRule="evenodd" clipRule="evenodd" d="M13.6403 1.85495C13.9676 1.58799 14.4501 1.60682 14.7552 1.91191L18.0885 5.24525C18.4139 5.57069 18.4139 6.09823 18.0885 6.42363L9.75521 14.757C9.59894 14.9132 9.38698 15.0011 9.16602 15.0011H5.83268C5.37251 15.0011 4.99945 14.6279 4.99935 14.1678V10.8344C4.99935 10.6135 5.08727 10.4015 5.24349 10.2452L13.5768 1.91191L13.6403 1.85495ZM6.66602 11.1795V13.3344H8.82096L13.821 8.33444L11.666 6.17949L6.66602 11.1795ZM12.8444 5.00111L14.9993 7.15605L16.321 5.83444L14.166 3.67949L12.8444 5.00111Z" fill="#7A8086" />
    </svg>
  );
}

// 상세 모달 — 닫기
function CloseIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M18.0072 3.93918C18.5537 3.3906 19.4411 3.38723 19.9906 3.93332C20.5398 4.47992 20.5428 5.36865 19.9964 5.91819L13.9789 11.9636L20.0667 18.0822C20.6129 18.6318 20.6102 19.5206 20.0609 20.0671C19.5113 20.6126 18.6224 20.6103 18.076 20.0613L11.9999 13.9529L5.92368 20.0613C5.37709 20.6099 4.48821 20.6131 3.93882 20.0671C3.38989 19.5207 3.38724 18.6318 3.93296 18.0822L10.0194 11.9636L4.00473 5.91819C3.45878 5.36914 3.4601 4.48031 4.00913 3.93332C4.55871 3.38686 5.4474 3.39003 5.99399 3.93918L11.9999 9.97434L18.0072 3.93918Z" fill="#8995A2" />
    </svg>
  );
}

const SORT_OPTIONS: { value: "default" | "newest" | "oldest"; label: string }[] =
  [
    { value: "default", label: "기본순" },
    { value: "newest", label: "최신순" },
    { value: "oldest", label: "과거순" },
  ];

// ─── 타입 ──────────────────────────────────────────────────────────
export interface Applicant {
  id: number;
  category: string;
  seq_no: number | null;
  name: string;
  contact: string | null;
  birth_date: string | null;
  address: string | null;
  desired_date: string | null;
  practice_type: string | null;
  desired_weekday: string | null;
  desired_semester?: string | null;
  recognition_period: string | null;
  training_center: string | null;
  center_open_date?: string | null;
  field_institution: string | null;
  status: string;
  counsel_content: string | null;
  certifications: string | null;
  amount: number | null;
  manager: string | null;
  gender?: string | null;
  cash_receipt_number?: string | null;
  own_car?: string | null;
  grade_report_date?: string | null;
  created_at: string;
  updated_at: string;
}


// 카테고리 (저장값 key → 표시 label) — 페이지 간 이동(완료/환불 처리)용
export const CATEGORIES: { key: string; label: string }[] = [
  { key: "타과정", label: "타과정 실습" },
  { key: "사회복지사", label: "사회복지사 실습" },
  { key: "완료", label: "실습 완료 건" },
  { key: "환불", label: "실습 환불 건" },
];

// 실습종류 (첨부 양식 기준)
const PRACTICE_TYPE_OPTIONS = [
  "사회복지사 실습 160시간",
  "사회복지사 실습 120시간",
  "보육교사 실습 240시간",
  "평생교육사 실습 160시간",
  "한국어교원 실습",
];
const WEEKDAY_OPTIONS = ["평일", "주말", "평일+주말"];

// 연락처 자동 하이픈 (010-XXXX-XXXX)
function formatPhone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// created_at(ISO) → KST 기준 'YYYY-MM-DD' (기간 필터용)
function createdKstDate(iso: string): string {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "";
  const k = new Date(t.getTime() + 9 * 60 * 60 * 1000);
  return `${k.getUTCFullYear()}-${String(k.getUTCMonth() + 1).padStart(2, "0")}-${String(k.getUTCDate()).padStart(2, "0")}`;
}

const PAGE_SIZE = 10;

// 신규 추가용 빈 행 (id 0 = 신규)
function blankApplicant(category: string): Applicant {
  return {
    id: 0,
    category,
    seq_no: null,
    name: "",
    contact: null,
    birth_date: null,
    address: null,
    desired_date: null,
    practice_type: null,
    desired_weekday: null,
    recognition_period: null,
    training_center: null,
    field_institution: null,
    status: "추후진행예정",
    counsel_content: null,
    certifications: null,
    amount: 33000,
    manager: null,
    gender: null,
    cash_receipt_number: null,
    own_car: null,
    desired_semester: null,
    grade_report_date: null,
    center_open_date: null,
    created_at: "",
    updated_at: "",
  };
}

export default function ApplicantsView({
  category,
  title,
}: {
  category: string;
  title: string;
}) {
  // category 가 비어있으면 통합 모드(전체 실습학생) — 과정 칩으로 필터
  const unified = !category;
  const [rows, setRows] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [fCourse, setFCourse] = useState<string[]>([]);
  const [statusTab, setStatusTab] = useState<string>("");
  // 희망실습일 정렬
  const [sortOrder, setSortOrder] = useState<"default" | "newest" | "oldest">(
    "default",
  );
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  // 상태변경 팝업
  const [scOpen, setScOpen] = useState(false);
  const [scStatus, setScStatus] = useState("입금대기");
  const scRef = useRef<HTMLDivElement>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [dateOpen, setDateOpen] = useState(false);
  const dateRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState<Applicant | null>(null);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        unified
          ? `/api/practice-applicants`
          : `/api/practice-applicants?category=${encodeURIComponent(category)}`,
      );
      const d = await res.json();
      if (res.ok) setRows(d.rows ?? []);
      setSelectedIds(new Set());
    } finally {
      setLoading(false);
    }
  }, [category, unified]);

  const toggleOne = (id: number) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // 다중 삭제
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`선택한 ${selectedIds.size}건을 삭제할까요?`)) return;
    const ids = [...selectedIds];
    const res = await fetch(`/api/practice-applicants?ids=${ids.join(",")}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setRows((prev) => prev.filter((r) => !selectedIds.has(r.id)));
      setSelectedIds(new Set());
    } else {
      const d = await res.json().catch(() => ({}));
      alert(d.error ?? "삭제 실패");
    }
  };

  // 선택 건 상태 일괄 변경
  const handleBulkStatusChange = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setRows((prev) =>
      prev.map((r) =>
        selectedIds.has(r.id) ? { ...r, status: scStatus } : r,
      ),
    );
    setScOpen(false);
    setSelectedIds(new Set());
    const results = await Promise.all(
      ids.map((id) =>
        fetch("/api/practice-applicants", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, patch: { status: scStatus } }),
        })
          .then((res) => res.ok)
          .catch(() => false),
      ),
    );
    if (results.some((ok) => !ok)) {
      await fetchRows();
      alert("일부 상태 변경에 실패했습니다.");
    }
  };

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  // 희망실습일 정렬 드롭다운 — 바깥 클릭 시 닫기
  useEffect(() => {
    if (!sortOpen) return;
    const onDown = (e: globalThis.MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [sortOpen]);

  // 상태변경 팝업 — 바깥 클릭 시 닫기
  useEffect(() => {
    if (!scOpen) return;
    const onDown = (e: globalThis.MouseEvent) => {
      if (scRef.current && !scRef.current.contains(e.target as Node)) {
        setScOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [scOpen]);

  // 기간 선택 팝오버 — 바깥 클릭 닫기
  useEffect(() => {
    if (!dateOpen) return;
    const onDown = (e: globalThis.MouseEvent) => {
      if (dateRef.current && !dateRef.current.contains(e.target as Node)) {
        setDateOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [dateOpen]);

  // 과정 + 검색 + 기간 까지 적용한 범위 (상태 탭 카운트 기준)
  const statusScope = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (fCourse.length && !fCourse.includes(courseOf(r.practice_type)))
        return false;
      if (dateFrom || dateTo) {
        const cd = createdKstDate(r.created_at);
        if (dateFrom && cd < dateFrom) return false;
        if (dateTo && cd > dateTo) return false;
      }
      if (!q) return true;
      const hay = [
        r.name,
        r.contact,
        r.field_institution,
        r.training_center,
        r.practice_type,
        r.address,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query, fCourse, dateFrom, dateTo]);

  // 상태 탭별 건수
  const statusCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of statusScope) {
      const s = effectiveStatus(r);
      m[s] = (m[s] ?? 0) + 1;
    }
    return m;
  }, [statusScope]);

  // 상태 탭 필터
  const filtered = useMemo(
    () =>
      statusScope.filter((r) => !statusTab || effectiveStatus(r) === statusTab),
    [statusScope, statusTab],
  );

  // 희망실습일 정렬 (기본순/최신순/과거순, 빈값은 뒤로)
  const sorted = useMemo(() => {
    if (sortOrder === "default") return filtered;
    const arr = [...filtered];
    arr.sort((a, b) => {
      const da = a.desired_date || "";
      const db = b.desired_date || "";
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return sortOrder === "newest"
        ? db.localeCompare(da)
        : da.localeCompare(db);
    });
    return arr;
  }, [filtered, sortOrder]);

  // 페이징
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  useEffect(() => {
    setPage(1);
  }, [query, fCourse, statusTab, sortOrder, dateFrom, dateTo]);
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);
  const paged = useMemo(
    () => sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [sorted, page],
  );
  const pageWindow = useMemo(() => {
    const win = 5;
    let start = Math.max(1, page - 2);
    const end = Math.min(totalPages, start + win - 1);
    start = Math.max(1, end - win + 1);
    const arr: number[] = [];
    for (let n = start; n <= end; n++) arr.push(n);
    return arr;
  }, [page, totalPages]);

  const allPagedSelected =
    paged.length > 0 && paged.every((r) => selectedIds.has(r.id));
  const toggleAllPaged = () =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPagedSelected) paged.forEach((r) => next.delete(r.id));
      else paged.forEach((r) => next.add(r.id));
      return next;
    });


  // 상세 저장(수정) / 신규 추가(id 0). 카테고리가 바뀌면 현재 페이지에서 제거
  const handleSave = async (id: number, patch: Partial<Applicant>) => {
    const isNew = id === 0;
    const res = await fetch("/api/practice-applicants", {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isNew ? { patch } : { id, patch }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(d.error ?? "저장 실패");
      return false;
    }
    const saved = d.row as Applicant;
    setRows((prev) => {
      if (isNew) {
        return unified || saved.category === category ? [saved, ...prev] : prev;
      }
      if (unified) {
        return prev.map((r) => (r.id === id ? saved : r));
      }
      return saved.category !== category
        ? prev.filter((r) => r.id !== id)
        : prev.map((r) => (r.id === id ? saved : r));
    });
    return true;
  };

  const handleDelete = async (id: number) => {
    if (!confirm("이 신청자를 삭제할까요?")) return;
    const res = await fetch(`/api/practice-applicants?id=${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setRows((prev) => prev.filter((r) => r.id !== id));
      setEditing(null);
    } else {
      const d = await res.json().catch(() => ({}));
      alert(d.error ?? "삭제 실패");
    }
  };

  return (
    <div className={styles.wrap}>
      {/* 헤더 + 과정 필터 (신규 디자인) */}
      <div className={styles.dbSection}>
        <h1 className={styles.dbTitle}>{title}</h1>

        <div className={styles.dbFilterRow}>
          {/* 과정 칩 */}
          <div className={styles.courseFilterLeft}>
            <span className={styles.courseLabel}>과정</span>
            <div className={styles.courseChips}>
              <button
                type="button"
                className={`${styles.courseChip} ${
                  fCourse.length === 0 ? styles.courseChipActive : ""
                }`}
                onClick={() => setFCourse([])}
              >
                {fCourse.length === 0 && <CheckIcon />}
                전체
              </button>
              {COURSE_TABS.map((c) => {
                const on = fCourse.includes(c.key);
                return (
                  <button
                    key={c.key}
                    type="button"
                    className={`${styles.courseChip} ${
                      on ? styles.courseChipActive : ""
                    }`}
                    onClick={() =>
                      setFCourse((prev) =>
                        prev.includes(c.key)
                          ? prev.filter((x) => x !== c.key)
                          : [...prev, c.key],
                      )
                    }
                  >
                    {on && <CheckIcon />}
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 우측 액션 */}
          <div className={styles.dbActions}>
            <div ref={dateRef} className={styles.dateRangeWrap}>
              <button
                type="button"
                className={styles.dbBtn}
                onClick={() => setDateOpen((v) => !v)}
              >
                <CalendarIcon />
                {dateFrom && dateTo
                  ? `${dateFrom.replace(/-/g, ".")} ~ ${dateTo.replace(/-/g, ".")}`
                  : "기간선택"}
              </button>
              {dateOpen && (
                <div className={styles.dateRangePopover}>
                  <DateRangeCalendar
                    variant="quarter"
                    value={{
                      from: dateFrom ? new Date(dateFrom) : undefined,
                      to: dateTo ? new Date(dateTo) : undefined,
                    }}
                    onChange={(r) => {
                      setDateFrom(r?.from ? ymd(r.from) : "");
                      setDateTo(r?.to ? ymd(r.to) : "");
                    }}
                    onConfirm={() => setDateOpen(false)}
                    onReset={() => {
                      setDateFrom("");
                      setDateTo("");
                    }}
                  />
                </div>
              )}
            </div>

            <div className={styles.dbSearch}>
              <SearchIcon />
              <input
                className={styles.dbSearchInput}
                placeholder="이름·연락처·기관·상담내용 검색"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <button
              type="button"
              className={`${styles.dbBtn} ${styles.dbBtnPrimary}`}
              onClick={() =>
                setEditing(blankApplicant(unified ? "타과정" : category))
              }
            >
              <PlusIcon />
              추가
            </button>
          </div>
        </div>

        {/* 상태 탭 */}
        <div className={styles.statusTabRow}>
          <span className={styles.statusLabel}>상태</span>
          <div className={styles.statusTabs}>
            <button
              type="button"
              className={`${styles.statusTab} ${
                statusTab === "" ? styles.statusTabActive : ""
              }`}
              onClick={() => setStatusTab("")}
            >
              <span>전체</span>
              <span>{statusScope.length}</span>
            </button>
            {STATUS_TABS.map((s) => (
              <Fragment key={s}>
                <span className={styles.statusDivider} aria-hidden="true" />
                <button
                  type="button"
                  className={`${styles.statusTab} ${
                    statusTab === s ? styles.statusTabActive : ""
                  }`}
                  onClick={() => setStatusTab(s)}
                >
                  <span>{s}</span>
                  <span>{statusCounts[s] ?? 0}</span>
                </button>
              </Fragment>
            ))}
          </div>
        </div>
      </div>

      {/* 다중 선택 액션 바 */}
      {selectedIds.size > 0 && (
        <div className={styles.selectBar}>
          <span className={styles.selectCount}>
            {selectedIds.size}명 선택됨
          </span>
          <div className={styles.selectActions}>
            <div ref={scRef} className={styles.scAnchor}>
              <button
                type="button"
                className={styles.selectChangeBtn}
                onClick={() => setScOpen((v) => !v)}
              >
                <SwapIcon />
                상태변경
              </button>
              {scOpen && (
                <div className={styles.scPopup}>
                  <span className={styles.scTitle}>상태 변경</span>
                  {STATUS_GROUPS.map((g) => (
                    <div key={g.label} className={styles.scGroup}>
                      <span className={styles.scGroupLabel}>{g.label}</span>
                      {g.options.map((s) => (
                        <button
                          key={s}
                          type="button"
                          className={`${styles.scStatusBtn} ${
                            scStatus === s ? styles.scStatusBtnActive : ""
                          }`}
                          onClick={() => setScStatus(s)}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  ))}
                  <div className={styles.scFooter}>
                    <span className={styles.scFooterText}>
                      선택한{" "}
                      <span className={styles.scFooterN}>
                        {selectedIds.size}
                      </span>
                      명의 상태를 [{scStatus}]로 변경합니다.
                    </span>
                    <button
                      type="button"
                      className={styles.scApplyBtn}
                      onClick={handleBulkStatusChange}
                    >
                      변경
                    </button>
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              className={styles.selectDeleteBtn}
              onClick={handleBulkDelete}
            >
              선택 삭제
            </button>
            <button
              type="button"
              className={styles.selectCancelBtn}
              onClick={() => setSelectedIds(new Set())}
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 테이블 (그리드) */}
      <div className={styles.gridScroll}>
        <div className={styles.gridList}>
          {/* 헤더 */}
          <div className={`${styles.grid12} ${styles.gridHead}`}>
            <div className={styles.headCell}>
              <input
                type="checkbox"
                className={styles.gridCheckbox}
                checked={allPagedSelected}
                onChange={toggleAllPaged}
              />
            </div>
            <div className={styles.headCell}>상태</div>
            <div className={styles.headCell}>이름</div>
            <div className={styles.headCell}>실습 과정</div>
            <div
              ref={sortRef}
              className={`${styles.headCell} ${styles.sortHeadCell}`}
            >
              희망실습일
              <button
                type="button"
                className={styles.sortBtn}
                onClick={() => setSortOpen((v) => !v)}
                aria-label="희망실습일 정렬"
              >
                <SortIcon />
              </button>
              {sortOpen && (
                <div className={styles.sortMenu}>
                  {SORT_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      className={styles.sortItem}
                      onClick={() => {
                        setSortOrder(o.value);
                        setSortOpen(false);
                      }}
                    >
                      <span className={styles.radio}>
                        {sortOrder === o.value && (
                          <span className={styles.radioDot} />
                        )}
                      </span>
                      {o.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className={styles.headCell}>희망요일</div>
            <div className={styles.headCell}>희망학기</div>
            <div className={styles.headCell}>실습 교육원</div>
            <div className={styles.headCell}>교육원 개강일</div>
            <div className={styles.headCell}>실습 인정기간</div>
            <div className={styles.headCell}>실습기관</div>
            <div className={styles.headCell}>상담내용</div>
          </div>

          {/* 바디 */}
          {loading ? (
            <div className={styles.gridEmpty}>불러오는 중…</div>
          ) : sorted.length === 0 ? (
            <div className={styles.gridEmpty}>데이터가 없습니다.</div>
          ) : (
            paged.map((r) => (
              <div
                key={r.id}
                className={`${styles.grid12} ${styles.gridRow} ${
                  selectedIds.has(r.id) ? styles.gridRowSelected : ""
                }`}
                onClick={() => setEditing(r)}
              >
                <div
                  className={styles.bodyCell}
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    className={styles.gridCheckbox}
                    checked={selectedIds.has(r.id)}
                    onChange={() => toggleOne(r.id)}
                  />
                </div>
                <div className={styles.bodyCell}>
                  <span
                    className={styles.statusPill}
                    style={{
                      background: statusPill(effectiveStatus(r)).bg,
                      color: statusPill(effectiveStatus(r)).color,
                    }}
                  >
                    {effectiveStatus(r)}
                  </span>
                </div>

                <div className={`${styles.bodyCell} ${styles.cellNameBold}`}>
                  {r.name}
                </div>
                <div className={styles.bodyCell} title={r.practice_type ?? ""}>
                  {r.practice_type ?? "-"}
                </div>
                <div className={styles.bodyCell}>{r.desired_date ?? "-"}</div>
                <div className={styles.bodyCell}>{r.desired_weekday ?? "-"}</div>
                <div className={styles.bodyCell}>
                  {r.desired_semester ?? "-"}
                </div>
                <div className={styles.bodyCell} title={r.training_center ?? ""}>
                  {r.training_center ?? "-"}
                </div>
                <div className={styles.bodyCell}>
                  {r.center_open_date ?? "-"}
                </div>
                <div className={styles.bodyCell}>
                  {r.recognition_period ? (
                    <span className={styles.twoLine}>
                      {r.recognition_period.split("~").map((part, idx) => (
                        <span key={idx}>
                          {idx === 0 ? part.trim() : `~${part.trim()}`}
                        </span>
                      ))}
                    </span>
                  ) : (
                    "-"
                  )}
                </div>
                <div
                  className={styles.bodyCell}
                  title={r.field_institution ?? ""}
                >
                  {r.field_institution ?? "-"}
                </div>
                <div
                  className={`${styles.bodyCell} ${styles.cellEllipsis}`}
                  title={r.counsel_content ?? ""}
                >
                  <span className={styles.ellipsisText}>
                    {r.counsel_content ?? "-"}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 페이징 */}
      {!loading && totalPages > 1 && (
        <div className={styles.pager}>
          <button
            type="button"
            className={styles.pagerBtn}
            disabled={page === 1}
            onClick={() => setPage(1)}
          >
            «
          </button>
          <button
            type="button"
            className={styles.pagerBtn}
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            이전
          </button>
          {pageWindow.map((n) => (
            <button
              key={n}
              type="button"
              className={`${styles.pagerBtn} ${n === page ? styles.pagerBtnActive : ""}`}
              onClick={() => setPage(n)}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            className={styles.pagerBtn}
            disabled={page === totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            다음
          </button>
          <button
            type="button"
            className={styles.pagerBtn}
            disabled={page === totalPages}
            onClick={() => setPage(totalPages)}
          >
            »
          </button>
          <span className={styles.pagerInfo}>
            {page} / {totalPages}
          </span>
        </div>
      )}

      {editing && (
        <DetailModal
          row={editing}
          onClose={() => setEditing(null)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

// ─── 인정기간 (기간 선택 — DateRangeCalendar 팝오버) ───────────────────
function RangeField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });
  const wrapRef = useRef<HTMLDivElement>(null);

  const parsed = useMemo<DateRange | undefined>(() => {
    const m = value.match(/(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})/);
    if (!m) return undefined;
    return { from: new Date(m[1]), to: new Date(m[2]) };
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: globalThis.MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const toggle = () => {
    if (!open && wrapRef.current) {
      const rect = wrapRef.current.getBoundingClientRect();
      setPos({
        top: rect.bottom + 6,
        left: Math.min(rect.left, window.innerWidth - 680),
      });
    }
    setOpen((v) => !v);
  };

  const display = parsed?.from
    ? `${parsed.from ? ymd(parsed.from).replace(/-/g, ".") : ""} ~ ${parsed.to ? ymd(parsed.to).replace(/-/g, ".") : ""}`
    : "";

  return (
    <div ref={wrapRef} className={styles.detailRangeWrap}>
      <button
        type="button"
        className={`${styles.detailRangeTrigger} ${!display ? styles.rangePlaceholder : ""}`}
        onClick={toggle}
      >
        {display || "기간 선택"}
      </button>
      {open && (
        <div
          className={styles.rangePopover}
          style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999 }}
        >
          <DateRangeCalendar
            value={parsed}
            maxRangeMonths={24}
            onConfirm={(range) => {
              if (range?.from && range?.to) {
                onChange(`${ymd(range.from)} ~ ${ymd(range.to)}`);
              }
              setOpen(false);
            }}
            onReset={() => {
              onChange("");
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

// ─── 상세/편집 모달 ─────────────────────────────────────────────────
function DetailModal({
  row,
  onClose,
  onSave,
  onDelete,
}: {
  row: Applicant;
  onClose: () => void;
  onSave: (id: number, patch: Partial<Applicant>) => Promise<boolean>;
  onDelete: (id: number) => void;
}) {
  const [form, setForm] = useState<Applicant>(row);
  const [saving, setSaving] = useState(false);
  const isNew = row.id === 0;
  const [editName, setEditName] = useState(isNew);
  // TODO: 연락(상담 메모) 횟수 연동 — 현재는 자리만
  const contactCount = 0;

  const set = (key: keyof Applicant, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    setSaving(true);
    try {
      const patch: Partial<Applicant> = {
        category: form.category,
        name: form.name,
        contact: form.contact,
        gender: form.gender,
        birth_date: form.birth_date,
        practice_type: form.practice_type,
        address: form.address,
        cash_receipt_number: form.cash_receipt_number,
        own_car: form.own_car,
        desired_date: form.desired_date,
        desired_weekday: form.desired_weekday,
        desired_semester: form.desired_semester,
        grade_report_date: form.grade_report_date,
        training_center: form.training_center,
        center_open_date: form.center_open_date,
        recognition_period: form.recognition_period,
        field_institution: form.field_institution,
        status: form.status,
        manager: form.manager,
        counsel_content: form.counsel_content,
      };
      const ok = await onSave(row.id, patch);
      if (ok) onClose();
    } finally {
      setSaving(false);
    }
  };

  const pill = statusPill(effectiveStatus(form));

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={`${styles.modal} ${styles.modalWide}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className={styles.modalHead}>
          <div className={styles.modalHeadLeft}>
            <div className={styles.modalNameRow}>
              <div className={styles.modalNameGroup}>
                {editName ? (
                  <input
                    className={styles.modalNameInput}
                    value={form.name ?? ""}
                    placeholder="이름"
                    autoFocus
                    size={Math.max((form.name?.length ?? 0) + 1, 2)}
                    onChange={(e) => set("name", e.target.value)}
                    onBlur={() => setEditName(false)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") setEditName(false);
                    }}
                  />
                ) : (
                  <span
                    className={styles.modalNameText}
                    onClick={() => setEditName(true)}
                  >
                    {form.name || "이름"}
                  </span>
                )}
                <button
                  type="button"
                  className={styles.modalEditBtn}
                  onClick={() => setEditName(true)}
                  aria-label="이름 수정"
                >
                  <PencilIcon />
                </button>
              </div>
              <div className={styles.modalBadges}>
                <span
                  className={styles.modalStatusPill}
                  style={{ background: pill.bg, color: pill.color }}
                >
                  {effectiveStatus(form)}
                </span>
                <span className={styles.modalContactBadge}>
                  {contactCount}회 연락
                </span>
              </div>
            </div>
            <input
              className={styles.modalContactInput}
              value={form.contact ?? ""}
              placeholder="010-0000-0000"
              inputMode="numeric"
              onChange={(e) => set("contact", formatPhone(e.target.value))}
            />
          </div>
          <button
            type="button"
            className={styles.modalCloseBtn}
            onClick={onClose}
            aria-label="닫기"
          >
            <CloseIcon />
          </button>
        </div>

        {/* 본문 — 좌(기본정보) / 우(실습정보) */}
        <div className={styles.modalBody}>
          <div className={styles.modalCols}>
            {/* 좌측 — 기본정보 */}
            <div className={styles.detailColLeft}>
              <div className={styles.detailFieldRow}>
                <label className={styles.detailField}>
                  <span className={styles.detailFieldLabel}>성별</span>
                  <select
                    className={styles.detailFieldBox}
                    value={form.gender ?? ""}
                    onChange={(e) => set("gender", e.target.value)}
                  >
                    <option value="">선택</option>
                    <option value="남성">남성</option>
                    <option value="여성">여성</option>
                  </select>
                </label>
                <label className={styles.detailField}>
                  <span className={styles.detailFieldLabel}>생년월일</span>
                  <input
                    className={styles.detailFieldBox}
                    value={form.birth_date ?? ""}
                    placeholder="1998-03-15"
                    onChange={(e) => set("birth_date", e.target.value)}
                  />
                </label>
              </div>

              <label className={styles.detailField}>
                <span className={styles.detailFieldLabel}>실습 과정</span>
                <select
                  className={styles.detailFieldBox}
                  value={form.practice_type ?? ""}
                  onChange={(e) => set("practice_type", e.target.value)}
                >
                  <option value="">선택하세요</option>
                  {PRACTICE_TYPE_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                  {form.practice_type &&
                    !PRACTICE_TYPE_OPTIONS.includes(form.practice_type) && (
                      <option value={form.practice_type}>
                        {form.practice_type}
                      </option>
                    )}
                </select>
              </label>

              <label className={styles.detailField}>
                <span className={styles.detailFieldLabel}>주소</span>
                <input
                  className={styles.detailFieldBoxFull}
                  value={form.address ?? ""}
                  onChange={(e) => set("address", e.target.value)}
                />
              </label>

              <div className={styles.detailFieldRow}>
                <label className={styles.detailField}>
                  <span className={styles.detailFieldLabel}>현금영수증번호</span>
                  <input
                    className={styles.detailFieldBox}
                    value={form.cash_receipt_number ?? ""}
                    onChange={(e) => set("cash_receipt_number", e.target.value)}
                  />
                </label>
                <label className={styles.detailField}>
                  <span className={styles.detailFieldLabel}>자차 여부</span>
                  <select
                    className={styles.detailFieldBox}
                    value={form.own_car ?? ""}
                    onChange={(e) => set("own_car", e.target.value)}
                  >
                    <option value="">선택</option>
                    <option value="O">O</option>
                    <option value="X">X</option>
                  </select>
                </label>
              </div>

              {/* 메모 — 학점은행제 상세화면 메모(MemoTimeline) 그대로 */}
              {!isNew && (
                <div className={styles.detailMemoSection}>
                  <MemoTimeline
                    tableName="practice_applicants"
                    recordId={String(form.id)}
                    legacyMemo={form.counsel_content}
                  />
                </div>
              )}
            </div>

            {/* 가운데 구분선 */}
            <div className={styles.detailDivider} />

            {/* 우측 — 실습 정보 */}
            <div className={styles.detailColRight}>
              <div className={styles.detailColRightTitle}>실습 정보</div>

              <div className={styles.detailRightSection}>
                <div className={styles.detailRightRow}>
                  <div className={styles.detailField}>
                    <span className={styles.detailFieldLabel}>희망실습일</span>
                    <DateInput
                      value={form.desired_date ?? ""}
                      onChange={(v) => set("desired_date", v)}
                      placeholder="날짜 선택"
                      className={styles.detailDateWrap}
                      triggerClassName={styles.detailDateTrigger}
                      showIcon={false}
                    />
                  </div>
                  <label className={styles.detailField}>
                    <span className={styles.detailFieldLabel}>희망 요일</span>
                    <select
                      className={styles.detailFieldBox}
                      value={form.desired_weekday ?? ""}
                      onChange={(e) => set("desired_weekday", e.target.value)}
                    >
                      <option value="">선택</option>
                      {WEEKDAY_OPTIONS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                      {form.desired_weekday &&
                        !WEEKDAY_OPTIONS.includes(form.desired_weekday) && (
                          <option value={form.desired_weekday}>
                            {form.desired_weekday}
                          </option>
                        )}
                    </select>
                  </label>
                </div>

                <div className={styles.detailRightRow}>
                  <label className={styles.detailField}>
                    <span className={styles.detailFieldLabel}>희망학기</span>
                    <input
                      className={styles.detailFieldBoxFull}
                      value={form.desired_semester ?? ""}
                      placeholder="26년도 1학기"
                      onChange={(e) => set("desired_semester", e.target.value)}
                    />
                  </label>
                  <div className={styles.detailField}>
                    <span className={styles.detailFieldLabel}>성적보고일</span>
                    <DateInput
                      value={form.grade_report_date ?? ""}
                      onChange={(v) => set("grade_report_date", v)}
                      placeholder="날짜 선택"
                      className={styles.detailDateWrap}
                      triggerClassName={styles.detailDateTrigger}
                      showIcon={false}
                    />
                  </div>
                </div>

                <div className={styles.detailRightRow}>
                  <label className={styles.detailField}>
                    <span className={styles.detailFieldLabel}>실습 교육원</span>
                    <input
                      className={styles.detailFieldBoxFull}
                      value={form.training_center ?? ""}
                      onChange={(e) => set("training_center", e.target.value)}
                    />
                  </label>
                  <div className={styles.detailField}>
                    <span className={styles.detailFieldLabel}>교육원 개강일</span>
                    <DateInput
                      value={form.center_open_date ?? ""}
                      onChange={(v) => set("center_open_date", v)}
                      placeholder="날짜 선택"
                      className={styles.detailDateWrap}
                      triggerClassName={styles.detailDateTrigger}
                      showIcon={false}
                    />
                  </div>
                </div>

                <div className={styles.detailField}>
                  <span className={styles.detailFieldLabel}>실습 인정기간</span>
                  <RangeField
                    value={form.recognition_period ?? ""}
                    onChange={(v) => set("recognition_period", v)}
                  />
                </div>

                <label className={styles.detailField}>
                  <span className={styles.detailFieldLabel}>실습 기관</span>
                  <input
                    className={styles.detailFieldBoxFull}
                    value={form.field_institution ?? ""}
                    onChange={(e) => set("field_institution", e.target.value)}
                  />
                </label>

                <div className={styles.detailStatusField}>
                  <span className={styles.detailFieldLabel}>상태</span>
                <div className={styles.detailStatusTags}>
                  {STATUS_TAG_GROUPS.map((group, gi) => (
                    <Fragment key={gi}>
                      {group.map((s) => (
                        <button
                          key={s}
                          type="button"
                          className={`${styles.detailStatusTag} ${
                            effectiveStatus(form) === s
                              ? styles.detailStatusTagActive
                              : ""
                          }`}
                          onClick={() => set("status", s)}
                        >
                          {s}
                        </button>
                      ))}
                      {gi < STATUS_TAG_GROUPS.length - 1 && (
                        <span className={styles.detailStatusDivider} />
                      )}
                    </Fragment>
                  ))}
                </div>
              </div>

                <label className={styles.detailField}>
                  <span className={styles.detailFieldLabel}>실습 담당자</span>
                  <input
                    className={styles.detailFieldBoxFull}
                    value={form.manager ?? ""}
                    onChange={(e) => set("manager", e.target.value)}
                  />
                </label>
              </div>

              {/* 푸터 — 우측 컬럼 하단(좌측 메모와 동일선상), 구분선/삭제버튼 없음 */}
              <div className={styles.detailFoot}>
                <button
                  type="button"
                  className={styles.detailCancelBtn}
                  onClick={onClose}
                >
                  취소
                </button>
                <button
                  type="button"
                  className={styles.detailSaveBtn}
                  onClick={submit}
                  disabled={saving}
                >
                  {saving ? "저장 중…" : "변경사항 저장"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
