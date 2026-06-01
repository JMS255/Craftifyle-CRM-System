# Craftifyle CRM — Session Context

> Read this at the start of every new session to get fully caught up.
> Last updated: June 1, 2026

---

## Who I Am

James Ignacio — owner of Craftifyle, photobooth + event photography business in Zamboanga City, Philippines. Self-taught developer using Claude Code. Shifted from Biomedical Engineering to BSIT in June 2025. Running a real business while building software.

---

## Two Active Projects

1. **james-portfolio** — Public website (craftifyle.business) — booking wizard, referral system, admin tools
2. **craftifyle-crm** — THIS PROJECT — internal CRM with Crafty AI Messenger bot

---

## CRM Current Status (June 1, 2026)

**What's working:**
- Lead pipeline (new → contacted → quoted → negotiating → booked → lost → completed)
- Booking management with deposit/balance tracking
- Crafty AI — automated Facebook Messenger sales bot (Groq llama-3.3-70b-versatile)
- Auto-creating leads from Messenger conversations
- Ad performance tracking via m.me/?ref= links
- Personal income & expense tracking
- Invoice generation
- Google Calendar integration
- Auto follow-up cron for quiet leads
- Booking reminders 3 days before events

**Main problems:**
- Too much manual data entry — causes friction and inconsistency
- James stops using it when it requires too much effort to maintain
- Crafty AI works but Meta API full approval blocked (needs BIR registration)
- Need more automation so data populates itself

**What we want to build next:**
- Reduce manual entry friction
- Auto-populate lead data from Messenger
- Follow-up tracker
- More automation so James stays consistent

---

## Business Context

- Debt: ₱32,990 due June 5, 2026
- June events: June 4, 5, 14, 28
- Lifetime ad spend: ₱9,800 → ₱54,250 revenue (5.5x ROAS)
- Plan: resume ads at ₱150/day after June 5, point to website not Messenger
- Ron Soriano: photographer partner from May 30 event
- Referral system launched June 1 on portfolio site
- 30 past client DMs sent with WELCOMEBACK codes

---

## Tech Stack

| Layer | Tool |
|---|---|
| Framework | Next.js 16, App Router, TypeScript |
| Database | Supabase (PostgreSQL) |
| AI Bot | Groq — llama-3.3-70b-versatile (sales), llama-3.1-8b-instant (extraction) |
| Hosting | Vercel |
| Messenger | Meta Messenger Platform API (Graph API v19.0) |
| Cron | Vercel Cron |

---

## Key Files

| File | Purpose |
|---|---|
| `src/types/index.ts` | All TypeScript interfaces — always check here first |
| `src/app/leads/` | Lead pipeline pages |
| `src/app/bookings/` | Booking management |
| `src/app/ads/` | Ad performance dashboard |
| `src/app/personal/` | Personal finances |
| `src/app/api/messenger/route.ts` | Crafty AI webhook — main bot |
| `src/app/api/cron/follow-up/route.ts` | Daily auto follow-up |
| `src/app/api/cron/reminders/route.ts` | 3-day booking reminders |
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
2. Read `DOCUMENTATION.md` for full schema
3. Ask James what he wants to fix or build
4. Check relevant source files before touching anything
