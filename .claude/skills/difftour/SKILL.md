---
disable-model-invocation: true
---

# /difftour - Generate a Guided Code Tour

Create a self-contained HTML slideshow that walks a reviewer through code changes, explaining the *intent* behind each change — not just what changed, but why.

## Usage

```
/difftour                       — tour of all uncommitted changes
/difftour main                  — tour of changes vs main branch
/difftour main -o review.html   — custom output filename
/difftour --staged              — tour of staged changes only
```

## Arguments

$ARGUMENTS = optional branch name, flags (-o, --staged), or empty for uncommitted changes

## Instructions

Follow these steps exactly:

### Step 1: Get the diff

Based on the arguments, run the appropriate git command:

- No arguments: `git diff` (unstaged changes)
- `--staged`: `git diff --staged`
- Branch name (e.g., `main`): `git diff <branch>...HEAD`

Capture the full diff output. If the diff is empty, tell the user there are no changes to tour and stop.

### Step 2: Parse the diff and understand the changes

Read through the diff output carefully. Identify each hunk — note the file path, what was added, what was removed, and how the hunks relate to each other.

You already have context from this conversation about *why* these changes exist. Use that context. This is the whole point of this skill: you were there when the decisions were made.

### Step 3: Construct the TourPlan JSON

Write a JSON object matching this exact schema:

```json
{
  "title": "string — concise title for the overall change",
  "summary": "string — one paragraph explaining the change at a high level",
  "sections": [
    {
      "heading": "string — short section heading",
      "explanation": "string — 2-4 sentences. Focus on WHY, not just WHAT. What problem does this solve? What was the reasoning? What tradeoffs were considered?",
      "language": "string — optional, dominant source language for syntax highlighting (e.g. typescript, python, rust)",
      "hunks": [
        {
          "file": "string — file path",
          "startLine": 0,
          "endLine": 0,
          "diff": "string — the raw diff text for this hunk, including the @@ header"
        }
      ]
    }
  ]
}
```

**Guidelines for writing great tour sections:**

- **Group hunks by concept**, not by file. If changes to 3 files all support one feature, they belong in one section.
- **Order for narrative flow**. Start with the foundational change (the schema, the type, the interface), then show how it's used, then show tests or polish.
- **Write explanations that capture intent.** Bad: "Added a new function validateEmail." Good: "Email validation was missing from the signup flow, which meant invalid addresses could reach the database. This adds a Zod schema that catches malformed emails at the API boundary."
- **Don't just echo the diff.** The reviewer can see the code — your job is to explain the thinking behind it.
- **Keep hunks verbatim.** Copy the raw diff text exactly from the git output, including `@@` headers and `+`/`-` prefixes.
- **Specify the language** for each section when possible (e.g. `"language": "typescript"`). This enables syntax highlighting of the actual source tokens, not just diff coloring. If omitted, the renderer infers it from file extensions.

### Step 4: Render the HTML

Parse the -o flag from arguments if present (default: `tour.html`).

Write the TourPlan JSON to a temporary file and pipe it through the renderer:

```bash
cat /tmp/difftour-plan.json | bun run difftour/src/render-tour.ts -o <output-file>
```

Use the Write tool to create `/tmp/difftour-plan.json` with the TourPlan JSON, then use Bash to run the render command.

### Step 5: Report the result

Tell the user:
- The output file path
- How many sections the tour has
- Suggest they open it: `open <output-file>`
