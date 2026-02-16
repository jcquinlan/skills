import { createHighlighter } from "shiki";
import type { TourPlan } from "./schema.ts";
import { buildHtml, type TemplateData } from "./template.ts";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function highlightDiffLines(diffText: string): string {
  const lines = diffText.split("\n");
  const htmlLines = lines.map((line) => {
    if (line.startsWith("@@")) {
      return `<div class="line-hdr">${escapeHtml(line)}</div>`;
    } else if (line.startsWith("+")) {
      return `<div class="line-add">${escapeHtml(line)}</div>`;
    } else if (line.startsWith("-")) {
      return `<div class="line-del">${escapeHtml(line)}</div>`;
    }
    return `<div>${escapeHtml(line)}</div>`;
  });
  return `<pre>${htmlLines.join("")}</pre>`;
}

export async function renderTour(plan: TourPlan): Promise<string> {
  let highlighter: Awaited<ReturnType<typeof createHighlighter>> | null = null;

  try {
    highlighter = await createHighlighter({
      themes: ["github-dark"],
      langs: ["diff"],
    });
  } catch {
    // Fall back to manual highlighting if Shiki fails
    highlighter = null;
  }

  const sections: TemplateData["sections"] = plan.sections.map((section) => {
    const files = [...new Set(section.hunks.map((h) => h.file))];
    const combinedDiff = section.hunks.map((h) => h.diff).join("\n\n");

    let highlightedDiff: string;
    if (highlighter) {
      try {
        const shikiHtml = highlighter.codeToHtml(combinedDiff, {
          lang: "diff",
          theme: "github-dark",
        });
        // Shiki generates <pre class="shiki"><code>...</code></pre>
        // We add our own diff-specific line classes for add/del coloring
        highlightedDiff = addDiffLineClasses(shikiHtml, combinedDiff);
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

function addDiffLineClasses(shikiHtml: string, rawDiff: string): string {
  // Shiki produces individual <span> elements inside <code>.
  // We wrap each line with a class based on the raw diff line prefix.
  const rawLines = rawDiff.split("\n");

  // Replace each line in the Shiki output with a wrapper div
  let lineIndex = 0;
  return shikiHtml.replace(
    /(<span class="line">)(.*?)(<\/span>)/g,
    (_match, open, content, close) => {
      const rawLine = rawLines[lineIndex] || "";
      lineIndex++;

      let cls = "";
      if (rawLine.startsWith("@@")) cls = " line-hdr";
      else if (rawLine.startsWith("+")) cls = " line-add";
      else if (rawLine.startsWith("-")) cls = " line-del";

      return `<span class="line${cls}">${content}</span>`;
    },
  );
}
