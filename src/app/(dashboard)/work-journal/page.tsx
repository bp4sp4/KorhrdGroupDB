"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent as ReactDragEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import Calendar, {
  type CalendarEvent,
} from "@/app/(dashboard)/calendar/Calendar";
import { HakjeomDetailPanel } from "@/app/(dashboard)/hakjeom/_detail/HakjeomDetailPanel";
import { HakjeomAddModal } from "@/app/(dashboard)/hakjeom/page";
import type { HakjeomConsultation } from "@/app/(dashboard)/hakjeom/_types";
import { DateInput } from "@/components/ui/Calendar/DateInput";
import {
  DateRangeCalendar,
  type DateRange,
} from "@/components/DateRangeCalendar";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  HelpCircle,
  Inbox,
  Plus,
} from "lucide-react";
import styles from "./page.module.css";
import {
  JOURNAL_FORM_TYPES,
  normalizeJournalForm,
  type JournalFormType,
} from "@/lib/work-journal/formTypes";
import CategorySelect from "./_components/CategorySelect";
import { useGuide } from "@/components/guide/GuideProvider";

type Task = { id: string; text: string; done: boolean };
type JournalRow = { id: string; category: string; detail: string };
type Tomorrow = { id: string; text: string };
// 학사팀(academic 양식) 전용
type WeeklyGoal = { id: string; date: string; text: string; done: boolean };

const DOW = ["일", "월", "화", "수", "목", "금", "토"];

// 사업본부(default 양식) 업무 분류 select 옵션
const BIZ_CATEGORY_OPTIONS = [
  "학습상담",
  "학습설계",
  "학습관리",
  "가망관리",
  "학습민원대응",
  "미팅/면담",
  "교육",
  "기타",
] as const;

// ── 업무 센터(default) 상단 통계 카드 아이콘 ──────────────────
const WcIconStar = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M10.9202 2.86868C11.0303 2.67984 11.1879 2.52316 11.3774 2.41426C11.5669 2.30536 11.7817 2.24805 12.0002 2.24805C12.2188 2.24805 12.4335 2.30536 12.623 2.41426C12.8125 2.52316 12.9702 2.67984 13.0802 2.86868L15.8752 7.66668L21.3032 8.84268C21.5167 8.88908 21.7144 8.99063 21.8764 9.13721C22.0384 9.2838 22.1592 9.47029 22.2267 9.67811C22.2942 9.88592 22.306 10.1078 22.261 10.3216C22.216 10.5354 22.1157 10.7337 21.9702 10.8967L18.2702 15.0377L18.8302 20.5627C18.8523 20.7802 18.817 20.9998 18.7277 21.1994C18.6384 21.399 18.4983 21.5717 18.3214 21.7002C18.1444 21.8288 17.9369 21.9086 17.7195 21.9319C17.502 21.9551 17.2823 21.9209 17.0822 21.8327L12.0002 19.5927L6.91823 21.8327C6.71815 21.9209 6.49842 21.9551 6.28098 21.9319C6.06355 21.9086 5.85601 21.8288 5.6791 21.7002C5.50219 21.5717 5.36209 21.399 5.2728 21.1994C5.1835 20.9998 5.14814 20.7802 5.17023 20.5627L5.73023 15.0377L2.03023 10.8977C1.88446 10.7347 1.78398 10.5363 1.73884 10.3224C1.6937 10.1085 1.70547 9.88641 1.77297 9.67844C1.84048 9.47046 1.96135 9.28383 2.12354 9.13718C2.28572 8.99053 2.48353 8.88898 2.69723 8.84268L8.12523 7.66668L10.9202 2.86868ZM12.0002 4.98768L9.68723 8.95968C9.59977 9.1096 9.48205 9.23967 9.34156 9.34159C9.20107 9.44352 9.04089 9.51506 8.87123 9.55168L4.37923 10.5247L7.44123 13.9517C7.67523 14.2137 7.78823 14.5617 7.75323 14.9107L7.29023 19.4837L11.4962 17.6297C11.655 17.5597 11.8267 17.5236 12.0002 17.5236C12.1738 17.5236 12.3454 17.5597 12.5042 17.6297L16.7102 19.4837L16.2472 14.9107C16.2296 14.738 16.2482 14.5635 16.3018 14.3984C16.3553 14.2333 16.4426 14.0812 16.5582 13.9517L19.6212 10.5247L15.1292 9.55168C14.9596 9.51506 14.7994 9.44352 14.6589 9.34159C14.5184 9.23967 14.4007 9.1096 14.3132 8.95968L12.0002 4.98768Z"
      fill="#8D99A5"
    />
  </svg>
);
const WcIconReg = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
  >
    <g clipPath="url(#wc_clip_reg)">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8.25146 3.94922C9.26311 3.94922 10.2514 4.25297 11.0884 4.82129C11.9253 5.38966 12.5727 6.19632 12.9458 7.13672C13.3188 8.07708 13.4008 9.10816 13.1811 10.0957C12.9615 11.0832 12.4498 11.9822 11.7134 12.6758L11.5024 12.874L11.7632 13.001C13.0577 13.6314 14.1588 14.596 14.9565 15.7949C15.7542 16.9937 16.2179 18.3837 16.2993 19.8213C16.3062 19.9425 16.2895 20.064 16.2495 20.1787C16.2095 20.2934 16.1477 20.3996 16.0669 20.4902C15.9862 20.5808 15.888 20.6542 15.7788 20.707C15.6695 20.7598 15.5504 20.7908 15.4292 20.7978C15.3079 20.8048 15.1855 20.788 15.0708 20.748C14.9562 20.708 14.8509 20.6452 14.7602 20.5644C14.6696 20.4836 14.5953 20.3858 14.5425 20.2764C14.4897 20.167 14.4586 20.048 14.4517 19.9267C14.3654 18.3402 13.675 16.8471 12.522 15.7539C11.3686 14.6605 9.83974 14.0501 8.25048 14.0488C6.66131 14.0501 5.13328 14.6606 3.97997 15.7539C2.82684 16.8471 2.13553 18.3402 2.04931 19.9267C2.04243 20.0479 2.01213 20.167 1.95946 20.2764C1.90668 20.3858 1.83234 20.4845 1.74169 20.5654C1.65119 20.6461 1.5456 20.708 1.43114 20.748C1.31654 20.7881 1.19492 20.8056 1.07372 20.7988C0.952459 20.7919 0.833519 20.7607 0.724112 20.708C0.614663 20.6552 0.515967 20.5819 0.435049 20.4912C0.354161 20.4006 0.292489 20.2944 0.252432 20.1797C0.212391 20.065 0.194769 19.9435 0.201651 19.8223C0.282853 18.3844 0.746739 16.994 1.54442 15.7949C2.34207 14.596 3.44506 13.6315 4.73974 13.001L5.00048 12.874L4.78954 12.6758C4.05307 11.9822 3.54145 11.0832 3.32177 10.0957C3.10213 9.10818 3.18408 8.07707 3.55712 7.13672C3.93022 6.19632 4.57758 5.38966 5.41454 4.82129C6.25148 4.25294 7.23979 3.94923 8.25146 3.94922ZM8.25536 5.79883C7.82934 5.78919 7.4057 5.86518 7.00927 6.02148C6.61274 6.17788 6.25062 6.41202 5.94579 6.70996C5.64111 7.00784 5.39924 7.36412 5.23388 7.75683C5.0686 8.14947 4.98306 8.57106 4.9829 8.99707C4.98279 9.42319 5.06778 9.84545 5.2329 10.2383C5.39806 10.6311 5.6403 10.9871 5.94482 11.2852C6.24949 11.5832 6.61088 11.818 7.00732 11.9746C7.40367 12.1312 7.82736 12.2066 8.25341 12.1973C9.08944 12.1788 9.88536 11.834 10.4702 11.2363C11.0551 10.6385 11.3831 9.83532 11.3833 8.99902C11.3835 8.16273 11.0557 7.35978 10.4712 6.76172C9.88664 6.16366 9.09142 5.81774 8.25536 5.79883Z"
        fill="#8D99A5"
      />
      <path
        d="M18.8755 0.199219C19.1207 0.199219 19.3563 0.296351 19.5298 0.469726C19.7032 0.643198 19.8013 0.878698 19.8013 1.12402V3.19922H21.8755C22.1207 3.19922 22.3563 3.29635 22.5298 3.46972C22.7032 3.6432 22.8013 3.8787 22.8013 4.12402C22.8013 4.36935 22.7032 4.60485 22.5298 4.77832C22.3563 4.95169 22.1207 5.04883 21.8755 5.04883H19.8013V7.12402C19.8013 7.36935 19.7032 7.60485 19.5298 7.77832C19.3563 7.95169 19.1207 8.04882 18.8755 8.04882C18.6304 8.04874 18.3955 7.95151 18.2222 7.77832C18.0487 7.60485 17.9507 7.36935 17.9507 7.12402V5.04883H15.8755C15.6304 5.04874 15.3955 4.95151 15.2222 4.77832C15.0487 4.60485 14.9507 4.36935 14.9507 4.12402C14.9507 3.8787 15.0487 3.6432 15.2222 3.46972C15.3955 3.29654 15.6304 3.1993 15.8755 3.19922H17.9507V1.12402C17.9507 0.878698 18.0487 0.643198 18.2222 0.469726C18.3955 0.296536 18.6304 0.1993 18.8755 0.199219Z"
        fill="#8D99A5"
      />
    </g>
    <defs>
      <clipPath id="wc_clip_reg">
        <rect width="24" height="24" fill="white" />
      </clipPath>
    </defs>
  </svg>
);
const WcIconNew = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
  >
    <path
      d="M14.0062 9.94665C13.2538 10.699 12.2333 11.1217 11.1693 11.1217C10.1052 11.1217 9.08473 10.699 8.33233 9.94665C7.57992 9.19424 7.15723 8.17376 7.15723 7.1097C7.15723 6.04564 7.57992 5.02516 8.33233 4.27276C9.08473 3.52035 10.1052 3.09766 11.1693 3.09766C12.2333 3.09766 13.2538 3.52035 14.0062 4.27276C14.7586 5.02516 15.1813 6.04564 15.1813 7.1097C15.1813 8.17376 14.7586 9.19424 14.0062 9.94665Z"
      stroke="#8D99A5"
      strokeWidth="1.875"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M4.14844 19.1447V18.1417C4.14819 16.9571 4.44767 15.7917 5.01899 14.754C5.5903 13.7163 6.41489 12.84 7.41598 12.2067C8.41707 11.5734 9.56212 11.2037 10.7445 11.132C11.9269 11.0603 13.1083 11.2889 14.1785 11.7966M15.8185 15.5489L16.8606 13.3393C16.8888 13.2761 16.9347 13.2224 16.9927 13.1848C17.0507 13.1472 17.1184 13.1271 17.1876 13.1271C17.2567 13.1271 17.3244 13.1472 17.3825 13.1848C17.4405 13.2224 17.4864 13.2761 17.5146 13.3393L18.5577 15.5489L20.8877 15.906C21.1866 15.9511 21.3049 16.3362 21.0883 16.5569L19.4032 18.2751L19.8004 20.7034C19.8516 21.0153 19.5396 21.253 19.2718 21.1056L17.1876 19.9591L15.1033 21.1056C14.8355 21.253 14.5236 21.0153 14.5747 20.7044L14.9719 18.2751L13.2869 16.5569C13.0702 16.3362 13.1886 15.9511 13.4875 15.905L15.8185 15.5489Z"
      stroke="#8D99A5"
      strokeWidth="1.875"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
const WcIconHope = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
  >
    <g clipPath="url(#wc_clip_hope)">
      <path
        d="M16.5004 6.14908C17.3428 6.14971 18.1672 6.39479 18.873 6.85464C19.5787 7.31453 20.1357 7.9696 20.4765 8.7399C20.8173 9.51027 20.9273 10.3634 20.7929 11.195C20.6584 12.0265 20.2853 12.8012 19.7192 13.425L19.5859 13.5719L19.7636 13.6603C20.6588 14.1038 21.4545 14.7253 22.1015 15.4865C22.7484 16.2477 23.2334 17.1331 23.5268 18.088L23.5273 18.089C23.5787 18.2528 23.5859 18.4274 23.5483 18.5949C23.5105 18.7624 23.4292 18.9172 23.3124 19.0431C23.1957 19.169 23.0474 19.2615 22.8832 19.3117C22.719 19.3619 22.5441 19.3679 22.3769 19.3288C22.2097 19.2901 22.0554 19.2077 21.9301 19.0905C21.8048 18.9732 21.7126 18.8246 21.663 18.6603L21.6625 18.6593C21.3856 17.7652 20.8815 16.9578 20.1996 16.3166C19.5178 15.6753 18.6813 15.2217 17.7719 15.0002C17.559 14.9488 17.3692 14.8271 17.2338 14.6549C17.0985 14.4828 17.025 14.2699 17.0253 14.0509V13.5226C17.0253 13.3412 17.0758 13.1632 17.1713 13.0089C17.2668 12.8547 17.4039 12.7299 17.5663 12.6491C18.0511 12.4087 18.4406 12.0112 18.6713 11.5216C18.9019 11.032 18.9602 10.4787 18.8368 9.95181C18.7134 9.42479 18.4153 8.95463 17.9911 8.61832C17.567 8.28208 17.0416 8.09884 16.5004 8.09878C16.2418 8.09878 15.9938 7.99599 15.8109 7.81314C15.6282 7.6303 15.5253 7.38222 15.5253 7.12369C15.5254 6.86523 15.6282 6.61699 15.8109 6.43423C15.9938 6.25155 16.2419 6.14908 16.5004 6.14908Z"
        fill="#8D99A5"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7.8085 3.16763C8.65047 3.09443 9.49753 3.23132 10.2733 3.56656C11.0493 3.90189 11.7301 4.42502 12.2538 5.08853C12.7775 5.75203 13.1279 6.53576 13.2738 7.36831C13.4196 8.20079 13.3561 9.05663 13.0893 9.85855C12.8223 10.6606 12.3602 11.3839 11.7445 11.963L11.5858 12.1125L11.7816 12.2072C12.955 12.7768 13.974 13.6211 14.7519 14.6681C15.5296 15.715 16.0433 16.9342 16.2499 18.2218C16.27 18.3483 16.2651 18.4777 16.2353 18.6022C16.2054 18.7267 16.1513 18.8443 16.0761 18.9479C16.0009 19.0514 15.9059 19.1393 15.7968 19.2062C15.6876 19.2731 15.5658 19.318 15.4394 19.338C15.313 19.3581 15.1839 19.3527 15.0595 19.3229C14.935 19.293 14.8174 19.239 14.7138 19.1637C14.6102 19.0885 14.5219 18.9936 14.455 18.8844C14.3881 18.7753 14.3437 18.6539 14.3236 18.5275C14.093 17.0829 13.3546 15.767 12.2416 14.8175C11.1286 13.8681 9.71335 13.3464 8.2504 13.3463C6.78747 13.3463 5.37223 13.8682 4.25918 14.8175C3.14619 15.767 2.40783 17.0824 2.17715 18.527C2.15702 18.6535 2.11228 18.7753 2.04532 18.8844C1.97832 18.9935 1.89016 19.0885 1.78653 19.1637C1.68291 19.2389 1.56529 19.2926 1.44082 19.3224C1.31625 19.3522 1.18694 19.3572 1.06045 19.3371C0.933986 19.3169 0.812659 19.2722 0.703517 19.2052C0.594371 19.1382 0.499417 19.0501 0.42422 18.9464C0.349064 18.8428 0.294828 18.7253 0.26504 18.6007C0.235287 18.4762 0.230258 18.3468 0.250392 18.2204C0.456277 16.9328 0.970098 15.7137 1.74795 14.6671C2.52586 13.6206 3.54502 12.777 4.71866 12.2086L4.91495 12.1139L4.75625 11.9645C4.24926 11.4876 3.8449 10.912 3.56875 10.2731C3.29264 9.63411 3.15018 8.94478 3.1503 8.24869C3.15025 7.40348 3.36043 6.57122 3.76162 5.8273C4.16287 5.0834 4.74283 4.45073 5.44913 3.98648C6.15548 3.52223 6.96642 3.24089 7.8085 3.16763ZM8.25381 5.09878C7.83441 5.0893 7.41703 5.16364 7.02676 5.31753C6.63655 5.47144 6.28087 5.70211 5.98086 5.99527C5.68086 6.28849 5.44203 6.63893 5.2792 7.02554C5.11641 7.41216 5.03276 7.82772 5.03262 8.24722C5.03252 8.66671 5.11616 9.0822 5.27872 9.4689C5.44132 9.85562 5.67956 10.2063 5.9794 10.4997C6.27931 10.7931 6.63506 11.0237 7.0253 11.1779C7.41553 11.332 7.83288 11.4064 8.25235 11.3971C9.07528 11.3788 9.85834 11.0392 10.434 10.4508C11.0096 9.86241 11.3322 9.07184 11.3324 8.24869C11.3325 7.4256 11.0103 6.63517 10.435 6.04654C9.85959 5.4579 9.07674 5.11744 8.25381 5.09878Z"
        fill="#8D99A5"
      />
    </g>
    <defs>
      <clipPath id="wc_clip_hope">
        <rect width="24" height="24" fill="white" />
      </clipPath>
    </defs>
  </svg>
);
const WcIconRank = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M18.7496 1.58594C18.9826 1.58594 19.2059 1.67857 19.3707 1.84333C19.5354 2.0081 19.6281 2.23141 19.6281 2.46443V3.83594H21.7496C22.1815 3.83594 22.5955 4.00764 22.9009 4.31306C23.2064 4.61847 23.3781 5.0325 23.3781 5.46443V6.96443C23.3781 7.99309 22.9696 8.97966 22.2422 9.70703C21.5148 10.4344 20.5282 10.8429 19.4996 10.8429H19.2238C18.2935 13.6156 15.8415 15.6928 12.8781 16.0389V20.6574H15.4282C15.6612 20.6574 15.8845 20.75 16.0492 20.9148C16.214 21.0795 16.3066 21.3028 16.3066 21.5359C16.3066 21.7689 16.214 21.9922 16.0492 22.1569C15.8845 22.3217 15.6612 22.4143 15.4282 22.4143H8.57101C8.338 22.4143 8.11468 22.3217 7.94992 22.1569C7.78515 21.9922 7.69252 21.7689 7.69252 21.5359C7.69252 21.3028 7.78515 21.0795 7.94992 20.9148C8.11468 20.75 8.338 20.6574 8.57101 20.6574H11.1211V16.0419C9.67804 15.8736 8.31179 15.2986 7.18359 14.3807C6.0498 13.4583 5.20612 12.23 4.74944 10.8429H4.49958C3.9903 10.8429 3.486 10.7427 3.01549 10.5479C2.54492 10.3529 2.11713 10.0672 1.75698 9.70703C1.0296 8.97966 0.621094 7.99309 0.621094 6.96443V5.46443C0.621094 5.0325 0.792798 4.61847 1.09821 4.31306C1.40363 4.00764 1.81766 3.83594 2.24958 3.83594H4.37109V2.46443C4.37109 2.23141 4.46372 2.0081 4.62849 1.84333C4.79325 1.67857 5.01657 1.58594 5.24958 1.58594H18.7496ZM6.12807 8.46442C6.12807 10.0216 6.74669 11.5151 7.8478 12.6162C8.9487 13.7171 10.4418 14.3353 11.9987 14.3355C15.2089 14.3116 17.8711 11.6396 17.8711 8.37988V3.34291H6.12807V8.46442ZM2.37807 6.96443C2.37807 7.52706 2.60174 8.06658 2.99958 8.46442C3.37289 8.83774 3.87093 9.05774 4.39579 9.08343C4.37946 8.8771 4.37109 8.67078 4.37109 8.46442V5.59291H2.37807V6.96443ZM19.6281 8.3803C19.6277 8.61511 19.6157 8.84966 19.5942 9.08343C20.1224 9.05987 20.6241 8.83992 20.9996 8.46442C21.3974 8.06658 21.6211 7.52706 21.6211 6.96443V5.59291H19.6281V8.3803Z"
      fill="#8D99A5"
    />
  </svg>
);

