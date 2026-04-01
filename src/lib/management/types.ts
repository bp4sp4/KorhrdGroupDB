export type RevenueType = 'CARD' | 'BANK_TRANSFER' | 'OTHER'
export type RevenueSource = 'MANUAL' | 'EXCEL_UPLOAD' | 'API'
export type ApprovalStatus = 'DRAFT' | 'SUBMITTED' | 'IN_PROGRESS' | 'APPROVED' | 'REJECTED' | 'RESUBMITTED' | 'CANCELLED'
export type ApprovalStepStatus = 'PENDING' | 'APPROVED' | 'REJECTED'
export type PaymentMethod = 'CORPORATE_CARD' | 'BANK_TRANSFER' | 'CASH' | 'OTHER'

export interface Department {
  id: string
  code: string
  name: string
  is_active: boolean
  sort_order: number
}

export interface ExpenseCategory {
  id: string
  name: string
  description?: string
  is_active: boolean
  sort_order: number
}

export interface Revenue {
  id: string
  revenue_date: string
  department_id: string
  revenue_type: RevenueType
  customer_name: string
  amount: number
  product_name?: string
  manager_id: string
  memo?: string
  source: RevenueSource
  created_at: string
  is_deleted: boolean
  department?: Department
  manager?: { display_name: string }
}

export interface TemplateStep {
  step: number
  type: 'APPLICANT' | 'SPECIFIC_PERSON' | 'DEPARTMENT_HEAD'
  user_id?: string
  label: string
}

export interface ApprovalTemplate {
  id: string
  document_type: string
  category: string
  steps: TemplateStep[]
  is_active: boolean
}

export interface ApprovalStep {
  id: string
  approval_id: string
  step_number: number
  approver_id: string
  status: ApprovalStepStatus
  comment?: string
  acted_at?: string
  created_at: string
  approver?: { id: string; display_name: string }
}

export interface Approval {
  id: string
  document_number?: string
  template_id?: string
  document_type: string
  category: string
  status: ApprovalStatus
  applicant_id: string
  department_id?: string
  title: string
  content: Record<string, unknown>
  current_step: number
  submitted_at?: string
  completed_at?: string
  created_at: string
  applicant?: { id: string; display_name: string }
  department?: Department
  steps?: ApprovalStep[]
}

export interface Expense {
  id: string
  approval_id?: string
  expense_date: string
  department_id: string
  category_id?: string
  detail?: string
  amount: number
  payment_method: PaymentMethod
  vendor?: string
  memo?: string
  created_at: string
  department?: Department
  category?: ExpenseCategory
}

export interface AppUser {
  id: string
  username: string
  display_name: string
  role: string
}

export interface ReportData {
  month: string
  total_revenue: number
  total_expense: number
  profit: number
  profit_rate: number
  prev_month_revenue: number
  revenue_by_type: { type: string; amount: number }[]
  expense_by_category: { category: string; amount: number }[]
  revenue_by_dept: { dept: string; amount: number }[]
  expense_by_dept: { dept: string; amount: number }[]
}
