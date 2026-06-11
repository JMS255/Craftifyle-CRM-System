# Craftifyle CRM — Session Context

> Read this at the start of every new session to get fully caught up.
> Last updated: June 11, 2026 (session 4 — Personal Finance Manager shipped, Sentry, Bookings→Finance sync)

---

## Who I Am

James Ignacio — owner of Craftifyle, photobooth + event photography business in Zamboanga City, Philippines. Self-taught developer using Claude Code. Shifted from Biomedical Engineering to BSIT in June 2025. Solo operator — Technical Founder of Craftifyle CRM, Technical Co-Founder of a second business, Acting CEO.

---

## Active Projects

1. **craftifyle-crm** — THIS PROJECT — internal CRM, now in open beta
2. **james-portfolio** — Public website (craftifyle.business) — booking wizard, referral system
3. **craftycrm-website** — Marketing + dev docs website for the CRM product
4. **laagan-adventure** - THIS Project is a travel and tours website for the second company
---

## CRM Current Status (June 11, 2026 — after Sprint 4–5 build sessions)

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
- Advisor tab → `/api/chat` — Gemini 2.5 Flash Lite, business advice, no DB access
- CRM Actions tab → `/api/crafty-assist` — Gemini 2.5 Flash Lite with tool calling
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
- Animations: FAB glow pulse, panel slide-up/down CSS transition (always mounted), 3-dot typing indicator, message slide-in, suggestion chip stagger

**UX Improvements (June 9, session 2)**
- Delete leads and bookings — red Delete button on detail pages, confirm dialog, redirects to list
- Lost leads hidden from default list view — shown only when "lost" filter is explicitly selected
- KPI cards mobile overflow fixed — `grid grid-cols-2 md:grid-cols-4` instead of flex row
- ChatWidget: FAB glow pulse, panel slide-up/slide-down CSS transition (always mounted), 3-dot typing indicator, message slide-in, suggestion chip stagger

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
- **Migrated to Firebase Auth** (June 9, 2026) — Supabase paused the project
- Login → Firebase `signInWithEmailAndPassword` → POST `/api/auth/session` → `__session` httpOnly cookie (5 days)
- On login → POST `/api/auth/post-login` → auto-migrates old Supabase-UID data to new Firebase UID by email match
- Session cookie verified via `firebase-admin` (`adminAuth.verifySessionCookie`)
- **Fixed (June 9):** `jose` ESM/CJS conflict with Turbopack — resolved by pinning jose to v4.x via `package.json` overrides + `serverExternalPackages` in next.config.ts. Deployed to Vercel.
- Open beta ready: delete INVITE_CODE from Vercel env → anyone can sign up
- Signup page auto-skips invite step if open beta is on
- **Login redesign (June 11):** Facebook login removed, Google sign-in added (matches signup page style). `__session` cookie auth flow unchanged.

**Personal Finance Manager (June 11, 2026) — Sprint 5**
- Full `/personal` page rebuilt as cash flow command center
- **CashPositionCard** — multi-source cash tracker (Maribank, cash on hand, etc.), inline edit, shows running total
- **ConfirmedIncomingCard** — pending non-revenue income, "Mark Received" converts to income entry + removes from pending list
- **DebtScheduleCard** — one card per debt, next payment shown, tap to expand full month grid, month markers use pure arithmetic (no timezone bug)
- **SurvivalProjectionCard** — swipeable month cards showing Opening → +Revenue → +Incoming → −Debt → −Expenses → End cash, color-coded; fixed timezone bug on month labels
- **FinanceStatusBanner** — AI-generated one-liner at top (e.g. "August is tight — ₱2K shortfall projected")
- **FinanceAIInput** — sticky input bar, mobile-top / desktop-right column, message history with newlines rendered as `<br />`
- Future months (e.g. July) now show in income/expenses history — removed filter that hid them
- AI chat: system prompt rule bans markdown tables → plain text responses only

**Bookings → Finance Link (June 11, 2026)**
- When "Mark Balance Paid" is tapped on a booking, a `personal_income` entry is auto-created with `income_date = booking.event_date` (accrual accounting)
- If a fully-paid booking is cancelled, its income entry is deleted
- `booking_id` field on income entries enables reverse lookup and deduplication
- **Backfill sync:** POST `/api/bookings/sync-finance` — runs fire-and-forget on bookings page load; creates missing income entries for all existing fully-paid bookings; idempotent (skips if `booking_id` already exists in personal_income)

**Crafty AI — Personal Finance Tools (June 11, 2026)**
- New tools: `update_debt`, `delete_debt`, `delete_incoming`
- `delete_debt` deletes the debt document + all associated payment records
- `log_income` now accepts `booking` as a category
- All timezone bugs fixed: replaced `new Date().toISOString().slice(0,7)` with pure arithmetic `currentYYYYMM()` / `offsetYYYYMM()` helpers throughout
- Language understanding improved: recognizes "remove", "delete", "cancel" patterns for destructive tools
- Tool loop: 5 rounds max

