import { describe, expect, it } from "bun:test";
import { parseDiff, inferLanguage, inferSectionLanguage } from "../src/parse.ts";

const singleFileSingleHunk = `diff --git a/src/main.ts b/src/main.ts
index abc1234..def5678 100644
--- a/src/main.ts
+++ b/src/main.ts
@@ -1,3 +1,4 @@
 import { foo } from "./foo";
+import { bar } from "./bar";

 foo();`;

const singleFileMultipleHunks = `diff --git a/src/main.ts b/src/main.ts
index abc1234..def5678 100644
--- a/src/main.ts
+++ b/src/main.ts
@@ -1,3 +1,4 @@
 import { foo } from "./foo";
+import { bar } from "./bar";

 foo();
@@ -10,3 +11,5 @@
 function greet() {
+  console.log("hello");
+  console.log("world");
   return;
 }`;

const multiFile = `diff --git a/src/a.ts b/src/a.ts
index abc1234..def5678 100644
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,2 +1,3 @@
 const a = 1;
+const b = 2;
 export { a };
diff --git a/src/b.ts b/src/b.ts
index abc1234..def5678 100644
--- a/src/b.ts
+++ b/src/b.ts
@@ -1,2 +1,3 @@
 const x = 10;
+const y = 20;
 export { x };`;

const newFile = `diff --git a/src/new.ts b/src/new.ts
new file mode 100644
index 0000000..abc1234
--- /dev/null
+++ b/src/new.ts
@@ -0,0 +1,3 @@
+export const greeting = "hello";
+export const farewell = "bye";
+export default greeting;`;

const deletedFile = `diff --git a/src/old.ts b/src/old.ts
deleted file mode 100644
index abc1234..0000000
--- a/src/old.ts
+++ /dev/null
@@ -1,3 +0,0 @@
-export const greeting = "hello";
-export const farewell = "bye";
-export default greeting;`;

const binaryFile = `diff --git a/logo.png b/logo.png
new file mode 100644
index 0000000..abc1234
Binary files /dev/null and b/logo.png differ`;

const binaryThenText = `diff --git a/logo.png b/logo.png
new file mode 100644
index 0000000..abc1234
Binary files /dev/null and b/logo.png differ
diff --git a/src/a.ts b/src/a.ts
index abc1234..def5678 100644
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,2 +1,3 @@
 const a = 1;
+const b = 2;
 export { a };`;

describe("parseDiff", () => {
  it("returns empty array for empty input", () => {
    expect(parseDiff("")).toEqual([]);
    expect(parseDiff("  \n  ")).toEqual([]);
  });

  it("parses a single-file, single-hunk diff", () => {
    const hunks = parseDiff(singleFileSingleHunk);
    expect(hunks).toHaveLength(1);
    expect(hunks[0].file).toBe("src/main.ts");
    expect(hunks[0].startLine).toBe(1);
    expect(hunks[0].endLine).toBe(4);
    expect(hunks[0].header).toContain("@@");
    expect(hunks[0].diff).toContain('+import { bar } from "./bar";');
  });

  it("parses multiple hunks within one file", () => {
    const hunks = parseDiff(singleFileMultipleHunks);
    expect(hunks).toHaveLength(2);
    expect(hunks[0].file).toBe("src/main.ts");
    expect(hunks[1].file).toBe("src/main.ts");
    expect(hunks[0].startLine).toBe(1);
    expect(hunks[1].startLine).toBe(11);
    expect(hunks[1].diff).toContain('+  console.log("hello");');
  });

  it("parses a multi-file diff into separate hunks per file", () => {
    const hunks = parseDiff(multiFile);
    expect(hunks).toHaveLength(2);
    expect(hunks[0].file).toBe("src/a.ts");
    expect(hunks[1].file).toBe("src/b.ts");
    expect(hunks[0].diff).toContain("+const b = 2;");
    expect(hunks[1].diff).toContain("+const y = 20;");
  });

  it("handles new files (--- /dev/null)", () => {
    const hunks = parseDiff(newFile);
    expect(hunks).toHaveLength(1);
    expect(hunks[0].file).toBe("src/new.ts");
    expect(hunks[0].startLine).toBe(1);
    expect(hunks[0].diff).toContain("+export const greeting");
  });

  it("handles deleted files (+++ /dev/null)", () => {
    const hunks = parseDiff(deletedFile);
    expect(hunks).toHaveLength(1);
    expect(hunks[0].file).toBe("src/old.ts");
    expect(hunks[0].diff).toContain("-export const greeting");
  });

  it("skips binary file entries without crashing", () => {
    const hunks = parseDiff(binaryFile);
    expect(hunks).toHaveLength(0);
  });

  it("skips binary files but continues parsing text diffs after them", () => {
    const hunks = parseDiff(binaryThenText);
    expect(hunks).toHaveLength(1);
    expect(hunks[0].file).toBe("src/a.ts");
  });

  it("each hunk has required fields", () => {
    const hunks = parseDiff(singleFileSingleHunk);
    for (const hunk of hunks) {
      expect(typeof hunk.file).toBe("string");
      expect(typeof hunk.startLine).toBe("number");
      expect(typeof hunk.endLine).toBe("number");
      expect(typeof hunk.header).toBe("string");
      expect(typeof hunk.diff).toBe("string");
    }
  });
});

describe("inferLanguage", () => {
  it("maps .ts to typescript", () => {
    expect(inferLanguage("src/main.ts")).toBe("typescript");
  });

  it("maps .tsx to tsx", () => {
    expect(inferLanguage("components/App.tsx")).toBe("tsx");
  });

  it("maps .py to python", () => {
    expect(inferLanguage("scripts/deploy.py")).toBe("python");
  });

  it("maps .rs to rust", () => {
    expect(inferLanguage("src/lib.rs")).toBe("rust");
  });

  it("maps .css to css", () => {
    expect(inferLanguage("styles/main.css")).toBe("css");
  });

  it("returns undefined for unknown extensions", () => {
    expect(inferLanguage("file.xyz123")).toBeUndefined();
  });

  it("returns undefined for files without extension", () => {
    expect(inferLanguage("Makefile")).toBeUndefined();
  });
});

describe("inferSectionLanguage", () => {
  it("returns the dominant language from file list", () => {
    expect(inferSectionLanguage(["a.ts", "b.ts", "c.js"])).toBe("typescript");
  });

  it("returns the single language when all files match", () => {
    expect(inferSectionLanguage(["a.py", "b.py"])).toBe("python");
  });

  it("returns undefined for empty file list", () => {
    expect(inferSectionLanguage([])).toBeUndefined();
  });

  it("returns undefined when no files have recognized extensions", () => {
    expect(inferSectionLanguage(["Makefile", "Dockerfile"])).toBeUndefined();
  });
});
