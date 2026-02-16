---
name: dream
description: Reflect on the conversation and distill a Principle to ~/.dreamfile
---

# /dream - Distill a Principle

Reflect on the full conversation context and distill a single Principle — only when one genuinely exists.

## What is a Principle?

A Principle is a realization, insight, or pattern that **transcends the specific task**. It's not a tip, not a how-to, not a summary of what was done. It's something learned that will change how you approach future work.

Most sessions won't have one. That's fine. Honesty matters more than output.

**Examples of Principles:**
- "The shape of the data should dictate the shape of the code, not the other way around."
- "When a refactor feels endless, the abstraction is wrong — not the implementation."
- "Tests that mirror implementation are tests that break for the wrong reasons."

**Not Principles:**
- "Use bun instead of node" (that's a preference)
- "The bug was in line 42 of auth.ts" (that's a fact)
- "We refactored the parser today" (that's a summary)

## Instructions

### Step 1: Reflect

Look at the full conversation. What happened? What was hard? What surprised you? What would you do differently?

Don't force it. If nothing rises to the level of a Principle, skip to Step 4.

### Step 2: Articulate the Principle

Write it as a single sentence or short paragraph. It should be:
- **General** — applicable beyond this specific codebase or task
- **Hard-won** — something that came from friction, not something obvious
- **True** — not aspirational, but actually demonstrated in this session

### Step 3: Write to the Dreamfile

1. Read `~/.dreamfile`
2. Decide where the new Principle belongs among the existing ones — by conceptual affinity, not chronology
3. Insert it there, changing nothing else in the file
4. Write the updated file back

If the dreamfile doesn't exist, create it with the standard header first:

```
# Dreamfile
# Principles distilled from working sessions.
# Each entry is placed where it belongs conceptually.

---

```

### Step 4: Report

If you found a Principle, share it with the user and note where you placed it in the dreamfile.

If you didn't find one, say so honestly. "No Principle emerged from this session" is a perfectly good outcome.
