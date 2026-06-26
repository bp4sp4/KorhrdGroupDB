"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import SalesTargetsBoard from "../sales-targets/SalesTargetsBoard";
import ProfitPnlBoard from "./ProfitPnlBoard";
import styles from "./page.module.css";

/* ── Ant Design Charts (SSR 비활성) ── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Area = dynamic(() => import("@ant-design/charts").then((m) => m.Area), {
  ssr: false,
}) as any;

/* ── KPI 아이콘 (Figma 제공 SVG) ── */
function IconProfit() {
  return (
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
        d="M12 2C17.523 2 22 6.477 22 12C22 17.523 17.523 22 12 22C6.477 22 2 17.523 2 12C2 6.477 6.477 2 12 2ZM12 4C9.87827 4 7.84344 4.84285 6.34315 6.34315C4.84285 7.84344 4 9.87827 4 12C4 14.1217 4.84285 16.1566 6.34315 17.6569C7.84344 19.1571 9.87827 20 12 20C14.1217 20 16.1566 19.1571 17.6569 17.6569C19.1571 16.1566 20 14.1217 20 12C20 9.87827 19.1571 7.84344 17.6569 6.34315C16.1566 4.84285 14.1217 4 12 4ZM10.586 7.757C10.94 7.40319 11.4139 7.195 11.9139 7.17352C12.414 7.15205 12.9039 7.31885 13.287 7.641L13.414 7.757L16.243 10.586C16.5968 10.94 16.805 11.4139 16.8265 11.9139C16.848 12.414 16.6811 12.9039 16.359 13.287L16.243 13.414L13.414 16.243C13.06 16.5968 12.5861 16.805 12.0861 16.8265C11.586 16.848 11.0961 16.6811 10.713 16.359L10.586 16.243L7.757 13.414C7.40319 13.06 7.195 12.5861 7.17352 12.0861C7.15205 11.586 7.31885 11.0961 7.641 10.713L7.757 10.586L10.586 7.757ZM12 9.172L9.172 12L12 14.828L14.828 12L12 9.172Z"
        fill="#8D99A5"
      />
    </svg>
  );
}

function IconRate() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M16.0003 8.99985V19H20V8.99985H16.0003ZM4.0003 19H8V13H4.0003V19ZM10.0003 5.00015V19H14V5.00015H10.0003ZM16.0003 7H20C20.5304 7 21.0393 7.21086 21.4144 7.58594C21.7894 7.96097 22.0003 8.46951 22.0003 8.99985V19C22.0003 19.5304 21.7894 20.0393 21.4144 20.4144C21.0393 20.7894 20.5304 20.9998 20 20.9998H4.0003C3.4699 20.9998 2.961 20.7894 2.58594 20.4144C2.21086 20.0393 2 19.5304 2 19V13C2 12.4696 2.21086 11.9607 2.58594 11.5856C2.961 11.2106 3.4699 11.0001 4.0003 11.0001H8V5.00015C8 4.46971 8.21087 3.96086 8.58594 3.58578C8.96101 3.21071 9.46987 2.99985 10.0003 2.99985H14C14.5304 2.99985 15.0393 3.21071 15.4144 3.58578C15.7894 3.96086 16.0003 4.46972 16.0003 5.00015V7Z"
        fill="#8D99A5"
      />
    </svg>
  );
}

