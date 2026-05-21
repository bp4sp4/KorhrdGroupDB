import { useState, useEffect, useRef } from "react";
import styles from "../page.module.css";
import { DateInput } from "@/components/ui/Calendar/DateInput";
import MemoTimeline from "@/components/ui/MemoTimeline";
import type { ConsultationStatus, HakjeomConsultation } from "../_types";
import {
  CONSULTATION_STATUS_STYLE,
  COUNSEL_CHECK_OPTIONS,
  CURRENT_SITUATION_OPTIONS,
  EDUCATION_CUSTOM,
  EDUCATION_OPTIONS,
  HAKJEOM_COURSE_OPTIONS,
  HOPE_COURSE_CUSTOM,
  REACTION_POINT_MAP,
  REASON_OPTIONS,
  REFERRER_CARD_META,
  SHOW_AUTO_REACTION_TOAST,
  SOURCE_MAJORS,
} from "../_constants";
import { CAFE_NAME_LIST, CAFE_NAMES, parseClickSource } from "../_cafe";
import { formatDateShort, formatPhoneNumber } from "../_utils";
import { matchReactionPoints } from "../_constants";
import { StatusBadge } from "../_components/StatusBadge";

// 당근 sub-panel의 기본 옵션
const DANGGEUN_DEFAULT_OPTIONS = ["채팅", "소식", "대표전화", "폼"];

// 반응포인트 카테고리 이모지
const REACTION_GROUP_EMOJI: Record<string, string> = {
  가격: "💰",
  취업: "💼",
  실습: "🎯",
  신뢰: "🤝",
  과정: "📚",
  무반응: "😶",
};

// child(세부 반응포인트) → emoji 매핑 (소속된 parent의 이모지)
function getReactionEmoji(child: string): string {
  for (const [parent, children] of Object.entries(REACTION_POINT_MAP)) {
    if (children.includes(child)) return REACTION_GROUP_EMOJI[parent] ?? "";
  }
  return "";
}

// 지인소개 전용 상태 (지인등록/지인대기/지인취소) — 이 상태면 상세 패널에서
// 유입경로를 "지인소개"로 자동 활성화하고 지인 카드형 상태 UI를 사용
const REFERRAL_STATUSES = ["지인대기", "지인등록", "지인취소"] as const;
function isReferralStatus(status: string): boolean {
  return (REFERRAL_STATUSES as readonly string[]).includes(status);
}

// 상태 카드 아이콘
function StatusCardIcon({ status }: { status: string }) {
  const common = {
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
  };
  if (status === "상담대기") {
    return (
      <svg {...common}>
        <path
          d="M12 2C17.523 2 22 6.477 22 12C22 17.523 17.523 22 12 22C6.477 22 2 17.523 2 12C2 6.477 6.477 2 12 2ZM12 4C9.87827 4 7.84344 4.84285 6.34315 6.34315C4.84285 7.84344 4 9.87827 4 12C4 14.1217 4.84285 16.1566 6.34315 17.6569C7.84344 19.1571 9.87827 20 12 20C14.1217 20 16.1566 19.1571 17.6569 17.6569C19.1571 16.1566 20 14.1217 20 12C20 9.87827 19.1571 7.84344 17.6569 6.34315C16.1566 4.84285 14.1217 4 12 4ZM12 6C12.2449 6.00003 12.4813 6.08996 12.6644 6.25272C12.8474 6.41547 12.9643 6.63975 12.993 6.883L13 7V11.586L15.707 14.293C15.8863 14.473 15.9905 14.7144 15.9982 14.9684C16.006 15.2223 15.9168 15.4697 15.7488 15.6603C15.5807 15.8508 15.3464 15.9703 15.0935 15.9944C14.8406 16.0185 14.588 15.9454 14.387 15.79L14.293 15.707L11.293 12.707C11.1376 12.5514 11.0378 12.349 11.009 12.131L11 12V7C11 6.73478 11.1054 6.48043 11.2929 6.29289C11.4804 6.10536 11.7348 6 12 6Z"
          fill="currentColor"
        />
      </svg>
    );
  }
  if (status === "상담완료") {
    return (
      <svg {...common}>
        <path
          d="M10.6 13.8L8.45 11.65C8.26667 11.4667 8.03333 11.375 7.75 11.375C7.46667 11.375 7.23334 11.4667 7.05 11.65C6.86667 11.8333 6.775 12.0667 6.775 12.35C6.775 12.6333 6.86667 12.8667 7.05 13.05L9.9 15.9C10.1 16.1 10.3333 16.2 10.6 16.2C10.8667 16.2 11.1 16.1 11.3 15.9L16.95 10.25C17.1333 10.0667 17.225 9.83333 17.225 9.55C17.225 9.26667 17.1333 9.03333 16.95 8.85C16.7667 8.66667 16.5333 8.575 16.25 8.575C15.9667 8.575 15.7333 8.66667 15.55 8.85L10.6 13.8ZM12 22C10.6167 22 9.31667 21.7373 8.1 21.212C6.88334 20.6867 5.825 19.9743 4.925 19.075C4.025 18.1757 3.31267 17.1173 2.788 15.9C2.26333 14.6827 2.00067 13.3827 2 12C1.99933 10.6173 2.262 9.31733 2.788 8.1C3.314 6.88267 4.02633 5.82433 4.925 4.925C5.82367 4.02567 6.882 3.31333 8.1 2.788C9.318 2.26267 10.618 2 12 2C13.382 2 14.682 2.26267 15.9 2.788C17.118 3.31333 18.1763 4.02567 19.075 4.925C19.9737 5.82433 20.6863 6.88267 21.213 8.1C21.7397 9.31733 22.002 10.6173 22 12C21.998 13.3827 21.7353 14.6827 21.212 15.9C20.6887 17.1173 19.9763 18.1757 19.075 19.075C18.1737 19.9743 17.1153 20.687 15.9 21.213C14.6847 21.739 13.3847 22.0013 12 22ZM12 20C14.2333 20 16.125 19.225 17.675 17.675C19.225 16.125 20 14.2333 20 12C20 9.76667 19.225 7.875 17.675 6.325C16.125 4.775 14.2333 4 12 4C9.76667 4 7.875 4.775 6.325 6.325C4.775 7.875 4 9.76667 4 12C4 14.2333 4.775 16.125 6.325 17.675C7.875 19.225 9.76667 20 12 20Z"
          fill="currentColor"
        />
      </svg>
    );
  }
  if (status === "부재중/추후통화") {
    return (
      <svg {...common}>
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M11.8005 2.52051C12.0897 2.52054 12.3792 2.53814 12.6658 2.57422L12.9519 2.61621L12.9539 2.61719C13.186 2.66035 13.3928 2.79221 13.5281 2.98535C13.6634 3.17865 13.717 3.41794 13.6775 3.65039C13.6379 3.8828 13.5078 4.09061 13.3162 4.22852C13.1244 4.36632 12.8856 4.42342 12.6521 4.3877H12.6502C11.9602 4.27041 11.2529 4.2974 10.574 4.4668C9.89484 4.63637 9.25797 4.94535 8.70484 5.37305C8.15172 5.80084 7.69356 6.33866 7.36011 6.95215C7.02668 7.56573 6.82462 8.24208 6.76734 8.9375L6.5564 11.4961C6.46367 12.6185 6.10581 13.7037 5.51246 14.6621L4.94214 15.582C4.75794 15.88 4.78822 16.0612 4.8064 16.1094L4.82105 16.1377C4.82946 16.1496 4.84246 16.1633 4.86207 16.1777C4.90302 16.2078 4.98026 16.2447 5.12379 16.2637C6.31808 16.4221 8.35962 16.5703 11.8005 16.5703C15.2418 16.5703 17.2844 16.4221 18.4783 16.2637C18.6219 16.2446 18.6993 16.2078 18.74 16.1777C18.7783 16.1493 18.7899 16.1229 18.7947 16.1104L18.8074 16.0488C18.815 15.9635 18.7973 15.8054 18.6589 15.582L18.0896 14.6611C17.8513 14.2767 17.6504 13.8713 17.49 13.4512C17.405 13.2285 17.4117 12.9811 17.5095 12.7637C17.6074 12.5464 17.7884 12.3767 18.0115 12.292C18.2347 12.2075 18.4831 12.2141 18.7009 12.3115C18.9187 12.409 19.0895 12.5889 19.1746 12.8115C19.2949 13.127 19.4449 13.4306 19.6228 13.7178L20.1931 14.6387C20.586 15.2733 20.7484 16.0418 20.4802 16.7471C20.1984 17.488 19.5252 17.9372 18.7156 18.0449C17.9829 18.1421 16.9888 18.2301 15.6404 18.29C15.3086 20.1041 13.7166 21.4792 11.8015 21.4795C9.88528 21.4795 8.29284 20.1043 7.9607 18.29C6.61256 18.2301 5.61847 18.1421 4.8855 18.0449C4.07589 17.9376 3.40369 17.4879 3.12183 16.7471C2.8535 16.0417 3.01635 15.2733 3.40894 14.6387L3.97925 13.7178C4.42336 13.0005 4.69129 12.1886 4.7605 11.3486L4.97144 8.79004C5.26388 5.24689 8.2343 2.52072 11.8005 2.52051ZM13.9529 18.4033C13.2456 18.4289 12.5105 18.4453 11.7634 18.4453C11.0344 18.4453 10.318 18.4288 9.62867 18.4043C9.99074 19.2673 10.8218 19.872 11.7908 19.8721C12.7601 19.8719 13.5911 19.2668 13.9529 18.4033Z"
          fill="currentColor"
        />
        <path
          d="M13.7371 8.1084C13.9077 8.10863 14.0754 8.15679 14.2195 8.24805C14.3637 8.33958 14.4799 8.47057 14.5525 8.625C14.6251 8.77945 14.6514 8.95191 14.6296 9.12109C14.6078 9.29021 14.5378 9.45001 14.4285 9.58105L12.99 11.3018H14.0037C14.2422 11.302 14.4716 11.3962 14.6404 11.5645C14.8091 11.7327 14.9039 11.9612 14.9041 12.1992C14.9041 12.4374 14.8092 12.6666 14.6404 12.835C14.4716 13.0032 14.2422 13.0974 14.0037 13.0977H11.0662C10.8952 13.0976 10.7271 13.0494 10.5828 12.958C10.4384 12.8665 10.3234 12.7355 10.2507 12.5811C10.1781 12.4265 10.1508 12.2543 10.1726 12.085C10.1945 11.9158 10.2644 11.7561 10.3738 11.625L11.8123 9.9043H10.7996C10.5608 9.90429 10.3308 9.80993 10.1619 9.6416C9.99315 9.47328 9.8983 9.24491 9.8982 9.00684C9.89823 8.76862 9.99302 8.53948 10.1619 8.37109C10.3308 8.20284 10.5609 8.1084 10.7996 8.1084H13.7371Z"
          fill="currentColor"
        />
        <path
          d="M19.7097 4.51562C19.8807 4.5157 20.0488 4.5648 20.1931 4.65625C20.3374 4.74778 20.4525 4.87876 20.5252 5.0332C20.5978 5.18773 20.6251 5.36003 20.6033 5.5293C20.5813 5.69844 20.5115 5.85823 20.4021 5.98926L17.6287 9.30566H20.1101C20.3487 9.30578 20.578 9.40021 20.7468 9.56836C20.9157 9.73675 21.0114 9.96587 21.0115 10.2041C21.0114 10.4422 20.9156 10.6705 20.7468 10.8389C20.5779 11.0072 20.3488 11.1025 20.1101 11.1025H15.7048C15.5338 11.1025 15.3658 11.0534 15.2214 10.9619C15.0771 10.8704 14.9621 10.7395 14.8894 10.585C14.8168 10.4304 14.7894 10.2582 14.8113 10.0889C14.8332 9.91968 14.903 9.75995 15.0125 9.62891L17.7859 6.3125H15.3044C15.0657 6.3125 14.8357 6.21813 14.6668 6.0498C14.4978 5.88137 14.4031 5.6524 14.4031 5.41406C14.4031 5.17599 14.4981 4.94764 14.6668 4.7793C14.8357 4.61105 15.0657 4.51562 15.3044 4.51562H19.7097Z"
          fill="currentColor"
        />
      </svg>
    );
  }
  if (status === "장기가망") {
    return (
      <svg {...common}>
        <path
          d="M14.2535 17.4981C14.7015 17.4981 15.0651 17.8616 15.0651 18.3097C15.0651 18.7577 14.7015 19.1213 14.2535 19.1213H9.74656C9.29852 19.1213 8.93496 18.7577 8.93496 18.3097C8.93496 17.8616 9.29852 17.4981 9.74656 17.4981H14.2535Z"
          fill="currentColor"
        />
        <path
          d="M13.3521 7.13219C13.8001 7.13219 14.1637 7.49575 14.1637 7.94378C14.1637 8.39182 13.8001 8.75538 13.3521 8.75538H10.6479C10.1999 8.75538 9.83634 8.39182 9.83634 7.94378C9.83634 7.49575 10.1999 7.13219 10.6479 7.13219H13.3521Z"
          fill="currentColor"
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M19.6618 2.17459C20.1098 2.17459 20.4733 2.53815 20.4733 2.98619C20.4733 3.43422 20.1098 3.79778 19.6618 3.79778H18.5192C17.9268 6.53109 17.1552 8.68048 16.1733 10.1911C15.6821 10.9468 15.1224 11.5578 14.4973 12.0009C15.1226 12.4446 15.6818 13.0572 16.1733 13.8133C17.155 15.3237 17.9259 17.4715 18.5183 20.2022H19.6618C20.1098 20.2022 20.4733 20.5658 20.4733 21.0138C20.4733 21.4619 20.1098 21.8254 19.6618 21.8254H4.33827C3.89023 21.8254 3.52667 21.4619 3.52667 21.0138C3.52667 20.5658 3.89023 20.2022 4.33827 20.2022H5.48084C6.07327 17.4689 6.84483 15.3195 7.82672 13.8089C8.31791 13.0533 8.87684 12.4413 9.50184 11.9982C8.87694 11.5546 8.31796 10.9424 7.82672 10.1867C6.845 8.67629 6.07415 6.52846 5.48172 3.79778H4.33827C3.89023 3.79778 3.52667 3.43422 3.52667 2.98619C3.52667 2.53815 3.89023 2.17459 4.33827 2.17459H19.6618ZM11.9991 12.8116C11.0087 12.8106 10.0686 13.3382 9.18759 14.6936C8.39404 15.9144 7.70352 17.7348 7.14364 20.2022H16.8564C16.2966 17.7375 15.6059 15.9188 14.8124 14.698C13.9312 13.3422 12.9904 12.8126 11.9991 12.8116ZM7.14364 3.79778C7.70344 6.26245 8.39412 8.08122 9.18759 9.30202C10.0688 10.6578 11.0096 11.1874 12.0009 11.1884C12.9913 11.1894 13.9314 10.6618 14.8124 9.30642C15.606 8.08556 16.2965 6.26522 16.8564 3.79778H7.14364Z"
          fill="currentColor"
        />
      </svg>
    );
  }
  if (status === "등록완료") {
    return (
      <svg {...common}>
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M8.25097 3.9502C9.26262 3.9502 10.2509 4.25395 11.0879 4.82227C11.9248 5.39063 12.5722 6.1973 12.9453 7.1377C13.3184 8.07806 13.4003 9.10915 13.1807 10.0967C12.961 11.0842 12.4493 11.9832 11.7129 12.6768L11.5019 12.875L11.7627 13.002C13.0572 13.6324 14.1583 14.597 14.956 15.7959C15.7537 16.9947 16.2174 18.3847 16.2988 19.8223C16.3057 19.9435 16.289 20.065 16.249 20.1797C16.209 20.2944 16.1472 20.4005 16.0664 20.4912C15.9857 20.5818 15.8875 20.6552 15.7783 20.708C15.669 20.7608 15.5499 20.7918 15.4287 20.7988C15.3074 20.8058 15.1851 20.789 15.0703 20.749C14.9557 20.709 14.8504 20.6462 14.7598 20.5654C14.6691 20.4846 14.5948 20.3867 14.542 20.2773C14.4892 20.168 14.4581 20.049 14.4512 19.9277C14.3649 18.3412 13.6745 16.8481 12.5215 15.7549C11.3681 14.6615 9.83925 14.051 8.24999 14.0498C6.66082 14.0511 5.13279 14.6616 3.97948 15.7549C2.82635 16.8481 2.13504 18.3411 2.04882 19.9277C2.04194 20.0489 2.01165 20.168 1.95897 20.2773C1.90619 20.3868 1.83185 20.4855 1.7412 20.5664C1.6507 20.6471 1.54511 20.709 1.43065 20.749C1.31605 20.789 1.19443 20.8066 1.07323 20.7998C0.951971 20.7929 0.83303 20.7617 0.723623 20.709C0.614175 20.6562 0.515478 20.5828 0.434561 20.4922C0.353672 20.4016 0.292 20.2954 0.251944 20.1807C0.211903 20.066 0.194281 19.9445 0.201162 19.8232C0.282365 18.3853 0.746251 16.995 1.54394 15.7959C2.34158 14.5969 3.44457 13.6325 4.73925 13.002L4.99999 12.875L4.78905 12.6768C4.05258 11.9832 3.54096 11.0842 3.32128 10.0967C3.10164 9.10916 3.18359 8.07805 3.55663 7.1377C3.92973 6.1973 4.57709 5.39063 5.41405 4.82227C6.25099 4.25392 7.2393 3.95021 8.25097 3.9502ZM8.25487 5.7998C7.82885 5.79017 7.40521 5.86615 7.00878 6.02246C6.61226 6.17885 6.25013 6.413 5.9453 6.71094C5.64062 7.00882 5.39875 7.3651 5.23339 7.75781C5.06811 8.15045 4.98257 8.57204 4.98241 8.99805C4.98231 9.42417 5.06729 9.84643 5.23241 10.2393C5.39757 10.632 5.63981 10.9881 5.94433 11.2861C6.249 11.5842 6.61039 11.819 7.00683 11.9756C7.40318 12.1321 7.82687 12.2076 8.25292 12.1982C9.08895 12.1798 9.88487 11.835 10.4697 11.2373C11.0546 10.6395 11.3826 9.8363 11.3828 9C11.383 8.16371 11.0552 7.36076 10.4707 6.7627C9.88615 6.16464 9.09093 5.81872 8.25487 5.7998Z"
          fill="currentColor"
        />
        <path
          d="M19.875 0.200195C20.1202 0.200195 20.3558 0.297328 20.5293 0.470703C20.7028 0.644174 20.8008 0.879675 20.8008 1.125V3.2002H22.875C23.1202 3.2002 23.3558 3.29733 23.5293 3.4707C23.7028 3.64417 23.8008 3.87967 23.8008 4.125C23.8008 4.37033 23.7028 4.60583 23.5293 4.7793C23.3558 4.95267 23.1202 5.0498 22.875 5.0498H20.8008V7.125C20.8008 7.37033 20.7028 7.60583 20.5293 7.7793C20.3558 7.95267 20.1202 8.0498 19.875 8.0498C19.6299 8.04972 19.395 7.95249 19.2217 7.7793C19.0482 7.60583 18.9502 7.37033 18.9502 7.125V5.0498H16.875C16.6299 5.04972 16.395 4.95249 16.2217 4.7793C16.0482 4.60583 15.9502 4.37033 15.9502 4.125C15.9502 3.87967 16.0482 3.64417 16.2217 3.4707C16.395 3.29751 16.6299 3.20028 16.875 3.2002H18.9502V1.125C18.9502 0.879675 19.0482 0.644174 19.2217 0.470703C19.395 0.297513 19.6299 0.200277 19.875 0.200195Z"
          fill="currentColor"
        />
      </svg>
    );
  }
  if (status === "수신거부") {
    return (
      <svg {...common}>
        <path
          d="M19.1573 12C19.1573 11.0601 18.9718 10.1293 18.6121 9.26096C18.2524 8.39266 17.7259 7.60325 17.0613 6.93867C16.3968 6.2741 15.6073 5.74755 14.739 5.38786C13.8707 5.02817 12.9399 4.84268 12 4.84268C11.0601 4.84268 10.1293 5.02817 9.26096 5.38786C8.6696 5.63283 8.11582 5.95635 7.61229 6.34718L17.6519 16.3868C18.0427 15.8833 18.3672 15.3303 18.6121 14.739C18.9718 13.8707 19.1573 12.9399 19.1573 12ZM4.84268 12C4.84268 12.9399 5.02817 13.8707 5.38786 14.739C5.74755 15.6073 6.2741 16.3968 6.93867 17.0613C7.60325 17.7259 8.39266 18.2524 9.26096 18.6121C10.1293 18.9718 11.0601 19.1573 12 19.1573C12.9399 19.1573 13.8707 18.9718 14.739 18.6121C15.3303 18.3672 15.8833 18.0427 16.3868 17.6519L6.34718 7.61229C5.95635 8.11582 5.63283 8.6696 5.38786 9.26096C5.02817 10.1293 4.84268 11.0601 4.84268 12ZM20.9467 12C20.9467 13.1749 20.7157 14.3386 20.266 15.424C19.8164 16.5094 19.1572 17.4957 18.3264 18.3264C17.4957 19.1572 16.5094 19.8164 15.424 20.266C14.3386 20.7157 13.1749 20.9467 12 20.9467C10.8251 20.9467 9.66144 20.7157 8.57598 20.266C7.49056 19.8164 6.50431 19.1572 5.67356 18.3264C4.84281 17.4957 4.18357 16.5094 3.73395 15.424C3.28434 14.3386 3.05334 13.1749 3.05334 12C3.05334 10.8251 3.28434 9.66144 3.73395 8.57598C4.18357 7.49056 4.84281 6.50431 5.67356 5.67356C6.50431 4.84281 7.49056 4.18357 8.57598 3.73395C9.66144 3.28434 10.8251 3.05334 12 3.05334C13.1749 3.05334 14.3386 3.28434 15.424 3.73395C16.5094 4.18357 17.4957 4.84281 18.3264 5.67356C19.1572 6.50431 19.8164 7.49056 20.266 8.57598C20.7157 9.66144 20.9467 10.8251 20.9467 12Z"
          fill="currentColor"
        />
      </svg>
    );
  }
  // 기타 (default)
  return (
    <svg {...common}>
      <path
        d="M16.8 12.3C16.8 11.9022 16.958 11.5206 17.2393 11.2393C17.5206 10.958 17.9022 10.8 18.3 10.8C18.6978 10.8 19.0793 10.958 19.3607 11.2393C19.642 11.5206 19.8 11.9022 19.8 12.3C19.8 12.6978 19.642 13.0793 19.3607 13.3606C19.0793 13.642 18.6978 13.8 18.3 13.8C17.9022 13.8 17.5206 13.642 17.2393 13.3606C16.958 13.0793 16.8 12.6978 16.8 12.3ZM10.8 12.3C10.8 11.9022 10.958 11.5206 11.2393 11.2393C11.5206 10.958 11.9022 10.8 12.3 10.8C12.6978 10.8 13.0793 10.958 13.3606 11.2393C13.642 11.5206 13.8 11.9022 13.8 12.3C13.8 12.6978 13.642 13.0793 13.3606 13.3606C13.0793 13.642 12.6978 13.8 12.3 13.8C11.9022 13.8 11.5206 13.642 11.2393 13.3606C10.958 13.0793 10.8 12.6978 10.8 12.3ZM4.79999 12.3C4.79999 11.9022 4.95802 11.5206 5.23933 11.2393C5.52063 10.958 5.90216 10.8 6.29999 10.8C6.69781 10.8 7.07934 10.958 7.36065 11.2393C7.64195 11.5206 7.79999 11.9022 7.79999 12.3C7.79999 12.6978 7.64195 13.0793 7.36065 13.3606C7.07934 13.642 6.69781 13.8 6.29999 13.8C5.90216 13.8 5.52063 13.642 5.23933 13.3606C4.95802 13.0793 4.79999 12.6978 4.79999 12.3Z"
        fill="currentColor"
      />
    </svg>
  );
}

