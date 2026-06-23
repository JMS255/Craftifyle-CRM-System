import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminAuth } from '@/lib/firebase-admin'
import { cookies } from 'next/headers'

export const maxDuration = 60

function peso(n: number) {
  return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 0 })
}

function pct(n: number) { return Math.round(n * 100) + '%' }

function currentYYYYMM() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

interface BoardCtx {
  today: string
  owner: string
  // bookings
  totalBookings: number
  thisMonthBookings: number
  confirmed: number
  collected: number
  outstanding: number
  // leads
  totalLeads: number
  thisMonthLeads: number
  convertedLeads: number
  conversionRate: number
  leadSources: string
  // ads
  adSpend: number
  adROAS: number
  adCampaigns: string
  // finance
  totalCash: number
  cashSources: string
  monthlyIncome: number
  monthlyObligations: number
  monthlyDebtPayments: number
  debts: string
  // business
  services: string
}

function buildCtx(
  bookingsSnap: FirebaseFirestore.QuerySnapshot,
  leadsSnap: FirebaseFirestore.QuerySnapshot,
  campaignsSnap: FirebaseFirestore.QuerySnapshot,
  cashSnap: FirebaseFirestore.QuerySnapshot,
  incomeSnap: FirebaseFirestore.QuerySnapshot,
  obligationsSnap: FirebaseFirestore.QuerySnapshot,
  debtsSnap: FirebaseFirestore.QuerySnapshot,
): BoardCtx {
  const now = new Date()
  const todayStr = now.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const thisMonth = currentYYYYMM()

  // Bookings
  const bookings = bookingsSnap.docs.map(d => d.data())
  const thisMonthBk = bookings.filter(b => (b.event_date ?? '').startsWith(thisMonth))
  const confirmed = bookings.reduce((s, b) => s + (b.package_price ?? 0), 0)
  const collected = bookings.reduce((s, b) => s + (b.deposit_amount ?? 0) + (b.balance_amount ?? 0) * (b.balance_paid ? 1 : 0), 0)
  const outstanding = confirmed - collected

  // Leads
  const leads = leadsSnap.docs.map(d => d.data())
  const thisMonthLeads = leads.filter(l => (l.created_at ?? '').startsWith(thisMonth))
  const converted = leads.filter(l => ['booked', 'completed'].includes(l.status ?? ''))
  const conversionRate = leads.length > 0 ? converted.length / leads.length : 0
  const sourceCounts: Record<string, number> = {}
  leads.forEach(l => { const s = l.source ?? 'unknown'; sourceCounts[s] = (sourceCounts[s] ?? 0) + 1 })
  const leadSources = Object.entries(sourceCounts).map(([k, v]) => `${k}: ${v}`).join(', ')

  // Ads
  const campaigns = campaignsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Array<Record<string, unknown>>
  const adSpend = campaigns.reduce((s, c) => s + (Number(c.spend) || 0), 0)
  const adRevenue = campaigns.reduce((s, c) => s + (Number(c.revenue_raw) || 0), 0)
  const adROAS = adSpend > 0 ? adRevenue / adSpend : 0
  const adCampaigns = campaigns.length
    ? campaigns.map(c => `  - ${c.name} (${c.platform}): spend ${peso(Number(c.spend) || 0)}, ROAS ${adSpend > 0 ? ((Number(c.revenue_raw) || 0) / (Number(c.spend) || 1)).toFixed(1) + 'x' : '—'}`).join('\n')
    : '  No campaigns recorded.'

  // Cash
  const cashDocs = cashSnap.docs.map(d => d.data())
  const totalCash = cashDocs.reduce((s, c) => s + (Number(c.amount) || 0), 0)
  const cashSources = cashDocs.length
    ? cashDocs.map(c => `  - ${c.source_name}: ${peso(Number(c.amount) || 0)}`).join('\n')
    : '  No cash positions recorded.'

  // Income this month
  const income = incomeSnap.docs.map(d => d.data())
  const monthlyIncome = income.filter(i => (i.income_date ?? '').startsWith(thisMonth)).reduce((s, i) => s + (Number(i.amount) || 0), 0)

  // Obligations
  const obligations = obligationsSnap.docs.map(d => d.data())
  const monthlyObligations = obligations.reduce((s, o) => s + (Number(o.amount) || 0), 0)

  // Debts
  const debts = debtsSnap.docs.map(d => d.data())
  const monthlyDebtPayments = debts.reduce((s, d) => s + (Number(d.monthly_amount) || 0), 0)
  const debtList = debts.length
    ? debts.map(d => `  - ${d.name}: ${peso(Number(d.monthly_amount) || 0)}/mo`).join('\n')
    : '  No active debts.'

  return {
    today: todayStr,
    owner: 'James',
    totalBookings: bookings.length,
    thisMonthBookings: thisMonthBk.length,
    confirmed,
    collected,
    outstanding,
    totalLeads: leads.length,
    thisMonthLeads: thisMonthLeads.length,
    convertedLeads: converted.length,
    conversionRate,
    leadSources,
    adSpend,
    adROAS,
    adCampaigns,
    totalCash,
    cashSources,
    monthlyIncome,
    monthlyObligations,
    monthlyDebtPayments,
    debts: debtList,
    services: 'Event Photography (₱4,500) | Photobooth (₱3,500) | Bundle (₱6,500)',
  }
}

