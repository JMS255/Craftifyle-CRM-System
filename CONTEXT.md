# Craftifyle CRM — Session Context

> Read this at the start of every new session to get fully caught up.
> Last updated: June 1, 2026 (end of full-day session)

---

## Who I Am

James Ignacio — owner of Craftifyle, photobooth + event photography business in Zamboanga City, Philippines. Self-taught developer using Claude Code. Shifted from Biomedical Engineering to BSIT in June 2025. Solo operator — Technical Founder of Craftifyle CRM, Technical Co-Founder of a second business, Acting CEO.

---

## Active Projects

1. **craftifyle-crm** — THIS PROJECT — internal CRM, now in open beta
2. **james-portfolio** — Public website (craftifyle.business) — booking wizard, referral system
3. **craftycrm-website** — Marketing + dev docs website for the CRM product

---

## CRM Current Status (June 1, 2026 — after full-day build session)

### Everything that's working

**Pipeline & Leads**
- Lead pipeline: new → contacted → quoted → negotiating → booked → lost → completed
- Kanban board view (drag-and-drop on desktop, single-column + stage tabs on mobile)
- AI next-action badges per lead: "⚡ Event in 3d — confirm!", "🔔 Follow up now", "📞 First contact needed", "⚠ Event passed"
- Cold lead alerts banner — leads silent 5+ days, color-coded warm/cold/very cold
- Next-action badges also in kanban cards
- Package name shown on lead table rows

**Bookings & Payments**
- Booking management with deposit/balance tracking
- Payment status badges per booking: Unpaid / Deposit Paid / Fully Paid / Overdue
- Overdue alert banner on bookings page (event passed, balance unpaid)
- Micro-animation on Mark Paid — green flash confirmation banner
- Invoice generator (printable PDF) with line-item add-ons

**Dashboard**
- Revenue card: this month confirmed / collected / outstanding
- Today's Actions card — top 3 urgent leads, click to navigate
- Quick-prompt chips: Paste DM · What needs attention · Revenue · Draft follow-up
- Onboarding checklist (shown to new users with no leads, progress bar, dismissible)
- Charts: bookings/month bar chart + lead source donut

**Crafty AI — two modes**
- Advisor tab → `/api/chat` — Groq llama-3.1-8b-instant, business advice, no DB access
- CRM Actions tab → `/api/crafty-assist` — Groq llama-3.3-70b-versatile with tool calling
- Both know today's date (injected at request time)
- Pulse animation + tooltip on first 3 sessions (discoverability)
- External event trigger: `window.dispatchEvent(new CustomEvent('crafty-prompt', { detail: { prompt, mode } }))`

**Crafty Tools (CRM Actions)**
- get_leads, create_lead, update_lead
- get_bookings, create_booking, log_payment
- get_revenue_summary, convert_lead_to_booking, get_urgent_leads

**Chat Widget Features**
- Paste DM — 📋 button opens panel, paste raw Messenger inquiry, Crafty creates lead
- Mode toggle: Advisor / CRM Actions (each keeps separate message history)
- Quick-prompt chips on dashboard fire Crafty prompts via CustomEvent

**UX Improvements (June 1)**
- Onboarding checklist for new users (3 steps + progress bar)
- Progressive lead form — 4 fields by default, "Add more details +" expands rest
- Mobile Quick Add "+" in bottom nav → sheet: Add Lead, Paste DM, Log Payment
- Follow-up templates on lead detail — 3 Taglish messages + "Open Messenger" deep link
- Custom empty states: Leads, Bookings pages with illustrated CTAs
- Paste DM promoted as #1 entry point on empty leads page
- Mobile kanban: stage tab bar + single column + "Move to →" buttons

**Package Builder**
- PackagePicker component — 4 package cards + add-ons (togglable), auto-calculates total
- Add-ons saved in booking package_name field (e.g. "Photobooth + Photography + Magnet prints")
- Invoice shows add-ons as line items
- Crafty uses exact package prices by name

**Booking Confirmation Smart Link**
- Public page `/confirm/[token]` — no login needed
- Shows: event details, package breakdown, GCash 0993-632-4512, terms
- "🔗 Share Link" button on booking detail copies the URL