// 현재상황 select
function SituationSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className={styles.situationSelectWrap} ref={ref}>
      <button
        type="button"
        className={`${styles.situationSelectTrigger} ${value ? styles.situationSelectTriggerActive : ""}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span>{value || "선택"}</span>
        <svg
          className={`${styles.situationSelectChevron} ${open ? styles.situationSelectChevronOpen : ""}`}
          xmlns="http://www.w3.org/2000/svg"
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
        >
          <path
            d="M8.97371 2.79041C8.8565 2.67324 8.69756 2.60742 8.53183 2.60742C8.3661 2.60742 8.20716 2.67324 8.08996 2.79041L4.99621 5.88416L1.90246 2.79041C1.78458 2.67656 1.6267 2.61357 1.46283 2.61499C1.29896 2.61642 1.1422 2.68215 1.02632 2.79803C0.910439 2.91391 0.844709 3.07066 0.843285 3.23454C0.841861 3.39841 0.904858 3.55629 1.01871 3.67416L4.55433 7.20979C4.67154 7.32696 4.83048 7.39278 4.99621 7.39278C5.16193 7.39278 5.32088 7.32696 5.43808 7.20979L8.97371 3.67416C9.09088 3.55696 9.1567 3.39802 9.1567 3.23229C9.1567 3.06656 9.09088 2.90762 8.97371 2.79041Z"
            fill="#8D99A5"
          />
        </svg>
      </button>
      {open && (
        <div className={styles.situationSelectDropdown}>
          <button
            type="button"
            className={`${styles.situationSelectOption} ${!value ? styles.situationSelectOptionActive : ""}`}
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
          >
            선택
          </button>
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              className={`${styles.situationSelectOption} ${value === opt ? styles.situationSelectOptionActive : ""}`}
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// 희망과정 — 단순 select. 직접 입력 옵션 선택 시 부모에 알려서 옆 input 활성화.
function HopeCourseSelect({
  value,
  onChange,
  isCustom = false,
  onSelectCustom,
}: {
  value: string;
  onChange: (v: string) => void;
  isCustom?: boolean;
  onSelectCustom?: () => void;
}) {
  const presets = HAKJEOM_COURSE_OPTIONS.filter(
    (o) => o !== HOPE_COURSE_CUSTOM,
  );
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const displayValue = isCustom ? HOPE_COURSE_CUSTOM : value || "선택";
  const hasValue = isCustom || !!value;

  return (
    <div className={styles.eduSelectTriggerWrap} ref={ref}>
      <button
        type="button"
        className={`${styles.eduSelectTrigger} ${hasValue ? styles.eduSelectActive : ""}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span
          style={{
            flex: 1,
            textAlign: "left",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {displayValue}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`${styles.eduSelectChevron} ${open ? styles.eduSelectChevronOpen : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className={styles.eduSelectDropdown}>
          {presets.map((opt) => (
            <button
              key={opt}
              type="button"
              className={`${styles.eduSelectOption} ${!isCustom && value === opt ? styles.eduSelectOptionActive : ""}`}
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
            >
              {opt}
            </button>
          ))}
          <button
            type="button"
            className={`${styles.eduSelectOption} ${isCustom ? styles.eduSelectOptionActive : ""}`}
            onClick={() => {
              onSelectCustom?.();
              setOpen(false);
            }}
          >
            {HOPE_COURSE_CUSTOM}
          </button>
        </div>
      )}
    </div>
  );
}

function EducationSelect({
  value,
  onChange,
  isCustom = false,
  onSelectCustom,
}: {
  value: string;
  onChange: (v: string) => void;
  isCustom?: boolean;
  onSelectCustom?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const displayValue = isCustom ? EDUCATION_CUSTOM : value || "선택";
  const hasValue = isCustom || !!value;

  return (
    <div className={styles.eduSelectTriggerWrap} ref={ref}>
      <button
        type="button"
        className={`${styles.eduSelectTrigger} ${hasValue ? styles.eduSelectActive : ""}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span>{displayValue}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`${styles.eduSelectChevron} ${open ? styles.eduSelectChevronOpen : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className={styles.eduSelectDropdown}>
          {EDUCATION_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              className={`${styles.eduSelectOption} ${!isCustom && value === opt ? styles.eduSelectOptionActive : ""}`}
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
            >
              {opt}
            </button>
          ))}
          <button
            type="button"
            className={`${styles.eduSelectOption} ${isCustom ? styles.eduSelectOptionActive : ""}`}
            onClick={() => {
              onSelectCustom?.();
              setOpen(false);
            }}
          >
            {EDUCATION_CUSTOM}
          </button>
        </div>
      )}
    </div>
  );
}

interface HakjeomDetailPanelProps {
  item: HakjeomConsultation;
  onClose: () => void;
  onUpdate: (id: number, fields: Partial<HakjeomConsultation>) => Promise<void>;
  initialTab?: "basic" | "info";
  customCafes: string[];
  customDanggeun: string[];
  onAddCafe: (name: string) => Promise<void>;
  onDeleteCafe: (name: string) => Promise<void>;
  onAddDanggeun: (name: string) => Promise<void>;
  onDeleteDanggeun: (name: string) => Promise<void>;
  hideManager?: boolean;
}

export function HakjeomDetailPanel({
  item,
  onClose,
  onUpdate,
  initialTab = "basic",
  customCafes,
  customDanggeun,
  onAddCafe,
  onDeleteCafe,
  onAddDanggeun,
  onDeleteDanggeun,
  hideManager = false,
}: HakjeomDetailPanelProps) {
  const initSource = (src: string | null): { major: string; minor: string } => {
    // parseClickSource 내부에서 major 정규화(meta/insta/facebook → 인스타·페이스북) 처리됨
    const { major, minor } = parseClickSource(src, customCafes);
    return { major, minor: CAFE_NAMES[minor] ?? minor };
  };

  const initStatusEtc =
    item.status.startsWith("기타(") && item.status.endsWith(")")
      ? item.status.slice(3, -1)
      : "";
  const initStatus = item.status.startsWith("기타(")
    ? "기타"
    : (item.status as ConsultationStatus);
  const [editStatus, setEditStatus] = useState<ConsultationStatus>(initStatus);
  const [editStatusEtc, setEditStatusEtc] = useState(initStatusEtc);
  const [editMemo, setEditMemo] = useState(item.memo ?? "");
  const [editManager, setEditManager] = useState(item.manager ?? "");
  const [editEducation, setEditEducation] = useState(item.education ?? "");
  const [editEducationExtra, setEditEducationExtra] = useState("");
  const [editHopeCourseExtra, setEditHopeCourseExtra] = useState("");
  const [isEducationCustom, setIsEducationCustom] = useState(false);
  const [isHopeCourseCustom, setIsHopeCourseCustom] = useState(false);
  const [editHopeCourse, setEditHopeCourse] = useState<string[]>(
    item.hope_course
      ? item.hope_course
          .split(", ")
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
  );
  const [editReason, setEditReason] = useState<string[]>(
    item.reason
      ? item.reason
          .split(", ")
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
  );
  const parseCounselCheck = (raw: string | null) => {
    if (!raw) return { checks: [], etc: "" };
    const items = raw
      .split(", ")
      .map((s) => s.trim())
      .filter(Boolean);
    const etcItem = items.find((s) => s.startsWith("기타(") && s.endsWith(")"));
    const checks = items.map((s) =>
      s.startsWith("기타(") && s.endsWith(")") ? "기타" : s,
    );
    const etc = etcItem
      ? etcItem.slice(3, -1)
      : items.includes("기타")
        ? ""
        : "";
    return { checks, etc };
  };
  const initCounsel = parseCounselCheck(item.counsel_check);
  const [editCounselCheck, setEditCounselCheck] = useState<string[]>(
    initCounsel.checks,
  );
  const [editCounselCheckEtc, setEditCounselCheckEtc] = useState(
    initCounsel.etc,
  );
  const [editSourceMajor, setEditSourceMajor] = useState(() => {
    const m = initSource(item.click_source).major;
    // 유입경로가 비어있고 상태가 지인-관련이면 "지인소개"로 자동 활성화
    if (!m && isReferralStatus(item.status)) return "지인소개";
    return m;
  });
  const [editSourceMinor, setEditSourceMinor] = useState(
    () => initSource(item.click_source).minor,
  );
  const [editResidence, setEditResidence] = useState(item.residence ?? "");
  const [editSubjectCost, setEditSubjectCost] = useState(
    item.subject_cost ? String(item.subject_cost) : "",
  );
  const [editCurrentSituation, setEditCurrentSituation] = useState(() => {
    const v = item.current_situation ?? "";
    const known = ["주부", "직장인", "자영업자", "대학생"];
    if (v && !known.includes(v)) return "기타";
    return v;
  });
  const [editCurrentSituationEtc, setEditCurrentSituationEtc] = useState(() => {
    const v = item.current_situation ?? "";
    const known = ["주부", "직장인", "자영업자", "대학생"];
    return v && !known.includes(v) ? v : "";
  });
  const [editReactionPoint, setEditReactionPoint] = useState<string[]>(
    item.reaction_point
      ? item.reaction_point
          .split(", ")
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
  );
  const [reactionParentTab, setReactionParentTab] = useState<string>("");
  const [editContact, setEditContact] = useState(item.contact ?? "");

  // 중복 데이터 카운트 (이름 + 전화번호 동일, 본인 제외)
  const [duplicateCount, setDuplicateCount] = useState<number>(0);
  useEffect(() => {
    const name = (item.name || "").trim();
    const phone = (editContact || item.contact || "").trim();
    if (!name || !phone) {
      setDuplicateCount(0);
      return;
    }
    const params = new URLSearchParams({
      name,
      phone,
      exclude_id: String(item.id),
    });
    let cancelled = false;
    fetch(`/api/hakjeom/duplicates?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        setDuplicateCount(Number(data?.count ?? 0));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [item.id, item.name, item.contact, editContact]);
  const [editName, setEditName] = useState(item.name ?? "");
  const [isEditingName, setIsEditingName] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"basic" | "info">(initialTab);
  const [autoReactionToast, setAutoReactionToast] = useState<string[]>([]);
  const autoReactionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const handleMemoAdded = (content: string) => {
    const matched = matchReactionPoints(content);
    if (matched.length === 0) return;
    setEditReactionPoint((prev) => {
      const additions = matched.filter((m) => !prev.includes(m));
      if (additions.length === 0) return prev;
      if (SHOW_AUTO_REACTION_TOAST) {
        if (autoReactionTimerRef.current) {
          clearTimeout(autoReactionTimerRef.current);
        }
        setAutoReactionToast(additions);
        autoReactionTimerRef.current = setTimeout(() => {
          setAutoReactionToast([]);
          autoReactionTimerRef.current = null;
        }, 3500);
      }
      return [...prev, ...additions];
    });
  };

  useEffect(
    () => () => {
      if (autoReactionTimerRef.current) {
        clearTimeout(autoReactionTimerRef.current);
      }
    },
    [],
  );

  // 가이드에서 탭 자동 전환 이벤트 리스닝
  useEffect(() => {
    const toBasic = () => setActiveTab("basic");
    const toInfo = () => setActiveTab("info");
    const clearReferrer = () => {
      setEditSourceMajor("");
      setEditSourceMinor("");
      setShowDanggeunPanel(false);
      setShowCafePanel(false);
    };
    window.addEventListener("guide-tab-basic", toBasic);
    window.addEventListener("guide-tab-info", toInfo);
    window.addEventListener("guide-referrer-clear", clearReferrer);
    return () => {
      window.removeEventListener("guide-tab-basic", toBasic);
      window.removeEventListener("guide-tab-info", toInfo);
      window.removeEventListener("guide-referrer-clear", clearReferrer);
    };
  }, []);

  // 가이드 자동 진행 — 데모 학생일 때만 변경 감지하여 이벤트 발행
  const isDemoStudent = item.id < 0;
  const prevEduRef = useRef(editEducation);
  const prevHopeRef = useRef(editHopeCourse.join("|"));
  const prevCostRef = useRef(editSubjectCost);
  const prevStatusRef = useRef(editStatus);

  useEffect(() => {
    if (!isDemoStudent) return;
    if (prevEduRef.current !== editEducation && editEducation) {
      window.dispatchEvent(new CustomEvent("guide-edu-set"));
    }
    prevEduRef.current = editEducation;
  }, [editEducation, isDemoStudent]);

  useEffect(() => {
    if (!isDemoStudent) return;
    const key = editHopeCourse.join("|");
    if (prevHopeRef.current !== key && editHopeCourse.length > 0) {
      window.dispatchEvent(new CustomEvent("guide-hope-set"));
    }
    prevHopeRef.current = key;
  }, [editHopeCourse, isDemoStudent]);

  useEffect(() => {
    if (!isDemoStudent) return;
    if (prevCostRef.current !== editSubjectCost && editSubjectCost) {
      const t = setTimeout(() => {
        window.dispatchEvent(new CustomEvent("guide-cost-set"));
      }, 600);
      prevCostRef.current = editSubjectCost;
      return () => clearTimeout(t);
    }
    prevCostRef.current = editSubjectCost;
  }, [editSubjectCost, isDemoStudent]);

  useEffect(() => {
    if (!isDemoStudent) return;
    if (prevStatusRef.current !== editStatus && editStatus === "등록완료") {
      window.dispatchEvent(new CustomEvent("guide-status-set"));
    }
    prevStatusRef.current = editStatus;
  }, [editStatus, isDemoStudent]);
  const [memoCount, setMemoCount] = useState<number | null>(null);
  const [cafeAddInput, setCafeAddInput] = useState("");
  const [showCafeAdd, setShowCafeAdd] = useState(false);
  const [danggeunAddInput, setDanggeunAddInput] = useState("");
  const [showDanggeunAdd, setShowDanggeunAdd] = useState(false);
  const [showDanggeunPanel, setShowDanggeunPanel] = useState(false);
  const [showCafePanel, setShowCafePanel] = useState(false);
  const [recentCafes, setRecentCafes] = useState<string[]>([]);
  const [cafeSearchQuery, setCafeSearchQuery] = useState("");
  const [showReactionPanel, setShowReactionPanel] = useState(false);
  const reactionWrapRef = useRef<HTMLDivElement>(null);
  const referrerGridRef = useRef<HTMLDivElement>(null);

  // 반응포인트 팝업 외부 클릭 시 닫기
  useEffect(() => {
    if (!showReactionPanel) return;
    function handleClick(e: MouseEvent) {
      if (
        reactionWrapRef.current &&
        !reactionWrapRef.current.contains(e.target as Node)
      ) {
        setShowReactionPanel(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showReactionPanel]);

  // 당근/맘카페 팝업 외부 클릭 시 닫기
  useEffect(() => {
    if (!showDanggeunPanel && !showCafePanel) return;
    function handleClick(e: MouseEvent) {
      if (
        referrerGridRef.current &&
        !referrerGridRef.current.contains(e.target as Node)
      ) {
        setShowDanggeunPanel(false);
        setShowCafePanel(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showDanggeunPanel, showCafePanel]);

  // localStorage에서 최근 선택한 맘카페 5개 로드
  useEffect(() => {
    try {
      const raw = localStorage.getItem("hakjeom_recent_cafes");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setRecentCafes(
            parsed.filter((v) => typeof v === "string").slice(0, 5),
          );
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // 카페 선택 시 최근 목록 갱신
  const pushRecentCafe = (name: string) => {
    if (!name) return;
    setRecentCafes((prev) => {
      const next = [name, ...prev.filter((v) => v !== name)].slice(0, 5);
      try {
        localStorage.setItem("hakjeom_recent_cafes", JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const builtClickSource = editSourceMajor
    ? editSourceMinor
      ? `${editSourceMajor}_${editSourceMinor}`
      : editSourceMajor
    : "";

  useEffect(() => {
    const { major, minor } = initSource(item.click_source);
    setEditStatus(item.status);
    setEditMemo(item.memo ?? "");
    setEditManager(item.manager ?? "");
    setEditEducation(item.education ?? "");
    setEditHopeCourse(
      item.hope_course
        ? item.hope_course
            .split(", ")
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
    );
    setEditReason(
      item.reason
        ? item.reason
            .split(", ")
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
    );
    const counsel = parseCounselCheck(item.counsel_check);
    setEditCounselCheck(counsel.checks);
    setEditCounselCheckEtc(counsel.etc);
    // 유입경로 비어있는데 상태가 지인-관련이면 자동으로 "지인소개"로 활성화
    setEditSourceMajor(!major && isReferralStatus(item.status) ? "지인소개" : major);
    setEditSourceMinor(minor);
    setEditResidence(item.residence ?? "");
    setEditSubjectCost(item.subject_cost ? String(item.subject_cost) : "");
    {
      const v = item.current_situation ?? "";
      const known = ["주부", "직장인", "자영업자", "대학생"];
      if (v && !known.includes(v)) {
        setEditCurrentSituation("기타");
        setEditCurrentSituationEtc(v);
      } else {
        setEditCurrentSituation(v);
        setEditCurrentSituationEtc("");
      }
    }
    setEditReactionPoint(
      item.reaction_point
        ? item.reaction_point
            .split(", ")
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
    );
    setReactionParentTab("");
    setEditContact(item.contact ?? "");
    setEditName(item.name ?? "");
    setShowDanggeunPanel(false);
    setShowCafePanel(false);
    setCafeSearchQuery("");
  }, [item.id]);

  const toggleReason = (val: string) => {
    setEditReason((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val],
    );
  };

  const toggleHopeCourse = (val: string) => {
    setEditHopeCourse((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val],
    );
  };

  const toggleCounselCheck = (val: string) => {
    setEditCounselCheck((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val],
    );
  };

  const handleMajorSelect = (m: string) => {
    if (editSourceMajor === m) {
      // 같은 카드 재클릭: 당근/맘카페는 sub-panel 토글, 그 외는 deselect
      if (m === "당근") {
        setShowDanggeunPanel((v) => !v);
      } else if (m === "맘카페") {
        setShowCafePanel((v) => !v);
      } else {
        setEditSourceMajor("");
        setEditSourceMinor("");
        setShowDanggeunPanel(false);
        setShowCafePanel(false);
      }
    } else {
      setEditSourceMajor(m);
      setEditSourceMinor("");
      // 새 카드 선택: 당근/맘카페일 때만 sub-panel 열기
      setShowDanggeunPanel(m === "당근");
      setShowCafePanel(m === "맘카페");
      // 가이드: 지인소개 선택 시 이벤트 발사
      if (m === "지인소개" && isDemoStudent) {
        window.dispatchEvent(new CustomEvent("guide-referrer-set"));
      }
    }
  };

  const handleMinorSelect = (cafeName: string) => {
    setEditSourceMinor((prev) => (prev === cafeName ? "" : cafeName));
  };

  const handleAddCafe = async () => {
    const name = cafeAddInput.trim();
    if (!name || CAFE_NAME_LIST.includes(name) || customCafes.includes(name))
      return;
    await onAddCafe(name);
    setEditSourceMinor(name);
    setCafeAddInput("");
    setShowCafeAdd(false);
  };

  const handleAddDanggeun = async () => {
    const name = danggeunAddInput.trim();
    if (!name || customDanggeun.includes(name)) return;
    await onAddDanggeun(name);
    setEditSourceMinor(name);
    setDanggeunAddInput("");
    setShowDanggeunAdd(false);
  };

  const handleDeleteCafe = async (name: string) => {
    if (!window.confirm(`"${name}" 카페를 삭제하시겠습니까?`)) return;
    await onDeleteCafe(name);
    if (editSourceMinor === name) setEditSourceMinor("");
  };

  const handleDeleteDanggeun = async (name: string) => {
    if (!window.confirm(`"${name}"을(를) 삭제하시겠습니까?`)) return;
    await onDeleteDanggeun(name);
    if (editSourceMinor === name) setEditSourceMinor("");
  };

  const handleSave = async () => {
    const finalStatus = (
      editStatus === "기타" && editStatusEtc.trim()
        ? `기타(${editStatusEtc.trim()})`
        : editStatus
    ) as ConsultationStatus;
    // '등록완료'로 저장 시 과목당 비용(subject_cost) 필수 검증
    if (finalStatus === "등록완료") {
      const costNum = editSubjectCost
        ? parseInt(editSubjectCost.replace(/,/g, ""), 10) || 0
        : 0;
      if (costNum <= 0) {
        alert(
          "과목당 비용이 입력되어야 '등록완료'로 변경할 수 있습니다.\n과목당 비용을 먼저 입력해주세요.",
        );
        return;
      }
      // 최종학력 필수
      if (!editEducation || !editEducation.trim()) {
        alert("'등록완료'로 변경하려면 최종학력을 먼저 선택해주세요.");
        return;
      }
      // 희망과정 — 4개 프리셋 중 하나라도 포함되어 있어야 함 (등록학생관리 매핑용)
      const PRESETS = [
        "사회복지사2급 - 신법",
        "사회복지사2급 - 구법",
        "사회복지사 (실습예정)",
        "건강가정사",
      ];
      const joined = editHopeCourse.join(", ");
      const hasPreset = PRESETS.some((p) => joined.includes(p));
      if (!editHopeCourse.length) {
        alert("'등록완료'로 변경하려면 희망과정을 입력해주세요.");
        return;
      }
      if (!hasPreset) {
        alert(
          "'등록완료'로 변경하려면 희망과정에 다음 중 하나가 포함되어 있어야 합니다:\n" +
            PRESETS.join("\n"),
        );
        return;
      }
    }
    const hopeCourseToSave =
      editHopeCourse.length > 0 ? editHopeCourse.join(", ") : null;
    setSaving(true);
    try {
      await onUpdate(item.id, {
        status: finalStatus,
        memo: editMemo || null,
        manager: editManager || null,
        education: editEducation || null,
        hope_course: hopeCourseToSave,
        reason: editReason.length > 0 ? editReason.join(", ") : null,
        counsel_check:
          editCounselCheck.length > 0
            ? editCounselCheck
                .map((c) =>
                  c === "기타" && editCounselCheckEtc.trim()
                    ? `기타(${editCounselCheckEtc.trim()})`
                    : c,
                )
                .join(", ")
            : null,
        click_source: builtClickSource || null,
        residence: editResidence || null,
        subject_cost: editSubjectCost
          ? parseInt(editSubjectCost.replace(/,/g, ""), 10) || null
          : null,
        current_situation:
          editCurrentSituation === "기타"
            ? editCurrentSituationEtc.trim() || null
            : editCurrentSituation || null,
        reaction_point:
          editReactionPoint.length > 0 ? editReactionPoint.join(", ") : null,
        contact: editContact || item.contact,
        name: editName.trim() || item.name,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  // 이니셜: 이름 첫 글자
  const avatarChar = (editName || item.name).charAt(0);

  return (
    <div
      className={styles.detailModalOverlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.detailModal}>
        {/* 닫기 버튼 (절대 위치) */}
        <button
          onClick={onClose}
          className={styles.detailModalCloseBtn}
          aria-label="닫기"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="M18.0071 3.939C18.5536 3.39042 19.441 3.38704 19.9905 3.93314C20.5397 4.47973 20.5427 5.36846 19.9963 5.918L13.9787 11.9634L20.0666 18.0821C20.6128 18.6316 20.6101 19.5204 20.0608 20.0669C19.5112 20.6124 18.6223 20.6101 18.0759 20.0611L11.9997 13.9527L5.92356 20.0611C5.37697 20.6097 4.48809 20.6129 3.93869 20.0669C3.38977 19.5205 3.38712 18.6316 3.93283 18.0821L10.0193 11.9634L4.00461 5.918C3.45866 5.36896 3.45997 4.48012 4.00901 3.93314C4.55859 3.38668 5.44728 3.38985 5.99387 3.939L11.9997 9.97416L18.0071 3.939Z"
              fill="#8995A2"
            />
          </svg>
        </button>

        {/* 헤더 */}
        <div className={styles.detailModalHeader}>
          <div className={styles.detailModalHeaderLeft}>
            {isEditingName ? (
              <div className={styles.nameEditForm}>
                <div className={styles.nameEditField}>
                  <span className={styles.nameEditLabel}>이름</span>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setEditName(item.name ?? "");
                        setEditContact(item.contact ?? "");
                        setIsEditingName(false);
                      }
                    }}
                    placeholder="이름"
                    className={styles.nameEditInput}
                    autoFocus
                  />
                </div>
                <div className={styles.nameEditField}>
                  <span className={styles.nameEditLabel}>연락처</span>
                  <input
                    value={editContact}
                    onChange={(e) =>
                      setEditContact(formatPhoneNumber(e.target.value))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setEditName(item.name ?? "");
                        setEditContact(item.contact ?? "");
                        setIsEditingName(false);
                      }
                    }}
                    placeholder="010-0000-0000"
                    inputMode="tel"
                    className={styles.nameEditInput}
                  />
                </div>
                <div className={styles.nameEditBtnGroup}>
                  <button
                    type="button"
                    className={styles.nameEditCancel}
                    onClick={() => {
                      setEditName(item.name ?? "");
                      setEditContact(item.contact ?? "");
                      setIsEditingName(false);
                    }}
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    className={styles.nameEditSave}
                    onClick={async () => {
                      await onUpdate(item.id, {
                        name: editName.trim() || item.name,
                        contact: editContact || item.contact,
                      });
                      setIsEditingName(false);
                    }}
                  >
                    저장
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className={styles.detailModalNameRow}>
                  <div className={styles.detailModalNameInner}>
                    <p className={styles.detailModalName}>
                      {editName || item.name}
                    </p>
                    <button
                      type="button"
                      className={styles.detailModalEditBtn}
                      onClick={() => setIsEditingName(true)}
                      aria-label="이름/연락처 편집"
                      data-guide="detail-name-edit"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 20 20"
                        fill="none"
                      >
                        <path
                          d="M17.5 16.6669C17.9602 16.6669 18.3333 17.04 18.3333 17.5002C18.3332 17.9603 17.9601 18.3335 17.5 18.3335H2.49996C2.03979 18.3335 1.66674 17.9603 1.66663 17.5002C1.66663 17.04 2.03972 16.6669 2.49996 16.6669H17.5Z"
                          fill="#7A8086"
                        />
                        <path
                          fillRule="evenodd"
                          clipRule="evenodd"
                          d="M13.6409 1.85403C13.9682 1.58707 14.4507 1.6059 14.7558 1.911L18.0892 5.24433C18.4145 5.56978 18.4146 6.09731 18.0892 6.42272L9.75582 14.7561C9.59955 14.9123 9.38759 15.0002 9.16663 15.0002H5.83329C5.37312 15.0002 5.00006 14.627 4.99996 14.1669V10.8335C4.99996 10.6126 5.08788 10.4006 5.2441 10.2443L13.5774 1.911L13.6409 1.85403ZM6.66663 11.1786V13.3335H8.82157L13.8216 8.33353L11.6666 6.17858L6.66663 11.1786ZM12.845 5.00019L15 7.15514L16.3216 5.83353L14.1666 3.67858L12.845 5.00019Z"
                          fill="#7A8086"
                        />
                      </svg>
                    </button>
                  </div>
                  <div className={styles.detailModalBadgeRow}>
                    <StatusBadge
                      status={editStatus}
                      styleMap={CONSULTATION_STATUS_STYLE}
                    />
                    <span className={styles.detailModalContactBadge}>
                      {item.memo_count ?? 0}회 연락
                    </span>
                    {item.latest_memo_at && (
                      <span className={styles.detailModalLastContactBadge}>
                        마지막 연락일: {formatDateShort(item.latest_memo_at)}
                      </span>
                    )}
                  </div>
                </div>
                <p className={styles.detailModalSub}>
                  {editContact || item.contact}
                </p>
              </>
            )}
          </div>

          <div
            className={styles.detailModalHeaderRight}
            data-guide="detail-header-dates"
          >
            <div className={styles.detailModalDateGroup}>
              <span className={styles.detailModalDateLabel}>등록일</span>
              <div className={styles.detailModalDateValue}>
                {item.created_at ? formatDateShort(item.created_at) : "-"}
              </div>
            </div>
            <div className={styles.detailModalDivider} />
            <div className={styles.detailModalDateGroup}>
              <span className={styles.detailModalDateLabel}>연락예정일</span>
              <DateInput
                value={
                  item.contact_scheduled_at
                    ? item.contact_scheduled_at.slice(0, 10)
                    : ""
                }
                onChange={(dateStr) =>
                  onUpdate(item.id, {
                    contact_scheduled_at: dateStr
                      ? dateStr + "T00:00:00.000Z"
                      : null,
                  })
                }
                variant="input"
                placeholder="-"
                showIcon={false}
                triggerClassName={
                  item.contact_scheduled_at
                    ? styles.detailModalScheduleTriggerSelected
                    : styles.detailModalScheduleTrigger
                }
              />
            </div>
          </div>
        </div>

        {/* 바디: 좌(기본정보) / 우(취득정보) 2단 */}
        <div className={styles.detailModalBody}>
          {/* 좌측: 기본정보 */}
          <div className={styles.detailColLeft}>
            {/* 최종학력 */}
            <div className={styles.detailFieldRow}>
              <span className={styles.detailFieldLabel}>최종학력</span>
              <div
                className={styles.detailFieldControl}
                data-guide="detail-education"
              >
                <EducationSelect
                  value={editEducation}
                  onChange={(v) => {
                    setEditEducation(v);
                    setIsEducationCustom(false);
                  }}
                  isCustom={isEducationCustom}
                  onSelectCustom={() => {
                    setIsEducationCustom(true);
                    setEditEducation("");
                  }}
                />
                <input
                  type="text"
                  value={editEducationExtra}
                  onChange={(e) => setEditEducationExtra(e.target.value)}
                  placeholder="-"
                  className={styles.eduSelectCustomInputInline}
                  disabled={!isEducationCustom}
                />
              </div>
            </div>

            {/* 희망과정 */}
            <div className={styles.detailFieldRow}>
              <span className={styles.detailFieldLabel}>
                희망과정
                {editStatus === "등록완료" && (
                  <span style={{ color: "#dc2626", marginLeft: 2 }}>*</span>
                )}
              </span>
              <div
                className={styles.detailFieldControl}
                data-guide="detail-hope-course"
              >
                <HopeCourseSelect
                  value={editHopeCourse.join(", ")}
                  onChange={(v) => {
                    setEditHopeCourse(v ? [v] : []);
                    setIsHopeCourseCustom(false);
                  }}
                  isCustom={isHopeCourseCustom}
                  onSelectCustom={() => {
                    setIsHopeCourseCustom(true);
                    setEditHopeCourse([]);
                  }}
                />
                <input
                  type="text"
                  value={editHopeCourseExtra}
                  onChange={(e) => setEditHopeCourseExtra(e.target.value)}
                  placeholder="-"
                  className={styles.eduSelectCustomInputInline}
                  disabled={!isHopeCourseCustom}
                />
              </div>
            </div>

            {/* 거주지 */}
            <div className={styles.detailFieldRow}>
              <span className={styles.detailFieldLabel}>거주지</span>
              <input
                value={editResidence}
                onChange={(e) => setEditResidence(e.target.value)}
                placeholder="예) 서울 강남구"
                className={styles.detailFieldBoxFull}
              />
            </div>

            {/* 메모 */}
            <div className={styles.detailMemoSection} data-guide="detail-memo">
              <MemoTimeline
                tableName="hakjeom_consultations"
                recordId={String(item.id)}
                legacyMemo={item.memo}
                onCountChange={setMemoCount}
                onAdd={handleMemoAdded}
              />
            </div>
          </div>

          {/* 가운데 구분선 */}
          <div className={styles.detailModalDivider} />

          {/* 우측: 취득정보 */}
          <div className={styles.detailColRight}>
            <h3 className={styles.detailColRightTitle}>취득 정보</h3>

            {/* 유입경로 */}
            <div
              className={styles.detailColRightRow}
              data-guide="detail-referrer"
            >
              <span className={styles.detailColRightLabel}>유입경로</span>
              <div className={styles.detailColRightControl}>
                <div className={styles.referrerGrid} ref={referrerGridRef}>
                  {SOURCE_MAJORS.map((m) => {
                    const meta = REFERRER_CARD_META[m];
                    const isActive = editSourceMajor === m;
                    // 기타 카드가 활성 상태면 카드 대신 input 표시
                    if (m === "기타" && isActive) {
                      return (
                        <div key={m} className={styles.referrerCardWrap}>
                          <input
                            type="text"
                            value={editSourceMinor}
                            onChange={(e) => setEditSourceMinor(e.target.value)}
                            onBlur={() => {
                              // 빈 값으로 blur 시 비활성화
                              if (!editSourceMinor.trim()) {
                                setEditSourceMajor("");
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Escape") {
                                setEditSourceMajor("");
                                setEditSourceMinor("");
                              }
                            }}
                            placeholder="기타 유입경로 입력"
                            className={styles.referrerEtcInput}
                            autoFocus
                          />
                        </div>
                      );
                    }
                    return (
                      <div key={m} className={styles.referrerCardWrap}>
                        <button
                          type="button"
                          onClick={() => handleMajorSelect(m)}
                          className={`${styles.referrerCard} ${isActive ? styles.referrerCardActive : ""}`}
                        >
                          {meta.type === "img" && (
                            <span
                              className={styles.referrerIcon}
                              style={{ backgroundImage: `url(${meta.src})` }}
                            />
                          )}
                          {meta.type === "person" && (
                            <span className={styles.referrerIconSvg}>
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="16"
                                height="16"
                                viewBox="0 0 16 16"
                                fill="none"
                              >
                                <path
                                  d="M10.4 8.29765C11.2844 8.72833 12.0369 9.38712 12.5818 10.2061C13.1267 11.025 13.4433 11.9745 13.499 12.9567C13.5046 13.055 13.4908 13.1535 13.4584 13.2466C13.426 13.3396 13.3755 13.4253 13.31 13.4989C13.2444 13.5724 13.165 13.6323 13.0763 13.6752C12.9876 13.718 12.8913 13.743 12.793 13.7487C12.6946 13.7543 12.5961 13.7405 12.5031 13.7081C12.41 13.6757 12.3243 13.6252 12.2507 13.5597C12.1772 13.4941 12.1173 13.4147 12.0744 13.326C12.0316 13.2373 12.0066 13.141 12.001 13.0427C11.9455 12.0187 11.4998 11.055 10.7557 10.3495C10.0115 9.64404 9.02537 9.25045 7.99996 9.24965C6.97455 9.25045 5.9884 9.64404 5.24424 10.3495C4.50008 11.055 4.05445 12.0187 3.99896 13.0427C3.99338 13.141 3.96848 13.2373 3.92568 13.326C3.88289 13.4148 3.82303 13.4942 3.74953 13.5598C3.67603 13.6254 3.59033 13.6759 3.49733 13.7084C3.40432 13.7409 3.30582 13.7547 3.20746 13.7492C3.1091 13.7436 3.0128 13.7187 2.92407 13.6759C2.83533 13.6331 2.75589 13.5732 2.69029 13.4997C2.62468 13.4262 2.5742 13.3405 2.54171 13.2475C2.50923 13.1545 2.49538 13.056 2.50096 12.9577C2.55643 11.9754 2.87296 11.0257 3.41789 10.2065C3.96282 9.38736 4.71642 8.72841 5.60096 8.29765C5.0905 7.81694 4.73619 7.19399 4.58395 6.50953C4.43171 5.82508 4.48857 5.11067 4.74715 4.45891C5.00573 3.80715 5.45411 3.24808 6.03419 2.85416C6.61426 2.46024 7.29928 2.24963 8.00046 2.24963C8.70164 2.24963 9.38666 2.46024 9.96673 2.85416C10.5468 3.24808 10.9952 3.80715 11.2538 4.45891C11.5124 5.11067 11.5692 5.82508 11.417 6.50953C11.2647 7.19399 10.9104 7.81694 10.4 8.29765ZM7.99996 3.74965C7.73362 3.74363 7.46876 3.79088 7.22094 3.88862C6.97311 3.98637 6.74731 4.13264 6.55679 4.31886C6.36627 4.50507 6.21487 4.72747 6.11149 4.973C6.0081 5.21852 5.95481 5.48223 5.95475 5.74864C5.95468 6.01505 6.00784 6.27878 6.1111 6.52436C6.21436 6.76994 6.36565 6.99242 6.55607 7.17873C6.7465 7.36504 6.97223 7.51142 7.22001 7.60929C7.46778 7.70716 7.73262 7.75454 7.99896 7.74865C8.52152 7.7371 9.0188 7.52143 9.38433 7.14781C9.74987 6.7742 9.95462 6.27233 9.95475 5.74964C9.95488 5.22695 9.75038 4.72498 9.38503 4.35118C9.01968 3.97739 8.52252 3.76147 7.99996 3.74965Z"
                                  fill="#767676"
                                />
                              </svg>
                            </span>
                          )}
                          {meta.type === "etc" && (
                            <span className={styles.referrerIconSvg}>
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="16"
                                height="16"
                                viewBox="0 0 16 16"
                                fill="none"
                              >
                                <path
                                  d="M11.2 8.20001C11.2 7.9348 11.3054 7.68044 11.4929 7.49291C11.6804 7.30537 11.9348 7.20001 12.2 7.20001C12.4652 7.20001 12.7196 7.30537 12.9071 7.49291C13.0946 7.68044 13.2 7.9348 13.2 8.20001C13.2 8.46523 13.0946 8.71958 12.9071 8.90712C12.7196 9.09466 12.4652 9.20001 12.2 9.20001C11.9348 9.20001 11.6804 9.09466 11.4929 8.90712C11.3054 8.71958 11.2 8.46523 11.2 8.20001ZM7.2 8.20001C7.2 7.9348 7.30535 7.68044 7.49289 7.49291C7.68043 7.30537 7.93478 7.20001 8.2 7.20001C8.46521 7.20001 8.71957 7.30537 8.9071 7.49291C9.09464 7.68044 9.2 7.9348 9.2 8.20001C9.2 8.46523 9.09464 8.71958 8.9071 8.90712C8.71957 9.09466 8.46521 9.20001 8.2 9.20001C7.93478 9.20001 7.68043 9.09466 7.49289 8.90712C7.30535 8.71958 7.2 8.46523 7.2 8.20001ZM3.2 8.20001C3.2 7.9348 3.30535 7.68044 3.49289 7.49291C3.68043 7.30537 3.93478 7.20001 4.2 7.20001C4.46521 7.20001 4.71957 7.30537 4.9071 7.49291C5.09464 7.68044 5.2 7.9348 5.2 8.20001C5.2 8.46523 5.09464 8.71958 4.9071 8.90712C4.71957 9.09466 4.46521 9.20001 4.2 9.20001C3.93478 9.20001 3.68043 9.09466 3.49289 8.90712C3.30535 8.71958 3.2 8.46523 3.2 8.20001Z"
                                  fill="black"
                                />
                              </svg>
                            </span>
                          )}
                          <span className={styles.referrerCardLabel}>{m}</span>
                          {isActive && editSourceMinor && (
                            <span className={styles.referrerCardChip}>
                              {editSourceMinor}
                            </span>
                          )}
                          {meta.type === "img" && meta.hasChevron && (
                            <svg
                              className={styles.referrerChevron}
                              xmlns="http://www.w3.org/2000/svg"
                              width="10"
                              height="10"
                              viewBox="0 0 10 10"
                              fill="none"
                            >
                              <path
                                d="M8.97371 2.79035C8.8565 2.67318 8.69756 2.60736 8.53183 2.60736C8.3661 2.60736 8.20716 2.67318 8.08996 2.79035L4.99621 5.8841L1.90246 2.79035C1.78458 2.6765 1.6267 2.61351 1.46283 2.61493C1.29896 2.61635 1.1422 2.68209 1.02632 2.79797C0.910439 2.91385 0.844709 3.0706 0.843285 3.23448C0.841861 3.39835 0.904858 3.55623 1.01871 3.6741L4.55433 7.20973C4.67154 7.3269 4.83048 7.39272 4.99621 7.39272C5.16193 7.39272 5.32088 7.3269 5.43808 7.20973L8.97371 3.6741C9.09088 3.5569 9.1567 3.39796 9.1567 3.23223C9.1567 3.0665 9.09088 2.90756 8.97371 2.79035Z"
                                fill="#8D99A5"
                              />
                            </svg>
                          )}
                        </button>
                        {isActive &&
                          m === "맘카페" &&
                          showCafePanel &&
                          (() => {
                            const q = cafeSearchQuery.trim().toLowerCase();
                            const filteredCanonical = q
                              ? CAFE_NAME_LIST.filter((n) =>
                                  n.toLowerCase().includes(q),
                                )
                              : CAFE_NAME_LIST;
                            const filteredCustom = q
                              ? customCafes.filter((n) =>
                                  n.toLowerCase().includes(q),
                                )
                              : customCafes;
                            const filteredRecent = q
                              ? recentCafes.filter((n) =>
                                  n.toLowerCase().includes(q),
                                )
                              : recentCafes;
                            const totalCount =
                              CAFE_NAME_LIST.length + customCafes.length;
                            return (
                              <div className={styles.cafePopupWrap}>
                                {/* 검색 */}
                                <div className={styles.cafeSearchWrap}>
                                  <input
                                    type="text"
                                    className={styles.cafeSearchInput}
                                    placeholder="카페명을 검색하세요"
                                    value={cafeSearchQuery}
                                    onChange={(e) =>
                                      setCafeSearchQuery(e.target.value)
                                    }
                                  />
                                  <span className={styles.cafeSearchIcon}>
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      width="16"
                                      height="16"
                                      viewBox="0 0 16 16"
                                      fill="none"
                                    >
                                      <path
                                        d="M11.8332 7.3332C11.8332 6.74228 11.7169 6.15713 11.4907 5.61119C11.2646 5.06532 10.9332 4.56938 10.5155 4.15156C10.0976 3.73368 9.60116 3.4018 9.05518 3.17565C8.50927 2.94956 7.92404 2.8332 7.33317 2.8332C6.74226 2.83322 6.1571 2.94952 5.61117 3.17565C5.06518 3.4018 4.56941 3.73368 4.15153 4.15156C3.30762 4.99546 2.83321 6.13974 2.83317 7.3332C2.83317 8.52671 3.30759 9.67155 4.15153 10.5155C4.99542 11.3593 6.1398 11.8332 7.33317 11.8332C8.52668 11.8332 9.67152 11.3594 10.5155 10.5155C10.9333 10.0976 11.2646 9.60118 11.4907 9.0552C11.7168 8.50927 11.8332 7.92411 11.8332 7.3332ZM13.4998 7.3332C13.4998 8.14303 13.3403 8.94503 13.0304 9.69322C12.8274 10.1833 12.5616 10.6432 12.242 11.0637L14.589 13.4107C14.9145 13.7361 14.9145 14.2636 14.589 14.5891C14.2636 14.9145 13.7361 14.9145 13.4106 14.5891L11.0636 12.2421C9.99674 13.0529 8.68834 13.4999 7.33317 13.4999C5.69768 13.4998 4.12896 12.8503 2.97249 11.6939C1.81608 10.5374 1.1665 8.96867 1.1665 7.3332C1.16654 5.69771 1.81603 4.12899 2.97249 2.97252C3.54509 2.39993 4.22503 1.94584 4.97314 1.63593C5.72129 1.32604 6.52338 1.16655 7.33317 1.16653C8.14299 1.16653 8.94502 1.32603 9.6932 1.63593C10.4413 1.94582 11.1212 2.39994 11.6938 2.97252C12.2664 3.54509 12.7205 4.22509 13.0304 4.97317C13.3403 5.72132 13.4998 6.52341 13.4998 7.3332Z"
                                        fill="#8D99A5"
                                      />
                                    </svg>
                                  </span>
                                </div>

                                {/* 최근 검색 */}
                                {filteredRecent.length > 0 && (
                                  <div className={styles.cafeRecentSection}>
                                    <span className={styles.cafeSectionLabel}>
                                      최근 검색
                                    </span>
                                    <div className={styles.cafeRecentChipRow}>
                                      {filteredRecent.map((cafeName) => {
                                        const isActive =
                                          editSourceMinor === cafeName;
                                        return (
                                          <button
                                            key={cafeName}
                                            type="button"
                                            className={`${styles.cafeRecentChip} ${isActive ? styles.cafeRecentChipActive : ""}`}
                                            onClick={() => {
                                              handleMinorSelect(cafeName);
                                              pushRecentCafe(cafeName);
                                            }}
                                          >
                                            {cafeName}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {/* 전체 목록 */}
                                <div className={styles.cafeListSection}>
                                  <span className={styles.cafeSectionLabel}>
                                    전체 목록 ({totalCount})
                                  </span>
                                  <div className={styles.cafeListBox}>
                                    {filteredCanonical.map((cafeName) => {
                                      const isActive =
                                        editSourceMinor === cafeName;
                                      return (
                                        <button
                                          key={cafeName}
                                          type="button"
                                          className={styles.danggeunRadioRow}
                                          onClick={() => {
                                            handleMinorSelect(cafeName);
                                            pushRecentCafe(cafeName);
                                          }}
                                        >
                                          <span
                                            className={`${styles.danggeunRadioCircle} ${isActive ? styles.danggeunRadioCircleActive : ""}`}
                                          >
                                            {isActive && (
                                              <span
                                                className={
                                                  styles.danggeunRadioDot
                                                }
                                              />
                                            )}
                                          </span>
                                          <span
                                            className={
                                              styles.danggeunRadioLabel
                                            }
                                          >
                                            {cafeName}
                                          </span>
                                        </button>
                                      );
                                    })}
                                    {filteredCustom.map((cafeName) => {
                                      const isActive =
                                        editSourceMinor === cafeName;
                                      return (
                                        <div
                                          key={cafeName}
                                          className={
                                            styles.cafeListRowWithDelete
                                          }
                                        >
                                          <button
                                            type="button"
                                            className={styles.danggeunRadioRow}
                                            onClick={() => {
                                              handleMinorSelect(cafeName);
                                              pushRecentCafe(cafeName);
                                            }}
                                          >
                                            <span
                                              className={`${styles.danggeunRadioCircle} ${isActive ? styles.danggeunRadioCircleActive : ""}`}
                                            >
                                              {isActive && (
                                                <span
                                                  className={
                                                    styles.danggeunRadioDot
                                                  }
                                                />
                                              )}
                                            </span>
                                            <span
                                              className={
                                                styles.danggeunRadioLabel
                                              }
                                            >
                                              {cafeName}
                                            </span>
                                          </button>
                                          <button
                                            type="button"
                                            className={styles.danggeunRowDelete}
                                            onClick={() =>
                                              handleDeleteCafe(cafeName)
                                            }
                                            aria-label="삭제"
                                          >
                                            ✕
                                          </button>
                                        </div>
                                      );
                                    })}
                                    {filteredCanonical.length === 0 &&
                                      filteredCustom.length === 0 && (
                                        <div
                                          style={{
                                            color: "#8995a2",
                                            fontSize: 12,
                                            padding: "4px 0",
                                          }}
                                        >
                                          검색 결과가 없습니다
                                        </div>
                                      )}
                                  </div>
                                </div>

                                {/* 직접 추가 */}
                                {showCafeAdd ? (
                                  <div
                                    style={{
                                      display: "flex",
                                      gap: 6,
                                      width: "100%",
                                    }}
                                  >
                                    <input
                                      className={styles.danggeunAddInput}
                                      value={cafeAddInput}
                                      onChange={(e) =>
                                        setCafeAddInput(e.target.value)
                                      }
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") handleAddCafe();
                                        if (e.key === "Escape") {
                                          setCafeAddInput("");
                                          setShowCafeAdd(false);
                                        }
                                      }}
                                      placeholder="카페 이름"
                                      autoFocus
                                    />
                                    <button
                                      type="button"
                                      className={styles.danggeunAddConfirm}
                                      onClick={handleAddCafe}
                                    >
                                      추가
                                    </button>
                                    <button
                                      type="button"
                                      className={styles.danggeunAddCancel}
                                      onClick={() => {
                                        setCafeAddInput("");
                                        setShowCafeAdd(false);
                                      }}
                                      aria-label="취소"
                                      title="취소 (Esc)"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ) : (
                                  <div className={styles.popupBottomRow}>
                                    <button
                                      type="button"
                                      className={styles.danggeunAddBtn}
                                      onClick={() => setShowCafeAdd(true)}
                                    >
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="10"
                                        height="10"
                                        viewBox="0 0 10 10"
                                        fill="none"
                                      >
                                        <path
                                          d="M5.01945 0.635377C5.31741 0.636225 5.55854 0.878718 5.55784 1.17662L5.54996 4.44998L8.82367 4.44266C9.12124 4.44221 9.36333 4.68223 9.36432 4.97996C9.36503 5.2778 9.1243 5.52021 8.82649 5.5212L5.54714 5.52909L5.53869 8.84751C5.53774 9.14533 5.29532 9.38605 4.99748 9.38537C4.6998 9.38427 4.45838 9.14196 4.45909 8.84413L4.4681 5.53191L1.15553 5.54035C0.857899 5.54082 0.615317 5.30018 0.61432 5.00249C0.613632 4.70471 0.854956 4.4623 1.15271 4.46125L4.47036 4.45224L4.4788 1.1738C4.47964 0.876171 4.72158 0.634924 5.01945 0.635377Z"
                                          fill="#0084FE"
                                        />
                                      </svg>
                                      <span
                                        className={styles.danggeunAddBtnText}
                                      >
                                        직접 추가
                                      </span>
                                    </button>
                                    <button
                                      type="button"
                                      className={styles.popupConfirmBtn}
                                      onClick={() => setShowCafePanel(false)}
                                    >
                                      선택완료
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        {isActive && m === "당근" && showDanggeunPanel && (
                          <div className={styles.danggeunPopupWrap}>
                            <div className={styles.danggeunPopupBox}>
                              {DANGGEUN_DEFAULT_OPTIONS.map((opt) => {
                                const isActive = editSourceMinor === opt;
                                return (
                                  <button
                                    key={opt}
                                    type="button"
                                    className={styles.danggeunRadioRow}
                                    onClick={() => handleMinorSelect(opt)}
                                  >
                                    <span
                                      className={`${styles.danggeunRadioCircle} ${isActive ? styles.danggeunRadioCircleActive : ""}`}
                                    >
                                      {isActive && (
                                        <span
                                          className={styles.danggeunRadioDot}
                                        />
                                      )}
                                    </span>
                                    <span className={styles.danggeunRadioLabel}>
                                      {opt}
                                    </span>
                                  </button>
                                );
                              })}
                              {customDanggeun.map((area) => {
                                const isActive = editSourceMinor === area;
                                return (
                                  <div
                                    key={area}
                                    className={
                                      styles.danggeunRadioRowWithDelete
                                    }
                                  >
                                    <button
                                      type="button"
                                      className={styles.danggeunRadioRow}
                                      onClick={() => handleMinorSelect(area)}
                                    >
                                      <span
                                        className={`${styles.danggeunRadioCircle} ${isActive ? styles.danggeunRadioCircleActive : ""}`}
                                      >
                                        {isActive && (
                                          <span
                                            className={styles.danggeunRadioDot}
                                          />
                                        )}
                                      </span>
                                      <span
                                        className={styles.danggeunRadioLabel}
                                      >
                                        {area}
                                      </span>
                                    </button>
                                    <button
                                      type="button"
                                      className={styles.danggeunRowDelete}
                                      onClick={() => handleDeleteDanggeun(area)}
                                      aria-label="삭제"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                            {showDanggeunAdd ? (
                              <div
                                style={{
                                  display: "flex",
                                  gap: 6,
                                  width: "100%",
                                }}
                              >
                                <input
                                  className={styles.danggeunAddInput}
                                  value={danggeunAddInput}
                                  onChange={(e) =>
                                    setDanggeunAddInput(e.target.value)
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleAddDanggeun();
                                    if (e.key === "Escape") {
                                      setDanggeunAddInput("");
                                      setShowDanggeunAdd(false);
                                    }
                                  }}
                                  placeholder="직접 추가"
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  className={styles.danggeunAddConfirm}
                                  onClick={handleAddDanggeun}
                                >
                                  추가
                                </button>
                                <button
                                  type="button"
                                  className={styles.danggeunAddCancel}
                                  onClick={() => {
                                    setDanggeunAddInput("");
                                    setShowDanggeunAdd(false);
                                  }}
                                  aria-label="취소"
                                  title="취소 (Esc)"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <div className={styles.popupBottomRow}>
                                <button
                                  type="button"
                                  className={styles.danggeunAddBtn}
                                  onClick={() => setShowDanggeunAdd(true)}
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="10"
                                    height="10"
                                    viewBox="0 0 10 10"
                                    fill="none"
                                  >
                                    <path
                                      d="M5.01945 0.635377C5.31741 0.636225 5.55854 0.878718 5.55784 1.17662L5.54996 4.44998L8.82367 4.44266C9.12124 4.44221 9.36333 4.68223 9.36432 4.97996C9.36503 5.2778 9.1243 5.52021 8.82649 5.5212L5.54714 5.52909L5.53869 8.84751C5.53774 9.14533 5.29532 9.38605 4.99748 9.38537C4.6998 9.38427 4.45838 9.14196 4.45909 8.84413L4.4681 5.53191L1.15553 5.54035C0.857899 5.54082 0.615317 5.30018 0.61432 5.00249C0.613632 4.70471 0.854956 4.4623 1.15271 4.46125L4.47036 4.45224L4.4788 1.1738C4.47964 0.876171 4.72158 0.634924 5.01945 0.635377Z"
                                      fill="#0084FE"
                                    />
                                  </svg>
                                  <span className={styles.danggeunAddBtnText}>
                                    직접 추가
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  className={styles.popupConfirmBtn}
                                  onClick={() => setShowDanggeunPanel(false)}
                                >
                                  선택완료
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 취득사유 */}
            <div className={styles.reasonRow}>
              <span className={styles.reasonLabel}>취득사유</span>
              <div className={styles.reasonChips}>
                {REASON_OPTIONS.map((r) => {
                  const isActive = editReason.includes(r);
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => toggleReason(r)}
                      className={`${styles.reasonChip} ${isActive ? styles.reasonChipActive : ""}`}
                    >
                      {isActive && (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="9"
                          height="6"
                          viewBox="0 0 9 6"
                          fill="none"
                        >
                          <path
                            fillRule="evenodd"
                            clipRule="evenodd"
                            d="M8.14581 0.1832C8.26298 0.300405 8.3288 0.459347 8.3288 0.625075C8.3288 0.790803 8.26298 0.949745 8.14581 1.06695L3.46122 5.75153C3.39931 5.81346 3.32582 5.86258 3.24492 5.89609C3.16403 5.9296 3.07732 5.94685 2.98976 5.94685C2.9022 5.94685 2.8155 5.9296 2.73461 5.89609C2.65371 5.86258 2.58021 5.81346 2.51831 5.75153L0.190805 3.42445C0.131111 3.3668 0.0834974 3.29783 0.0507418 3.22158C0.0179862 3.14533 0.000744733 3.06331 2.35979e-05 2.98033C-0.000697537 2.89734 0.0151161 2.81504 0.0465416 2.73823C0.0779672 2.66142 0.124375 2.59164 0.183058 2.53295C0.241741 2.47427 0.311524 2.42786 0.388334 2.39644C0.465144 2.36501 0.547444 2.3492 0.630431 2.34992C0.713418 2.35064 0.795431 2.36788 0.871683 2.40064C0.947936 2.43339 1.0169 2.48101 1.07456 2.5407L2.98956 4.4557L7.26164 0.1832C7.31968 0.125121 7.3886 0.0790478 7.46445 0.0476136C7.54031 0.0161793 7.62161 0 7.70372 0C7.78583 0 7.86714 0.0161793 7.94299 0.0476136C8.01885 0.0790478 8.08776 0.125121 8.14581 0.1832Z"
                            fill="currentColor"
                          />
                        </svg>
                      )}
                      {r}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 학습자 유형 — 칩 단일 선택 (취득사유와 동일 디자인 + 이모지) */}
            <div className={styles.reasonRow}>
              <span className={styles.reasonLabel}>학습자 유형</span>
              <div className={styles.reasonChips}>
                {CURRENT_SITUATION_OPTIONS.map((s) => {
                  const isActive = editCurrentSituation === s;
                  const emoji =
                    s === "주부"
                      ? "🏠"
                      : s === "직장인"
                        ? "👔"
                        : s === "자영업자"
                          ? "🏪"
                          : s === "대학생"
                            ? "🎓"
                            : null;
                  // 기타 활성 시 인풋으로 교체
                  if (s === "기타" && isActive) {
                    return (
                      <input
                        key={s}
                        type="text"
                        value={editCurrentSituationEtc}
                        onChange={(e) =>
                          setEditCurrentSituationEtc(e.target.value)
                        }
                        onBlur={() => {
                          if (!editCurrentSituationEtc.trim()) {
                            setEditCurrentSituation("");
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            setEditCurrentSituation("");
                            setEditCurrentSituationEtc("");
                          }
                        }}
                        placeholder="직접 입력"
                        className={styles.situationEtcInput}
                        autoFocus
                      />
                    );
                  }
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        if (isActive) {
                          setEditCurrentSituation("");
                          if (s === "기타") setEditCurrentSituationEtc("");
                        } else {
                          setEditCurrentSituation(s);
                        }
                      }}
                      className={`${styles.reasonChip} ${isActive ? styles.reasonChipActive : ""}`}
                    >
                      {emoji ? (
                        <span className={styles.situationEmoji}>{emoji}</span>
                      ) : s === "기타" ? (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="12"
                          height="12"
                          viewBox="0 0 12 12"
                          fill="none"
                        >
                          <path
                            d="M8.40002 6.1499C8.40002 5.95099 8.47904 5.76022 8.61969 5.61957C8.76035 5.47892 8.95111 5.3999 9.15002 5.3999C9.34894 5.3999 9.5397 5.47892 9.68036 5.61957C9.82101 5.76022 9.90002 5.95099 9.90002 6.1499C9.90002 6.34881 9.82101 6.53958 9.68036 6.68023C9.5397 6.82088 9.34894 6.8999 9.15002 6.8999C8.95111 6.8999 8.76035 6.82088 8.61969 6.68023C8.47904 6.53958 8.40002 6.34881 8.40002 6.1499ZM5.40002 6.1499C5.40002 5.95099 5.47904 5.76022 5.61969 5.61957C5.76035 5.47892 5.95111 5.3999 6.15002 5.3999C6.34894 5.3999 6.5397 5.47892 6.68035 5.61957C6.82101 5.76022 6.90002 5.95099 6.90002 6.1499C6.90002 6.34881 6.82101 6.53958 6.68035 6.68023C6.5397 6.82088 6.34894 6.8999 6.15002 6.8999C5.95111 6.8999 5.76035 6.82088 5.61969 6.68023C5.47904 6.53958 5.40002 6.34881 5.40002 6.1499ZM2.40002 6.1499C2.40002 5.95099 2.47904 5.76022 2.61969 5.61957C2.76035 5.47892 2.95111 5.3999 3.15002 5.3999C3.34894 5.3999 3.5397 5.47892 3.68035 5.61957C3.82101 5.76022 3.90002 5.95099 3.90002 6.1499C3.90002 6.34881 3.82101 6.53958 3.68035 6.68023C3.5397 6.82088 3.34894 6.8999 3.15002 6.8999C2.95111 6.8999 2.76035 6.82088 2.61969 6.68023C2.47904 6.53958 2.40002 6.34881 2.40002 6.1499Z"
                            fill="currentColor"
                          />
                        </svg>
                      ) : null}
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 반응포인트 */}
            <div className={styles.reasonRow}>
              <span className={styles.reasonLabel}>반응포인트</span>
              <div className={styles.reactionWrap} ref={reactionWrapRef}>
                <button
                  type="button"
                  className={`${styles.reactionTrigger} ${editReactionPoint.length > 0 ? styles.reactionTriggerActive : ""}`}
                  onClick={() => setShowReactionPanel((v) => !v)}
                >
                  {editReactionPoint.length > 0 ? (
                    <span className={styles.reactionTriggerChipRow}>
                      {editReactionPoint.slice(0, 5).map((v) => (
                        <span key={v} className={styles.reactionTriggerChip}>
                          <span className={styles.reactionTriggerChipEmoji}>
                            {getReactionEmoji(v)}
                          </span>
                          <span>{v}</span>
                        </span>
                      ))}
                      {editReactionPoint.length > 5 && (
                        <span className={styles.reactionTriggerMore}>
                          외 {editReactionPoint.length - 5}개
                        </span>
                      )}
                    </span>
                  ) : (
                    <span>반응포인트를 선택해주세요</span>
                  )}
                  <svg
                    className={`${styles.reactionChevron} ${showReactionPanel ? styles.reactionChevronOpen : ""}`}
                    xmlns="http://www.w3.org/2000/svg"
                    width="10"
                    height="10"
                    viewBox="0 0 10 10"
                    fill="none"
                  >
                    <path
                      d="M8.97371 2.79041C8.8565 2.67324 8.69756 2.60742 8.53183 2.60742C8.3661 2.60742 8.20716 2.67324 8.08996 2.79041L4.99621 5.88416L1.90246 2.79041C1.78458 2.67656 1.6267 2.61357 1.46283 2.61499C1.29896 2.61642 1.1422 2.68215 1.02632 2.79803C0.910439 2.91391 0.844709 3.07066 0.843285 3.23454C0.841861 3.39841 0.904858 3.55629 1.01871 3.67416L4.55433 7.20979C4.67154 7.32696 4.83048 7.39278 4.99621 7.39278C5.16193 7.39278 5.32088 7.32696 5.43808 7.20979L8.97371 3.67416C9.09088 3.55696 9.1567 3.39802 9.1567 3.23229C9.1567 3.06656 9.09088 2.90762 8.97371 2.79041Z"
                      fill="#8D99A5"
                    />
                  </svg>
                </button>
                {showReactionPanel && (
                  <div className={styles.reactionPopup}>
                    <div className={styles.reactionGrid}>
                      {Object.keys(REACTION_POINT_MAP).map((parent) => (
                        <div key={parent} className={styles.reactionGroupRow}>
                          <span className={styles.reactionGroupLabel}>
                            <span className={styles.reactionGroupEmoji}>
                              {REACTION_GROUP_EMOJI[parent] ?? ""}
                            </span>
                            {parent}
                          </span>
                          <div className={styles.reactionGroupBox}>
                            {REACTION_POINT_MAP[parent].map((child) => {
                              const isChecked =
                                editReactionPoint.includes(child);
                              return (
                                <button
                                  key={child}
                                  type="button"
                                  className={styles.reactionCheckRow}
                                  onClick={() =>
                                    setEditReactionPoint((prev) =>
                                      prev.includes(child)
                                        ? prev.filter((v) => v !== child)
                                        : [...prev, child],
                                    )
                                  }
                                >
                                  <span
                                    className={`${styles.reactionCheckbox} ${isChecked ? styles.reactionCheckboxActive : ""}`}
                                  >
                                    {isChecked && (
                                      <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="12"
                                        height="12"
                                        viewBox="0 0 10 10"
                                        fill="none"
                                      >
                                        <path
                                          fillRule="evenodd"
                                          clipRule="evenodd"
                                          d="M8.61841 2.0444C8.73089 2.15692 8.79408 2.3095 8.79408 2.4686C8.79408 2.6277 8.73089 2.78029 8.61841 2.8928L4.1212 7.39C4.06177 7.44945 3.99121 7.4966 3.91356 7.52877C3.8359 7.56095 3.75266 7.57751 3.6686 7.57751C3.58455 7.57751 3.50131 7.56095 3.42365 7.52877C3.346 7.4966 3.27544 7.44945 3.216 7.39L0.981604 5.156C0.924298 5.10065 0.878589 5.03445 0.847144 4.96125C0.815698 4.88804 0.799146 4.80931 0.798454 4.72964C0.797762 4.64998 0.812943 4.57097 0.843111 4.49723C0.87328 4.42349 0.917832 4.3565 0.974167 4.30017C1.0305 4.24383 1.09749 4.19928 1.17123 4.16911C1.24497 4.13894 1.32398 4.12376 1.40365 4.12445C1.48331 4.12514 1.56204 4.1417 1.63525 4.17314C1.70845 4.20459 1.77466 4.2503 1.83 4.3076L3.6684 6.146L7.76961 2.0444C7.82533 1.98865 7.89149 1.94442 7.96431 1.91424C8.03713 1.88406 8.11518 1.86853 8.19401 1.86853C8.27283 1.86853 8.35088 1.88406 8.42371 1.91424C8.49653 1.94442 8.56269 1.98865 8.61841 2.0444Z"
                                          fill="white"
                                        />
                                      </svg>
                                    )}
                                  </span>
                                  <span className={styles.reactionCheckLabel}>
                                    {child}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      className={styles.reactionConfirmBtn}
                      onClick={() => setShowReactionPanel(false)}
                    >
                      선택완료
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 상태 - 지인소개일 때 카드형 / 그 외 칩형 (지인 상태값이면 fallback) */}
            {editSourceMajor === "지인소개" || isReferralStatus(editStatus) ? (
              <div className={styles.referralStatusRow}>
                <span className={styles.referralStatusLabel}>상태</span>
                <div className={styles.referralStatusGrid}>
                  {(
                    [
                      {
                        status: "지인대기" as ConsultationStatus,
                        label: "지인대기",
                        icon: (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                          >
                            <circle
                              cx="12"
                              cy="12"
                              r="9"
                              stroke="currentColor"
                              strokeWidth="1.8"
                            />
                            <path
                              d="M12 7.5V12L15 14"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        ),
                      },
                      {
                        status: "지인등록" as ConsultationStatus,
                        label: "지인등록",
                        icon: (
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
                              d="M8.25097 3.9502C9.26262 3.9502 10.2509 4.25395 11.0879 4.82227C11.9248 5.39063 12.5722 6.1973 12.9453 7.1377C13.3184 8.07806 13.4003 9.10915 13.1807 10.0967C12.961 11.0842 12.4493 11.9832 11.7129 12.6768L11.5019 12.875L11.7627 13.002C13.0572 13.6324 14.1583 14.597 14.956 15.7959C15.7537 16.9947 16.2174 18.3847 16.2988 19.8223C16.3057 19.9435 16.289 20.065 16.249 20.1797C16.209 20.2944 16.1472 20.4005 16.0664 20.4912C15.9857 20.5818 15.8875 20.6552 15.7783 20.708C15.669 20.7608 15.5499 20.7918 15.4287 20.7988C15.3074 20.8058 15.1851 20.789 15.0703 20.749C14.9557 20.709 14.8504 20.6462 14.7598 20.5654C14.6691 20.4846 14.5948 20.3867 14.542 20.2773C14.4892 20.168 14.4581 20.049 14.4512 19.9277C14.3649 18.3412 13.6745 16.8481 12.5215 15.7549C11.3681 14.6615 9.83925 14.051 8.24999 14.0498C6.66082 14.0511 5.13279 14.6616 3.97948 15.7549C2.82635 16.8481 2.13504 18.3411 2.04882 19.9277C2.04194 20.0489 2.01165 20.168 1.95897 20.2773C1.90619 20.3868 1.83185 20.4855 1.7412 20.5664C1.6507 20.6471 1.54511 20.709 1.43065 20.749C1.31605 20.789 1.19443 20.8066 1.07323 20.7998C0.951971 20.7929 0.83303 20.7617 0.723623 20.709C0.614175 20.6562 0.515478 20.5828 0.434561 20.4922C0.353672 20.4016 0.292 20.2954 0.251944 20.1807C0.211903 20.066 0.194281 19.9445 0.201162 19.8232C0.282365 18.3853 0.746251 16.995 1.54394 15.7959C2.34158 14.5969 3.44457 13.6325 4.73925 13.002L4.99999 12.875L4.78905 12.6768C4.05258 11.9832 3.54096 11.0842 3.32128 10.0967C3.10164 9.10916 3.18359 8.07805 3.55663 7.1377C3.92973 6.1973 4.57709 5.39063 5.41405 4.82227C6.25099 4.25392 7.2393 3.95021 8.25097 3.9502ZM8.25487 5.7998C7.82885 5.79017 7.40521 5.86615 7.00878 6.02246C6.61226 6.17885 6.25013 6.413 5.9453 6.71094C5.64062 7.00882 5.39875 7.3651 5.23339 7.75781C5.06811 8.15045 4.98257 8.57204 4.98241 8.99805C4.98231 9.42417 5.06729 9.84643 5.23241 10.2393C5.39757 10.632 5.63981 10.9881 5.94433 11.2861C6.249 11.5842 6.61039 11.819 7.00683 11.9756C7.40318 12.1321 7.82687 12.2076 8.25292 12.1982C9.08895 12.1798 9.88487 11.835 10.4697 11.2373C11.0546 10.6395 11.3826 9.8363 11.3828 9C11.383 8.16371 11.0552 7.36076 10.4707 6.7627C9.88615 6.16464 9.09093 5.81872 8.25487 5.7998Z"
                              fill="currentColor"
                            />
                            <path
                              d="M19.875 0.200195C20.1202 0.200195 20.3558 0.297328 20.5293 0.470703C20.7028 0.644174 20.8008 0.879675 20.8008 1.125V3.2002H22.875C23.1202 3.2002 23.3558 3.29733 23.5293 3.4707C23.7028 3.64417 23.8008 3.87967 23.8008 4.125C23.8008 4.37033 23.7028 4.60583 23.5293 4.7793C23.3558 4.95267 23.1202 5.0498 22.875 5.0498H20.8008V7.125C20.8008 7.37033 20.7028 7.60583 20.5293 7.7793C20.3558 7.95267 20.1202 8.0498 19.875 8.0498C19.6299 8.04972 19.395 7.95249 19.2217 7.7793C19.0482 7.60583 18.9502 7.37033 18.9502 7.125V5.0498H16.875C16.6299 5.04972 16.395 4.95249 16.2217 4.7793C16.0482 4.60583 15.9502 4.37033 15.9502 4.125C15.9502 3.87967 16.0482 3.64417 16.2217 3.4707C16.395 3.29751 16.6299 3.20028 16.875 3.2002H18.9502V1.125C18.9502 0.879675 19.0482 0.644174 19.2217 0.470703C19.395 0.297513 19.6299 0.200277 19.875 0.200195Z"
                              fill="currentColor"
                            />
                          </svg>
                        ),
                      },
                      {
                        status: "지인취소" as ConsultationStatus,
                        label: "지인취소",
                        icon: (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                          >
                            <path
                              d="M15.7273 9.68457C15.8096 9.60772 15.8761 9.5154 15.9228 9.41287C15.9695 9.31033 15.9955 9.1996 15.9995 9.08698C16.0034 8.97437 15.9852 8.86208 15.9457 8.75653C15.9063 8.65098 15.8465 8.55423 15.7697 8.47181C15.6929 8.38939 15.6007 8.32291 15.4982 8.27617C15.3958 8.22943 15.2851 8.20335 15.1726 8.1994C15.0601 8.19546 14.9479 8.21374 14.8424 8.25319C14.737 8.29264 14.6403 8.3525 14.5579 8.42934L12.0495 10.7699L9.71081 8.2586C9.55432 8.0982 9.34132 8.00546 9.11739 8.00023C8.89345 7.99501 8.67636 8.07771 8.51257 8.23064C8.34879 8.38357 8.25132 8.59458 8.24101 8.81852C8.23071 9.04246 8.3084 9.26154 8.45745 9.42889L10.7961 11.9393L8.28684 14.2799C8.20158 14.356 8.13237 14.4483 8.08326 14.5515C8.03416 14.6547 8.00616 14.7667 8.00091 14.8809C7.99565 14.9951 8.01325 15.1092 8.05267 15.2165C8.09209 15.3238 8.15253 15.4221 8.23045 15.5057C8.30837 15.5893 8.40219 15.6564 8.5064 15.7032C8.61061 15.75 8.72312 15.7755 8.83731 15.7781C8.95149 15.7808 9.06506 15.7606 9.17134 15.7187C9.27762 15.6768 9.37447 15.6141 9.45619 15.5343L11.9646 13.1946L14.3033 15.705C14.3788 15.7919 14.4711 15.8627 14.5745 15.9132C14.6779 15.9637 14.7905 15.9928 14.9054 15.9988C15.0203 16.0048 15.1353 15.9877 15.2434 15.9483C15.3515 15.9089 15.4507 15.8481 15.5348 15.7696C15.619 15.691 15.6865 15.5964 15.7333 15.4911C15.7802 15.3859 15.8053 15.2724 15.8074 15.1572C15.8094 15.0421 15.7883 14.9277 15.7452 14.8209C15.7021 14.7141 15.638 14.6171 15.5567 14.5356L13.2188 12.0251L15.7273 9.68457Z"
                              fill="currentColor"
                            />
                            <path
                              fillRule="evenodd"
                              clipRule="evenodd"
                              d="M2 12C2 6.47727 6.47727 2 12 2C17.5227 2 22 6.47727 22 12C22 17.5227 17.5227 22 12 22C6.47727 22 2 17.5227 2 12ZM12 20.1818C10.9255 20.1818 9.86162 19.9702 8.86895 19.559C7.87629 19.1478 6.97433 18.5452 6.21458 17.7854C5.45483 17.0257 4.85216 16.1237 4.44099 15.131C4.02981 14.1384 3.81818 13.0745 3.81818 12C3.81818 10.9255 4.02981 9.86162 4.44099 8.86895C4.85216 7.87629 5.45483 6.97433 6.21458 6.21458C6.97433 5.45483 7.87629 4.85216 8.86895 4.44099C9.86162 4.02981 10.9255 3.81818 12 3.81818C14.17 3.81818 16.251 4.68019 17.7854 6.21458C19.3198 7.74897 20.1818 9.83005 20.1818 12C20.1818 14.17 19.3198 16.251 17.7854 17.7854C16.251 19.3198 14.17 20.1818 12 20.1818Z"
                              fill="currentColor"
                            />
                          </svg>
                        ),
                      },
                    ] as const
                  ).map((item) => {
                    const isActive = editStatus === item.status;
                    return (
                      <button
                        key={item.status}
                        type="button"
                        onClick={() => setEditStatus(item.status)}
                        className={`${styles.referralStatusCard} ${isActive ? styles.referralStatusCardActive : ""}`}
                        style={{ color: isActive ? "#0084FE" : "#7A8086" }}
                      >
                        <span className={styles.referralStatusIcon}>
                          {item.icon}
                        </span>
                        <span className={styles.referralStatusCardLabel}>
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className={styles.statusFieldCol} data-guide="detail-status">
                <span className={styles.reasonLabel}>상태</span>
                <div className={styles.statusCardCol}>
                  <div className={styles.statusCardGrid}>
                    {(
                      [
                        { status: "상담대기", label: "상담대기" },
                        { status: "상담완료", label: "상담완료" },
                        {
                          status: "부재중/추후통화",
                          label: "부재중\n(추후 통화)",
                        },
                        { status: "장기가망", label: "장기가망" },
                        { status: "등록완료", label: "등록완료" },
                        { status: "수신거부", label: "수신거부" },
                        { status: "기타", label: "기타" },
                      ] as const
                    ).map(({ status: s, label }) => {
                      const isConsultDone = s === "상담완료";
                      const isActive = isConsultDone
                        ? editStatus.startsWith("상담완료")
                        : editStatus === s;
                      const styleKey = isConsultDone ? "상담완료-높음" : s;
                      const colors =
                        CONSULTATION_STATUS_STYLE[
                          styleKey as ConsultationStatus
                        ];
                      const activeStyle =
                        isActive && colors
                          ? {
                              borderColor: colors.color,
                              background: colors.background,
                              color: colors.color,
                            }
                          : undefined;
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => {
                            if (isConsultDone) {
                              if (!editStatus.startsWith("상담완료"))
                                setEditStatus("상담완료-높음");
                            } else {
                              setEditStatus(s as ConsultationStatus);
                            }
                          }}
                          className={`${styles.statusCard} ${isActive ? styles.statusCardActive : ""}`}
                          style={activeStyle}
                        >
                          <span className={styles.statusCardIcon}>
                            <StatusCardIcon status={s} />
                          </span>
                          <span
                            className={`${styles.statusCardLabel} ${s === "부재중/추후통화" ? styles.statusCardLabelWide : ""}`}
                          >
                            {label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {editStatus.startsWith("상담완료") && (
                    <div
                      className={`${styles.statusSubPanel} ${styles.statusSubPanelConsult}`}
                      style={{ ["--tail-left" as string]: "21.43%" }}
                    >
                      <svg
                        className={styles.statusSubPanelTail}
                        viewBox="0 0 22 20"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M1 18 L 9.4 1.9 C 9.8 1.3 10.4 1 11 1 C 11.6 1 12.2 1.3 12.6 1.9 L 21 18 Z"
                          fill="#E0F7FA"
                        />
                        <path
                          d="M1 18 L 9.4 1.9 C 9.8 1.3 10.4 1 11 1 C 11.6 1 12.2 1.3 12.6 1.9 L 21 18"
                          fill="none"
                          stroke="#0277BD"
                          strokeWidth="1"
                          strokeLinejoin="round"
                        />
                      </svg>
                      {(
                        [
                          { value: "상담완료-높음", label: "높음" },
                          { value: "상담완료-중간", label: "중간" },
                          { value: "상담완료-낮음", label: "낮음" },
                        ] as { value: ConsultationStatus; label: string }[]
                      ).map((opt) => {
                        const isActive = editStatus === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setEditStatus(opt.value)}
                            className={styles.statusRadioRow}
                          >
                            <span className={styles.statusRadioCircle}>
                              {isActive && (
                                <span className={styles.statusRadioDot} />
                              )}
                            </span>
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {editStatus === "장기가망" && (
                    <div
                      className={`${styles.statusSubPanel} ${styles.statusSubPanelLong}`}
                      style={{ ["--tail-left" as string]: "50%" }}
                    >
                      <svg
                        className={styles.statusSubPanelTail}
                        viewBox="0 0 22 20"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M1 18 L 9.4 1.9 C 9.8 1.3 10.4 1 11 1 C 11.6 1 12.2 1.3 12.6 1.9 L 21 18 Z"
                          fill="#F9F3FF"
                        />
                        <path
                          d="M1 18 L 9.4 1.9 C 9.8 1.3 10.4 1 11 1 C 11.6 1 12.2 1.3 12.6 1.9 L 21 18"
                          fill="none"
                          stroke="#C9A9FF"
                          strokeWidth="1"
                          strokeLinejoin="round"
                        />
                      </svg>
                      {COUNSEL_CHECK_OPTIONS.map((c) => {
                        const isActive = editCounselCheck.includes(c);
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => toggleCounselCheck(c)}
                            className={styles.statusRadioRow}
                          >
                            <span className={styles.statusRadioCircle}>
                              {isActive && (
                                <span className={styles.statusRadioDot} />
                              )}
                            </span>
                            {c}
                          </button>
                        );
                      })}
                      {editCounselCheck.includes("기타") && (
                        <input
                          value={editCounselCheckEtc}
                          onChange={(e) =>
                            setEditCounselCheckEtc(e.target.value)
                          }
                          placeholder="기타 내용 입력"
                          className={styles.subPanelAddInput}
                          style={{ gridColumn: "1 / -1" }}
                          autoFocus
                        />
                      )}
                    </div>
                  )}
                  {editStatus === "기타" && (
                    <div
                      className={`${styles.statusSubPanel} ${styles.statusSubPanelEtc}`}
                      style={{ ["--tail-left" as string]: "94.6%" }}
                    >
                      <svg
                        className={styles.statusSubPanelTail}
                        viewBox="0 0 22 20"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M1 18 L 9.4 1.9 C 9.8 1.3 10.4 1 11 1 C 11.6 1 12.2 1.3 12.6 1.9 L 21 18 Z"
                          fill="#F0FFF4"
                        />
                        <path
                          d="M1 18 L 9.4 1.9 C 9.8 1.3 10.4 1 11 1 C 11.6 1 12.2 1.3 12.6 1.9 L 21 18"
                          fill="none"
                          stroke="#059669"
                          strokeWidth="1"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <div className={styles.statusSubPanelEtcInputBox}>
                        <input
                          type="text"
                          value={editStatusEtc}
                          onChange={(e) => setEditStatusEtc(e.target.value)}
                          placeholder="기타 상태를 입력해주세요."
                          className={styles.statusSubPanelEtcInput}
                          autoFocus
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 과목당비용 + 담당자 한 줄 */}
            <div className={styles.costManagerRow}>
              <div
                className={styles.costManagerField}
                data-guide="detail-subject-cost"
              >
                <span className={styles.reasonLabel}>과목당 비용</span>
                <input
                  type="text"
                  value={editSubjectCost}
                  onChange={(e) =>
                    setEditSubjectCost(e.target.value.replace(/[^0-9,]/g, ""))
                  }
                  placeholder="예) 25000원"
                  className={styles.costManagerInput}
                />
              </div>

              {!hideManager && (
                <div className={styles.costManagerField}>
                  <span className={styles.reasonLabel}>담당자</span>
                  <input
                    type="text"
                    value={editManager}
                    onChange={(e) => setEditManager(e.target.value)}
                    placeholder="담당자 이름"
                    className={styles.costManagerInput}
                  />
                </div>
              )}
            </div>

            {/* 푸터 (우측 컬럼 안) */}
            <div className={styles.detailFooterRow}>
              <button
                type="button"
                onClick={onClose}
                className={styles.detailFooterCancel}
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className={styles.detailFooterSave}
              >
                {saving ? "저장 중..." : "변경사항 저장"}
              </button>
            </div>
          </div>
        </div>

        {autoReactionToast.length > 0 && (
          <div className={styles.autoReactionToast}>
            <span>반응포인트 자동 체크: {autoReactionToast.join(", ")}</span>
          </div>
        )}
      </div>
    </div>
  );
}