function buildBuchiPrompt(ctx: BoardCtx): string {
  return `You are Buchi, the Chief Marketing Officer of Craftifyle — an event photography and photobooth rental business in Zamboanda City, Philippines, owned by ${ctx.owner}.

Today: ${ctx.today}

LIVE BUSINESS DATA:
Services: ${ctx.services}
Monthly ad budget: ₱4,000 | Ad spend to date: ${peso(ctx.adSpend)} | Overall ROAS: ${ctx.adROAS > 0 ? ctx.adROAS.toFixed(1) + 'x' : '—'}

Ad Campaigns:
${ctx.adCampaigns}

Leads:
- Total: ${ctx.totalLeads} | This month: ${ctx.thisMonthLeads} | Converted: ${ctx.convertedLeads} | Conversion rate: ${pct(ctx.conversionRate)}
- Sources: ${ctx.leadSources || 'none recorded'}

YOUR JOB:
- Recommend Facebook ad strategies, copy, targeting, and budgets
- Identify when to scale, pause, or change creatives
- Suggest content ideas for organic reach
- Think in cost per lead, ROAS, and revenue impact
- Filter for quality leads — Zamboanga City events only

YOUR PRINCIPLES:
- More leads at lower cost per lead
- Quality over quantity — events with specific dates
- Every peso must produce measurable results

Speak naturally — mix English and Filipino when it fits. Be direct and actionable. Sign off as Buchi.`
}

function buildGregPrompt(ctx: BoardCtx): string {
  return `You are Greg, the Chief Financial Officer of Craftifyle — an event photography and photobooth rental business in Zamboanda City, Philippines, owned by ${ctx.owner}.

Today: ${ctx.today}

LIVE FINANCIAL DATA:
Cash on hand:
${ctx.cashSources}
TOTAL CASH: ${peso(ctx.totalCash)}

Revenue this month: ${peso(ctx.monthlyIncome)} received
Bookings — Confirmed: ${peso(ctx.confirmed)} | Collected: ${peso(ctx.collected)} | Outstanding: ${peso(ctx.outstanding)}
Total bookings: ${ctx.totalBookings} | This month: ${ctx.thisMonthBookings}

Monthly fixed costs:
- Obligations (bills/subscriptions): ${peso(ctx.monthlyObligations)}/mo
- Debt repayments: ${peso(ctx.monthlyDebtPayments)}/mo
- Ad budget: ₱4,000/mo
- Total monthly burn: ${peso(ctx.monthlyObligations + ctx.monthlyDebtPayments + 4000)}/mo

Debts:
${ctx.debts}

Conversion rate: ${pct(ctx.conversionRate)} | Ad ROAS: ${ctx.adROAS > 0 ? ctx.adROAS.toFixed(1) + 'x' : '—'}

YOUR JOB:
- Track revenue, expenses, and cash flow
- Advise when to increase or decrease ad spend
- Flag outstanding balances and collection risks
- Recommend pricing adjustments based on demand
- Calculate ROAS, cost per lead, profit margins
- Think profitability and sustainability

YOUR PRINCIPLES:
- Collect balance before delivering photos — no exceptions
- Low ad spend + high ROAS = scale immediately
- Cash flow is king — deposits are good, full payment is better

Be precise with numbers. Be direct. Sign off as Greg.`
}

function buildAlanPrompt(ctx: BoardCtx): string {
  return `You are Alan, the Chief Executive Officer of Craftifyle — an event photography and photobooth rental business in Zamboanda City, Philippines.

Owner: ${ctx.owner}, 21 years old, BSIT student
Today: ${ctx.today}

FULL BUSINESS SNAPSHOT:
Services: ${ctx.services}
Cash: ${peso(ctx.totalCash)} total
Revenue this month: ${peso(ctx.monthlyIncome)} | Confirmed bookings: ${peso(ctx.confirmed)} | Outstanding: ${peso(ctx.outstanding)}
Total bookings: ${ctx.totalBookings} | Conversion rate: ${pct(ctx.conversionRate)} | Ad ROAS: ${ctx.adROAS > 0 ? ctx.adROAS.toFixed(1) + 'x' : '—'}
Monthly burn: ${peso(ctx.monthlyObligations + ctx.monthlyDebtPayments + 4000)}/mo

Long-term vision:
- Physical studio target: October 2026
- Digital marketing agency + white-label SaaS CRM (Crafty CRM) launching 2027
- Ultimate goal: relocate to Japan

YOUR JOB:
- Make high-level business decisions
- Prioritize tasks and opportunities
- Identify when to scale, pivot, or stay the course
- Balance short-term cash flow with long-term vision
- Keep ${ctx.owner} focused on what moves the needle most
- Challenge ${ctx.owner} when he is overthinking or underacting

YOUR PRINCIPLES:
- Done over perfect
- Revenue solves most problems
- Build systems, not just hustle
- Every decision should move toward the 2027 agency launch

Be strategic and honest. Challenge James when needed. Sign off as Alan.`
}

