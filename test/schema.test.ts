import { describe, expect, it } from "bun:test";
import { HunkSchema, SectionSchema, TourPlanSchema, LLMTourPlanSchema } from "../src/schema.ts";

const validHunk = {
  file: "src/validators/email.ts",
  startLine: 1,
  endLine: 24,
  diff: "@@ -0,0 +1,24 @@\n+export const emailRegex = /^.+@.+$/;",
};

const validSection = {
  heading: "New validation schema",
  explanation: "A Zod schema was added to define the shape of valid email inputs.",
  hunks: [validHunk],
};

const validTourPlan = {
  title: "Add email validation to signup flow",
  summary: "This change adds server-side email validation to prevent invalid signups.",
  sections: [validSection],
};

describe("HunkSchema", () => {
  it("validates a well-formed hunk", () => {
    const result = HunkSchema.parse(validHunk);
    expect(result.file).toBe("src/validators/email.ts");
    expect(result.startLine).toBe(1);
    expect(result.endLine).toBe(24);
    expect(result.diff).toContain("emailRegex");
  });

  it("rejects a hunk with missing file field", () => {
    expect(() => HunkSchema.parse({ startLine: 1, endLine: 24, diff: "..." })).toThrow();
  });

  it("rejects a hunk with missing diff field", () => {
    expect(() => HunkSchema.parse({ file: "a.ts", startLine: 1, endLine: 24 })).toThrow();
  });

  it("rejects a hunk with wrong types", () => {
    expect(() => HunkSchema.parse({ file: 123, startLine: "a", endLine: "b", diff: null })).toThrow();
  });
});

describe("SectionSchema", () => {
  it("validates a well-formed section", () => {
    const result = SectionSchema.parse(validSection);
    expect(result.heading).toBe("New validation schema");
    expect(result.hunks).toHaveLength(1);
  });

  it("rejects a section missing heading", () => {
    expect(() => SectionSchema.parse({ explanation: "...", hunks: [] })).toThrow();
  });

  it("rejects a section missing explanation", () => {
    expect(() => SectionSchema.parse({ heading: "...", hunks: [] })).toThrow();
  });
});

describe("TourPlanSchema", () => {
  it("validates a well-formed tour plan", () => {
    const result = TourPlanSchema.parse(validTourPlan);
    expect(result.title).toBe("Add email validation to signup flow");
    expect(result.summary).toContain("email validation");
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].hunks[0].file).toBe("src/validators/email.ts");
  });

  it("rejects a tour plan missing title", () => {
    expect(() => TourPlanSchema.parse({ summary: "...", sections: [] })).toThrow();
  });

  it("rejects a tour plan missing summary", () => {
    expect(() => TourPlanSchema.parse({ title: "...", sections: [] })).toThrow();
  });

  it("rejects a tour plan missing sections", () => {
    expect(() => TourPlanSchema.parse({ title: "...", summary: "..." })).toThrow();
  });

  it("validates a tour plan with multiple sections", () => {
    const plan = {
      ...validTourPlan,
      sections: [validSection, { heading: "Tests", explanation: "Added test coverage.", hunks: [] }],
    };
    const result = TourPlanSchema.parse(plan);
    expect(result.sections).toHaveLength(2);
  });
});

describe("LLMTourPlanSchema", () => {
  it("validates a well-formed LLM response with hunk_ids", () => {
    const result = LLMTourPlanSchema.parse({
      title: "Test",
      summary: "Test summary",
      sections: [{ heading: "S1", explanation: "E1", hunk_ids: [0, 2, 5] }],
    });
    expect(result.sections[0].hunk_ids).toEqual([0, 2, 5]);
  });

  it("rejects sections with hunks array instead of hunk_ids", () => {
    expect(() =>
      LLMTourPlanSchema.parse({
        title: "Test",
        summary: "Test",
        sections: [{ heading: "S1", explanation: "E1", hunks: [] }],
      }),
    ).toThrow();
  });
});