**Automation**
- Semaphore SMS follow-up — cron sends Taglish SMS to leads with phone numbers
- SEMAPHORE_API_KEY: 75a671289eda9b6b08a32fe272f80292 (set in .env.local, NEEDS Vercel env var too)
- Auto follow-up cron (Vercel Cron) + 3-day booking reminders
- Google Calendar sync on bookings

**Auth**
- Open beta ready: delete INVITE_CODE from Vercel env → anyone can sign up
- Signup page auto-skips invite step if open beta is on

---

## What to Build Next

1. **Fix any bugs James reports** — check after today's big push
2. **Semaphore API key** — add to Vercel env vars (SEMAPHORE_API_KEY = 75a671289eda9b6b08a32fe272f80292)
3. **PayMongo payment links** — when James can sign up for PayMongo
4. **Crafty AI training UI** — configure packages/pricing from app, no code
5. **Booking contracts + e-sign** — client agreement with timestamp
6. **Client portal** — client views booking, downloads invoice
7. **Facebook Login** as primary sign-in option
8. **Optimistic UI** for common actions (offline resilience for provincial PH users)

---

## Business Context

- GCash number: 0993-632-4512
- Debt: ₱32,990 due June 5, 2026
- June events: June 4, 5, 14, 28
- Lifetime ROAS: ₱9,800 ad spend → ₱54,250 revenue (5.5x)
- Plan: resume ads at ₱150/day after June 5 pointing to website
- Referral system launched June 1 on portfolio site

---

## Tech Stack

| Layer | Tool |
|---|---|
| Framework | Next.js (App Router, TypeScript) |
| Database | Supabase (PostgreSQL) |
| AI — Advisor | Groq llama-3.1-8b-instant |
| AI — CRM Actions | Groq llama-3.3-70b-versatile (tool calling) |
| Hosting | Vercel |
| Messenger | Meta Messenger API — partially blocked (needs BIR) |
| Cron | Vercel Cron |
| SMS | Semaphore PH (SEMAPHORE_API_KEY) |
| Charts | recharts |
| Drag-and-drop | @hello-pangea/dnd |

---

## Key Files

| File | Purpose |
|---|---|
| `src/types/index.ts` | All TypeScript interfaces — check here first |
| `src/components/ChatWidget.tsx` | Floating AI chat — Advisor + CRM Actions + Paste DM + pulse/tooltip |
| `src/components/Sidebar.tsx` | Desktop sidebar + mobile bottom nav with Quick Add sheet |
| `src/components/PackagePicker.tsx` | Package + add-on selector component |
| `src/app/page.tsx` | Dashboard — onboarding checklist, chips, today's actions, revenue card, charts |
| `src/app/leads/page.tsx` | Leads — list + kanban (desktop drag, mobile single-col) + cold alerts + badges |
| `src/app/leads/new/page.tsx` | New lead form — progressive (4 fields → expand) |
| `src/app/leads/[id]/page.tsx` | Lead detail — follow-up templates, activity log, convert to booking |
| `src/app/bookings/page.tsx` | Bookings — overdue alert + payment badges |
| `src/app/bookings/[id]/page.tsx` | Booking detail — micro-animation, share link, mark paid |
| `src/app/bookings/[id]/invoice/page.tsx` | Invoice with add-on line items |
| `src/app/confirm/[token]/page.tsx` | Public booking confirmation page |
| `src/app/api/crafty-assist/route.ts` | Crafty CRM Actions — all DB tools |
| `src/app/api/chat/route.ts` | Crafty Advisor |
| `src/app/api/cron/follow-up/route.ts` | Follow-up cron — Messenger + SMS |
| `CLAUDE_RULES.md` | Coding rules — read before touching anything |

---

## Rules (from CLAUDE_RULES.md)

- Minimal diffs — never rewrite full files
- 25-line cap — enter Plan Mode if more than 25 lines need changing
- Never use `any` or `@ts-ignore`
- Never change Groq model IDs without being asked
- Build check (`npx next build`) before every commit

---

## How to Start a Session

1. Read this file ✅
2. Ask James what he wants to fix or build
3. Check relevant source files before touching anything
4. Reminder: SEMAPHORE_API_KEY needs to be in Vercel env vars