// 업무 센터(default) 상단 통계 카드
type WcStat = {
  title: string;
  value: string;
  sub?: string;
  icon: ReactNode;
  progress: number | null; // null이면 막대 대신 footer 텍스트
  footer?: string;
};

const WcIconCalendar = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="12"
    height="13"
    viewBox="0 0 12 13"
    fill="none"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M8.15039 0C8.50915 0.000264098 8.80078 0.291568 8.80078 0.650391V1H10.6504C10.9994 1 11.3342 1.13902 11.5811 1.38574C11.828 1.63267 11.9668 1.96818 11.9668 2.31738V10.9834C11.9668 11.3325 11.8279 11.6672 11.5811 11.9141C11.3341 12.161 10.9996 12.2998 10.6504 12.2998H1.31738C0.968182 12.2998 0.632666 12.161 0.385742 11.9141C0.139099 11.6672 1.26168e-07 11.3324 0 10.9834V2.31738C0 1.96818 0.13882 1.63266 0.385742 1.38574C0.632665 1.13882 0.968181 1 1.31738 1H3.16699V0.650391C3.16699 0.291406 3.4584 0 3.81738 0C4.17614 0.000264098 4.46777 0.291568 4.46777 0.650391V1H7.50098V0.650391C7.50098 0.291514 7.79155 0.000175843 8.15039 0ZM1.30078 10.9834C1.30078 10.9878 1.30262 10.992 1.30566 10.9951C1.30877 10.9981 1.31304 11 1.31738 11H10.6504C10.6548 11 10.659 10.9982 10.6621 10.9951C10.6652 10.992 10.667 10.9878 10.667 10.9834V5.63379H1.30078V10.9834ZM1.30566 2.30566C1.30254 2.30879 1.30078 2.31296 1.30078 2.31738V4.33301H10.667V2.31738C10.667 2.31304 10.6651 2.30877 10.6621 2.30566C10.659 2.30254 10.6548 2.30078 10.6504 2.30078H8.80078V2.65039C8.80078 3.00921 8.50915 3.30052 8.15039 3.30078C7.79155 3.30061 7.50098 3.00927 7.50098 2.65039V2.30078H4.46777V2.65039C4.46777 3.00921 4.17614 3.30052 3.81738 3.30078C3.4584 3.30078 3.16699 3.00938 3.16699 2.65039V2.30078H1.31738C1.31296 2.30078 1.30879 2.30254 1.30566 2.30566Z"
      fill="#8D99A5"
    />
  </svg>
);

const WcIconArrow = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
  >
    <path
      d="M1.4033 7.10361H12.3215L8.27595 3.25072C7.90793 2.90023 7.90793 2.33211 8.27595 1.98162C8.64397 1.63113 9.2405 1.63113 9.60851 1.98162L15.2627 7.36655L15.3271 7.43491C15.629 7.78742 15.6077 8.30707 15.2627 8.63565L9.60851 14.0206C9.2405 14.3711 8.64397 14.3711 8.27595 14.0206C7.90793 13.6701 7.90793 13.102 8.27595 12.7515L12.3215 8.89859L1.4033 8.89859C0.882849 8.89859 0.460937 8.49677 0.460938 8.0011C0.460938 7.50543 0.882849 7.10361 1.4033 7.10361Z"
      fill="white"
    />
  </svg>
);

// ── 업무 센터(default) — 상담 목록 (현재는 목업 데이터) ──────────────
const WC_CONSULT_STATUS_COLORS: Record<string, { bg: string; color: string }> =
  {
    상담대기: { bg: "#EBF3FE", color: "#3182F6" },
    상담중: { bg: "#FFF8E6", color: "#D97706" },
    "부재중/추후통화": { bg: "#F3F4F6", color: "#6B7684" },
    장기가망: { bg: "#F4F0FF", color: "#7C3AED" },
    보류: { bg: "#F3F4F6", color: "#6B7684" },
    등록대기: { bg: "#FEF3C7", color: "#B45309" },
    등록완료: { bg: "#DCFCE7", color: "#16A34A" },
    "상담완료-높음": { bg: "#DCFCE7", color: "#16A34A" },
    "상담완료-중간": { bg: "#DCFCE7", color: "#16A34A" },
    "상담완료-낮음": { bg: "#DCFCE7", color: "#16A34A" },
    수신거부: { bg: "#FEE2E2", color: "#DC2626" },
    지인등록: { bg: "#DCFCE7", color: "#16A34A" },
  };

// 배지에 짧게 표시
function consultStatusShort(s: string): string {
  if (!s) return "-";
  if (s.startsWith("부재중")) return "부재중";
  if (s.startsWith("상담완료")) return "상담완료";
  return s;
}

type HakItem = HakjeomConsultation & { latest_memo?: string | null };

