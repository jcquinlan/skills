import { describe, expect, it, mock, beforeEach, afterEach } from "bun:test";
import type { ParsedHunk } from "../src/parse.ts";

const sampleHunks: ParsedHunk[] = [
  {
    file: "src/main.ts",
    startLine: 1,
    endLine: 4,
    header: "@@ -1,3 +1,4 @@",
    diff: '@@ -1,3 +1,4 @@\n import { foo } from "./foo";\n+import { bar } from "./bar";\n\n foo();',
  },
];

const validTourPlanJSON = JSON.stringify({
  title: "Add bar import",
  summary: "This change adds a bar import to the main module.",
  sections: [
    {
      heading: "New import",
      explanation: "A new import for bar was added to main.ts.",
      hunks: [
        {
          file: "src/main.ts",
          startLine: 1,
          endLine: 4,
          diff: '@@ -1,3 +1,4 @@\n import { foo } from "./foo";\n+import { bar } from "./bar";\n\n foo();',
        },
      ],
    },
  ],
});

describe("analyzeDiff", () => {
  const originalEnv = process.env.ANTHROPIC_API_KEY;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.ANTHROPIC_API_KEY = originalEnv;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }
    mock.restore();
  });

  it("throws a clear error if ANTHROPIC_API_KEY is not set", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    // Re-import to get fresh module
    const { analyzeDiff } = await import("../src/analyze.ts");
    await expect(analyzeDiff(sampleHunks)).rejects.toThrow("ANTHROPIC_API_KEY");
  });

  it("validates a well-formed mock response against the TourPlan schema", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key-123";

    // Mock the Anthropic SDK
    const mockCreate = mock(() =>
      Promise.resolve({
        content: [{ type: "text", text: validTourPlanJSON }],
      }),
    );

    mock.module("@anthropic-ai/sdk", () => ({
      default: class {
        messages = { create: mockCreate };
      },
    }));

    // Must re-import after mock
    const { analyzeDiff } = await import("../src/analyze.ts");
    const result = await analyzeDiff(sampleHunks);

    expect(result.title).toBe("Add bar import");
    expect(result.summary).toContain("bar import");
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].heading).toBe("New import");
    expect(result.sections[0].hunks[0].file).toBe("src/main.ts");
  });

  it("handles JSON wrapped in markdown code blocks", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key-123";

    const wrappedJSON = "```json\n" + validTourPlanJSON + "\n```";
    const mockCreate = mock(() =>
      Promise.resolve({
        content: [{ type: "text", text: wrappedJSON }],
      }),
    );

    mock.module("@anthropic-ai/sdk", () => ({
      default: class {
        messages = { create: mockCreate };
      },
    }));

    const { analyzeDiff } = await import("../src/analyze.ts");
    const result = await analyzeDiff(sampleHunks);
    expect(result.title).toBe("Add bar import");
  });

  it("throws on invalid JSON response", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key-123";

    const mockCreate = mock(() =>
      Promise.resolve({
        content: [{ type: "text", text: "this is not json" }],
      }),
    );

    mock.module("@anthropic-ai/sdk", () => ({
      default: class {
        messages = { create: mockCreate };
      },
    }));

    const { analyzeDiff } = await import("../src/analyze.ts");
    await expect(analyzeDiff(sampleHunks)).rejects.toThrow("Failed to parse");
  });

  it("throws on diff exceeding size limit", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key-123";

    const largeHunks: ParsedHunk[] = [
      {
        file: "big.ts",
        startLine: 1,
        endLine: 10000,
        header: "@@ -1,1 +1,10000 @@",
        diff: "x".repeat(110_000),
      },
    ];

    const { analyzeDiff } = await import("../src/analyze.ts");
    await expect(analyzeDiff(largeHunks)).rejects.toThrow("too large");
  });

  it("passes the title override in the prompt", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key-123";

    let capturedPrompt = "";
    const mockCreate = mock((params: { messages: Array<{ content: string }> }) => {
      capturedPrompt = params.messages[0].content;
      return Promise.resolve({
        content: [{ type: "text", text: validTourPlanJSON }],
      });
    });

    mock.module("@anthropic-ai/sdk", () => ({
      default: class {
        messages = { create: mockCreate };
      },
    }));

    const { analyzeDiff } = await import("../src/analyze.ts");
    await analyzeDiff(sampleHunks, { title: "My Custom Title" });
    expect(capturedPrompt).toContain("My Custom Title");
  });
});
