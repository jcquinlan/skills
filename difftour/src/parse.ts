const EXT_TO_LANG: Record<string, string> = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  mjs: "javascript",
  cjs: "javascript",
  mts: "typescript",
  cts: "typescript",
  py: "python",
  rb: "ruby",
  rs: "rust",
  go: "go",
  java: "java",
  kt: "kotlin",
  kts: "kotlin",
  swift: "swift",
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  hpp: "cpp",
  cs: "csharp",
  php: "php",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  css: "css",
  scss: "scss",
  less: "less",
  html: "html",
  htm: "html",
  vue: "vue",
  svelte: "svelte",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  md: "markdown",
  mdx: "mdx",
  sql: "sql",
  graphql: "graphql",
  gql: "graphql",
  xml: "xml",
  lua: "lua",
  zig: "zig",
  dart: "dart",
  r: "r",
  ex: "elixir",
  exs: "elixir",
  erl: "erlang",
  hs: "haskell",
  scala: "scala",
  clj: "clojure",
  tf: "hcl",
};

export function inferLanguage(filePath: string): string | undefined {
  const ext = filePath.split(".").pop()?.toLowerCase();
  if (!ext) return undefined;
  return EXT_TO_LANG[ext];
}

export function inferSectionLanguage(files: string[]): string | undefined {
  const counts = new Map<string, number>();
  for (const f of files) {
    const lang = inferLanguage(f);
    if (lang) {
      counts.set(lang, (counts.get(lang) ?? 0) + 1);
    }
  }
  if (counts.size === 0) return undefined;
  let best = "";
  let bestCount = 0;
  for (const [lang, count] of counts) {
    if (count > bestCount) {
      best = lang;
      bestCount = count;
    }
  }
  return best;
}

export interface ParsedHunk {
  file: string;
  startLine: number;
  endLine: number;
  header: string;
  diff: string;
}

export function parseDiff(raw: string): ParsedHunk[] {
  if (!raw || !raw.trim()) return [];

  const hunks: ParsedHunk[] = [];
  const lines = raw.split("\n");
  let i = 0;

  while (i < lines.length) {
    // Look for diff header: "diff --git a/... b/..."
    if (!lines[i].startsWith("diff --git ")) {
      i++;
      continue;
    }

    // Skip binary files
    let isBinary = false;
    let oldFile = "";
    let newFile = "";
    let j = i + 1;

    // Scan forward through diff metadata lines
    while (j < lines.length && !lines[j].startsWith("diff --git ")) {
      const line = lines[j];

      if (line.startsWith("Binary files ") || line === "GIT binary patch") {
        isBinary = true;
      }
      if (line.startsWith("--- ")) {
        oldFile = line.slice(4);
        // Strip a/ prefix
        if (oldFile.startsWith("a/")) oldFile = oldFile.slice(2);
      }
      if (line.startsWith("+++ ")) {
        newFile = line.slice(4);
        // Strip b/ prefix
        if (newFile.startsWith("b/")) newFile = newFile.slice(2);
      }
      if (line.startsWith("@@")) break;
      j++;
    }

    if (isBinary) {
      i = j;
      // Skip to next diff header
      while (i < lines.length && !lines[i].startsWith("diff --git ")) i++;
      continue;
    }

    // Determine the file path:
    // - For deleted files (+++ /dev/null), use the old file
    // - Otherwise use the new file
    const file = newFile === "/dev/null" ? oldFile : newFile;

    if (!file || file === "/dev/null") {
      i = j;
      while (i < lines.length && !lines[i].startsWith("diff --git ")) i++;
      continue;
    }

    // Parse hunks within this file
    while (j < lines.length && !lines[j].startsWith("diff --git ")) {
      if (!lines[j].startsWith("@@")) {
        j++;
        continue;
      }

      const header = lines[j];
      // Parse @@ -old,count +new,count @@ ...
      const match = header.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
      const startLine = match ? parseInt(match[1], 10) : 1;
      const lineCount = match && match[2] !== undefined ? parseInt(match[2], 10) : 1;
      const endLine = startLine + Math.max(lineCount - 1, 0);

      // Collect all lines in this hunk
      const hunkLines: string[] = [header];
      j++;
      while (j < lines.length && !lines[j].startsWith("@@") && !lines[j].startsWith("diff --git ")) {
        hunkLines.push(lines[j]);
        j++;
      }

      // Remove trailing empty lines from hunk
      while (hunkLines.length > 1 && hunkLines[hunkLines.length - 1] === "") {
        hunkLines.pop();
      }

      hunks.push({
        file,
        startLine,
        endLine,
        header,
        diff: hunkLines.join("\n"),
      });
    }

    i = j;
  }

  return hunks;
}