function IconTarget() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M12 2C12.2652 2 12.5196 2.10536 12.7071 2.29289C12.8946 2.48043 13 2.73478 13 3C13 3.26522 12.8946 3.51957 12.7071 3.70711C12.5196 3.89464 12.2652 4 12 4C10.4177 4 8.87103 4.46919 7.55544 5.34824C6.23984 6.22729 5.21446 7.47672 4.60896 8.93853C4.00346 10.4003 3.84504 12.0089 4.15372 13.5607C4.4624 15.1126 5.22433 16.538 6.34315 17.6569C7.46197 18.7757 8.88743 19.5376 10.4393 19.8463C11.9911 20.155 13.5997 19.9965 15.0615 19.391C16.5233 18.7855 17.7727 17.7602 18.6518 16.4446C19.5308 15.129 20 13.5823 20 12C20 11.7348 20.1054 11.4804 20.2929 11.2929C20.4804 11.1054 20.7348 11 21 11C21.2652 11 21.5196 11.1054 21.7071 11.2929C21.8946 11.4804 22 11.7348 22 12C22 17.523 17.523 22 12 22C6.477 22 2 17.523 2 12C2 6.477 6.477 2 12 2ZM12 6C12.2652 6 12.5196 6.10536 12.7071 6.29289C12.8946 6.48043 13 6.73478 13 7C13 7.26522 12.8946 7.51957 12.7071 7.70711C12.5196 7.89464 12.2652 8 12 8C11.2089 8 10.4355 8.2346 9.77772 8.67412C9.11992 9.11365 8.60723 9.73836 8.30448 10.4693C8.00173 11.2002 7.92252 12.0044 8.07686 12.7804C8.2312 13.5563 8.61216 14.269 9.17157 14.8284C9.73098 15.3878 10.4437 15.7688 11.2196 15.9231C11.9956 16.0775 12.7998 15.9983 13.5307 15.6955C14.2616 15.3928 14.8864 14.8801 15.3259 14.2223C15.7654 13.5645 16 12.7911 16 12C16 11.7348 16.1054 11.4804 16.2929 11.2929C16.4804 11.1054 16.7348 11 17 11C17.2652 11 17.5196 11.1054 17.7071 11.2929C17.8946 11.4804 18 11.7348 18 12C18 13.1867 17.6481 14.3467 16.9888 15.3334C16.3295 16.3201 15.3925 17.0892 14.2961 17.5433C13.1997 17.9974 11.9933 18.1162 10.8295 17.8847C9.66557 17.6532 8.59647 17.0818 7.75736 16.2426C6.91824 15.4035 6.3468 14.3344 6.11529 13.1705C5.88378 12.0067 6.0026 10.8003 6.45672 9.7039C6.91085 8.60754 7.67988 7.67047 8.66658 7.01118C9.65327 6.35189 10.8133 6 12 6ZM18.571 2.1C18.7036 2.1 18.8308 2.15268 18.9246 2.24645C19.0183 2.34021 19.071 2.46739 19.071 2.6V4.43C19.0713 4.56243 19.1241 4.68935 19.2178 4.78291C19.3115 4.87646 19.4386 4.929 19.571 4.929H21.4C21.5326 4.929 21.6598 4.98168 21.7536 5.07545C21.8473 5.16921 21.9 5.29639 21.9 5.429V6.344L20.012 8.232C19.637 8.6071 19.1284 8.81789 18.598 8.818H16.598L12.708 12.707C12.5194 12.8892 12.2668 12.99 12.0046 12.9877C11.7424 12.9854 11.4916 12.8802 11.3062 12.6948C11.1208 12.5094 11.0156 12.2586 11.0133 11.9964C11.011 11.7342 11.1118 11.4816 11.294 11.293L15.184 7.404V5.404C15.1838 4.87375 15.3943 4.36515 15.769 3.99L17.659 2.1H18.571Z"
        fill="#8D99A5"
      />
    </svg>
  );
}

/* ── 선택 옵션 ── */
const DIVISIONS = ["교육원"];

function buildMonthOptions(): string[] {
  // 최근 12개월 (이번달 포함, 최신순)
  const now = new Date();
  const list: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    list.push(`${d.getFullYear()}년 ${d.getMonth() + 1}월`);
  }
  return list;
}

/* ── 공용 드롭다운 (헤더용) ── */
function HeaderSelect({
  value,
  options,
  onChange,
  bold = false,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  bold?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={wrapRef} className={styles.selectWrap}>
      <button
        type="button"
        className={styles.selectBtn}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={bold ? styles.selectTextBold : styles.selectText}>
          {value}
        </span>
        <ChevronDown size={16} className={styles.selectChevron} />
      </button>
      {open && (
        <div className={styles.selectMenu}>
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              className={`${styles.selectItem} ${opt === value ? styles.selectItemOn : ""}`}
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

function IconPlus() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
    >
      <path d="M14 7L2.38419e-07 7" stroke="#7A8086" strokeWidth="2" />
      <path
        d="M7 14C7 8.53266 7 5.46734 7 2.38419e-07"
        stroke="#7A8086"
        strokeWidth="2"
      />
    </svg>
  );
}

function IconRefresh() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
    >
      <path
        d="M8 2.03321C6.33627 2.03326 4.9234 2.61176 3.76758 3.76758C2.61175 4.92341 2.03326 6.33627 2.0332 8C2.03324 9.66366 2.61189 11.0766 3.76758 12.2324C4.92338 13.3881 6.33634 13.9667 8 13.9668C9.15476 13.9668 10.206 13.6683 11.1514 13.0713C12.0942 12.4758 12.8209 11.6814 13.3301 10.6895C13.4449 10.4884 13.4505 10.2715 13.3535 10.0498C13.2569 9.82916 13.0935 9.6795 12.8691 9.60938C12.6659 9.54261 12.463 9.5463 12.2646 9.6211C12.0646 9.69663 11.9086 9.83209 11.7998 10.0225L11.7988 10.0244C11.4289 10.718 10.9062 11.2704 10.2305 11.6826C9.55588 12.0941 8.81313 12.2998 8 12.2998C6.8041 12.2998 5.79066 11.8824 4.9541 11.0459C4.11766 10.2093 3.69926 9.1959 3.69922 8C3.69928 6.80403 4.11752 5.79069 4.9541 4.9541C5.79069 4.11752 6.80403 3.69928 8 3.69922C8.77737 3.69925 9.49674 3.89055 10.1592 4.27246C10.7709 4.62529 11.261 5.10193 11.6338 5.69922H9.4668C9.23471 5.69928 9.03476 5.78025 8.87402 5.94043C8.71317 6.10077 8.63235 6.30061 8.63281 6.53321C8.63336 6.76551 8.71437 6.96565 8.87402 7.12598C9.03393 7.2863 9.23401 7.36616 9.4668 7.36621H13.1338C13.3662 7.36664 13.5662 7.28728 13.7266 7.12696C13.887 6.96653 13.9668 6.76618 13.9668 6.53321V2.86621C13.9677 2.6342 13.8881 2.43412 13.7275 2.27344C13.5667 2.11272 13.3655 2.03266 13.1328 2.03321C12.9007 2.03391 12.7012 2.1138 12.541 2.27344C12.3805 2.43339 12.2999 2.63329 12.2998 2.86621V3.88672C11.7771 3.32321 11.1639 2.88126 10.4609 2.56348C9.67821 2.20974 8.85733 2.03323 8 2.03321Z"
        fill="#8D99A5"
      />
    </svg>
  );
}

