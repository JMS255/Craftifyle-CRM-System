# Claude Code Rules — Craftifyle CRM

## Surgical Edit Policy
- **Minimal diffs only.** Never rewrite a full file for a small fix. Touch only the exact lines causing the issue.
- **25-line cap.** If a fix requires changing more than 25 lines, stop and enter Plan Mode for approval before writing any code.
- **Zero scope creep.** Fix the precise bug. Do not refactor, optimize, or clean up adjacent code unless explicitly asked.
- **One sentence explanations.** Let the diff speak. No long preambles.

## Tech Stack Rules (Next.js · Firebase · TypeScript · Gemini · Vercel)
- **TypeScript:** Never use `any` or `@ts-ignore`. Write a proper interface or extend from `src/types/index.ts`.
- **Firebase Firestore:** Use `getDocsByUser(col, userId)` helper — always filter by `user_id`. Never query a collection without a user filter.
- **Firebase Admin SDK:** Always import from `@/lib/firebase-admin` (lazy Proxy init). Never import `firebase-admin` directly in route files.
- **Gemini API:** Never change model IDs unless explicitly asked. Current model: `gemini-2.5-flash-lite`.
- **Next.js App Router:** Do not convert Server Components to Client Components just to fix a state issue — find the architectural reason first.
- **Vercel:** Match import paths with exact casing. Case mismatches cause silent build failures on Linux.
- **CSS:** Prefer adding a targeted class or inline style over rewriting a stylesheet section. Never touch unrelated CSS rules.
- **Meta Messenger API:** Never change webhook endpoints or page tokens unless explicitly asked.

## Mobile-First (88% of users are on mobile)
- **Touch targets:** All interactive elements (buttons, links, pills, tabs) must be at least 44px tall. Use `py-2.5` minimum on buttons, `py-3` on form inputs.
- **Responsive font sizes:** Use `text-base md:text-lg` patterns for KPIs and headings — never hardcode a large `px` size without a smaller mobile counterpart.
- **Input keyboards:** Always set `inputMode` on inputs — `tel` for phone, `numeric` for numbers/amounts, `email` for email. Add `autoComplete` hints where relevant.
- **Tap areas:** Wrap list rows in `<Link>` or `<button>` that covers the full row — no small inline links inside dense rows.
- **No horizontal overflow:** Test every new layout at 360px width mentally. Avoid fixed widths wider than the viewport.

## Workflow
- Read only the files relevant to the bug before editing.
- Build check (`npx next build`) before every commit.
- One commit per fix — small, descriptive message.

## Debugging Escalation
- If the same error persists after 2 fix attempts, **stop and tell James to Google or search Stack Overflow for the exact error message**. Paste the key error line so he can search it. Do not keep guessing blindly.
