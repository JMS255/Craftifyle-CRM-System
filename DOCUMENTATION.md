# Craftifyle CRM — Documentation
**Version:** 1.1.0  
**Last Updated:** May 27, 2026  
**Built by:** James Ignacio + Claude AI  
**Stack:** Next.js 16, TypeScript, Tailwind CSS v4, Supabase, Groq, Vercel

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

Craftifyle CRM is a full-stack business management system built specifically for **Craftifyle** — a photobooth and event photography business in Zamboanga City, Philippines.

It handles:
- Facebook Messenger inquiries via **Crafty AI** (automated sales bot)
- Auto-creating leads from Messenger conversations
- Tracking leads through a sales pipeline
- Managing confirmed bookings and payments
- Generating invoices
- Tracking personal and business income/expenses
- Tracking ad performance via Messenger ref links
- Auto follow-up messages for quiet leads
- Booking reminders 3 days before events

**Live URL:** https://craftifyle-crm-system.vercel.app  
**GitHub:** https://github.com/JMS255/Craftifyle-CRM-System

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16.2.6 App Router, TypeScript, Tailwind CSS v4 |
| Database | Supabase (PostgreSQL) |
| AI (sales bot) | Groq API — llama-3.3-70b-versatile |
| AI (extraction) | Groq API — llama-3.1-8b-instant |
| Hosting | Vercel (auto-deploy from GitHub) |
| Messenger | Meta Messenger Platform API (Graph API v19.0) |
| Cron Jobs | Vercel Cron |

---

## Project Structure

```
craftifyle-crm/
├── src/
│   ├── app/
│   │   ├── page.tsx                        # Dashboard
│   │   ├── layout.tsx                      # Root layout with sidebar
│   │   ├── leads/
│   │   │   ├── page.tsx                    # Leads list
│   │   │   ├── new/page.tsx                # Add new lead manually
│   │   │   └── [id]/page.tsx               # Lead detail + Crafty toggle + conversation
│   │   ├── bookings/
│   │   │   ├── page.tsx                    # Bookings list (grouped by month)
│   │   │   └── [id]/
│   │   │       ├── page.tsx                # Booking detail
│   │   │       └── invoice/page.tsx        # Printable invoice
│   │   ├── ads/
│   │   │   └── page.tsx                    # Ad performance dashboard
│   │   ├── personal/
│   │   │   └── page.tsx                    # Personal income & expenses
│   │   ├── privacy/
│   │   │   └── page.tsx                    # Privacy policy (for Meta App Review)
│   │   └── api/
│   │       ├── chat/route.ts               # AI chat for portfolio website widget
│   │       ├── reply/route.ts              # AI reply draft generator
│   │       ├── messenger/route.ts          # Crafty AI webhook (main bot)
│   │       └── cron/
│   │           ├── follow-up/route.ts      # Daily auto follow-up for quiet leads
│   │           └── reminders/route.ts      # 3-day booking reminders
│   ├── components/
│   │   ├── Sidebar.tsx                     # Desktop sidebar + mobile bottom nav
│   │   └── ChatWidget.tsx                  # Floating chat widget
│   ├── lib/
│   │   └── supabase.ts                     # Supabase client
│   └── types/
│       └── index.ts                        # TypeScript interfaces
├── vercel.json                             # Cron job schedules
├── .env.local                              # Environment variables (not in git)
├── DOCUMENTATION.md                        # This file
├── supabase-schema.sql                     # Initial DB schema
├── supabase-migration-income.sql           # Income table migration
├── supabase-migration-personal-income.sql  # Personal income migration
├── supabase-migration-personal-expenses.sql
├── supabase-migration-messenger.sql        # Messenger conversations table
├── supabase-migration-leads-messenger.sql  # messenger_sender_id + ad_ref on leads
└── supabase-migration-features.sql        # crafty_active + last_followup_sent
```

---

## Database Schema

### `leads`
Stores every inquiry that comes in.

| Column | Type | Description |
|---|---|---|
| id | uuid | Primary key |
| name | text | Client full name |
| phone | text | Phone number |
| email | text | Email address |
| facebook | text | Facebook profile or messenger:senderId |
| event_type | text | wedding, birthday, debut, corporate, etc. |
| event_date | date | Event date |
| venue | text | Event venue |
| guest_count | integer | Number of guests |
| package | text | Recommended package |
| budget | numeric | Client budget |
| status | text | new, contacted, quoted, negotiating, booked, lost, completed |
| source | text | facebook, instagram, referral, walk-in, website, tiktok, other |
| notes | text | Free notes |
| messenger_sender_id | text | Facebook Messenger sender ID (unique) |
| ad_ref | text | Ad source tag from m.me/?ref= |
| crafty_active | boolean | Whether Crafty AI is handling this lead (default: true) |
| last_followup_sent | timestamptz | When last auto follow-up was sent |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `bookings`
Confirmed events converted from leads.

