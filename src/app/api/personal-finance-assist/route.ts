import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminAuth } from '@/lib/firebase-admin'
import { cookies } from 'next/headers'
import type { QueryDocumentSnapshot } from 'firebase-admin/firestore'

export const maxDuration = 60

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

const MONTH_ABBREVS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']

function toYYYYMM(input: string): string {
  const now = new Date()
  const lower = input.toLowerCase().trim()
  if (lower === 'this month') return currentYYYYMM()
  if (lower === 'next month') return offsetYYYYMM(currentYYYYMM(), 1)
  // YYYY-MM already
  if (/^\d{4}-\d{2}$/.test(input)) return input
  // MM/YYYY or M/YYYY
  const slashMatch = input.match(/^(\d{1,2})\/(\d{4})$/)
  if (slashMatch) return `${slashMatch[2]}-${slashMatch[1].padStart(2, '0')}`
  // Extract year if present
  const yearMatch = input.match(/\d{4}/)
  const year = yearMatch ? yearMatch[0] : String(now.getFullYear())
  // Full month name: "July 2026", "july"
  const fullIdx = MONTH_NAMES.findIndex(m => lower.startsWith(m.toLowerCase()))
  if (fullIdx !== -1) return `${year}-${String(fullIdx + 1).padStart(2, '0')}`
  // 3-letter abbreviation: "Jul 2026", "jul", "Nov", "nov"
  const abbrev = lower.slice(0, 3)
  const abbrevIdx = MONTH_ABBREVS.indexOf(abbrev)
  if (abbrevIdx !== -1) return `${year}-${String(abbrevIdx + 1).padStart(2, '0')}`
  // Fallback: current month
  return now.toISOString().slice(0, 7)
}

function monthsBetween(start: string, end: string): number {
  const [sy, sm] = start.split('-').map(Number)
  const [ey, em] = end.split('-').map(Number)
  return Math.max(1, (ey - sy) * 12 + (em - sm) + 1)
}

function monthLabel(yyyymm: string): string {
  const [y, m] = yyyymm.split('-')
  return `${MONTH_NAMES[parseInt(m) - 1]} ${y}`
}

function peso(n: number) {
  return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 0 })
}

