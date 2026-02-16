import Anthropic from "@anthropic-ai/sdk";
import { inferSectionLanguage, type ParsedHunk } from "./parse.ts";
import { LLMTourPlanSchema, type TourPlan } from "./schema.ts";

export interface AnalyzeOptions {
  title?: string;
  onLog?: (message: string) => void;
  onProgress?: (charCount: number) => void;
  onDone?: () => void;
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

  // Number each hunk so the LLM can reference them by index
  const numberedHunks = hunks
    .map((h, i) => `[Hunk ${i}] ${h.file}\n${h.diff}`)
    .join("\n\n");

  if (numberedHunks.length > DIFF_SIZE_LIMIT) {
    throw new Error(
      `Diff is too large (${Math.round(numberedHunks.length / 1024)}KB). ` +
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
5. Reference hunks by their [Hunk N] index numbers — do NOT copy the diff text

Return ONLY valid JSON matching this exact schema:
{
  "title": "string — concise title",
  "summary": "string — one paragraph summary",
  "sections": [
    {
      "heading": "string — short section heading",
      "explanation": "string — 2-4 sentences explaining this group of changes",
      "hunk_ids": [0, 3, 5],
      "language": "string — optional, dominant source language (e.g. typescript, python, rust)"
    }
  ]
}

Here are the hunks:

${numberedHunks}`;

  const client = new Anthropic({ apiKey });

  const log = options.onLog ?? (() => {});
  log("Sending diff to Claude...");

  let rawText = "";
  let charCount = 0;

  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
    stream: true,
  });

  for await (const event of response) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      rawText += event.delta.text;
      charCount += event.delta.text.length;
      if (options.onProgress) {
        options.onProgress(charCount);
      }
    }
  }

  if (options.onProgress) {
    options.onDone?.();
  }

  rawText = rawText.trim();
  if (!rawText) {
    throw new Error("No text response received from Claude API.");
  }

  log(`Received ${charCount} chars from API`);
  log("Parsing response...");
  let parsed: unknown;

  // Strategy 1: Try parsing the whole response as JSON directly
  try {
    parsed = JSON.parse(rawText);
  } catch {
    // Strategy 2: Extract from markdown code fences (greedy to handle nested content)
    const fenceMatch = rawText.match(/```(?:json)?\s*\n([\s\S]*)\n```/);
    if (fenceMatch) {
      try {
        parsed = JSON.parse(fenceMatch[1].trim());
      } catch {
        parsed = undefined;
      }
    }

    // Strategy 3: Find the first { ... } block in the text
    if (!parsed) {
      const braceStart = rawText.indexOf("{");
      const braceEnd = rawText.lastIndexOf("}");
      if (braceStart !== -1 && braceEnd > braceStart) {
        try {
          parsed = JSON.parse(rawText.slice(braceStart, braceEnd + 1));
        } catch {
          parsed = undefined;
        }
      }
    }

    if (!parsed) {
      throw new Error("Failed to parse Claude API response as JSON.");
    }
  }

  const llmPlan = LLMTourPlanSchema.parse(parsed);

  // Map hunk indices back to the original parsed hunks
  return {
    title: llmPlan.title,
    summary: llmPlan.summary,
    sections: llmPlan.sections.map((section) => {
      const sectionHunks = section.hunk_ids
        .filter((id) => id >= 0 && id < hunks.length)
        .map((id) => {
          const h = hunks[id];
          return {
            file: h.file,
            startLine: h.startLine,
            endLine: h.endLine,
            diff: h.diff,
          };
        });
      const files = sectionHunks.map((h) => h.file);
      return {
        heading: section.heading,
        explanation: section.explanation,
        hunks: sectionHunks,
        language: section.language ?? inferSectionLanguage(files),
      };
    }),
  };
}