**Error Monitoring — Sentry (June 11, 2026)**
- Sentry Next.js SDK installed via official wizard
- DSN: `https://e2d6907da9ad8292b932922e4940b2dd@o4511545595854848.ingest.us.sentry.io/4511545603981312`
- Client config: tracesSampleRate 0.2, Session Replay enabled (1.0 on error, 0.05 baseline)
- Server + Edge config: tracesSampleRate 1.0
- `next.config.ts` wrapped with `withSentryConfig` (org: craftifyle, project: craftifyle-crm)
- Catches Firebase errors, API route errors, Vercel serverless errors, client JS crashes

**Chat Widget**
- Crafty AI FAB hidden on `/login`, `/signup`, `/confirm/*`, `/contract/*` pages (usePathname early return)

---

## What to Build Next

### ✅ Shipped Sprint 5 — Personal Finance Manager (June 11, 2026)
All 5 phases complete. See "Personal Finance Manager" section above.

---

### Immediate — UI Redesign from Design Handoff
A full high-fidelity design handoff has been completed by Claude Design. Files are at:
`c:\Users\james\OneDrive\Desktop\Craftifyle-photobooth software\craftifyle-crm\` (attached to session June 3 2026)

Implement in this order (one page per session):
1. **Dashboard** — 4 KPI cards (glow blobs), 2-col layout: Leads by Month (left 1.5fr) + Upcoming Events (right 1fr), year pill, page header with date. Keep existing Supabase data wiring. Visual overhaul only.
2. **Leads list** — filter pills, search, 6-col table with StatusBadge, footer count.
3. **Lead detail** — back link, 2-col desktop layout, pipeline stage pills, details grid, AI reply draft card.
4. **Bookings** — 3 revenue cards (tinted), status tabs, month section, 6-col table.
5. **Sidebar** — already close; minor tweaks to active state (2px left border accent).
6. ~~**Login + Signup**~~ ✅ **Shipped June 11** — Google sign-in added, invite code removed, confirm password removed.

Design tokens to apply from handoff `colors_and_type.css`:
- KPI hero: 52px weight 700 amber | KPI mid: 36px | KPI data: 13px muted
- Radius: input 8px, button 10px, card 14px, pill 9999px
- All transitions: 150ms ease
- Button press: scale(0.97) | Card hover: translateY(-1px) + elevated bg

### Login + Signup Redesign — Research-Backed Spec (June 3, 2026)
Deep research done across 20+ sources. Key findings for implementation:

**Mobile signup (3 fields max):**
- Full name → Email → Password (show/hide toggle, NO confirm-password field — removing it boosts conversion 56%)
- Google login button ABOVE email form (not below)
- Submit CTA: "Create Free Account" — 52px tall, full width
- Social proof: "Join 1,200+ Filipino solopreneurs" below headline
- Tagalog trust line near submit: "Ligtas ang iyong datos."
- Bottom: "Already have an account? Log in →"

**Mobile login:**
- Headline: "Welcome back" (not "Log In")
- Google button first → divider → email/password
- "Forgot password?" right-aligned below password field
- Submit: "Log In" — 52px tall, full width

**Desktop:**
- Centered 480px card on brand-tinted background (`#7c6ff7` at 8–10% opacity)
- Logo at top, Google button first, email/password below

**UX rules:**
- Validate on blur (not on keystroke), inline errors below each field
- Error color: #EF4444 | Success: #10B981
- Input font: 16px minimum (smaller triggers iOS zoom bug)
- All animations: 200–300ms, transform + opacity only
- Button loading state: disable immediately + show spinner on click
- After signup: brief celebration → segmentation → demo data (NOT empty dashboard)

**Skip Facebook login** — scam associations in PH hurt conversion.

### Other Pending
- **PayMongo payment links** — when James can sign up (UI already built, hidden behind `false &&`)
- **Client portal**
- **Facebook OAuth** — blocked by Meta Business Verification + App Review. Skip until BIR registered.

