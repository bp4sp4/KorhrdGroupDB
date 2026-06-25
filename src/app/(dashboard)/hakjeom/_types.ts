// ─── 공통 타입 ──────────────────────────────────────────────────────────────

export type ConsultationStatus =
  | "부재중/추후통화"
  | "상담대기"
  | "상담완료-높음"
  | "상담완료-중간"
  | "상담완료-낮음"
  | "장기가망"
  | "수신거부"
  | "등록완료"
  | "지인등록"
  | "지인취소"
  | "지인대기"
  | "기타";

export type AgencyStatus = "협약대기" | "협약중" | "보류" | "협약완료";

export type TabKey =
  | "hakjeom"
  | "agency"
  | "bulk"
  | "counsel_done"
  | "edu-students"
  | "stats";

// ─── 학점은행제 타입 ─────────────────────────────────────────────────────────

export interface HakjeomConsultation {
  id: number;
  name: string;
  contact: string;
  education: string | null;
  reason: string | null;
  click_source: string | null;
  status: ConsultationStatus;
  memo: string | null;
  subject_cost: number | null;
  manager: string | null;
  residence: string | null;
  hope_course: string | null;
  counsel_completed_at: string | null;
  counsel_check: string | null;
  current_situation: string | null;
  reaction_point: string | null;
  contact_scheduled_at: string | null;
  manager_assigned_at?: string | null;
  fast_consultation?: boolean | null;
  preferred_times?: string[] | null;
  consult_time_memo?: string | null;
  created_at: string;
  updated_at: string | null;
  memo_count?: number;
  latest_memo?: string | null;
  latest_memo_at?: string | null;
}

// ─── 기관협약 타입 ────────────────────────────────────────────────────────────

export interface Agency {
  id: number;
  category: string | null;
  address: string | null;
  institution_name: string | null;
  contact: string | null;
  credit_commission: string | null;
  private_commission: string | null;
  manager: string | null;
  memo: string | null;
  status: AgencyStatus;
  created_at: string;
}

// ─── 일괄등록 타입 ────────────────────────────────────────────────────────────

export type RowType = "consult" | "cert";
export type BulkTabView = "upload" | "staging";

export interface StagingRow {
  id: number;
  row_type: RowType;
  name: string;
  contact: string;
  education: string | null;
  major_category: string | null;
  hope_course: string | null;
  click_source: string | null;
  reason: string | null;
  memo: string | null;
  status: string;
  manager: string | null;
  residence: string | null;
  counsel_check: string | null;
  subject_cost: number | null;
  applied_at: string | null;
  created_at: string;
}

export interface CsvRow {
  name: string;
  contact: string;
  education: string;
  major_category: string;
  hope_course: string;
  click_source: string;
  reason: string;
  memo: string;
  status: string;
  manager: string;
  residence: string;
  counsel_check: string;
  subject_cost: string;
  applied_at: string;
}