function IconGear() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
    >
      <path
        d="M13.2668 8.44C13.1599 8.31834 13.1009 8.16194 13.1009 8C13.1009 7.83806 13.1599 7.68166 13.2668 7.56L14.1201 6.6C14.2141 6.49511 14.2725 6.36314 14.2869 6.22301C14.3013 6.08288 14.2709 5.94179 14.2001 5.82L12.8668 3.51333C12.7967 3.39168 12.69 3.29525 12.5619 3.23779C12.4338 3.18033 12.2909 3.16477 12.1534 3.19333L10.9001 3.44667C10.7406 3.47962 10.5746 3.45306 10.4334 3.372C10.2921 3.29094 10.1854 3.16099 10.1334 3.00667L9.72676 1.78667C9.68204 1.65425 9.59683 1.53924 9.48318 1.4579C9.36953 1.37655 9.23319 1.33297 9.09343 1.33333H6.42676C6.28138 1.32575 6.13752 1.36595 6.01714 1.44781C5.89676 1.52967 5.80648 1.64868 5.76009 1.78667L5.38676 3.00667C5.33476 3.16099 5.22807 3.29094 5.08684 3.372C4.9456 3.45306 4.77957 3.47962 4.62009 3.44667L3.33343 3.19333C3.20313 3.17492 3.07029 3.19548 2.95166 3.25243C2.83302 3.30937 2.73389 3.40015 2.66676 3.51333L1.33343 5.82C1.26087 5.94043 1.22824 6.08073 1.24022 6.22082C1.25219 6.36091 1.30815 6.49363 1.40009 6.6L2.24676 7.56C2.35364 7.68166 2.41258 7.83806 2.41258 8C2.41258 8.16194 2.35364 8.31834 2.24676 8.44L1.40009 9.4C1.30815 9.50637 1.25219 9.63909 1.24022 9.77919C1.22824 9.91928 1.26087 10.0596 1.33343 10.18L2.66676 12.4867C2.73683 12.6083 2.84351 12.7048 2.97159 12.7622C3.09968 12.8197 3.24264 12.8352 3.38009 12.8067L4.63343 12.5533C4.7929 12.5204 4.95893 12.5469 5.10017 12.628C5.24141 12.7091 5.34809 12.839 5.40009 12.9933L5.80676 14.2133C5.85315 14.3513 5.94342 14.4703 6.0638 14.5522C6.18418 14.6341 6.32805 14.6743 6.47343 14.6667H9.14009C9.27986 14.667 9.4162 14.6235 9.52985 14.5421C9.64349 14.4608 9.7287 14.3457 9.77343 14.2133L10.1801 12.9933C10.2321 12.839 10.3388 12.7091 10.48 12.628C10.6213 12.5469 10.7873 12.5204 10.9468 12.5533L12.2001 12.8067C12.3375 12.8352 12.4805 12.8197 12.6086 12.7622C12.7367 12.7048 12.8434 12.6083 12.9134 12.4867L14.2468 10.18C14.3175 10.0582 14.3479 9.91713 14.3336 9.777C14.3192 9.63687 14.2608 9.50489 14.1668 9.4L13.2668 8.44ZM12.2734 9.33333L12.8068 9.93333L11.9534 11.4133L11.1668 11.2533C10.6866 11.1552 10.1871 11.2367 9.76316 11.4825C9.33917 11.7283 9.02019 12.1212 8.86676 12.5867L8.61343 13.3333H6.90676L6.66676 12.5733C6.51333 12.1079 6.19435 11.715 5.77036 11.4692C5.34638 11.2234 4.84691 11.1419 4.36676 11.24L3.58009 11.4L2.71343 9.92667L3.24676 9.32667C3.57473 8.95999 3.75605 8.48529 3.75605 7.99333C3.75605 7.50138 3.57473 7.02668 3.24676 6.66L2.71343 6.06L3.56676 4.59333L4.35343 4.75333C4.83357 4.85148 5.33305 4.76992 5.75703 4.52413C6.18101 4.27835 6.5 3.88544 6.65343 3.42L6.90676 2.66667H8.61343L8.86676 3.42667C9.02019 3.89211 9.33917 4.28501 9.76316 4.5308C10.1871 4.77659 10.6866 4.85815 11.1668 4.76L11.9534 4.6L12.8068 6.08L12.2734 6.68C11.9491 7.04584 11.7701 7.51779 11.7701 8.00667C11.7701 8.49555 11.9491 8.96749 12.2734 9.33333ZM7.76009 5.33333C7.23268 5.33333 6.7171 5.48973 6.27857 5.78275C5.84004 6.07577 5.49825 6.49224 5.29641 6.97951C5.09458 7.46678 5.04177 8.00296 5.14467 8.52024C5.24756 9.03753 5.50154 9.51268 5.87448 9.88562C6.24742 10.2586 6.72257 10.5125 7.23985 10.6154C7.75714 10.7183 8.29331 10.6655 8.78058 10.4637C9.26785 10.2618 9.68433 9.92005 9.97735 9.48152C10.2704 9.04299 10.4268 8.52742 10.4268 8C10.4268 7.29276 10.1458 6.61448 9.64571 6.11438C9.14561 5.61429 8.46734 5.33333 7.76009 5.33333ZM7.76009 9.33333C7.49639 9.33333 7.2386 9.25514 7.01933 9.10863C6.80007 8.96212 6.62917 8.75388 6.52825 8.51025C6.42734 8.26661 6.40093 7.99852 6.45238 7.73988C6.50383 7.48124 6.63081 7.24366 6.81728 7.05719C7.00375 6.87072 7.24133 6.74373 7.49997 6.69229C7.75861 6.64084 8.0267 6.66724 8.27034 6.76816C8.51397 6.86908 8.72221 7.03998 8.86872 7.25924C9.01523 7.47851 9.09343 7.73629 9.09343 8C9.09343 8.35362 8.95295 8.69276 8.7029 8.94281C8.45285 9.19286 8.11372 9.33333 7.76009 9.33333Z"
        fill="#8D99A5"
      />
    </svg>
  );
}