| Column | Type | Description |
|---|---|---|
| id | uuid | Primary key |
| lead_id | uuid | FK to leads |
| event_name | text | e.g. "Maria's Debut" |
| event_date | date | |
| event_time | text | e.g. "6:00 PM" |
| venue | text | |
| package_name | text | e.g. "Bundle 50 pax" |
| package_price | numeric | Total price |
| deposit_amount | numeric | Deposit paid |
| deposit_paid | boolean | |
| deposit_paid_date | date | |
| balance_amount | numeric | Remaining balance |
| balance_paid | boolean | |
| balance_paid_date | date | |
| status | text | upcoming, completed, cancelled |
| craftifyle_income | numeric | Business income from this booking |
| personal_income | numeric | Personal income |
| notes | text | |

### `activities`
Timeline of notes, calls, messages per lead.

| Column | Type | Description |
|---|---|---|
| id | uuid | Primary key |
| lead_id | uuid | FK to leads |
| type | text | note, call, message, follow_up |
| content | text | Activity description |
| follow_up_date | date | For follow_up type |
| completed | boolean | |

### `messenger_conversations`
Stores Messenger chat history per sender for Crafty AI memory.

| Column | Type | Description |
|---|---|---|
| id | uuid | Primary key |
| sender_id | text | Messenger sender ID |
| role | text | user or assistant |
| content | text | Message content |
| created_at | timestamptz | |

---

## Environment Variables

Stored in `.env.local` (never committed to git) and Vercel Environment Variables.

```env
NEXT_PUBLIC_SUPABASE_URL=          # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=     # Supabase service role key
GEMINI_API_KEY=                    # Google Gemini (backup AI)
GROQ_API_KEY=                      # Groq API key for Crafty AI
MESSENGER_APP_SECRET=              # Meta app secret for webhook verification
MESSENGER_VERIFY_TOKEN=            # craftifyle_webhook_2026
MESSENGER_PAGE_ACCESS_TOKEN=       # Facebook Page access token
CRON_SECRET=                       # craftifyle_cron_2026 (protects cron endpoints)
```

---

## Features

### 1. Dashboard (`/`)
- Total leads, bookings, revenue at a glance
- Recent leads and upcoming bookings
- Monthly revenue summary

### 2. Leads (`/leads`)
- List of all inquiries
- Filter by status and source
- Search by name
- Mobile: card view. Desktop: table view
- Click any lead → Lead Detail page

### 3. Lead Detail (`/leads/[id]`)
- Full client info (name, phone, email, event details)
- Pipeline stage selector (new → contacted → quoted → negotiating → booked → lost)
- **Crafty AI toggle** — mute Crafty for this lead so James can handle manually
- **Messenger conversation viewer** — full chat thread in bubble UI
- AI Reply Draft — paste client message, get a suggested reply
- Convert to Booking form
- Activity log (notes, calls, messages, follow-ups)

### 4. Bookings (`/bookings`)
- All confirmed bookings grouped by month
- Accordion per month
- Mobile: cards. Desktop: table
- Summary: upcoming count, total revenue, outstanding balance

### 5. Booking Detail (`/bookings/[id]`)
- Full booking info
- Mark deposit/balance as paid
- Set booking status
- Log craftifyle income separately
- **🧾 View Invoice button** → goes to invoice page

### 6. Invoice (`/bookings/[id]/invoice`)
- Clean printable invoice
- Business header (Craftifyle, James Ignacio, Zamboanga City)
- Client info, event details, package price, deposit paid, balance due
- GCash payment details
- Print / Save PDF button

### 7. Ad Performance (`/ads`)
- Table showing leads, bookings, conversion rate, revenue per ad_ref tag
- Organic leads (no tag) shown separately
- Instructions on how to tag ads using m.me ref links
- Summary cards: total leads, booked, conversion %, revenue

### 8. Personal Finance (`/personal`)
- Personal income and expenses tracker
- Separate from business income
- Categories, dates, notes

---

## Crafty AI

Crafty AI is an automated Facebook Messenger sales bot for Craftifyle.

**Model:** llama-3.3-70b-versatile (Groq)  
**Webhook:** `POST /api/messenger`  
**Memory:** Last 10 messages stored in `messenger_conversations` table