export async function POST(req: NextRequest) {
  try {
    return await handlePOST(req)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ cmo: `Error: ${msg}`, cfo: `Error: ${msg}`, ceo: `Error: ${msg}` })
  }
}

async function handlePOST(req: NextRequest) {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('__session')?.value
  if (!sessionCookie) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const decoded = await adminAuth.verifySessionCookie(sessionCookie, true)
  const userId = decoded.uid

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Gemini API key not configured.' }, { status: 500 })

  const body = await req.json()
  const messages: { role: string; content: string }[] = body.messages ?? []
  const roundTable: boolean = body.roundTable ?? false

  // Fetch all data in parallel
  const [bookingsSnap, leadsSnap, campaignsSnap, cashSnap, incomeSnap, obligationsSnap, debtsSnap] = await Promise.all([
    adminDb.collection('bookings').where('user_id', '==', userId).get(),
    adminDb.collection('leads').where('user_id', '==', userId).get(),
    adminDb.collection('ad_campaigns').where('user_id', '==', userId).get(),
    adminDb.collection('personal_cash_positions').where('user_id', '==', userId).get(),
    adminDb.collection('personal_income').where('user_id', '==', userId).get(),
    adminDb.collection('personal_obligations').where('user_id', '==', userId).where('is_active', '==', true).get(),
    adminDb.collection('personal_debts').where('user_id', '==', userId).get(),
  ])

  const ctx = buildCtx(bookingsSnap, leadsSnap, campaignsSnap, cashSnap, incomeSnap, obligationsSnap, debtsSnap)

  async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
    for (let i = 0; i <= retries; i++) {
      try { return await fn() } catch (err) {
        if (!(err instanceof Error && err.message.includes('503')) || i === retries) throw err
        await new Promise(r => setTimeout(r, 1500 * (i + 1)))
      }
    }
    throw new Error('unreachable')
  }

  const genAI = new GoogleGenerativeAI(apiKey)

  function makeModel(systemInstruction: string) {
    return genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      systemInstruction,
      generationConfig: { thinkingConfig: { thinkingBudget: 3000 } } as Record<string, unknown>,
    })
  }

  const geminiHistory = messages.slice(0, -1).map((m) => ({
    role: m.role === 'assistant' ? 'model' as const : 'user' as const,
    parts: [{ text: m.content }],
  }))
  const lastMessage = messages[messages.length - 1]?.content ?? ''

  // Round 1 — 3 independent responses in parallel
  const buchiChat = makeModel(buildBuchiPrompt(ctx)).startChat({ history: geminiHistory })
  const gregChat = makeModel(buildGregPrompt(ctx)).startChat({ history: geminiHistory })
  const alanChat = makeModel(buildAlanPrompt(ctx)).startChat({ history: geminiHistory })

  const [buchiRes, gregRes, alanRes] = await Promise.all([
    withRetry(() => buchiChat.sendMessage(lastMessage)),
    withRetry(() => gregChat.sendMessage(lastMessage)),
    withRetry(() => alanChat.sendMessage(lastMessage)),
  ])

  let cmo = ''; try { cmo = buchiRes.response.text() } catch { cmo = 'Done.' }
  let cfo = ''; try { cfo = gregRes.response.text() } catch { cfo = 'Done.' }
  let ceo = ''; try { ceo = alanRes.response.text() } catch { ceo = 'Done.' }

  if (!roundTable) {
    return NextResponse.json({ cmo, cfo, ceo })
  }

  // Round 2 — debate
  const rtPrompt = `The board has shared their initial responses:\n\nBuchi (CMO): ${cmo}\n\nGreg (CFO): ${cfo}\n\nAlan (CEO): ${ceo}\n\nNow react — do you agree, disagree, or add something the others missed? Be direct and concise.`

  const [buchiRT, gregRT, alanRT] = await Promise.all([
    withRetry(() => buchiChat.sendMessage(rtPrompt)),
    withRetry(() => gregChat.sendMessage(rtPrompt)),
    withRetry(() => alanChat.sendMessage(rtPrompt)),
  ])

  let cmo_rt = ''; try { cmo_rt = buchiRT.response.text() } catch { cmo_rt = 'Done.' }
  let cfo_rt = ''; try { cfo_rt = gregRT.response.text() } catch { cfo_rt = 'Done.' }
  let ceo_rt = ''; try { ceo_rt = alanRT.response.text() } catch { ceo_rt = 'Done.' }

  return NextResponse.json({ cmo, cfo, ceo, cmo_rt, cfo_rt, ceo_rt })
}