const formatWon = (n: number) => n.toLocaleString("ko-KR");

// 지출 입력 라벨 → profit_settings 컬럼 매핑
const EXPENSE_FIELD_MAP: Record<string, string> = {
  인건비: "labor_cost",
  마케팅비: "marketing_cost",
  고정비: "fixed_cost",
  기타: "etc_cost",
};

type MonthlyRow = {
  month: string;
  sales: number;
  expenses: number;
  profit: number;
  goal: number;
};

export default function ProfitPage() {
  const router = useRouter();
  const monthOptions = buildMonthOptions();
  const [division, setDivision] = useState(DIVISIONS[0]);
  const [month, setMonth] = useState(monthOptions[0]);
  // 탭 — 영업 손익관리 / 매출 목표 관리 / 예상손익계산서
  const [tab, setTab] = useState<"profit" | "targets" | "pnl">("profit");
  // 매출목표 탭 노출 여부 — 관리자/팀장/본부장/경영지원본부만
  const [canTargets, setCanTargets] = useState(false);
  // 예상손익계산서 — 보기(팀장 제외) / 수정(마스터어드민·경영지원본부)
  const [canPnl, setCanPnl] = useState(false);
  const [canEditPnl, setCanEditPnl] = useState(false);

  // 접근 가드 — 관리자는 항상, 그 외는 profit 권한이 부여된 경우만 (URL 직접 접근 차단)
  const [accessChecked, setAccessChecked] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const profitScope = Array.isArray(data?.permissions)
          ? (data.permissions.find(
              (p: { section?: string; scope?: string }) =>
                p.section === "profit",
            )?.scope ?? "none")
          : "none";
        // 매출목표 관리 권한자(팀장/본부장/경영지원본부)도 합본 페이지 접근 허용
        const canSalesTarget =
          !!data &&
          (data.isDeptHead === true ||
            data.isLeader === true ||
            data.departmentCode === "MGT");
        const isAdmin =
          !!data && (data.role === "admin" || data.role === "master-admin");
        const allowed =
          isAdmin || profitScope !== "none" || canSalesTarget;
        if (!allowed) {
          router.replace("/work-journal");
          return;
        }
        // 매출목표 탭은 관리자/팀장/본부장/경영지원본부에게만
        setCanTargets(isAdmin || canSalesTarget);
        // 예상손익계산서 탭은 팀장 제외 (마스터/관리자/본부장/경영지원본부/profit권한)
        setCanPnl(
          isAdmin ||
            profitScope !== "none" ||
            data?.isDeptHead === true ||
            data?.departmentCode === "MGT",
        );
        // 예상손익계산서 수정 — 마스터어드민 + 경영지원본부(MGT)
        setCanEditPnl(
          (!!data && data.role === "master-admin") ||
            data?.departmentCode === "MGT",
        );
        setAccessChecked(true);
      })
      .catch(() => {
        if (!cancelled) router.replace("/work-journal");
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  // '2026년 6월' → '2026-06'
  const monthKey = (() => {
    const m = month.match(/(\d{4})년\s*(\d{1,2})월/);
    if (!m) {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }
    return `${m[1]}-${m[2].padStart(2, "0")}`;
  })();

  // ── 실데이터: 매출파일(edu_sales) 월별 집계 + 월별 설정(목표/지출) ──
  const [monthly, setMonthly] = useState<MonthlyRow[]>([]);
  // 최근 6개월 추이 차트 지표 토글 — 영업이익(원) / 영업이익률(%)
  const [trendMetric, setTrendMetric] = useState<"profit" | "rate">("profit");
  const [goal, setGoal] = useState(0);
  const [expenses, setExpenses] = useState<Record<string, number>>({
    인건비: 0,
    마케팅비: 0,
    고정비: 0,
    기타: 0,
  });
  const [lastUpdated, setLastUpdated] = useState("");

  const stampNow = () => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  };

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/profit?division=${encodeURIComponent(division)}&month=${monthKey}`,
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const data = await res.json();
      setMonthly(Array.isArray(data.monthly) ? data.monthly : []);
      const s = data.settings ?? {};
      setGoal(Number(s.goal ?? 0));
      setExpenses({
        인건비: Number(s.labor_cost ?? 0),
        마케팅비: Number(s.marketing_cost ?? 0),
        고정비: Number(s.fixed_cost ?? 0),
        기타: Number(s.etc_cost ?? 0),
      });
      setLastUpdated(stampNow());
    } catch {
      // 네트워크 오류 — 기존 표시 유지
    }
  }, [division, monthKey]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // 실시간 반영 — edu_sales는 RLS(서버 전용)라 Realtime 이벤트가 오지 않으므로
  // 1) 60초 주기 폴링 + 2) 탭 복귀 시 즉시 갱신 + 3) 등록학생(edu_students) 변경 이벤트로 보조
  useEffect(() => {
    const interval = setInterval(() => void fetchData(), 60000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void fetchData();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchData]);

  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel("profit-students-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "edu_students" },
        () => {
          void fetchData();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [fetchData]);

  // ── 설정 저장 (디바운스, 여러 필드 변경 합쳐서 1회 PUT) ──
  const pendingRef = useRef<Record<string, number>>({});
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueSave = useCallback(
    (fields: Record<string, number>) => {
      Object.assign(pendingRef.current, fields);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        const payload = { ...pendingRef.current };
        pendingRef.current = {};
        void fetch("/api/profit", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ division, month: monthKey, ...payload }),
        }).catch(() => {});
      }, 600);
    },
    [division, monthKey],
  );

  const handleExpenseChange = (key: string, raw: string) => {
    const n = parseInt(raw.replace(/[^\d]/g, "") || "0", 10);
    setExpenses((prev) => ({ ...prev, [key]: n }));
    queueSave({ [EXPENSE_FIELD_MAP[key]]: n });
  };

  // ── 목표 설정 팝오버 ──
  const [goalEditOpen, setGoalEditOpen] = useState(false);
  const [goalDraft, setGoalDraft] = useState("");
  const goalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!goalEditOpen) return;
    const handler = (e: MouseEvent) => {
      if (goalRef.current && !goalRef.current.contains(e.target as Node)) {
        setGoalEditOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [goalEditOpen]);
  const saveGoal = () => {
    const n = parseInt(goalDraft.replace(/[^\d]/g, "") || "0", 10);
    setGoal(n);
    setGoalEditOpen(false);
    void fetch("/api/profit", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ division, month: monthKey, goal: n }),
    }).catch(() => {});
  };

  // ── 파생 값 — 매출(실데이터) + 지출 입력 + 목표로부터 계산 ──
  const current = monthly.length > 0 ? monthly[monthly.length - 1] : null;
  const prev = monthly.length > 1 ? monthly[monthly.length - 2] : null;
  const sales = current?.sales ?? 0;
  const totalExpense = Object.values(expenses).reduce((a, b) => a + b, 0);
  const profit = sales - totalExpense;
  // 지출 미입력(0원) 상태에서는 이익률 100%가 떠버리므로 '-' 처리
  const hasExpense = totalExpense > 0;
  const profitRate =
    hasExpense && sales > 0 ? Math.round((profit / sales) * 1000) / 10 : null;

  // 전월대비 — 저번달(매출-지출) 기준, 저번달 지출이 입력된 경우에만 비교
  const prevHasExpense = prev != null && prev.expenses > 0;
  const prevProfit = prevHasExpense ? prev.profit : null;
  const prevRate =
    prevHasExpense && prev.sales > 0
      ? Math.round((prev.profit / prev.sales) * 1000) / 10
      : null;
  const profitDiff =
    prevProfit != null && prevProfit !== 0
      ? `${profit - prevProfit >= 0 ? "+" : ""}${Math.round(((profit - prevProfit) / Math.abs(prevProfit)) * 100)}%`
      : "-";
  const profitRateDiff =
    prevRate != null && profitRate != null
      ? `${profitRate - prevRate >= 0 ? "+" : ""}${Math.round((profitRate - prevRate) * 10) / 10}%p`
      : "-";

  const targetRate = goal > 0 ? Math.round((sales / goal) * 100) : 0;

  // 영업이익률 상태 배너 — 좋음 20% 이상 / 중간 15~20% / 경고 15% 미만
  const rateBanner =
    profitRate == null
      ? null
      : profitRate >= 20
        ? {
            style: styles.rateBannerGood,
            icon: "/face_01.png",
            text: "이익률이 매우 안정적입니다.",
          }
        : profitRate >= 15
          ? {
              style: styles.rateBannerMid,
              icon: "/face_02.png",
              text: "목표 수준을 유지중입니다.",
            }
          : {
              style: styles.rateBannerWarn,
              icon: "/face_03.png",
              text: "이익률 개선이 필요합니다.",
            };
  const targetRemain = Math.max(goal - sales, 0);
  // 달성률 전월대비 — 전월 목표가 설정된 경우에만
  const prevTargetRate =
    prev && prev.goal > 0 ? Math.round((prev.sales / prev.goal) * 100) : null;
  const targetRateDiff =
    prevTargetRate != null
      ? `${targetRate - prevTargetRate >= 0 ? "+" : ""}${targetRate - prevTargetRate}%p`
      : "-";

  // 최근 6개월 추이 — 선택월은 현재 입력 중인 지출 반영
  const trendData = monthly.map((m, i) => {
    const isLast = i === monthly.length - 1;
    const p = isLast ? profit : m.profit;
    const s = isLast ? sales : m.sales;
    const e = isLast ? totalExpense : m.expenses;
    return {
      month: `${parseInt(m.month.slice(5), 10)}월`,
      profit: p,
      rate: s > 0 && e > 0 ? Math.round((p / s) * 1000) / 10 : 0,
    };
  });

  // 마운트 후 true — 프로그레스바 0% → 목표치 채움 애니메이션 트리거
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // 권한 확인 전에는 화면을 노출하지 않는다 (URL 직접 접근 차단)
  if (!accessChecked) return null;

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        {/* 탭 — 영업 손익관리 / 매출 목표 관리 (매출목표는 권한자만) */}
        {canTargets && (
          <div className={styles.tabBar}>
            <button
              type="button"
              className={`${styles.tab} ${tab === "profit" ? styles.tabOn : ""}`}
              onClick={() => setTab("profit")}
            >
              영업 손익관리
            </button>
            <button
              type="button"
              className={`${styles.tab} ${tab === "targets" ? styles.tabOn : ""}`}
              onClick={() => setTab("targets")}
            >
              매출 목표 관리
            </button>
            {canPnl && (
              <button
                type="button"
                className={`${styles.tab} ${tab === "pnl" ? styles.tabOn : ""}`}
                onClick={() => setTab("pnl")}
              >
                예상손익계산서
              </button>
            )}
          </div>
        )}

        {canTargets && tab === "targets" ? (
          <SalesTargetsBoard />
        ) : canPnl && tab === "pnl" ? (
          <ProfitPnlBoard canEdit={canEditPnl} />
        ) : (
          <>
        {/* ── 헤더: 사업부 선택 + 월 선택 ── */}
        <div className={styles.header}>
          <HeaderSelect
            value={division}
            options={DIVISIONS}
            onChange={setDivision}
            bold
          />
          <HeaderSelect
            value={month}
            options={monthOptions}
            onChange={setMonth}
          />
        </div>

        {/* ── KPI 띠: 영업이익 / 영업이익률 / 목표 매출 달성률 ── */}
        <div className={styles.kpiBand}>
          <div className={styles.kpiCard}>
            <div className={styles.kpiTop}>
              <div className={styles.kpiInfo}>
                <p className={styles.kpiLabel}>이번달 영업이익</p>
                <div className={styles.kpiValueRow}>
                  <span className={styles.kpiValueBlue}>
                    {formatWon(profit)}
                  </span>
                  <span className={styles.kpiUnit}>원</span>
                </div>
              </div>
              <IconProfit />
            </div>
            <p className={styles.kpiCompare}>
              전월대비{" "}
              <span className={styles.kpiCompareValue}>{profitDiff}</span>
            </p>
          </div>

          <svg
            className={styles.kpiDivider}
            width="1"
            height="40"
            viewBox="0 0 1 40"
            fill="none"
          >
            <path d="M0.5 0V40" stroke="#E6E7EB" />
          </svg>

          <div className={styles.kpiCard}>
            <div className={styles.kpiTop}>
              <div className={styles.kpiInfo}>
                <p className={styles.kpiLabel}>영업이익률</p>
                <div className={styles.kpiValueRow}>
                  <span className={styles.kpiValue}>{profitRate ?? "-"}</span>
                  {profitRate != null && (
                    <span className={styles.kpiUnit}>%</span>
                  )}
                </div>
              </div>
              <IconRate />
            </div>
            <p className={styles.kpiCompare}>
              전월대비{" "}
              <span className={styles.kpiCompareValue}>{profitRateDiff}</span>
            </p>
          </div>

          <svg
            className={styles.kpiDivider}
            width="1"
            height="40"
            viewBox="0 0 1 40"
            fill="none"
          >
            <path d="M0.5 0V40" stroke="#E6E7EB" />
          </svg>

          <div className={styles.kpiCard}>
            <div className={styles.kpiTop}>
              <div className={styles.kpiInfo}>
                <p className={styles.kpiLabel}>목표 매출 달성률</p>
                <div className={styles.kpiValueRow}>
                  <span className={styles.kpiValue}>{targetRate}</span>
                  <span className={styles.kpiUnit}>%</span>
                </div>
              </div>
              <IconTarget />
            </div>
            <div className={styles.kpiTargetBottom}>
              <div className={styles.kpiTargetMeta}>
                <p className={styles.kpiCompare}>
                  전월대비{" "}
                  <span className={styles.kpiCompareValue}>
                    {targetRateDiff}
                  </span>
                </p>
                <p className={styles.kpiCompare}>
                  목표까지{" "}
                  <span className={styles.kpiCompareValue}>
                    {formatWon(targetRemain)}원
                  </span>
                </p>
              </div>
              <div className={styles.kpiProgressTrack}>
                <div
                  className={styles.kpiProgressFill}
                  style={{
                    width: mounted ? `${Math.min(targetRate, 100)}%` : "0%",
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── 본문: 좌측 컬럼(목표매출/손익요약) + 우측 영역(지출계산/차트) ── */}
        <div className={styles.bodyRow}>
          <div className={styles.leftCol}>
            {/* 목표매출 카드 */}
            <div className={styles.goalCard}>
              <div className={styles.goalHead}>
                <span className={styles.goalTitle}>목표매출</span>
                <div ref={goalRef} className={styles.goalEditWrap}>
                  <button
                    type="button"
                    className={styles.goalSetBtn}
                    onClick={() => {
                      setGoalDraft(goal > 0 ? formatWon(goal) : "");
                      setGoalEditOpen((v) => !v);
                    }}
                  >
                    <IconGear />
                    목표 설정
                  </button>
                  {goalEditOpen && (
                    <div className={styles.goalPopover}>
                      <p className={styles.goalPopoverTitle}>
                        {monthKey.replace("-", "년 ")}월 목표매출
                      </p>
                      <div className={styles.goalPopoverInputWrap}>
                        <input
                          className={styles.goalPopoverInput}
                          value={goalDraft}
                          onChange={(e) =>
                            setGoalDraft(
                              e.target.value.replace(/[^\d]/g, "")
                                ? formatWon(
                                    parseInt(
                                      e.target.value.replace(/[^\d]/g, ""),
                                      10,
                                    ),
                                  )
                                : "",
                            )
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveGoal();
                          }}
                          inputMode="numeric"
                          placeholder="0"
                          autoFocus
                        />
                        <span className={styles.expenseWon}>원</span>
                      </div>
                      <button
                        type="button"
                        className={styles.goalPopoverSave}
                        onClick={saveGoal}
                      >
                        저장
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className={styles.goalValueRow}>
                <span className={styles.goalValue}>{formatWon(goal)}</span>
                <span className={styles.goalUnit}>원</span>
              </div>
            </div>

            {/* 이번달 손익 요약 카드 */}
            <div className={styles.summaryCard}>
              <p className={styles.summaryTitle}>이번달 손익 요약</p>
              <div className={styles.summaryBody}>
                <div className={styles.summaryRow}>
                  <span className={styles.summaryLabel}>현재 매출</span>
                  <div className={styles.summaryValueRow}>
                    <span className={styles.summaryValueGreen}>
                      {formatWon(sales)}
                    </span>
                    <span className={styles.summaryUnit}>원</span>
                  </div>
                </div>
                <div className={styles.summaryRow}>
                  <span className={styles.summaryLabel}>- 지출</span>
                  <div className={styles.summaryValueRow}>
                    <span className={styles.summaryValueRed}>
                      {formatWon(totalExpense)}
                    </span>
                    <span className={styles.summaryUnit}>원</span>
                  </div>
                </div>
                <div className={styles.summaryDivider} />
                <div className={styles.summaryRow}>
                  <span className={styles.summaryLabel}>= 영업이익</span>
                  <div className={styles.summaryValueRow}>
                    <span className={styles.summaryValueBlue}>
                      {formatWon(profit)}
                    </span>
                    <span className={styles.summaryUnit}>원</span>
                  </div>
                </div>
                <div className={styles.summaryRow}>
                  <span className={styles.summaryLabel}>영업이익률</span>
                  <div className={styles.summaryValueRow}>
                    <span className={styles.summaryValue}>
                      {profitRate ?? "-"}
                    </span>
                    {profitRate != null && (
                      <span className={styles.summaryUnit}>%</span>
                    )}
                  </div>
                </div>
              </div>
              {rateBanner && (
                <div className={`${styles.rateBanner} ${rateBanner.style}`}>
                  <Image
                    src={rateBanner.icon}
                    alt=""
                    width={24}
                    height={24}
                    className={styles.rateBannerIcon}
                  />
                  <span className={styles.rateBannerText}>
                    {rateBanner.text}
                  </span>
                </div>
              )}
            </div>

            {/* 최근 업데이트 */}
            <div className={styles.updateBar}>
              <span className={styles.updateLabel}>최근 업데이트</span>
              <div className={styles.updateRight}>
                <span className={styles.updateTime}>{lastUpdated}</span>
                <button
                  type="button"
                  className={styles.updateRefreshBtn}
                  onClick={() => void fetchData()}
                  title="새로고침"
                >
                  <IconRefresh />
                </button>
              </div>
            </div>
          </div>

          {/* 우측 영역: 지출 계산 + 최근 6개월 추이 */}
          <div className={styles.rightCol}>
            {/* 지출 계산 카드 */}
            <div className={styles.expenseCard}>
              <p className={styles.expenseTitle}>지출 계산</p>
              <div className={styles.expenseRow}>
                {Object.keys(expenses).map((key, idx) => (
                  <Fragment key={key}>
                    {idx > 0 && (
                      <span className={styles.expenseOp}>
                        <IconPlus />
                      </span>
                    )}
                    <div className={styles.expenseItem}>
                      <span className={styles.expenseLabel}>{key}</span>
                      <div className={styles.expenseInputWrap}>
                        <input
                          className={styles.expenseInput}
                          value={formatWon(expenses[key])}
                          onChange={(e) =>
                            handleExpenseChange(key, e.target.value)
                          }
                          inputMode="numeric"
                        />
                        <span className={styles.expenseWon}>원</span>
                      </div>
                    </div>
                  </Fragment>
                ))}
                <span className={styles.expenseOp}>=</span>
                <div className={styles.expenseTotal}>
                  <span className={styles.expenseTotalLabel}>총 지출</span>
                  <div className={styles.expenseTotalValueRow}>
                    <span className={styles.expenseTotalValue}>
                      {formatWon(totalExpense)}
                    </span>
                    <span className={styles.expenseTotalValue}>원</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 최근 6개월 추이 — 영업이익 / 영업이익률 토글 */}
            <div className={styles.chartCard}>
              <div className={styles.chartHeader}>
                <p className={styles.chartTitle}>최근 6개월 추이</p>
                <div className={styles.chartToggle}>
                  <button
                    type="button"
                    className={`${styles.chartToggleBtn} ${trendMetric === "profit" ? styles.chartToggleBtnActive : ""}`}
                    onClick={() => setTrendMetric("profit")}
                  >
                    영업이익
                  </button>
                  <button
                    type="button"
                    className={`${styles.chartToggleBtn} ${trendMetric === "rate" ? styles.chartToggleBtnActive : ""}`}
                    onClick={() => setTrendMetric("rate")}
                  >
                    영업이익률
                  </button>
                </div>
              </div>
              <div className={styles.chartBody}>
                <span className={styles.chartUnit}>
                  {trendMetric === "profit" ? "(단위:원)" : "(단위:%)"}
                </span>
                <div className={styles.chartPlot}>
                  <Area
                    key={trendMetric}
                    data={trendData}
                    xField="month"
                    yField={trendMetric}
                    autoFit
                    height={300}
                    padding="auto"
                    smooth
                    style={{
                      fill: "linear-gradient(-90deg, rgba(0,132,254,0) 0%, rgba(0,132,254,0.28) 100%)",
                    }}
                    line={{ style: { stroke: "#0084FE", lineWidth: 2.5 } }}
                    point={{
                      sizeField: 4.5,
                      style: {
                        fill: "#0084FE",
                        stroke: "#FFF",
                        lineWidth: 1.5,
                      },
                    }}
                    axis={{
                      y: {
                        labelFormatter: (v: number) =>
                          trendMetric === "profit"
                            ? `${(v / 10000).toLocaleString("ko-KR")}만`
                            : `${v}%`,
                      },
                    }}
                    scale={{ y: { nice: true } }}
                    animate={{
                      enter: { type: "growInX", duration: 1200 },
                    }}
                    tooltip={{
                      items: [
                        {
                          field: trendMetric,
                          name:
                            trendMetric === "profit"
                              ? "영업이익"
                              : "영업이익률",
                          valueFormatter: (v: number) =>
                            trendMetric === "profit"
                              ? `${v.toLocaleString("ko-KR")}원`
                              : `${v}%`,
                        },
                      ],
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
          </>
        )}
      </div>
    </div>
  );
}
