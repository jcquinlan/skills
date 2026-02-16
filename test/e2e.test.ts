import { describe, expect, it, mock, afterEach } from "bun:test";
import { parseDiff } from "../src/parse.ts";
import { renderTour } from "../src/render.ts";
import type { TourPlan } from "../src/schema.ts";

const realisticDiff = `diff --git a/src/validators/email.ts b/src/validators/email.ts
new file mode 100644
index 0000000..abc1234
--- /dev/null
+++ b/src/validators/email.ts
@@ -0,0 +1,8 @@
+import { z } from "zod";
+
+export const emailSchema = z.string().email();
+export type Email = z.infer<typeof emailSchema>;
+
+export function isValidEmail(input: string): boolean {
+  return emailSchema.safeParse(input).success;
+}
diff --git a/src/handlers/signup.ts b/src/handlers/signup.ts
index abc1234..def5678 100644
--- a/src/handlers/signup.ts
+++ b/src/handlers/signup.ts
@@ -1,4 +1,5 @@
 import { Router } from "express";
+import { emailSchema } from "../validators/email";

 const router = Router();

@@ -10,6 +11,12 @@
 router.post("/signup", async (req, res) => {
   const { email, password } = req.body;
+
+  const result = emailSchema.safeParse(email);
+  if (!result.success) {
+    return res.status(400).json({ error: "Invalid email address" });
+  }
+
   // ... rest of signup logic
   res.json({ ok: true });
 });
diff --git a/test/validators/email.test.ts b/test/validators/email.test.ts
new file mode 100644
index 0000000..abc1234
--- /dev/null
+++ b/test/validators/email.test.ts
@@ -0,0 +1,12 @@
+import { describe, it, expect } from "vitest";
+import { isValidEmail } from "../../src/validators/email";
+
+describe("isValidEmail", () => {
+  it("accepts valid emails", () => {
+    expect(isValidEmail("user@example.com")).toBe(true);
+  });
+
+  it("rejects invalid emails", () => {
+    expect(isValidEmail("not-an-email")).toBe(false);
+  });
+});`;

const mockTourPlan: TourPlan = {
  title: "Add email validation to signup flow",
  summary:
    "This change introduces server-side email validation to the signup endpoint. A new Zod-based email validator module is created, integrated into the signup handler to reject invalid emails, and accompanied by unit tests.",
  sections: [
    {
      heading: "New email validation module",
      explanation:
        "A new validators/email.ts file is created with a Zod schema for email validation. The module exports both the schema and a convenience function isValidEmail that wraps safeParse for boolean checks.",
      hunks: [
        {
          file: "src/validators/email.ts",
          startLine: 1,
          endLine: 8,
          diff: '+import { z } from "zod";\n+\n+export const emailSchema = z.string().email();\n+export type Email = z.infer<typeof emailSchema>;\n+\n+export function isValidEmail(input: string): boolean {\n+  return emailSchema.safeParse(input).success;\n+}',
        },
      ],
    },
    {
      heading: "Signup handler integration",
      explanation:
        "The signup POST handler now imports the email schema and validates the email field before proceeding. Invalid emails receive a 400 response with a clear error message.",
      hunks: [
        {
          file: "src/handlers/signup.ts",
          startLine: 1,
          endLine: 5,
          diff: ' import { Router } from "express";\n+import { emailSchema } from "../validators/email";\n\n const router = Router();',
        },
        {
          file: "src/handlers/signup.ts",
          startLine: 11,
          endLine: 22,
          diff: ' router.post("/signup", async (req, res) => {\n   const { email, password } = req.body;\n+\n+  const result = emailSchema.safeParse(email);\n+  if (!result.success) {\n+    return res.status(400).json({ error: "Invalid email address" });\n+  }\n+\n   // ... rest of signup logic\n   res.json({ ok: true });\n });',
        },
      ],
    },
    {
      heading: "Unit tests for email validation",
      explanation: "New test file covers both the happy path (valid emails accepted) and the error path (invalid emails rejected).",
      hunks: [
        {
          file: "test/validators/email.test.ts",
          startLine: 1,
          endLine: 12,
          diff: '+import { describe, it, expect } from "vitest";\n+import { isValidEmail } from "../../src/validators/email";\n+\n+describe("isValidEmail", () => {\n+  it("accepts valid emails", () => {\n+    expect(isValidEmail("user@example.com")).toBe(true);\n+  });\n+\n+  it("rejects invalid emails", () => {\n+    expect(isValidEmail("not-an-email")).toBe(false);\n+  });\n+});',
        },
      ],
    },
  ],
};