function currentYYYYMM(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function offsetYYYYMM(base: string, offset: number): string {
  const [y, m] = base.split('-').map(Number)
  const total = (m - 1) + offset
  const year = y + Math.floor(total / 12)
  const month = ((total % 12) + 12) % 12 + 1
  return `${year}-${String(month).padStart(2, '0')}`
}

interface ContextData {
  cashTotal: number
  cashSources: { id: string; source_name: string; amount: number }[]
  debts: { id: string; name: string; monthly_amount: number; start_month: string; total_months: number; interest_type: string }[]
  debtPayments: { debt_id: string; month: string; status: string }[]
  pendingIncoming: { id: string; source: string; amount: number; expected_date: string }[]
  obligations: { id: string; name: string; amount: number; due_day: number; category: string }[]
  avgMonthlyRevenue: number
  currentMonth: string
}

function buildSystemPrompt(ctx: ContextData): string {
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  const cashSection = ctx.cashSources.length
    ? ctx.cashSources.map(s => `  - ${s.source_name}: ${peso(s.amount)}`).join('\n') +
      `\n  TOTAL CASH: ${peso(ctx.cashTotal)}`
    : '  No cash positions recorded yet.'

  const debtSection = ctx.debts.length ? ctx.debts.map(debt => {
    const months = Array.from({ length: debt.total_months }, (_, i) => {
      const ym = offsetYYYYMM(debt.start_month, i)
      const payment = ctx.debtPayments.find(p => p.debt_id === debt.id && p.month === ym)
      const status = payment?.status ?? 'unpaid'
      const icon = status === 'paid' ? '✅' : status === 'planning' ? '🔄' : '⏳'
      return `${icon} ${monthLabel(ym)}: ${peso(debt.monthly_amount)}`
    }).join(' | ')
    return `  - ${debt.name} (${peso(debt.monthly_amount)}/mo × ${debt.total_months} months)\n    ${months}`
  }).join('\n') : '  No debts recorded.'

  const incomingSection = ctx.pendingIncoming.length
    ? ctx.pendingIncoming.map(i => `  - ${i.source}: ${peso(i.amount)} expected ${i.expected_date}`).join('\n')
    : '  None.'

  const obligationsTotal = ctx.obligations.reduce((s, o) => s + o.amount, 0)
  const obligationsSection = ctx.obligations.length
    ? ctx.obligations.map(o => `  - ${o.name}: ${peso(o.amount)}/mo (due day ${o.due_day})`).join('\n') +
      `\n  TOTAL: ${peso(obligationsTotal)}/mo`
    : '  None recorded.'

  // Compute next 3 months survival projection
  const projectionRows: string[] = []
  let runningCash = ctx.cashTotal
  for (let i = 0; i < 3; i++) {
    const ym = offsetYYYYMM(ctx.currentMonth, i)
    const monthDebt = ctx.debts.reduce((sum, debt) => {
      const [sy, sm] = debt.start_month.split('-').map(Number)
      const [dy, dm] = ym.split('-').map(Number)
      const monthIdx = (dy - sy) * 12 + (dm - sm)
      if (monthIdx < 0 || monthIdx >= debt.total_months) return sum
      const payment = ctx.debtPayments.find(p => p.debt_id === debt.id && p.month === ym)
      if (payment?.status === 'paid') return sum
      return sum + debt.monthly_amount
    }, 0)
    const incoming = i === 0
      ? ctx.pendingIncoming.filter(p => p.expected_date.startsWith(ym)).reduce((s, p) => s + p.amount, 0)
      : 0
    const expenses = 5000 // estimated
    const endCash = runningCash + ctx.avgMonthlyRevenue + incoming - monthDebt - expenses
    const flag = endCash < 0 ? '🔴 DANGER' : endCash < 10000 ? '🟡 Tight' : '🟢 OK'
    projectionRows.push(`  ${monthLabel(ym)}: open ${peso(Math.round(runningCash))} +rev ${peso(ctx.avgMonthlyRevenue)} +inc ${peso(incoming)} -debt ${peso(monthDebt)} -exp ${peso(expenses)} = ${peso(Math.round(endCash))} ${flag}`)
    runningCash = endCash
  }

  return `You are Crafty — James's personal finance AI inside Craftifyle CRM. James runs a photobooth business in Zamboanga City and tracks his personal cash, debts, and income here.

TODAY: ${dateStr}
CURRENT MONTH: ${monthLabel(ctx.currentMonth)}

=== CASH POSITION ===
${cashSection}

=== DEBT SCHEDULE ===
${debtSection}

=== MONTHLY OBLIGATIONS (fixed recurring bills) ===
${obligationsSection}

=== CONFIRMED INCOMING (not yet received) ===
${incomingSection}

=== 3-MONTH SURVIVAL PROJECTION ===
(Revenue estimate: ${peso(ctx.avgMonthlyRevenue)}/mo trailing 3-month average, expenses ~₱5,000/mo estimated)
${projectionRows.join('\n')}

=== CRITICAL BEHAVIOR RULES ===
1. ALWAYS act immediately — never ask "are you sure?" or "should I proceed?" Just do it and confirm.
2. Handle MULTIPLE actions in one message. "spent 200 food and 150 fare" = call log_expense TWICE.
3. NEVER say you can't do something if a tool exists for it. Default to action.
4. Make smart assumptions without asking:
   - No date mentioned → today
   - No category → infer from description (see guide below)
   - "this month" / "ngayong buwan" → ${monthLabel(ctx.currentMonth)}
   - "next month" → ${monthLabel(offsetYYYYMM(ctx.currentMonth, 1))}
5. If the user says "mali", "cancel", "undo", "wrong" → use delete_last_entry to remove it.
6. If any month is 🔴 DANGER, warn James at the end of your reply even if he didn't ask.
7. REPLY FORMAT: Plain conversational text only. NO markdown tables, NO | pipes, NO # headers, NO ** bold. Use plain sentences and line breaks. Keep replies short — 1-3 sentences max unless listing multiple items.

=== LANGUAGE UNDERSTANDING (Filipino/Taglish/Bisaya) ===
"nagbayad / nagastos / ginastos / spent / gastos ko" → log_expense
"natanggap / naresibo / received / nakuha ko" → if it matches a confirmed incoming → mark_incoming_received; else → log_income
"may darating / expected / mayroon pang / inaabangan ko" → add_confirmed_incoming
"nangutang / borrowed / utang ko / pautang" → add_debt (type: pautang)
"loan / EWB / SSS / installment / nagbayad ng utang" → add_debt (type: formal) or mark_debt_payment
"bayad na / paid na / nabayaran / planong bayaran" → mark_debt_payment
"GCash ko ay / balance ko ay / nag-update ang / cash ko ay / my cash is" → update_cash_position (if no specific source named, use source_name: "Cash on hand")
"bayad ko monthly / recurring bill / subscription / internet / rent / obligation" → add_obligation / delete_obligation
"earned / kita / naka-book / down payment / tip" → log_income
"mali / cancel / undo / ay wrong / ibig sabihin" → delete_last_entry (for expenses/income only)
"wrong start / wrong date / mali yung buwan / dapat June / start June not May / change start / change end / change amount" → update_debt (modifies existing debt dates/amount — do NOT use add_debt for this)
"alisin / tanggalin ang utang / delete debt / remove debt / bayad na lahat / fully paid off / wala na yung utang" → delete_debt
"alisin / cancel / tanggalin yung incoming / hindi na darating / hindi na matutuloy" → delete_incoming
"down payment received / DP paid / nagbayad ng DP / booking income / photobooth income" → log_income (category: booking)

=== CATEGORY AUTO-INFERENCE ===
food / kain / lunch / merienda / breakfast / dinner / snack / kape / rice → food
tricycle / bus / jeep / grab / fare / byahe / transport / commute / gas / fuel → transport
load / internet / wifi / kuryente / tubig / meralco / water / bills / rent / subscription → bills
camera / lens / flash / equipment / battery / tripod / parts / repair / studio → equipment
haircut / barber / salon / medicine / vitamins / personal / hygiene → personal
everything else → other

=== MATCHING RULES ===
- Debt names: fuzzy match OK. "camera" matches "Camera EWB". "SSS" matches "SSS Loan".
- Incoming sources: fuzzy match OK. "CHED" matches "CHED Scholarship".
- If no match found for debt/incoming, tell James clearly which ones exist.

=== IMAGE READING — MANDATORY TOOL CALLS ===
When the user sends ANY image, you MUST call a tool. Never just describe what you see — always act.
- Balance screenshot (GCash home screen, Maribank, BDO, Maya, UnionBank): call update_cash_position IMMEDIATELY with the exact peso amount shown and the app name as source_name. Do not ask. Do not confirm. Just call the tool.
- Transaction history screenshot: call log_expense for each debit row, log_income for each credit row visible.
- Receipt image: call log_expense with the total amount, store name, and date shown.
- Multiple images: process each one and call the appropriate tool for each.
- If you see a balance but are unsure of the source name, use your best guess (e.g. "GCash", "Maribank", "BDO").
- NEVER respond with only text when an image is present. Always call at least one tool first.
- If the image is completely unreadable, say so in one sentence.

=== REPLY FORMAT ===
- Start with "Done —" when completing an action.
- For multiple actions: list each one briefly ("Logged ₱200 food, ₱150 transport").
- Keep it under 3 lines unless James asks for analysis.
- If 🔴 danger month detected, append "⚠️ [month] looks critical — [short reason]" at the end.`
}

const TOOLS = [{ functionDeclarations: [
  {
    name: 'log_expense',
    description: 'Log a personal expense.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        amount: { type: 'number', description: 'Amount in PHP, no peso sign.' },
        description: { type: 'string', description: 'What the expense was for.' },
        category: { type: 'string', enum: ['food', 'transport', 'equipment', 'bills', 'personal', 'other'] },
        date: { type: 'string', description: 'Date in YYYY-MM-DD. Defaults to today.' },
      },
      required: ['amount', 'description'],
    },
  },
  {
    name: 'log_income',
    description: 'Log personal income (non-business revenue).',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        amount: { type: 'number', description: 'Amount in PHP.' },
        description: { type: 'string', description: 'Source or description of income.' },
        category: { type: 'string', enum: ['booking', 'tips', 'personal_gig', 'salary', 'freelance', 'other'] },
        date: { type: 'string', description: 'Date in YYYY-MM-DD. Defaults to today.' },
      },
      required: ['amount', 'description'],
    },
  },
  {
    name: 'mark_debt_payment',
    description: 'Mark a debt payment month as paid, planning, or unpaid.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        debt_name: { type: 'string', description: 'Partial or full debt name, e.g. "camera", "lens", "loan".' },
        month: { type: 'string', description: 'Month as "July 2026", "this month", "next month", or YYYY-MM.' },
        status: { type: 'string', enum: ['paid', 'planning', 'unpaid'] },
      },
      required: ['debt_name', 'month', 'status'],
    },
  },
  {
    name: 'mark_incoming_received',
    description: 'Mark a confirmed incoming amount as received — converts it to an income entry.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        source: { type: 'string', description: 'Partial or full source name, e.g. "CHED", "Irene".' },
        received_date: { type: 'string', description: 'Date received in YYYY-MM-DD. Defaults to today.' },
      },
      required: ['source'],
    },
  },
  {
    name: 'update_cash_position',
    description: 'Update or add a cash position source (e.g. Maribank balance changed).',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        source_name: { type: 'string', description: 'Name of the cash source, e.g. "Maribank savings", "Cash on hand".' },
        amount: { type: 'number', description: 'New balance in PHP.' },
      },
      required: ['source_name', 'amount'],
    },
  },
  {
    name: 'add_confirmed_incoming',
    description: 'Add a new expected/confirmed incoming payment that has not been received yet.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        source: { type: 'string', description: 'Who or what the money is from, e.g. "CHED Scholarship", "Kuya Joel deposit".' },
        amount: { type: 'number', description: 'Expected amount in PHP.' },
        expected_date: { type: 'string', description: 'Expected date in YYYY-MM-DD. Defaults to end of current month.' },
        notes: { type: 'string', description: 'Optional notes.' },
      },
      required: ['source', 'amount'],
    },
  },
  {
    name: 'delete_last_entry',
    description: 'Delete the most recently logged expense or income entry. Use when user says "mali", "cancel", "undo", "wrong amount".',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        entry_type: { type: 'string', enum: ['expense', 'income'], description: 'Whether to delete the last expense or last income entry.' },
      },
      required: ['entry_type'],
    },
  },
  {
    name: 'add_debt',
    description: 'Add a new debt or loan to the debt schedule.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the debt, e.g. "Camera EWB", "SSS Loan".' },
        monthly_amount: { type: 'number', description: 'Monthly payment amount in PHP.' },
        start_month: { type: 'string', description: 'First payment month, e.g. "July 2026" or YYYY-MM.' },
        end_month: { type: 'string', description: 'Last payment month, e.g. "November 2026" or YYYY-MM. Use this OR total_months.' },
        total_months: { type: 'number', description: 'Number of monthly payments. Use this OR end_month.' },
        type: { type: 'string', enum: ['formal', 'pautang'], description: 'formal = bank/institution loan, pautang = borrowed from a person.' },
        person: { type: 'string', description: 'Person name for pautang debts only.' },
      },
      required: ['name', 'monthly_amount', 'start_month'],
    },
  },
  {
    name: 'delete_debt',
    description: 'Permanently delete a debt and all its payment records. Use when user says "alisin", "remove", "delete", "tanggalin", "paid off completely", "wala na".',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        debt_name: { type: 'string', description: 'Partial or full name of the debt to delete, e.g. "lens", "camera", "40k".' },
      },
      required: ['debt_name'],
    },
  },
  {
    name: 'delete_incoming',
    description: 'Remove a confirmed incoming entry that is no longer expected.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        source: { type: 'string', description: 'Partial or full source name, e.g. "CHED", "Kuya".' },
      },
      required: ['source'],
    },
  },
  {
    name: 'add_obligation',
    description: 'Add a new recurring monthly obligation (fixed bill like internet, rent, Netflix, etc.).',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the obligation, e.g. "Globe Internet", "Netflix", "Rent".' },
        amount: { type: 'number', description: 'Monthly amount in PHP.' },
        due_day: { type: 'number', description: 'Day of month it is due (1-31). Defaults to 1.' },
        category: { type: 'string', enum: ['bills', 'subscription', 'rent', 'other'] },
      },
      required: ['name', 'amount'],
    },
  },
  {
    name: 'delete_obligation',
    description: 'Remove a recurring monthly obligation.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Partial or full name of the obligation, e.g. "Globe", "Netflix".' },
      },
      required: ['name'],
    },
  },
  {
    name: 'update_debt',
    description: 'Update an existing debt — change its start month, end month, monthly amount, or name. Use when user says a debt has the wrong dates or amount.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        debt_name: { type: 'string', description: 'Partial or full name of the debt to update, e.g. "lens", "camera".' },
        new_start_month: { type: 'string', description: 'New first payment month, e.g. "June 2026" or YYYY-MM.' },
        new_end_month: { type: 'string', description: 'New last payment month, e.g. "August 2026" or YYYY-MM.' },
        new_monthly_amount: { type: 'number', description: 'New monthly payment amount in PHP.' },
        new_name: { type: 'string', description: 'New name for the debt.' },
      },
      required: ['debt_name'],
    },
  },
]}]

