export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'quoted'
  | 'negotiating'
  | 'booked'
  | 'lost'
  | 'completed'

export type LeadSource =
  | 'facebook'
  | 'instagram'
  | 'referral'
  | 'walk-in'
  | 'website'
  | 'tiktok'
  | 'other'

export type EventType =
  | 'wedding'
  | 'birthday'
  | 'debut'
  | 'corporate'
  | 'christmas_party'
  | 'reunion'
  | 'baptism'
  | 'other'

export type ActivityType = 'note' | 'call' | 'message' | 'follow_up'

export type BookingStatus = 'upcoming' | 'completed' | 'cancelled'

export interface Lead {
  id: string
  name: string
  phone: string | null
  email: string | null
  facebook: string | null
  event_type: EventType | null
  event_date: string | null
  venue: string | null
  guest_count: number | null
  package: string | null
  budget: number | null
  status: LeadStatus
  source: LeadSource
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Booking {
  id: string
  lead_id: string | null
  event_name: string
  event_date: string
  event_time: string | null
  venue: string | null
  package_name: string | null
  package_price: number | null
  deposit_amount: number
  deposit_paid: boolean
  deposit_paid_date: string | null
  balance_amount: number
  balance_paid: boolean
  balance_paid_date: string | null
  status: BookingStatus
  craftifyle_income: number
  personal_income: number
  notes: string | null
  gcal_event_id: string | null
  paymongo_link_id?: string | null
  paymongo_link_url?: string | null
  contract_signed_at?: string | null
  contract_signed_name?: string | null
  created_at: string
  updated_at: string
}

export type IncomeCategory = 'tips' | 'personal_gig' | 'salary' | 'freelance' | 'other'
export type ExpenseCategory = 'food' | 'transport' | 'equipment' | 'bills' | 'personal' | 'other'

export interface PersonalExpense {
  id: string
  description: string
  amount: number
  expense_date: string
  category: ExpenseCategory
  notes: string | null
  created_at: string
}

export interface PersonalIncome {
  id: string
  description: string
  amount: number
  income_date: string
  category: IncomeCategory
  notes: string | null
  created_at: string
}

export interface Package {
  id: string
  name: string
  price: number
  description: string | null
  is_addon: boolean
  is_active: boolean
  sort_order: number
  created_at: string
}

export interface Activity {
  id: string
  lead_id: string
  type: ActivityType
  content: string
  follow_up_date: string | null
  completed: boolean
  created_at: string
}

// Personal Finance Manager
export type DebtPaymentStatus = 'paid' | 'planning' | 'unpaid'
export type DebtInterestType = 'none' | 'monthly_addon'
export type IncomingStatus = 'pending' | 'received'

export interface PersonalCashPosition {
  id: string
  source_name: string
  amount: number
  user_id: string
  updated_at: string
}

export interface PersonalIncoming {
  id: string
  source: string
  amount: number
  expected_date: string
  status: IncomingStatus
  notes: string | null
  user_id: string
  created_at: string
}

export interface PersonalDebt {
  id: string
  name: string
  monthly_amount: number
  monthly_amounts?: number[]
  start_month: string
  total_months: number
  interest_type: DebtInterestType
  type?: 'formal' | 'pautang'
  person?: string | null
  user_id: string
  created_at: string
}

export interface PersonalDebtPayment {
  id: string
  debt_id: string
  month: string
  status: DebtPaymentStatus
  user_id: string
  updated_at: string
}

export type AiTone = 'casual_taglish' | 'casual_english' | 'formal_english'

export interface AiPdf {
  name: string
  text: string
}

export interface AiSettings {
  business_name?: string
  business_description?: string
  pricing_model?: string
  ai_rules?: string
  ai_tone?: AiTone
  ai_context?: string
  ai_pdfs?: AiPdf[]
}
