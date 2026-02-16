import { createHighlighter, bundledLanguages } from "shiki";
import type { TourPlan } from "./schema.ts";
import { inferSectionLanguage } from "./parse.ts";
import { buildHtml, type TemplateData } from "./template.ts";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Plain-text fallback when Shiki is unavailable. */
function highlightDiffLines(diffText: string): string {
  const lines = diffText.split("\n");
  const htmlLines = lines.map((line) => {
    if (line.startsWith("@@")) {
      return `<div class="line line-hdr">${escapeHtml(line)}</div>`;
    } else if (line.startsWith("+")) {
      return `<div class="line line-add">${escapeHtml(line)}</div>`;
    } else if (line.startsWith("-")) {
      return `<div class="line line-del">${escapeHtml(line)}</div>`;
    }
    return `<div class="line">${escapeHtml(line)}</div>`;
  });
  return `<pre>${htmlLines.join("")}</pre>`;
}

type DiffLineType = "add" | "del" | "hdr" | "ctx";

interface DiffLine {
  type: DiffLineType;
  raw: string;
  /** Line content with diff prefix stripped (for language highlighting). */
  clean: string;
}

function classifyDiffLines(diffText: string): DiffLine[] {
  return diffText.split("\n").map((raw) => {
    if (raw.startsWith("@@")) {
      return { type: "hdr", raw, clean: raw };
    } else if (raw.startsWith("+")) {
      return { type: "add", raw, clean: raw.slice(1) };
    } else if (raw.startsWith("-")) {
      return { type: "del", raw, clean: raw.slice(1) };
    }
    // Context line — strip leading space
    return { type: "ctx", raw, clean: raw.startsWith(" ") ? raw.slice(1) : raw };
  });
}

function lineClass(type: DiffLineType): string {
  switch (type) {
    case "add": return "line line-add";
    case "del": return "line line-del";
    case "hdr": return "line line-hdr";
    default:    return "line";
  }
}

function isValidLang(lang: string): boolean {
  return lang in bundledLanguages;
}

export async function renderTour(plan: TourPlan): Promise<string> {
  // Collect all languages we'll need
  const langsNeeded = new Set<string>(["diff"]);
  for (const section of plan.sections) {
    const files = [...new Set(section.hunks.map((h) => h.file))];
    const lang = section.language ?? inferSectionLanguage(files);
    if (lang && isValidLang(lang)) {
      langsNeeded.add(lang);
    }
  }

  let highlighter: Awaited<ReturnType<typeof createHighlighter>> | null = null;

  try {
    highlighter = await createHighlighter({
      themes: ["github-dark"],
      langs: [...langsNeeded],
    });
  } catch {
    highlighter = null;
  }

  const sections: TemplateData["sections"] = plan.sections.map((section) => {
    const files = [...new Set(section.hunks.map((h) => h.file))];
    const combinedDiff = section.hunks.map((h) => h.diff).join("\n\n");
    const lang = section.language ?? inferSectionLanguage(files);

    let highlightedDiff: string;
    if (highlighter && lang && isValidLang(lang)) {
      try {
        highlightedDiff = highlightWithLanguage(highlighter, combinedDiff, lang);
      } catch {
        highlightedDiff = highlightDiffLines(combinedDiff);
      }
    } else {
      highlightedDiff = highlightDiffLines(combinedDiff);
    }

    return { heading: section.heading, explanation: section.explanation, files, highlightedDiff };
  });

  if (highlighter) {
    highlighter.dispose();
  }

  return buildHtml({
    title: plan.title,
    summary: plan.summary,
    sections,
  });
}

/**
 * Language-aware highlighting: strips diff prefixes, highlights the clean
 * source with the real language, then reassembles with diff line classes
 * and inline token colors.
 */
function highlightWithLanguage(
  highlighter: Awaited<ReturnType<typeof createHighlighter>>,
  diffText: string,
  lang: string,
): string {
  const diffLines = classifyDiffLines(diffText);

  // Separate header lines from code lines. Headers get plain rendering.
  const codeLineIndices: number[] = [];
  const cleanCodeLines: string[] = [];

  for (let i = 0; i < diffLines.length; i++) {
    if (diffLines[i].type !== "hdr") {
      codeLineIndices.push(i);
      cleanCodeLines.push(diffLines[i].clean);
    }
  }

  // Highlight the clean source code as a single block
  const cleanCode = cleanCodeLines.join("\n");
  const tokenLines = highlighter.codeToTokensBase(cleanCode, {
    lang,
    theme: "github-dark",
  });

  // Build HTML: walk through diffLines, pulling token-colored spans for code lines
  const htmlLines: string[] = [];
  let tokenLineIdx = 0;

  for (let i = 0; i < diffLines.length; i++) {
    const dl = diffLines[i];
    const cls = lineClass(dl.type);

    if (dl.type === "hdr") {
      htmlLines.push(`<span class="${cls}">${escapeHtml(dl.raw)}</span>`);
      continue;
    }

    // Render tokens with inline color
    const tokens = tokenLines[tokenLineIdx] ?? [];
    tokenLineIdx++;

    const prefix = dl.type === "add" ? "+" : dl.type === "del" ? "-" : " ";
    const tokenSpans = tokens
      .map((t) => {
        const style = t.color ? ` style="color:${t.color}"` : "";
        return `<span${style}>${escapeHtml(t.content)}</span>`;
      })
      .join("");

    htmlLines.push(`<span class="${cls}"><span class="diff-prefix">${prefix}</span>${tokenSpans}</span>`);
  }

  return `<pre class="shiki github-dark" style="background-color:#0d1117"><code>${htmlLines.join("\n")}</code></pre>`;
}
