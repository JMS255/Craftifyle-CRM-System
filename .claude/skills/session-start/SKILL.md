---
description: Start a new session for the Craftifyle CRM project. Use this when James begins a new conversation, says "let's continue", "pick up where we left off", or "new session". Loads full project context and summarizes current status.
---

Read the file `CONTEXT.md` in the project root.

Then run the following to see what's been shipped since CONTEXT.md was last written:
!`git log --oneline -10`

Then give James a short briefing — 5 bullets max:
1. What's been shipped since CONTEXT.md was last updated (compare git log to the "What to Build Next" section)
2. What's still pending
3. What was agreed to build next (check the memory file at C:\Users\james\.claude\projects\c--Users-james-OneDrive-Desktop-Craftifyle-photobooth-software-craftifyle-crm\memory\project-context.md)
4. Any blockers (SQL migrations not run, env vars missing, etc.)

End with: "What are we building today?"

Keep it tight. No long preambles.