async function runTool(
  name: string,
  args: Record<string, unknown>,
  userId: string,
  ctx: ContextData
): Promise<string> {
  const today = new Date().toISOString().slice(0, 10)
  const now = new Date().toISOString()

  try {
    if (name === 'log_expense') {
      await adminDb.collection('personal_expenses').add({
        user_id: userId,
        description: args.description,
        amount: args.amount,
        expense_date: (args.date as string) ?? today,
        category: (args.category as string) ?? 'other',
        notes: null,
        created_at: now,
      })
      return `Logged expense: ${args.description} — ${peso(args.amount as number)} on ${(args.date as string) ?? today}`
    }

    if (name === 'log_income') {
      await adminDb.collection('personal_income').add({
        user_id: userId,
        description: args.description,
        amount: args.amount,
        income_date: (args.date as string) ?? today,
        category: (args.category as string) ?? 'other',
        notes: null,
        created_at: now,
      })
      return `Logged income: ${args.description} — ${peso(args.amount as number)} on ${(args.date as string) ?? today}`
    }

    if (name === 'mark_debt_payment') {
      const targetMonth = toYYYYMM(args.month as string)
      const searchName = (args.debt_name as string).toLowerCase()
      const debt = ctx.debts.find(d => d.name.toLowerCase().includes(searchName))
      if (!debt) return `Debt not found matching "${args.debt_name}". Available: ${ctx.debts.map(d => d.name).join(', ')}`

      // Check if payment record exists
      const snap = await adminDb.collection('personal_debt_payments')
        .where('debt_id', '==', debt.id)
        .where('month', '==', targetMonth)
        .where('user_id', '==', userId)
        .get()

      if (snap.empty) {
        await adminDb.collection('personal_debt_payments').add({
          user_id: userId,
          debt_id: debt.id,
          month: targetMonth,
          status: args.status,
          updated_at: now,
        })
      } else {
        await snap.docs[0].ref.update({ status: args.status, updated_at: now })
      }
      return `${debt.name} — ${monthLabel(targetMonth)} marked as ${args.status} (${peso(debt.monthly_amount)})`
    }

    if (name === 'mark_incoming_received') {
      const searchSource = (args.source as string).toLowerCase()
      const incoming = ctx.pendingIncoming.find(i => i.source.toLowerCase().includes(searchSource))
      if (!incoming) return `Incoming source not found matching "${args.source}".`

      const receivedDate = (args.received_date as string) ?? today

      // Mark as received
      await adminDb.collection('personal_incoming').doc(incoming.id).update({
        status: 'received',
        updated_at: now,
      })

      // Create income entry
      await adminDb.collection('personal_income').add({
        user_id: userId,
        description: incoming.source,
        amount: incoming.amount,
        income_date: receivedDate,
        category: 'other',
        notes: 'Converted from confirmed incoming',
        created_at: now,
      })

      return `${incoming.source} — ${peso(incoming.amount)} marked as received and added to income.`
    }

    if (name === 'update_cash_position') {
      const sourceName = args.source_name as string
      const amount = args.amount as number

      const allSnap = await adminDb.collection('personal_cash_positions')
        .where('user_id', '==', userId).get()

      const lower = sourceName.toLowerCase()
      const matched = allSnap.docs.find(d => {
        const stored = (d.data().source_name as string).toLowerCase()
        return stored.includes(lower) || lower.includes(stored)
      })

      if (!matched) {
        await adminDb.collection('personal_cash_positions').add({
          user_id: userId,
          source_name: sourceName,
          amount,
          updated_at: now,
        })
      } else {
        await matched.ref.update({ amount, updated_at: now })
      }

      const newTotal = allSnap.docs
        .filter(d => d.id !== matched?.id)
        .reduce((sum, d) => sum + (d.data().amount as number), 0) + amount
      const displayName = matched ? (matched.data().source_name as string) : sourceName

      return `${displayName} updated to ${peso(amount)}. New total cash: ${peso(newTotal)}`
    }

    if (name === 'add_confirmed_incoming') {
      const defaultDate = (() => {
        const d = new Date()
        return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10)
      })()
      const expectedDate = (args.expected_date as string) ?? defaultDate
      await adminDb.collection('personal_incoming').add({
        user_id: userId,
        source: args.source,
        amount: args.amount,
        expected_date: expectedDate,
        status: 'pending',
        notes: (args.notes as string) ?? null,
        created_at: now,
      })
      return `Added confirmed incoming: ${args.source} — ${peso(args.amount as number)} expected ${expectedDate}`
    }

    if (name === 'delete_last_entry') {
      const col = args.entry_type === 'expense' ? 'personal_expenses' : 'personal_income'
      const snap = await adminDb.collection(col)
        .where('user_id', '==', userId)
        .orderBy('created_at', 'desc')
        .limit(1)
        .get()
      if (snap.empty) return `No recent ${args.entry_type} entry found to delete.`
      const doc = snap.docs[0]
      const data = doc.data() as { description?: string; amount?: number }
      await doc.ref.delete()
      return `Deleted last ${args.entry_type}: "${data.description}" — ${peso(data.amount ?? 0)}`
    }

    if (name === 'add_debt') {
      const startYM = toYYYYMM(args.start_month as string)
      let totalMonths: number
      if (args.end_month) {
        totalMonths = monthsBetween(startYM, toYYYYMM(args.end_month as string))
      } else {
        totalMonths = Math.max(1, Math.round((args.total_months as number) ?? 1))
      }
      const monthlyAmount = args.monthly_amount as number
      const monthly_amounts = Array.from({ length: totalMonths }, () => monthlyAmount)
      await adminDb.collection('personal_debts').add({
        user_id: userId,
        name: args.name,
        monthly_amount: monthlyAmount,
        monthly_amounts,
        start_month: startYM,
        total_months: totalMonths,
        interest_type: 'none',
        type: (args.type as string) ?? 'formal',
        person: (args.person as string) ?? null,
        created_at: now,
      })
      const endYM = offsetYYYYMM(startYM, totalMonths - 1)
      return `Added debt "${args.name}" — ${peso(monthlyAmount)}/mo for ${totalMonths} months (${monthLabel(startYM)} to ${monthLabel(endYM)}).`
    }

    if (name === 'update_debt') {
      const searchName = (args.debt_name as string).toLowerCase()
      const debt = ctx.debts.find(d => d.name.toLowerCase().includes(searchName))
      if (!debt) return `Debt not found matching "${args.debt_name}". Available: ${ctx.debts.map(d => d.name).join(', ')}`

      const updates: Record<string, unknown> = { updated_at: now }

      const newStartYM = args.new_start_month ? toYYYYMM(args.new_start_month as string) : debt.start_month
      const currentEndYM = offsetYYYYMM(debt.start_month, debt.total_months - 1)
      const newEndYM = args.new_end_month ? toYYYYMM(args.new_end_month as string) : currentEndYM
      const newTotalMonths = monthsBetween(newStartYM, newEndYM)

      if (args.new_start_month || args.new_end_month) {
        updates.start_month = newStartYM
        updates.total_months = newTotalMonths
        const amount = (args.new_monthly_amount as number) ?? debt.monthly_amount
        updates.monthly_amounts = Array.from({ length: newTotalMonths }, () => amount)
      }
      if (args.new_monthly_amount) {
        updates.monthly_amount = args.new_monthly_amount
        if (!updates.monthly_amounts) {
          updates.monthly_amounts = Array.from({ length: debt.total_months }, () => args.new_monthly_amount as number)
        }
      }
      if (args.new_name) updates.name = args.new_name

      await adminDb.collection('personal_debts').doc(debt.id).update(updates)
      return `Updated "${debt.name}" — now ${monthLabel(newStartYM)} to ${monthLabel(newEndYM)}, ${newTotalMonths} months.`
    }

    if (name === 'delete_debt') {
      const searchName = (args.debt_name as string).toLowerCase()
      const debt = ctx.debts.find(d => d.name.toLowerCase().includes(searchName))
      if (!debt) return `Debt not found matching "${args.debt_name}". Available: ${ctx.debts.map(d => d.name).join(', ')}`
      // Delete the debt and all its payment records
      await adminDb.collection('personal_debts').doc(debt.id).delete()
      const paymentsSnap = await adminDb.collection('personal_debt_payments')
        .where('debt_id', '==', debt.id).where('user_id', '==', userId).get()
      await Promise.all(paymentsSnap.docs.map(d => d.ref.delete()))
      return `Deleted "${debt.name}" and ${paymentsSnap.size} payment records.`
    }

    if (name === 'delete_incoming') {
      const searchSource = (args.source as string).toLowerCase()
      const incoming = ctx.pendingIncoming.find(i => i.source.toLowerCase().includes(searchSource))
      if (!incoming) return `Incoming not found matching "${args.source}". Available: ${ctx.pendingIncoming.map(i => i.source).join(', ')}`
      await adminDb.collection('personal_incoming').doc(incoming.id).delete()
      return `Removed "${incoming.source}" — ${peso(incoming.amount)} from confirmed incoming.`
    }

    if (name === 'add_obligation') {
      await adminDb.collection('personal_obligations').add({
        user_id: userId,
        name: args.name,
        amount: args.amount,
        due_day: (args.due_day as number) ?? 1,
        category: (args.category as string) ?? 'bills',
        is_active: true,
        created_at: now,
      })
      return `Added obligation "${args.name}" — ${peso(args.amount as number)}/mo due day ${(args.due_day as number) ?? 1}.`
    }

    if (name === 'delete_obligation') {
      const searchName = (args.name as string).toLowerCase()
      const obligation = ctx.obligations.find(o => o.name.toLowerCase().includes(searchName))
      if (!obligation) return `Obligation not found matching "${args.name}". Available: ${ctx.obligations.map(o => o.name).join(', ')}`
      await adminDb.collection('personal_obligations').doc(obligation.id).update({ is_active: false, updated_at: now })
      return `Removed "${obligation.name}" — ${peso(obligation.amount)}/mo from monthly obligations.`
    }

    return `Unknown tool: ${name}`
  } catch (err) {
    return `Tool error: ${err instanceof Error ? err.message : String(err)}`
  }
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('__session')?.value
  if (!sessionCookie) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let userId: string
  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true)
    userId = decoded.uid
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { messages, imageData, imageMimeType, images } = await req.json() as {
    messages: { role: string; content: string }[]
    imageData?: string
    imageMimeType?: string
    images?: { data: string; mimeType: string }[]
  }
  if (!messages?.length) return NextResponse.json({ error: 'No messages provided.' }, { status: 400 })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Gemini API key not configured.' }, { status: 500 })

  // Fetch all context in parallel
  const [cashSnap, debtSnap, paymentSnap, incomingSnap, incomeSnap, obligationsSnap] = await Promise.all([
    adminDb.collection('personal_cash_positions').where('user_id', '==', userId).get(),
    adminDb.collection('personal_debts').where('user_id', '==', userId).get(),
    adminDb.collection('personal_debt_payments').where('user_id', '==', userId).get(),
    adminDb.collection('personal_incoming').where('user_id', '==', userId).where('status', '==', 'pending').get(),
    adminDb.collection('personal_income').where('user_id', '==', userId).get(),
    adminDb.collection('personal_obligations').where('user_id', '==', userId).where('is_active', '==', true).get(),
  ])

  const cashSources = cashSnap.docs.map((d: QueryDocumentSnapshot) => ({
    id: d.id, ...d.data() as { source_name: string; amount: number },
  }))
  const obligations = obligationsSnap.docs.map((d: QueryDocumentSnapshot) => ({
    id: d.id, ...d.data() as { name: string; amount: number; due_day: number; category: string },
  }))
  const cashTotal = cashSources.reduce((s, c) => s + c.amount, 0)

  const debts = debtSnap.docs.map((d: QueryDocumentSnapshot) => ({ id: d.id, ...d.data() as {
    name: string; monthly_amount: number; start_month: string; total_months: number; interest_type: string
  }}))

  const debtPayments = paymentSnap.docs.map((d: QueryDocumentSnapshot) => ({
    id: d.id, ...d.data() as { debt_id: string; month: string; status: string },
  }))

  const pendingIncoming = incomingSnap.docs.map((d: QueryDocumentSnapshot) => ({
    id: d.id, ...d.data() as { source: string; amount: number; expected_date: string },
  }))

  // Trailing 3-month revenue average from personal income
  const now = new Date()
  const threeMonthsAgo = offsetYYYYMM(currentYYYYMM(), -3) + '-01'
  const recentIncome = incomeSnap.docs
    .map((d: QueryDocumentSnapshot) => d.data() as { income_date: string; amount: number })
    .filter(e => e.income_date >= threeMonthsAgo)
  const avgMonthlyRevenue = recentIncome.length
    ? Math.round(recentIncome.reduce((s, e) => s + e.amount, 0) / 3)
    : 21000 // fallback to known average

  const ctx: ContextData = {
    cashTotal, cashSources, debts, debtPayments, pendingIncoming, obligations,
    avgMonthlyRevenue, currentMonth: currentYYYYMM(),
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
    systemInstruction: buildSystemPrompt(ctx),
    tools: TOOLS,
  })

  const history = messages.slice(0, -1).map((m: { role: string; content: string }) => ({
    role: m.role === 'assistant' ? 'model' as const : 'user' as const,
    parts: [{ text: m.content }],
  }))

  const chat = model.startChat({ history })

  const lastText = messages[messages.length - 1].content || 'Read this financial screenshot and update my finances accordingly.'
  const allImages: { data: string; mimeType: string }[] = images ?? (imageData ? [{ data: imageData, mimeType: imageMimeType ?? 'image/jpeg' }] : [])

  let result
  if (allImages.length > 0) {
    const parts = [
      { text: lastText },
      ...allImages.map(img => ({ inlineData: { data: img.data, mimeType: img.mimeType } })),
    ]
    result = await chat.sendMessage(parts)
  } else {
    result = await chat.sendMessage(lastText)
  }

  // Tool-calling loop — max 5 rounds to handle compound multi-action messages
  for (let round = 0; round < 5; round++) {
    const calls = result.response.functionCalls()
    if (!calls?.length) break
    const toolResults = await Promise.all(
      calls.map(async call => ({
        functionResponse: {
          name: call.name,
          response: { result: await runTool(call.name, call.args as Record<string, unknown>, userId, ctx) },
        },
      }))
    )
    result = await chat.sendMessage(toolResults)
  }

  let reply = ''
  try { reply = result.response.text() } catch { reply = 'Done.' }
  return NextResponse.json({ reply })
}
