"use client";

import {
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useRef,
} from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  AreaChart,
  PieChart,
  Bar,
  Line,
  Area,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import styles from "./page.module.css";
import MemoTimeline from "@/components/ui/MemoTimeline";
import MemoHoverBadge from "@/components/ui/MemoHoverBadge";
import {
  TableSkeleton,
  StatsCardsSkeleton,
  ChartsGridSkeleton,
  FilterBarSkeleton,
} from "@/components/ui/Skeleton";
import { downloadExcel } from "@/lib/excelExport";
import { DateInput } from "@/components/ui/Calendar/DateInput";
import { DateRangeCalendar } from "@/components/DateRangeCalendar";
import type { DateRange } from "react-day-picker";
import EduStudentsTab from "./education-center/EduStudentsTab";
import HakjeomCustomSelect from "../admin/customers/CustomSelect";
import { DEMO_LIST as HAKJEOM_DEMO_LIST } from "@/lib/guide/hakjeomDemo";
import AgentAvailability from "./_components/AgentAvailability";
import ComboExplorer from "./_components/ComboExplorer";
import ManagerMatcher from "./_components/ManagerMatcher";
import { Search, HelpCircle } from "lucide-react";
import { useGuide } from "@/components/guide/GuideProvider";
import type {
  ConsultationStatus,
  AgencyStatus,
  TabKey,
  HakjeomConsultation,
  Agency,
  RowType,
  BulkTabView,
  StagingRow,
  CsvRow,
} from "./_types";
import {
  CONSULTATION_STATUS_OPTIONS,
  COUNSEL_SUB,
  COUNSEL_SUB_LABEL,
  AGENCY_STATUS_OPTIONS,
  CONSULTATION_STATUS_STYLE,
  AGENCY_STATUS_STYLE,
  CERT_MAJOR_CATEGORIES,
  COUNSEL_CHECK_OPTIONS,
  REASON_OPTIONS,
  EDUCATION_OPTIONS,
  HAKJEOM_COURSE_OPTIONS,
  HOPE_COURSE_FILTER_OPTIONS,
  CURRENT_SITUATION_OPTIONS,
  REACTION_POINT_MAP,
  SHOW_AUTO_REACTION_TOAST,
  REACTION_KEYWORD_MAP,
  matchReactionPoints,
  EDUCATION_CUSTOM,
  SOURCE_MAJORS,
  SOURCE_MAJOR_LABEL,
  REFERRER_CARD_META,
  DANGGEUN_DEFAULT_OPTIONS,
} from "./_constants";
import type { ReferrerCardMeta } from "./_constants";
import {
  formatDate,
  formatDateShort,
  formatCost,
  formatPhoneNumber,
  getPaginationPages,
} from "./_utils";
import {
  CAFE_NAMES,
  CAFE_CANONICAL_NAMES,
  CAFE_ALIAS_MAP,
  normalizeCafeName,
  KNOWN_CAFE_IDS,
  KNOWN_CAFE_KOREAN,
  parseClickSource,
  formatClickSourceDisplay,
  CAFE_NAME_LIST,
} from "./_cafe";
import { StatusBadge } from "./_components/StatusBadge";
import { Highlight } from "./_components/Highlight";
import { FastConsultBadge } from "@/components/ui/FastConsultBadge";
import { CustomSelect } from "./_components/CustomSelect";
import { StatusSelect } from "./_components/StatusSelect";
import { HakjeomDetailPanel } from "./_detail/HakjeomDetailPanel";

let _hakjeomBannerCache: { date: string; data: HakjeomConsultation[] } | null =
  null;