function ConsultationList({
  userName,
  refreshKey,
}: {
  userName: string;
  refreshKey: number;
}) {
  const [tab, setTab] = useState<"today" | "hope" | "all">("today");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<HakItem[]>([]);
  const [detailItem, setDetailItem] = useState<HakItem | null>(null);

  // ── 문의 추가 모달 (문의 DB의 +추가 와 동일) ───────────────────
  const [showAddModal, setShowAddModal] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const [customCafes, setCustomCafes] = useState<string[]>([]);
  const [customDanggeun, setCustomDanggeun] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/hakjeom/custom-sources")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setCustomCafes(Array.isArray(data.cafes) ? data.cafes : []);
        setCustomDanggeun(Array.isArray(data.danggeun) ? data.danggeun : []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const handleAddCafe = async (name: string) => {
    await fetch("/api/hakjeom/custom-sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "mamcafe", name }),
    });
    setCustomCafes((prev) => [...prev, name]);
  };
  const handleDeleteCafe = async (name: string) => {
    await fetch("/api/hakjeom/custom-sources", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "mamcafe", name }),
    });
    setCustomCafes((prev) => prev.filter((c) => c !== name));
  };
  const handleAddDanggeun = async (name: string) => {
    await fetch("/api/hakjeom/custom-sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "danggeun", name }),
    });
    setCustomDanggeun((prev) => [...prev, name]);
  };
  const handleDeleteDanggeun = async (name: string) => {
    await fetch("/api/hakjeom/custom-sources", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "danggeun", name }),
    });
    setCustomDanggeun((prev) => prev.filter((c) => c !== name));
  };

  // ── 등록일(created_at) 기간 범위 필터 ──────────────────────
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const dateRangeRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 팝오버 닫기
  useEffect(() => {
    if (!dateRangeOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        dateRangeRef.current &&
        !dateRangeRef.current.contains(e.target as Node)
      ) {
        setDateRangeOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dateRangeOpen]);

  const ymd = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  const dateRangeValue: DateRange | undefined =
    startDate || endDate
      ? {
          from: startDate ? new Date(startDate + "T00:00:00") : undefined,
          to: endDate ? new Date(endDate + "T00:00:00") : undefined,
        }
      : undefined;
  const dateRangeLabel = (() => {
    if (startDate && endDate) return `${startDate} ~ ${endDate}`;
    if (startDate) return `${startDate} ~`;
    if (endDate) return `~ ${endDate}`;
    return "기간 선택";
  })();

  // 본인 담당(manager) 문의 조회
  // 주의: userName(본인 이름)이 확정되기 전에는 조회/표시하지 않는다.
  //  - 과거엔 `!userName || ...` 로 인해 이름 로딩 전 전체(타인) 데이터가 잠깐 노출되는 버그가 있었음
  useEffect(() => {
    // 본인 이름 확정 전에는 조회하지 않음 (items 초기값이 [] 이라 아무것도 안 보임)
    if (!userName) return;
    let cancelled = false;
    fetch("/api/hakjeom", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => {
        if (cancelled) return;
        const arr = (
          Array.isArray(list) ? list : (list?.data ?? list?.items ?? [])
        ) as HakItem[];
        // 정확히 본인 담당분만 (빈 이름 fallback 제거 → 타인 데이터 노출 방지)
        const mine = arr.filter((i) => i.manager === userName);
        setItems(mine);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userName, refreshKey, reloadTick]);

  // 상세 모달 저장 → 목록/모달 동기화
  const handleDetailUpdate = async (
    id: number,
    fields: Partial<HakjeomConsultation>,
  ) => {
    try {
      await fetch("/api/hakjeom", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...fields }),
      });
    } catch {
      // 무시 — UI는 낙관적 갱신
    }
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, ...fields } : i)),
    );
    setDetailItem((prev) =>
      prev && prev.id === id ? { ...prev, ...fields } : prev,
    );
  };

  const todayIso = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  // 탭1 오늘 연락 예정 = 신규 배정(상담대기) / 탭2 오늘 가망관리 = 연락예정일이 오늘 / 탭3 전체
  // 등록일(created_at) 기간 범위 적용 — 탭/카운트 모두 이 결과 기준
  const rangedItems = useMemo(() => {
    if (!startDate && !endDate) return items;
    return items.filter((i) => {
      const created = i.created_at?.slice(0, 10);
      if (!created) return false;
      if (startDate && created < startDate) return false;
      if (endDate && created > endDate) return false;
      return true;
    });
  }, [items, startDate, endDate]);

  const todayList = useMemo(
    () => rangedItems.filter((i) => (i.status ?? "") === "상담대기"),
    [rangedItems],
  );
  const hopeList = useMemo(
    () =>
      rangedItems.filter(
        (i) => i.contact_scheduled_at?.slice(0, 10) === todayIso,
      ),
    [rangedItems, todayIso],
  );

  const base =
    tab === "today" ? todayList : tab === "hope" ? hopeList : rangedItems;
  const rows = base.filter(
    (i) => !query.trim() || (i.name ?? "").includes(query.trim()),
  );

  const tabs = [
    { key: "today" as const, label: "오늘 신규 문의", count: todayList.length },
    { key: "hope" as const, label: "오늘 가망관리", count: hopeList.length },
    { key: "all" as const, label: "전체", count: rangedItems.length },
  ];

  return (
    <>
      <div className={styles.wcConsult}>
        <div className={styles.wcConsultInner}>
          {/* 헤더 — 제목 + 기간 필터 + 검색 (space-between) */}
          <div className={styles.wcConsultHead}>
            <span className={styles.wcConsultTitle}>상담 목록</span>
            <div className={styles.wcConsultHeadRight}>
              <div ref={dateRangeRef} className={styles.wcDateRangeWrap}>
                <button
                  type="button"
                  className={`${styles.wcDateRangeBtn} ${startDate || endDate ? styles.wcDateRangeBtnActive : ""}`}
                  onClick={() => setDateRangeOpen((v) => !v)}
                  title="등록일 기간으로 필터"
                >
                  {dateRangeLabel}
                </button>
                {dateRangeOpen && (
                  <div className={styles.wcDateRangePopover}>
                    <DateRangeCalendar
                      variant="month"
                      value={dateRangeValue}
                      onChange={(r) => {
                        setStartDate(r?.from ? ymd(r.from) : "");
                        setEndDate(r?.to ? ymd(r.to) : "");
                      }}
                      onConfirm={() => setDateRangeOpen(false)}
                      onReset={() => {
                        setStartDate("");
                        setEndDate("");
                      }}
                    />
                  </div>
                )}
              </div>
              <input
                className={styles.wcConsultSearch}
                placeholder="이름 검색"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button
                type="button"
                className={styles.wcConsultAddBtn}
                onClick={() => setShowAddModal(true)}
                disabled={!userName}
                title={!userName ? "사용자 정보를 불러오는 중입니다" : undefined}
              >
                <Plus size={14} /> 추가
              </button>
            </div>
          </div>

          {/* 탭 */}
          <div className={styles.wcConsultTabs}>
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`${styles.wcConsultTab} ${tab === t.key ? styles.wcConsultTabOn : ""}`}
                onClick={() => setTab(t.key)}
              >
                {t.label} ({t.count})
              </button>
            ))}
          </div>

          {/* 리스트 */}
          <div className={styles.wcConsultList}>
            {rows.length === 0 &&
              (() => {
                let title: string;
                let desc: string;
                if (query.trim()) {
                  title = `'${query.trim()}' 검색 결과가 없어요`;
                  desc = "다른 이름으로 다시 검색해 보세요.";
                } else if (startDate || endDate) {
                  title = "선택한 기간에 상담이 없어요";
                  desc = "기간을 바꾸거나 초기화해 보세요.";
                } else if (tab === "today") {
                  title = "오늘 연락할 상담이 없어요";
                  desc = "신규로 배정된 상담이 들어오면 여기에 표시돼요.";
                } else if (tab === "hope") {
                  title = "오늘 가망 관리할 상담이 없어요";
                  desc = "연락 예정일이 오늘인 상담이 여기에 모여요.";
                } else {
                  title = "아직 담당 상담이 없어요";
                  desc = "상담이 배정되면 이 목록에 표시됩니다.";
                }
                return (
                  <div className={styles.wcConsultEmpty}>
                    <div className={styles.wcConsultEmptyIcon}>
                      <Inbox size={26} strokeWidth={1.5} />
                    </div>
                    <p className={styles.wcConsultEmptyTitle}>{title}</p>
                    <p className={styles.wcConsultEmptyDesc}>{desc}</p>
                  </div>
                );
              })()}
            {rows.map((r) => {
              const status = r.status ?? "";
              const c = WC_CONSULT_STATUS_COLORS[status] ?? {
                bg: "#F3F4F6",
                color: "#6B7684",
              };
              const course = r.hope_course || r.education || "";
              const memo = r.latest_memo || r.memo || r.reason || "";
              const dateStr = r.created_at
                ? `${r.created_at.slice(0, 10).replace(/-/g, ". ")}. 등록`
                : "";
              return (
                <div
                  key={r.id}
                  className={styles.wcConsultRow}
                  onClick={() => setDetailItem(r)}
                >
                  <span
                    className={styles.wcConsultBadge}
                    style={{ background: c.bg, color: c.color }}
                  >
                    {consultStatusShort(status)}
                  </span>
                  <div className={styles.wcConsultWho}>
                    <span className={styles.wcConsultName}>{r.name}</span>
                    <span className={styles.wcConsultCourse}>{course}</span>
                  </div>
                  <span className={styles.wcConsultMemo}>{memo}</span>
                  <span className={styles.wcConsultDate}>{dateStr}</span>
                  <div
                    className={styles.wcConsultActionWrap}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DateInput
                      value={
                        r.contact_scheduled_at
                          ? r.contact_scheduled_at.slice(0, 10)
                          : ""
                      }
                      onChange={(d) =>
                        handleDetailUpdate(r.id, {
                          contact_scheduled_at: d ? d + "T00:00:00.000Z" : null,
                        })
                      }
                      variant="button"
                      align="right"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {detailItem && (
        <HakjeomDetailPanel
          item={detailItem}
          onClose={() => setDetailItem(null)}
          onUpdate={handleDetailUpdate}
          customCafes={[]}
          customDanggeun={[]}
          onAddCafe={async () => {}}
          onDeleteCafe={async () => {}}
          onAddDanggeun={async () => {}}
          onDeleteDanggeun={async () => {}}
        />
      )}

      {showAddModal && (
        <HakjeomAddModal
          onClose={() => setShowAddModal(false)}
          onSaved={() => {
            setShowAddModal(false);
            setReloadTick((t) => t + 1);
          }}
          fixedManager={userName}
          customCafes={customCafes}
          customDanggeun={customDanggeun}
          onAddCafe={handleAddCafe}
          onDeleteCafe={handleDeleteCafe}
          onAddDanggeun={handleAddDanggeun}
          onDeleteDanggeun={handleDeleteDanggeun}
        />
      )}
    </>
  );
}

// 주어진 날짜가 속한 주의 월요일을 YYYY-MM-DD 로 반환 (KST 로컬, 월~일 기준)
function weekMondayOf(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  const dow = d.getDay(); // 0=일, 1=월, ...
  // 월요일까지 빼야 할 일수: 일요일(0) 이면 -6, 월요일(1) 이면 0, 화요일(2) 이면 -1 ...
  const offset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(d);
  monday.setDate(d.getDate() + offset);
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, "0");
  const dd = String(monday.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

// 학사팀 이번주 목표 날짜 — YYYY-MM-DD → "-MM.DD(요일)" 포맷, 빈값/비ISO 는 원본 또는 "미정"
function formatGoalDate(value: string): string {
  const v = (value ?? "").trim();
  if (!v) return "미정";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return v; // 자유 입력값(레거시) 그대로
  const d = new Date(`${v}T00:00:00`);
  if (Number.isNaN(d.getTime())) return v;
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `-${mm}.${dd}(${DOW[d.getDay()]})`;
}

function toISODate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatPretty(iso: string) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const dow = DOW[d.getDay()];
  return `${yyyy}.${mm}.${dd} (${dow})`;
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 호버 시 빨간 알약 + "삭제" 라벨 토글되는 삭제 버튼 */
function DeleteButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  if (disabled) return null;
  return (
    <button
      type="button"
      className={styles.journalDeleteBtn}
      onClick={onClick}
      aria-label="삭제"
    >
      <svg
        className={styles.journalDeleteIcon}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M11.3997 5.2666H4.60026V12.6663C4.60026 12.8608 4.67758 13.047 4.8151 13.1846C4.95263 13.3221 5.13884 13.3994 5.33333 13.3994H10.6667C10.8612 13.3994 11.0474 13.3221 11.1849 13.1846C11.3224 13.047 11.3997 12.8608 11.3997 12.6663V5.2666ZM6.06641 11.333V7.33301C6.06641 7.00164 6.3353 6.73275 6.66667 6.73275C6.99804 6.73275 7.26693 7.00164 7.26693 7.33301V11.333C7.26693 11.6644 6.99804 11.9333 6.66667 11.9333C6.3353 11.9333 6.06641 11.6644 6.06641 11.333ZM8.73307 11.333V7.33301C8.73307 7.00164 9.00196 6.73275 9.33333 6.73275C9.6647 6.73275 9.93359 7.00164 9.93359 7.33301V11.333C9.93359 11.6644 9.6647 11.9333 9.33333 11.9333C9.00196 11.9333 8.73307 11.6644 8.73307 11.333ZM5.63737 4.06608H10.3626L9.62956 2.59993H6.37044L5.63737 4.06608ZM12.6003 12.6663C12.6003 13.1791 12.3964 13.671 12.0339 14.0335C11.6713 14.3961 11.1794 14.5999 10.6667 14.5999H5.33333C4.82058 14.5999 4.32872 14.3961 3.96615 14.0335C3.60358 13.671 3.39974 13.1791 3.39974 12.6663V5.2666H2.66667C2.3353 5.2666 2.06641 4.99771 2.06641 4.66634C2.06641 4.33497 2.3353 4.06608 2.66667 4.06608H4.29622L5.46354 1.73145L5.50651 1.65853C5.61749 1.49793 5.80125 1.39941 6 1.39941H10L10.084 1.40527C10.2775 1.43258 10.4475 1.55352 10.5365 1.73145L11.7038 4.06608H13.3333C13.6647 4.06608 13.9336 4.33497 13.9336 4.66634C13.9336 4.99771 13.6647 5.2666 13.3333 5.2666H12.6003V12.6663Z"
          fill="currentColor"
        />
      </svg>
      <span className={styles.journalDeleteLabel}>삭제</span>
    </button>
  );
}

/** 내용 길이에 따라 height 자동 조정되는 textarea */
function AutoSizeTextarea({
  value,
  onChange,
  placeholder,
  className,
  autoFocus,
  onBlur,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  onBlur?: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // value 가 바뀔 때마다 height 재계산 (초기 mount 포함)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  // autoFocus 시 커서를 텍스트 끝으로
  useEffect(() => {
    if (autoFocus && ref.current) {
      const el = ref.current;
      el.focus();
      const len = el.value.length;
      el.setSelectionRange(len, len);
    }
  }, [autoFocus]);

  return (
    <textarea
      ref={ref}
      rows={1}
      className={className}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
    />
  );
}

export default function WorkJournalPage() {
  const today = useMemo(() => toISODate(new Date()), []);
  const [date, setDate] = useState<string>(today);

  const [tasks, setTasks] = useState<Task[]>([]);

  const [morningOpen, setMorningOpen] = useState(true);
  const [afternoonOpen, setAfternoonOpen] = useState(true);

  const [morning, setMorning] = useState<JournalRow[]>([]);
  const [afternoon, setAfternoon] = useState<JournalRow[]>([]);
  const [tomorrow, setTomorrow] = useState<Tomorrow[]>([]);

  // 팀별 업무일지 양식 식별자 — teams.journal_form 기반
  const [journalForm, setJournalForm] = useState<JournalFormType>(
    JOURNAL_FORM_TYPES.DEFAULT,
  );
  const isAcademic = journalForm === JOURNAL_FORM_TYPES.ACADEMIC;
  const isPracticum = journalForm === JOURNAL_FORM_TYPES.PRACTICUM;
  // 미지정(default) 양식 — 새 "업무 센터" 디자인 대상
  const isDefault = !isAcademic && !isPracticum;
  const { startById } = useGuide();

  // 실습팀 — 일일 연계 수치 + 주간(월~금) 합계
  const [practicum, setPracticum] = useState<{
    institution: number;
    eduCenter: number;
  }>({ institution: 0, eduCenter: 0 });
  const [practicumWeek, setPracticumWeek] = useState<{
    days: { date: string; dow: string; total: number }[];
    totals: { institution: number; eduCenter: number; total: number };
  } | null>(null);
  const [practicumRefresh, setPracticumRefresh] = useState(0);
  const practicumDailyTotal = practicum.institution + practicum.eduCenter;
  // 본인 user_id — 주 단위 weekly_goal key 구성에 사용
  const [userId, setUserId] = useState<number | null>(null);
  const [userName, setUserName] = useState<string>("");
  // 업무 센터(default) — 업무일지 작성 드로어 열림 상태
  const [journalDrawerOpen, setJournalDrawerOpen] = useState(false);
  const router = useRouter();
  // 업무 센터(default) — 캘린더 팝업 + 본인 연락예정 일정
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calEvents, setCalEvents] = useState<CalendarEvent[]>([]);
  const calToday = useMemo(() => new Date(), []);
  // 화면 포커스/탭 복귀 시 통계·목록 갱신용 (realtime 대신 — 평소 요청 0)
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!isDefault) return;
    const bump = () => setRefreshKey((k) => k + 1);
    const onVis = () => {
      if (document.visibilityState === "visible") bump();
    };
    window.addEventListener("focus", bump);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", bump);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [isDefault]);
  const [weeklyGoal, setWeeklyGoal] = useState<WeeklyGoal[]>([]);
  const [issues, setIssues] = useState<JournalRow[]>([]);
  const [issuesOpen, setIssuesOpen] = useState(true);

  // 학사팀 — 이번주 목표 설정 모달
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [tempGoals, setTempGoals] = useState<WeeklyGoal[]>([]);
  const [goalSaving, setGoalSaving] = useState(false);
  const openGoalModal = () => {
    // 깊은 복사 후 모달에서 편집
    setTempGoals(weeklyGoal.map((g) => ({ ...g })));
    setGoalModalOpen(true);
  };
  const closeGoalModal = () => setGoalModalOpen(false);

  // weeklyGoal 의 영속 key — 그 주의 월요일 기준 (월요일이 바뀌면 새 키 = 자동 리셋)
  const weeklyGoalKey =
    userId != null ? `user.${userId}.weekly_goal.${weekMondayOf(date)}` : null;

  const saveGoalModal = async () => {
    if (!weeklyGoalKey) {
      alert("사용자 정보를 불러오는 중입니다.");
      return;
    }
    // 빈 행 정리
    const cleaned = tempGoals.filter(
      (g) => g.date.trim() !== "" || g.text.trim() !== "",
    );
    setGoalSaving(true);
    try {
      const res = await fetch("/api/app-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: weeklyGoalKey, value: cleaned }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "저장에 실패했습니다.");
        return;
      }
      setWeeklyGoal(cleaned);
      setGoalModalOpen(false);
    } finally {
      setGoalSaving(false);
    }
  };
  const updateTempGoal = (id: string, patch: Partial<WeeklyGoal>) =>
    setTempGoals((prev) =>
      prev.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    );
  const addTempGoal = () =>
    setTempGoals((prev) => [
      ...prev,
      { id: uid(), date: "", text: "", done: false },
    ]);
  const removeTempGoal = (id: string) =>
    setTempGoals((prev) => prev.filter((g) => g.id !== id));

  // 본인 팀 양식 + 사용자 id 조회
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        setJournalForm(normalizeJournalForm(d?.teamJournalForm));
        if (typeof d?.id === "number") setUserId(d.id);
        if (typeof d?.displayName === "string") setUserName(d.displayName);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // 캘린더 팝업용 — 본인 연락예정 일정 조회 (manager == 본인)
  useEffect(() => {
    let cancelled = false;
    fetch("/api/hakjeom?has_scheduled=1", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => {
        if (cancelled) return;
        const items = (
          Array.isArray(list) ? list : (list?.data ?? list?.items ?? [])
        ) as Array<{
          id: number;
          name: string;
          manager: string | null;
          status: string | null;
          contact_scheduled_at: string | null;
        }>;
        const mine = items.filter(
          (i) =>
            i.contact_scheduled_at && (!userName || i.manager === userName),
        );
        setCalEvents(
          mine.map((i) => {
            const meta: string[] = [];
            if (i.manager) meta.push(`담당 ${i.manager}`);
            if (i.status) meta.push(i.status);
            return {
              id: `contact-${i.id}`,
              date: (i.contact_scheduled_at ?? "").slice(0, 10),
              title: i.name,
              where: meta.join(" · "),
              category: "work" as const,
            };
          }),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userName, refreshKey]);

  // 학사팀 — 이번주 목표 fetch (주 단위 key, 월요일 바뀌면 자동 새 키 = 자동 초기화)
  useEffect(() => {
    if (!isAcademic || !weeklyGoalKey) return;
    let cancelled = false;
    fetch(`/api/app-settings?key=${encodeURIComponent(weeklyGoalKey)}`, {
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const v = data?.value;
        if (Array.isArray(v)) {
          // 안전 정규화
          const goals: WeeklyGoal[] = v
            .map((g) => {
              if (!g || typeof g !== "object") return null;
              const o = g as Record<string, unknown>;
              return {
                id: typeof o.id === "string" ? o.id : uid(),
                date: typeof o.date === "string" ? o.date : "",
                text: typeof o.text === "string" ? o.text : "",
                done: Boolean(o.done),
              };
            })
            .filter((g): g is WeeklyGoal => g !== null);
          setWeeklyGoal(goals);
        } else {
          setWeeklyGoal([]);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAcademic, weeklyGoalKey]);

  // 체크 토글도 즉시 저장 (낙관적 UI + persist)
  useEffect(() => {
    if (!isAcademic || !weeklyGoalKey) return;
    // 초기 빈 상태에서 마운트 직후 저장 안 함
    if (weeklyGoal.length === 0) return;
    const t = setTimeout(() => {
      fetch("/api/app-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: weeklyGoalKey, value: weeklyGoal }),
      }).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [isAcademic, weeklyGoalKey, weeklyGoal]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"draft" | "submitted" | null>(null);

  // 제출 완료된 일지의 수정 모드 — true 일 때만 form 편집 가능
  const [isEditing, setIsEditing] = useState(false);
  // 수정 후 저장(저장하기)했지만 아직 "다시 제출" 하지 않은 상태 — 빨간 [다시 제출] 노출
  const [hasEdits, setHasEdits] = useState(false);
  // 수정 시작 시점의 스냅샷 — 취소 시 복원에 사용
  const [snapshot, setSnapshot] = useState<{
    tasks: Task[];
    morning: JournalRow[];
    afternoon: JournalRow[];
    tomorrow: Tomorrow[];
    issues: JournalRow[];
  } | null>(null);

  // status === "submitted" 이면서 편집 중이 아니면 잠금
  const isLocked = status === "submitted" && !isEditing;

  const [stats, setStats] = useState<{
    totalInquiries: number;
    registrations: number;
    registrationRate: number;
    salesThisMonth: number;
    todayScheduledContacts: number;
    todayCompletedNew: number;
    pendingNew: number;
    todayScheduledDone: number;
    rank: number;
    totalManagers: number;
    delta: {
      inquiries: number;
      registrations: number;
      rate: number;
      sales: number;
    };
  } | null>(null);
  // 업무 센터(default) 통계 — 개인 월 매출 목표 / 이번달 매출(만원)
  const [monthlyGoal, setMonthlyGoal] = useState(0);
  const [monthlySales, setMonthlySales] = useState(0);

  // stats (본인 담당자 기준 누적/이번달)
  useEffect(() => {
    let cancelled = false;
    fetch("/api/work-journal/stats", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        setStats({
          totalInquiries: Number(d.totalInquiries ?? 0),
          registrations: Number(d.registrations ?? 0),
          registrationRate: Number(d.registrationRate ?? 0),
          salesThisMonth: Number(d.salesThisMonth ?? 0),
          todayScheduledContacts: Number(d.todayScheduledContacts ?? 0),
          todayCompletedNew: Number(d.todayCompletedNew ?? 0),
          pendingNew: Number(d.pendingNew ?? 0),
          todayScheduledDone: Number(d.todayScheduledDone ?? 0),
          rank: Number(d.rank ?? 0),
          totalManagers: Number(d.totalManagers ?? 0),
          delta: {
            inquiries: Number(d?.delta?.inquiries ?? 0),
            registrations: Number(d?.delta?.registrations ?? 0),
            rate: Number(d?.delta?.rate ?? 0),
            sales: Number(d?.delta?.sales ?? 0),
          },
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  // 개인 월 매출 목표 + 이번달 매출
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const now = new Date();
    const y = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const monthKey = `${y}-${mm}`;
    fetch(`/api/app-settings?key=dashboard.monthly_goal.${userId}.${monthKey}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        const v = d?.value ?? d;
        if (v && typeof v.total === "number") setMonthlyGoal(v.total);
      })
      .catch(() => {});
    fetch(`/api/dashboard/my-monthly-sales?year=${y}&month=${mm}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        if (d && typeof d.total === "number") setMonthlySales(d.total);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId, refreshKey]);

  // 날짜 변경 시 해당 일자 일지 로드
  useEffect(() => {
    let cancelled = false;
    // 날짜가 바뀌면 편집 모드/저장 직후 표시 초기화
    setIsEditing(false);
    setSnapshot(null);
    setHasEdits(false);
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/work-journal?date=${date}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const j = data?.journal;
        const carry = Array.isArray(data?.carryOverTasks)
          ? (data.carryOverTasks as Task[])
          : [];
        if (j) {
          // tasks가 비어있으면 직전 제출 일지의 tomorrow 자동 이월
          const existingTasks = Array.isArray(j.tasks)
            ? (j.tasks as Task[])
            : [];
          setTasks(existingTasks.length > 0 ? existingTasks : carry);
          setMorning(Array.isArray(j.morning) ? j.morning : []);
          setAfternoon(Array.isArray(j.afternoon) ? j.afternoon : []);
          setTomorrow(Array.isArray(j.tomorrow) ? j.tomorrow : []);
          // weeklyGoal 은 별도 app_settings 로 fetch (주 단위 key) — 여기선 처리하지 않음
          setIssues(Array.isArray(j.issues) ? (j.issues as JournalRow[]) : []);
          // 실습팀 — 연계 수치 로드
          {
            const p = (j.practicum ?? {}) as Record<string, unknown>;
            setPracticum({
              institution: Math.max(0, Math.floor(Number(p.institution) || 0)),
              eduCenter: Math.max(0, Math.floor(Number(p.eduCenter) || 0)),
            });
          }
          setStatus(j.status ?? "draft");
        } else {
          // 새 일지 — 이월 데이터로 시작
          setTasks(carry);
          setMorning([]);
          setAfternoon([]);
          setTomorrow([]);
          // weeklyGoal 은 별도 fetch
          setIssues([]);
          setPracticum({ institution: 0, eduCenter: 0 });
          setStatus(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [date]);

  // 실습팀 — 그 주(월~금) 연계 수치 합계 fetch (저장 시 practicumRefresh 증가로 재조회)
  useEffect(() => {
    if (!isPracticum) return;
    let cancelled = false;
    fetch(`/api/work-journal/practicum?date=${date}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        setPracticumWeek(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isPracticum, date, practicumRefresh]);

  // ── 핸들러 ──────────────────────────────────────────────
  const toggleTask = (id: string) =>
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    );

  const updateTaskText = (id: string, text: string) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, text } : t)));
    // 빈 슬롯에서 첫 글자 입력 시 isEmpty 가 false 로 바뀌면서
    // 조건 `isEditing || isEmpty` 가 false 가 되어 textarea 가 div 로 교체되고
    // 커서가 풀리는 문제를 방지하기 위해 editing 상태를 명시적으로 유지한다.
    if (text.length > 0) setEditingTaskId(id);
  };

  const removeTask = (id: string) =>
    setTasks((prev) => prev.filter((t) => t.id !== id));

  // 편집 종료(blur) 시: 텍스트가 비어 있으면 그 줄을 삭제한다.
  // 단, 맨 아래 입력용 빈 슬롯(마지막 항목)은 유지 (effect 가 항상 1개 보장).
  const handleTaskBlur = (id: string) => {
    setEditingTaskId(null);
    setTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      if (idx === -1) return prev;
      if (prev[idx].text.trim() !== "") return prev; // 내용 있으면 유지
      if (idx === prev.length - 1) return prev; // 마지막 입력 슬롯은 유지
      return prev.filter((t) => t.id !== id); // 비워진 줄 삭제
    });
  };

  const pickRowSetter = (section: "morning" | "afternoon" | "issues") => {
    if (section === "morning") return setMorning;
    if (section === "afternoon") return setAfternoon;
    return setIssues;
  };

  const updateRow = (
    section: "morning" | "afternoon" | "issues",
    id: string,
    patch: Partial<JournalRow>,
  ) => {
    const setter = pickRowSetter(section);
    setter((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const addRow = (section: "morning" | "afternoon" | "issues") => {
    const setter = pickRowSetter(section);
    setter((prev) => [...prev, { id: uid(), category: "", detail: "" }]);
  };

  const removeRow = (
    section: "morning" | "afternoon" | "issues",
    id: string,
  ) => {
    const setter = pickRowSetter(section);
    setter((prev) => prev.filter((r) => r.id !== id));
  };

  // ── 학사팀 — 이번주 목표 (체크박스만 카드에서 직접 토글, 나머지는 모달) ──
  const toggleWeeklyGoal = (id: string) =>
    setWeeklyGoal((prev) =>
      prev.map((g) => (g.id === id ? { ...g, done: !g.done } : g)),
    );

  const updateTomorrow = (id: string, text: string) =>
    setTomorrow((prev) => prev.map((t) => (t.id === id ? { ...t, text } : t)));

  const removeTomorrow = (id: string) =>
    setTomorrow((prev) => prev.filter((t) => t.id !== id));

  // ── 자동 빈 슬롯 유지 (오늘의 업무 / 내일 예정 업무) ──
  // 마지막 항목이 비어있지 않으면 자동으로 빈 항목을 끝에 추가
  useEffect(() => {
    if (tasks.length === 0 || tasks[tasks.length - 1].text !== "") {
      setTasks((prev) => [...prev, { id: uid(), text: "", done: false }]);
    }
  }, [tasks]);

  useEffect(() => {
    if (tomorrow.length === 0 || tomorrow[tomorrow.length - 1].text !== "") {
      setTomorrow((prev) => [...prev, { id: uid(), text: "" }]);
    }
  }, [tomorrow]);

  // ── 임시저장(자동) / 제출 (DB) ─────────────────────────
  // silent: 자동 저장 시 alert/완료 메시지 생략
  const persist = async (
    nextStatus: "draft" | "submitted",
    opts?: { silent?: boolean },
  ) => {
    if (saving) return;
    setSaving(true);
    try {
      // 자동으로 추가된 마지막 빈 슬롯은 저장에서 제외
      const cleanedTasks = tasks.filter((t) => t.text.trim() !== "");
      const cleanedTomorrow = tomorrow.filter((t) => t.text.trim() !== "");
      // 학사팀 — 빈 issue 행 제외 (weekly_goal 은 별도 app_settings 로 저장)
      const cleanedIssues = issues.filter(
        (r) => r.category.trim() !== "" || r.detail.trim() !== "",
      );

      const res = await fetch("/api/work-journal", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          tasks: cleanedTasks,
          morning,
          afternoon,
          tomorrow: cleanedTomorrow,
          // 학사팀이면 issues 함께 저장. weekly_goal 은 주 단위 별도 저장(app_settings)
          ...(isAcademic ? { issues: cleanedIssues } : {}),
          // 실습팀이면 연계 수치 함께 저장
          ...(isPracticum ? { practicum } : {}),
          status: nextStatus,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (!opts?.silent) alert(data?.error ?? "저장에 실패했습니다.");
        return;
      }
      setStatus(data?.journal?.status ?? nextStatus);
      // 실습팀 — 주간 합계 재조회
      if (isPracticum) setPracticumRefresh((n) => n + 1);
      if (!opts?.silent) {
        alert(nextStatus === "submitted" ? "제출 완료" : "임시저장 완료");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = () => {
    if (!confirm("업무일지를 제출하시겠습니까?")) return;
    persist("submitted");
  };

  // 자동 저장 — 입력 변경 후 0.6초 debounce 후 draft 저장
  // (로딩 중 / 제출 완료 잠금 상태에서는 저장 안 함)
  useEffect(() => {
    if (loading) return;
    if (status === "submitted" && !isEditing) return;
    const t = setTimeout(() => {
      persist("draft", { silent: true });
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    tasks,
    morning,
    afternoon,
    tomorrow,
    issues,
    practicum,
    status,
    isEditing,
    loading,
  ]);

  // 입력칸에서 포커스가 벗어나면(blur) 즉시 저장 — 0.6초 기다리지 않고 바로 반영
  const handleFieldBlur = () => {
    if (loading || saving) return;
    if (status === "submitted" && !isEditing) return;
    persist("draft", { silent: true });
  };

  // 수정하기 — 잠금 해제 + 현재 상태 스냅샷 (취소 시 복원용)
  const handleEdit = () => {
    setSnapshot({
      tasks: tasks.map((t) => ({ ...t })),
      morning: morning.map((r) => ({ ...r })),
      afternoon: afternoon.map((r) => ({ ...r })),
      tomorrow: tomorrow.map((t) => ({ ...t })),
      issues: issues.map((r) => ({ ...r })),
    });
    setIsEditing(true);
  };

  // 취소 — 스냅샷으로 복원 후 잠금 복귀
  const handleCancel = () => {
    if (snapshot) {
      setTasks(snapshot.tasks);
      setMorning(snapshot.morning);
      setAfternoon(snapshot.afternoon);
      setTomorrow(snapshot.tomorrow);
      setIssues(snapshot.issues);
    }
    setSnapshot(null);
    setIsEditing(false);
  };

  // 저장하기 — 제출 상태 유지하며 저장 후 잠금 복귀, "다시 제출" 노출용 hasEdits=true
  const handleSave = async () => {
    await persist("submitted");
    setSnapshot(null);
    setIsEditing(false);
    setHasEdits(true);
  };

  // 다시 제출 — 변경분을 확정 제출, hasEdits 리셋해서 단일 [수정하기] 로 복귀
  const handleResubmit = async () => {
    if (!confirm("수정한 내용을 다시 제출하시겠습니까?")) return;
    await persist("submitted");
    setHasEdits(false);
  };

  // 오늘의 업무 — 편집 중인 task id (편집 모드에서만 textarea 표시, 그 외엔 div 표시 → 어디서나 드래그 가능)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  // 오늘의 업무 내 순서 변경(reorder) 전용 state
  const draggedTaskIndexRef = useRef<number | null>(null);
  const [dropTaskTarget, setDropTaskTarget] = useState<number | null>(null);

  const handleTaskGripDragStart =
    (index: number, row: HTMLElement | null) => (e: ReactDragEvent) => {
      draggedTaskIndexRef.current = index;
      e.dataTransfer.setData("text/plain", "__task_row__");
      e.dataTransfer.effectAllowed = "all";
      if (row) e.dataTransfer.setDragImage(row, 12, 12);
    };

  const handleTaskItemDragOver = (index: number) => (e: ReactDragEvent) => {
    // task 끼리 reorder 중일 때만 처리
    if (draggedTaskIndexRef.current === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const isAbove = e.clientY - rect.top < rect.height / 2;
    const insertAt = isAbove ? index : index + 1;
    setDropTaskTarget((prev) => (prev === insertAt ? prev : insertAt));
  };

  const handleTaskItemDrop = (e: ReactDragEvent) => {
    const srcIndex = draggedTaskIndexRef.current;
    if (srcIndex === null) return;
    e.preventDefault();
    e.stopPropagation();
    const insertAt = dropTaskTarget ?? -1;
    draggedTaskIndexRef.current = null;
    setDropTaskTarget(null);
    setTasks((prev) => {
      const next = [...prev];
      const [moved] = next.splice(srcIndex, 1);
      const target =
        insertAt < 0
          ? next.length
          : insertAt > srcIndex
            ? insertAt - 1
            : insertAt;
      next.splice(Math.min(target, next.length), 0, moved);
      return next;
    });
  };

  const handleTaskListDragLeave = (e: ReactDragEvent) => {
    const next = e.relatedTarget as Node | null;
    if (
      next &&
      e.currentTarget instanceof Node &&
      e.currentTarget.contains(next)
    )
      return;
    setDropTaskTarget(null);
  };

  // ── 드래그 앤 드롭: 오늘의 업무 → 업무 일지 (복사) ─────────
  // dropTarget: 드롭 시 어느 섹션의 몇 번째 위치에 삽입할지
  const [dropTarget, setDropTarget] = useState<{
    section: "morning" | "afternoon";
    insertAt: number;
  } | null>(null);
  const dragTextRef = useRef<string>("");

  const handleTaskDragStart = (e: ReactDragEvent, text: string) => {
    dragTextRef.current = text;
    e.dataTransfer.setData("text/plain", text);
    e.dataTransfer.effectAllowed = "copy";
    // grip 만 잡아도 행 전체가 미리보기로 따라오도록
    const handle = e.currentTarget as HTMLElement;
    const row = handle.closest(`.${styles.taskItem}`) as HTMLElement | null;
    if (row) e.dataTransfer.setDragImage(row, 12, 12);
  };

  // row 위/아래 절반 기준으로 insertAt 결정
  const handleRowDragOver =
    (section: "morning" | "afternoon", index: number) =>
    (e: ReactDragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // row 끼리 이동(reorder/섹션이동)은 'move', 외부 task 추가는 'copy'
      e.dataTransfer.dropEffect = draggedRowRef.current ? "move" : "copy";
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const isAbove = e.clientY - rect.top < rect.height / 2;
      const insertAt = isAbove ? index : index + 1;
      setDropTarget((prev) =>
        prev && prev.section === section && prev.insertAt === insertAt
          ? prev
          : { section, insertAt },
      );
    };

  // 섹션 전체 dragOver: row 가 없을 때(빈 섹션) 또는 row 사이가 아닌 영역
  const handleSectionDragOver =
    (section: "morning" | "afternoon", total: number) =>
    (e: ReactDragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      // row 가 비어있으면 항상 index 0, 그 외엔 row 핸들러가 이미 setDropTarget 했을 것
      if (total === 0) {
        setDropTarget((prev) =>
          prev && prev.section === section && prev.insertAt === 0
            ? prev
            : { section, insertAt: 0 },
        );
      }
    };

  const handleSectionDragLeave = (e: ReactDragEvent) => {
    const next = e.relatedTarget as Node | null;
    if (
      next &&
      e.currentTarget instanceof Node &&
      e.currentTarget.contains(next)
    ) {
      return;
    }
    setDropTarget(null);
  };

  // 일지 row 드래그 정보를 ref 로 전달 (dataTransfer custom MIME 은 브라우저별 차이 있음)
  const draggedRowRef = useRef<{
    section: "morning" | "afternoon";
    index: number;
    row: JournalRow;
  } | null>(null);

  // 일지 row 드래그 시작 (같은 섹션 내 reorder 또는 다른 섹션으로 이동용)
  const handleJournalRowDragStart =
    (section: "morning" | "afternoon", index: number, row: JournalRow) =>
    (e: ReactDragEvent) => {
      // textarea/input 안에서 시작된 드래그는 텍스트 편집 우선 → 차단
      const target = e.target as HTMLElement;
      if (target.closest("textarea, input")) {
        e.preventDefault();
        return;
      }
      draggedRowRef.current = { section, index, row };
      // Firefox 는 dataTransfer 가 비어있으면 dragstart 가 작동 안 함
      e.dataTransfer.setData("text/plain", "__journal_row__");
      // 'all' 로 두어 dragOver 의 dropEffect 와 mismatch 로 인한 drop 차단 회피
      e.dataTransfer.effectAllowed = "all";
    };

  // dragEnd 에서 ref 를 null 로 만들지 않음 (drop 보다 먼저 호출되는 브라우저 케이스 회피)
  // drop 핸들러에서 사용 직후 null 처리 + 다음 dragStart 가 자연스레 덮어씀

  const handleSectionDrop =
    (section: "morning" | "afternoon") => (e: ReactDragEvent) => {
      e.preventDefault();
      // row에서 drop이 발생한 경우 부모(sectionDropZone)로 버블되어 두 번 호출되는 것을 막음
      e.stopPropagation();
      const insertAt =
        dropTarget?.section === section ? dropTarget.insertAt : -1;
      setDropTarget(null);

      // 1) 일지 row 자체를 옮기는 경우 (reorder 또는 섹션 이동) — ref 로 확인
      const dragged = draggedRowRef.current;
      if (dragged) {
        const { section: srcSection, index: srcIndex, row } = dragged;
        draggedRowRef.current = null;

        if (srcSection === section) {
          // 같은 섹션 내 reorder
          const setter = section === "morning" ? setMorning : setAfternoon;
          setter((prev) => {
            const next = [...prev];
            const [moved] = next.splice(srcIndex, 1);
            const target =
              insertAt < 0
                ? next.length
                : insertAt > srcIndex
                  ? insertAt - 1
                  : insertAt;
            next.splice(Math.min(target, next.length), 0, moved);
            return next;
          });
        } else {
          // 다른 섹션으로 이동 (오전 ↔ 오후)
          const srcSetter =
            srcSection === "morning" ? setMorning : setAfternoon;
          const destSetter = section === "morning" ? setMorning : setAfternoon;
          srcSetter((prev) => prev.filter((_, i) => i !== srcIndex));
          destSetter((prev) => {
            const next = [...prev];
            const target =
              insertAt < 0 || insertAt > next.length ? next.length : insertAt;
            next.splice(target, 0, row);
            return next;
          });
        }
        if (section === "morning") setMorningOpen(true);
        else setAfternoonOpen(true);
        return;
      }

      // 2) 외부(오늘의 업무) 에서 텍스트 추가
      const text =
        dragTextRef.current || e.dataTransfer.getData("text/plain") || "";
      dragTextRef.current = "";
      if (!text.trim()) return;
      const newRow: JournalRow = { id: uid(), category: "", detail: text };
      const setter = section === "morning" ? setMorning : setAfternoon;
      setter((prev) => {
        const idx =
          insertAt < 0 || insertAt > prev.length ? prev.length : insertAt;
        const next = [...prev];
        next.splice(idx, 0, newRow);
        return next;
      });
      if (section === "morning") setMorningOpen(true);
      else setAfternoonOpen(true);
    };

  // ── 카운트 ──────────────────────────────────────────────
  const doneCount = tasks.filter((t) => t.done).length;
  const totalCount = tasks.length;
  // 업무 센터 — 선택 날짜의 요일 (이번주 연락 예정 활성 표시용)
  const todayDow = DOW[new Date(`${date}T00:00:00`).getDay()];

  // 업무 센터(default) 상단 통계 카드 — 실데이터 기반
  const wcStats: WcStat[] = useMemo(() => {
    const achieve =
      monthlyGoal > 0 ? Math.round((monthlySales / monthlyGoal) * 100) : 0;
    const regRate = stats?.registrationRate ?? 0;
    const completedNew = stats?.todayCompletedNew ?? 0;
    const newDenom = completedNew + (stats?.pendingNew ?? 0);
    const scheduled = stats?.todayScheduledContacts ?? 0;
    const scheduledDone = stats?.todayScheduledDone ?? 0;
    const rank = stats?.rank ?? 0;
    const totalMgr = stats?.totalManagers ?? 0;
    return [
      {
        title: "이번달 매출 달성률",
        value: `${achieve}`,
        sub: "%",
        icon: <WcIconStar />,
        progress: achieve,
      },
      {
        title: "이번달 등록률",
        value: regRate.toFixed(1),
        sub: `%(${stats?.registrations ?? 0}건)`,
        icon: <WcIconReg />,
        progress: regRate,
      },
      {
        title: "오늘 신규 상담 완료",
        value: `${completedNew}`,
        sub: `/${newDenom}건`,
        icon: <WcIconNew />,
        progress: newDenom > 0 ? (completedNew / newDenom) * 100 : 0,
      },
      {
        title: "오늘 가망관리",
        value: `${scheduledDone}`,
        sub: `/${scheduled}건`,
        icon: <WcIconHope />,
        progress: scheduled > 0 ? (scheduledDone / scheduled) * 100 : 0,
      },
      {
        title: "현재 실적 순위",
        value: rank > 0 ? `${rank}` : "-",
        sub: "위",
        icon: <WcIconRank />,
        progress: null,
        footer:
          rank > 1
            ? `${rank - 1}위까지 추월 가능`
            : rank === 1
              ? "1위 유지 중!"
              : totalMgr > 0
                ? `전체 ${totalMgr}명`
                : "",
      },
    ];
  }, [monthlyGoal, monthlySales, stats]);

  // 이번주(선택일 포함) 월~금 연락예정 건수 (본인 calEvents 기준)
  const weekContacts = useMemo(() => {
    const base = new Date(`${date}T00:00:00`);
    const dow = base.getDay(); // 0(일)~6(토)
    const monday = new Date(base);
    monday.setDate(base.getDate() - ((dow + 6) % 7)); // 해당 주 월요일
    const labels = ["월", "화", "수", "목", "금"];
    return labels.map((label, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return {
        dow: label,
        count: calEvents.filter((e) => e.date === ymd).length,
      };
    });
  }, [date, calEvents]);

  // 상태별 푸터 버튼 (default=우측 드로어 / 학사·실습=내일 예정 카드 안)
  const footerButtons =
    status === "submitted" && !isEditing ? (
      <>
        <button
          type="button"
          className={styles.btnEdit}
          onClick={handleEdit}
          disabled={saving || loading}
        >
          <svg className={styles.btnIcon} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M13.9997 13.3338C14.3679 13.3338 14.6663 13.6323 14.6663 14.0005C14.6663 14.3686 14.3678 14.6672 13.9997 14.6672H1.99967C1.63154 14.6672 1.3331 14.3686 1.33301 14.0005C1.33301 13.6323 1.63148 13.3338 1.99967 13.3338H13.9997Z" fill="white" />
            <path fillRule="evenodd" clipRule="evenodd" d="M10.9124 1.48357C11.1743 1.27 11.5603 1.28506 11.8044 1.52914L14.471 4.19581C14.7313 4.45616 14.7314 4.87819 14.471 5.13852L7.80436 11.8052C7.67935 11.9302 7.50978 12.0005 7.33301 12.0005H4.66634C4.2982 12.0005 3.99976 11.7019 3.99967 11.3338V8.66716C3.99967 8.49039 4.07001 8.32082 4.19499 8.19581L10.8617 1.52914L10.9124 1.48357ZM5.33301 8.9432V10.6672H7.05697L11.057 6.66716L9.33301 4.9432L5.33301 8.9432ZM10.2757 4.00049L11.9997 5.72445L13.057 4.66716L11.333 2.9432L10.2757 4.00049Z" fill="white" />
          </svg>
          수정하기
        </button>
        {hasEdits && (
          <button
            type="button"
            className={styles.btnResubmit}
            onClick={handleResubmit}
            disabled={saving || loading}
          >
            다시 제출
            <svg className={styles.btnIcon} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M1.4033 7.10263H12.3215L8.27595 3.24975C7.90793 2.89925 7.90793 2.33113 8.27595 1.98064C8.64397 1.63015 9.2405 1.63015 9.60851 1.98064L15.2627 7.36557L15.3271 7.43393C15.629 7.78644 15.6077 8.30609 15.2627 8.63467L9.60851 14.0196C9.2405 14.3701 8.64397 14.3701 8.27595 14.0196C7.90793 13.6691 7.90793 13.101 8.27595 12.7505L12.3215 8.89761L1.4033 8.89761C0.882849 8.89761 0.460937 8.49579 0.460938 8.00012C0.460938 7.50445 0.882849 7.10263 1.4033 7.10263Z" fill="white" />
            </svg>
          </button>
        )}
      </>
    ) : status === "submitted" && isEditing ? (
      <>
        <button type="button" className={styles.btnCancel} onClick={handleCancel} disabled={saving}>
          취소
        </button>
        <button type="button" className={styles.btnSave} onClick={handleSave} disabled={saving}>
          <svg className={styles.btnIcon} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path fillRule="evenodd" clipRule="evenodd" d="M14.3692 3.40738C14.5567 3.59491 14.662 3.84921 14.662 4.11438C14.662 4.37954 14.5567 4.63385 14.3692 4.82138L6.87389 12.3167C6.77484 12.4158 6.65724 12.4944 6.52781 12.548C6.39838 12.6016 6.25966 12.6292 6.11956 12.6292C5.97946 12.6292 5.84074 12.6016 5.71131 12.548C5.58188 12.4944 5.46428 12.4158 5.36523 12.3167L1.64123 8.59338C1.54572 8.50113 1.46953 8.39079 1.41712 8.26878C1.36472 8.14678 1.33713 8.01556 1.33598 7.88278C1.33482 7.75 1.36012 7.61832 1.4104 7.49542C1.46069 7.37253 1.53494 7.26088 1.62883 7.16698C1.72272 7.07309 1.83438 6.99884 1.95727 6.94856C2.08017 6.89828 2.21185 6.87297 2.34463 6.87413C2.47741 6.87528 2.60863 6.90287 2.73063 6.95528C2.85263 7.00769 2.96298 7.08387 3.05523 7.17938L6.11923 10.2434L12.9546 3.40738C13.0474 3.31445 13.1577 3.24073 13.2791 3.19044C13.4004 3.14014 13.5305 3.11426 13.6619 3.11426C13.7933 3.11426 13.9234 3.14014 14.0447 3.19044C14.1661 3.24073 14.2764 3.31445 14.3692 3.40738Z" fill="white" />
          </svg>
          저장하기
        </button>
      </>
    ) : (
      <button
        type="button"
        className={styles.btnSubmit}
        onClick={handleSubmit}
        disabled={saving || loading}
      >
        <svg className={styles.btnIcon} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M1.4033 7.10263H12.3215L8.27595 3.24975C7.90793 2.89925 7.90793 2.33113 8.27595 1.98064C8.64397 1.63015 9.2405 1.63015 9.60851 1.98064L15.2627 7.36557L15.3271 7.43393C15.629 7.78644 15.6077 8.30609 15.2627 8.63467L9.60851 14.0196C9.2405 14.3701 8.64397 14.3701 8.27595 14.0196C7.90793 13.6691 7.90793 13.101 8.27595 12.7505L12.3215 8.89761L1.4033 8.89761C0.882849 8.89761 0.460937 8.49579 0.460938 8.00012C0.460938 7.50445 0.882849 7.10263 1.4033 7.10263Z" fill="white" />
        </svg>
        제출하기
      </button>
    );

  return (
    <div className={styles.app}>
      <div className={styles.container}>
        {/* ── 상단 행 (학사팀은 stats 자리에 이번주 목표 바 표시) ─── */}
        <div className={styles.topRow}>
          {isDefault ? (
            /* 업무 센터 — 인사 카드 (날짜 클릭 시 변경 가능) */
            <div className={styles.wcGreetingCard} data-guide="wj-date">
              <div className={styles.wcGreetingText}>
                <span className={styles.wcGreetingName}>
                  {userName || "OOO"}
                </span>
                <span className={styles.wcGreetingMsg}>님, 오늘도 화이팅!</span>
              </div>
              <label className={styles.wcDateBox}>
                <span className={styles.wcDateText}>{formatPretty(date)}</span>
                <input
                  type="date"
                  className={styles.dateInputOverlay}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
            </div>
          ) : (
            /* 날짜 카드 (학사팀/실습팀) */
            <div className={styles.dateCard} data-guide="wj-date">
              <label className={styles.dateSelectWrap}>
                <span className={styles.dateSelectText}>
                  {formatPretty(date)}
                </span>
                <ChevronDown className={styles.dateSelectIcon} size={16} />
                <input
                  type="date"
                  className={styles.dateInputOverlay}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>

              <div className={styles.dateRow}>
                <span className={styles.dateLabel}>오늘 연락 예정</span>
                <div className={styles.dateRowRight}>
                  <span className={styles.dateValue}>
                    {(stats?.todayScheduledContacts ?? 0).toLocaleString()}건
                  </span>
                  <ChevronRight className={styles.dateRowIcon} size={16} />
                </div>
              </div>
            </div>
          )}

          {/* 학사팀 — 이번주 목표 바 (stats 자리) */}
          {isAcademic && (
            <div className={styles.weeklyGoalBar}>
              {/* 좌측 — 제목 + 목표 설정 버튼 */}
              <div className={styles.weeklyGoalLeft}>
                <span className={styles.weeklyGoalTitle}>이번주 목표</span>
                <button
                  type="button"
                  className={styles.weeklyGoalSettingBtn}
                  onClick={openGoalModal}
                  title="목표 설정"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M13.2663 8.4396C13.1594 8.31795 13.1004 8.16154 13.1004 7.9996C13.1004 7.83767 13.1594 7.68126 13.2663 7.5596L14.1196 6.5996C14.2136 6.49472 14.272 6.36274 14.2864 6.22261C14.3008 6.08248 14.2704 5.9414 14.1996 5.8196L12.8663 3.51294C12.7962 3.39129 12.6895 3.29486 12.5614 3.2374C12.4333 3.17993 12.2904 3.16438 12.1529 3.19294L10.8996 3.44627C10.7401 3.47922 10.5741 3.45266 10.4329 3.3716C10.2916 3.29055 10.1849 3.16059 10.1329 3.00627L9.72627 1.78627C9.68155 1.65386 9.59634 1.53885 9.48269 1.4575C9.36904 1.37615 9.2327 1.33258 9.09294 1.33294H6.42627C6.28089 1.32535 6.13703 1.36556 6.01665 1.44741C5.89627 1.52927 5.80599 1.64828 5.7596 1.78627L5.38627 3.00627C5.33427 3.16059 5.22759 3.29055 5.08635 3.3716C4.94511 3.45266 4.77908 3.47922 4.6196 3.44627L3.33294 3.19294C3.20264 3.17453 3.06981 3.19509 2.95117 3.25203C2.83254 3.30898 2.73341 3.39976 2.66627 3.51294L1.33294 5.8196C1.26038 5.94004 1.22775 6.08033 1.23973 6.22042C1.2517 6.36051 1.30766 6.49323 1.39961 6.5996L2.24627 7.5596C2.35315 7.68126 2.41209 7.83767 2.41209 7.9996C2.41209 8.16154 2.35315 8.31795 2.24627 8.4396L1.39961 9.3996C1.30766 9.50598 1.2517 9.6387 1.23973 9.77879C1.22775 9.91888 1.26038 10.0592 1.33294 10.1796L2.66627 12.4863C2.73634 12.6079 2.84302 12.7044 2.97111 12.7618C3.0992 12.8193 3.24215 12.8348 3.37961 12.8063L4.63294 12.5529C4.79242 12.52 4.95844 12.5465 5.09968 12.6276C5.24092 12.7087 5.34761 12.8386 5.39961 12.9929L5.80627 14.2129C5.85266 14.3509 5.94294 14.4699 6.06332 14.5518C6.1837 14.6337 6.32756 14.6739 6.47294 14.6663H9.1396C9.27937 14.6666 9.41571 14.6231 9.52936 14.5417C9.64301 14.4604 9.72821 14.3454 9.77294 14.2129L10.1796 12.9929C10.2316 12.8386 10.3383 12.7087 10.4795 12.6276C10.6208 12.5465 10.7868 12.52 10.9463 12.5529L12.1996 12.8063C12.3371 12.8348 12.48 12.8193 12.6081 12.7618C12.7362 12.7044 12.8429 12.6079 12.9129 12.4863L14.2463 10.1796C14.3171 10.0578 14.3474 9.91673 14.3331 9.7766C14.3187 9.63647 14.2603 9.50449 14.1663 9.3996L13.2663 8.4396ZM12.2729 9.33294L12.8063 9.93294L11.9529 11.4129L11.1663 11.2529C10.6861 11.1548 10.1867 11.2364 9.76267 11.4821C9.33868 11.7279 9.0197 12.1208 8.86627 12.5863L8.61294 13.3329H6.90627L6.66627 12.5729C6.51284 12.1075 6.19386 11.7146 5.76988 11.4688C5.34589 11.223 4.84642 11.1415 4.36627 11.2396L3.57961 11.3996L2.71294 9.92627L3.24627 9.32627C3.57424 8.95959 3.75556 8.48489 3.75556 7.99294C3.75556 7.50098 3.57424 7.02629 3.24627 6.6596L2.71294 6.0596L3.56627 4.59294L4.35294 4.75294C4.83309 4.85109 5.33256 4.76953 5.75654 4.52374C6.18053 4.27795 6.49951 3.88504 6.65294 3.4196L6.90627 2.66627H8.61294L8.86627 3.42627C9.0197 3.89171 9.33868 4.28462 9.76267 4.5304C10.1867 4.77619 10.6861 4.85775 11.1663 4.7596L11.9529 4.5996L12.8063 6.0796L12.2729 6.67961C11.9486 7.04544 11.7696 7.51739 11.7696 8.00627C11.7696 8.49515 11.9486 8.9671 12.2729 9.33294ZM7.7596 5.33294C7.23219 5.33294 6.71662 5.48934 6.27808 5.78235C5.83955 6.07537 5.49776 6.49185 5.29593 6.97912C5.09409 7.46638 5.04128 8.00256 5.14418 8.51985C5.24707 9.03713 5.50105 9.51228 5.87399 9.88522C6.24693 10.2582 6.72208 10.5121 7.23936 10.615C7.75665 10.7179 8.29282 10.6651 8.78009 10.4633C9.26736 10.2614 9.68384 9.91966 9.97686 9.48112C10.2699 9.04259 10.4263 8.52702 10.4263 7.9996C10.4263 7.29236 10.1453 6.61408 9.64522 6.11399C9.14513 5.61389 8.46685 5.33294 7.7596 5.33294ZM7.7596 9.33294C7.4959 9.33294 7.23811 9.25474 7.01884 9.10823C6.79958 8.96172 6.62868 8.75348 6.52777 8.50985C6.42685 8.26621 6.40044 7.99813 6.45189 7.73948C6.50334 7.48084 6.63033 7.24327 6.8168 7.0568C7.00327 6.87033 7.24084 6.74334 7.49948 6.69189C7.75813 6.64044 8.02621 6.66685 8.26985 6.76777C8.51348 6.86868 8.72172 7.03958 8.86823 7.25884C9.01474 7.47811 9.09294 7.7359 9.09294 7.9996C9.09294 8.35323 8.95246 8.69237 8.70241 8.94241C8.45237 9.19246 8.11323 9.33294 7.7596 9.33294Z"
                      fill="#8D99A5"
                    />
                  </svg>
                  <span>목표 설정</span>
                </button>
              </div>

              {/* 우측 — 목표 카드 리스트 (읽기 전용, 체크박스만 인터랙티브) */}
              <div className={styles.weeklyGoalList}>
                {weeklyGoal.length === 0 ? (
                  <span className={styles.weeklyGoalEmpty}>
                    이번주 목표가 없습니다. &quot;목표 설정&quot; 버튼으로
                    시작하세요.
                  </span>
                ) : (
                  weeklyGoal.map((g) => (
                    <div
                      key={g.id}
                      className={`${styles.weeklyGoalCard} ${g.done ? styles.weeklyGoalCardDone : ""}`}
                    >
                      <div className={styles.weeklyGoalCardTop}>
                        <span className={styles.weeklyGoalDateText}>
                          {formatGoalDate(g.date)}
                        </span>
                        <button
                          type="button"
                          className={`${styles.weeklyGoalCheckBtn} ${g.done ? styles.weeklyGoalCheckBtnOn : ""}`}
                          onClick={() => toggleWeeklyGoal(g.id)}
                          aria-pressed={g.done}
                          aria-label="완료 토글"
                        >
                          {g.done && (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="11"
                              height="11"
                              viewBox="0 0 11 11"
                              fill="none"
                              aria-hidden="true"
                            >
                              <path
                                fillRule="evenodd"
                                clipRule="evenodd"
                                d="M9.69591 2.30039C9.82245 2.42698 9.89354 2.59863 9.89354 2.77762C9.89354 2.95661 9.82245 3.12826 9.69591 3.25484L4.63656 8.3142C4.5697 8.38107 4.49032 8.43412 4.40295 8.47031C4.31559 8.50651 4.22195 8.52514 4.12738 8.52514C4.03282 8.52514 3.93918 8.50651 3.85181 8.47031C3.76445 8.43412 3.68507 8.38107 3.61821 8.3142L1.10451 5.80095C1.04004 5.73868 0.988615 5.6642 0.953239 5.58184C0.917863 5.49949 0.899242 5.41092 0.898463 5.32129C0.897684 5.23166 0.914763 5.14278 0.948702 5.05983C0.982642 4.97687 1.03276 4.90151 1.09614 4.83813C1.15952 4.77475 1.23488 4.72463 1.31784 4.69069C1.40079 4.65675 1.48968 4.63967 1.5793 4.64045C1.66893 4.64123 1.7575 4.65985 1.83986 4.69523C1.92221 4.7306 1.99669 4.78203 2.05896 4.8465L4.12716 6.9147L8.74101 2.30039C8.80369 2.23767 8.87812 2.18791 8.96005 2.15396C9.04197 2.12001 9.12978 2.10254 9.21846 2.10254C9.30714 2.10254 9.39495 2.12001 9.47687 2.15396C9.55879 2.18791 9.63322 2.23767 9.69591 2.30039Z"
                                fill="white"
                              />
                            </svg>
                          )}
                        </button>
                      </div>
                      <span className={styles.weeklyGoalText}>{g.text}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 학사팀 — 이슈 및 요청사항 (이번주 목표 바 옆 절반) */}
          {isAcademic && (
            <div className={styles.issuesBar}>
              <div className={styles.weeklyGoalLeft}>
                <span className={styles.weeklyGoalTitle}>이슈 및 요청사항</span>
                <button
                  type="button"
                  className={styles.weeklyGoalSettingBtn}
                  onClick={() => addRow("issues")}
                  title="이슈 추가"
                >
                  <Plus size={14} />
                  <span>추가</span>
                </button>
              </div>
              <div className={styles.issuesBarList}>
                {issues.length === 0 ? (
                  <span className={styles.weeklyGoalEmpty}>
                    이슈가 없습니다. &quot;추가&quot; 버튼으로 입력하세요.
                  </span>
                ) : (
                  issues.map((row) => (
                    <div key={row.id} className={styles.issueRow}>
                      <div className={styles.issueRowMain}>
                        <div className={styles.issueField}>
                          <input
                            type="text"
                            className={styles.issueFieldInput}
                            placeholder="이슈 내용을 작성해주세요."
                            value={row.category}
                            onChange={(e) =>
                              updateRow("issues", row.id, {
                                category: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div
                          className={`${styles.issueField} ${styles.issueFieldBorderless}`}
                        >
                          <input
                            type="text"
                            className={styles.issueFieldInput}
                            placeholder="조치·요청 사항을 작성해주세요."
                            value={row.detail}
                            onChange={(e) =>
                              updateRow("issues", row.id, {
                                detail: e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>
                      <DeleteButton
                        onClick={() => removeRow("issues", row.id)}
                      />
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 실습팀 — 이번주(월~금) 연계 합계 바 (stats 자리) */}
          {isPracticum && (
            <div className={styles.practicumWeekBar}>
              <div className={styles.practicumWeekHead}>
                <span className={styles.practicumWeekTitle}>이번주 연계</span>
                <span className={styles.practicumWeekTotal}>
                  총 {practicumWeek?.totals.total ?? 0}건
                </span>
              </div>
              <div className={styles.practicumWeekDays}>
                {(practicumWeek?.days ?? []).map((d) => {
                  const isToday = d.date === date;
                  return (
                    <div
                      key={d.date}
                      className={`${styles.practicumDay} ${isToday ? styles.practicumDayToday : ""}`}
                    >
                      <span className={styles.practicumDayDow}>{d.dow}</span>
                      <span className={styles.practicumDayVal}>{d.total}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 업무 센터 — 통계 영역 (default 전용) */}
          {isDefault && (
            <div className={styles.wcStatArea}>
              {wcStats.map((s) => (
                <div key={s.title} className={styles.wcStatCard}>
                  <div className={styles.wcStatTop}>
                    <div className={styles.wcStatInfo}>
                      <span className={styles.wcStatTitle}>{s.title}</span>
                      <div className={styles.wcStatValueRow}>
                        <span className={styles.wcStatValue}>{s.value}</span>
                        {s.sub && (
                          <span className={styles.wcStatSub}>{s.sub}</span>
                        )}
                      </div>
                    </div>
                    <span className={styles.wcStatIcon}>{s.icon}</span>
                  </div>
                  {s.progress === null ? (
                    <div className={styles.wcStatRankFooter}>{s.footer}</div>
                  ) : (
                    <div className={styles.wcStatBarWrap}>
                      <div className={styles.wcStatBarTrack}>
                        <div
                          className={styles.wcStatBarFill}
                          style={{ width: `${Math.min(100, s.progress)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {/* (구) 4 stat 카드 — 새 디자인 전환 중 임시 비활성 */}
          {false && (
            <div className={styles.statGroup}>
              <div className={styles.statCard}>
                <div className={styles.statIcon}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="42"
                    height="42"
                    viewBox="0 0 42 42"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M28.8747 10.7619C30.3489 10.763 31.7916 11.1919 33.0267 11.9966C34.2617 12.8014 35.2364 13.9478 35.8329 15.2958C36.4293 16.644 36.6218 18.1369 36.3866 19.5922C36.1513 21.0474 35.4983 22.4031 34.5075 23.4946L34.2743 23.7519L34.5853 23.9065C36.1519 24.6826 37.5443 25.7702 38.6766 27.1023C39.8088 28.4344 40.6574 29.9839 41.1709 31.6551L41.1717 31.6568C41.2618 31.9433 41.2744 32.249 41.2085 32.542C41.1424 32.8351 41.0001 33.1061 40.7958 33.3264C40.5914 33.5467 40.3319 33.7085 40.0447 33.7964C39.7572 33.8843 39.4512 33.8947 39.1585 33.8263C38.866 33.7586 38.5959 33.6145 38.3767 33.4093C38.1574 33.204 37.9961 32.9441 37.9093 32.6565L37.9084 32.6548C37.4238 31.0901 36.5416 29.6772 35.3484 28.555C34.1551 27.4328 32.6913 26.639 31.0998 26.2512C30.7273 26.1613 30.3951 25.9484 30.1582 25.6471C29.9214 25.3459 29.7928 24.9733 29.7933 24.5901V23.6655C29.7932 23.3481 29.8817 23.0366 30.0488 22.7666C30.216 22.4967 30.4558 22.2783 30.7401 22.1369C31.5885 21.7161 32.2701 21.0205 32.6738 20.1638C33.0773 19.3071 33.1794 18.3388 32.9635 17.4166C32.7474 16.4944 32.2257 15.6716 31.4835 15.083C30.7413 14.4946 29.8219 14.174 28.8747 14.1738C28.4222 14.1738 27.9882 13.994 27.6682 13.674C27.3483 13.354 27.1683 12.9199 27.1683 12.4674C27.1685 12.0151 27.3484 11.5807 27.6682 11.2609C27.9881 10.9412 28.4224 10.7619 28.8747 10.7619Z"
                      fill="currentColor"
                    />
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M13.6639 5.54433C15.1373 5.41622 16.6197 5.65578 17.9774 6.24245C19.3352 6.82929 20.5267 7.74476 21.4432 8.9059C22.3596 10.067 22.9729 11.4386 23.2282 12.8955C23.4834 14.3524 23.3722 15.8501 22.9052 17.2534C22.4381 18.6569 21.6294 19.9228 20.552 20.9363L20.2743 21.1978L20.6169 21.3635C22.6702 22.3604 24.4536 23.838 25.8148 25.6702C27.1758 27.5022 28.0747 29.6358 28.4364 31.8892C28.4715 32.1104 28.463 32.337 28.4107 32.5548C28.3585 32.7726 28.2638 32.9785 28.1322 33.1598C28.0006 33.341 27.8343 33.4947 27.6434 33.6118C27.4523 33.729 27.2393 33.8074 27.0179 33.8426C26.7967 33.8776 26.5709 33.8683 26.3531 33.8161C26.1352 33.7638 25.9295 33.6692 25.7481 33.5375C25.5668 33.4058 25.4124 33.2398 25.2953 33.0487C25.1783 32.8578 25.1005 32.6452 25.0654 32.4241C24.6617 29.896 23.3696 27.5932 21.4218 25.9317C19.474 24.2702 16.9974 23.3571 14.4372 23.3571C11.8771 23.3571 9.40043 24.2703 7.45259 25.9317C5.50486 27.5932 4.21273 29.8952 3.80904 32.4232C3.7738 32.6445 3.69552 32.8578 3.57832 33.0487C3.46108 33.2397 3.3068 33.4059 3.12544 33.5375C2.94411 33.669 2.73829 33.7631 2.52046 33.8152C2.30246 33.8674 2.07617 33.8761 1.85481 33.8408C1.6335 33.8056 1.42118 33.7274 1.23018 33.6101C1.03917 33.4928 0.873004 33.3387 0.741409 33.1572C0.609886 32.9758 0.514972 32.7702 0.462844 32.5523C0.410776 32.3344 0.401975 32.1079 0.43721 31.8866C0.797508 29.6333 1.69669 27.4999 3.05794 25.6685C4.41928 23.837 6.20281 22.3607 8.25667 21.3661L8.60018 21.2003L8.32247 20.9389C7.43523 20.1043 6.7276 19.097 6.24434 17.9789C5.76114 16.8607 5.51184 15.6543 5.51204 14.4362C5.51196 12.9571 5.87977 11.5006 6.58187 10.1987C7.28405 8.89693 8.29897 7.78975 9.53499 6.97731C10.7711 6.16488 12.1903 5.67253 13.6639 5.54433ZM14.4432 8.92385C13.7092 8.90725 12.9788 9.03735 12.2959 9.30666C11.613 9.57599 10.9906 9.97967 10.4655 10.4927C9.94053 11.0058 9.52258 11.6191 9.23763 12.2957C8.95274 12.9723 8.80636 13.6995 8.80611 14.4336C8.80593 15.1677 8.9523 15.8948 9.23678 16.5716C9.52134 17.2483 9.93825 17.8619 10.463 18.3754C10.9878 18.8889 11.6104 19.2925 12.2933 19.5623C12.9762 19.832 13.7066 19.9622 14.4406 19.9459C15.8808 19.914 17.2511 19.3196 18.2585 18.2899C19.2658 17.2602 19.8304 15.8767 19.8308 14.4362C19.831 12.9958 19.267 11.6125 18.2602 10.5824C17.2533 9.5523 15.8833 8.95649 14.4432 8.92385Z"
                      fill="currentColor"
                    />
                  </svg>
                </div>
                <div className={styles.statTexts}>
                  <div className={styles.statValueRow}>
                    <span className={styles.statLabel}>전체문의</span>
                    <span className={styles.statValue}>
                      {(stats?.totalInquiries ?? 0).toLocaleString()}건
                    </span>
                  </div>
                  <div className={styles.statSub}>
                    <span>전일대비</span>
                    <span>
                      {(() => {
                        const n = stats?.delta.inquiries ?? 0;
                        return `${n > 0 ? "+" : ""}${n}건`;
                      })()}
                    </span>
                  </div>
                </div>
              </div>

              <span className={styles.statDivider} aria-hidden="true" />

              <div className={styles.statCard}>
                <div className={styles.statIcon}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="42"
                    height="42"
                    viewBox="0 0 42 42"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M14.4393 6.91308C16.2097 6.91308 17.9393 7.44466 19.4039 8.43921C20.8686 9.43385 22.0015 10.8455 22.6544 12.4912C23.3073 14.1369 23.4507 15.9412 23.0663 17.6694C22.6818 19.3975 21.7865 20.9709 20.4977 22.1846L20.1285 22.5315L20.5848 22.7537C22.8502 23.8569 24.7772 25.545 26.1732 27.6431C27.5691 29.741 28.3805 32.1734 28.5231 34.6892C28.5352 34.9013 28.5058 35.114 28.4359 35.3147C28.3659 35.5154 28.2578 35.7012 28.1163 35.8598C27.975 36.0183 27.8033 36.1468 27.6122 36.2392C27.4209 36.3317 27.2124 36.3859 27.0004 36.3982C26.788 36.4104 26.574 36.381 26.3732 36.311C26.1726 36.241 25.9883 36.1311 25.8297 35.9897C25.671 35.8482 25.5411 35.677 25.4486 35.4856C25.3562 35.2942 25.3018 35.0859 25.2897 34.8738C25.1388 32.0973 23.9306 29.4843 21.9127 27.5713C19.8943 25.6578 17.2188 24.5896 14.4376 24.5874C11.6566 24.5896 8.98251 25.658 6.96422 27.5713C4.94623 29.4843 3.73644 32.0972 3.58556 34.8738C3.57352 35.0858 3.5205 35.2942 3.42833 35.4856C3.33595 35.6771 3.20587 35.8498 3.04722 35.9914C2.88886 36.1327 2.70407 36.241 2.50377 36.311C2.30321 36.3811 2.09037 36.4118 1.87828 36.3999C1.66607 36.3878 1.45793 36.3332 1.26646 36.241C1.07493 36.1486 0.902209 36.0202 0.760604 35.8616C0.619049 35.7029 0.511123 35.5171 0.441023 35.3164C0.370952 35.1157 0.340113 34.9031 0.352156 34.6909C0.49426 32.1746 1.30606 29.7415 2.70201 27.6431C4.09789 25.5449 6.02813 23.8571 8.29381 22.7537L8.75011 22.5315L8.38097 22.1846C7.09214 20.9709 6.19681 19.3975 5.81236 17.6694C5.42799 15.9413 5.57141 14.1368 6.22423 12.4912C6.87714 10.8455 8.01003 9.43385 9.47472 8.43921C10.9394 7.4446 12.6689 6.91311 14.4393 6.91308ZM14.4462 10.1499C13.7006 10.133 12.9592 10.266 12.2655 10.5395C11.5716 10.8132 10.9379 11.223 10.4044 11.7444C9.8712 12.2657 9.44794 12.8892 9.15855 13.5764C8.86931 14.2635 8.71962 15.0013 8.71935 15.7468C8.71916 16.4925 8.86789 17.2315 9.15685 17.9189C9.44587 18.6063 9.8698 19.2294 10.4027 19.751C10.9359 20.2726 11.5683 20.6835 12.2621 20.9575C12.9557 21.2315 13.6972 21.3636 14.4427 21.3472C15.9058 21.3148 17.2987 20.7115 18.3221 19.6655C19.3456 18.6194 19.9197 17.2138 19.92 15.7502C19.9204 14.2867 19.3468 12.8816 18.3238 11.835C17.3009 10.7884 15.9093 10.183 14.4462 10.1499Z"
                      fill="currentColor"
                    />
                    <path
                      d="M33.0314 0.350586C33.4606 0.350586 33.8728 0.520568 34.1764 0.823974C34.48 1.12755 34.6515 1.53967 34.6515 1.96899V5.60058H38.2814C38.7106 5.60058 39.1228 5.77057 39.4264 6.07397C39.73 6.37755 39.9015 6.78967 39.9015 7.21899C39.9015 7.64831 39.73 8.06044 39.4264 8.36401C39.1228 8.66742 38.7106 8.8374 38.2814 8.8374H34.6515V12.469C34.6515 12.8983 34.48 13.3104 34.1764 13.614C33.8728 13.9174 33.4606 14.0874 33.0314 14.0874C32.6025 14.0873 32.1914 13.9171 31.8881 13.614C31.5845 13.3104 31.413 12.8983 31.413 12.469V8.8374H27.7814C27.3525 8.83726 26.9414 8.66709 26.638 8.36401C26.3345 8.06044 26.163 7.64831 26.163 7.21899C26.163 6.78967 26.3345 6.37755 26.638 6.07397C26.9414 5.77089 27.3525 5.60073 27.7814 5.60058H31.413V1.96899C31.413 1.53967 31.5845 1.12755 31.8881 0.823974C32.1914 0.520892 32.6025 0.350728 33.0314 0.350586Z"
                      fill="currentColor"
                    />
                  </svg>
                </div>
                <div className={styles.statTexts}>
                  <div className={styles.statValueRow}>
                    <span className={styles.statLabel}>등록 건수</span>
                    <span className={styles.statValue}>
                      {(stats?.registrations ?? 0).toLocaleString()}건
                    </span>
                  </div>
                  <div className={styles.statSub}>
                    <span>전일대비</span>
                    <span>
                      {(() => {
                        const n = stats?.delta.registrations ?? 0;
                        return `${n > 0 ? "+" : ""}${n}건`;
                      })()}
                    </span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className={styles.statSubArrow}
                      viewBox="0 0 12 12"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M1.01172 2.00317C1.01172 2.20201 1.09089 2.39281 1.23145 2.53345L5.47437 6.77637C5.615 6.91692 5.80581 6.99609 6.00464 6.99609C6.20339 6.99601 6.39434 6.91689 6.53491 6.77637L10.7771 2.53345C10.9137 2.392 10.9897 2.20273 10.988 2.0061C10.9863 1.80953 10.9073 1.62145 10.7683 1.48242C10.6293 1.34343 10.4412 1.26447 10.2446 1.26269C10.048 1.26099 9.858 1.33631 9.71655 1.4729L6.00464 5.18555L2.29199 1.4729C2.15139 1.33239 1.96049 1.25395 1.76172 1.25391C1.56296 1.25391 1.37207 1.33245 1.23145 1.4729C1.09092 1.61347 1.01181 1.80442 1.01172 2.00317Z"
                        fill="#8F8F8F"
                      />
                      <path
                        d="M1.01172 5.75317C1.01172 5.95201 1.09089 6.14281 1.23145 6.28345L5.47437 10.5264C5.615 10.6669 5.80581 10.7461 6.00464 10.7461C6.20339 10.746 6.39434 10.6669 6.53491 10.5264L10.7771 6.28345C10.9137 6.142 10.9897 5.95273 10.988 5.7561C10.9863 5.55953 10.9073 5.37145 10.7683 5.23242C10.6293 5.09343 10.4412 5.01447 10.2446 5.01269C10.048 5.01099 9.858 5.08631 9.71655 5.2229L6.00464 8.93555L2.29199 5.2229C2.15139 5.08239 1.96049 5.00395 1.76172 5.00391C1.56296 5.00391 1.37207 5.08245 1.23145 5.2229C1.09092 5.36347 1.01181 5.55442 1.01172 5.75317Z"
                        fill="#8F8F8F"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              <span className={styles.statDivider} aria-hidden="true" />

              <div className={styles.statCard}>
                <div className={styles.statIcon}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="42"
                    height="42"
                    viewBox="0 0 42 42"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M21.0002 4.1377C25.5309 4.1377 29.6437 5.92495 32.6735 8.83228C32.6849 8.84329 32.6962 8.85455 32.7076 8.8656C32.7898 8.94491 32.8715 9.02476 32.952 9.10571C33.002 9.15596 33.0513 9.20691 33.1007 9.25781C33.1522 9.31086 33.2037 9.36388 33.2545 9.4176C33.2672 9.43107 33.2803 9.44425 33.293 9.45776C33.2973 9.46234 33.3007 9.46768 33.3049 9.47229C36.1311 12.4877 37.8628 16.5414 37.8628 21.0002C37.8628 30.3132 30.3132 37.8628 21.0002 37.8628C11.6873 37.8628 4.1377 30.3132 4.1377 21.0002C4.1377 11.6873 11.6873 4.1377 21.0002 4.1377ZM19.469 7.28479C12.5681 8.04662 7.2002 13.8963 7.2002 21.0002C7.2002 28.6218 13.3787 34.8003 21.0002 34.8003C28.6218 34.8003 34.8003 28.6218 34.8003 21.0002C34.8003 17.8968 33.7763 15.0323 32.0471 12.7271L22.0487 22.1162C21.6036 22.5342 20.9522 22.6484 20.3918 22.4059C19.8315 22.1634 19.469 21.6108 19.469 21.0002V7.28479ZM22.5315 17.4618L29.9493 10.496C28.909 9.6096 27.7405 8.88092 26.481 8.33582C25.2212 7.79062 23.89 7.43735 22.5315 7.28564V17.4618Z"
                      fill="currentColor"
                    />
                  </svg>
                </div>
                <div className={styles.statTexts}>
                  <div className={styles.statValueRow}>
                    <span className={styles.statLabel}>등록률</span>
                    <span className={styles.statValue}>
                      {(stats?.registrationRate ?? 0).toFixed(1)}%
                    </span>
                  </div>
                  <div className={styles.statSub}>
                    <span>전일대비</span>
                    <span>
                      {(() => {
                        const n = stats?.delta.rate ?? 0;
                        return `${n > 0 ? "+" : ""}${n.toFixed(1)}%p`;
                      })()}
                    </span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className={styles.statSubArrow}
                      viewBox="0 0 12 12"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M1.01172 9.99683C1.01172 9.79799 1.09089 9.60719 1.23145 9.46655L5.47437 5.22363C5.615 5.08308 5.80581 5.00391 6.00464 5.00391C6.20339 5.00399 6.39434 5.08311 6.53491 5.22363L10.7771 9.46655C10.9137 9.608 10.9897 9.79727 10.988 9.9939C10.9863 10.1905 10.9073 10.3786 10.7683 10.5176C10.6293 10.6566 10.4412 10.7355 10.2446 10.7373C10.048 10.739 9.858 10.6637 9.71655 10.5271L6.00464 6.81445L2.29199 10.5271C2.15139 10.6676 1.96049 10.7461 1.76172 10.7461C1.56296 10.7461 1.37207 10.6676 1.23145 10.5271C1.09092 10.3865 1.01181 10.1956 1.01172 9.99683Z"
                        fill="#00CE56"
                      />
                      <path
                        d="M1.01172 6.24683C1.01172 6.04799 1.09089 5.85719 1.23145 5.71655L5.47436 1.47363C5.615 1.33308 5.80581 1.25391 6.00464 1.25391C6.20339 1.25399 6.39434 1.33311 6.53491 1.47363L10.7771 5.71655C10.9137 5.858 10.9897 6.04727 10.988 6.2439C10.9863 6.44047 10.9073 6.62855 10.7683 6.76758C10.6293 6.90657 10.4412 6.98553 10.2446 6.9873C10.048 6.98901 9.858 6.91369 9.71655 6.7771L6.00464 3.06445L2.29199 6.7771C2.15139 6.91761 1.96049 6.99605 1.76172 6.99609C1.56296 6.99609 1.37207 6.91755 1.23145 6.7771C1.09092 6.63653 1.01181 6.44558 1.01172 6.24683Z"
                        fill="#00CE56"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              <span className={styles.statDivider} aria-hidden="true" />

              <div className={styles.statCard}>
                <div className={styles.statIcon}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="42"
                    height="42"
                    viewBox="0 0 42 42"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M24.9025 19.9652C25.474 19.342 26.4428 19.2998 27.0661 19.8712C27.6893 20.4427 27.7314 21.4114 27.1601 22.0348L20.7429 29.0348C20.1812 29.6474 19.2328 29.7001 18.6066 29.1536L15.3997 26.3534C14.7627 25.7973 14.6967 24.8303 15.2527 24.1932C15.8088 23.5564 16.7758 23.4905 17.4129 24.0463L19.4944 25.8638L24.9025 19.9652Z"
                      fill="currentColor"
                    />
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M21.0001 1.96875C22.7986 1.96875 24.5237 2.68286 25.7955 3.95459C27.0672 5.22632 27.7813 6.9515 27.7813 8.75V9.12598C27.9635 9.14331 28.1413 9.16097 28.3145 9.18237C30.1039 9.40347 31.6073 9.87105 32.8886 10.9349C34.1707 11.9989 34.9081 13.3907 35.4555 15.1091C35.99 16.7873 36.3923 18.9447 36.897 21.6366L37.3986 24.3376C37.8633 26.8955 38.2019 29.0321 38.2796 30.8104C38.3851 33.2239 38.0282 35.2658 36.6313 36.9491C35.2343 38.6312 33.2925 39.3586 30.9011 39.6997C28.5513 40.0348 25.4903 40.0312 21.6298 40.0312H20.3694C16.5093 40.0312 13.4492 40.0348 11.0999 39.6997C8.70883 39.3586 6.76746 38.6319 5.37054 36.95L5.36968 36.9491C3.97295 35.2659 3.61589 33.2237 3.72136 30.8104C3.82503 28.4393 4.39338 25.4313 5.10479 21.6366L5.46709 19.7174C5.81798 17.8962 6.14406 16.3677 6.54461 15.1091C7.09148 13.3908 7.82842 11.9991 9.11065 10.9349C10.3927 9.87099 11.8966 9.40354 13.6865 9.18237C13.8594 9.16101 14.037 9.14328 14.2188 9.12598V8.75C14.2188 6.9515 14.9329 5.22632 16.2046 3.95459C17.4764 2.68286 19.2016 1.96875 21.0001 1.96875ZM20.3677 12.0312C17.5511 12.0312 15.5782 12.0344 14.0616 12.2218C12.5872 12.404 11.7286 12.7423 11.0666 13.2916C10.4047 13.8409 9.91328 14.6222 9.4627 16.038C8.99926 17.4942 8.63333 19.4325 8.11431 22.2006C7.38549 26.0882 6.87321 28.8419 6.7813 30.9437C6.69128 33.0028 7.02357 34.1461 7.72637 34.9932L7.86224 35.1478C8.56565 35.9056 9.61911 36.395 11.5323 36.668C13.6146 36.965 16.415 36.9688 20.3694 36.9688H21.6298C25.5846 36.9688 28.3858 36.965 30.4687 36.668C32.5094 36.3769 33.5717 35.8394 34.2746 34.9932C34.9776 34.146 35.3106 33.0031 35.2205 30.9437C35.1286 28.8419 34.6155 26.0882 33.8867 22.2006C33.3677 19.4329 33.0012 17.4948 32.5374 16.0388C32.0865 14.6231 31.5956 13.8411 30.9335 13.2916C30.2726 12.7427 29.4136 12.404 27.9385 12.2218C26.4216 12.0344 24.4482 12.0312 21.6315 12.0312H20.3677ZM21.0001 5.03125C20.0138 5.03125 19.0682 5.42333 18.3708 6.12073C17.6734 6.81813 17.2813 7.76373 17.2813 8.75V8.98242C18.224 8.96822 19.2506 8.96875 20.3677 8.96875H21.6315C22.7488 8.96875 23.7759 8.96823 24.7188 8.98242V8.75C24.7188 7.76373 24.3267 6.81813 23.6293 6.12073C22.9319 5.42333 21.9863 5.03125 21.0001 5.03125Z"
                      fill="currentColor"
                    />
                  </svg>
                </div>
                <div className={styles.statTexts}>
                  <div className={styles.statValueRow}>
                    <span className={styles.statLabel}>매출</span>
                    <span className={styles.statValue}>
                      {Math.round(
                        (stats?.salesThisMonth ?? 0) / 10000,
                      ).toLocaleString()}
                      만원
                    </span>
                  </div>
                  <div className={styles.statSub}>
                    <span>전일대비</span>
                    <span>
                      {(() => {
                        const n = Math.round((stats?.delta.sales ?? 0) / 10000);
                        return `${n > 0 ? "+" : ""}${n.toLocaleString()}만원`;
                      })()}
                    </span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className={styles.statSubArrow}
                      viewBox="0 0 12 12"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M1.01172 9.99683C1.01172 9.79799 1.09089 9.60719 1.23145 9.46655L5.47437 5.22363C5.615 5.08308 5.80581 5.00391 6.00464 5.00391C6.20339 5.00399 6.39434 5.08311 6.53491 5.22363L10.7771 9.46655C10.9137 9.608 10.9897 9.79727 10.988 9.9939C10.9863 10.1905 10.9073 10.3786 10.7683 10.5176C10.6293 10.6566 10.4412 10.7355 10.2446 10.7373C10.048 10.739 9.858 10.6637 9.71655 10.5271L6.00464 6.81445L2.29199 10.5271C2.15139 10.6676 1.96049 10.7461 1.76172 10.7461C1.56296 10.7461 1.37207 10.6676 1.23145 10.5271C1.09092 10.3865 1.01181 10.1956 1.01172 9.99683Z"
                        fill="#00CE56"
                      />
                      <path
                        d="M1.01172 6.24683C1.01172 6.04799 1.09089 5.85719 1.23145 5.71655L5.47436 1.47363C5.615 1.33308 5.80581 1.25391 6.00464 1.25391C6.20339 1.25399 6.39434 1.33311 6.53491 1.47363L10.7771 5.71655C10.9137 5.858 10.9897 6.04727 10.988 6.2439C10.9863 6.44047 10.9073 6.62855 10.7683 6.76758C10.6293 6.90657 10.4412 6.98553 10.2446 6.9873C10.048 6.98901 9.858 6.91369 9.71655 6.7771L6.00464 3.06445L2.29199 6.7771C2.15139 6.91761 1.96049 6.99605 1.76172 6.99609C1.56296 6.99609 1.37207 6.91755 1.23145 6.7771C1.09092 6.63653 1.01181 6.44558 1.01172 6.24683Z"
                        fill="#00CE56"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── 3컬럼 본문 — 제출 완료 후 잠금 ───────────────────── */}
        <div
          className={`${styles.bodyRow} ${isLocked ? styles.bodyRowLocked : ""}`}
          onBlur={handleFieldBlur}
        >
          {/* 좌: 오늘의 업무 (실습팀이면 내일 예정 업무와 위/아래 반반) */}
          <div className={styles.colStack}>
            {/* 업무 센터(default) — 이번주 연락 예정 카드 */}
            {isDefault && (
              <div className={styles.wcWeekCard}>
                <div className={styles.wcWeekSection}>
                  <span className={styles.wcWeekTitle}>이번주 연락 예정</span>
                  <div className={styles.wcWeekDays}>
                    {weekContacts.map((d) => {
                      const active = d.dow === todayDow;
                      return (
                        <div
                          key={d.dow}
                          className={`${styles.wcWeekDay} ${active ? styles.wcWeekDayActive : ""}`}
                        >
                          <div className={styles.wcWeekDayInner}>
                            <span className={styles.wcWeekDow}>{d.dow}</span>
                            <span
                              className={`${styles.wcWeekCount} ${active ? styles.wcWeekCountActive : ""}`}
                            >
                              {d.count}건
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    className={styles.wcWeekCalBtn}
                    onClick={() => setCalendarOpen(true)}
                  >
                    <span className={styles.wcWeekCalBtnText}>
                      달력으로 보기
                    </span>
                    <WcIconCalendar />
                  </button>
                </div>
              </div>
            )}
            <section className={styles.col} data-guide="wj-today-tasks">
              <h3 className={styles.colTitle}>오늘의 업무</h3>
              <div className={styles.taskList}>
                {tasks.map((t, idx) => {
                  const isEditing = editingTaskId === t.id;
                  const isEmpty = t.text.trim() === "";
                  const canDrag = !isEmpty && !isEditing;
                  const isDropAbove = dropTaskTarget === idx;
                  const isDropBelowLast =
                    idx === tasks.length - 1 && dropTaskTarget === tasks.length;
                  return (
                    <div
                      key={t.id}
                      className={`${styles.taskItem} ${isDropAbove ? styles.taskItemDropAbove : ""} ${isDropBelowLast ? styles.taskItemDropBelow : ""}`}
                      onDragOver={handleTaskItemDragOver(idx)}
                      onDrop={handleTaskItemDrop}
                      onDragLeave={handleTaskListDragLeave}
                    >
                      <input
                        type="checkbox"
                        className={styles.taskCheckbox}
                        checked={t.done}
                        onChange={() => toggleTask(t.id)}
                      />
                      {isEditing || isEmpty ? (
                        <AutoSizeTextarea
                          value={t.text}
                          placeholder="할 일을 입력하세요"
                          className={`${styles.taskInput} ${t.done ? styles.taskTextDone : ""}`}
                          onChange={(v) => updateTaskText(t.id, v)}
                          autoFocus={isEditing}
                          onBlur={() => handleTaskBlur(t.id)}
                        />
                      ) : (
                        <div
                          className={`${styles.taskInput} ${styles.taskTextDisplay} ${t.done ? styles.taskTextDone : ""}`}
                          onClick={() => setEditingTaskId(t.id)}
                        >
                          {t.text}
                        </div>
                      )}
                      {canDrag ? (
                        <span
                          className={styles.taskDragHandle}
                          draggable
                          onDragStart={(e) =>
                            handleTaskGripDragStart(
                              idx,
                              (e.currentTarget as HTMLElement).closest(
                                `.${styles.taskItem}`,
                              ) as HTMLElement | null,
                            )(e)
                          }
                          title="잡고 위/아래로 끌어 순서를 바꿀 수 있어요"
                          aria-label="순서 변경 핸들"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="6"
                            height="10"
                            viewBox="0 0 6 10"
                            fill="none"
                          >
                            <path
                              d="M1 0C1.26522 0 1.51957 0.105357 1.70711 0.292893C1.89464 0.480429 2 0.734784 2 1C2 1.26522 1.89464 1.51957 1.70711 1.70711C1.51957 1.89464 1.26522 2 1 2C0.734784 2 0.480429 1.89464 0.292893 1.70711C0.105357 1.51957 0 1.26522 0 1C0 0.734784 0.105357 0.480429 0.292893 0.292893C0.480429 0.105357 0.734784 0 1 0ZM2 5C2 4.73478 1.89464 4.48043 1.70711 4.29289C1.51957 4.10536 1.26522 4 1 4C0.734784 4 0.480429 4.10536 0.292893 4.29289C0.105357 4.48043 0 4.73478 0 5C0 5.26522 0.105357 5.51957 0.292893 5.70711C0.480429 5.89464 0.734784 6 1 6C1.26522 6 1.51957 5.89464 1.70711 5.70711C1.89464 5.51957 2 5.26522 2 5ZM2 9C2 8.73478 1.89464 8.48043 1.70711 8.29289C1.51957 8.10536 1.26522 8 1 8C0.734784 8 0.480429 8.10536 0.292893 8.29289C0.105357 8.48043 0 8.73478 0 9C0 9.26522 0.105357 9.51957 0.292893 9.70711C0.480429 9.89464 0.734784 10 1 10C1.26522 10 1.51957 9.89464 1.70711 9.70711C1.89464 9.51957 2 9.26522 2 9ZM6 5C6 4.73478 5.89464 4.48043 5.70711 4.29289C5.51957 4.10536 5.26522 4 5 4C4.73478 4 4.48043 4.10536 4.29289 4.29289C4.10536 4.48043 4 4.73478 4 5C4 5.26522 4.10536 5.51957 4.29289 5.70711C4.48043 5.89464 4.73478 6 5 6C5.26522 6 5.51957 5.89464 5.70711 5.70711C5.89464 5.51957 6 5.26522 6 5ZM5 8C5.26522 8 5.51957 8.10536 5.70711 8.29289C5.89464 8.48043 6 8.73478 6 9C6 9.26522 5.89464 9.51957 5.70711 9.70711C5.51957 9.89464 5.26522 10 5 10C4.73478 10 4.48043 9.89464 4.29289 9.70711C4.10536 9.51957 4 9.26522 4 9C4 8.73478 4.10536 8.48043 4.29289 8.29289C4.48043 8.10536 4.73478 8 5 8ZM6 1C6 0.734784 5.89464 0.480429 5.70711 0.292893C5.51957 0.105357 5.26522 0 5 0C4.73478 0 4.48043 0.105357 4.29289 0.292893C4.10536 0.480429 4 0.734784 4 1C4 1.26522 4.10536 1.51957 4.29289 1.70711C4.48043 1.89464 4.73478 2 5 2C5.26522 2 5.51957 1.89464 5.70711 1.70711C5.89464 1.51957 6 1.26522 6 1Z"
                              fill="#7A8086"
                            />
                          </svg>
                        </span>
                      ) : (
                        <span
                          className={styles.taskDragHandlePlaceholder}
                          aria-hidden="true"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              {/* 업무 센터(default) — 업무일지 열기 버튼 */}
              {isDefault && (
                <button
                  type="button"
                  className={styles.wcOpenJournalBtn}
                  onClick={() => setJournalDrawerOpen(true)}
                >
                  <span className={styles.wcOpenJournalText}>
                    업무일지 열기
                  </span>
                  <WcIconArrow />
                </button>
              )}
            </section>

            {/* 실습팀·학사팀 — 내일 예정 업무 (오늘의 업무 아래 반반) + 카드 안 푸터 버튼 */}
            {(isPracticum || isAcademic) && (
              <section className={styles.col} data-guide="wj-tomorrow">
                <h3 className={styles.colTitle}>내일 예정 업무</h3>
                <div className={styles.tomorrowList}>
                  {tomorrow.map((t, idx) => (
                    <div key={t.id} className={styles.tomorrowItem}>
                      <span className={styles.tomorrowNum}>{idx + 1}.</span>
                      <AutoSizeTextarea
                        value={t.text}
                        placeholder="내일 할 일을 입력하세요"
                        className={styles.tomorrowInput}
                        onChange={(v) => updateTomorrow(t.id, v)}
                      />
                      <DeleteButton
                        onClick={() => removeTomorrow(t.id)}
                        disabled={t.text.trim() === ""}
                      />
                    </div>
                  ))}
                </div>
                <div className={styles.tomorrowFooter} data-guide="wj-footer">
                  {footerButtons}
                </div>
              </section>
            )}
          </div>

          {/* 업무 센터(default) — 가운데 상담 목록 */}
          {isDefault && (
            <ConsultationList userName={userName} refreshKey={refreshKey} />
          )}

          {/* 업무 센터(default) — 업무일지 드로어 오버레이 */}
          {isDefault && journalDrawerOpen && (
            <div
              className={styles.wjOverlay}
              onClick={() => setJournalDrawerOpen(false)}
            />
          )}
          {/* 업무일지 편집 — default는 우측 드로어, 그 외는 인라인(display:contents) */}
          <div
            className={
              isDefault
                ? `${styles.wjDrawer} ${journalDrawerOpen ? styles.wjDrawerOpen : ""}`
                : styles.wjContents
            }
          >
            {isDefault && (
              <div className={styles.wjDrawerHeader}>
                <span className={styles.wjDrawerTitle}>업무 일지</span>
                <button
                  type="button"
                  className={styles.wjDrawerClose}
                  onClick={() => setJournalDrawerOpen(false)}
                  aria-label="닫기"
                >
                  ✕
                </button>
              </div>
            )}

            {/* 중: 업무 일지 */}
            <section
              className={`${styles.col} ${styles.colJournal}`}
              data-guide="wj-journal"
            >
              <div className={styles.colTitleRow}>
                <h3 className={styles.colTitle}>업무 일지</h3>
                <button
                  type="button"
                  className={styles.guideBtn}
                  onClick={() => startById("work-journal-basics")}
                  data-guide="wj-guide-btn"
                >
                  <HelpCircle size={14} /> 가이드
                </button>
              </div>
              <div className={styles.journalScroll}>
                {/* 오전 / 오후 — 모든 팀 (학사팀도 표시, 이슈 및 요청사항은 상단으로 이동) */}
                {/* 오전 */}
                <div
                  className={`${styles.sectionDropZone} ${dropTarget?.section === "morning" ? styles.sectionDropZoneActive : ""}`}
                  onDragOver={handleSectionDragOver("morning", morning.length)}
                  onDragLeave={handleSectionDragLeave}
                  onDrop={handleSectionDrop("morning")}
                >
                  <div
                    className={styles.sectionTitle}
                    onClick={() => setMorningOpen((v) => !v)}
                  >
                    <span>오전 업무 (10:00 ~ 13:00)</span>
                    <span className={styles.sectionTitleArrow}>
                      {morningOpen ? (
                        <ChevronUp size={14} />
                      ) : (
                        <ChevronDown size={14} />
                      )}
                    </span>
                  </div>
                  {morningOpen && (
                    <>
                      {morning.map((row, i) => {
                        const isDropAbove =
                          dropTarget?.section === "morning" &&
                          dropTarget.insertAt === i;
                        const isDropBelowLast =
                          i === morning.length - 1 &&
                          dropTarget?.section === "morning" &&
                          dropTarget.insertAt === morning.length;
                        return (
                          <div
                            key={row.id}
                            className={`${styles.journalRow} ${isDropAbove ? styles.journalRowDropAbove : ""} ${isDropBelowLast ? styles.journalRowDropBelow : ""}`}
                            draggable
                            onDragStart={(e) => {
                              // input 안에서 시작된 드래그는 텍스트 편집 우선 → 차단
                              const target = e.target as HTMLElement;
                              if (
                                target.closest(
                                  "textarea, input, [data-no-drag]",
                                )
                              ) {
                                e.preventDefault();
                                return;
                              }
                              draggedRowRef.current = {
                                section: "morning",
                                index: i,
                                row,
                              };
                              e.dataTransfer.setData(
                                "text/plain",
                                "__journal_row__",
                              );
                              e.dataTransfer.effectAllowed = "all";
                            }}
                            onDragOver={handleRowDragOver("morning", i)}
                            onDrop={handleSectionDrop("morning")}
                          >
                            <div className={styles.journalRowMain}>
                              <div
                                className={styles.journalCategoryBox}
                                data-guide={i === 0 ? "wj-category" : undefined}
                              >
                                {isAcademic ? (
                                  <input
                                    type="text"
                                    className={styles.journalCategoryInput}
                                    placeholder="업무 분류를 작성해주세요."
                                    value={row.category}
                                    onChange={(e) =>
                                      updateRow("morning", row.id, {
                                        category: e.target.value,
                                      })
                                    }
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={(e) => e.preventDefault()}
                                  />
                                ) : (
                                  <CategorySelect
                                    value={row.category}
                                    options={BIZ_CATEGORY_OPTIONS}
                                    onChange={(v) =>
                                      updateRow("morning", row.id, {
                                        category: v,
                                      })
                                    }
                                  />
                                )}
                              </div>
                              <AutoSizeTextarea
                                className={styles.journalDetailInput}
                                placeholder="세부 업무 내용을 작성해주세요."
                                value={row.detail}
                                onChange={(v) =>
                                  updateRow("morning", row.id, { detail: v })
                                }
                              />
                            </div>
                            <DeleteButton
                              onClick={() => removeRow("morning", row.id)}
                            />
                          </div>
                        );
                      })}
                      <button
                        type="button"
                        className={styles.addBtn}
                        onClick={() => addRow("morning")}
                      >
                        <Plus size={12} /> 추가
                      </button>
                    </>
                  )}
                </div>

                {/* 오후 */}
                <div
                  className={`${styles.sectionDropZone} ${dropTarget?.section === "afternoon" ? styles.sectionDropZoneActive : ""}`}
                  onDragOver={handleSectionDragOver(
                    "afternoon",
                    afternoon.length,
                  )}
                  onDragLeave={handleSectionDragLeave}
                  onDrop={handleSectionDrop("afternoon")}
                >
                  <div
                    className={styles.sectionTitle}
                    onClick={() => setAfternoonOpen((v) => !v)}
                  >
                    <span>오후 업무 (14:00 ~ 19:00)</span>
                    <span className={styles.sectionTitleArrow}>
                      {afternoonOpen ? (
                        <ChevronUp size={14} />
                      ) : (
                        <ChevronDown size={14} />
                      )}
                    </span>
                  </div>
                  {afternoonOpen && (
                    <>
                      {afternoon.map((row, i) => {
                        const isDropAbove =
                          dropTarget?.section === "afternoon" &&
                          dropTarget.insertAt === i;
                        const isDropBelowLast =
                          i === afternoon.length - 1 &&
                          dropTarget?.section === "afternoon" &&
                          dropTarget.insertAt === afternoon.length;
                        return (
                          <div
                            key={row.id}
                            className={`${styles.journalRow} ${isDropAbove ? styles.journalRowDropAbove : ""} ${isDropBelowLast ? styles.journalRowDropBelow : ""}`}
                            draggable
                            onDragStart={(e) => {
                              const target = e.target as HTMLElement;
                              if (
                                target.closest(
                                  "textarea, input, [data-no-drag]",
                                )
                              ) {
                                e.preventDefault();
                                return;
                              }
                              draggedRowRef.current = {
                                section: "afternoon",
                                index: i,
                                row,
                              };
                              e.dataTransfer.setData(
                                "text/plain",
                                "__journal_row__",
                              );
                              e.dataTransfer.effectAllowed = "all";
                            }}
                            onDragOver={handleRowDragOver("afternoon", i)}
                            onDrop={handleSectionDrop("afternoon")}
                          >
                            <div className={styles.journalRowMain}>
                              <div className={styles.journalCategoryBox}>
                                {isAcademic ? (
                                  <input
                                    type="text"
                                    className={styles.journalCategoryInput}
                                    placeholder="업무 분류를 작성해주세요."
                                    value={row.category}
                                    onChange={(e) =>
                                      updateRow("afternoon", row.id, {
                                        category: e.target.value,
                                      })
                                    }
                                  />
                                ) : (
                                  <CategorySelect
                                    value={row.category}
                                    options={BIZ_CATEGORY_OPTIONS}
                                    onChange={(v) =>
                                      updateRow("afternoon", row.id, {
                                        category: v,
                                      })
                                    }
                                  />
                                )}
                              </div>
                              <AutoSizeTextarea
                                className={styles.journalDetailInput}
                                placeholder="세부 업무 내용을 작성해주세요."
                                value={row.detail}
                                onChange={(v) =>
                                  updateRow("afternoon", row.id, { detail: v })
                                }
                              />
                            </div>
                            <DeleteButton
                              onClick={() => removeRow("afternoon", row.id)}
                            />
                          </div>
                        );
                      })}
                      <button
                        type="button"
                        className={styles.addBtn}
                        onClick={() => addRow("afternoon")}
                      >
                        <Plus size={12} /> 추가
                      </button>
                    </>
                  )}
                </div>
              </div>
            </section>

            {/* 우: (실습팀) 실습 연계 입력 + 내일 예정 업무 + 푸터 wrapper */}
            <div className={styles.colRight}>
              {isPracticum && (
                <section className={styles.col}>
                  <h3 className={styles.colTitle}>실습 연계 입력</h3>
                  <div className={styles.practicumForm}>
                    <div className={styles.practicumField}>
                      <label className={styles.practicumLabel}>
                        실습기관 연계
                      </label>
                      <div className={styles.practicumInputWrap}>
                        <input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          className={styles.practicumInput}
                          value={practicum.institution}
                          disabled={isLocked}
                          onChange={(e) =>
                            setPracticum((p) => ({
                              ...p,
                              institution: Math.max(
                                0,
                                Math.floor(Number(e.target.value) || 0),
                              ),
                            }))
                          }
                        />
                        <span className={styles.practicumUnit}>건</span>
                      </div>
                    </div>

                    <div className={styles.practicumField}>
                      <label className={styles.practicumLabel}>
                        실습교육원 연계
                      </label>
                      <div className={styles.practicumInputWrap}>
                        <input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          className={styles.practicumInput}
                          value={practicum.eduCenter}
                          disabled={isLocked}
                          onChange={(e) =>
                            setPracticum((p) => ({
                              ...p,
                              eduCenter: Math.max(
                                0,
                                Math.floor(Number(e.target.value) || 0),
                              ),
                            }))
                          }
                        />
                        <span className={styles.practicumUnit}>건</span>
                      </div>
                    </div>

                    <div
                      className={`${styles.practicumField} ${styles.practicumFieldTotal}`}
                    >
                      <label className={styles.practicumLabel}>
                        일일 연계횟수
                      </label>
                      <div className={styles.practicumInputWrap}>
                        <span className={styles.practicumTotalValue}>
                          {practicumDailyTotal}
                        </span>
                        <span className={styles.practicumUnit}>건</span>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* 업무 센터(default) — 내일예정 파란 접기 헤더 */}
              {isDefault && (
                <div className={styles.wjTomorrowFold}>
                  <span className={styles.wjTomorrowFoldText}>
                    내일예정업무
                  </span>
                  <ChevronDown
                    className={styles.wjTomorrowFoldArrow}
                    size={12}
                  />
                </div>
              )}
              {/* 내일 예정 업무 — 업무센터(default)만 우측 표시 (학사·실습팀은 좌측으로 이동) */}
              {isDefault && (
                <section className={styles.col} data-guide="wj-tomorrow">
                  <h3 className={styles.colTitle}>내일 예정 업무</h3>
                  <div className={styles.tomorrowList}>
                    {tomorrow.map((t, idx) => (
                      <div key={t.id} className={styles.tomorrowItem}>
                        <span className={styles.tomorrowNum}>{idx + 1}.</span>
                        <AutoSizeTextarea
                          value={t.text}
                          placeholder="내일 할 일을 입력하세요"
                          className={styles.tomorrowInput}
                          onChange={(v) => updateTomorrow(t.id, v)}
                        />
                        <DeleteButton
                          onClick={() => removeTomorrow(t.id)}
                          disabled={t.text.trim() === ""}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* 푸터 — default(업무센터)만 우측에 노출. 학사·실습팀은 좌측 '내일 예정' 카드 안으로 이동 */}
              {isDefault && (
                <div className={styles.footer} data-guide="wj-footer">
                  {footerButtons}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 업무 센터(default) — 캘린더 팝업 (본인 연락예정 일정) */}
      {calendarOpen && (
        <div
          className={styles.calModalOverlay}
          onClick={() => setCalendarOpen(false)}
        >
          <div className={styles.calModal} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={styles.calModalClose}
              onClick={() => setCalendarOpen(false)}
              aria-label="닫기"
            >
              ✕
            </button>
            <Calendar
              events={calEvents}
              today={calToday}
              hideAddEvent
              hideSideNav
              onSelectEvent={(id) => {
                const m = /^contact-(\d+)$/.exec(id);
                if (m) router.push(`/hakjeom?id=${m[1]}`);
              }}
            />
          </div>
        </div>
      )}

      {/* 학사팀 — 이번주 목표 설정 모달 */}
      {goalModalOpen && (
        <div
          className={styles.goalModalOverlay}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeGoalModal();
          }}
        >
          <div className={styles.goalModal}>
            <div className={styles.goalModalHeader}>
              <h3 className={styles.goalModalTitle}>이번주 목표 설정</h3>
              <button
                type="button"
                className={styles.goalModalClose}
                onClick={closeGoalModal}
                aria-label="닫기"
              >
                ✕
              </button>
            </div>

            <div className={styles.goalModalBody}>
              {tempGoals.length === 0 ? (
                <div className={styles.goalModalEmpty}>
                  추가된 목표가 없습니다. 아래 &quot;+ 목표 추가&quot; 버튼으로
                  시작하세요.
                </div>
              ) : (
                tempGoals.map((g, i) => {
                  const isUndefined = g.date === "미정";
                  const isIsoDate = /^\d{4}-\d{2}-\d{2}$/.test(g.date);
                  return (
                    <div key={g.id} className={styles.goalModalRow}>
                      <span className={styles.goalModalRowIndex}>{i + 1}</span>
                      <input
                        type="date"
                        className={styles.goalModalDateInput}
                        // YYYY-MM-DD 만 input[type=date] 가 받음
                        value={isIsoDate ? g.date : ""}
                        onChange={(e) =>
                          updateTempGoal(g.id, { date: e.target.value })
                        }
                        disabled={isUndefined}
                      />
                      <button
                        type="button"
                        className={`${styles.goalModalUndefinedBtn} ${isUndefined ? styles.goalModalUndefinedBtnOn : ""}`}
                        onClick={() =>
                          updateTempGoal(g.id, {
                            date: isUndefined ? "" : "미정",
                          })
                        }
                        title="날짜 미정"
                      >
                        미정
                      </button>
                      <input
                        type="text"
                        className={styles.goalModalTextInput}
                        placeholder="목표 내용"
                        value={g.text}
                        onChange={(e) =>
                          updateTempGoal(g.id, { text: e.target.value })
                        }
                      />
                      <button
                        type="button"
                        className={styles.goalModalRowRemove}
                        onClick={() => removeTempGoal(g.id)}
                        aria-label="삭제"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })
              )}

              <button
                type="button"
                className={styles.goalModalAddBtn}
                onClick={addTempGoal}
              >
                <Plus size={14} /> 목표 추가
              </button>
            </div>

            <div className={styles.goalModalFooter}>
              <button
                type="button"
                className={styles.goalModalCancel}
                onClick={closeGoalModal}
              >
                취소
              </button>
              <button
                type="button"
                className={styles.goalModalSave}
                onClick={saveGoalModal}
                disabled={goalSaving}
              >
                {goalSaving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