### How it works
1. Client messages Craftifyle Facebook page
2. Meta sends webhook to `POST /api/messenger`
3. Signature verified with `MESSENGER_APP_SECRET`
4. Conversation history fetched from Supabase
5. Groq generates reply using system prompt + history
6. Reply sent back via Graph API
7. Messages saved to Supabase
8. Background: llama-3.1-8b-instant extracts lead info and upserts to leads table

### Crafty's sales flow
1. **Discovery** — Collects: full name, event type, date, venue, start time, guest count
2. **Recommendation** — Suggests package based on pax and event type
3. **Objection handling** — Reframes price objections without discounting
4. **Booking** — Sends GCash deposit details (0993-632-4512 · James Ignacio)
5. **Confirmation** — Waits for client to say "PAID"
6. **Details collection** — Gets email and phone for invoice

### Pricing Crafty knows
- **Event Photography:** ₱3,000 (≤50 pax) / ₱4,000 (51-100) / ₱4,500 (101+)
- **Photobooth only:** ₱3,500 fixed
- **Bundle:** ₱5,000 (≤50 pax) / ₱6,500 (51+)
- **Add-on:** Magnet prints ₱1,500 for 150pcs (not included in any package)

### Takeover toggle
On any lead detail page, toggle **Crafty AI** off to silence the bot for that sender. Crafty checks `crafty_active` on the lead before responding.

---

## API Routes

| Route | Method | Description |
|---|---|---|
| `/api/messenger` | GET | Facebook webhook verification |
| `/api/messenger` | POST | Receive and process Messenger messages |
| `/api/chat` | POST | Chat widget for portfolio website (CORS enabled) |
| `/api/reply` | POST | Generate AI reply draft for a lead |
| `/api/cron/follow-up` | GET | Auto follow-up cron (protected by CRON_SECRET) |
| `/api/cron/reminders` | GET | Booking reminder cron (protected by CRON_SECRET) |

---

## Cron Jobs

Configured in `vercel.json`. Run automatically on Vercel.

| Job | Schedule | PH Time | What it does |
|---|---|---|---|
| `/api/cron/follow-up` | `0 10 * * *` | 6:00 PM | Sends follow-up to leads quiet for 24h+ |
| `/api/cron/reminders` | `0 9 * * *` | 5:00 PM | Sends reminder to clients 3 days before event |

Both require `Authorization: Bearer craftifyle_cron_2026` header.

---

## Deployment

**Platform:** Vercel  
**Auto-deploy:** Every push to `master` branch on GitHub triggers a deploy  
**URL:** https://craftifyle-crm-system.vercel.app

### To deploy manually:
```bash
git add -A
git commit -m "your message"
git push origin master
```

### Environment variables to set on Vercel:
All variables from `.env.local` must be added in Vercel → Settings → Environment Variables.

### Git checkpoints (tags):
- `v1.0-crafty-working` — Crafty AI working with memory, discovery, GCash, booking confirmation

---

## Pending / Known Issues

| Issue | Status |
|---|---|
| Meta Business Verification needed for public Crafty access | ⚠️ Needs Barangay Certificate |
| Groq free tier daily limits hit during heavy testing | ⚠️ Upgrade to paid or reduce history |
| Ad ref tracking doesn't work with Meta Chat Builder campaigns | ⚠️ Use Traffic campaign objective instead |
| SQL migrations must be run manually in Supabase SQL Editor | ⚠️ Manual step |
| CRON_SECRET must be added to Vercel env vars | ⚠️ Manual step |

### SQL migrations not yet run (run these in Supabase SQL Editor):
```sql
-- From supabase-migration-leads-messenger.sql
ALTER TABLE leads ADD COLUMN IF NOT EXISTS messenger_sender_id text UNIQUE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ad_ref text;
CREATE INDEX IF NOT EXISTS idx_leads_messenger_sender ON leads(messenger_sender_id);

-- From supabase-migration-features.sql
ALTER TABLE leads ADD COLUMN IF NOT EXISTS crafty_active boolean DEFAULT true;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_followup_sent timestamptz;
```

---

## Roadmap

### Next up
- [ ] Google Calendar integration — sync bookings to Google Calendar, auto-block dates on portfolio website
- [ ] Review requests — auto-send Google/Facebook review request after booking completed
- [ ] Manual ad_ref field on lead detail page
- [ ] Calendar view page for bookings

### Future (productization phase)
- [ ] Multi-tenant support (each business sees only their data)
- [ ] Auth / login system
- [ ] Business onboarding flow (auto-configure AI system prompt per industry)
- [ ] Configurable pipeline stages per business
- [ ] Dynamic service/product catalog
- [ ] Subscription billing

### Vision
Turn Craftifyle CRM into a white-label SaaS for Filipino service businesses —
events, salons, restaurants, tutorial centers, etc. Target: ₱800-1,500/month per business.
