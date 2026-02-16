import { describe, expect, it } from "bun:test";
import { renderTour } from "../src/render.ts";
import type { TourPlan } from "../src/schema.ts";

const samplePlan: TourPlan = {
  title: "Add email validation",
  summary: "This change adds server-side email validation to prevent invalid signups.",
  sections: [
    {
      heading: "Validation schema",
      explanation: "A Zod schema was added to define valid email inputs. This provides runtime type safety.",
      hunks: [
        {
          file: "src/validators/email.ts",
          startLine: 1,
          endLine: 10,
          diff: '@@ -0,0 +1,10 @@\n+import { z } from "zod";\n+\n+export const emailSchema = z.string().email();\n+export type Email = z.infer<typeof emailSchema>;',
        },
      ],
    },
    {
      heading: "Handler integration",
      explanation: "The signup handler now validates email using the new schema before processing.",
      hunks: [
        {
          file: "src/handlers/signup.ts",
          startLine: 15,
          endLine: 25,
          diff: "@@ -15,3 +15,7 @@\n function handleSignup(req) {\n+  const email = emailSchema.parse(req.body.email);\n+  // process signup\n   return { ok: true };\n }",
        },
        {
          file: "src/handlers/signup.ts",
          startLine: 1,
          endLine: 3,
          diff: '@@ -1,2 +1,3 @@\n import { Router } from "express";\n+import { emailSchema } from "../validators/email";',
        },
      ],
    },
  ],
};

describe("renderTour", () => {
  it("produces valid self-contained HTML with doctype and structure", async () => {
    const html = await renderTour(samplePlan);
    expect(html).toStartWith("<!DOCTYPE html>");
    expect(html).toContain("<html");
    expect(html).toContain("</html>");
    expect(html).toContain("<head>");
    expect(html).toContain("<style>");
    expect(html).toContain("<script>");
  });

  it("includes the title and summary on the title slide", async () => {
    const html = await renderTour(samplePlan);
    expect(html).toContain("Add email validation");
    expect(html).toContain("server-side email validation");
  });

  it("includes all section headings and explanations in order", async () => {
    const html = await renderTour(samplePlan);
    expect(html).toContain("Validation schema");
    expect(html).toContain("Handler integration");
    expect(html).toContain("Zod schema was added");
    expect(html).toContain("signup handler now validates");

    // Verify order: section 1 before section 2
    const idx1 = html.indexOf("Validation schema");
    const idx2 = html.indexOf("Handler integration");
    expect(idx1).toBeLessThan(idx2);
  });

  it("includes file badges for each section", async () => {
    const html = await renderTour(samplePlan);
    expect(html).toContain("src/validators/email.ts");
    expect(html).toContain("src/handlers/signup.ts");
  });

  it("includes diff content with syntax highlighting", async () => {
    const html = await renderTour(samplePlan);
    // The diff content should be present (either via Shiki or fallback)
    expect(html).toContain("emailSchema");
    expect(html).toContain("handleSignup");
    // Should have diff-specific styling classes
    expect(html).toContain("line-add");
  });

  it("includes keyboard navigation (arrow key handlers)", async () => {
    const html = await renderTour(samplePlan);
    expect(html).toContain("ArrowLeft");
    expect(html).toContain("ArrowRight");
  });

  it("includes prev/next buttons", async () => {
    const html = await renderTour(samplePlan);
    expect(html).toContain("prev-btn");
    expect(html).toContain("next-btn");
    expect(html).toContain("Prev");
    expect(html).toContain("Next");
  });

  it("includes a progress indicator", async () => {
    const html = await renderTour(samplePlan);
    // Title slide + 2 sections = 3 total
    expect(html).toContain("1 / 3");
    expect(html).toContain("progress");
  });

  it("contains no external URLs (fully self-contained)", async () => {
    const html = await renderTour(samplePlan);
    // Check for common external URL patterns
    expect(html).not.toMatch(/https?:\/\/[^"']*\.(css|js|woff|ttf)/);
    expect(html).not.toContain('<link rel="stylesheet" href="http');
    expect(html).not.toContain('<script src="http');
  });

  it("uses monospace font for code and sans-serif for prose", async () => {
    const html = await renderTour(samplePlan);
    expect(html).toContain("monospace");
    expect(html).toContain("sans-serif");
  });

  it("is responsive with a media query", async () => {
    const html = await renderTour(samplePlan);
    expect(html).toContain("@media");
    expect(html).toContain("768px");
  });
});
