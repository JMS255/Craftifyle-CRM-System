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

### Immediate
1. **SEMAPHORE_API_KEY** — add to Vercel env vars (value: 75a671289eda9b6b08a32fe272f80292)
2. **Run `supabase-migration-packages.sql`** — packages table not yet created in Supabase SQL Editor
3. **True visual identity** — future decision: bolder color story (amber accent, gradient backgrounds), stronger typography contrast, something uniquely Craftifyle
4. **Skipped UX items** — C4 swipe-to-action, C6 Facebook Login, H7 optimistic UI, N1–N6 nice-to-haves

### After UI polish
4. **PayMongo payment links** — when James can sign up
5. **Crafty AI training UI** — configure packages/pricing from app
6. **Booking contracts + e-sign**
7. **Client portal**

---

## UI Redesign Progress

### Polish Pass (Phases 1–4) ✅ Complete
**Phase 1** — Token unification, new accent `#7c6ff7`, `.card` + `.section-label` classes, sidebar active nav.  
**Phase 2** — Global table system, typography letter-spacing, button press scale, mobile nav backdrop-blur.  
**Phase 3** — All remaining pages (`ads`, `personal`, `login`, `signup`) full token pass. All CSS vars, no hardcoded grays.  
**Phase 4** — Skeleton loaders on all pages via `.skeleton` shimmer animation in globals.css.

### Full Visual Redesign ✅ Complete (June 2)

| Page | What changed |
|---|---|
| Dashboard | Greeting + time-of-day, revenue hero strip, pipeline snapshot bar, Today's Actions with colored left borders, chips + charts moved to bottom. Removed max-width so it fills full content area. |
| Leads list + Kanban | Avatar initials colored by stage, colored left border per row, 5-col table, action badge under name. Kanban: w-64 cards, avatar, stage color on drop. Mobile: left border + avatar. |
| Lead detail | 2-col desktop layout (info+convo+activity left, actions right), visual pipeline progress bar with steps + connectors, timeline activity log, Convert to Booking as collapsible card. |
| Booking detail | Payment progress bar showing % collected, larger numbers, Craftifyle Income uses accent vars. |
| Bookings list | Year selector, status filter, month header, table rows, mobile cards — all CSS vars. |
| New lead form | Back link, error, submit button → CSS vars. |
| Sidebar | SVG icons replacing emoji. Profile page gets sign out + theme toggle for mobile (was missing entirely). |

**Honest note:** The redesign restructured layouts and fixed visual hierarchy — revenue first, actions prominent, avatar identity on leads. The *color story* and overall aesthetic feel is still the same dark navy/purple app. A truly different look would need: bolder use of amber secondary accent, more dramatic typography scale, more whitespace, something uniquely Craftifyle. That's a future decision on visual direction.

### Other additions (June 2)
- **Settings/Packages page** (`/settings`) — manage packages + prices, Crafty reads from DB dynamically. Run `supabase-migration-packages.sql` to activate.
- **Mobile nav** — 5 tabs with SVG icons, sign out bug fixed (was never accessible on mobile).
- **craftycrm-website** — changelog + roadmap updated.

## UI Redesign Spec (from June 1 research)

**Core problem:** Token inconsistency (half app uses hardcoded `bg-white`/`text-gray-900`, other half uses CSS vars) + no design identity.

**Accent shift:** `#6366f1` → `#7c6ff7` (slightly warmer violet, same family, looks intentional not default)

**Dark surface ladder (no shadows — borders only):**
- Page: `#09090f` · Card: `#0f0f17` · Sidebar: `#141420` · Hover: `#1a1a2a` · Active: `#1f1f33`

**Border system (opacity-based):**
- Subtle: `rgba(255,255,255,0.05)` · Default: `rgba(255,255,255,0.08)` · Strong: `rgba(255,255,255,0.14)`

**Typography fixes:**
- Body: 15px (not 16px) · Headings: weight 600, letter-spacing -0.015em
- ALL CAPS labels: 11px weight 500 letter-spacing 0.08em
- Add `font-feature-settings: "calt", "liga", "kern"` to base CSS

**Border radius — 3 tiers only:**
- 6px: badges, inputs · 10px: buttons · 14px: all cards · 9999px: pills
- Kill `rounded-xl` (12px) and `rounded-2xl` (16px) — replace with 14px

**Key micro-details:**
- Inset top border on dark cards: `box-shadow: inset 0 1px 0 rgba(255,255,255,0.06)`
- 150ms transitions on everything (not 300ms)
- Primary text: `#f4f4f6` not pure `#ffffff`
- 1px card lift on hover: `transform: translateY(-1px)`
- Remove all vertical table borders
- Skeleton loaders instead of spinners

**Filipino context:**
- Add amber `#f59e0b` as secondary accent (prosperity/craftsmanship associations)
- Light mode warm white: `#fafaf8` not cold `#ffffff`
- Minimum 12px text always

**Full spec in craftycrm-website Research → UI Design tab**

---

## Market Position (from June 2 research)

- PH CRM market: **$134.7M, growing 13.19% per year**
- **Craftifyle is the only Filipino-built CRM for service solopreneurs** — zero direct competitors in this niche
- 47–70% of CRM deployments in PH fail due to poor tool fit — Craftifyle's out-of-the-box setup is the fix
- Real competition is NOT Zoho/HubSpot — it's **Messenger + Google Sheets** (inertia from below)
- The #1 lost-lead cause in PH: response latency. Crafty AI + SMS directly solves this.
- Eventchy (Metro Manila marketplace) is a **partner opportunity**, not a competitor
- Positioning: "Filipino-built, peso-priced, pre-built for your business type"
- Zamboanga/Visayas/Mindanao are completely underserved — every competitor is Metro Manila-focused
- Full competitive analysis: craftycrm-website Research → Market Research tab

## Target Market Expansion (not photobooth-only)

The photobooth niche is the beachhead — but the real market is all Filipino service solopreneurs:
- Photographers, videographers
- Florists, caterers, event stylists
- Wedding coordinators, hosts, emcees
- Hair and makeup artists
- Any solo service business managing leads + bookings + invoices via Messenger

Pricing model: Free (hook) → ₱800/mo Starter → ₱1,200/mo Pro → Custom bespoke builds (₱30K–₱80K)

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
