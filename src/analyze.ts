import Anthropic from "@anthropic-ai/sdk";
import type { ParsedHunk } from "./parse.ts";
import { TourPlanSchema, type TourPlan } from "./schema.ts";

export interface AnalyzeOptions {
  title?: string;
}

const DIFF_SIZE_LIMIT = 100_000; // ~100KB

export async function analyzeDiff(
  hunks: ParsedHunk[],
  options: AnalyzeOptions = {},
): Promise<TourPlan> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Export it in your environment to use DiffTour.",
    );
  }

  const diffText = hunks.map((h) => `### ${h.file}\n${h.diff}`).join("\n\n");

  if (diffText.length > DIFF_SIZE_LIMIT) {
    throw new Error(
      `Diff is too large (${Math.round(diffText.length / 1024)}KB). ` +
        `Try narrowing the diff, e.g.: git diff main -- src/`,
    );
  }

  const titleInstruction = options.title
    ? `Use this exact title for the tour: "${options.title}".`
    : "Generate a concise, descriptive title for the tour.";

  const prompt = `You are a code review assistant. Analyze the following git diff and produce a guided tour that helps a reviewer understand the changes.

${titleInstruction}

Instructions:
1. Group related hunks into logical sections (e.g., "these hunks across files all implement input validation")
2. Order the sections narratively — start with the foundational change, then build understanding
3. Write a short heading and 2-4 sentence explanation for each section
4. Generate a one-paragraph summary of the overall change

Return ONLY valid JSON matching this exact schema:
{
  "title": "string — concise title for the change",
  "summary": "string — one paragraph summary",
  "sections": [
    {
      "heading": "string — short section heading",
      "explanation": "string — 2-4 sentences explaining this group of changes",
      "hunks": [
        {
          "file": "string — file path",
          "startLine": number,
          "endLine": number,
          "diff": "string — the raw diff text for this hunk"
        }
      ]
    }
  ]
}

Here is the diff:

${diffText}`;

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response received from Claude API.");
  }

  // Extract JSON from the response (may be wrapped in markdown code blocks)
  let jsonText = textBlock.text.trim();
  const jsonMatch = jsonText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (jsonMatch) {
    jsonText = jsonMatch[1].trim();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("Failed to parse Claude API response as JSON.");
  }

  return TourPlanSchema.parse(parsed);
}
