# Craftifyle CRM — Session Context

> Read this at the start of every new session to get fully caught up.
> Last updated: June 1, 2026

---

## Who I Am

James Ignacio — owner of Craftifyle, photobooth + event photography business in Zamboanga City, Philippines. Self-taught developer using Claude Code. Shifted from Biomedical Engineering to BSIT in June 2025. Running a real business while building software.

---

## Two Active Projects

1. **james-portfolio** — Public website (craftifyle.business) — booking wizard, referral system, admin tools
2. **craftifyle-crm** — THIS PROJECT — internal CRM with Crafty AI and automation

---

## CRM Current Status (June 1, 2026 — end of session)

**What's working:**
- Lead pipeline (new → contacted → quoted → negotiating → booked → lost → completed)
- **Kanban board view** — drag-and-drop across pipeline stages
- **AI next-action badges** — rule-based labels per lead (event soon, follow up, first contact, event passed)
- **Cold lead alerts** — banner on leads page for leads silent 5+ days
- Booking management with deposit/balance tracking
- **Payment status badges** — Unpaid / Deposit Paid / Fully Paid / Overdue per booking
- **Overdue alerts** — banner on bookings page for events passed without full payment
- Crafty AI — two modes:
  - **Advisor** (business advice, draft messages) — Groq llama-3.1-8b-instant
  - **CRM Actions** (reads/writes DB) — Groq llama-3.3-70b-versatile with tool calling
- **Crafty tools:** get_leads, create_lead, update_lead, get_bookings, create_booking, log_payment, get_revenue_summary, convert_lead_to_booking, get_urgent_leads
- **Paste DM** — 📋 button in CRM Actions, paste raw inquiry, Crafty creates lead
- **Revenue dashboard card** — this month confirmed / collected / outstanding
- **Dashboard charts** — bar chart (bookings/month) + source donut
- **Booking confirmation smart link** — public page /confirm/[token] with event details, GCash 0993-632-4512, and terms
- **Semaphore SMS follow-up** — cron sends Taglish SMS to leads with phone numbers
- Invoice generation
- Google Calendar integration
- Auto follow-up cron + 3-day booking reminders
- **Open beta ready** — delete INVITE_CODE from Vercel to open signups

**Main problems still open:**
- Meta API full approval blocked (needs BIR registration) — Messenger bot limited
- PayMongo not yet available to James — payment link automation pending
- Custom package builder not yet built
- Crafty AI training UI not yet built

**What to build next:**
1. Custom package builder — click-to-build quotes with add-ons, flows into invoice + Crafty
2. Crafty AI training UI — configure packages/pricing from app, no code
3. Open beta launch — remove invite code when ready
4. PayMongo payment links — when James can sign up

---

## Business Context

- Debt: ₱32,990 due June 5, 2026
- June events: June 4, 5, 14, 28
- Lifetime ad spend: ₱9,800 → ₱54,250 revenue (5.5x ROAS)
- Plan: resume ads at ₱150/day after June 5, point to website not Messenger
- GCash number: 0993-632-4512
- Semaphore API key: set in .env.local and needs to be added to Vercel env vars
- Referral system launched June 1 on portfolio site

---

## Tech Stack

| Layer | Tool |
|---|---|
| Framework | Next.js 16, App Router, TypeScript |
| Database | Supabase (PostgreSQL) |
| AI — Advisor | Groq — llama-3.1-8b-instant |
| AI — CRM Actions | Groq — llama-3.3-70b-versatile (tool calling) |
| Hosting | Vercel |
| Messenger | Meta Messenger Platform API (Graph API v19.0) — partially blocked |
| Cron | Vercel Cron |
| SMS | Semaphore PH (SEMAPHORE_API_KEY set) |
| Charts | recharts |
| Drag-and-drop | @hello-pangea/dnd |

---

## Key Files

| File | Purpose |
|---|---|
| `src/types/index.ts` | All TypeScript interfaces — always check here first |
| `src/app/leads/page.tsx` | Lead pipeline — list + kanban board + cold alerts + next-action badges |
| `src/app/bookings/page.tsx` | Booking management — overdue alerts + payment badges |
| `src/app/page.tsx` | Dashboard — revenue card + charts |
| `src/app/confirm/[token]/page.tsx` | Public booking confirmation page |
| `src/app/api/crafty-assist/route.ts` | Crafty CRM Actions — tool calling, all DB tools |
| `src/app/api/chat/route.ts` | Crafty Advisor — business advice, no DB access |
| `src/components/ChatWidget.tsx` | Floating chat — Advisor + CRM Actions tabs + Paste DM |
| `src/app/api/cron/follow-up/route.ts` | Daily follow-up — Messenger + Semaphore SMS |
| `src/app/api/cron/reminders/route.ts` | 3-day booking reminders |
| `src/app/api/messenger/route.ts` | Crafty AI webhook — main Messenger bot |
| `DOCUMENTATION.md` | Full schema, API routes, feature docs |
| `CLAUDE_RULES.md` | Coding rules — read before touching anything |

---

## Rules (from CLAUDE_RULES.md)

- Minimal diffs only — never rewrite full files
- 25-line cap — enter Plan Mode if more than 25 lines need changing
- Never use `any` or `@ts-ignore` — use `src/types/index.ts`
- Never change Groq model IDs without being asked
- Build check (`npx next build`) before every commit

---

## How to Start a Session

1. Read this file ✅
2. Ask James what he wants to fix or build
3. Check relevant source files before touching anything
4. Remember: SEMAPHORE_API_KEY needs to be added to Vercel env vars