### Shipped June 2, 2026
- **Personalized onboarding flow** (`src/components/OnboardingModal.tsx`) — 3-screen flow: paste DM → Crafty reveals extracted data staggered → profile setup (name, business name, 7 business type cards, acquisition source) → launch screen with blurred dashboard. Saves to `profiles.business_type`, `profiles.acquisition_source`, `profiles.onboarding_completed`.
- **First-session CraftyToast** (`src/components/CraftyToast.tsx`) — small toast from Crafty, fires once per trigger in first 30 min of post-onboarding session. Triggers: 1st lead, 2nd lead, 1st stage change, 1st activity logged, 5 leads, 1st booking.
- **Design identity** — KPI numbers `text-3xl` mobile / `text-5xl` desktop, light mode as default (OS preference ignored unless user toggled manually).
- **Semaphore SMS disabled** — removed from cron follow-up route. Messenger follow-ups still active.
- **Mobile UX pass** — 44px touch targets on all filter pills + tabs, larger lead row padding, `inputMode` on phone/number/email fields, mobile nav solid background + safe area fix, removed "Add" label from center nav button.
- **CLAUDE_RULES.md** — added mobile-first section: 44px touch targets, responsive font sizes, inputMode, full-row tap targets, no horizontal overflow at 360px.
- **Global Claude Code skills** — installed `nextjs-turbopack`, `react-patterns`, `security-review` + `rules/typescript`, `rules/react`, `rules/common` from ECC into `~/.claude/`. Also upgraded `search-first` skill with Review & Apply gate.

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

**Honest note:** The redesign restructured layouts and fixed visual hierarchy. The *color story* is still the same dark navy/purple app. A true visual identity shift is the next design phase — research completed June 3 (see below).

### Design Identity — Research-Backed Direction (June 3)

Deep research across 25+ sources confirmed three decisions. All three are strongly supported.

**1. Amber/Gold (#f59e0b) for money/revenue UI**
- Elliot & Maier (2014): gold stimulates dopamine in financial contexts — users associate it with earned wealth, not caution
- GCash (blue), Maya (green), Grab (green) — amber/gold for revenue data is completely unclaimed in PH fintech
- Filipino cultural context: gold = prosperity, celebration, achievement — the exact emotions around booking revenue
- Semantic rule: purple = action/navigation, amber = money earned. They never overlap.
- Apply to: revenue numbers on dashboard, booking values, "Booked" stage dot, payment confirmed states

**2. Bigger KPI numbers (48px+) with muted peso sign**
- Tableau eye-tracking study: large numbers receive visual fixation within 200ms — pre-conscious attention
- Piepenbrock et al. (Ergonomics): significantly more correct comprehension at larger font sizes
- GCash displays balance at ~40px with muted peso prefix — 94M Filipino users trained on this pattern
- 3-tier scale: revenue hero 52–56px weight 700 (amber) / secondary KPIs 36px / supporting data 13px muted
- Peso sign at 60% size + 60% opacity of the number

**3. Light mode as default (warm cream #fafaf8)**
- Piepenbrock 2013 (Ergonomics): "users read text faster and more accurately in light mode" — biology, not preference
- 99% of PH internet access is mobile; users work outdoors at events where dark mode loses contrast physics
- Every major PH app defaults to light: GCash, Maya, Shopee, Grab, Facebook
- Every CRM peer defaults to light: HoneyBook, Dubsado, 17hats
- Dark mode's 82% global adoption is heavily skewed by developers in night sessions — not Craftifyle's user
- Implementation: default = light, auto-detect OS `prefers-color-scheme: dark`, keep user toggle in Profile

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
| Database | **Firebase Firestore** (migrated from Supabase June 9, 2026) |
| Auth | **Firebase Auth** + server session cookies (`__session`) |
| AI — Advisor | **Gemini 2.5 Flash Lite** (migrated from Groq) |
| AI — CRM Actions | **Gemini 2.5 Flash Lite** with tool calling (migrated from Groq) |
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
| `src/lib/firebase-admin.ts` | Firebase Admin SDK — lazy Proxy init, `getAdminDb()` / `getAdminAuth()` |
| `src/lib/firebase.ts` | Firebase client SDK — `db`, `auth`, `getDocsByUser()` helper |
| `src/app/api/auth/session/route.ts` | POST: exchange Firebase ID token for `__session` cookie |
| `src/app/api/auth/post-login/route.ts` | POST: auto-migrate Supabase UID data to Firebase UID on first login |
| `src/app/personal/page.tsx` | Personal Finance Manager — cash position, debt tracker, survival projection, AI entry |
| `src/app/api/personal-finance-assist/route.ts` | Personal Finance AI — Gemini with 5 tools for natural language finance entry (planned) |
| `CLAUDE_RULES.md` | Coding rules — read before touching anything |

---

## Rules (from CLAUDE_RULES.md)

- Minimal diffs — never rewrite full files
- 25-line cap — enter Plan Mode if more than 25 lines need changing
- Never use `any` or `@ts-ignore`
- Never change Gemini model IDs without being asked (`gemini-2.5-flash-lite`)
- Build check (`npx next build`) before every commit

---

## How to Start a Session

1. Read this file ✅
2. Ask James what he wants to fix or build
3. Check relevant source files before touching anything
4. 
