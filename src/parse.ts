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