describe("End-to-end pipeline", () => {
  afterEach(() => {
    mock.restore();
  });

  it("parse -> (mock analyze) -> render produces valid HTML with all sections", async () => {
    // Step 1: Parse the realistic diff
    const hunks = parseDiff(realisticDiff);
    expect(hunks.length).toBeGreaterThanOrEqual(3);

    // Step 2: Use the mock tour plan (simulating what Claude would return)
    // Step 3: Render
    const html = await renderTour(mockTourPlan);

    // Verify title and summary
    expect(html).toContain("Add email validation to signup flow");
    expect(html).toContain("server-side email validation");

    // Verify all section headings
    expect(html).toContain("New email validation module");
    expect(html).toContain("Signup handler integration");
    expect(html).toContain("Unit tests for email validation");

    // Verify diff code is present
    expect(html).toContain("emailSchema");
    expect(html).toContain("isValidEmail");

    // Verify it's valid HTML
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("</html>");

    // Verify navigation
    expect(html).toContain("prev-btn");
    expect(html).toContain("next-btn");
    expect(html).toContain("ArrowLeft");
    expect(html).toContain("ArrowRight");

    // Verify progress indicator (title + 3 sections = 4 slides)
    expect(html).toContain("1 / 4");
  });

  it("produces syntax-highlighted diff code in the HTML", async () => {
    const html = await renderTour(mockTourPlan);
    // Shiki or fallback should produce line-add/line-del classes
    expect(html).toContain("line-add");
  });

  it("HTML output never contains ANTHROPIC_API_KEY or api key values", async () => {
    // Set a fake key to ensure it doesn't leak
    const originalKey = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-secret-key-12345";

    const html = await renderTour(mockTourPlan);

    expect(html).not.toContain("ANTHROPIC_API_KEY");
    expect(html).not.toContain("sk-ant-test-secret-key-12345");

    if (originalKey !== undefined) {
      process.env.ANTHROPIC_API_KEY = originalKey;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }
  });
});

describe("Error handling: parse.ts", () => {
  it("handles malformed diff input gracefully (no exceptions)", () => {
    expect(() => parseDiff("this is not a diff at all")).not.toThrow();
    expect(parseDiff("this is not a diff at all")).toEqual([]);
  });

  it("handles partial/truncated diff without crashing", () => {
    const truncated = `diff --git a/src/main.ts b/src/main.ts
index abc1234..def5678 100644
--- a/src/main.ts
+++ b/src/main.ts`;
    expect(() => parseDiff(truncated)).not.toThrow();
  });
});

describe("Error handling: analyze.ts", () => {
  const originalApiKey = process.env.ANTHROPIC_API_KEY;

  afterEach(() => {
    if (originalApiKey !== undefined) {
      process.env.ANTHROPIC_API_KEY = originalApiKey;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }
    mock.restore();
  });

  it("provides clear error for API failures", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";

    mock.module("@anthropic-ai/sdk", () => ({
      default: class {
        messages = {
          create: () => Promise.reject(new Error("Connection refused")),
        };
      },
    }));

    const { analyzeDiff } = await import("../src/analyze.ts");
    await expect(
      analyzeDiff([
        { file: "a.ts", startLine: 1, endLine: 1, header: "@@ -1,1 +1,1 @@", diff: "+x" },
      ]),
    ).rejects.toThrow("Connection refused");
  });

  it("rejects diffs exceeding size limit with helpful message", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";

    const { analyzeDiff } = await import("../src/analyze.ts");
    const bigHunks = [
      {
        file: "big.ts",
        startLine: 1,
        endLine: 10000,
        header: "@@ -1,1 +1,10000 @@",
        diff: "x".repeat(110_000),
      },
    ];

    await expect(analyzeDiff(bigHunks)).rejects.toThrow("too large");
    await expect(analyzeDiff(bigHunks)).rejects.toThrow("narrowing the diff");
  });
});
