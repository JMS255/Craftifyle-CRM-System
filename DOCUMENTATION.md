# Craftifyle CRM — Documentation
**Version:** 1.3.0  
**Last Updated:** June 2, 2026  
**Built by:** James Ignacio + Claude AI  
**Stack:** Next.js App Router, TypeScript, Tailwind CSS v4, Supabase, Groq, Vercel

---

## Table of Contents
1. [What This CRM Does](#what-this-crm-does)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Database Schema](#database-schema)
5. [Environment Variables](#environment-variables)
6. [Features](#features)
7. [Crafty AI](#crafty-ai)
8. [API Routes](#api-routes)
9. [Cron Jobs](#cron-jobs)
10. [Deployment](#deployment)
11. [Pending / Known Issues](#pending--known-issues)
12. [Roadmap](#roadmap)

---

## What This CRM Does

Craftifyle CRM is a full-stack business management system built for Filipino service solopreneurs — starting with Craftifyle, a photobooth and event photography business in Zamboanga City, Philippines.

It handles:
- Tracking leads through a sales pipeline (kanban + list view)
- Crafty AI — chat assistant that reads/writes the CRM in plain English
- Paste DM — paste a raw Messenger inquiry, Crafty creates the lead instantly
- Facebook Messenger auto-reply bot (Crafty AI, currently pending BIR for Meta approval)
- Managing confirmed bookings and payments
- Invoice generation (printable PDF)
- Public booking confirmation smart link (no login required)
- Google Calendar sync on bookings
- SMS follow-up via Semaphore PH
- Auto follow-up messages for quiet leads (cron)
- 3-day booking reminders (cron)
- Ad performance tracking via Messenger ref links
- Personal and business income/expense tracking

**Live URL:** https://craftifyle-crm-system.vercel.app  
**GitHub:** https://github.com/JMS255/Craftifyle-CRM-System  
**Marketing site:** craftycrm-website (separate folder)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js App Router, TypeScript, Tailwind CSS v4 |
| Database | Supabase (PostgreSQL) |
| AI — Advisor | Groq API — llama-3.1-8b-instant |
| AI — CRM Actions | Groq API — llama-3.3-70b-versatile (tool calling) |
| AI — Messenger bot | Groq API — llama-3.3-70b-versatile |
| AI — Lead extraction | Groq API — llama-3.1-8b-instant |
| Hosting | Vercel (auto-deploy from GitHub master) |
| Messenger | Meta Messenger Platform API (Graph API v19.0) — blocked pending BIR |
| SMS | Semaphore PH |
| Calendar | Google Calendar API |
| Charts | recharts |
| Drag-and-drop | @hello-pangea/dnd |
| Cron Jobs | Vercel Cron |

---

## Project Structure

```
craftifyle-crm/
├── src/
│   ├── app/
│   │   ├── page.tsx                        # Dashboard — revenue card, charts, today's actions
│   │   ├── layout.tsx                      # Root layout with sidebar
│   │   ├── globals.css                     # Design system — tokens, card/table/button styles
│   │   ├── leads/
│   │   │   ├── page.tsx                    # Leads — list + kanban, cold alerts, AI badges
│   │   │   ├── new/page.tsx                # Progressive add lead form
│   │   │   └── [id]/page.tsx               # Lead detail, follow-up templates, activity log
│   │   ├── bookings/
│   │   │   ├── page.tsx                    # Bookings — overdue alert, payment status badges
│   │   │   └── [id]/
│   │   │       ├── page.tsx                # Booking detail — mark paid, share link
│   │   │       └── invoice/page.tsx        # Printable PDF invoice with add-ons
│   │   ├── confirm/
│   │   │   └── [token]/page.tsx            # Public booking confirmation page (no login)
│   │   ├── ads/
│   │   │   └── page.tsx                    # Ad performance dashboard
│   │   ├── personal/
│   │   │   └── page.tsx                    # Personal income & expenses
│   │   ├── profile/
│   │   │   └── page.tsx                    # User profile — name, business, city
│   │   ├── login/
│   │   │   └── page.tsx                    # Login page
│   │   ├── signup/
│   │   │   └── page.tsx                    # Signup — invite code (or open beta)
│   │   ├── privacy/
│   │   │   └── page.tsx                    # Privacy policy (for Meta App Review)
│   │   └── api/
│   │       ├── chat/route.ts               # Crafty Advisor (llama-3.1-8b, no DB)
│   │       ├── crafty-assist/route.ts      # Crafty CRM Actions (tool calling, writes DB)
│   │       ├── reply/route.ts              # AI reply draft generator
│   │       ├── messenger/route.ts          # Crafty Messenger webhook (Meta bot)
│   │       ├── auth/
│   │       │   └── check-invite/route.ts   # Invite code validator
│   │       ├── bookings/
│   │       │   └── sync-calendar/route.ts  # Google Calendar sync endpoint
│   │       └── cron/
│   │           ├── follow-up/route.ts      # Daily auto follow-up (Messenger + SMS)
│   │           └── reminders/route.ts      # 3-day booking reminders
│   ├── components/
│   │   ├── Sidebar.tsx                     # Desktop sidebar + mobile bottom nav + Quick Add sheet
│   │   ├── ChatWidget.tsx                  # Floating AI chat — Advisor + CRM Actions + Paste DM
│   │   ├── PackagePicker.tsx               # Package + add-on selector, auto-calculates total
│   │   ├── OnboardingModal.tsx             # First-run onboarding checklist
│   │   └── ThemeProvider.tsx               # Dark/light mode provider
│   ├── lib/
│   │   ├── supabase.ts                     # Supabase browser client
│   │   ├── supabase-server.ts              # Supabase server client (SSR)
│   │   ├── supabase-admin.ts               # Supabase admin client (service role)
│   │   └── google-calendar.ts             # Google Calendar API helpers
│   ├── middleware.ts                       # Auth middleware — route protection
│   └── types/
│       └── index.ts                        # All TypeScript interfaces — check here first
├── vercel.json                             # Cron job schedules
├── .env.local                              # Environment variables (not in git)
├── DOCUMENTATION.md                        # This file
├── CLAUDE.md / CLAUDE_RULES.md            # AI coding rules
└── supabase-*.sql                          # DB migration files
```

---

## Database Schema

All tables include a `user_id uuid` column (FK to `auth.users`) for multi-tenant data isolation. All queries filter by `user_id`.

### `leads`

| Column | Type | Description |
|---|---|---|
| id | uuid | Primary key |
| user_id | uuid | FK to auth.users |
| name | text | Client full name |
| phone | text | Phone number |
| email | text | Email address |
| facebook | text | Facebook profile or messenger sender ID |
| event_type | text | wedding, birthday, debut, corporate, christmas_party, reunion, baptism, other |
| event_date | date | Event date |
| venue | text | Event venue |
| guest_count | integer | Number of guests |
| package | text | Package interest or name |
| budget | numeric | Client budget |
| status | text | new → contacted → quoted → negotiating → booked → lost → completed |
| source | text | facebook, instagram, referral, walk-in, website, tiktok, other |
| notes | text | Free notes |
| messenger_sender_id | text | Facebook Messenger sender ID (unique) |
| ad_ref | text | Ad source tag from m.me/?ref= |
| crafty_active | boolean | Whether Crafty Messenger bot is handling this lead (default: true) |
| last_followup_sent | timestamptz | When last auto follow-up was sent |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `bookings`

| Column | Type | Description |
|---|---|---|
| id | uuid | Primary key |
| user_id | uuid | FK to auth.users |
| lead_id | uuid | FK to leads (nullable) |
| event_name | text | e.g. "Maria's Debut" |
| event_date | date | |
| event_time | text | e.g. "6:00 PM" |
| venue | text | |
| package_name | text | e.g. "Photobooth + Photography + Magnet prints" |
| package_price | numeric | Total price |
| deposit_amount | numeric | Deposit amount |
| deposit_paid | boolean | |
| deposit_paid_date | date | |
| balance_amount | numeric | Remaining balance |
| balance_paid | boolean | |
| balance_paid_date | date | |
| status | text | upcoming, completed, cancelled |
| craftifyle_income | numeric | Business income from this booking |
| personal_income | numeric | Personal income |
| gcal_event_id | text | Google Calendar event ID (for sync/update) |
| notes | text | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `activities`

| Column | Type | Description |
|---|---|---|
| id | uuid | Primary key |
| lead_id | uuid | FK to leads |
| type | text | note, call, message, follow_up |
| content | text | Activity description |
| follow_up_date | date | For follow_up type |
| completed | boolean | |
| created_at | timestamptz | |

### `messenger_conversations`

| Column | Type | Description |
|---|---|---|
| id | uuid | Primary key |
| sender_id | text | Messenger sender ID |
| role | text | user or assistant |
| content | text | Message content |
| created_at | timestamptz | |

### `personal_income` / `personal_expenses`

Personal finance tracker — separate from booking revenue.

| Column | Type |
|---|---|
| id | uuid |
| user_id | uuid |
| description | text |
| amount | numeric |
| income_date / expense_date | date |
| category | text |
| notes | text |
| created_at | timestamptz |

---

## Environment Variables

Stored in `.env.local` (never committed) and Vercel Environment Variables.

```env
NEXT_PUBLIC_SUPABASE_URL=          # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=     # Supabase anon key
GROQ_API_KEY=                      # Groq API key (Crafty AI)
MESSENGER_APP_SECRET=              # Meta app secret for webhook verification
MESSENGER_VERIFY_TOKEN=            # craftifyle_webhook_2026
MESSENGER_PAGE_ACCESS_TOKEN=       # Facebook Page access token
CRON_SECRET=                       # craftifyle_cron_2026 (protects cron endpoints)
SEMAPHORE_API_KEY=                 # 75a671289eda9b6b08a32fe272f80292 (SMS PH)
GOOGLE_CLIENT_ID=                  # Google OAuth client ID (Calendar)
GOOGLE_CLIENT_SECRET=              # Google OAuth client secret
GOOGLE_REFRESH_TOKEN=              # Google OAuth refresh token
INVITE_CODE=                       # Delete this var to enable open beta signups
```

---

## Features

### Dashboard (`/`)
- Revenue card: Confirmed / Collected / Outstanding for current month
- Today's Actions card — top 3 urgent leads, click to navigate
- Quick-prompt chips: Paste DM · What needs attention · Revenue · Draft follow-up
- Onboarding checklist for new users (progress bar, dismissible)
- Charts: bookings/month bar chart + lead source donut (recharts)

### Leads (`/leads`)
- List view: table (desktop) + cards (mobile) with AI next-action badges
- Board view: kanban — 6 columns, drag-and-drop on desktop, tab + single-column on mobile
- Cold lead alerts banner — leads silent 5+ days, color-coded warm/cold/very cold
- Search by name, filter by status and source
- Mobile Quick Add "+" in bottom nav → sheet: Add Lead, Paste DM, Log Payment

### Lead Detail (`/leads/[id]`)
- Full client info — event details, source, budget
- Pipeline stage selector (click to update)
- Crafty AI toggle — mute Messenger bot for this lead
- Follow-up templates: 3 Taglish messages + "Open Messenger" deep link
- Activity log: notes, calls, messages, follow-ups with dates
- Convert to Booking form
- Messenger conversation viewer (bubble UI, from `messenger_conversations`)

### Bookings (`/bookings`)
- Grouped by month with accordion
- Overdue alert banner — event passed, balance unpaid
- Payment status badge per row: Unpaid / Deposit Paid / Fully Paid / Overdue

### Booking Detail (`/bookings/[id]`)
- Mark deposit/balance paid — green flash micro-animation on confirm
- Set booking status (upcoming/completed/cancelled)
- "🔗 Share Link" — copies public confirmation URL
- Google Calendar add/update sync button
- Log craftifyle income vs personal income separately

### Invoice (`/bookings/[id]/invoice`)
- Printable PDF — business header, client info, package price, add-ons as line items
- Deposit paid, balance due, GCash 0993-632-4512
- Print/Save PDF button

### Public Confirmation (`/confirm/[token]`)
- No login required — shareable link for clients
- Shows: event name, date, venue, package breakdown, GCash info, cancellation terms

### Ad Performance (`/ads`)
- Leads / bookings / conversion % / revenue per `ad_ref` tag
- Organic (no tag) shown separately
- Instructions for m.me ref link setup

### Personal Finance (`/personal`)
- Income and expenses tracker, separate from business
- Categories, dates, notes — grouped by month with net summary

### Profile (`/profile`)
- Set full name, business name, city — shown throughout the CRM

### PackagePicker component
- 4 package cards + toggleable add-ons, auto-calculates total
- Add-ons appended to `package_name` (e.g. "Photobooth + Photography + Magnet prints")
- Invoice renders add-ons as separate line items

---

## Crafty AI

Crafty has two independent modes inside the ChatWidget floating button.

### Mode 1 — Advisor (`/api/chat`)
- Model: `llama-3.1-8b-instant`
- Business advisor — no database access
- Knows today's date (injected at request time)

### Mode 2 — CRM Actions (`/api/crafty-assist`)
- Model: `llama-3.3-70b-versatile` with tool calling (temp 0.3, max 3 tool rounds)
- Reads and writes Supabase directly
- Auth: checks Supabase session, all queries filtered by `user_id`
- Uses `createAdminClient()` (service role) with manual `user_id` filter

**Available tools:**

| Tool | What it does |
|---|---|
| `get_leads` | List/search leads, filter by status |
| `create_lead` | Insert new lead |
| `update_lead` | Update any lead field |
| `get_bookings` | List bookings by status |
| `create_booking` | Insert new booking |
| `log_payment` | Mark deposit or balance as paid |
| `get_revenue_summary` | Total revenue, optionally by month |
| `get_urgent_leads` | Scored by urgency — upcoming events, quiet leads, passed events |
| `convert_lead_to_booking` | One message: finds lead, creates booking, updates lead status to booked |

**Packages Crafty knows (exact names and prices):**
- "Photobooth Only" → ₱3,500 (3 hrs, unlimited shots, custom backdrop)
- "Photography Only" → ₱4,500 (3 hrs, 300+ edited photos)
- "Photobooth + Photography" → ₱6,500 (3 hrs, both services) — most popular
- "Premium Bundle" → ₱8,000 (4 hrs, photography + videography, 400+ photos, pre-event shoot)

**Add-ons (appended to package name):**
- "Extended coverage (+1 hr)" → +₱800
- "Magnet prints (150 pcs)" → +₱1,500
- "Custom template design" → FREE
- "30-sec highlight video" → FREE

### ChatWidget features
- **Paste DM** — 📋 button opens panel, paste raw Messenger inquiry, Crafty extracts details and calls `create_lead`
- Each tab (Advisor / CRM Actions) keeps its own separate message history
- Pulse animation + tooltip on first 3 sessions (discoverability)
- External trigger: `window.dispatchEvent(new CustomEvent('crafty-prompt', { detail: { prompt, mode } }))`
- Quick-prompt chips on dashboard fire prompts via this CustomEvent

### Mode 3 — Messenger Bot (`/api/messenger`)
- Model: `llama-3.3-70b-versatile` (sales flow) + `llama-3.1-8b-instant` (lead extraction)
- **Status: BLOCKED** — pending Meta Business Verification (needs BIR registration)
- Replies in Taglish, follows discovery → recommendation → objection → GCash deposit flow
- Memory: last 10 messages stored in `messenger_conversations`
- Checks `crafty_active` before responding — toggle per lead to take over manually
- When client says "PAID": auto-creates booking, syncs to Google Calendar

---

## API Routes

| Route | Method | Description |
|---|---|---|
| `/api/chat` | POST | Crafty Advisor (no DB, business advice) |
| `/api/crafty-assist` | POST | Crafty CRM Actions (tool calling, writes DB) |
| `/api/messenger` | GET | Facebook webhook verification |
| `/api/messenger` | POST | Receive and process Messenger messages |
| `/api/reply` | POST | Generate AI reply draft for a lead |
| `/api/bookings/sync-calendar` | POST | Sync a booking to Google Calendar |
| `/api/auth/check-invite` | POST | Validate invite code on signup |
| `/api/cron/follow-up` | GET | Auto follow-up cron (protected by CRON_SECRET) |
| `/api/cron/reminders` | GET | Booking reminder cron (protected by CRON_SECRET) |

---

## Cron Jobs

Configured in `vercel.json`. Run automatically on Vercel.

| Job | Schedule (UTC) | PH Time | What it does |
|---|---|---|---|
| `/api/cron/follow-up` | `0 10 * * *` | 6:00 PM | Sends follow-up to leads quiet for 24h+ via Messenger or Semaphore SMS |
| `/api/cron/reminders` | `0 9 * * *` | 5:00 PM | Sends reminder to clients 3 days before event |

Both require `Authorization: Bearer craftifyle_cron_2026` header.

---

## Deployment

**Platform:** Vercel  
**Auto-deploy:** Every push to `master` branch  
**URL:** https://craftifyle-crm-system.vercel.app

```bash
git add <files>
git commit -m "message"
git push origin master
```

**Open beta:** Delete `INVITE_CODE` from Vercel env → anyone can sign up without an invite code.

---

## Pending / Known Issues

| Issue | Status |
|---|---|
| Meta Business Verification — Crafty Messenger bot blocked | ⚠️ Needs BIR registration |
| SEMAPHORE_API_KEY not yet added to Vercel env vars | ⚠️ Add value: 75a671289eda9b6b08a32fe272f80292 |
| Ad ref tracking doesn't work with Meta Chat Builder campaigns | ⚠️ Use Traffic campaign objective |
| SQL migrations must be run manually in Supabase SQL Editor | ⚠️ Manual step |

---

## UI Design System (as of June 2, 2026)

**Accent:** `#7c6ff7` (warm violet)  
**Dark surface ladder:** Page `#09090f` · Card `#0f0f17` · Sidebar `#141420` · Hover `#1a1a2a` · Active `#1f1f33`  
**Border system:** Subtle `rgba(255,255,255,0.05)` · Default `rgba(255,255,255,0.08)` · Strong `rgba(255,255,255,0.14)`  
**Typography:** Body 15px · Headings weight 600, letter-spacing -0.015em · ALL CAPS labels 11px weight 500  
**Border radius:** 6px badges/inputs · 10px buttons · 14px cards · 9999px pills  
**Transitions:** 150ms on all interactive elements  
**Card detail:** `box-shadow: inset 0 1px 0 rgba(255,255,255,0.06)`

**Phase 1 ✅** — Token unification, new accent, card inset shadow, `.card` + `.section-label` classes, sidebar active state  
**Phase 2 ✅** — Global table system, typography letter-spacing, button press scale + focus ring, mobile nav backdrop-blur, `.tabular` number class  
**Phase 3 ✅** — `ads/page.tsx`, `personal/page.tsx`, `login/page.tsx`, `signup/page.tsx` full token pass. All pages now use CSS vars exclusively. `profile/page.tsx` was already clean.  
**Phase 4 — Next** — Skeleton loaders only (replace `Loading…` text across all pages with animated pulsing shapes)

---

## Roadmap

### Immediate
- Add `SEMAPHORE_API_KEY` to Vercel env vars
- UI Redesign Phase 4 — skeleton loaders (only remaining item)

### Sprint 2 (July 2026)
- Custom package builder in UI — configure from app without code
- Crafty AI training UI — set packages, pricing, personality from app

### Sprint 3 (August 2026)
- GCash / PayMongo payment links — auto-generate per booking, webhook marks deposit paid
- Unified conversations inbox — all Messenger threads in one place
- Booking contracts + e-sign

### Future
- Client portal — clients view booking, download invoice, see payment status
- Instagram DM bot — alternative intake while Messenger API is pending
- Facebook Ads API integration — real spend, CPC, ROI per campaign
- Mobile app (React Native)
- White-label SaaS — resell Crafty CRM under your own brand

### Vision
Turn Craftifyle CRM into a white-label SaaS for Filipino service solopreneurs —
photographers, videographers, florists, caterers, hair & makeup, event stylists, hosts.
Target: ₱800/mo Starter → ₱1,200/mo Pro → Custom bespoke builds (₱30K–₱80K).