// 응답시간 — 배정(manager_assigned_at) → 상담 시작(consult_started_at)까지 걸린 시간
function formatResponseTime(
  assignedAt?: string | null,
  startedAt?: string | null,
): string {
  if (!assignedAt || !startedAt) return "-";
  const ms = new Date(startedAt).getTime() - new Date(assignedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "-";
  const min = Math.floor(ms / 60000);
  if (min < 1) return "1분 미만";
  const days = Math.floor(min / 1440);
  const hours = Math.floor((min % 1440) / 60);
  const mins = min % 60;
  if (days > 0) return hours > 0 ? `${days}일 ${hours}시간` : `${days}일`;
  if (hours > 0) return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`;
  return `${mins}분`;
}

// 분(평균 등) → "12분 / 1시간 5분 / 2일" 표기
function formatMinutes(min: number | null): string {
  if (min == null) return "-";
  if (min < 1) return "1분 미만";
  const days = Math.floor(min / 1440);
  const hours = Math.floor((min % 1440) / 60);
  const mins = min % 60;
  if (days > 0) return hours > 0 ? `${days}일 ${hours}시간` : `${days}일`;
  if (hours > 0) return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`;
  return `${mins}분`;
}

// 배정시간 — 등록(created_at) → 담당지정(manager_assigned_at)까지 걸린 시간
function formatAssignDelay(
  createdAt?: string | null,
  assignedAt?: string | null,
): string {
  if (!createdAt || !assignedAt) return "-";
  const ms = new Date(assignedAt).getTime() - new Date(createdAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "-";
  const min = Math.floor(ms / 60000);
  if (min < 1) return "1분 미만";
  const days = Math.floor(min / 1440);
  const hours = Math.floor((min % 1440) / 60);
  const mins = min % 60;
  if (days > 0) return hours > 0 ? `${days}일 ${hours}시간` : `${days}일`;
  if (hours > 0) return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`;
  return `${mins}분`;
}

// ─── 공통 서브 컴포넌트 ──────────────────────────────────────────────────────

// 섹션 래퍼
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.section}>
      <p className={styles.sectionTitle}>{title}</p>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.infoRow}>
      <span className={styles.infoRowLabel}>{label}</span>
      <span className={styles.infoRowValue}>{value}</span>
    </div>
  );
}


// ─── 모달: 신규 추가 (학점은행제) ────────────────────────────────────────────

interface HakjeomAddModalProps {
  onClose: () => void;
  onSaved: () => void;
  uniqueManagers?: string[];
  // 지정 시 담당자를 이 값으로 고정 (워크스페이스에서 본인으로 자동 할당)
  fixedManager?: string;
  customCafes: string[];
  customDanggeun: string[];
  onAddCafe: (name: string) => Promise<void>;
  onDeleteCafe: (name: string) => Promise<void>;
  onAddDanggeun: (name: string) => Promise<void>;
  onDeleteDanggeun: (name: string) => Promise<void>;
}

export function HakjeomAddModal({
  onClose,
  onSaved,
  uniqueManagers = [],
  fixedManager,
  customCafes,
  customDanggeun,
  onAddCafe,
  onDeleteCafe,
  onAddDanggeun,
  onDeleteDanggeun,
}: HakjeomAddModalProps) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: "",
    contact: "",
    education: "",
    hope_course: [] as string[],
    reason: [] as string[],
    counsel_check: [] as string[],
    counsel_check_etc: "",
    sourceMajor: "",
    sourceMinor: "",
    subject_cost: "",
    manager: fixedManager ?? "",
    residence: "",
    memo: "",
    current_situation: "",
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; contact?: string }>({});
  const [showManagerInput, setShowManagerInput] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const contactRef = useRef<HTMLInputElement>(null);
  const [modalCafeAddInput, setModalCafeAddInput] = useState("");
  const [modalShowCafeAdd, setModalShowCafeAdd] = useState(false);
  const [modalDanggeunAddInput, setModalDanggeunAddInput] = useState("");
  const [modalShowDanggeunAdd, setModalShowDanggeunAdd] = useState(false);

  const handleModalAddCafe = async () => {
    const name = modalCafeAddInput.trim();
    if (!name || CAFE_NAME_LIST.includes(name) || customCafes.includes(name))
      return;
    await onAddCafe(name);
    setForm((p) => ({ ...p, sourceMinor: name }));
    setModalCafeAddInput("");
    setModalShowCafeAdd(false);
  };

  const handleModalAddDanggeun = async () => {
    const name = modalDanggeunAddInput.trim();
    if (!name || customDanggeun.includes(name)) return;
    await onAddDanggeun(name);
    setForm((p) => ({ ...p, sourceMinor: name }));
    setModalDanggeunAddInput("");
    setModalShowDanggeunAdd(false);
  };

  const handleModalDeleteCafe = async (name: string) => {
    if (!window.confirm(`"${name}" 카페를 삭제하시겠습니까?`)) return;
    await onDeleteCafe(name);
    if (form.sourceMinor === name) setForm((p) => ({ ...p, sourceMinor: "" }));
  };

  const handleModalDeleteDanggeun = async (name: string) => {
    if (!window.confirm(`"${name}"을(를) 삭제하시겠습니까?`)) return;
    await onDeleteDanggeun(name);
    if (form.sourceMinor === name) setForm((p) => ({ ...p, sourceMinor: "" }));
  };

  const TOTAL_STEPS = 3;

  const toggleArr = (arr: string[], val: string) =>
    arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];

  useEffect(() => {
    if (step === 1) setTimeout(() => nameRef.current?.focus(), 50);
  }, [step]);

  const validateStep1 = () => {
    const newErrors: { name?: string; contact?: string } = {};
    if (!form.name.trim()) newErrors.name = "이름을 입력해주세요";
    if (!form.contact.trim()) newErrors.contact = "연락처를 입력해주세요";
    else if (form.contact.replace(/-/g, "").length < 10)
      newErrors.contact = "연락처를 정확히 입력해주세요";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return;
    if (step < TOTAL_STEPS) setStep((s) => s + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep((s) => s - 1);
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/hakjeom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          // fixedManager 가 지정된 경우(워크스페이스 등) 담당자를 항상 본인으로 강제
          manager: fixedManager || form.manager,
          hope_course: form.hope_course.join(", "),
          reason: form.reason.join(", "),
          counsel_check: [
            ...form.counsel_check.filter((c) => c !== "기타"),
            ...(form.counsel_check.includes("기타") &&
            form.counsel_check_etc.trim()
              ? [`기타(${form.counsel_check_etc.trim()})`]
              : form.counsel_check.includes("기타")
                ? ["기타"]
                : []),
          ].join(", "),
          click_source: form.sourceMajor
            ? form.sourceMinor
              ? `${form.sourceMajor}_${form.sourceMinor}`
              : form.sourceMajor
            : "",
          is_manual_entry: true,
        }),
      });
      if (!res.ok) throw new Error("추가 실패");
      onSaved();
      onClose();
    } catch {
      alert("추가에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleContactChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = formatPhoneNumber(e.target.value);
    setForm((p) => ({ ...p, contact: val }));
    if (errors.contact) setErrors((p) => ({ ...p, contact: undefined }));
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={styles.modalOverlay}
    >
      <div className={styles.funnelBox}>
        {/* 헤더 */}
        <div className={styles.funnelHeader}>
          <button
            type="button"
            onClick={step === 1 ? onClose : handleBack}
            className={styles.funnelBackBtn}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="M14 9H4M4 9L8 5M4 9L8 13"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <span className={styles.funnelStepLabel}>
            {step} / {TOTAL_STEPS}
          </span>
          <button
            type="button"
            onClick={onClose}
            className={styles.funnelCloseBtn}
          >
            ✕
          </button>
        </div>

        {/* 진행 바 */}
        <div className={styles.funnelProgressBar}>
          <div
            className={styles.funnelProgressFill}
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>

        {/* 스텝 콘텐츠 */}
        <div className={styles.funnelBody}>
          {/* ── Step 1: 기본 정보 + 희망과정 ── */}
          {step === 1 && (
            <div className={styles.funnelStep}>
              <p className={styles.funnelQuestion}>학생 정보를 입력해주세요</p>
              <div className={styles.funnelFieldGroup}>
                <label className={styles.funnelLabel}>이름</label>
                <input
                  ref={nameRef}
                  value={form.name}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, name: e.target.value }));
                    if (errors.name)
                      setErrors((p) => ({ ...p, name: undefined }));
                  }}
                  onKeyDown={(e) =>
                    e.key === "Enter" && contactRef.current?.focus()
                  }
                  placeholder="홍길동"
                  className={`${styles.funnelInput}${errors.name ? ` ${styles.funnelInputError}` : ""}`}
                />
                {errors.name && (
                  <p className={styles.funnelError}>{errors.name}</p>
                )}
              </div>
              <div className={styles.funnelFieldGroup}>
                <label className={styles.funnelLabel}>연락처</label>
                <input
                  ref={contactRef}
                  value={form.contact}
                  onChange={handleContactChange}
                  placeholder="010-0000-0000"
                  inputMode="tel"
                  className={`${styles.funnelInput}${errors.contact ? ` ${styles.funnelInputError}` : ""}`}
                />
                {errors.contact && (
                  <p className={styles.funnelError}>{errors.contact}</p>
                )}
              </div>
              <div className={styles.funnelFieldGroup}>
                <label className={styles.funnelLabel}>
                  거주지 <span className={styles.funnelOptional}>(선택)</span>
                </label>
                <input
                  value={form.residence}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, residence: e.target.value }))
                  }
                  placeholder="예) 서울 강남구"
                  className={styles.funnelInput}
                />
              </div>
              <div className={styles.funnelFieldGroup}>
                <label className={styles.funnelLabel}>
                  현재상황 <span className={styles.funnelOptional}>(선택)</span>
                </label>
                <div
                  className={styles.funnelTagRow}
                  style={{ flexWrap: "wrap" }}
                >
                  {CURRENT_SITUATION_OPTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() =>
                        setForm((p) => ({
                          ...p,
                          current_situation: p.current_situation === s ? "" : s,
                        }))
                      }
                      className={
                        form.current_situation === s
                          ? styles.tagBtnV2Active
                          : styles.tagBtnV2
                      }
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.funnelFieldGroup}>
                <label className={styles.funnelLabel}>
                  희망과정{" "}
                  <span className={styles.funnelOptional}>
                    (복수 선택 가능)
                  </span>
                </label>
                <div
                  className={styles.funnelTagRow}
                  style={{ flexWrap: "wrap" }}
                >
                  {HAKJEOM_COURSE_OPTIONS.map((o) => (
                    <button
                      key={o}
                      type="button"
                      onClick={() =>
                        setForm((p) => ({
                          ...p,
                          hope_course: p.hope_course.includes(o)
                            ? p.hope_course.filter((v) => v !== o)
                            : [...p.hope_course, o],
                        }))
                      }
                      className={
                        form.hope_course.includes(o)
                          ? styles.tagBtnV2Active
                          : styles.tagBtnV2
                      }
                    >
                      {form.hope_course.includes(o) ? `✓ ${o}` : o}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: 취득사유 + 최종학력 ── */}
          {step === 2 && (
            <div className={styles.funnelStep}>
              <p className={styles.funnelQuestion}>
                취득 목적과 학력을 선택해주세요
              </p>
              <div className={styles.funnelFieldGroup}>
                <label className={styles.funnelLabel}>
                  취득사유{" "}
                  <span className={styles.funnelOptional}>
                    (복수 선택 가능)
                  </span>
                </label>
                <div className={styles.funnelTagRow}>
                  {REASON_OPTIONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() =>
                        setForm((p) => ({
                          ...p,
                          reason: toggleArr(p.reason, r),
                        }))
                      }
                      className={
                        form.reason.includes(r)
                          ? styles.tagBtnV2Active
                          : styles.tagBtnV2
                      }
                    >
                      {form.reason.includes(r) ? `✓ ${r}` : r}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.funnelFieldGroup}>
                <label className={styles.funnelLabel}>
                  최종학력 <span className={styles.funnelOptional}>(선택)</span>
                </label>
                <div
                  className={styles.funnelTagRow}
                  style={{ flexWrap: "wrap" }}
                >
                  {EDUCATION_OPTIONS.map((edu) => (
                    <button
                      key={edu}
                      type="button"
                      onClick={() =>
                        setForm((p) => ({
                          ...p,
                          education: p.education === edu ? "" : edu,
                        }))
                      }
                      className={
                        form.education === edu
                          ? styles.tagBtnV2Active
                          : styles.tagBtnV2
                      }
                    >
                      {edu}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.funnelFieldGroup}>
                <label className={styles.funnelLabel}>
                  취소사유{" "}
                  <span className={styles.funnelOptional}>
                    (복수 선택 가능)
                  </span>
                </label>
                <div
                  className={styles.funnelTagRow}
                  style={{ flexWrap: "wrap" }}
                >
                  {COUNSEL_CHECK_OPTIONS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() =>
                        setForm((p) => ({
                          ...p,
                          counsel_check: toggleArr(p.counsel_check, c),
                        }))
                      }
                      className={
                        form.counsel_check.includes(c)
                          ? styles.tagBtnV2Active
                          : styles.tagBtnV2
                      }
                    >
                      {form.counsel_check.includes(c) ? `✓ ${c}` : c}
                    </button>
                  ))}
                </div>
                {form.counsel_check.includes("기타") && (
                  <input
                    value={form.counsel_check_etc}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        counsel_check_etc: e.target.value,
                      }))
                    }
                    placeholder="기타 내용 입력"
                    className={styles.funnelInput}
                    style={{ marginTop: 8 }}
                  />
                )}
              </div>
            </div>
          )}

          {/* ── Step 3: 내부 정보 ── */}
          {step === 3 && (
            <div className={styles.funnelStep}>
              <p className={styles.funnelQuestion}>내부 정보를 입력해주세요</p>
              <p className={styles.funnelSubQuestion}>모두 선택사항이에요</p>
              <div className={styles.funnelFieldGroup}>
                <label className={styles.funnelLabel}>담당자</label>
                {fixedManager ? (
                  <input
                    value={fixedManager}
                    readOnly
                    className={styles.funnelInput}
                  />
                ) : (
                <>
                {uniqueManagers.length > 0 && (
                  <div
                    className={styles.funnelTagRow}
                    style={{ marginBottom: showManagerInput ? 8 : 0 }}
                  >
                    {uniqueManagers.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          setForm((p) => ({
                            ...p,
                            manager: p.manager === m ? "" : m,
                          }));
                          setShowManagerInput(false);
                        }}
                        className={
                          form.manager === m
                            ? styles.tagBtnV2Active
                            : styles.tagBtnV2
                        }
                      >
                        {m}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setShowManagerInput((v) => !v);
                        setForm((p) => ({ ...p, manager: "" }));
                      }}
                      className={
                        showManagerInput
                          ? styles.tagBtnV2Active
                          : styles.tagBtnV2
                      }
                    >
                      직접 입력
                    </button>
                  </div>
                )}
                {(uniqueManagers.length === 0 || showManagerInput) && (
                  <input
                    value={form.manager}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, manager: e.target.value }))
                    }
                    placeholder="담당자 이름"
                    className={styles.funnelInput}
                    autoFocus={showManagerInput}
                  />
                )}
                </>
                )}
              </div>
              <div className={styles.funnelFieldGroup}>
                <label className={styles.funnelLabel}>
                  유입경로 <span className={styles.funnelOptional}>(선택)</span>
                </label>
                <div
                  className={styles.funnelTagRow}
                  style={{ flexWrap: "wrap" }}
                >
                  {SOURCE_MAJORS.map((m) => {
                    const label = SOURCE_MAJOR_LABEL[m] ?? m;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() =>
                          setForm((p) => ({
                            ...p,
                            sourceMajor: p.sourceMajor === m ? "" : m,
                            sourceMinor: "",
                          }))
                        }
                        className={
                          form.sourceMajor === m
                            ? styles.tagBtnV2Active
                            : styles.tagBtnV2
                        }
                      >
                        {form.sourceMajor === m ? `✓ ${label}` : label}
                      </button>
                    );
                  })}
                </div>
                {form.sourceMajor === "맘카페" && (
                  <div
                    className={styles.clickSourceSubPanel}
                    style={{ marginTop: 8 }}
                  >
                    {CAFE_NAME_LIST.map((cafeName) => (
                      <button
                        key={cafeName}
                        type="button"
                        onClick={() =>
                          setForm((p) => ({
                            ...p,
                            sourceMinor:
                              p.sourceMinor === cafeName ? "" : cafeName,
                          }))
                        }
                        className={
                          form.sourceMinor === cafeName
                            ? styles.tagBtnSmActive
                            : styles.tagBtnSm
                        }
                      >
                        {cafeName}
                      </button>
                    ))}
                    {customCafes.map((cafeName) => (
                      <span key={cafeName} className={styles.customItemWrap}>
                        <button
                          type="button"
                          onClick={() =>
                            setForm((p) => ({
                              ...p,
                              sourceMinor:
                                p.sourceMinor === cafeName ? "" : cafeName,
                            }))
                          }
                          className={
                            form.sourceMinor === cafeName
                              ? styles.tagBtnSmActive
                              : styles.tagBtnSm
                          }
                        >
                          {cafeName}
                        </button>
                        <button
                          type="button"
                          className={styles.customItemDeleteBtn}
                          onClick={() => handleModalDeleteCafe(cafeName)}
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                    {modalShowCafeAdd ? (
                      <>
                        <input
                          className={styles.subPanelAddInput}
                          value={modalCafeAddInput}
                          onChange={(e) => setModalCafeAddInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleModalAddCafe();
                            if (e.key === "Escape") setModalShowCafeAdd(false);
                          }}
                          placeholder="카페 이름"
                          autoFocus
                        />
                        <button
                          type="button"
                          className={styles.subPanelAddConfirm}
                          onClick={handleModalAddCafe}
                        >
                          추가
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className={styles.subPanelAddBtn}
                        onClick={() => setModalShowCafeAdd(true)}
                      >
                        + 카페
                      </button>
                    )}
                  </div>
                )}
                {form.sourceMajor === "당근" && (
                  <div
                    className={styles.clickSourceSubPanel}
                    style={{ marginTop: 8 }}
                  >
                    {DANGGEUN_DEFAULT_OPTIONS.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() =>
                          setForm((p) => ({
                            ...p,
                            sourceMinor:
                              p.sourceMinor === opt ? "" : opt,
                          }))
                        }
                        className={
                          form.sourceMinor === opt
                            ? styles.tagBtnSmActive
                            : styles.tagBtnSm
                        }
                      >
                        {opt}
                      </button>
                    ))}
                    {customDanggeun.map((area) => (
                      <span key={area} className={styles.customItemWrap}>
                        <button
                          type="button"
                          onClick={() =>
                            setForm((p) => ({
                              ...p,
                              sourceMinor:
                                p.sourceMinor === area ? "" : area,
                            }))
                          }
                          className={
                            form.sourceMinor === area
                              ? styles.tagBtnSmActive
                              : styles.tagBtnSm
                          }
                        >
                          {area}
                        </button>
                        <button
                          type="button"
                          className={styles.customItemDeleteBtn}
                          onClick={() => handleModalDeleteDanggeun(area)}
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                    {modalShowDanggeunAdd ? (
                      <>
                        <input
                          className={styles.subPanelAddInput}
                          value={modalDanggeunAddInput}
                          onChange={(e) =>
                            setModalDanggeunAddInput(e.target.value)
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleModalAddDanggeun();
                            if (e.key === "Escape")
                              setModalShowDanggeunAdd(false);
                          }}
                          placeholder="소재명"
                          autoFocus
                        />
                        <button
                          type="button"
                          className={styles.subPanelAddConfirm}
                          onClick={handleModalAddDanggeun}
                        >
                          추가
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className={styles.subPanelAddBtn}
                        onClick={() => setModalShowDanggeunAdd(true)}
                      >
                        + 직접 추가
                      </button>
                    )}
                  </div>
                )}
                {form.sourceMajor === "기타" && (
                  <div
                    className={styles.clickSourceSubPanel}
                    style={{ marginTop: 8 }}
                  >
                    <input
                      type="text"
                      className={styles.subPanelAddInput}
                      style={{ flex: 1 }}
                      value={form.sourceMinor}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          sourceMinor: e.target.value,
                        }))
                      }
                      placeholder="유입 경로를 입력하세요"
                    />
                  </div>
                )}
                {form.sourceMajor && (
                  <p className={styles.clickSourcePreview}>
                    {(() => {
                      const raw = formatClickSourceDisplay(
                        form.sourceMajor +
                          (form.sourceMinor ? `_${form.sourceMinor}` : ""),
                      );
                      // 내부 value "지인소개" → UI 라벨 "개인마케팅" 으로 치환
                      const label = SOURCE_MAJOR_LABEL[form.sourceMajor];
                      return label ? raw.replace(form.sourceMajor, label) : raw;
                    })()}
                  </p>
                )}
              </div>
              <div className={styles.funnelFieldGroup}>
                <label className={styles.funnelLabel}>과목비용</label>
                <input
                  value={form.subject_cost}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, subject_cost: e.target.value }))
                  }
                  placeholder="예) 150000"
                  inputMode="numeric"
                  className={styles.funnelInput}
                />
              </div>
              <div className={styles.funnelFieldGroup}>
                <label className={styles.funnelLabel}>메모</label>
                <textarea
                  value={form.memo}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, memo: e.target.value }))
                  }
                  rows={3}
                  placeholder="메모 입력"
                  className={styles.textarea}
                />
              </div>
            </div>
          )}
        </div>

        {/* 하단 버튼 */}
        <div className={styles.funnelFooter}>
          {step < TOTAL_STEPS ? (
            <button
              type="button"
              onClick={handleNext}
              className={`${styles.btnPrimary} ${styles.funnelNextBtn}`}
            >
              다음
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className={`${styles.btnPrimary} ${styles.funnelNextBtn}`}
            >
              {saving ? "저장 중..." : "등록 완료"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 모달: 신규 추가 (기관협약) ──────────────────────────────────────────────

interface AgencyAddModalProps {
  editTarget?: Agency | null;
  onClose: () => void;
  onSaved: () => void;
  uniqueManagers: string[];
}

function AgencyAddModal({
  editTarget,
  onClose,
  onSaved,
  uniqueManagers,
}: AgencyAddModalProps) {
  const [form, setForm] = useState({
    category: editTarget?.category ?? "",
    address: editTarget?.address ?? "",
    institution_name: editTarget?.institution_name ?? "",
    contact: editTarget?.contact ?? "",
    credit_commission: editTarget?.credit_commission ?? "",
    private_commission: editTarget?.private_commission ?? "",
    manager: editTarget?.manager ?? "",
    memo: editTarget?.memo ?? "",
    status: editTarget?.status ?? ("협약대기" as AgencyStatus),
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.institution_name.trim()) {
      alert("기관이름을 입력해주세요.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        institution_name: form.institution_name.trim(),
      };
      const res = await fetch("/api/hakjeom/agency", {
        method: editTarget ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editTarget ? { id: editTarget.id, ...payload } : payload,
        ),
      });
      if (!res.ok) throw new Error("저장 실패");
      onSaved();
      onClose();
    } catch {
      alert("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={styles.modalOverlay}
    >
      <div className={styles.modalBox}>
        <h2 className={styles.modalTitle}>
          {editTarget ? "기관 수정" : "기관 추가"}
        </h2>
        <form onSubmit={handleSubmit}>
          {(
            [
              {
                label: "분류",
                key: "category",
                placeholder: "예) 복지관, 학교, 센터",
              },
              { label: "지역", key: "address", placeholder: "예) 서울 강남구" },
              {
                label: "기관이름 *",
                key: "institution_name",
                placeholder: "기관이름 입력",
              },
              {
                label: "연락처",
                key: "contact",
                placeholder: "예) 02-1234-5678",
              },
              {
                label: "학점커미션",
                key: "credit_commission",
                placeholder: "예) 10%, 5만원",
              },
              {
                label: "민간커미션",
                key: "private_commission",
                placeholder: "예) 15%, 3만원",
              },
            ] as {
              label: string;
              key: keyof typeof form;
              placeholder: string;
            }[]
          ).map(({ label, key, placeholder }) => (
            <div key={key} className={styles.modalFieldGroup}>
              <label className={styles.modalLabel}>{label}</label>
              <input
                value={String(form[key])}
                onChange={(e) => {
                  const val =
                    key === "contact"
                      ? formatPhoneNumber(e.target.value)
                      : e.target.value;
                  setForm((p) => ({ ...p, [key]: val }));
                }}
                placeholder={placeholder}
                className={`${styles.input} ${styles.inputFull}`}
              />
            </div>
          ))}
          <div className={styles.modalFieldGroup}>
            <label className={styles.modalLabel}>담당자</label>
            {uniqueManagers.length > 0 && (
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  flexWrap: "wrap",
                  marginBottom: 8,
                }}
              >
                {uniqueManagers.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() =>
                      setForm((p) => ({
                        ...p,
                        manager: p.manager === m ? "" : m,
                      }))
                    }
                    className={
                      form.manager === m
                        ? styles.tagBtnV2Active
                        : styles.tagBtnV2
                    }
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
            <input
              value={form.manager}
              onChange={(e) =>
                setForm((p) => ({ ...p, manager: e.target.value }))
              }
              placeholder="직접 입력"
              className={`${styles.input} ${styles.inputFull}`}
            />
          </div>
          <div className={styles.modalFieldGroup}>
            <label className={styles.modalLabel}>메모</label>
            <textarea
              value={form.memo}
              onChange={(e) => setForm((p) => ({ ...p, memo: e.target.value }))}
              rows={3}
              placeholder="메모 입력"
              className={styles.textarea}
            />
          </div>
          <div className={styles.modalFieldGroupLast}>
            <label className={styles.modalLabel}>상태</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {AGENCY_STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, status: s }))}
                  className={
                    form.status === s ? styles.tagBtnV2Active : styles.tagBtnV2
                  }
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.modalBtnRow}>
            <button
              type="submit"
              disabled={saving}
              className={`${styles.btnPrimary} ${styles.modalBtnFlex}`}
            >
              {saving ? "저장 중..." : "저장"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className={`${styles.btnSecondary} ${styles.modalBtnFlex}`}
            >
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── 탭: 학점은행제 ──────────────────────────────────────────────────────────

function HakjeomTab({
  isActive,
  highlightId,
  openId,
}: {
  isActive: boolean;
  highlightId?: number;
  openId?: number;
}) {
  const [items, setItems] = useState<HakjeomConsultation[]>([]);
  const [serverTotal, setServerTotal] = useState(0);
  // 필터 옵션용 facets (전체 기준 담당자/유입경로) — 서버 페이지 모드에서 옵션 완전성 유지
  const [facetManagers, setFacetManagers] = useState<string[]>([]);
  const [facetSources, setFacetSources] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOwnScope, setIsOwnScope] = useState(false);
  // 가이드 활성 시에만 데모 학생 10명 임시 표시
  const [guideDemoActive, setGuideDemoActive] = useState(false);
  const { startCurrent: startGuide } = useGuide();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        const perm = (data.permissions ?? []).find(
          (p: { section: string; scope: string }) => p.section === "hakjeom",
        );
        setIsOwnScope(perm?.scope === "own");
      })
      .catch(() => {});
  }, []);

  // 필터 상태
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<ConsultationStatus[]>([]);
  const [managerFilter, setManagerFilter] = useState<string[]>([]);
  const [majorCategoryFilter, setMajorCategoryFilter] = useState<string[]>([]);
  const [minorCategoryFilter, setMinorCategoryFilter] = useState<string[]>([]);
  const [reasonFilter, setReasonFilter] = useState<string[]>([]);
  const [counselCheckFilter, setCounselCheckFilter] = useState<string[]>([]);
  const [hopeCourseFilter, setHopeCourseFilter] = useState<string[]>([]);
  // 기본값: 전체 기간 (필터 없음)
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

  // yyyy-mm-dd ↔ Date 변환
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

  // UI 상태
  const [selectedItem, setSelectedItem] = useState<HakjeomConsultation | null>(
    null,
  );

  // ref로 가이드 활성 여부 추적 — fetchData 비동기 결과에서도 사용
  const guideDemoActiveRef = useRef(false);
  useEffect(() => {
    guideDemoActiveRef.current = guideDemoActive;
  }, [guideDemoActive]);

  // 가이드 데모 목록 이벤트 — 가이드 활성 시에만 데모 학생 추가
  useEffect(() => {
    const on = () => setGuideDemoActive(true);
    const off = () => setGuideDemoActive(false);
    window.addEventListener("guide-demo-list-on", on);
    window.addEventListener("guide-demo-list-off", off);
    return () => {
      window.removeEventListener("guide-demo-list-on", on);
      window.removeEventListener("guide-demo-list-off", off);
    };
  }, []);

  // demo on/off 시 items에 추가/제거
  useEffect(() => {
    if (guideDemoActive) {
      setItems((prev) => {
        if (prev.some((i) => i.id < 0)) return prev;
        const demos = HAKJEOM_DEMO_LIST as unknown as HakjeomConsultation[];
        return [...demos, ...prev];
      });
    } else {
      setItems((prev) => prev.filter((i) => i.id > 0));
    }
  }, [guideDemoActive]);

  // 가이드 데모 모달 — window 이벤트로 가짜 학생 주입/제거
  useEffect(() => {
    const onOpen = () => {
      const demo: HakjeomConsultation = {
        id: -999999,
        name: "홍길동 (가이드 예시)",
        contact: "010-0000-0000",
        education: null,
        reason: "취미",
        click_source: "가이드",
        status: "상담대기",
        memo: "이 학생은 가이드 예시 데이터입니다. 실제 저장되지 않아요.",
        subject_cost: null,
        manager: null,
        residence: null,
        hope_course: null,
        counsel_completed_at: null,
        counsel_check: null,
        current_situation: null,
        reaction_point: null,
        contact_scheduled_at: null,
        created_at: new Date().toISOString(),
        updated_at: null,
      };
      setSelectedItem(demo);
    };
    const onClose = () => {
      setSelectedItem((prev) => (prev && prev.id === -999999 ? null : prev));
    };
    window.addEventListener("guide-demo-open", onOpen);
    window.addEventListener("guide-demo-close", onClose);
    return () => {
      window.removeEventListener("guide-demo-open", onOpen);
      window.removeEventListener("guide-demo-close", onClose);
    };
  }, []);
  const [openTab, setOpenTab] = useState<"basic" | "info">("basic");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [deleteToastVisible, setDeleteToastVisible] = useState(false);
  const [openFilterColumn, setOpenFilterColumn] = useState<string | null>(null);
  const [filterDropdownPos, setFilterDropdownPos] = useState({
    top: 0,
    left: 0,
  });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [inlineContact, setInlineContact] = useState<{
    id: number;
    value: string;
  } | null>(null);
  const [showBulkMenu, setShowBulkMenu] = useState(false);
  const [showManagerAssign, setShowManagerAssign] = useState(false);
  const [showSourceAssign, setShowSourceAssign] = useState(false);
  const [showBulkStatusAssign, setShowBulkStatusAssign] = useState(false);
  const [assigningStatus, setAssigningStatus] = useState(false);
  const bulkMenuRef = useRef<HTMLDivElement>(null);
  const [bulkSourceMajor, setBulkSourceMajor] = useState("");
  const [bulkSourceMinor, setBulkSourceMinor] = useState("");
  // 일괄변경 패널에서 인라인 소재 추가용 (당근/맘카페 공용)
  const [bulkAddInputVisible, setBulkAddInputVisible] = useState(false);
  const [bulkAddInputValue, setBulkAddInputValue] = useState("");
  const [assigningSource, setAssigningSource] = useState(false);
  const sourceAssignRef = useRef<HTMLDivElement>(null);
  const [customCafes, setCustomCafes] = useState<string[]>([]);
  const [customDanggeun, setCustomDanggeun] = useState<string[]>([]);

  // 필터 옵션용 facets 로드 (1회) — 담당자/유입경로 전체 목록 (서버 페이지 모드 옵션 완전성)
  useEffect(() => {
    fetch("/api/hakjeom?facets=1")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setFacetManagers(Array.isArray(d.managers) ? d.managers : []);
        setFacetSources(Array.isArray(d.sources) ? d.sources : []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/hakjeom/custom-sources")
      .then((r) => r.json())
      .then((data) => {
        const allCafes: string[] = Array.isArray(data.cafes) ? data.cafes : [];
        const allDanggeun: string[] = Array.isArray(data.danggeun)
          ? data.danggeun
          : [];
        setCustomCafes([
          ...new Set(allCafes.filter((n) => !CAFE_NAME_LIST.includes(n))),
        ]);
        setCustomDanggeun([...new Set(allDanggeun)]);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setSelectedIds([]);
  }, [currentPage]);
  const [assigningManager, setAssigningManager] = useState(false);
  const [managerAssignInput, setManagerAssignInput] = useState("");
  const managerAssignRef = useRef<HTMLDivElement>(null);
  const itemsPerPage = 10;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        bulkMenuRef.current &&
        !bulkMenuRef.current.contains(e.target as Node)
      ) {
        setShowBulkMenu(false);
        setShowManagerAssign(false);
        setShowSourceAssign(false);
        setShowBulkStatusAssign(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // 검색에서 직접 이동 시 해당 행 하이라이트
  useEffect(() => {
    if (!highlightId || items.length === 0) return;
    const idx = items.findIndex((item) => item.id === highlightId);
    if (idx < 0) return;
    setCurrentPage(Math.ceil((idx + 1) / itemsPerPage));
    setTimeout(() => {
      const el = document.querySelector(
        `tr[data-id="${highlightId}"]`,
      ) as HTMLElement | null;
      if (!el) return;
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      el.classList.add(styles.highlightRow);
      setTimeout(() => el.classList.remove(styles.highlightRow), 2500);
    }, 150);
  }, [items, highlightId]);

  // 다른 화면(업무센터 상담목록)에서 ?open=ID 로 진입 시 상세 모달 자동 열기
  useEffect(() => {
    if (!openId || items.length === 0) return;
    const item = items.find((i) => i.id === openId);
    if (item) setSelectedItem(item);
  }, [items, openId]);

  // 필터/검색이 하나도 없고 특정 항목 딥링크도 아니면 → 서버 페이지 모드(가벼움)
  // 필터가 켜지거나 딥링크면 → 전체 로드(기존 동작, 정확성 보장)
  const hasFilter = Boolean(
    searchText ||
      statusFilter.length > 0 ||
      managerFilter.length > 0 ||
      majorCategoryFilter.length > 0 ||
      minorCategoryFilter.length > 0 ||
      reasonFilter.length > 0 ||
      counselCheckFilter.length > 0 ||
      hopeCourseFilter.length > 0 ||
      startDate ||
      endDate,
  );
  const serverMode = !hasFilter && !openId;

  // 서버 페이지 모드: 현재 페이지 50개만 로드
  const fetchPage = useCallback(
    async (page: number, background = false) => {
      if (!background) setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/hakjeom?page=${page}&pageSize=${itemsPerPage}`,
        );
        if (!res.ok) throw new Error("데이터를 불러오지 못했습니다.");
        const data = await res.json();
        const rows: HakjeomConsultation[] = Array.isArray(data.rows)
          ? data.rows
          : [];
        setServerTotal(typeof data.total === "number" ? data.total : 0);
        if (guideDemoActiveRef.current && page === 1) {
          const demos = HAKJEOM_DEMO_LIST as unknown as HakjeomConsultation[];
          setItems([...demos, ...rows]);
        } else {
          setItems(rows);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "알 수 없는 오류");
      } finally {
        if (!background) setLoading(false);
      }
    },
    [],
  );

  // 전체 로드 (필터/검색/딥링크 시) — 기존 동작
  const fetchAll = useCallback(async (background = false) => {
    if (!background) setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/hakjeom");
      if (!res.ok) throw new Error("데이터를 불러오지 못했습니다.");
      const data: HakjeomConsultation[] = await res.json();
      if (guideDemoActiveRef.current) {
        const demos = HAKJEOM_DEMO_LIST as unknown as HakjeomConsultation[];
        setItems([...demos, ...data]);
      } else {
        setItems(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류");
    } finally {
      if (!background) setLoading(false);
    }
  }, []);

  // 변경 후 새로고침 — 현재 모드(서버페이지/전체)에 맞게 다시 로드
  const fetchData = useCallback(
    (background = false) =>
      serverMode
        ? fetchPage(currentPage, background === true)
        : fetchAll(background === true),
    [serverMode, currentPage, fetchPage, fetchAll],
  );

  // 첫 로드만 스켈레톤, 이후(검색/필터/페이지 이동)는 백그라운드(스켈레톤 없음)
  const firstLoadDone = useRef(false);

  // 서버 페이지 모드: 모드/페이지 변경 시 해당 페이지 로드
  useEffect(() => {
    if (!serverMode) return;
    void fetchPage(currentPage, firstLoadDone.current).then(() => {
      firstLoadDone.current = true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverMode, currentPage]);
  // 필터/딥링크 모드: 진입 시 전체 1회 로드 (필터 변경은 클라이언트가 처리)
  useEffect(() => {
    if (serverMode) return;
    void fetchAll(firstLoadDone.current).then(() => {
      firstLoadDone.current = true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverMode]);
  // 탭 재진입 시 백그라운드 새로고침
  useEffect(() => {
    if (!isActive) return;
    if (serverMode) fetchPage(currentPage, true);
    else fetchAll(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);
  useEffect(() => {
    if (!openFilterColumn) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpenFilterColumn(null);
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [openFilterColumn]);

  const handleUpdate = async (
    id: number,
    fields: Partial<HakjeomConsultation>,
  ) => {
    // 가이드 데모 학생 — 실제 DB 호출 없이 selectedItem만 갱신 (저장 시뮬레이션)
    if (id === -999999) {
      setSelectedItem((prev) => (prev ? { ...prev, ...fields } : prev));
      setToastVisible(true);
      setTimeout(() => setToastVisible(false), 2500);
      return;
    }
    const res = await fetch("/api/hakjeom", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...fields }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "업데이트에 실패했습니다.");
    }
    const { data: updated } = await res.json();
    const merged = updated ?? fields;
    setItems((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...merged } : c)),
    );
    setSelectedItem((prev) =>
      prev?.id === id ? { ...prev, ...merged } : prev,
    );
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  };

  const handleStatusChange = async (id: number, status: ConsultationStatus) => {
    // '등록완료'로 바꿀 때 필수 검증
    if (status === "등록완료") {
      const target =
        items.find((c) => c.id === id) ??
        (selectedItem?.id === id ? selectedItem : null);
      const cost = target?.subject_cost;
      if (!cost || Number(cost) <= 0) {
        alert(
          "과목당 비용이 입력되어야 '등록완료'로 변경할 수 있습니다.\n상세창에서 과목당 비용을 먼저 저장해주세요.",
        );
        return;
      }
      if (!target?.education || !String(target.education).trim()) {
        alert(
          "'등록완료'로 변경하려면 최종학력을 먼저 입력해주세요.\n상세창에서 학력을 선택 후 저장해주세요.",
        );
        return;
      }
      if (!target?.hope_course || !String(target.hope_course).trim()) {
        alert(
          "'등록완료'로 변경하려면 희망과정을 먼저 선택해주세요.\n상세창에서 희망과정을 선택 후 저장해주세요.",
        );
        return;
      }
    }
    await handleUpdate(id, { status });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const reason = window
      .prompt(
        `${selectedIds.length}건을 삭제합니다.\n삭제 사유를 입력해주세요.`,
        "",
      )
      ?.trim();
    if (!reason) {
      if (reason === "") alert("삭제 사유를 입력해야 삭제할 수 있습니다.");
      return;
    }
    setDeleting(true);
    const res = await fetch("/api/hakjeom", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selectedIds, reason }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? "삭제에 실패했습니다.");
      setDeleting(false);
      return;
    }
    setSelectedIds([]);
    await fetchData();
    setDeleting(false);
    setDeleteToastVisible(true);
    setTimeout(() => setDeleteToastVisible(false), 2500);
  };

  const handleBulkAssignManager = async (manager: string) => {
    if (selectedIds.length === 0) return;
    setAssigningManager(true);
    setShowManagerAssign(false);
    const res = await fetch("/api/hakjeom", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selectedIds, manager }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "담당자 배정에 실패했습니다.");
      setAssigningManager(false);
      return;
    }
    setSelectedIds([]);
    setManagerAssignInput("");
    await fetchData();
    setAssigningManager(false);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  };

  const handleInlineContactSave = async () => {
    if (!inlineContact) return;
    const { id, value } = inlineContact;
    const orig = items.find((i) => i.id === id);
    if (!orig || orig.contact === value) {
      setInlineContact(null);
      return;
    }
    setInlineContact(null);
    await fetch("/api/hakjeom", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, contact: value }),
    });
    await fetchData(true);
  };

  const handleBulkAssignSource = async () => {
    if (selectedIds.length === 0 || !bulkSourceMajor) return;
    const click_source = bulkSourceMinor
      ? `${bulkSourceMajor}_${bulkSourceMinor}`
      : bulkSourceMajor;
    setAssigningSource(true);
    setShowSourceAssign(false);
    await fetch("/api/hakjeom", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selectedIds, click_source }),
    });
    setSelectedIds([]);
    setBulkSourceMajor("");
    setBulkSourceMinor("");
    await fetchData();
    setAssigningSource(false);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  };

  const handleBulkAssignStatus = async (status: string) => {
    if (selectedIds.length === 0) return;
    setAssigningStatus(true);
    setShowBulkStatusAssign(false);
    await fetch("/api/hakjeom", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selectedIds, status }),
    });
    setSelectedIds([]);
    await fetchData();
    setAssigningStatus(false);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  };

  const handleAddCafe = useCallback(async (name: string) => {
    await fetch("/api/hakjeom/custom-sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "mamcafe", name }),
    });
    setCustomCafes((prev) => [...prev, name]);
  }, []);

  const handleDeleteCafe = useCallback(
    async (name: string) => {
      await fetch("/api/hakjeom/custom-sources", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "mamcafe", name }),
      });
      setCustomCafes((prev) => prev.filter((c) => c !== name));
      if (bulkSourceMinor === name) setBulkSourceMinor("");
    },
    [bulkSourceMinor],
  );

  const handleAddDanggeun = useCallback(async (name: string) => {
    await fetch("/api/hakjeom/custom-sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "danggeun", name }),
    });
    setCustomDanggeun((prev) => [...prev, name]);
  }, []);

  const handleDeleteDanggeun = useCallback(
    async (name: string) => {
      await fetch("/api/hakjeom/custom-sources", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "danggeun", name }),
      });
      setCustomDanggeun((prev) => prev.filter((c) => c !== name));
      if (bulkSourceMinor === name) setBulkSourceMinor("");
    },
    [bulkSourceMinor],
  );

  const parseSource = useCallback(
    (src: string | null) => parseClickSource(src, customCafes),
    [customCafes],
  );

  // 필터링
  // 필터 옵션 출처 — 서버 페이지 모드면 facets(전체 기준), 아니면 로드된 items 기준
  const sourceList: string[] = serverMode
    ? facetSources
    : (items.map((c) => c.click_source).filter(Boolean) as string[]);
  const uniqueManagers = (
    serverMode
      ? facetManagers
      : Array.from(new Set(items.map((c) => c.manager).filter(Boolean)))
  ) as string[];
  // 희망과정 필터 옵션 — 지정 목록만 노출 (데이터 기반 직접입력값 제외)
  const uniqueHopeCourses = HOPE_COURSE_FILTER_OPTIONS;
  const uniqueMajorCategories = Array.from(
    new Set(sourceList.map((s) => parseSource(s).major).filter(Boolean)),
  ).sort();
  const needsCheckCount = serverMode
    ? sourceList.filter((s) => parseSource(s).needsCheck).length
    : items.filter((c) => parseSource(c.click_source).needsCheck).length;
  const uniqueMinorCategories = Array.from(
    new Set(
      sourceList
        .filter(
          (s) =>
            majorCategoryFilter.length === 0 ||
            majorCategoryFilter.includes(parseSource(s).major),
        )
        .map((s) => parseSource(s))
        .filter((p) => Boolean(p.minor) && !p.needsCheck)
        .map((p) => p.minor),
    ),
  ).sort();

  const filtered = items.filter((c) => {
    if (searchText) {
      const q = searchText.toLowerCase();
      const contactClean = c.contact.replace(/-/g, "");
      const searchClean = searchText.replace(/-/g, "");
      if (
        !(
          c.name.toLowerCase().includes(q) ||
          contactClean.includes(searchClean) ||
          (c.reason || "").toLowerCase().includes(q) ||
          (c.memo || "").toLowerCase().includes(q) ||
          (c.click_source || "").toLowerCase().includes(q)
        )
      )
        return false;
    }
    if (statusFilter.length > 0 && !statusFilter.includes(c.status))
      return false;
    if (managerFilter.length > 0) {
      const hasNone = managerFilter.includes("none");
      const others = managerFilter.filter((x) => x !== "none");
      const matches =
        (hasNone && !c.manager) || others.some((m) => c.manager === m);
      if (!matches) return false;
    }
    if (
      majorCategoryFilter.length > 0 &&
      !majorCategoryFilter.includes(parseSource(c.click_source).major)
    )
      return false;
    if (minorCategoryFilter.length > 0) {
      const parsed = parseSource(c.click_source);
      const matches = minorCategoryFilter.some((f) =>
        f === "__needs_check__" ? parsed.needsCheck : parsed.minor === f,
      );
      if (!matches) return false;
    }
    if (reasonFilter.length > 0) {
      const reasons = (c.reason || "").split(", ").map((r) => r.trim());
      if (!reasonFilter.some((f) => reasons.includes(f))) return false;
    }
    if (counselCheckFilter.length > 0) {
      const checks = (c.counsel_check || "").split(", ").map((ch) => ch.trim());
      const matches = counselCheckFilter.some((f) =>
        f === "기타"
          ? checks.some((ch) => ch.startsWith("기타"))
          : checks.includes(f),
      );
      if (!matches) return false;
    }
    if (hopeCourseFilter.length > 0) {
      const courses = (c.hope_course || "")
        .split(", ")
        .map((h) => h.trim())
        .filter(Boolean);
      const matches = hopeCourseFilter.some((f) =>
        f === "none" ? courses.length === 0 : courses.includes(f),
      );
      if (!matches) return false;
    }
    if (startDate || endDate) {
      const d = new Date(c.created_at);
      if (startDate && d < new Date(startDate + "T00:00:00")) return false;
      if (endDate && d > new Date(endDate + "T23:59:59")) return false;
    }
    return true;
  });

  const sortedFiltered = filtered;

  // 서버 페이지 모드면 items 자체가 이미 현재 페이지(서버가 잘라줌) → 총개수는 serverTotal 사용
  const totalCount = serverMode ? serverTotal : sortedFiltered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));
  const paginated = serverMode
    ? sortedFiltered
    : sortedFiltered.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage,
      );

  const toggleSelect = (id: number) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  const toggleSelectAll = () =>
    setSelectedIds((prev) =>
      prev.length === paginated.length ? [] : paginated.map((c) => c.id),
    );

  const isFiltered =
    searchText ||
    statusFilter.length > 0 ||
    managerFilter.length > 0 ||
    majorCategoryFilter.length > 0 ||
    minorCategoryFilter.length > 0 ||
    reasonFilter.length > 0 ||
    counselCheckFilter.length > 0 ||
    hopeCourseFilter.length > 0 ||
    startDate ||
    endDate;

  const HAKJEOM_HEADERS = [
    "번호",
    "대분류",
    "중분류",
    "이름",
    "연락처",
    "학력",
    "희망과정",
    "거주지",
    "현재상황",
    "취득사유",
    "반응포인트",
    "담당자",
    "취소사유",
    "상태",
    "과목비용",
    "메모",
    "등록일",
  ];
  const hakjeomToRow = (item: HakjeomConsultation, index: number) => [
    index + 1,
    parseSource(item.click_source).major || "",
    parseSource(item.click_source).minor || "",
    item.name,
    item.contact,
    item.education ?? "",
    item.hope_course ?? "",
    item.residence ?? "",
    item.current_situation ?? "",
    item.reason ?? "",
    item.reaction_point ?? "",
    item.manager ?? "",
    item.counsel_check ?? "",
    item.status,
    item.subject_cost ?? "",
    item.latest_memo ?? "",
    item.created_at ? new Date(item.created_at).toLocaleString("ko-KR") : "",
  ];

  const handleDownloadSelected = () => {
    const targets = filtered.filter((c) => selectedIds.includes(c.id));
    downloadExcel(
      `학점은행제_선택_${new Date().toLocaleDateString("ko-KR").replace(/\. /g, "-").replace(".", "")}.xlsx`,
      [
        {
          name: "학점은행제",
          headers: HAKJEOM_HEADERS,
          rows: targets.map((item, i) => hakjeomToRow(item, i)),
        },
      ],
    );
  };

  const handleDownloadAll = async () => {
    const filename = `학점은행제_전체_${new Date().toLocaleDateString("ko-KR").replace(/\. /g, "-").replace(".", "")}.xlsx`;
    // 서버 페이지 모드면 화면엔 현재 페이지만 있으므로, 내보내기용 전체를 따로 받아온다
    let exportItems = filtered;
    if (serverMode) {
      try {
        const allRes = await fetch("/api/hakjeom");
        if (allRes.ok) {
          const all = await allRes.json();
          if (Array.isArray(all)) exportItems = all;
        }
      } catch {
        /* 실패 시 현재 페이지라도 내보냄 */
      }
    }
    try {
      const memoRes = await fetch("/api/memo-logs?table=hakjeom_consultations");
      const allMemos: {
        record_id: string;
        author_name?: string;
        content: string;
        created_at: string;
      }[] = memoRes.ok ? await memoRes.json() : [];
      // record_id별로 메모 합치기 (최신순, 작성일+내용)
      const memoMap: Record<string, string> = {};
      for (const m of allMemos) {
        const date = m.created_at
          ? new Date(m.created_at).toLocaleString("ko-KR")
          : "";
        const line = `[${date}] ${m.author_name ?? ""}: ${m.content}`;
        const key = String(m.record_id);
        memoMap[key] = memoMap[key] ? `${memoMap[key]}\n${line}` : line;
      }
      const hakjeomToRowWithMemo = (
        item: HakjeomConsultation,
        index: number,
      ) => [
        ...hakjeomToRow(item, index).slice(0, -2), // 메모+등록일 제외
        memoMap[String(item.id)] ?? "", // 전체 메모 (모든 메모 합본)
        item.created_at
          ? new Date(item.created_at).toLocaleString("ko-KR")
          : "",
      ];
      downloadExcel(filename, [
        {
          name: "학점은행제",
          headers: HAKJEOM_HEADERS,
          rows: exportItems.map((item, i) => hakjeomToRowWithMemo(item, i)),
        },
      ]);
    } catch {
      downloadExcel(filename, [
        {
          name: "학점은행제",
          headers: HAKJEOM_HEADERS,
          rows: exportItems.map((item, i) => hakjeomToRow(item, i)),
        },
      ]);
    }
  };

  const resetFilters = () => {
    setSearchText("");
    setStatusFilter([]);
    setManagerFilter([]);
    setMajorCategoryFilter([]);
    setMinorCategoryFilter([]);
    setReasonFilter([]);
    setCounselCheckFilter([]);
    setHopeCourseFilter([]);
    setStartDate("");
    setEndDate("");
    setCurrentPage(1);
  };


  return (
    <div>
      {/* 페이지 상단 — 영업 상담 가능 현황 (담당자 배정 참고용) */}
      <div className={styles.leaderboardWrap} data-guide="hakjeom-leaderboard">
        <AgentAvailability />
      </div>
      {loading ? (
        <FilterBarSkeleton />
      ) : (
        <>
          {/* 필터 영역 */}
          <div className={styles.filterRow}>
            <div className={styles.searchWrap} data-guide="hakjeom-search">
              <Search className={styles.searchIcon} size={16} />
              <input
                type="text"
                value={searchText}
                onChange={(e) => {
                  setSearchText(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="이름, 연락처, 취득사유, 메모 검색..."
                className={`${styles.input} ${styles.searchInput}`}
              />
            </div>
            <div
              ref={dateRangeRef}
              className={styles.dateRangeWrap}
              data-guide="hakjeom-daterange"
            >
              <button
                type="button"
                className={styles.dateRangeBtn}
                onClick={() => setDateRangeOpen((v) => !v)}
              >
                {dateRangeLabel}
              </button>
              {dateRangeOpen && (
                <div className={styles.dateRangePopover}>
                  <DateRangeCalendar
                    variant="quarter"
                    value={dateRangeValue}
                    onChange={(r) => {
                      setStartDate(r?.from ? ymd(r.from) : "");
                      setEndDate(r?.to ? ymd(r.to) : "");
                      setCurrentPage(1);
                    }}
                    onConfirm={() => setDateRangeOpen(false)}
                    onReset={() => {
                      setStartDate("");
                      setEndDate("");
                      setCurrentPage(1);
                    }}
                  />
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={startGuide}
              className={styles.guideBtn}
              title="문의 DB 사용법 보기"
            >
              <HelpCircle size={15} />
              <span>가이드</span>
            </button>
            {isFiltered && (
              <button onClick={resetFilters} className={styles.btnSecondary}>
                필터 초기화
              </button>
            )}
            {selectedIds.length > 0 && (
              <>
                <div ref={bulkMenuRef} style={{ position: "relative" }}>
                  <button
                    onClick={() => {
                      setShowBulkMenu((v) => !v);
                      setShowManagerAssign(false);
                      setShowSourceAssign(false);
                      setShowBulkStatusAssign(false);
                    }}
                    disabled={
                      assigningManager || assigningSource || assigningStatus
                    }
                    className={styles.btnPrimary}
                  >
                    {assigningManager || assigningSource || assigningStatus
                      ? "처리 중..."
                      : "일괄 변경 ▾"}
                  </button>
                  {showBulkMenu && (
                    <div className={styles.managerAssignDropdown}>
                      <button
                        className={styles.managerAssignOption}
                        onClick={() => {
                          setShowBulkMenu(false);
                          setShowManagerAssign(true);
                        }}
                      >
                        담당자 배정
                      </button>
                      <button
                        className={styles.managerAssignOption}
                        onClick={() => {
                          setShowBulkMenu(false);
                          setShowSourceAssign(true);
                          setBulkSourceMajor("");
                          setBulkSourceMinor("");
                        }}
                      >
                        유입경로 배정
                      </button>
                      <button
                        className={styles.managerAssignOption}
                        onClick={() => {
                          setShowBulkMenu(false);
                          setShowBulkStatusAssign(true);
                        }}
                      >
                        상태 변경
                      </button>
                    </div>
                  )}
                  {showManagerAssign && (
                    <div className={styles.managerAssignDropdown}>
                      {uniqueManagers.map((m) => (
                        <button
                          key={m}
                          className={styles.managerAssignOption}
                          onClick={() => handleBulkAssignManager(m)}
                        >
                          {m}
                        </button>
                      ))}
                      <div className={styles.managerAssignDivider} />
                      <div className={styles.managerAssignInputRow}>
                        <input
                          className={styles.managerAssignInput}
                          placeholder="직접 입력"
                          value={managerAssignInput}
                          onChange={(e) =>
                            setManagerAssignInput(e.target.value)
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && managerAssignInput.trim())
                              handleBulkAssignManager(
                                managerAssignInput.trim(),
                              );
                          }}
                          autoFocus
                        />
                        <button
                          className={styles.managerAssignConfirm}
                          disabled={!managerAssignInput.trim()}
                          onClick={() => {
                            if (managerAssignInput.trim())
                              handleBulkAssignManager(
                                managerAssignInput.trim(),
                              );
                          }}
                        >
                          확인
                        </button>
                      </div>
                    </div>
                  )}
                  {showSourceAssign && (
                    <div className={styles.sourceAssignDropdown}>
                      <p className={styles.sourceAssignLabel}>대분류 선택</p>
                      <div className={styles.sourceAssignMajorRow}>
                        {SOURCE_MAJORS.map((m) => (
                          <button
                            key={m}
                            type="button"
                            className={
                              bulkSourceMajor === m
                                ? styles.tagBtnSmActive
                                : styles.tagBtnSm
                            }
                            onClick={() => {
                              setBulkSourceMajor((prev) =>
                                prev === m ? "" : m,
                              );
                              setBulkSourceMinor("");
                            }}
                          >
                            {SOURCE_MAJOR_LABEL[m] ?? m}
                          </button>
                        ))}
                      </div>
                      {bulkSourceMajor === "맘카페" && (
                        <div className={styles.sourceAssignSubPanel}>
                          {CAFE_NAME_LIST.map((name) => (
                            <button
                              key={name}
                              type="button"
                              className={
                                bulkSourceMinor === name
                                  ? styles.tagBtnSmActive
                                  : styles.tagBtnSm
                              }
                              onClick={() =>
                                setBulkSourceMinor((prev) =>
                                  prev === name ? "" : name,
                                )
                              }
                            >
                              {name}
                            </button>
                          ))}
                          {customCafes.map((name) => (
                            <span key={name} className={styles.customItemWrap}>
                              <button
                                type="button"
                                className={
                                  bulkSourceMinor === name
                                    ? styles.tagBtnSmActive
                                    : styles.tagBtnSm
                                }
                                onClick={() =>
                                  setBulkSourceMinor((prev) =>
                                    prev === name ? "" : name,
                                  )
                                }
                              >
                                {name}
                              </button>
                              <button
                                type="button"
                                className={styles.customItemDeleteBtn}
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      `"${name}" 카페를 삭제하시겠습니까?`,
                                    )
                                  )
                                    handleDeleteCafe(name);
                                }}
                              >
                                ✕
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      {bulkSourceMajor === "당근" && (
                        <div className={styles.sourceAssignSubPanel}>
                          {/* 기본 소재 옵션 */}
                          {DANGGEUN_DEFAULT_OPTIONS.map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              className={
                                bulkSourceMinor === opt
                                  ? styles.tagBtnSmActive
                                  : styles.tagBtnSm
                              }
                              onClick={() =>
                                setBulkSourceMinor((prev) =>
                                  prev === opt ? "" : opt,
                                )
                              }
                            >
                              {opt}
                            </button>
                          ))}
                          {/* 사용자 추가 소재 */}
                          {customDanggeun.map((name) => (
                            <span key={name} className={styles.customItemWrap}>
                              <button
                                type="button"
                                className={
                                  bulkSourceMinor === name
                                    ? styles.tagBtnSmActive
                                    : styles.tagBtnSm
                                }
                                onClick={() =>
                                  setBulkSourceMinor((prev) =>
                                    prev === name ? "" : name,
                                  )
                                }
                              >
                                {name}
                              </button>
                              <button
                                type="button"
                                className={styles.customItemDeleteBtn}
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      `"${name}"을(를) 삭제하시겠습니까?`,
                                    )
                                  )
                                    handleDeleteDanggeun(name);
                                }}
                              >
                                ✕
                              </button>
                            </span>
                          ))}
                          {/* 추가 버튼 / 입력칸 */}
                          {bulkAddInputVisible ? (
                            <span className={styles.sourceAssignAddRow}>
                              <input
                                autoFocus
                                className={styles.sourceAssignAddInput}
                                placeholder="소재명 입력"
                                value={bulkAddInputValue}
                                onChange={(e) =>
                                  setBulkAddInputValue(e.target.value)
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    const name = bulkAddInputValue.trim();
                                    if (
                                      name &&
                                      !customDanggeun.includes(name) &&
                                      !DANGGEUN_DEFAULT_OPTIONS.includes(name)
                                    ) {
                                      handleAddDanggeun(name);
                                      setBulkSourceMinor(name);
                                      setBulkAddInputValue("");
                                      setBulkAddInputVisible(false);
                                    }
                                  }
                                  if (e.key === "Escape") {
                                    setBulkAddInputValue("");
                                    setBulkAddInputVisible(false);
                                  }
                                }}
                              />
                              <button
                                type="button"
                                className={styles.tagBtnSm}
                                onClick={() => {
                                  const name = bulkAddInputValue.trim();
                                  if (
                                    name &&
                                    !customDanggeun.includes(name) &&
                                    !DANGGEUN_DEFAULT_OPTIONS.includes(name)
                                  ) {
                                    handleAddDanggeun(name);
                                    setBulkSourceMinor(name);
                                    setBulkAddInputValue("");
                                    setBulkAddInputVisible(false);
                                  }
                                }}
                              >
                                추가
                              </button>
                              <button
                                type="button"
                                className={styles.sourceAssignAddCancel}
                                aria-label="취소"
                                onClick={() => {
                                  setBulkAddInputValue("");
                                  setBulkAddInputVisible(false);
                                }}
                              >
                                ✕
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              className={styles.tagBtnSm}
                              onClick={() => setBulkAddInputVisible(true)}
                            >
                              + 추가
                            </button>
                          )}
                        </div>
                      )}
                      {bulkSourceMajor && (
                        <input
                          className={styles.sourceAssignMinorInput}
                          placeholder="중분류 직접 입력 (선택)"
                          value={bulkSourceMinor}
                          onChange={(e) => setBulkSourceMinor(e.target.value)}
                        />
                      )}
                      <div className={styles.sourceAssignConfirmRow}>
                        <button
                          className={styles.sourceAssignConfirm}
                          disabled={!bulkSourceMajor}
                          onClick={handleBulkAssignSource}
                        >
                          {bulkSourceMajor
                            ? `"${SOURCE_MAJOR_LABEL[bulkSourceMajor] ?? bulkSourceMajor}${bulkSourceMinor ? ` > ${bulkSourceMinor}` : ""}" 배정`
                            : "대분류를 선택하세요"}
                        </button>
                      </div>
                    </div>
                  )}
                  {showBulkStatusAssign && (
                    <div
                      className={styles.managerAssignDropdown}
                      style={{ minWidth: 260 }}
                    >
                      <p className={styles.sourceAssignLabel}>상태 선택</p>
                      {CONSULTATION_STATUS_OPTIONS.filter(
                        (s) => !COUNSEL_SUB.includes(s),
                      ).map((s) => (
                        <button
                          key={s}
                          className={styles.managerAssignOption}
                          onClick={() => handleBulkAssignStatus(s)}
                        >
                          <span
                            style={{
                              display: "inline-block",
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: CONSULTATION_STATUS_STYLE[s]?.color,
                              marginRight: 8,
                            }}
                          />
                          {s}
                        </button>
                      ))}
                      <div className={styles.managerAssignDivider} />
                      <p className={styles.sourceAssignLabel}>상담완료</p>
                      {COUNSEL_SUB.map((s) => (
                        <button
                          key={s}
                          className={styles.managerAssignOption}
                          onClick={() => handleBulkAssignStatus(s)}
                        >
                          <span
                            style={{
                              display: "inline-block",
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: CONSULTATION_STATUS_STYLE[s]?.color,
                              marginRight: 8,
                            }}
                          />
                          {COUNSEL_SUB_LABEL[s]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={handleBulkDelete}
                  disabled={deleting}
                  className={styles.btnDanger}
                >
                  {deleting ? "삭제 중..." : "선택 삭제"}
                </button>
                <button
                  onClick={handleDownloadSelected}
                  className={styles.btnDownload}
                >
                  ↓ 선택 다운로드
                </button>
              </>
            )}
          </div>
          {/* 액션 바 */}
          <div className={styles.actionBar}>
            <span className={styles.actionBarCount}>
              총{" "}
              <strong className={styles.actionBarCountBold}>
                {totalCount}
              </strong>
              건
            </span>
            <div className={styles.actionBarSpacer} />
            <button onClick={handleDownloadAll} className={styles.btnDownload}>
              ↓ 전체 다운로드
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className={styles.btnPrimary}
              data-guide="hakjeom-new-btn"
            >
              + 추가
            </button>
          </div>
        </>
      )}

      {/* 테이블 */}
      <div className={styles.tableCard} data-guide="hakjeom-table">
        {error ? (
          <div className={styles.tableErrorMsg}>{error}</div>
        ) : (
          <div className={`${styles.tableOverflow} ${styles.hakjeomMainTable}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.thCenter}>
                    <input
                      type="checkbox"
                      checked={
                        paginated.length > 0 &&
                        selectedIds.length === paginated.length
                      }
                      onChange={toggleSelectAll}
                      className={styles.checkbox}
                    />
                  </th>
                  <th className={styles.thNum}>번호</th>
                  <th className={styles.thFilterable}>
                    <div className={styles.thInner}>
                      대분류
                      <button
                        className={`${styles.thFilterBtn}${majorCategoryFilter.length > 0 ? ` ${styles.thFilterBtnActive}` : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (openFilterColumn === "major") {
                            setOpenFilterColumn(null);
                            return;
                          }
                          const rect = e.currentTarget.getBoundingClientRect();
                          setFilterDropdownPos({
                            top: rect.bottom + 4,
                            left: rect.left,
                          });
                          setOpenFilterColumn("major");
                        }}
                      >
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 10 10"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M2 3.5L5 6.5L8 3.5"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </div>
                  </th>
                  <th className={styles.thFilterable}>
                    <div className={styles.thInner}>
                      중분류
                      <button
                        className={`${styles.thFilterBtn}${minorCategoryFilter.length > 0 ? ` ${styles.thFilterBtnActive}` : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (openFilterColumn === "minor") {
                            setOpenFilterColumn(null);
                            return;
                          }
                          const rect = e.currentTarget.getBoundingClientRect();
                          setFilterDropdownPos({
                            top: rect.bottom + 4,
                            left: rect.left,
                          });
                          setOpenFilterColumn("minor");
                        }}
                      >
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 10 10"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M2 3.5L5 6.5L8 3.5"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </div>
                  </th>
                  <th className={styles.th}>이름</th>
                  <th className={styles.th}>연락처</th>
                  <th className={styles.th}>학력</th>
                  <th className={styles.thFilterable}>
                    <div className={styles.thInner}>
                      희망과정
                      <button
                        className={`${styles.thFilterBtn}${hopeCourseFilter.length > 0 ? ` ${styles.thFilterBtnActive}` : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (openFilterColumn === "hopeCourse") {
                            setOpenFilterColumn(null);
                            return;
                          }
                          const rect = e.currentTarget.getBoundingClientRect();
                          setFilterDropdownPos({
                            top: rect.bottom + 4,
                            left: rect.left,
                          });
                          setOpenFilterColumn("hopeCourse");
                        }}
                      >
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 10 10"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M2 3.5L5 6.5L8 3.5"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </div>
                  </th>
                  <th className={styles.th}>배정시간</th>
                  <th className={styles.thFilterable}>
                    <div className={styles.thInner}>
                      담당자
                      <button
                        className={`${styles.thFilterBtn}${managerFilter.length > 0 ? ` ${styles.thFilterBtnActive}` : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (openFilterColumn === "manager") {
                            setOpenFilterColumn(null);
                            return;
                          }
                          const rect = e.currentTarget.getBoundingClientRect();
                          setFilterDropdownPos({
                            top: rect.bottom + 4,
                            left: rect.left,
                          });
                          setOpenFilterColumn("manager");
                        }}
                      >
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 10 10"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M2 3.5L5 6.5L8 3.5"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </div>
                  </th>

                  <th
                    className={styles.thFilterable}
                    data-guide="hakjeom-status-col"
                  >
                    <div className={styles.thInner}>
                      상태
                      <button
                        className={`${styles.thFilterBtn}${statusFilter.length > 0 ? ` ${styles.thFilterBtnActive}` : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (openFilterColumn === "status") {
                            setOpenFilterColumn(null);
                            return;
                          }
                          const rect = e.currentTarget.getBoundingClientRect();
                          setFilterDropdownPos({
                            top: rect.bottom + 4,
                            left: rect.left,
                          });
                          setOpenFilterColumn("status");
                        }}
                      >
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 10 10"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M2 3.5L5 6.5L8 3.5"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </div>
                  </th>
                  <th className={styles.th}>응답시간</th>
                  <th className={styles.th}>메모</th>
                  <th className={styles.th}>등록일</th>
                  <th className={styles.th}></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableSkeleton cols={16} rows={8} />
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={16} className={styles.tableEmptyMsg}>
                      검색 결과가 없습니다.
                    </td>
                  </tr>
                ) : (
                  paginated.map((item, index) => (
                    <tr
                      key={item.id}
                      data-id={item.id}
                      data-guide={index === 0 ? "hakjeom-first-row" : undefined}
                      onClick={() => setSelectedItem(item)}
                      style={{
                        cursor: "pointer",
                        background:
                          selectedItem?.id === item.id
                            ? "var(--toss-blue-subtle, #EBF3FE)"
                            : selectedIds.includes(item.id)
                              ? "#f0f7ff"
                              : item.status === "상담완료-높음"
                                ? "#E0F7FA"
                                : item.status === "상담완료-중간"
                                  ? "#FFFDE7"
                                  : item.status === "상담완료-낮음"
                                    ? "#FCE4EC"
                                    : "transparent",
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={(e) => {
                        if (
                          selectedItem?.id !== item.id &&
                          !selectedIds.includes(item.id)
                        ) {
                          const rowBg =
                            item.status === "상담완료-높음"
                              ? "#C9F0F5"
                              : item.status === "상담완료-중간"
                                ? "#FFF9C4"
                                : item.status === "상담완료-낮음"
                                  ? "#F8BBD0"
                                  : "var(--toss-bg)";
                          (
                            e.currentTarget as HTMLTableRowElement
                          ).style.background = rowBg;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (
                          selectedItem?.id !== item.id &&
                          !selectedIds.includes(item.id)
                        ) {
                          const rowBg =
                            item.status === "상담완료-높음"
                              ? "#E0F7FA"
                              : item.status === "상담완료-중간"
                                ? "#FFFDE7"
                                : item.status === "상담완료-낮음"
                                  ? "#FCE4EC"
                                  : "transparent";
                          (
                            e.currentTarget as HTMLTableRowElement
                          ).style.background = rowBg;
                        }
                      }}
                    >
                      <td
                        className={styles.tdCenter}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(item.id)}
                          onChange={() => toggleSelect(item.id)}
                          onClick={(e) => e.stopPropagation()}
                          className={styles.checkbox}
                        />
                      </td>
                      <td className={styles.tdNum}>
                        {(currentPage - 1) * itemsPerPage + index + 1}
                      </td>
                      <td className={styles.tdSecondary}>
                        {(() => {
                          const m = parseSource(item.click_source).major;
                          if (!m) return "-";
                          return SOURCE_MAJOR_LABEL[m] ?? m;
                        })()}
                      </td>
                      <td
                        className={styles.tdSecondary}
                        style={
                          parseSource(item.click_source).needsCheck
                            ? { color: "#ef4444", fontWeight: 600 }
                            : undefined
                        }
                      >
                        {parseSource(item.click_source).minor || "-"}
                      </td>
                      <td className={styles.tdBold}>
                        <span className={styles.nameWithBadge}>
                          <Highlight text={item.name} query={searchText} />
                          {item.fast_consultation && <FastConsultBadge />}
                        </span>
                      </td>
                      <td
                        className={styles.tdTabular}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (selectedItem?.id === item.id)
                            setInlineContact({
                              id: item.id,
                              value: item.contact,
                            });
                          else setSelectedItem(item);
                        }}
                      >
                        {inlineContact?.id === item.id ? (
                          <input
                            className={styles.inlineContactInput}
                            value={inlineContact.value}
                            onChange={(e) =>
                              setInlineContact((p) =>
                                p
                                  ? {
                                      ...p,
                                      value: formatPhoneNumber(e.target.value),
                                    }
                                  : null,
                              )
                            }
                            onBlur={handleInlineContactSave}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleInlineContactSave();
                              if (e.key === "Escape") setInlineContact(null);
                            }}
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <span
                            title={
                              selectedItem?.id === item.id
                                ? "클릭하여 수정"
                                : undefined
                            }
                          >
                            <Highlight text={item.contact} query={searchText} />
                            {selectedItem?.id === item.id && (
                              <span className={styles.inlineEditHint}>✎</span>
                            )}
                          </span>
                        )}
                      </td>
                      <td className={styles.tdSecondary}>
                        {item.education ?? "-"}
                      </td>
                      <td
                        className={styles.tdEllipsis}
                        title={item.hope_course ?? ""}
                      >
                        {item.hope_course ?? "-"}
                      </td>
                      <td className={styles.tdSecondary}>
                        {formatAssignDelay(
                          item.created_at,
                          item.manager_assigned_at,
                        )}
                      </td>
                      <td className={styles.tdSecondary}>
                        {item.manager ?? "-"}
                      </td>

                      <td
                        className={styles.td}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <StatusSelect
                          value={item.status}
                          onChange={(v) =>
                            handleStatusChange(item.id, v as ConsultationStatus)
                          }
                          options={CONSULTATION_STATUS_OPTIONS}
                          styleMap={CONSULTATION_STATUS_STYLE}
                        />
                      </td>
                      <td className={styles.tdSecondary}>
                        {formatResponseTime(
                          item.manager_assigned_at,
                          item.consult_started_at,
                        )}
                      </td>
                      <td
                        className={styles.tdEllipsis}
                        title={item.latest_memo ?? item.memo ?? ""}
                      >
                        {item.latest_memo ?? item.memo ?? "-"}
                      </td>
                      <td className={styles.tdDateSmall}>
                        {formatDate(item.created_at)}
                      </td>
                      <td
                        className={styles.tdAction}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DateInput
                          value={
                            item.contact_scheduled_at
                              ? item.contact_scheduled_at.slice(0, 10)
                              : ""
                          }
                          onChange={(dateStr) =>
                            handleUpdate(item.id, {
                              contact_scheduled_at: dateStr
                                ? dateStr + "T00:00:00.000Z"
                                : null,
                            })
                          }
                          variant="button"
                          align="right"
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className={styles.pageBtn}
            style={{ marginRight: 4 }}
          >
            ‹
          </button>
          {getPaginationPages(currentPage, totalPages).map((page, idx) =>
            page === "..." ? (
              <span key={`ellipsis-${idx}`} className={styles.pageEllipsis}>
                …
              </span>
            ) : (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={
                  page === currentPage ? styles.pageBtnActive : styles.pageBtn
                }
              >
                {page}
              </button>
            ),
          )}
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className={styles.pageBtn}
            style={{ marginLeft: 4 }}
          >
            ›
          </button>
        </div>
      )}

      {/* 사이드 패널 */}
      {selectedItem && (
        <HakjeomDetailPanel
          item={selectedItem}
          onClose={() => {
            setSelectedItem(null);
            setOpenTab("basic");
            setInlineContact(null);
          }}
          onUpdate={handleUpdate}
          initialTab={openTab}
          customCafes={customCafes}
          customDanggeun={customDanggeun}
          onAddCafe={handleAddCafe}
          onDeleteCafe={handleDeleteCafe}
          onAddDanggeun={handleAddDanggeun}
          onDeleteDanggeun={handleDeleteDanggeun}
          hideManager={isOwnScope}
        />
      )}
      {toastVisible && (
        <div className={styles.toast}>저장이 완료되었습니다</div>
      )}
      {deleteToastVisible && <div className={styles.toast}>삭제되었습니다</div>}

      {/* 추가 모달 */}
      {showAddModal && (
        <HakjeomAddModal
          onClose={() => setShowAddModal(false)}
          onSaved={fetchData}
          uniqueManagers={uniqueManagers}
          customCafes={customCafes}
          customDanggeun={customDanggeun}
          onAddCafe={handleAddCafe}
          onDeleteCafe={handleDeleteCafe}
          onAddDanggeun={handleAddDanggeun}
          onDeleteDanggeun={handleDeleteDanggeun}
        />
      )}

      {/* 컬럼 필터 드롭다운 */}
      {openFilterColumn && (
        <div
          ref={dropdownRef}
          className={styles.filterColumnDropdown}
          style={{ top: filterDropdownPos.top, left: filterDropdownPos.left }}
        >
          {openFilterColumn === "major" && (
            <>
              <div
                className={`${styles.filterDropdownItem}${majorCategoryFilter.length === 0 ? ` ${styles.filterDropdownItemActive}` : ""}`}
                onClick={() => {
                  setMajorCategoryFilter([]);
                  setMinorCategoryFilter([]);
                  setCurrentPage(1);
                  setOpenFilterColumn(null);
                }}
              >
                전체
              </div>
              {uniqueMajorCategories.map((m) => (
                <div
                  key={m}
                  className={`${styles.filterDropdownItem}${majorCategoryFilter.includes(m) ? ` ${styles.filterDropdownItemActive}` : ""}`}
                  onClick={() => {
                    setMajorCategoryFilter((prev) =>
                      prev.includes(m)
                        ? prev.filter((x) => x !== m)
                        : [...prev, m],
                    );
                    setCurrentPage(1);
                  }}
                >
                  {SOURCE_MAJOR_LABEL[m] ?? m}
                </div>
              ))}
            </>
          )}
          {openFilterColumn === "minor" && (
            <>
              <div
                className={`${styles.filterDropdownItem}${minorCategoryFilter.length === 0 ? ` ${styles.filterDropdownItemActive}` : ""}`}
                onClick={() => {
                  setMinorCategoryFilter([]);
                  setCurrentPage(1);
                  setOpenFilterColumn(null);
                }}
              >
                전체
              </div>
              {needsCheckCount > 0 && (
                <div
                  className={`${styles.filterDropdownItem}${minorCategoryFilter.includes("__needs_check__") ? ` ${styles.filterDropdownItemActive}` : ""}`}
                  style={{ color: "#ef4444", fontWeight: 600 }}
                  onClick={() => {
                    setMinorCategoryFilter((prev) =>
                      prev.includes("__needs_check__")
                        ? prev.filter((x) => x !== "__needs_check__")
                        : [...prev, "__needs_check__"],
                    );
                    setCurrentPage(1);
                  }}
                >
                  확인필요 ({needsCheckCount})
                </div>
              )}
              {uniqueMinorCategories.map((m) => (
                <div
                  key={m}
                  className={`${styles.filterDropdownItem}${minorCategoryFilter.includes(m) ? ` ${styles.filterDropdownItemActive}` : ""}`}
                  onClick={() => {
                    setMinorCategoryFilter((prev) =>
                      prev.includes(m)
                        ? prev.filter((x) => x !== m)
                        : [...prev, m],
                    );
                    setCurrentPage(1);
                  }}
                >
                  {m}
                </div>
              ))}
            </>
          )}
          {openFilterColumn === "reason" && (
            <>
              <div
                className={`${styles.filterDropdownItem}${reasonFilter.length === 0 ? ` ${styles.filterDropdownItemActive}` : ""}`}
                onClick={() => {
                  setReasonFilter([]);
                  setCurrentPage(1);
                  setOpenFilterColumn(null);
                }}
              >
                전체
              </div>
              {REASON_OPTIONS.map((r) => (
                <div
                  key={r}
                  className={`${styles.filterDropdownItem}${reasonFilter.includes(r) ? ` ${styles.filterDropdownItemActive}` : ""}`}
                  onClick={() => {
                    setReasonFilter((prev) =>
                      prev.includes(r)
                        ? prev.filter((x) => x !== r)
                        : [...prev, r],
                    );
                    setCurrentPage(1);
                  }}
                >
                  {r}
                </div>
              ))}
            </>
          )}
          {openFilterColumn === "hopeCourse" && (
            <>
              <div
                className={`${styles.filterDropdownItem}${hopeCourseFilter.length === 0 ? ` ${styles.filterDropdownItemActive}` : ""}`}
                onClick={() => {
                  setHopeCourseFilter([]);
                  setCurrentPage(1);
                  setOpenFilterColumn(null);
                }}
              >
                전체
              </div>
              <div
                className={`${styles.filterDropdownItem}${hopeCourseFilter.includes("none") ? ` ${styles.filterDropdownItemActive}` : ""}`}
                onClick={() => {
                  setHopeCourseFilter((prev) =>
                    prev.includes("none")
                      ? prev.filter((x) => x !== "none")
                      : [...prev, "none"],
                  );
                  setCurrentPage(1);
                }}
              >
                미설정
              </div>
              {uniqueHopeCourses.map((o) => (
                <div
                  key={o}
                  className={`${styles.filterDropdownItem}${hopeCourseFilter.includes(o) ? ` ${styles.filterDropdownItemActive}` : ""}`}
                  onClick={() => {
                    setHopeCourseFilter((prev) =>
                      prev.includes(o)
                        ? prev.filter((x) => x !== o)
                        : [...prev, o],
                    );
                    setCurrentPage(1);
                  }}
                >
                  {o}
                </div>
              ))}
            </>
          )}
          {openFilterColumn === "counsel" && (
            <>
              <div
                className={`${styles.filterDropdownItem}${counselCheckFilter.length === 0 ? ` ${styles.filterDropdownItemActive}` : ""}`}
                onClick={() => {
                  setCounselCheckFilter([]);
                  setCurrentPage(1);
                  setOpenFilterColumn(null);
                }}
              >
                전체
              </div>
              {COUNSEL_CHECK_OPTIONS.map((c) => (
                <div
                  key={c}
                  className={`${styles.filterDropdownItem}${counselCheckFilter.includes(c) ? ` ${styles.filterDropdownItemActive}` : ""}`}
                  onClick={() => {
                    setCounselCheckFilter((prev) =>
                      prev.includes(c)
                        ? prev.filter((x) => x !== c)
                        : [...prev, c],
                    );
                    setCurrentPage(1);
                  }}
                >
                  {c}
                </div>
              ))}
            </>
          )}
          {openFilterColumn === "manager" && (
            <>
              <div
                className={`${styles.filterDropdownItem}${managerFilter.length === 0 ? ` ${styles.filterDropdownItemActive}` : ""}`}
                onClick={() => {
                  setManagerFilter([]);
                  setCurrentPage(1);
                  setOpenFilterColumn(null);
                }}
              >
                전체
              </div>
              <div
                className={`${styles.filterDropdownItem}${managerFilter.includes("none") ? ` ${styles.filterDropdownItemActive}` : ""}`}
                onClick={() => {
                  setManagerFilter((prev) =>
                    prev.includes("none")
                      ? prev.filter((x) => x !== "none")
                      : [...prev, "none"],
                  );
                  setCurrentPage(1);
                }}
              >
                미배정
              </div>
              {uniqueManagers.map((m) => (
                <div
                  key={m}
                  className={`${styles.filterDropdownItem}${managerFilter.includes(m) ? ` ${styles.filterDropdownItemActive}` : ""}`}
                  onClick={() => {
                    setManagerFilter((prev) =>
                      prev.includes(m)
                        ? prev.filter((x) => x !== m)
                        : [...prev, m],
                    );
                    setCurrentPage(1);
                  }}
                >
                  {m}
                </div>
              ))}
            </>
          )}
          {openFilterColumn === "status" && (
            <>
              <div
                className={`${styles.filterDropdownItem}${statusFilter.length === 0 ? ` ${styles.filterDropdownItemActive}` : ""}`}
                onClick={() => {
                  setStatusFilter([]);
                  setCurrentPage(1);
                  setOpenFilterColumn(null);
                }}
              >
                전체
              </div>
              {CONSULTATION_STATUS_OPTIONS.map((s) => (
                <div
                  key={s}
                  className={`${styles.filterDropdownItem}${statusFilter.includes(s as ConsultationStatus) ? ` ${styles.filterDropdownItemActive}` : ""}`}
                  onClick={() => {
                    setStatusFilter((prev) =>
                      prev.includes(s as ConsultationStatus)
                        ? prev.filter((x) => x !== s)
                        : [...prev, s as ConsultationStatus],
                    );
                    setCurrentPage(1);
                  }}
                >
                  {s}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 탭: 기관협약 ────────────────────────────────────────────────────────────

// 기관협약 CSV 헤더 매핑
const AGENCY_HEADER_MAP: Record<string, string> = {
  기관명: "institution_name",
  institution_name: "institution_name",
  분류: "category",
  category: "category",
  지역: "address",
  region: "address",
  address: "address",
  연락처: "contact",
  contact: "contact",
  학점수수료: "credit_commission",
  credit_commission: "credit_commission",
  민간수수료: "private_commission",
  private_commission: "private_commission",
  담당자: "manager",
  manager: "manager",
  메모: "memo",
  memo: "memo",
  상태: "status",
  status: "status",
};

const AGENCY_CSV_TEMPLATE =
  "\uFEFF기관명,분류,지역,연락처,학점수수료,민간수수료,담당자,메모,상태\n한빛유치원,어린이집,서울 강동구,02-1234-5678,10%,15%,김담당,,협약대기\n";

function parseAgencyCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((h) => h.replace(/^\uFEFF/, ""));
  const colMap = headers
    .map((h, i) => ({ field: AGENCY_HEADER_MAP[h], idx: i }))
    .filter(({ field }) => field);
  return lines
    .slice(1)
    .map((line) => {
      const cols = parseCsvLine(line);
      if (cols.every((c) => !c)) return null;
      const row: Record<string, string> = {};
      colMap.forEach(({ field, idx }) => {
        if (cols[idx] !== undefined) row[field] = cols[idx];
      });
      if (!row.status) row.status = "협약대기";
      return row;
    })
    .filter(Boolean) as Record<string, string>[];
}

function AgencyTab({
  isActive,
  highlightId,
}: {
  isActive: boolean;
  highlightId?: number;
}) {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 담당자 협약 실적 (검색영역 표시용)
  const [agencyStatsNode, setAgencyStatsNode] = useState<React.ReactNode>(null);

  // 필터
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<AgencyStatus | "all">("all");
  const [managerFilter, setManagerFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  // 헤더 필터 드롭다운
  const [openFilterColumn, setOpenFilterColumn] = useState<string | null>(null);
  const [filterDropdownPos, setFilterDropdownPos] = useState({
    top: 0,
    left: 0,
  });
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 페이지네이션
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // UI
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Agency | null>(null);
  const [deleteToastVisible, setDeleteToastVisible] = useState(false);

  // 셀 클릭 편집
  const [fieldModal, setFieldModal] = useState<{
    id: number;
    field: keyof Agency;
    label: string;
    value: string;
    multiline?: boolean;
  } | null>(null);
  const [fieldSaving, setFieldSaving] = useState(false);

  // 검색에서 직접 이동 시 해당 행 하이라이트
  useEffect(() => {
    if (!highlightId || agencies.length === 0) return;
    const idx = agencies.findIndex((a) => a.id === highlightId);
    if (idx < 0) return;
    setCurrentPage(Math.ceil((idx + 1) / ITEMS_PER_PAGE));
    setTimeout(() => {
      const el = document.querySelector(
        `tr[data-id="${highlightId}"]`,
      ) as HTMLElement | null;
      if (!el) return;
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      el.classList.add(styles.highlightRow);
      setTimeout(() => el.classList.remove(styles.highlightRow), 2500);
    }, 150);
  }, [agencies, highlightId]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/hakjeom/agency");
      if (!res.ok) throw new Error("데이터를 불러오지 못했습니다.");
      const data: Agency[] = await res.json();
      setAgencies(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  useEffect(() => {
    if (isActive) fetchData();
  }, [isActive, fetchData]);

  useEffect(() => {
    if (!openFilterColumn) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpenFilterColumn(null);
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [openFilterColumn]);

  const handleStatusChange = async (id: number, status: AgencyStatus) => {
    const res = await fetch("/api/hakjeom/agency", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) {
      setAgencies((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status } : a)),
      );
    }
  };

  const handleFieldSave = async () => {
    if (!fieldModal) return;
    setFieldSaving(true);
    const res = await fetch("/api/hakjeom/agency", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: fieldModal.id,
        [fieldModal.field]: fieldModal.value || null,
      }),
    });
    if (res.ok) {
      setAgencies((prev) =>
        prev.map((a) =>
          a.id === fieldModal.id
            ? { ...a, [fieldModal.field]: fieldModal.value || null }
            : a,
        ),
      );
      setFieldModal(null);
    } else {
      alert("저장에 실패했습니다.");
    }
    setFieldSaving(false);
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    const reason = window
      .prompt(
        `${selectedIds.size}건을 삭제합니다.\n삭제 사유를 입력해주세요.`,
        "",
      )
      ?.trim();
    if (!reason) {
      if (reason === "") alert("삭제 사유를 입력해야 삭제할 수 있습니다.");
      return;
    }
    setDeleting(true);
    const ids = Array.from(selectedIds);
    const res = await fetch("/api/hakjeom/agency", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, reason }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? "삭제에 실패했습니다.");
      setDeleting(false);
      return;
    }
    setSelectedIds(new Set());
    await fetchData();
    setDeleting(false);
    setDeleteToastVisible(true);
    setTimeout(() => setDeleteToastVisible(false), 2500);
  };

  const uniqueManagers = Array.from(
    new Set(agencies.map((a) => a.manager).filter(Boolean)),
  ) as string[];
  const uniqueCategories = Array.from(
    new Set(agencies.map((a) => a.category).filter(Boolean)),
  ) as string[];

  const filtered = agencies.filter((a) => {
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    if (categoryFilter !== "all" && a.category !== categoryFilter) return false;
    if (managerFilter !== "all") {
      if (managerFilter === "none" && a.manager) return false;
      if (managerFilter !== "none" && a.manager !== managerFilter) return false;
    }
    if (searchText) {
      const q = searchText.toLowerCase();
      const contactClean = (a.contact || "").replace(/-/g, "");
      const searchClean = searchText.replace(/-/g, "");
      if (
        !(
          (a.institution_name || "").toLowerCase().includes(q) ||
          (a.contact || "").toLowerCase().includes(q) ||
          contactClean.includes(searchClean) ||
          (a.address || "").toLowerCase().includes(q) ||
          (a.category || "").toLowerCase().includes(q) ||
          (a.manager || "").toLowerCase().includes(q)
        )
      )
        return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  // 필터 변경 시 첫 페이지로 리셋
  useEffect(() => {
    setCurrentPage(1);
  }, [searchText, statusFilter, managerFilter, categoryFilter]);

  const toggleSelect = (id: number) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const toggleSelectAll = () =>
    setSelectedIds((prev) =>
      prev.size === filtered.length
        ? new Set()
        : new Set(filtered.map((a) => a.id)),
    );

  const isFiltered =
    searchText ||
    statusFilter !== "all" ||
    managerFilter !== "all" ||
    categoryFilter !== "all";

  const AGENCY_HEADERS = [
    "번호",
    "분류",
    "지역",
    "기관이름",
    "연락처",
    "학점커미션",
    "민간커미션",
    "담당자",
    "협약상태",
    "등록일",
  ];
  const agencyToRow = (a: Agency, i: number) => [
    i + 1,
    a.category ?? "",
    a.address ?? "",
    a.institution_name ?? "",
    a.contact ?? "",
    a.credit_commission ?? "",
    a.private_commission ?? "",
    a.manager ?? "",
    a.status,
    a.created_at ? new Date(a.created_at).toLocaleString("ko-KR") : "",
  ];

  const handleAgencyDownloadSelected = () => {
    const targets = filtered.filter((a) => selectedIds.has(a.id));
    downloadExcel(
      `기관협약_선택_${new Date().toLocaleDateString("ko-KR").replace(/\. /g, "-").replace(".", "")}.xlsx`,
      [
        {
          name: "기관협약",
          headers: AGENCY_HEADERS,
          rows: targets.map((a, i) => agencyToRow(a, i)),
        },
      ],
    );
  };

  const handleAgencyDownloadAll = () => {
    downloadExcel(
      `기관협약_전체_${new Date().toLocaleDateString("ko-KR").replace(/\. /g, "-").replace(".", "")}.xlsx`,
      [
        {
          name: "기관협약",
          headers: AGENCY_HEADERS,
          rows: filtered.map((a, i) => agencyToRow(a, i)),
        },
      ],
    );
  };

  // 담당자별 협약 실적 (검색영역 표시)
  useEffect(() => {
    if (!isActive) {
      setAgencyStatsNode(null);
      return;
    }
    const mgrs = Array.from(
      new Set(agencies.map((a) => a.manager).filter(Boolean)),
    ) as string[];
    if (mgrs.length === 0) {
      setAgencyStatsNode(null);
      return;
    }
    const mStats = mgrs
      .map((name) => {
        const all = agencies.filter((a) => a.manager === name);
        return {
          name,
          total: all.length,
          completed: all.filter((a) => a.status === "협약완료").length,
        };
      })
      .sort((a, b) => b.total - a.total);
    setAgencyStatsNode(
      <div className={styles.statsInline}>
        <span className={styles.statsInlineLabel}>담당자 협약</span>
        {mStats.map((m) => (
          <span key={m.name} className={styles.statsInlineItem}>
            {m.name}
            <span className={styles.statsInlineRate}>
              {m.completed}/{m.total}
            </span>
          </span>
        ))}
      </div>,
    );
    return () => setAgencyStatsNode(null);
  }, [agencies, isActive]);

  return (
    <div>
      {loading ? (
        <FilterBarSkeleton />
      ) : (
        <>
          {/* 담당자 협약 실적 */}
          {agencyStatsNode}
          <div className={styles.filterRow}>
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="기관명, 지역, 분류, 담당자 검색..."
              className={styles.input}
              style={{ width: 300 }}
            />
            {isFiltered && (
              <button
                onClick={() => {
                  setSearchText("");
                  setStatusFilter("all");
                  setManagerFilter("all");
                  setCategoryFilter("all");
                }}
                className={styles.btnSecondary}
              >
                필터 초기화
              </button>
            )}
          </div>

          {/* 일괄 선택 액션 바 */}
          {selectedIds.size > 0 && (
            <div className={styles.bulkActionBar}>
              <button
                onClick={handleDeleteSelected}
                disabled={deleting}
                className={styles.btnDanger}
              >
                {deleting ? "삭제 중..." : "선택 삭제"}
              </button>
              {selectedIds.size === 1 && (
                <button
                  onClick={() => {
                    const target = agencies.find(
                      (a) => a.id === Array.from(selectedIds)[0],
                    );
                    if (target) {
                      setEditTarget(target);
                      setShowModal(true);
                    }
                  }}
                  disabled={deleting}
                  className={styles.btnSecondary}
                >
                  수정
                </button>
              )}
              <button
                onClick={handleAgencyDownloadSelected}
                className={styles.btnDownload}
              >
                ↓ 선택 다운로드
              </button>
            </div>
          )}

          <div className={styles.actionBar}>
            <span className={styles.actionBarCount}>
              총{" "}
              <strong className={styles.actionBarCountBold}>
                {filtered.length}
              </strong>
              건
            </span>
            <div className={styles.actionBarSpacer} />
            <button
              onClick={handleAgencyDownloadAll}
              className={styles.btnDownload}
            >
              ↓ 전체 다운로드
            </button>
            <button
              onClick={() => {
                setEditTarget(null);
                setShowModal(true);
              }}
              className={styles.btnPrimary}
            >
              + 기관 추가
            </button>
          </div>
        </>
      )}

      <div className={styles.tableCard}>
        {error ? (
          <div className={styles.tableErrorMsg}>{error}</div>
        ) : (
          <div className={styles.tableOverflow}>
            <table className={styles.tableMinWidth900}>
              <thead>
                <tr>
                  <th className={styles.thCenter}>
                    <input
                      type="checkbox"
                      checked={
                        filtered.length > 0 &&
                        selectedIds.size === filtered.length
                      }
                      onChange={toggleSelectAll}
                      className={styles.checkbox}
                    />
                  </th>
                  <th className={styles.thNum}>번호</th>
                  <th className={styles.thFilterable}>
                    <div className={styles.thInner}>
                      분류
                      <button
                        className={`${styles.thFilterBtn}${categoryFilter !== "all" ? ` ${styles.thFilterBtnActive}` : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (openFilterColumn === "category") {
                            setOpenFilterColumn(null);
                            return;
                          }
                          const rect = e.currentTarget.getBoundingClientRect();
                          setFilterDropdownPos({
                            top: rect.bottom + 4,
                            left: rect.left,
                          });
                          setOpenFilterColumn("category");
                        }}
                      >
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 10 10"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M2 3.5L5 6.5L8 3.5"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </div>
                  </th>
                  <th className={styles.th}>지역</th>
                  <th className={styles.th}>기관이름</th>
                  <th className={styles.th}>연락처</th>
                  <th className={styles.th}>학점커미션</th>
                  <th className={styles.th}>민간커미션</th>
                  <th className={styles.thFilterable}>
                    <div className={styles.thInner}>
                      담당자
                      <button
                        className={`${styles.thFilterBtn}${managerFilter !== "all" ? ` ${styles.thFilterBtnActive}` : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (openFilterColumn === "manager") {
                            setOpenFilterColumn(null);
                            return;
                          }
                          const rect = e.currentTarget.getBoundingClientRect();
                          setFilterDropdownPos({
                            top: rect.bottom + 4,
                            left: rect.left,
                          });
                          setOpenFilterColumn("manager");
                        }}
                      >
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 10 10"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M2 3.5L5 6.5L8 3.5"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </div>
                  </th>
                  <th className={styles.th}>메모</th>
                  <th className={styles.thFilterable}>
                    <div className={styles.thInner}>
                      상태
                      <button
                        className={`${styles.thFilterBtn}${statusFilter !== "all" ? ` ${styles.thFilterBtnActive}` : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (openFilterColumn === "status") {
                            setOpenFilterColumn(null);
                            return;
                          }
                          const rect = e.currentTarget.getBoundingClientRect();
                          setFilterDropdownPos({
                            top: rect.bottom + 4,
                            left: rect.left,
                          });
                          setOpenFilterColumn("status");
                        }}
                      >
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 10 10"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M2 3.5L5 6.5L8 3.5"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </div>
                  </th>
                  <th className={styles.th}>등록일</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableSkeleton cols={12} rows={8} />
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={12} className={styles.tableEmptyMsg}>
                      등록된 기관이 없습니다.
                    </td>
                  </tr>
                ) : (
                  paginated.map((a, index) => (
                    <tr
                      key={a.id}
                      data-id={a.id}
                      style={{
                        background: selectedIds.has(a.id)
                          ? "#f0f7ff"
                          : "transparent",
                      }}
                    >
                      <td className={styles.tdCenter}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(a.id)}
                          onChange={() => toggleSelect(a.id)}
                          className={styles.checkbox}
                        />
                      </td>
                      <td className={styles.tdNum}>
                        {(currentPage - 1) * ITEMS_PER_PAGE + index + 1}
                      </td>
                      <td className={styles.tdSecondary}>
                        <Highlight text={a.category} query={searchText} />
                      </td>
                      <td className={styles.tdSecondary}>
                        <Highlight text={a.address} query={searchText} />
                      </td>
                      <td className={styles.tdBold}>
                        <Highlight
                          text={a.institution_name}
                          query={searchText}
                        />
                      </td>
                      <td className={styles.td}>
                        {a.contact ? (
                          <span
                            onClick={() => {
                              navigator.clipboard.writeText(a.contact!);
                            }}
                            style={{
                              cursor: "pointer",
                              borderRadius: 4,
                              padding: "2px 4px",
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.background = "#f2f4f6")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.background = "")
                            }
                            title="클릭하여 복사"
                          >
                            <Highlight text={a.contact} query={searchText} />
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      {/* 셀 클릭 편집: 학점커미션 */}
                      <td className={styles.td}>
                        <span
                          className={styles.cellClick}
                          onClick={() =>
                            setFieldModal({
                              id: a.id,
                              field: "credit_commission",
                              label: "학점커미션",
                              value: a.credit_commission || "",
                            })
                          }
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.background = "#f2f4f6")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.background = "")
                          }
                        >
                          {a.credit_commission || (
                            <span className={styles.agencyEmptyColor}>-</span>
                          )}
                        </span>
                      </td>
                      {/* 민간커미션 */}
                      <td className={styles.td}>
                        <span
                          className={styles.cellClick}
                          onClick={() =>
                            setFieldModal({
                              id: a.id,
                              field: "private_commission",
                              label: "민간커미션",
                              value: a.private_commission || "",
                            })
                          }
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.background = "#f2f4f6")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.background = "")
                          }
                        >
                          {a.private_commission || (
                            <span className={styles.agencyEmptyColor}>-</span>
                          )}
                        </span>
                      </td>
                      {/* 담당자 */}
                      <td className={styles.td}>
                        <span
                          className={styles.cellClick}
                          onClick={() =>
                            setFieldModal({
                              id: a.id,
                              field: "manager",
                              label: "담당자",
                              value: a.manager || "",
                            })
                          }
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.background = "#f2f4f6")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.background = "")
                          }
                        >
                          {a.manager ? (
                            <Highlight text={a.manager} query={searchText} />
                          ) : (
                            <span className={styles.agencyEmptyColor}>
                              미배정
                            </span>
                          )}
                        </span>
                      </td>
                      {/* 메모 */}
                      <td className={styles.tdMemoCell}>
                        <span
                          className={styles.cellClickMemo}
                          onClick={() =>
                            setFieldModal({
                              id: a.id,
                              field: "memo",
                              label: "메모",
                              value: a.memo || "",
                              multiline: true,
                            })
                          }
                          title={a.memo || ""}
                        >
                          {a.memo || (
                            <span className={styles.agencyEmptyColor}>-</span>
                          )}
                        </span>
                      </td>
                      <td
                        className={styles.td}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <StatusSelect
                          value={a.status}
                          onChange={(v) =>
                            handleStatusChange(a.id, v as AgencyStatus)
                          }
                          options={AGENCY_STATUS_OPTIONS}
                          styleMap={AGENCY_STATUS_STYLE}
                        />
                      </td>
                      <td className={styles.agencyDateTd}>
                        {formatDateShort(a.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className={styles.pageBtn}
            style={{ marginRight: 4 }}
          >
            ‹
          </button>
          {getPaginationPages(currentPage, totalPages).map((page, idx) =>
            page === "..." ? (
              <span key={`ellipsis-${idx}`} className={styles.pageEllipsis}>
                …
              </span>
            ) : (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={
                  page === currentPage ? styles.pageBtnActive : styles.pageBtn
                }
              >
                {page}
              </button>
            ),
          )}
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className={styles.pageBtn}
            style={{ marginLeft: 4 }}
          >
            ›
          </button>
        </div>
      )}

      {/* 헤더 필터 드롭다운 */}
      {openFilterColumn && (
        <div
          ref={dropdownRef}
          className={styles.filterColumnDropdown}
          style={{ top: filterDropdownPos.top, left: filterDropdownPos.left }}
        >
          {openFilterColumn === "category" && (
            <>
              <div
                className={`${styles.filterDropdownItem}${categoryFilter === "all" ? ` ${styles.filterDropdownItemActive}` : ""}`}
                onClick={() => {
                  setCategoryFilter("all");
                  setOpenFilterColumn(null);
                }}
              >
                전체
              </div>
              {uniqueCategories.map((c) => (
                <div
                  key={c}
                  className={`${styles.filterDropdownItem}${categoryFilter === c ? ` ${styles.filterDropdownItemActive}` : ""}`}
                  onClick={() => {
                    setCategoryFilter(c);
                    setOpenFilterColumn(null);
                  }}
                >
                  {c}
                </div>
              ))}
            </>
          )}
          {openFilterColumn === "manager" && (
            <>
              <div
                className={`${styles.filterDropdownItem}${managerFilter === "all" ? ` ${styles.filterDropdownItemActive}` : ""}`}
                onClick={() => {
                  setManagerFilter("all");
                  setOpenFilterColumn(null);
                }}
              >
                전체
              </div>
              <div
                className={`${styles.filterDropdownItem}${managerFilter === "none" ? ` ${styles.filterDropdownItemActive}` : ""}`}
                onClick={() => {
                  setManagerFilter("none");
                  setOpenFilterColumn(null);
                }}
              >
                미배정
              </div>
              {uniqueManagers.map((m) => (
                <div
                  key={m}
                  className={`${styles.filterDropdownItem}${managerFilter === m ? ` ${styles.filterDropdownItemActive}` : ""}`}
                  onClick={() => {
                    setManagerFilter(m);
                    setOpenFilterColumn(null);
                  }}
                >
                  {m}
                </div>
              ))}
            </>
          )}
          {openFilterColumn === "status" && (
            <>
              <div
                className={`${styles.filterDropdownItem}${statusFilter === "all" ? ` ${styles.filterDropdownItemActive}` : ""}`}
                onClick={() => {
                  setStatusFilter("all");
                  setOpenFilterColumn(null);
                }}
              >
                전체
              </div>
              {AGENCY_STATUS_OPTIONS.map((s) => (
                <div
                  key={s}
                  className={`${styles.filterDropdownItem}${statusFilter === s ? ` ${styles.filterDropdownItemActive}` : ""}`}
                  onClick={() => {
                    setStatusFilter(s as AgencyStatus);
                    setOpenFilterColumn(null);
                  }}
                >
                  {s}
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* 셀 편집 모달 */}
      {fieldModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setFieldModal(null);
          }}
          className={styles.modalOverlay}
        >
          <div className={styles.fieldModalBox}>
            <h3 className={styles.fieldModalTitle}>{fieldModal.label} 수정</h3>
            {/* 담당자는 기존 담당자 chip 선택 제공 */}
            {fieldModal.field === "manager" && uniqueManagers.length > 0 && (
              <div className={styles.fieldModalChipRow}>
                {uniqueManagers.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() =>
                      setFieldModal((prev) =>
                        prev
                          ? { ...prev, value: prev.value === m ? "" : m }
                          : prev,
                      )
                    }
                    className={
                      fieldModal.value === m
                        ? styles.tagBtnChipActive
                        : styles.tagBtnChip
                    }
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
            {fieldModal.multiline ? (
              <textarea
                value={fieldModal.value}
                onChange={(e) =>
                  setFieldModal((prev) =>
                    prev ? { ...prev, value: e.target.value } : prev,
                  )
                }
                rows={4}
                autoFocus
                placeholder={`${fieldModal.label} 입력`}
                className={`${styles.textarea} ${styles.fieldModalInput}`}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setFieldModal(null);
                }}
              />
            ) : (
              <input
                value={fieldModal.value}
                onChange={(e) =>
                  setFieldModal((prev) =>
                    prev ? { ...prev, value: e.target.value } : prev,
                  )
                }
                autoFocus
                placeholder={`${fieldModal.label} 입력`}
                className={`${styles.input} ${styles.fieldModalInput}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleFieldSave();
                  if (e.key === "Escape") setFieldModal(null);
                }}
              />
            )}
            <div className={styles.fieldModalBtnRow}>
              <button
                onClick={handleFieldSave}
                disabled={fieldSaving}
                className={`${styles.btnPrimary} ${styles.fieldModalBtnFlex}`}
              >
                {fieldSaving ? "저장 중..." : "저장"}
              </button>
              <button
                onClick={() => setFieldModal(null)}
                className={`${styles.btnSecondary} ${styles.fieldModalBtnFlex}`}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 추가/수정 모달 */}
      {showModal && (
        <AgencyAddModal
          editTarget={editTarget}
          onClose={() => {
            setShowModal(false);
            setEditTarget(null);
          }}
          onSaved={fetchData}
          uniqueManagers={uniqueManagers}
        />
      )}
      {deleteToastVisible && <div className={styles.toast}>삭제되었습니다</div>}
    </div>
  );
}

// ─── 탭: 일괄등록 ────────────────────────────────────────────────────────────

const HEADER_MAP: Record<string, keyof CsvRow> = {
  이름: "name",
  name: "name",
  연락처: "contact",
  contact: "contact",
  최종학력: "education",
  education: "education",
  과정분류: "major_category",
  major_category: "major_category",
  희망과정: "hope_course",
  hope_course: "hope_course",
  유입경로: "click_source",
  click_source: "click_source",
  상담사유: "reason",
  취득사유: "reason",
  reason: "reason",
  메모: "memo",
  memo: "memo",
  상태: "status",
  status: "status",
  담당자: "manager",
  manager: "manager",
  거주지: "residence",
  residence: "residence",
  상담체크: "counsel_check",
  고민: "counsel_check",
  취소사유: "counsel_check",
  counsel_check: "counsel_check",
  과목비용: "subject_cost",
  subject_cost: "subject_cost",
  신청일시: "applied_at",
  applied_at: "applied_at",
};

const CONSULT_TEMPLATE = [
  "\uFEFF대분류,중분류,이름,연락처,최종학력,희망과정,취득사유,과목비용,담당자,거주지,메모,고민,신청일시,상태",
  "네이버,네이버카페,홍길동,010-1234-5678,대학교 재학,사회복지사,취업 때문에,580000,김담당,서울 강동구,,타기관,2026-03-01,상담대기",
  "맘카페,순광맘,김영희,010-2345-6789,고등학교 졸업,평생교육사,자격증 취득,450000,이담당,경기 수원시,오전 연락 요망,,2026-03-03,상담대기",
  "",
].join("\n");

const CERT_TEMPLATE = [
  "\uFEFF대분류,중분류,이름,연락처,희망과정,취득사유,과목비용,담당자,거주지,메모,고민,신청일시",
  "네이버,네이버카페,홍길동,010-1234-5678,생활지원사1급,취업 목적,280000,김담당,서울 강동구,,타기관,2026-03-01",
  "맘카페,순광맘,김영희,010-2345-6789,아동미술지도사1급,부업 준비,240000,이담당,경기 수원시,오전 연락,,가격비교,2026-03-03",
  "",
].join("\n");

function parseCsvLine(line: string): string[] {
  const cols: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      cols.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  cols.push(current.trim());
  return cols;
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((h) => h.replace(/^\uFEFF/, ""));
  const majorIdx = headers.findIndex((h) => h === "대분류");
  const minorIdx = headers.findIndex((h) => h === "중분류");
  const colMap = headers
    .map((h, i) => ({ field: HEADER_MAP[h], idx: i }))
    .filter(({ field, idx }) => field && idx !== majorIdx && idx !== minorIdx);
  return lines
    .slice(1)
    .map((line) => {
      const cols = parseCsvLine(line);
      if (cols.every((c) => !c)) return null;
      const row: CsvRow = {
        name: "",
        contact: "",
        education: "",
        major_category: "",
        hope_course: "",
        click_source: "",
        reason: "",
        memo: "",
        status: "",
        manager: "",
        residence: "",
        counsel_check: "",
        subject_cost: "",
        applied_at: "",
      };
      colMap.forEach(({ field, idx }) => {
        if (cols[idx] !== undefined) row[field] = cols[idx];
      });
      const major = majorIdx !== -1 ? (cols[majorIdx] ?? "") : "";
      const minor = minorIdx !== -1 ? (cols[minorIdx] ?? "") : "";
      if (!row.click_source) {
        if (major && minor) row.click_source = `${major}_${minor}`;
        else if (major) row.click_source = major;
      }
      if (!row.status) row.status = "상담대기";
      return row;
    })
    .filter(Boolean) as CsvRow[];
}

function toCostInt(v: string | null | undefined): number | null {
  if (!v) return null;
  const n = parseInt(String(v).replace(/[^0-9]/g, ""));
  return isNaN(n) ? null : n;
}

type BulkUploadType = RowType | "agency";

function BulkTab({ onMoveSuccess }: { onMoveSuccess?: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<BulkTabView>("upload");
  const [uploadType, setUploadType] = useState<BulkUploadType>("consult");
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [agencyRows, setAgencyRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState("");
  const [saving, setSaving] = useState(false);
  const [staging, setStaging] = useState<StagingRow[]>([]);
  const [stagingLoading, setStagingLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [typeFilter, setTypeFilter] = useState<RowType | "all">("all");
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    fetchStaging();
  }, []);

  async function fetchStaging() {
    setStagingLoading(true);
    const res = await fetch("/api/bulk");
    if (res.ok) setStaging(await res.json());
    setStagingLoading(false);
  }

  function handleFile(file: File) {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (uploadType === "agency") {
        setAgencyRows(parseAgencyCsv(text));
      } else {
        setCsvRows(parseCsv(text));
      }
    };
    reader.readAsText(file, "utf-8");
  }

  async function handleSaveToStaging() {
    if (!csvRows.length) return;
    setSaving(true);
    const rows = csvRows.map((r) => ({
      row_type: uploadType,
      name: r.name,
      contact: r.contact,
      education: uploadType === "consult" ? r.education || null : null,
      major_category: uploadType === "cert" ? r.major_category || null : null,
      hope_course: r.hope_course || null,
      click_source: r.click_source || null,
      reason: r.reason || null,
      memo: r.memo || null,
      status: r.status || "상담대기",
      manager: r.manager || null,
      residence: r.residence || null,
      counsel_check: r.counsel_check || null,
      subject_cost: toCostInt(r.subject_cost),
      applied_at: r.applied_at || null,
    }));
    const res = await fetch("/api/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    });
    if (res.ok) {
      setCsvRows([]);
      setFileName("");
      await fetchStaging();
      setView("staging");
    } else {
      const body = await res.json().catch(() => ({}) as { error?: string });
      alert(`임시 저장 실패: ${body.error ?? res.status}`);
    }
    setSaving(false);
  }

  async function handleMove() {
    if (!selectedIds.length) return;
    const targets = staging.filter((s) => selectedIds.includes(s.id));
    const consultTargets = targets.filter((t) => t.row_type === "consult");
    const certTargets = targets.filter((t) => t.row_type === "cert");
    setMoving(true);
    let ok = true;
    let errMsg = "";

    if (consultTargets.length) {
      const res = await fetch("/api/hakjeom/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: consultTargets }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        errMsg = body.error || `학점은행제 이동 실패 (${res.status})`;
        ok = false;
      }
    }
    if (ok && certTargets.length) {
      const res = await fetch("/api/hakjeom/private-cert/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: certTargets }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        errMsg = body.error || `민간자격증 이동 실패 (${res.status})`;
        ok = false;
      }
    }
    if (ok) {
      await fetch("/api/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });
      setSelectedIds([]);
      await fetchStaging();
      onMoveSuccess?.();
    } else {
      alert(`이동 실패: ${errMsg}`);
    }
    setMoving(false);
  }

  async function handleDeleteSelected() {
    if (
      !selectedIds.length ||
      !confirm(`${selectedIds.length}건을 삭제할까요?`)
    )
      return;
    await fetch("/api/bulk", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selectedIds }),
    });
    setSelectedIds([]);
    await fetchStaging();
  }

  function downloadTemplate() {
    const content =
      uploadType === "agency"
        ? AGENCY_CSV_TEMPLATE
        : uploadType === "consult"
          ? CONSULT_TEMPLATE
          : CERT_TEMPLATE;
    const name =
      uploadType === "agency"
        ? "기관협약_CSV템플릿.csv"
        : uploadType === "consult"
          ? "학점은행제_CSV템플릿.csv"
          : "민간자격증_CSV템플릿.csv";
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleAgencySave() {
    if (!agencyRows.length) return;
    setSaving(true);
    const res = await fetch("/api/hakjeom/agency/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: agencyRows }),
    });
    if (res.ok) {
      const { count } = await res.json();
      setAgencyRows([]);
      setFileName("");
      alert(`${count}건이 등록되었습니다.`);
    } else {
      const d = await res.json();
      alert(d.error || "등록에 실패했습니다.");
    }
    setSaving(false);
  }

  const filteredStaging =
    typeFilter === "all"
      ? staging
      : staging.filter((s) => s.row_type === typeFilter);
  const consultCount = staging.filter((s) => s.row_type === "consult").length;
  const certCount = staging.filter((s) => s.row_type === "cert").length;
  const allFilteredSelected =
    filteredStaging.length > 0 &&
    filteredStaging.every((s) => selectedIds.includes(s.id));

  function formatDt(d: string) {
    const dt = new Date(d);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")} ${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
  }

  const CONSULT_PREVIEW_COLS: (keyof CsvRow)[] = [
    "click_source",
    "name",
    "contact",
    "education",
    "hope_course",
    "reason",
    "subject_cost",
    "manager",
    "residence",
    "counsel_check",
    "applied_at",
    "status",
  ];
  const CERT_PREVIEW_COLS: (keyof CsvRow)[] = [
    "click_source",
    "name",
    "contact",
    "hope_course",
    "reason",
    "subject_cost",
    "manager",
    "residence",
    "counsel_check",
    "applied_at",
  ];
  const CONSULT_HEADERS = [
    "유입경로",
    "이름",
    "연락처",
    "최종학력",
    "희망과정",
    "취득사유",
    "과목비용",
    "담당자",
    "거주지",
    "취소사유",
    "신청일시",
    "상태",
  ];
  const CERT_HEADERS = [
    "유입경로",
    "이름",
    "연락처",
    "희망과정",
    "취득사유",
    "과목비용",
    "담당자",
    "거주지",
    "취소사유",
    "신청일시",
  ];

  const previewCols =
    uploadType === "consult" ? CONSULT_PREVIEW_COLS : CERT_PREVIEW_COLS;
  const previewHeaders =
    uploadType === "consult" ? CONSULT_HEADERS : CERT_HEADERS;

  return (
    <div className={styles.bulkWrap}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />

      {/* 탭 헤더 */}
      <div className={styles.bulkTabBar}>
        <button
          onClick={() => setView("upload")}
          className={`${styles.bulkTabBtn} ${view === "upload" ? styles.bulkTabBtnActive : ""}`}
        >
          CSV 업로드
        </button>
        <button
          onClick={() => setView("staging")}
          className={`${styles.bulkTabBtn} ${view === "staging" ? styles.bulkTabBtnActive : ""}`}
        >
          임시 저장 ({staging.length})
        </button>
        {view === "upload" && (
          <button onClick={downloadTemplate} className={styles.bulkTemplateBtn}>
            ↓ 템플릿 다운로드
          </button>
        )}
      </div>

      {/* ── 업로드 탭 ── */}
      {view === "upload" && (
        <div className={styles.bulkUploadArea}>
          {/* 구분 선택 */}
          <div className={styles.bulkTypeRow}>
            {(["consult", "cert", "agency"] as BulkUploadType[]).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setUploadType(t);
                  setCsvRows([]);
                  setAgencyRows([]);
                  setFileName("");
                }}
                className={`${styles.bulkTypeBtn} ${uploadType === t ? styles.bulkTypeBtnActive : ""}`}
              >
                {t === "consult"
                  ? "학점은행제"
                  : t === "cert"
                    ? "민간자격증"
                    : "기관협약"}
              </button>
            ))}
          </div>

          {/* 드롭존 */}
          {!csvRows.length && !agencyRows.length && (
            <div
              className={styles.bulkDropzone}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) handleFile(f);
              }}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
            >
              <span className={styles.bulkDropzoneIcon}>📂</span>
              <p className={styles.bulkDropzoneTitle}>
                {uploadType === "consult"
                  ? "학점은행제"
                  : uploadType === "cert"
                    ? "민간자격증"
                    : "기관협약"}{" "}
                CSV 파일 업로드
              </p>
              <p className={styles.bulkDropzoneSub}>
                파일을 드래그하거나 클릭해서 선택하세요
              </p>
            </div>
          )}

          {/* 미리보기 */}
          {/* 기관협약 미리보기 */}
          {agencyRows.length > 0 && (
            <div className={styles.bulkPreviewCard}>
              <div className={styles.bulkPreviewHeader}>
                <div>
                  <span className={styles.bulkPreviewTitle}>미리보기</span>
                  <span className={styles.bulkPreviewMeta}>
                    {fileName} · {agencyRows.length}건
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => {
                      setAgencyRows([]);
                      setFileName("");
                    }}
                    className={styles.btnSecondary}
                  >
                    취소
                  </button>
                  <button
                    onClick={handleAgencySave}
                    disabled={saving}
                    className={styles.btnPrimary}
                  >
                    {saving ? "등록 중..." : `${agencyRows.length}건 등록`}
                  </button>
                </div>
              </div>
              <div className={styles.bulkPreviewTableWrap}>
                <table className={styles.bulkTable}>
                  <thead>
                    <tr className={styles.bulkThead}>
                      <th className={styles.th}>#</th>
                      {[
                        "기관명",
                        "분류",
                        "지역",
                        "연락처",
                        "학점수수료",
                        "민간수수료",
                        "담당자",
                        "상태",
                      ].map((h) => (
                        <th key={h} className={styles.th}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {agencyRows.map((row, i) => (
                      <tr key={i} className={styles.tr}>
                        <td
                          className={styles.td}
                          style={{ color: "#aaa", textAlign: "center" }}
                        >
                          {i + 1}
                        </td>
                        <td className={styles.td}>
                          {row.institution_name || (
                            <span className={styles.tdMuted}>-</span>
                          )}
                        </td>
                        <td className={styles.td}>
                          {row.category || (
                            <span className={styles.tdMuted}>-</span>
                          )}
                        </td>
                        <td className={styles.td}>
                          {row.address || (
                            <span className={styles.tdMuted}>-</span>
                          )}
                        </td>
                        <td className={styles.td}>
                          {row.contact || (
                            <span className={styles.tdMuted}>-</span>
                          )}
                        </td>
                        <td className={styles.td}>
                          {row.credit_commission || (
                            <span className={styles.tdMuted}>-</span>
                          )}
                        </td>
                        <td className={styles.td}>
                          {row.private_commission || (
                            <span className={styles.tdMuted}>-</span>
                          )}
                        </td>
                        <td className={styles.td}>
                          {row.manager || (
                            <span className={styles.tdMuted}>-</span>
                          )}
                        </td>
                        <td className={styles.td}>
                          {row.status || "협약대기"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {csvRows.length > 0 && (
            <div className={styles.bulkPreviewCard}>
              <div className={styles.bulkPreviewHeader}>
                <div>
                  <span className={styles.bulkPreviewTitle}>미리보기</span>
                  <span className={styles.bulkPreviewMeta}>
                    {fileName} · {csvRows.length}건
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => {
                      setCsvRows([]);
                      setFileName("");
                    }}
                    className={styles.btnSecondary}
                  >
                    취소
                  </button>
                  <button
                    onClick={handleSaveToStaging}
                    disabled={saving}
                    className={styles.btnPrimary}
                  >
                    {saving ? "저장 중..." : `${csvRows.length}건 임시 저장`}
                  </button>
                </div>
              </div>
              <div className={styles.bulkPreviewTableWrap}>
                <table className={styles.bulkTable}>
                  <thead>
                    <tr className={styles.bulkThead}>
                      <th className={styles.th}>#</th>
                      {previewHeaders.map((h) => (
                        <th key={h} className={styles.th}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvRows.map((row, i) => (
                      <tr key={i} className={styles.tr}>
                        <td
                          className={styles.td}
                          style={{ color: "#aaa", textAlign: "center" }}
                        >
                          {i + 1}
                        </td>
                        {previewCols.map((col, j) => (
                          <td key={j} className={styles.td}>
                            {row[col] || (
                              <span className={styles.tdMuted}>-</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 컬럼 안내 */}
          <div className={styles.bulkGuideBox}>
            <p className={styles.bulkGuideTitle}>컬럼 안내</p>
            <div className={styles.bulkGuideGrid}>
              {(uploadType === "agency"
                ? [
                    { col: "기관명*", desc: "필수" },
                    { col: "분류", desc: "어린이집, 유치원 등" },
                    { col: "지역", desc: "서울 강동구 등" },
                    { col: "연락처", desc: "전화번호" },
                    { col: "학점수수료", desc: "10% 등 자유 입력" },
                    { col: "민간수수료", desc: "15% 등 자유 입력" },
                    { col: "담당자", desc: "담당자 이름" },
                    { col: "메모", desc: "자유 입력" },
                    { col: "상태", desc: "비우면 협약대기" },
                  ]
                : uploadType === "consult"
                  ? [
                      { col: "대분류", desc: "네이버, 맘카페, 당근 등" },
                      { col: "중분류", desc: "→ 유입경로 자동 조합" },
                      { col: "이름*", desc: "필수" },
                      { col: "연락처*", desc: "필수, 010-0000-0000" },
                      { col: "최종학력", desc: "고등학교 졸업 등" },
                      { col: "희망과정", desc: "사회복지사, 보육교사 등" },
                      { col: "취득사유", desc: "자유 입력" },
                      { col: "과목비용", desc: "숫자 (콤마 포함 가능)" },
                      { col: "담당자", desc: "담당자 이름" },
                      { col: "거주지", desc: "지역명" },
                      { col: "메모", desc: "자유 입력" },
                      { col: "취소사유", desc: "비용, 주변반대 등" },
                      { col: "신청일시", desc: "비우면 현재 시간" },
                      { col: "상태", desc: "비우면 상담대기" },
                    ]
                  : [
                      { col: "대분류", desc: "네이버, 맘카페, 당근 등" },
                      { col: "중분류", desc: "→ 유입경로 자동 조합" },
                      { col: "이름*", desc: "필수" },
                      { col: "연락처*", desc: "필수, 010-0000-0000" },
                      {
                        col: "희망과정",
                        desc: "바리스타1급, 심리상담사1급 등",
                      },
                      { col: "취득사유", desc: "자유 입력" },
                      { col: "과목비용", desc: "숫자" },
                      { col: "담당자", desc: "담당자 이름" },
                      { col: "거주지", desc: "지역명" },
                      { col: "메모", desc: "자유 입력" },
                      { col: "취소사유", desc: "비용, 주변반대 등" },
                      { col: "신청일시", desc: "비우면 현재 시간" },
                    ]
              ).map(({ col, desc }) => (
                <div key={col} className={styles.bulkGuideItem}>
                  <span className={styles.bulkGuideCol}>{col}</span>
                  <span className={styles.bulkGuideDesc}>{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── 임시 저장 탭 ── */}
      {view === "staging" && (
        <div className={styles.bulkStagingArea}>
          <div className={styles.bulkStagingToolbar}>
            <CustomSelect
              value={typeFilter}
              onChange={(v) => setTypeFilter(v as RowType | "all")}
              style={{ minWidth: 140 }}
              options={[
                { value: "all", label: `전체 (${staging.length})` },
                { value: "consult", label: `학점은행제 (${consultCount})` },
                { value: "cert", label: `민간자격증 (${certCount})` },
              ]}
            />
            <div style={{ flex: 1 }} />
            {selectedIds.length > 0 && (
              <>
                <span className={styles.bulkSelectedCount}>
                  {selectedIds.length}건 선택
                </span>
                <button
                  onClick={handleMove}
                  disabled={moving}
                  className={styles.btnPrimary}
                >
                  {moving ? "이동 중..." : "상담 목록으로 이동 →"}
                </button>
                <button
                  onClick={handleDeleteSelected}
                  className={styles.btnDanger}
                >
                  삭제
                </button>
                <button
                  onClick={() => setSelectedIds([])}
                  className={styles.btnSecondary}
                >
                  해제
                </button>
              </>
            )}
          </div>

          {stagingLoading && (
            <div className={styles.bulkEmptyState}>로딩 중...</div>
          )}
          {!stagingLoading && !staging.length && (
            <div className={styles.bulkEmptyState}>
              <span className={styles.bulkEmptyIcon}>📭</span>
              <p>임시 저장된 데이터가 없습니다</p>
              <p className={styles.bulkEmptySub}>
                CSV 업로드 탭에서 파일을 업로드해 주세요
              </p>
            </div>
          )}
          {!stagingLoading && staging.length > 0 && (
            <div className={styles.tableCard}>
              <div style={{ overflowX: "auto" }}>
                <table className={styles.bulkTable}>
                  <thead>
                    <tr className={styles.bulkThead}>
                      <th className={styles.th} style={{ width: 40 }}>
                        <input
                          type="checkbox"
                          checked={allFilteredSelected}
                          onChange={() => {
                            const ids = filteredStaging.map((s) => s.id);
                            setSelectedIds(
                              allFilteredSelected
                                ? selectedIds.filter((id) => !ids.includes(id))
                                : [...new Set([...selectedIds, ...ids])],
                            );
                          }}
                        />
                      </th>
                      <th className={styles.th}>구분</th>
                      <th className={styles.th}>이름</th>
                      <th className={styles.th}>연락처</th>
                      <th className={styles.th}>학력/과정분류</th>
                      <th className={styles.th}>희망과정</th>
                      <th className={styles.th}>유입경로</th>
                      <th className={styles.th}>상태</th>
                      <th className={styles.th}>담당자</th>
                      <th className={styles.th}>저장일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStaging.length === 0 ? (
                      <tr>
                        <td
                          colSpan={10}
                          className={styles.tdMuted}
                          style={{ textAlign: "center", padding: "40px 20px" }}
                        >
                          데이터 없음
                        </td>
                      </tr>
                    ) : (
                      filteredStaging.map((row) => (
                        <tr
                          key={row.id}
                          className={`${styles.tr} ${selectedIds.includes(row.id) ? styles.trSelected : ""}`}
                        >
                          <td
                            className={styles.td}
                            style={{ textAlign: "center" }}
                          >
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(row.id)}
                              onChange={() =>
                                setSelectedIds((prev) =>
                                  prev.includes(row.id)
                                    ? prev.filter((x) => x !== row.id)
                                    : [...prev, row.id],
                                )
                              }
                            />
                          </td>
                          <td className={styles.td}>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "1px 7px",
                                borderRadius: 4,
                                fontSize: 11,
                                fontWeight: 600,
                                background:
                                  row.row_type === "consult"
                                    ? "#EBF3FE"
                                    : "#F5F0FF",
                                color:
                                  row.row_type === "consult"
                                    ? "#3182F6"
                                    : "#7C3AED",
                              }}
                            >
                              {row.row_type === "consult"
                                ? "학점은행제"
                                : "민간자격증"}
                            </span>
                          </td>
                          <td className={styles.td} style={{ fontWeight: 600 }}>
                            {row.name}
                          </td>
                          <td className={styles.td}>{row.contact}</td>
                          <td className={styles.td}>
                            {row.education || row.major_category || (
                              <span className={styles.tdMuted}>-</span>
                            )}
                          </td>
                          <td className={styles.td}>
                            {row.hope_course || (
                              <span className={styles.tdMuted}>-</span>
                            )}
                          </td>
                          <td className={styles.td}>
                            {row.click_source || (
                              <span className={styles.tdMuted}>-</span>
                            )}
                          </td>
                          <td className={styles.td}>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "1px 7px",
                                borderRadius: 4,
                                fontSize: 11,
                                fontWeight: 600,
                                background: "#DCFCE7",
                                color: "#16A34A",
                              }}
                            >
                              {row.status}
                            </span>
                          </td>
                          <td className={styles.td}>
                            {row.manager || (
                              <span className={styles.tdMuted}>-</span>
                            )}
                          </td>
                          <td
                            className={styles.td}
                            style={{ color: "#8b95a1", fontSize: 12 }}
                          >
                            {formatDt(row.created_at)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 탭: 통계 ────────────────────────────────────────────────────────────────

// 통계용 축약 타입 (API에서 필요한 필드만 사용)
interface StatItem {
  id: number;
  status: ConsultationStatus;
  click_source: string | null;
  hope_course: string | null;
  counsel_check: string | null;
  manager: string | null;
  created_at: string;
  counsel_completed_at: string | null;
  registered_at: string | null;
  last_counsel_level: string | null;
  education?: string | null;
  reason?: string | null;
  reaction_point?: string | null;
  manager_assigned_at?: string | null;
  consult_started_at?: string | null;
}

type StatsSource = "hakjeom";
type StatsSubTab =
  | "overview"
  | "funnel"
  | "conversion"
  | "manager"
  | "status"
  | "long-prospect"
  | "source"
  | "combo"
  | "assign"
  | "time"
  | "mamcafe";

// 통계 상수
const STATS_STATUS_COLORS: Record<string, string> = {
  "부재중/추후통화": "#94a3b8",
  상담대기: "#3b82f6",
  "상담완료-높음": "#0ea5e9",
  "상담완료-중간": "#eab308",
  "상담완료-낮음": "#f43f5e",
  장기가망: "#8b5cf6",
  등록완료: "#22c55e",
  수신거부: "#dc2626",
  지인등록: "#EA580C",
  지인취소: "#B91C1C",
  지인대기: "#D97706",
  기타: "#059669",
};
const STATS_STATUS_LIST: ConsultationStatus[] = [
  "부재중/추후통화",
  "상담대기",
  "상담완료-높음",
  "상담완료-중간",
  "상담완료-낮음",
  "장기가망",
  "등록완료",
  "수신거부",
  "지인등록",
  "지인취소",
  "지인대기",
  "기타",
];
const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];
const SOURCE_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#64748b",
];

const SOURCE_LABELS: { id: StatsSource; label: string }[] = [
  { id: "hakjeom", label: "학점은행제" },
];

const STATS_SUB_TABS: { id: StatsSubTab; label: string }[] = [
  { id: "overview", label: "개요" },
  { id: "funnel", label: "전환 분석" },
  { id: "conversion", label: "등록 전환 추적" },
  { id: "manager", label: "담당자별" },
  { id: "status", label: "상태 분석" },
  { id: "long-prospect", label: "장기가망" },
  { id: "source", label: "유입 경로" },
  { id: "combo", label: "조합 분석" },
  { id: "assign", label: "담당자 배정 추천" },
  { id: "time", label: "시간 패턴" },
  { id: "mamcafe", label: "맘카페" },
];

const LONG_PROSPECT_REASONS = [
  "비용",
  "주변반대",
  "시간부족",
  "의지부족",
  "타교육원",
  "연락두절",
  "개인사정",
  "당장 불필요",
  "기타",
] as const;

const LONG_PROSPECT_COLORS: Record<string, string> = {
  비용: "#ef4444",
  주변반대: "#f97316",
  시간부족: "#f59e0b",
  의지부족: "#eab308",
  타교육원: "#10b981",
  연락두절: "#6366f1",
  개인사정: "#8b5cf6",
  "당장 불필요": "#ec4899",
  기타: "#94a3b8",
  미입력: "#cbd5e1",
};

// 유틸
function toKST(dateStr: string): Date {
  const d = new Date(dateStr);
  d.setHours(d.getHours() + 9);
  return d;
}
function ym(d: Date): string {
  return d.toISOString().slice(0, 7);
}
function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}
// 인스타·페이스북 = 메타 (동일 광고 플랫폼) → "메타"로 통합
const META_CHANNEL_ALIASES = new Set([
  "메타",
  "meta",
  "인스타",
  "인스타그램",
  "페이스북",
  "페북",
  "인스타·페이스북",
  "인스타/페이스북",
  "페이스북·인스타",
  "인스타,페이스북",
]);

// 기타로 묶을 채널 (주부 등)
const ETC_CHANNEL_ALIASES = new Set(["주부"]);

function getMajorSrc(source: string | null): string {
  if (!source) return "바로폼";
  const s = source.startsWith("바로폼_") ? source.slice(4) : source;
  const i = s.indexOf("_");
  const major = i === -1 ? s : s.slice(0, i);
  const trimmed = major.trim();
  // 메타 계열 채널 통합
  if (META_CHANNEL_ALIASES.has(trimmed)) return "메타";
  // 주부 등 → 기타
  if (ETC_CHANNEL_ALIASES.has(trimmed)) return "기타";
  return major;
}

// 공통 Tooltip
const StatsTip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name?: string; value: number }[];
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className={styles.statsTip}>
      {label && <div className={styles.statsTipLabel}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className={styles.statsTipValue}>
          {p.name ? (
            <span className={styles.statsTipName}>{p.name} </span>
          ) : null}
          {p.value}건
        </div>
      ))}
    </div>
  );
};

// 요약 카드
function StatsCard({
  label,
  value,
  sub,
  color,
  badge,
  badgeColor,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  badge?: string;
  badgeColor?: string;
}) {
  return (
    <div className={styles.statsCard}>
      <div className={styles.statsCardHeader}>
        <span className={styles.statsCardLabel}>{label}</span>
        {badge && (
          <span
            className={styles.statsCardBadge}
            style={{
              color: badgeColor || "#22c55e",
              background: (badgeColor || "#22c55e") + "15",
            }}
          >
            {badge}
          </span>
        )}
      </div>
      <div
        className={styles.statsCardValue}
        style={{ color: color || "#191f28" }}
      >
        {value}
      </div>
      {sub && <div className={styles.statsCardSub}>{sub}</div>}
    </div>
  );
}

// 패널 래퍼
function StatsPanel({
  title,
  sub,
  children,
  style,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  // marginBottom: 16 이 있는 경우와 없는 경우를 구분해서 처리
  const hasMb16 = style && "marginBottom" in style && style.marginBottom === 16;
  return (
    <div
      className={hasMb16 ? styles.statsPanelMb16 : styles.statsPanel}
      style={hasMb16 ? undefined : style}
    >
      <div className={styles.statsPanelHeader}>
        <div className={styles.statsPanelTitle}>{title}</div>
        {sub && <div className={styles.statsPanelSub}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}

function StatsTab() {
  const [data, setData] = useState<StatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<StatsSource>("hakjeom");
  const [subTab, setSubTab] = useState<StatsSubTab>("overview");

  // 소스 토글 슬라이딩 pill
  const srcRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const srcBarRef = useRef<HTMLDivElement>(null);
  const [srcPill, setSrcPill] = useState<{
    left: number;
    width: number;
  } | null>(null);

  // 소스 변경 시 데이터 fetch
  useEffect(() => {
    setLoading(true);
    fetch(`/api/hakjeom/stats?type=${source}`)
      .then((r) => r.json())
      .then((d) => setData(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, [source]);

  // pill 위치 계산
  useEffect(() => {
    const idx = SOURCE_LABELS.findIndex((s) => s.id === source);
    const el = srcRefs.current[idx];
    const bar = srcBarRef.current;
    if (!el || !bar) return;
    const barRect = bar.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    setSrcPill({ left: elRect.left - barRect.left, width: elRect.width });
  }, [source, loading]);

  // ── 기준 날짜
  const now = toKST(new Date().toISOString());
  const thisMonthKey = ym(now);
  const prevM = new Date(now);
  prevM.setMonth(prevM.getMonth() - 1);
  const prevMonthKey = ym(prevM);

  // ── 개요 집계
  const total = data.length;
  const thisMonth = data.filter(
    (c) => c.created_at.slice(0, 7) === thisMonthKey,
  ).length;
  const prevMonth = data.filter(
    (c) => c.created_at.slice(0, 7) === prevMonthKey,
  ).length;
  const growth =
    prevMonth > 0
      ? Math.round(((thisMonth - prevMonth) / prevMonth) * 100)
      : null;
  const ago30 = new Date(now);
  ago30.setDate(ago30.getDate() - 29);
  ago30.setHours(0, 0, 0, 0);
  const recent30 = data.filter((c) => new Date(c.created_at) >= ago30).length;
  const registered = data.filter((c) => c.status === "등록완료").length;
  const regRate = total > 0 ? Math.round((registered / total) * 100) : 0;
  const waiting = data.filter((c) => c.status === "상담대기").length;

  // ── 월별 데이터 (최근 6개월)
  const monthlyData = (() => {
    const sixAgo = new Date(now);
    sixAgo.setDate(1);
    sixAgo.setMonth(sixAgo.getMonth() - 5);
    const sixAgoYm = ym(sixAgo);
    let startYm: string;
    if (data.length > 0) {
      const earliest = data.reduce(
        (min, c) => (c.created_at < min ? c.created_at : min),
        data[0].created_at,
      );
      const earliestYm = earliest.slice(0, 7);
      startYm = earliestYm > sixAgoYm ? earliestYm : sixAgoYm;
    } else {
      startYm = thisMonthKey;
    }
    const months: { month: string; 신규: number; 등록: number }[] = [];
    const cur = new Date(startYm + "-01T00:00:00");
    while (ym(cur) <= thisMonthKey) {
      const key = ym(cur);
      const list = data.filter((c) => c.created_at.slice(0, 7) === key);
      months.push({
        month: key.slice(5) + "월",
        신규: list.length,
        등록: list.filter((c) => c.status === "등록완료").length,
      });
      cur.setMonth(cur.getMonth() + 1);
    }
    return months;
  })();
  const monthlySub =
    monthlyData.length >= 6
      ? "최근 6개월"
      : monthlyData.length > 1
        ? `최근 ${monthlyData.length}개월`
        : "이번달";

  // ── 일별 30일
  const dailyData = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (29 - i));
    const key = ymd(d);
    return {
      date: key.slice(5),
      count: data.filter((c) => c.created_at.slice(0, 10) === key).length,
    };
  });

  // ── 상태별 집계
  const statusData = STATS_STATUS_LIST.map((s) => ({
    name: s,
    value: data.filter((c) => c.status === s).length,
    fill: STATS_STATUS_COLORS[s],
  }));

  // ── 유입경로
  const srcMap: Record<string, number> = {};
  data.forEach((c) => {
    const m = getMajorSrc(c.click_source);
    srcMap[m] = (srcMap[m] || 0) + 1;
  });
  const srcData = Object.entries(srcMap)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }));

  // ── 맘카페 세부 통계
  const mamcafeMap: Record<string, number> = {};
  data
    .filter((c) => getMajorSrc(c.click_source) === "맘카페")
    .forEach((c) => {
      const { minor } = parseClickSource(c.click_source);
      const key = minor || "미입력";
      mamcafeMap[key] = (mamcafeMap[key] || 0) + 1;
    });
  const mamcafeData = Object.entries(mamcafeMap)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }));
  const mamcafeTotal = mamcafeData.reduce((s, d) => s + d.value, 0);

  // ── 시간대
  const hourData = Array.from({ length: 24 }, (_, h) => ({
    hour: String(h).padStart(2, "0"),
    count: data.filter((c) => toKST(c.created_at).getHours() === h).length,
  }));
  const peakCount =
    hourData.length > 0 ? Math.max(...hourData.map((d) => d.count)) : 0;
  const peaks = hourData.filter((d) => d.count === peakCount && peakCount > 0);

  // ── 요일별
  const weekData = WEEKDAY_KO.map((day, i) => ({
    day,
    count: data.filter((c) => toKST(c.created_at).getDay() === i).length,
  }));
  const maxWeekCount =
    weekData.length > 0 ? Math.max(...weekData.map((d) => d.count)) : 0;

  // ── 전환 깔때기 (문의 → 상담완료 → 등록완료)
  const consultedSet = new Set<ConsultationStatus>([
    "상담완료-높음",
    "상담완료-중간",
    "상담완료-낮음",
    "장기가망",
    "등록완료",
    "수신거부",
    "지인등록",
    "지인취소",
    "지인대기",
  ]);
  const funnelStages = [
    { stage: "문의 접수", count: total, color: "#3b82f6" },
    {
      stage: "상담 완료",
      count: data.filter((c) => consultedSet.has(c.status)).length,
      color: "#0ea5e9",
    },
    { stage: "등록 완료", count: registered, color: "#22c55e" },
  ];
  const consultRate =
    total > 0 ? Math.round((funnelStages[1].count / total) * 100) : 0;
  const finalRegRate =
    funnelStages[1].count > 0
      ? Math.round((registered / funnelStages[1].count) * 100)
      : 0;

  // ── 담당자별 성과
  const managerStats: {
    name: string;
    total: number;
    registered: number;
    rate: number;
    respCount: number;
    avgResponseMin: number | null;
  }[] = (() => {
    const acc: Record<
      string,
      { total: number; registered: number; respSum: number; respCnt: number }
    > = {};
    data.forEach((c) => {
      const m = (c.manager ?? "").trim() || "미배정";
      if (!acc[m]) acc[m] = { total: 0, registered: 0, respSum: 0, respCnt: 0 };
      acc[m].total += 1;
      if (c.status === "등록완료") acc[m].registered += 1;
      if (c.manager_assigned_at && c.consult_started_at) {
        const ms =
          new Date(c.consult_started_at).getTime() -
          new Date(c.manager_assigned_at).getTime();
        if (Number.isFinite(ms) && ms >= 0) {
          acc[m].respSum += ms / 60000;
          acc[m].respCnt += 1;
        }
      }
    });
    return Object.entries(acc)
      .map(([name, v]) => ({
        name,
        total: v.total,
        registered: v.registered,
        rate: v.total > 0 ? Math.round((v.registered / v.total) * 100) : 0,
        respCount: v.respCnt,
        avgResponseMin: v.respCnt ? Math.round(v.respSum / v.respCnt) : null,
      }))
      .sort((a, b) => b.total - a.total);
  })();
  const topManager = managerStats
    .filter((m) => m.name !== "미배정" && m.total >= 5)
    .sort((a, b) => b.rate - a.rate)[0];

  // ── 유입경로별 등록률
  const channelStats: {
    name: string;
    total: number;
    registered: number;
    rate: number;
  }[] = (() => {
    const acc: Record<string, { total: number; registered: number }> = {};
    data.forEach((c) => {
      const m = getMajorSrc(c.click_source);
      if (!acc[m]) acc[m] = { total: 0, registered: 0 };
      acc[m].total += 1;
      if (c.status === "등록완료") acc[m].registered += 1;
    });
    return Object.entries(acc)
      .map(([name, v]) => ({
        name,
        total: v.total,
        registered: v.registered,
        rate: v.total > 0 ? Math.round((v.registered / v.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  })();

  // ── 담당자 × 유입경로 매트릭스 (등록률 + 건수)
  //    매니저 행 × 채널 열로 cross-tab — 등록 패턴 파악용
  const managerChannelMatrix: {
    managers: string[]; // 행 (등록률 평균 데스크탑 순)
    channels: string[]; // 열 (전체 건수 많은 순)
    cells: Record<string, Record<string, { total: number; registered: number; rate: number }>>;
  } = (() => {
    // 미배정 / 지인소개 제외 (실적 평가 대상 아님)
    const PERSONAL_MARKETING_KEY = "지인소개";
    const validRows = data.filter((c) => {
      const mgr = (c.manager ?? "").trim();
      if (!mgr) return false;
      const ch = getMajorSrc(c.click_source);
      if (ch === PERSONAL_MARKETING_KEY) return false;
      return true;
    });

    const cellAcc: Record<
      string,
      Record<string, { total: number; registered: number }>
    > = {};
    const mgrTotals: Record<string, number> = {};
    const chTotals: Record<string, number> = {};

    validRows.forEach((c) => {
      const mgr = (c.manager ?? "").trim();
      const ch = getMajorSrc(c.click_source);
      if (!cellAcc[mgr]) cellAcc[mgr] = {};
      if (!cellAcc[mgr][ch]) cellAcc[mgr][ch] = { total: 0, registered: 0 };
      cellAcc[mgr][ch].total += 1;
      if (c.status === "등록완료") cellAcc[mgr][ch].registered += 1;
      mgrTotals[mgr] = (mgrTotals[mgr] ?? 0) + 1;
      chTotals[ch] = (chTotals[ch] ?? 0) + 1;
    });

    const managers = Object.keys(mgrTotals).sort(
      (a, b) => mgrTotals[b] - mgrTotals[a],
    );
    const channels = Object.keys(chTotals).sort(
      (a, b) => chTotals[b] - chTotals[a],
    );

    const cells: Record<
      string,
      Record<string, { total: number; registered: number; rate: number }>
    > = {};
    managers.forEach((mgr) => {
      cells[mgr] = {};
      channels.forEach((ch) => {
        const v = cellAcc[mgr]?.[ch];
        if (v) {
          cells[mgr][ch] = {
            total: v.total,
            registered: v.registered,
            rate:
              v.total > 0 ? Math.round((v.registered / v.total) * 100) : 0,
          };
        }
      });
    });
    return { managers, channels, cells };
  })();

  // ── 등록 전환 추적 (상담완료 → 등록완료/지인등록까지 소요시간 + 등급별)
  const COUNSEL_LEVELS: ConsultationStatus[] = [
    "상담완료-높음",
    "상담완료-중간",
    "상담완료-낮음",
  ];
  // 현재 상담완료 단계에 머물러있는 건수 (등급별)
  const currentlyAtCounselLevel = COUNSEL_LEVELS.map((level) => ({
    level,
    count: data.filter((c) => c.status === level).length,
  }));
  const totalAtCounsel = currentlyAtCounselLevel.reduce(
    (s, v) => s + v.count,
    0,
  );

  // 등급별 등록 전환 분석 (last_counsel_level 활용)
  const conversionByLevel = COUNSEL_LEVELS.map((level) => {
    // 현재 이 등급에 머물러 있는 건수
    const stillAtLevel = data.filter((c) => c.status === level).length;
    // 이 등급을 거쳐서 등록 완료된 건수 (last_counsel_level 매칭)
    const registeredFromLevel = data.filter(
      (c) =>
        (c.status === "등록완료" || c.status === "지인등록") &&
        c.last_counsel_level === level,
    );
    const total = stillAtLevel + registeredFromLevel.length;
    const rate =
      total > 0 ? Math.round((registeredFromLevel.length / total) * 100) : 0;
    // 평균 소요일
    const durations: number[] = registeredFromLevel
      .filter((c) => c.counsel_completed_at && c.registered_at)
      .map((c) => {
        const start = new Date(c.counsel_completed_at!).getTime();
        const end = new Date(c.registered_at!).getTime();
        return Math.round((end - start) / (1000 * 60 * 60 * 24));
      })
      .filter((d) => d >= 0);
    const avgDays =
      durations.length > 0
        ? Math.round(
            (durations.reduce((s, v) => s + v, 0) / durations.length) * 10,
          ) / 10
        : null;
    return {
      level,
      stillAtLevel,
      registered: registeredFromLevel.length,
      total,
      rate,
      avgDays,
    };
  });

  // 전체 등록 전환된 건의 소요일 (분포 표시용)
  const registeredDurations: number[] = [];
  data.forEach((c) => {
    if (
      (c.status === "등록완료" || c.status === "지인등록") &&
      c.counsel_completed_at &&
      c.registered_at
    ) {
      const start = new Date(c.counsel_completed_at).getTime();
      const end = new Date(c.registered_at).getTime();
      if (end > start) {
        registeredDurations.push(
          Math.round((end - start) / (1000 * 60 * 60 * 24)),
        );
      }
    }
  });
  const totalRegisteredWithCounsel = registeredDurations.length;
  const avgDays =
    totalRegisteredWithCounsel > 0
      ? Math.round(
          (registeredDurations.reduce((s, v) => s + v, 0) /
            totalRegisteredWithCounsel) *
            10,
        ) / 10
      : 0;
  const sortedDurations = [...registeredDurations].sort((a, b) => a - b);
  const medianDays =
    sortedDurations.length > 0
      ? sortedDurations[Math.floor(sortedDurations.length / 2)]
      : 0;
  const durationBuckets = [
    { label: "당일~1일", max: 1, count: 0 },
    { label: "2~3일", max: 3, count: 0 },
    { label: "4~7일", max: 7, count: 0 },
    { label: "8~14일", max: 14, count: 0 },
    { label: "15~30일", max: 30, count: 0 },
    { label: "30일+", max: Infinity, count: 0 },
  ];
  registeredDurations.forEach((d) => {
    for (const b of durationBuckets) {
      if (d <= b.max) {
        b.count += 1;
        break;
      }
    }
  });

  // ── 장기가망 사유 분석
  const longProspectItems = data.filter((c) => c.status === "장기가망");
  const longProspectTotal = longProspectItems.length;
  // counsel_check은 ", "로 join된 텍스트. 기타(자유입력)는 "기타"로 그룹핑
  const reasonCounts: Record<string, number> = {};
  for (const r of LONG_PROSPECT_REASONS) reasonCounts[r] = 0;
  let longProspectNoReason = 0;
  longProspectItems.forEach((c) => {
    const raw = c.counsel_check;
    if (!raw || !raw.trim()) {
      longProspectNoReason += 1;
      return;
    }
    const items = raw
      .split(", ")
      .map((s) => s.trim())
      .filter(Boolean);
    if (items.length === 0) {
      longProspectNoReason += 1;
      return;
    }
    const normalized = new Set<string>();
    items.forEach((s) => {
      if (s.startsWith("기타(") && s.endsWith(")")) normalized.add("기타");
      else if (LONG_PROSPECT_REASONS.includes(s as (typeof LONG_PROSPECT_REASONS)[number])) {
        normalized.add(s);
      }
    });
    normalized.forEach((n) => {
      reasonCounts[n] = (reasonCounts[n] ?? 0) + 1;
    });
  });
  const longProspectReasonData = [
    ...LONG_PROSPECT_REASONS.map((r) => ({
      name: r,
      value: reasonCounts[r] ?? 0,
      fill: LONG_PROSPECT_COLORS[r],
    })),
    {
      name: "미입력",
      value: longProspectNoReason,
      fill: LONG_PROSPECT_COLORS["미입력"],
    },
  ];
  const longProspectTopReason = [...longProspectReasonData]
    .filter((d) => d.name !== "미입력")
    .sort((a, b) => b.value - a.value)[0];
  // 기타 사유 자유입력 모음 (상위 표시)
  const longProspectEtcNotes: string[] = [];
  longProspectItems.forEach((c) => {
    const raw = c.counsel_check;
    if (!raw) return;
    raw.split(", ").forEach((s) => {
      const t = s.trim();
      if (t.startsWith("기타(") && t.endsWith(")")) {
        const note = t.slice(3, -1).trim();
        if (note) longProspectEtcNotes.push(note);
      }
    });
  });
  // 장기가망 중 등록완료로 전환된 케이스는 별도 추적 필요 — last_counsel_level이 장기가망인 등록자
  // (현재 데이터 모델상 last_counsel_level은 상담완료-* 위주라 정확한 측정은 어렵지만 참고용)
  const longProspectConverted = data.filter(
    (c) =>
      (c.status === "등록완료" || c.status === "지인등록") &&
      c.last_counsel_level === "장기가망",
  ).length;

  return (
    <div className={styles.statsContainer}>
      {/* 소스 토글 */}
      <div className={styles.statsSourceToggleWrap}>
        <div ref={srcBarRef} className={styles.statsSourceBar}>
          {srcPill && (
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: srcPill.left,
                width: srcPill.width,
                height: "100%",
                background: "rgba(2,32,71,0.08)",
                borderRadius: 32,
                transition:
                  "left 0.22s cubic-bezier(0.4,0,0.2,1), width 0.22s cubic-bezier(0.4,0,0.2,1)",
                zIndex: 0,
              }}
            />
          )}
          {SOURCE_LABELS.map((s, i) => (
            <button
              key={s.id}
              ref={(el) => {
                srcRefs.current[i] = el;
              }}
              onClick={() => setSource(s.id)}
              className={styles.statsSourceBtn}
              style={{
                fontWeight: source === s.id ? 700 : 500,
                color: source === s.id ? "#191f28" : "#8b95a1",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* 서브탭 */}
      <div className={styles.statsSubTabBar}>
        {STATS_SUB_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={styles.statsSubTabBtn}
            style={{
              borderBottom:
                subTab === t.id ? "2px solid #191f28" : "2px solid transparent",
              marginBottom: -1,
              fontWeight: subTab === t.id ? 700 : 400,
              color: subTab === t.id ? "#191f28" : "#8b95a1",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <>
          <StatsCardsSkeleton count={5} />
          <ChartsGridSkeleton />
        </>
      ) : (
        <>
          {/* ════ 개요 ════ */}
          {subTab === "overview" && (
            <div>
              <div className={styles.statsGrid5}>
                <StatsCard
                  label="전체 신청"
                  value={total.toLocaleString()}
                  sub="누적 전체"
                />
                <StatsCard
                  label="이번달 신규"
                  value={thisMonth}
                  sub={`전월 ${prevMonth}건`}
                  badge={
                    growth !== null
                      ? `${growth >= 0 ? "+" : ""}${growth}%`
                      : undefined
                  }
                  badgeColor={
                    growth !== null && growth >= 0 ? "#22c55e" : "#f04452"
                  }
                />
                <StatsCard
                  label="최근 30일"
                  value={recent30}
                  sub="오늘 포함 30일"
                  color="#6366f1"
                />
                <StatsCard
                  label="등록완료"
                  value={registered}
                  sub={`전환율 ${regRate}%`}
                  color="#22c55e"
                  badge={`${regRate}%`}
                  badgeColor="#22c55e"
                />
                <StatsCard
                  label="상담 대기중"
                  value={waiting}
                  sub="미처리 건수"
                  color={waiting > 20 ? "#f04452" : "#f59e0b"}
                />
              </div>

              <StatsPanel
                title="월별 신규 신청 vs 등록완료"
                sub={monthlySub}
                style={{ marginBottom: 16 }}
              >
                <ResponsiveContainer width="100%" height={220}>
                  <ComposedChart
                    data={monthlyData}
                    margin={{ top: 4, right: 16, bottom: 0, left: -16 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#f0f0f0"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 12, fill: "#94a3b8" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#94a3b8" }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip content={<StatsTip />} />
                    <Bar
                      dataKey="신규"
                      fill="#93C5FD"
                      radius={[4, 4, 0, 0]}
                      barSize={28}
                      name="신규"
                    />
                    <Bar
                      dataKey="등록"
                      fill="#3B82F6"
                      radius={[4, 4, 0, 0]}
                      barSize={28}
                      name="등록완료"
                    />
                    <Line
                      type="monotone"
                      dataKey="신규"
                      stroke="#3B82F6"
                      strokeWidth={2}
                      dot={{ fill: "#3B82F6", r: 3 }}
                      name="신규 추세"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
                <div className={styles.statsLegend}>
                  {(
                    [
                      ["#93C5FD", "신규 신청"],
                      ["#3B82F6", "등록완료"],
                      ["#3B82F6", "신규 추세"],
                    ] as [string, string][]
                  ).map(([c, l]) => (
                    <div key={l} className={styles.statsLegendItem}>
                      <div
                        className={styles.statsLegendDot}
                        style={{ background: c }}
                      />
                      {l}
                    </div>
                  ))}
                </div>
              </StatsPanel>

              <StatsPanel title="일별 신규 상담" sub="최근 30일">
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart
                    data={dailyData}
                    margin={{ top: 4, right: 8, bottom: 0, left: -20 }}
                  >
                    <defs>
                      <linearGradient
                        id="statsGrad30"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#3B82F6"
                          stopOpacity={0.18}
                        />
                        <stop
                          offset="95%"
                          stopColor="#3B82F6"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#f0f0f0"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
                      tickLine={false}
                      axisLine={false}
                      interval={4}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip content={<StatsTip />} />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="#3B82F6"
                      strokeWidth={2}
                      fill="url(#statsGrad30)"
                      dot={false}
                      activeDot={{ r: 4, fill: "#3B82F6" }}
                      name="신규"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </StatsPanel>
            </div>
          )}

          {/* ════ 전환 분석 ════ */}
          {subTab === "funnel" && (
            <div>
              {/* 전환 KPI */}
              <div className={styles.statsGrid4}>
                <StatsCard
                  label="문의 접수"
                  value={total.toLocaleString()}
                  sub="누적"
                  color="#3b82f6"
                />
                <StatsCard
                  label="문의 → 상담"
                  value={`${consultRate}%`}
                  sub={`${funnelStages[1].count}건 상담완료`}
                  color="#0ea5e9"
                />
                <StatsCard
                  label="상담 → 등록"
                  value={`${finalRegRate}%`}
                  sub={`${registered}건 등록`}
                  color="#22c55e"
                />
                <StatsCard
                  label="전체 등록률"
                  value={`${regRate}%`}
                  sub={`${total}건 중 ${registered}건`}
                  color="#16a34a"
                />
              </div>

              {/* 깔때기 차트 (가로 막대) */}
              <StatsPanel title="전환률" sub="문의 → 상담 → 등록 단계별 전환">
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                    padding: "8px 4px",
                  }}
                >
                  {funnelStages.map((s, i) => {
                    const max = funnelStages[0].count || 1;
                    const widthPct = Math.max((s.count / max) * 100, 6);
                    const prevCount = i > 0 ? funnelStages[i - 1].count : null;
                    const stageRate =
                      prevCount && prevCount > 0
                        ? Math.round((s.count / prevCount) * 100)
                        : null;
                    return (
                      <div key={s.stage}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 6,
                            fontSize: 13,
                          }}
                        >
                          <span style={{ fontWeight: 600, color: "#191f28" }}>
                            {s.stage}
                          </span>
                          <span
                            style={{
                              color: "#4e5968",
                              display: "flex",
                              gap: 12,
                            }}
                          >
                            <strong style={{ color: "#191f28" }}>
                              {s.count.toLocaleString()}건
                            </strong>
                            {stageRate !== null && (
                              <span
                                style={{
                                  color:
                                    stageRate >= 50
                                      ? "#16a34a"
                                      : stageRate >= 25
                                        ? "#ca8a04"
                                        : "#dc2626",
                                }}
                              >
                                전 단계 대비 {stageRate}%
                              </span>
                            )}
                          </span>
                        </div>
                        <div
                          style={{
                            height: 36,
                            background: "#f3f4f6",
                            borderRadius: 8,
                            overflow: "hidden",
                            position: "relative",
                          }}
                        >
                          <div
                            style={{
                              width: `${widthPct}%`,
                              height: "100%",
                              background: `linear-gradient(90deg, ${s.color}, ${s.color}dd)`,
                              borderRadius: 8,
                              transition: "width 0.6s ease",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </StatsPanel>
            </div>
          )}

          {/* ════ 등록 전환 추적 ════ */}
          {subTab === "conversion" && (
            <div>
              <div className={styles.statsGrid4}>
                <StatsCard
                  label="현재 상담완료 단계"
                  value={totalAtCounsel}
                  sub="등록 대기 중"
                  color="#0ea5e9"
                />
                <StatsCard
                  label="추적된 등록 전환"
                  value={totalRegisteredWithCounsel}
                  sub="상담완료→등록 기록"
                  color="#22c55e"
                />
                <StatsCard
                  label="평균 소요일"
                  value={`${avgDays}일`}
                  sub={
                    totalRegisteredWithCounsel > 0
                      ? "상담완료 후 등록까지"
                      : "데이터 부족"
                  }
                  color="#f59e0b"
                />
                <StatsCard
                  label="중앙값"
                  value={`${medianDays}일`}
                  sub={
                    totalRegisteredWithCounsel > 0
                      ? "절반의 학생이 이 기간 내 등록"
                      : "데이터 부족"
                  }
                  color="#8b5cf6"
                />
              </div>

              <StatsPanel
                title="등급별 등록 전환율"
                sub="각 상담완료 등급에서 등록완료까지 가는 비율"
              >
                <div style={{ padding: "8px 4px" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 13,
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          background: "#f8fafc",
                          borderBottom: "1px solid #e2e8f0",
                        }}
                      >
                        <th
                          style={{
                            padding: "10px 12px",
                            textAlign: "left",
                            fontWeight: 600,
                            color: "#475569",
                          }}
                        >
                          상담완료 등급
                        </th>
                        <th
                          style={{
                            padding: "10px 12px",
                            textAlign: "center",
                            fontWeight: 600,
                            color: "#475569",
                          }}
                        >
                          현재 머무름
                        </th>
                        <th
                          style={{
                            padding: "10px 12px",
                            textAlign: "center",
                            fontWeight: 600,
                            color: "#16a34a",
                          }}
                        >
                          등록 완료
                        </th>
                        <th
                          style={{
                            padding: "10px 12px",
                            textAlign: "center",
                            fontWeight: 600,
                            color: "#475569",
                          }}
                        >
                          합계
                        </th>
                        <th
                          style={{
                            padding: "10px 12px",
                            textAlign: "center",
                            fontWeight: 600,
                            color: "#475569",
                            minWidth: 160,
                          }}
                        >
                          전환율
                        </th>
                        <th
                          style={{
                            padding: "10px 12px",
                            textAlign: "right",
                            fontWeight: 600,
                            color: "#475569",
                          }}
                        >
                          평균 소요일
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {conversionByLevel.map(
                        ({
                          level,
                          stillAtLevel,
                          registered,
                          total,
                          rate,
                          avgDays,
                        }) => {
                          const color =
                            level === "상담완료-높음"
                              ? "#16a34a"
                              : level === "상담완료-중간"
                                ? "#ca8a04"
                                : "#dc2626";
                          return (
                            <tr
                              key={level}
                              style={{ borderBottom: "1px solid #f1f5f9" }}
                            >
                              <td
                                style={{
                                  padding: "12px 12px",
                                  fontWeight: 600,
                                  color,
                                }}
                              >
                                {level}
                              </td>
                              <td
                                style={{
                                  padding: "12px 12px",
                                  textAlign: "center",
                                  color: "#475569",
                                }}
                              >
                                {stillAtLevel}
                              </td>
                              <td
                                style={{
                                  padding: "12px 12px",
                                  textAlign: "center",
                                  color: "#16a34a",
                                  fontWeight: 700,
                                }}
                              >
                                {registered}
                              </td>
                              <td
                                style={{
                                  padding: "12px 12px",
                                  textAlign: "center",
                                  color: "#191f28",
                                  fontWeight: 600,
                                }}
                              >
                                {total}
                              </td>
                              <td style={{ padding: "12px 12px" }}>
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 10,
                                  }}
                                >
                                  <div
                                    style={{
                                      flex: 1,
                                      height: 8,
                                      background: "#f1f5f9",
                                      borderRadius: 4,
                                      overflow: "hidden",
                                    }}
                                  >
                                    <div
                                      style={{
                                        width: `${Math.min(rate, 100)}%`,
                                        height: "100%",
                                        background:
                                          rate >= 30
                                            ? "#16a34a"
                                            : rate >= 15
                                              ? "#22c55e"
                                              : rate >= 5
                                                ? "#84cc16"
                                                : "#cbd5e1",
                                        transition: "width 0.4s ease",
                                      }}
                                    />
                                  </div>
                                  <span
                                    style={{
                                      minWidth: 40,
                                      textAlign: "right",
                                      fontWeight: 600,
                                      color: "#191f28",
                                    }}
                                  >
                                    {rate}%
                                  </span>
                                </div>
                              </td>
                              <td
                                style={{
                                  padding: "12px 12px",
                                  textAlign: "right",
                                  color: "#475569",
                                }}
                              >
                                {avgDays !== null ? `${avgDays}일` : "-"}
                              </td>
                            </tr>
                          );
                        },
                      )}
                    </tbody>
                  </table>
                </div>
              </StatsPanel>

              <StatsPanel
                title="상담완료 → 등록완료 소요 시간 분포"
                sub={
                  totalRegisteredWithCounsel > 0
                    ? `${totalRegisteredWithCounsel}건 분석`
                    : "데이터 수집 중 (등록완료된 건만 표시)"
                }
              >
                {totalRegisteredWithCounsel === 0 ? (
                  <div
                    style={{
                      padding: "40px 16px",
                      textAlign: "center",
                      color: "#94a3b8",
                      fontSize: 13,
                    }}
                  >
                    아직 추적 가능한 데이터가 없습니다.
                    <br />
                    상담완료(높음/중간/낮음) → 등록완료로 변경된 건수가 쌓이면
                    분포가 표시됩니다.
                  </div>
                ) : (
                  <div style={{ padding: "8px 4px" }}>
                    {durationBuckets.map((b) => {
                      const pct =
                        totalRegisteredWithCounsel > 0
                          ? Math.round(
                              (b.count / totalRegisteredWithCounsel) * 100,
                            )
                          : 0;
                      return (
                        <div key={b.label} style={{ marginBottom: 10 }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              marginBottom: 4,
                              fontSize: 13,
                            }}
                          >
                            <span style={{ fontWeight: 600, color: "#191f28" }}>
                              {b.label}
                            </span>
                            <span style={{ color: "#4e5968" }}>
                              <strong style={{ color: "#191f28" }}>
                                {b.count}건
                              </strong>{" "}
                              ({pct}%)
                            </span>
                          </div>
                          <div
                            style={{
                              height: 8,
                              background: "#f1f5f9",
                              borderRadius: 4,
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                width: `${pct}%`,
                                height: "100%",
                                background:
                                  "linear-gradient(90deg, #3b82f6, #22c55e)",
                                borderRadius: 4,
                                transition: "width 0.4s ease",
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </StatsPanel>
            </div>
          )}

          {/* ════ 담당자별 ════ */}
          {subTab === "manager" && (
            <div>
              <div className={styles.statsGrid4}>
                <StatsCard
                  label="총 담당자"
                  value={managerStats.filter((m) => m.name !== "미배정").length}
                  sub="배정된 담당자 수"
                  color="#3b82f6"
                />
                <StatsCard
                  label="평균 등록률"
                  value={
                    managerStats.length > 0
                      ? `${Math.round(managerStats.filter((m) => m.name !== "미배정").reduce((s, m) => s + m.rate, 0) / Math.max(managerStats.filter((m) => m.name !== "미배정").length, 1))}%`
                      : "0%"
                  }
                  sub="배정 담당자 평균"
                  color="#22c55e"
                />
                <StatsCard
                  label="최고 성과"
                  value={topManager ? `${topManager.name}` : "-"}
                  sub={
                    topManager ? `등록률 ${topManager.rate}%` : "데이터 부족"
                  }
                  color="#f59e0b"
                />
                <StatsCard
                  label="미배정"
                  value={
                    managerStats.find((m) => m.name === "미배정")?.total ?? 0
                  }
                  sub="담당자 미지정 건수"
                  color="#94a3b8"
                />
              </div>

              <StatsPanel
                title="담당자별 처리 건수 · 평균 응답시간 · 등록률"
                sub="배정 건수, 평균 응답시간(배정→상담시작), 등록률을 함께 비교"
              >
                {managerStats.length === 0 ? (
                  <div
                    style={{
                      padding: 40,
                      textAlign: "center",
                      color: "#94a3b8",
                    }}
                  >
                    데이터 없음
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: 13,
                      }}
                    >
                      <thead>
                        <tr
                          style={{
                            background: "#f8fafc",
                            borderBottom: "1px solid #e2e8f0",
                          }}
                        >
                          <th
                            style={{
                              padding: "10px 12px",
                              textAlign: "left",
                              fontWeight: 600,
                              color: "#475569",
                            }}
                          >
                            담당자
                          </th>
                          <th
                            style={{
                              padding: "10px 12px",
                              textAlign: "center",
                              fontWeight: 600,
                              color: "#475569",
                            }}
                          >
                            배정
                          </th>
                          <th
                            style={{
                              padding: "10px 12px",
                              textAlign: "center",
                              fontWeight: 600,
                              color: "#475569",
                            }}
                          >
                            등록
                          </th>
                          <th
                            style={{
                              padding: "10px 12px",
                              textAlign: "center",
                              fontWeight: 600,
                              color: "#475569",
                            }}
                          >
                            평균 응답시간
                          </th>
                          <th
                            style={{
                              padding: "10px 12px",
                              textAlign: "center",
                              fontWeight: 600,
                              color: "#475569",
                              minWidth: 200,
                            }}
                          >
                            등록률
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {managerStats.map((m) => (
                          <tr
                            key={m.name}
                            style={{ borderBottom: "1px solid #f1f5f9" }}
                          >
                            <td
                              style={{
                                padding: "10px 12px",
                                fontWeight: 600,
                                color:
                                  m.name === "미배정" ? "#94a3b8" : "#191f28",
                              }}
                            >
                              {m.name}
                            </td>
                            <td
                              style={{
                                padding: "10px 12px",
                                textAlign: "center",
                                color: "#475569",
                              }}
                            >
                              {m.total.toLocaleString()}
                            </td>
                            <td
                              style={{
                                padding: "10px 12px",
                                textAlign: "center",
                                color: "#16a34a",
                                fontWeight: 600,
                              }}
                            >
                              {m.registered.toLocaleString()}
                            </td>
                            <td
                              style={{
                                padding: "10px 12px",
                                textAlign: "center",
                                color: "#475569",
                                fontWeight: 600,
                              }}
                            >
                              {formatMinutes(m.avgResponseMin)}
                            </td>
                            <td style={{ padding: "10px 12px" }}>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 10,
                                }}
                              >
                                <div
                                  style={{
                                    flex: 1,
                                    height: 8,
                                    background: "#f1f5f9",
                                    borderRadius: 4,
                                    overflow: "hidden",
                                  }}
                                >
                                  <div
                                    style={{
                                      width: `${Math.min(m.rate, 100)}%`,
                                      height: "100%",
                                      background:
                                        m.rate >= 30
                                          ? "#16a34a"
                                          : m.rate >= 15
                                            ? "#22c55e"
                                            : m.rate >= 5
                                              ? "#84cc16"
                                              : "#cbd5e1",
                                      transition: "width 0.4s ease",
                                    }}
                                  />
                                </div>
                                <span
                                  style={{
                                    minWidth: 40,
                                    textAlign: "right",
                                    fontWeight: 600,
                                    color: "#191f28",
                                  }}
                                >
                                  {m.rate}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </StatsPanel>

              {/* ── 담당자 × 유입경로 매트릭스 — 등록 패턴 파악 */}
              <StatsPanel
                title="담당자 × 유입경로 등록률 매트릭스"
                sub="각 담당자가 어떤 유입경로에서 얼마나 등록 전환했는지 (지인소개 제외)"
              >
                {managerChannelMatrix.managers.length === 0 ||
                managerChannelMatrix.channels.length === 0 ? (
                  <div
                    style={{
                      padding: 40,
                      textAlign: "center",
                      color: "#94a3b8",
                    }}
                  >
                    데이터 없음
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: 13,
                      }}
                    >
                      <thead>
                        <tr
                          style={{
                            background: "#f8fafc",
                            borderBottom: "1px solid #e2e8f0",
                          }}
                        >
                          <th
                            style={{
                              padding: "10px 12px",
                              textAlign: "left",
                              fontWeight: 700,
                              color: "#475569",
                              position: "sticky",
                              left: 0,
                              background: "#f8fafc",
                              zIndex: 1,
                            }}
                          >
                            담당자
                          </th>
                          {managerChannelMatrix.channels.map((ch) => (
                            <th
                              key={ch}
                              style={{
                                padding: "10px 12px",
                                textAlign: "center",
                                fontWeight: 700,
                                color: "#475569",
                                minWidth: 90,
                              }}
                            >
                              {ch === "meta" ? "메타" : ch}
                            </th>
                          ))}
                          <th
                            style={{
                              padding: "10px 12px",
                              textAlign: "center",
                              fontWeight: 700,
                              color: "#475569",
                              minWidth: 90,
                              background: "#eef2ff",
                            }}
                          >
                            전체
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {managerChannelMatrix.managers.map((mgr) => {
                          const row = managerChannelMatrix.cells[mgr];
                          // 행 전체 총합 / 등록 / 등록률
                          const rowTotal = managerChannelMatrix.channels.reduce(
                            (s, ch) => s + (row[ch]?.total ?? 0),
                            0,
                          );
                          const rowReg = managerChannelMatrix.channels.reduce(
                            (s, ch) => s + (row[ch]?.registered ?? 0),
                            0,
                          );
                          const rowRate =
                            rowTotal > 0
                              ? Math.round((rowReg / rowTotal) * 100)
                              : 0;
                          return (
                            <tr
                              key={mgr}
                              style={{ borderBottom: "1px solid #f1f5f9" }}
                            >
                              <td
                                style={{
                                  padding: "10px 12px",
                                  fontWeight: 700,
                                  color: "#1e293b",
                                  position: "sticky",
                                  left: 0,
                                  background: "#fff",
                                  zIndex: 1,
                                }}
                              >
                                {mgr}
                              </td>
                              {managerChannelMatrix.channels.map((ch) => {
                                const cell = row[ch];
                                if (!cell || cell.total === 0) {
                                  return (
                                    <td
                                      key={ch}
                                      style={{
                                        padding: "10px 12px",
                                        textAlign: "center",
                                        color: "#cbd5e1",
                                      }}
                                    >
                                      —
                                    </td>
                                  );
                                }
                                // 등록률 따라 셀 배경색 강도 (히트맵)
                                const intensity = Math.min(cell.rate / 30, 1); // 30% 만점
                                const bg = `rgba(37, 99, 235, ${0.05 + intensity * 0.18})`;
                                return (
                                  <td
                                    key={ch}
                                    style={{
                                      padding: "10px 12px",
                                      textAlign: "center",
                                      background: bg,
                                    }}
                                  >
                                    <div
                                      style={{
                                        fontWeight: 700,
                                        color:
                                          cell.rate >= 15
                                            ? "#1d4ed8"
                                            : "#475569",
                                        fontSize: 14,
                                      }}
                                    >
                                      {cell.rate}%
                                    </div>
                                    <div
                                      style={{
                                        fontSize: 11,
                                        color: "#94a3b8",
                                        marginTop: 2,
                                      }}
                                    >
                                      {cell.registered}/{cell.total}
                                    </div>
                                  </td>
                                );
                              })}
                              <td
                                style={{
                                  padding: "10px 12px",
                                  textAlign: "center",
                                  background: "#eef2ff",
                                  fontWeight: 700,
                                  color: "#1e293b",
                                }}
                              >
                                <div style={{ fontSize: 14 }}>{rowRate}%</div>
                                <div
                                  style={{
                                    fontSize: 11,
                                    color: "#64748b",
                                    fontWeight: 500,
                                    marginTop: 2,
                                  }}
                                >
                                  {rowReg}/{rowTotal}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <div
                      style={{
                        marginTop: 10,
                        fontSize: 12,
                        color: "#94a3b8",
                        textAlign: "right",
                      }}
                    >
                      셀 색이 진할수록 등록률 높음 · 표기 = 등록률 % (등록/전체)
                    </div>
                  </div>
                )}
              </StatsPanel>
            </div>
          )}

          {/* ════ 상태 분석 ════ */}
          {subTab === "status" && (
            <div>
              <div className={styles.statsGrid5}>
                {statusData.map((d) => (
                  <StatsCard
                    key={d.name}
                    label={d.name}
                    value={d.value}
                    sub={
                      total > 0
                        ? `전체의 ${Math.round((d.value / total) * 100)}%`
                        : "-"
                    }
                    color={d.fill}
                  />
                ))}
              </div>

              <div className={styles.statsGridStatusDetail}>
                <StatsPanel title="상태 분포">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={52}
                        outerRadius={84}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {statusData.map((d, i) => (
                          <Cell key={i} fill={d.fill} />
                        ))}
                      </Pie>
                      <Tooltip content={<StatsTip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className={styles.statsStatusLegend}>
                    {statusData.map((d) => (
                      <div
                        key={d.name}
                        className={styles.statsStatusLegendItem}
                      >
                        <div
                          className={styles.statsStatusLegendDot}
                          style={{ background: d.fill }}
                        />
                        <span className={styles.statsStatusLegendName}>
                          {d.name}
                        </span>
                        <span className={styles.statsStatusLegendCount}>
                          {d.value}건
                        </span>
                        <span className={styles.statsStatusLegendPct}>
                          ({total > 0 ? Math.round((d.value / total) * 100) : 0}
                          %)
                        </span>
                      </div>
                    ))}
                  </div>
                </StatsPanel>

                <StatsPanel title="전환 퍼널" sub="신청 → 등록 흐름">
                  <div className={styles.funnelList}>
                    {statusData.map((d) => {
                      const pct = total > 0 ? (d.value / total) * 100 : 0;
                      return (
                        <div key={d.name} className={styles.funnelItem}>
                          <div className={styles.funnelItemHeader}>
                            <span className={styles.funnelItemName}>
                              {d.name}
                            </span>
                            <span className={styles.funnelItemStat}>
                              {d.value}건 ({Math.round(pct)}%)
                            </span>
                          </div>
                          <div className={styles.funnelBarTrack}>
                            <div
                              className={styles.funnelBarInner}
                              style={{ width: `${pct}%`, background: d.fill }}
                            >
                              {pct > 8 && (
                                <span className={styles.funnelBarLabel}>
                                  {d.value}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className={styles.funnelConversionBox}>
                    <div className={styles.funnelConversionTitle}>
                      등록 전환율
                    </div>
                    <div className={styles.funnelConversionRate}>
                      {regRate}%
                    </div>
                    <div className={styles.funnelConversionSub}>
                      전체 {total}건 중 {registered}건 등록완료
                    </div>
                  </div>
                </StatsPanel>
              </div>
            </div>
          )}

          {/* ════ 장기가망 사유 분석 ════ */}
          {subTab === "long-prospect" && (
            <div>
              <div className={styles.statsGrid4}>
                <StatsCard
                  label="장기가망 전체"
                  value={longProspectTotal.toLocaleString()}
                  sub={`전체의 ${total > 0 ? Math.round((longProspectTotal / total) * 100) : 0}%`}
                  color="#8b5cf6"
                />
                <StatsCard
                  label="가장 많은 사유"
                  value={longProspectTopReason?.value ? longProspectTopReason.name : "-"}
                  sub={
                    longProspectTopReason && longProspectTopReason.value > 0
                      ? `${longProspectTopReason.value}건 (${longProspectTotal > 0 ? Math.round((longProspectTopReason.value / longProspectTotal) * 100) : 0}%)`
                      : "데이터 없음"
                  }
                  color={
                    longProspectTopReason
                      ? LONG_PROSPECT_COLORS[longProspectTopReason.name]
                      : "#94a3b8"
                  }
                />
                <StatsCard
                  label="사유 미입력"
                  value={longProspectNoReason}
                  sub={
                    longProspectTotal > 0
                      ? `장기가망의 ${Math.round((longProspectNoReason / longProspectTotal) * 100)}%`
                      : "-"
                  }
                  color="#cbd5e1"
                />
                <StatsCard
                  label="장기가망 → 등록"
                  value={longProspectConverted}
                  sub="last_counsel_level 기준 참고용"
                  color="#22c55e"
                />
              </div>

              <div className={styles.statsGridStatusDetail}>
                <StatsPanel
                  title="사유별 분포"
                  sub={`장기가망 ${longProspectTotal}건 기준 (복수 선택 가능)`}
                >
                  {longProspectTotal === 0 ? (
                    <div className={styles.longProspectEmpty}>
                      장기가망 상태의 상담 건이 없습니다.
                    </div>
                  ) : (
                    <>
                      <ResponsiveContainer
                        width="100%"
                        height={Math.max(220, longProspectReasonData.length * 36)}
                      >
                        <BarChart
                          data={longProspectReasonData}
                          layout="vertical"
                          margin={{ top: 4, right: 32, bottom: 0, left: 64 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#f0f0f0"
                            horizontal={false}
                          />
                          <XAxis
                            type="number"
                            tick={{ fontSize: 11, fill: "#94a3b8" }}
                            tickLine={false}
                            axisLine={false}
                            allowDecimals={false}
                          />
                          <YAxis
                            type="category"
                            dataKey="name"
                            tick={{ fontSize: 12, fill: "#4e5968" }}
                            tickLine={false}
                            axisLine={false}
                            width={64}
                          />
                          <Tooltip content={<StatsTip />} />
                          <Bar
                            dataKey="value"
                            radius={[0, 4, 4, 0]}
                            barSize={20}
                            name="건수"
                          >
                            {longProspectReasonData.map((d, i) => (
                              <Cell key={i} fill={d.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </>
                  )}
                </StatsPanel>

                <StatsPanel
                  title="사유별 상세"
                  sub="장기가망 건 중 해당 사유를 체크한 비율"
                >
                  <div className={styles.funnelList}>
                    {longProspectReasonData.map((d) => {
                      const pct =
                        longProspectTotal > 0
                          ? (d.value / longProspectTotal) * 100
                          : 0;
                      return (
                        <div key={d.name} className={styles.funnelItem}>
                          <div className={styles.funnelItemHeader}>
                            <span className={styles.funnelItemName}>
                              {d.name}
                            </span>
                            <span className={styles.funnelItemStat}>
                              {d.value}건 ({Math.round(pct)}%)
                            </span>
                          </div>
                          <div className={styles.funnelBarTrack}>
                            <div
                              className={styles.funnelBarInner}
                              style={{
                                width: `${pct}%`,
                                background: d.fill,
                              }}
                            >
                              {pct > 8 && (
                                <span className={styles.funnelBarLabel}>
                                  {d.value}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {longProspectEtcNotes.length > 0 && (
                    <div className={styles.longProspectEtcWrap}>
                      <div className={styles.longProspectEtcTitle}>
                        기타 사유 메모 ({longProspectEtcNotes.length}건)
                      </div>
                      <div className={styles.longProspectEtcList}>
                        {longProspectEtcNotes.slice(0, 20).map((note, i) => (
                          <div key={i} className={styles.longProspectEtcItem}>
                            • {note}
                          </div>
                        ))}
                        {longProspectEtcNotes.length > 20 && (
                          <div className={styles.longProspectEtcMore}>
                            … 외 {longProspectEtcNotes.length - 20}건
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </StatsPanel>
              </div>
            </div>
          )}

          {/* ════ 유입 경로 ════ */}
          {subTab === "source" && (
            <div>
              <div className={styles.statsGrid4}>
                {srcData.slice(0, 4).map((d, i) => (
                  <StatsCard
                    key={d.name}
                    label={d.name}
                    value={d.value}
                    sub={
                      total > 0
                        ? `전체의 ${Math.round((d.value / total) * 100)}%`
                        : "-"
                    }
                    color={SOURCE_COLORS[i]}
                  />
                ))}
              </div>

              <div className={styles.statsGridSourceDetail}>
                <StatsPanel title="유입 경로별 신청 건수" sub="대분류 기준">
                  <ResponsiveContainer
                    width="100%"
                    height={Math.max(200, srcData.length * 42)}
                  >
                    <BarChart
                      data={srcData}
                      layout="vertical"
                      margin={{ top: 4, right: 32, bottom: 0, left: 56 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#f0f0f0"
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 11, fill: "#94a3b8" }}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 12, fill: "#4e5968" }}
                        tickLine={false}
                        axisLine={false}
                        width={56}
                      />
                      <Tooltip content={<StatsTip />} />
                      <Bar
                        dataKey="value"
                        radius={[0, 4, 4, 0]}
                        barSize={22}
                        name="건수"
                      >
                        {srcData.map((_, i) => (
                          <Cell
                            key={i}
                            fill={SOURCE_COLORS[i % SOURCE_COLORS.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </StatsPanel>

                <StatsPanel title="비율">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={srcData}
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {srcData.map((_, i) => (
                          <Cell
                            key={i}
                            fill={SOURCE_COLORS[i % SOURCE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<StatsTip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className={styles.statsSrcLegend}>
                    {srcData.map((d, i) => (
                      <div key={d.name} className={styles.statsSrcLegendItem}>
                        <div
                          className={styles.statsSrcLegendDot}
                          style={{
                            background: SOURCE_COLORS[i % SOURCE_COLORS.length],
                          }}
                        />
                        <span className={styles.statsSrcLegendName}>
                          {d.name}
                        </span>
                        <span className={styles.statsSrcLegendCount}>
                          {d.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </StatsPanel>
              </div>
            </div>
          )}

          {/* ════ 조합 분석 ════ */}
          {subTab === "combo" && (
            <div>
              <StatsPanel
                title="유입경로 × 학력 × 취득사유 × 반응포인트 조합 분석"
                sub="축을 골라 조합별 등록률을 비교하고 잘 등록되는 타겟을 찾습니다"
              >
                <ComboExplorer data={data} />
              </StatsPanel>
            </div>
          )}

          {/* ════ 담당자 배정 추천 ════ */}
          {subTab === "assign" && (
            <div>
              <StatsPanel
                title="리드 유형별 담당자 배정 추천"
                sub="유형을 고르면 과거 등록률이 가장 높은 담당자를 추천합니다"
              >
                <ManagerMatcher data={data} />
              </StatsPanel>
            </div>
          )}

          {/* ════ 맘카페 ════ */}
          {subTab === "mamcafe" && (
            <div>
              <div className={styles.statsGrid4}>
                {mamcafeData.slice(0, 4).map((d, i) => (
                  <StatsCard
                    key={d.name}
                    label={d.name}
                    value={d.value}
                    sub={
                      mamcafeTotal > 0
                        ? `전체의 ${Math.round((d.value / mamcafeTotal) * 100)}%`
                        : "-"
                    }
                    color={SOURCE_COLORS[i]}
                  />
                ))}
              </div>

              {mamcafeData.length === 0 ? (
                <StatsPanel title="맘카페 세부 통계">
                  <p
                    style={{
                      textAlign: "center",
                      color: "#8b95a1",
                      padding: "32px 0",
                      fontSize: 14,
                    }}
                  >
                    맘카페 신청 데이터가 없습니다.
                  </p>
                </StatsPanel>
              ) : (
                <div className={styles.statsGridSourceDetail}>
                  <StatsPanel title="카페별 신청 건수" sub="카페명 기준">
                    <ResponsiveContainer
                      width="100%"
                      height={Math.max(200, mamcafeData.length * 42)}
                    >
                      <BarChart
                        data={mamcafeData}
                        layout="vertical"
                        margin={{ top: 4, right: 32, bottom: 0, left: 72 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#f0f0f0"
                          horizontal={false}
                        />
                        <XAxis
                          type="number"
                          tick={{ fontSize: 11, fill: "#94a3b8" }}
                          tickLine={false}
                          axisLine={false}
                          allowDecimals={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          tick={{ fontSize: 12, fill: "#4e5968" }}
                          tickLine={false}
                          axisLine={false}
                          width={72}
                        />
                        <Tooltip content={<StatsTip />} />
                        <Bar
                          dataKey="value"
                          radius={[0, 4, 4, 0]}
                          barSize={22}
                          name="건수"
                        >
                          {mamcafeData.map((_, i) => (
                            <Cell
                              key={i}
                              fill={SOURCE_COLORS[i % SOURCE_COLORS.length]}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </StatsPanel>

                  <StatsPanel title="비율">
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={mamcafeData}
                          cx="50%"
                          cy="50%"
                          outerRadius={90}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {mamcafeData.map((_, i) => (
                            <Cell
                              key={i}
                              fill={SOURCE_COLORS[i % SOURCE_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip content={<StatsTip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className={styles.statsSrcLegend}>
                      {mamcafeData.map((d, i) => (
                        <div key={d.name} className={styles.statsSrcLegendItem}>
                          <div
                            className={styles.statsSrcLegendDot}
                            style={{
                              background:
                                SOURCE_COLORS[i % SOURCE_COLORS.length],
                            }}
                          />
                          <span className={styles.statsSrcLegendName}>
                            {d.name}
                          </span>
                          <span className={styles.statsSrcLegendCount}>
                            {d.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </StatsPanel>
                </div>
              )}
            </div>
          )}

          {/* ════ 시간 패턴 ════ */}
          {subTab === "time" && (
            <div>
              <div className={styles.statsGrid3}>
                <StatsCard
                  label="피크 시간대"
                  value={
                    peaks.length > 0
                      ? peaks.map((p) => `${p.hour}시`).join(", ")
                      : "-"
                  }
                  sub={peakCount > 0 ? `${peakCount}건 접수` : "데이터 없음"}
                  color="#3b82f6"
                />
                <StatsCard
                  label="평일 평균"
                  value={Math.round(
                    weekData
                      .filter((_, i) => i >= 1 && i <= 5)
                      .reduce((a, b) => a + b.count, 0) / 5,
                  )}
                  sub="월~금 하루 평균"
                  color="#22c55e"
                />
                <StatsCard
                  label="주말 평균"
                  value={Math.round(
                    (weekData[0].count + weekData[6].count) / 2,
                  )}
                  sub="토·일 하루 평균"
                  color="#f59e0b"
                />
              </div>

              <div className={styles.statsGrid2}>
                <StatsPanel title="요일별 신청 건수">
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart
                      data={weekData}
                      margin={{ top: 4, right: 4, bottom: 0, left: -28 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#f0f0f0"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="day"
                        tick={{ fontSize: 13, fill: "#94a3b8" }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: "#94a3b8" }}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip content={<StatsTip />} />
                      <Bar
                        dataKey="count"
                        radius={[4, 4, 0, 0]}
                        barSize={28}
                        name="건수"
                      >
                        {weekData.map((d, i) => (
                          <Cell
                            key={i}
                            fill={
                              d.count === maxWeekCount && maxWeekCount > 0
                                ? "#3b82f6"
                                : i === 0 || i === 6
                                  ? "#fca5a5"
                                  : "#bfdbfe"
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className={styles.statsLegendSm}>
                    {(
                      [
                        ["#bfdbfe", "평일"],
                        ["#fca5a5", "주말"],
                        ["#3b82f6", "최다"],
                      ] as [string, string][]
                    ).map(([c, l]) => (
                      <div key={l} className={styles.statsLegendItem}>
                        <div
                          className={styles.statsLegendDot}
                          style={{ background: c }}
                        />
                        {l}
                      </div>
                    ))}
                  </div>
                </StatsPanel>

                <StatsPanel title="시간대별 신청 건수" sub="0시~23시 (KST)">
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart
                      data={hourData}
                      margin={{ top: 4, right: 4, bottom: 0, left: -28 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#f0f0f0"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="hour"
                        tick={{ fontSize: 9, fill: "#94a3b8" }}
                        tickLine={false}
                        axisLine={false}
                        interval={1}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: "#94a3b8" }}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip content={<StatsTip />} />
                      <Bar
                        dataKey="count"
                        radius={[3, 3, 0, 0]}
                        barSize={13}
                        name="건수"
                      >
                        {hourData.map((d, i) => (
                          <Cell
                            key={i}
                            fill={
                              peaks.some((p) => p.hour === d.hour)
                                ? "#3b82f6"
                                : "#dbeafe"
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </StatsPanel>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── 메인 페이지 컴포넌트 ────────────────────────────────────────────────────

// ─── 연락예정 탭 헬퍼 ────────────────────────────────────────────────────────

const COUNSEL_DONE_STATUSES = [
  "상담완료-높음",
  "상담완료-중간",
  "상담완료-낮음",
] as const;

// 상담예정 버튼을 누른 항목만 표시 (contact_scheduled_at 설정된 건)
function isEligibleForCounselTab(c: HakjeomConsultation): boolean {
  return c.contact_scheduled_at !== null;
}

// ─── 탭: 상담완료 ────────────────────────────────────────────────────────────

function CounselDoneTab({
  isActive,
  onCountChange,
}: {
  isActive: boolean;
  onCountChange: (n: number) => void;
}) {
  const [items, setItems] = useState<HakjeomConsultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<HakjeomConsultation | null>(
    null,
  );
  const [toastVisible, setToastVisible] = useState(false);
  const [customCafes, setCustomCafes] = useState<string[]>([]);
  const [customDanggeun, setCustomDanggeun] = useState<string[]>([]);
  const [myDisplayName, setMyDisplayName] = useState<string | null>(null);
  const [isOwnScope, setIsOwnScope] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  const fetchData = useCallback(async (background = false) => {
    if (!background) setLoading(true);
    try {
      const res = await fetch("/api/hakjeom");
      if (res.ok) {
        const data: HakjeomConsultation[] = await res.json();
        setItems(data);
      }
    } finally {
      if (!background) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  useEffect(() => {
    if (isActive) fetchData(true);
  }, [isActive, fetchData]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        setMyDisplayName(data.displayName ?? null);
        setUserRole(data.role ?? null);
        const perm = (data.permissions ?? []).find(
          (p: { section: string; scope: string }) => p.section === "hakjeom",
        );
        setIsOwnScope(perm?.scope === "own");
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/hakjeom/custom-sources")
      .then((r) => r.json())
      .then((data) => {
        const allCafes: string[] = Array.isArray(data.cafes) ? data.cafes : [];
        const allDanggeun: string[] = Array.isArray(data.danggeun)
          ? data.danggeun
          : [];
        setCustomCafes([
          ...new Set(
            allCafes.filter((n: string) => !CAFE_NAME_LIST.includes(n)),
          ),
        ]);
        setCustomDanggeun([...new Set(allDanggeun)]);
      })
      .catch(() => {});
  }, []);

  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<ConsultationStatus[]>([]);
  const [managerFilter, setManagerFilter] = useState<string[]>([]);
  const [managerDropdownOpen, setManagerDropdownOpen] = useState(false);
  const managerDropdownRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const isAdmin = userRole === "admin" || userRole === "master-admin";

  const eligible = items.filter((c) => {
    if (!isEligibleForCounselTab(c)) return false;
    // 담당만 권한이면 본인 건만, 전체 권한(이규준·진수린 등) 또는 관리자면 전체
    if (isOwnScope && myDisplayName && c.manager !== myDisplayName)
      return false;
    return true;
  });

  const uniqueManagers = Array.from(
    new Set(eligible.map((c) => c.manager).filter(Boolean)),
  ) as string[];

  const filtered = eligible.filter((c) => {
    if (searchText) {
      const q = searchText.toLowerCase();
      const contactClean = c.contact.replace(/-/g, "");
      const searchClean = searchText.replace(/-/g, "");
      if (
        !(
          c.name.toLowerCase().includes(q) ||
          contactClean.includes(searchClean) ||
          (c.memo || "").toLowerCase().includes(q)
        )
      )
        return false;
    }
    if (statusFilter.length > 0 && !statusFilter.includes(c.status))
      return false;
    if (managerFilter.length > 0 && !managerFilter.includes(c.manager ?? ""))
      return false;
    return true;
  });

  useEffect(() => {
    onCountChange(eligible.length);
  }, [eligible.length, onCountChange]);
  useEffect(() => {
    setCurrentPage(1);
  }, [searchText, statusFilter, managerFilter]);

  useEffect(() => {
    if (!managerDropdownOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (
        managerDropdownRef.current &&
        !managerDropdownRef.current.contains(e.target as Node)
      ) {
        setManagerDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [managerDropdownOpen]);

  const todayIso = new Date().toISOString().slice(0, 10);

  const bucket = (d: string): number => {
    if (!d) return 3;
    if (d === todayIso) return 0;
    if (d > todayIso) return 1;
    return 2;
  };
  const sorted = [...filtered].sort((a, b) => {
    const ad = a.contact_scheduled_at?.slice(0, 10) ?? "";
    const bd = b.contact_scheduled_at?.slice(0, 10) ?? "";
    const ba = bucket(ad);
    const bb = bucket(bd);
    if (ba !== bb) return ba - bb;
    return ad.localeCompare(bd);
  });
  const totalPages = Math.ceil(sorted.length / itemsPerPage);
  const paginated = sorted.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const dueToday = eligible.filter(
    (c) => c.contact_scheduled_at?.slice(0, 10) === todayIso,
  );

  const handleUpdate = async (
    id: number,
    fields: Partial<HakjeomConsultation>,
  ) => {
    const res = await fetch("/api/hakjeom", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...fields }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "업데이트에 실패했습니다.");
    }
    const { data: updated } = await res.json();
    const merged = updated ?? fields;
    setItems((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...merged } : c)),
    );
    setSelectedItem((prev) =>
      prev?.id === id ? { ...prev, ...merged } : prev,
    );
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  };

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

  return (
    <div>
      {dueToday.length > 0 && (
        <div className={styles.scheduleBanner}>
          <div className={styles.bannerIconBox}>📞</div>
          <div className={styles.bannerTextWrap}>
            <span className={styles.bannerLabel}>
              오늘 연락해야 하는 상담이 <strong>{dueToday.length}건</strong>{" "}
              있습니다
            </span>
            <div className={styles.bannerDetail}>
              {dueToday.slice(0, 8).map((c, i) => (
                <span key={c.id} className={styles.bannerPerson}>
                  {i > 0 && <span className={styles.bannerDot} />}
                  <span className={styles.bannerPersonName}>{c.name}</span>
                  {c.manager && (
                    <span className={styles.bannerLabel}>({c.manager})</span>
                  )}
                </span>
              ))}
              {dueToday.length > 8 && (
                <span className={styles.bannerPerson}>
                  <span className={styles.bannerDot} />
                  <span className={styles.bannerLabel}>
                    외 {dueToday.length - 8}명
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>
      )}
      {/* 필터 바 */}
      <div className={styles.filterRow}>
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--toss-text-primary)",
            whiteSpace: "nowrap",
          }}
        >
          총 {filtered.length}건
        </span>
        <input
          className={styles.input}
          style={{ width: 220 }}
          placeholder="이름, 연락처, 메모 검색..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        {/* 상태 필터 */}
        {COUNSEL_DONE_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() =>
              setStatusFilter((prev) =>
                prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
              )
            }
            className={
              statusFilter.includes(s)
                ? styles.tagBtnChipActive
                : styles.tagBtnChip
            }
          >
            {COUNSEL_SUB_LABEL[s]}
          </button>
        ))}
        {/* 담당자 필터 드롭다운 (전체 권한 이상) */}
        {(isAdmin || !isOwnScope) && (
          <div ref={managerDropdownRef} style={{ position: "relative" }}>
            <button
              className={
                managerFilter.length > 0
                  ? styles.tagBtnChipActive
                  : styles.tagBtnChip
              }
              onClick={() => setManagerDropdownOpen((v) => !v)}
            >
              담당자
              {managerFilter.length > 0 ? ` (${managerFilter.length})` : ""} ▾
            </button>
            {managerDropdownOpen && (
              <div
                className={styles.filterColumnDropdown}
                style={{
                  top: "100%",
                  left: 0,
                  marginTop: 4,
                  position: "absolute",
                  zIndex: 200,
                }}
              >
                <div
                  className={`${styles.filterDropdownItem} ${managerFilter.length === 0 ? styles.filterDropdownItemActive : ""}`}
                  onClick={() => {
                    setManagerFilter([]);
                    setManagerDropdownOpen(false);
                  }}
                >
                  전체
                </div>
                {uniqueManagers.map((m) => (
                  <div
                    key={m}
                    className={`${styles.filterDropdownItem} ${managerFilter.includes(m) ? styles.filterDropdownItemActive : ""}`}
                    onClick={() =>
                      setManagerFilter((prev) =>
                        prev.includes(m)
                          ? prev.filter((x) => x !== m)
                          : [...prev, m],
                      )
                    }
                  >
                    {m}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {(statusFilter.length > 0 ||
          managerFilter.length > 0 ||
          searchText) && (
          <button
            className={styles.tagBtnChip}
            onClick={() => {
              setStatusFilter([]);
              setManagerFilter([]);
              setSearchText("");
            }}
          >
            초기화
          </button>
        )}
      </div>

      <div className={styles.tableOverflow}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>번호</th>
              <th className={styles.th}>이름</th>
              <th className={styles.th}>연락처</th>
              <th className={styles.th}>담당자</th>
              <th className={styles.th}>상태</th>
              <th className={styles.th}>최근 메모</th>
              <th className={styles.th}>등록일</th>
              <th className={styles.th}>재연락</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton cols={8} rows={5} />
            ) : paginated.length === 0 ? (
              <tr>
                <td colSpan={8} className={styles.tableEmptyMsg}>
                  해당 항목이 없습니다.
                </td>
              </tr>
            ) : (
              paginated.map((item, index) => (
                <tr
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  style={{
                    cursor: "pointer",
                    background:
                      selectedItem?.id === item.id
                        ? "var(--toss-blue-subtle, #EBF3FE)"
                        : item.status === "상담완료-높음"
                          ? "#E0F7FA"
                          : item.status === "상담완료-중간"
                            ? "#FFFDE7"
                            : "#FCE4EC",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => {
                    if (selectedItem?.id !== item.id) {
                      const bg =
                        item.status === "상담완료-높음"
                          ? "#C9F0F5"
                          : item.status === "상담완료-중간"
                            ? "#FFF9C4"
                            : "#F8BBD0";
                      (
                        e.currentTarget as HTMLTableRowElement
                      ).style.background = bg;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedItem?.id !== item.id) {
                      const bg =
                        item.status === "상담완료-높음"
                          ? "#E0F7FA"
                          : item.status === "상담완료-중간"
                            ? "#FFFDE7"
                            : "#FCE4EC";
                      (
                        e.currentTarget as HTMLTableRowElement
                      ).style.background = bg;
                    }
                  }}
                >
                  <td className={styles.tdNum}>
                    {(currentPage - 1) * itemsPerPage + index + 1}
                  </td>
                  <td className={styles.tdBold}>{item.name}</td>
                  <td className={styles.tdTabular}>{item.contact}</td>
                  <td className={styles.tdSecondary}>{item.manager ?? "-"}</td>
                  <td>
                    <StatusBadge
                      status={item.status}
                      styleMap={CONSULTATION_STATUS_STYLE}
                      displayLabel={
                        COUNSEL_SUB_LABEL[item.status]
                          ? `상담완료 · ${COUNSEL_SUB_LABEL[item.status]}`
                          : item.status
                      }
                    />
                  </td>
                  <td
                    className={styles.tdSecondary}
                    title={item.latest_memo ?? ""}
                  >
                    {item.latest_memo
                      ? item.latest_memo.length > 30
                        ? item.latest_memo.slice(0, 30) + "…"
                        : item.latest_memo
                      : "-"}
                  </td>
                  <td className={styles.tdSecondary}>
                    {formatDate(item.created_at)}
                  </td>
                  <td
                    className={styles.tdAction}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DateInput
                      value={item.contact_scheduled_at?.slice(0, 10) ?? ""}
                      onChange={(val) => {
                        handleUpdate(item.id, {
                          contact_scheduled_at: val || null,
                        });
                      }}
                      variant="button"
                      label="재연락"
                      align="right"
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className={styles.pageBtn}
          >
            ‹
          </button>
          {getPaginationPages(currentPage, totalPages).map((p, i) =>
            p === "..." ? (
              <span key={`ellipsis-${i}`} className={styles.pageEllipsis}>
                ...
              </span>
            ) : (
              <button
                key={p}
                onClick={() => setCurrentPage(p)}
                className={
                  currentPage === p ? styles.pageBtnActive : styles.pageBtn
                }
              >
                {p}
              </button>
            ),
          )}
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className={styles.pageBtn}
            style={{ marginLeft: 4 }}
          >
            ›
          </button>
        </div>
      )}

      {selectedItem && (
        <HakjeomDetailPanel
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onUpdate={handleUpdate}
          initialTab="basic"
          customCafes={customCafes}
          customDanggeun={customDanggeun}
          onAddCafe={handleAddCafe}
          onDeleteCafe={handleDeleteCafe}
          onAddDanggeun={handleAddDanggeun}
          onDeleteDanggeun={handleDeleteDanggeun}
        />
      )}
      {toastVisible && (
        <div className={styles.toast}>저장이 완료되었습니다</div>
      )}
    </div>
  );
}

const TAB_CONFIG: { key: TabKey; label: string }[] = [
  { key: "hakjeom", label: "학점은행제" },
  { key: "agency", label: "기관협약" },
  { key: "bulk", label: "일괄등록" },
  { key: "counsel_done", label: "연락예정" },
  { key: "edu-students", label: "교육원 학생" },
  { key: "stats", label: "통계" },
];

export default function HakjeomPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlTab = searchParams.get("tab") as TabKey | null;
  const urlHighlight = searchParams.get("highlight")
    ? Number(searchParams.get("highlight"))
    : undefined;
  const urlOpen = searchParams.get("open")
    ? Number(searchParams.get("open"))
    : undefined;

  const [allowedHakjeomTabs, setAllowedHakjeomTabs] = useState<string[] | null>(
    null,
  );
  // 권한 로딩 완료 플래그 — 로딩 전에는 탭 콘텐츠를 렌더하지 않는다 (제한 탭 노출 방지)
  const [tabsPermLoaded, setTabsPermLoaded] = useState(false);
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          const isFullAccess =
            data.role === "admin" || data.role === "master-admin";
          if (!isFullAccess) {
            const perm = data.permissions?.find(
              (p: { section: string; allowed_tabs?: string[] | null }) =>
                p.section === "hakjeom",
            );
            const raw: string[] | null = perm?.allowed_tabs ?? null;
            // 'hakjeom-tab-XXX' 형식 → 'XXX' 로 변환 (구버전 짧은 키도 그대로 통과)
            const normalized = raw
              ? raw.map((v) =>
                  v.startsWith("hakjeom-tab-")
                    ? v.slice("hakjeom-tab-".length)
                    : v,
                )
              : null;
            setAllowedHakjeomTabs(normalized);
          }
        }
        setTabsPermLoaded(true);
      })
      .catch(() => setTabsPermLoaded(true));
  }, []);

  // 권한 시스템에 등록된 탭 키 — 이 목록에 없는 새 탭은 자동 허용
  const MANAGED_HAKJEOM_TAB_KEYS = new Set([
    "hakjeom",
    "agency",
    "bulk",
    "counsel_done",
    "edu-students",
    "stats",
  ]);
  const visibleTabs = allowedHakjeomTabs
    ? TAB_CONFIG.filter(
        (t) =>
          allowedHakjeomTabs.includes(t.key) ||
          !MANAGED_HAKJEOM_TAB_KEYS.has(t.key),
      )
    : TAB_CONFIG;

  const initialTab: TabKey = (() => {
    if (
      urlTab &&
      TAB_CONFIG.some((t) => t.key === urlTab) &&
      (!allowedHakjeomTabs || allowedHakjeomTabs.includes(urlTab))
    )
      return urlTab;
    if (allowedHakjeomTabs && allowedHakjeomTabs.length > 0)
      return allowedHakjeomTabs[0] as TabKey;
    return "hakjeom";
  })();

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [mountedTabs, setMountedTabs] = useState<Set<TabKey>>(
    new Set([initialTab]),
  );

  const handleTabChange = (key: TabKey) => {
    setActiveTab(key);
    setMountedTabs((prev) => new Set([...prev, key]));
    router.replace(`/hakjeom?tab=${key}`, { scroll: false });
  };

  useEffect(() => {
    if (!urlTab) return;
    if (!TAB_CONFIG.some((t) => t.key === urlTab)) return;
    if (allowedHakjeomTabs && !allowedHakjeomTabs.includes(urlTab)) return;
    if (urlTab !== activeTab) {
      setActiveTab(urlTab);
      setMountedTabs((prev) => new Set([...prev, urlTab]));
    }
  }, [urlTab, allowedHakjeomTabs, activeTab]);

  // 권한 로딩 후 클램프 — URL로 제한 탭에 직접 진입한 경우 허용 탭으로 강제 이동
  useEffect(() => {
    if (!tabsPermLoaded || !allowedHakjeomTabs) return;
    if (!MANAGED_HAKJEOM_TAB_KEYS.has(activeTab)) return;
    if (allowedHakjeomTabs.includes(activeTab)) return;
    const fallback = allowedHakjeomTabs.find((t) =>
      TAB_CONFIG.some((c) => c.key === t),
    ) as TabKey | undefined;
    if (fallback) {
      setActiveTab(fallback);
      setMountedTabs((prev) => new Set([...prev, fallback]));
      router.replace(`/hakjeom?tab=${fallback}`, { scroll: false });
    } else {
      // 허용 탭이 하나도 없으면 워크스페이스로 튕김
      router.replace("/work-journal");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabsPermLoaded, allowedHakjeomTabs, activeTab]);

  // 권한 확인 전에는 탭 콘텐츠 미노출 (제한 탭이 잠깐 보이는 것 방지)
  if (!tabsPermLoaded) return null;

  return (
    <div>
      {/* 탭 컨텐츠 - 첫 방문 시 마운트, 이후 CSS로 숨김 */}
      <div style={{ display: activeTab === "hakjeom" ? "block" : "none" }}>
        {mountedTabs.has("hakjeom") && (
          <HakjeomTab
            isActive={activeTab === "hakjeom"}
            highlightId={urlTab === "hakjeom" ? urlHighlight : undefined}
            openId={urlOpen}
          />
        )}
      </div>
      <div style={{ display: activeTab === "agency" ? "block" : "none" }}>
        {mountedTabs.has("agency") && (
          <AgencyTab
            isActive={activeTab === "agency"}
            highlightId={urlTab === "agency" ? urlHighlight : undefined}
          />
        )}
      </div>
      <div style={{ display: activeTab === "bulk" ? "block" : "none" }}>
        {mountedTabs.has("bulk") && (
          <BulkTab onMoveSuccess={() => handleTabChange("hakjeom")} />
        )}
      </div>
      <div style={{ display: activeTab === "counsel_done" ? "block" : "none" }}>
        {mountedTabs.has("counsel_done") && (
          <CounselDoneTab
            isActive={activeTab === "counsel_done"}
            onCountChange={() => {}}
          />
        )}
      </div>
      <div style={{ display: activeTab === "edu-students" ? "block" : "none" }}>
        {mountedTabs.has("edu-students") && (
          <EduStudentsTab isActive={activeTab === "edu-students"} />
        )}
      </div>
      <div style={{ display: activeTab === "stats" ? "block" : "none" }}>
        {mountedTabs.has("stats") && <StatsTab />}
      </div>
    </div>
  );
}
