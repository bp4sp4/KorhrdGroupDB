"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Plus,
  Save,
  Send,
  Trash2,
} from "lucide-react";
import styles from "./page.module.css";

type Task = { id: string; text: string; done: boolean };
type JournalRow = { id: string; category: string; detail: string };
type Tomorrow = { id: string; text: string };

const DOW = ["일", "월", "화", "수", "목", "금", "토"];

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

/** 내용 길이에 따라 height 자동 조정되는 textarea */
function AutoSizeTextarea({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // value 가 바뀔 때마다 height 재계산 (초기 mount 포함)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={1}
      className={className}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export default function WorkJournalPage() {
  const today = useMemo(() => toISODate(new Date()), []);
  const [date, setDate] = useState<string>(today);

  const [tasks, setTasks] = useState<Task[]>([
    { id: uid(), text: "오전 11시 김하준 상담 진행", done: true },
    { id: uid(), text: "개인 블로그 업로드", done: true },
    { id: uid(), text: "상담 완료 등록 처리 - 김민지/박서영", done: false },
    { id: uid(), text: "신규 문의 응대 (네이버 폼 / 카톡 채널)", done: false },
    { id: uid(), text: "오후 3시 팀 미팅 참석", done: false },
    { id: uid(), text: "주간 매출 시트 정리", done: false },
  ]);

  const [morningOpen, setMorningOpen] = useState(true);
  const [afternoonOpen, setAfternoonOpen] = useState(true);

  const [morning, setMorning] = useState<JournalRow[]>([
    {
      id: uid(),
      category: "상담 / 등록",
      detail: "김하준 사복 상담 완료 후 결제 진행",
    },
    { id: uid(), category: "응대 / 문의", detail: "신규 카톡 문의 4건 응대" },
  ]);
  const [afternoon, setAfternoon] = useState<JournalRow[]>([
    { id: uid(), category: "회의 / 보고", detail: "팀 주간 회의 (KPI 점검)" },
    { id: uid(), category: "정리 / 기타", detail: "" },
  ]);

  const [tomorrow, setTomorrow] = useState<Tomorrow[]>([
    { id: uid(), text: "오전 10시 박지원 상담" },
    { id: uid(), text: "주간 보고서 작성 마감" },
    { id: uid(), text: "신규 광고 소재 검토" },
    { id: uid(), text: "" },
  ]);

  // ── 핸들러 ──────────────────────────────────────────────
  const toggleTask = (id: string) =>
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    );

  const updateTaskText = (id: string, text: string) =>
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, text } : t)));

  const removeTask = (id: string) =>
    setTasks((prev) => prev.filter((t) => t.id !== id));

  const updateRow = (
    section: "morning" | "afternoon",
    id: string,
    patch: Partial<JournalRow>,
  ) => {
    const setter = section === "morning" ? setMorning : setAfternoon;
    setter((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const addRow = (section: "morning" | "afternoon") => {
    const setter = section === "morning" ? setMorning : setAfternoon;
    setter((prev) => [...prev, { id: uid(), category: "", detail: "" }]);
  };

  const removeRow = (section: "morning" | "afternoon", id: string) => {
    const setter = section === "morning" ? setMorning : setAfternoon;
    setter((prev) => prev.filter((r) => r.id !== id));
  };

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

  // ── 임시저장 / 제출 (현재는 로컬만) ─────────────────────
  const handleDraft = () => {
    const payload = { date, tasks, morning, afternoon, tomorrow };
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        "work-journal-draft",
        JSON.stringify(payload),
      );
      alert("임시저장 완료");
    }
  };

  const handleSubmit = () => {
    // TODO: 추후 DB 연동
    alert("제출 기능은 곧 활성화됩니다.");
  };

  // ── 카운트 ──────────────────────────────────────────────
  const doneCount = tasks.filter((t) => t.done).length;
  const totalCount = tasks.length;

  return (
    <div className={styles.app}>
      <div className={styles.container}>
        {/* ── 상단 stats 행 ──────────────────────────────── */}
        <div className={styles.topRow}>
          {/* 날짜 카드 */}
          <div className={styles.dateCard}>
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
                <span className={styles.dateValue}>000건</span>
                <ChevronRight className={styles.dateRowIcon} size={16} />
              </div>
            </div>
          </div>

          {/* 4 stat 합쳐진 하나의 카드 (mock 데이터) */}
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
              <span className={styles.statLabel}>전체문의</span>
              <span className={styles.statValue}>166건</span>
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
                  <span className={styles.statValue}>6건</span>
                </div>
                <div className={styles.statSub}>
                  <span>전일대비</span>
                  <span>1건</span>
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
                  <span className={styles.statValue}>34.2%</span>
                </div>
                <div className={styles.statSub}>
                  <span>전일대비</span>
                  <span>5.1%p</span>
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
                  <span className={styles.statValue}>914만원</span>
                </div>
                <div className={styles.statSub}>
                  <span>전일대비</span>
                  <span>120만원</span>
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
        </div>

        {/* ── 3컬럼 본문 ───────────────────────────────── */}
        <div className={styles.bodyRow}>
          {/* 좌: 오늘의 업무 */}
          <section className={styles.col}>
            <h3 className={styles.colTitle}>오늘의 업무</h3>
            <div className={styles.taskList}>
              {tasks.map((t) => (
                <div key={t.id} className={styles.taskItem}>
                  <input
                    type="checkbox"
                    className={styles.taskCheckbox}
                    checked={t.done}
                    onChange={() => toggleTask(t.id)}
                  />
                  <AutoSizeTextarea
                    value={t.text}
                    placeholder="할 일을 입력하세요"
                    className={`${styles.taskInput} ${t.done ? styles.taskTextDone : ""}`}
                    onChange={(v) => updateTaskText(t.id, v)}
                  />
                  <button
                    type="button"
                    className={styles.journalDeleteBtn}
                    onClick={() => removeTask(t.id)}
                    aria-label="삭제"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* 중: 업무 일지 */}
          <section className={`${styles.col} ${styles.colJournal}`}>
            <h3 className={styles.colTitle}>업무 일지</h3>
            <div className={styles.journalScroll}>
              {/* 오전 */}
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
                  {morning.map((row) => (
                    <div key={row.id} className={styles.journalRow}>
                      <div className={styles.journalRowMain}>
                        <div className={styles.journalCategoryBox}>
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
                          />
                        </div>
                        <input
                          type="text"
                          className={styles.journalDetailInput}
                          placeholder="세부 업무 내용을 작성해주세요."
                          value={row.detail}
                          onChange={(e) =>
                            updateRow("morning", row.id, {
                              detail: e.target.value,
                            })
                          }
                        />
                      </div>
                      <button
                        type="button"
                        className={styles.journalDeleteBtn}
                        onClick={() => removeRow("morning", row.id)}
                        aria-label="삭제"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className={styles.addBtn}
                    onClick={() => addRow("morning")}
                  >
                    <Plus size={12} /> 추가
                  </button>
                </>
              )}

              {/* 오후 */}
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
                  {afternoon.map((row) => (
                    <div key={row.id} className={styles.journalRow}>
                      <div className={styles.journalRowMain}>
                        <div className={styles.journalCategoryBox}>
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
                        </div>
                        <input
                          type="text"
                          className={styles.journalDetailInput}
                          placeholder="세부 업무 내용을 작성해주세요."
                          value={row.detail}
                          onChange={(e) =>
                            updateRow("afternoon", row.id, {
                              detail: e.target.value,
                            })
                          }
                        />
                      </div>
                      <button
                        type="button"
                        className={styles.journalDeleteBtn}
                        onClick={() => removeRow("afternoon", row.id)}
                        aria-label="삭제"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
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
          </section>

          {/* 우: 내일 예정 업무 (박스 + 푸터 wrapper) */}
          <div className={styles.colRight}>
            <section className={styles.col}>
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
                    <button
                      type="button"
                      className={styles.journalDeleteBtn}
                      onClick={() => removeTomorrow(t.id)}
                      aria-label="삭제"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* 박스 바깥 푸터 (박스 폭에 맞춰 정렬) */}
            <div className={styles.footer}>
              <button
                type="button"
                className={styles.btnDraft}
                onClick={handleDraft}
              >
                <Save size={14} /> 임시저장
              </button>
              <button
                type="button"
                className={styles.btnSubmit}
                onClick={handleSubmit}
              >
                <Send size={14} /> 제출하기
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
