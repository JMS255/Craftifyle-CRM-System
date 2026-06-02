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
