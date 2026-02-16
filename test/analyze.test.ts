import { describe, expect, it, mock, afterEach } from "bun:test";
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

// LLM now returns hunk_ids instead of full hunk objects
const validLLMResponse = JSON.stringify({
  title: "Add bar import",
  summary: "This change adds a bar import to the main module.",
  sections: [
    {
      heading: "New import",
      explanation: "A new import for bar was added to main.ts.",
      hunk_ids: [0],
    },
  ],
});

// Creates a mock async iterable that simulates SSE streaming events
function makeMockCreate(responseText: string) {
  return (params: { stream?: boolean; messages: Array<{ content: string }> }) => {
    if (params.stream) {
      const events = [
        { type: "content_block_delta", delta: { type: "text_delta", text: responseText } },
        { type: "message_stop" },
      ];
      return {
        [Symbol.asyncIterator]: async function* () {
          for (const event of events) yield event;
        },
      };
    }
    return Promise.resolve({
      content: [{ type: "text", text: responseText }],
    });
  };
}

function makeMockCreateWithCapture(responseText: string, capture: { prompt: string }) {
  return (params: { stream?: boolean; messages: Array<{ content: string }> }) => {
    capture.prompt = params.messages[0].content;
    return makeMockCreate(responseText)(params);
  };
}

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
    const { analyzeDiff } = await import("../src/analyze.ts");
    await expect(analyzeDiff(sampleHunks)).rejects.toThrow("ANTHROPIC_API_KEY");
  });

  it("maps hunk_ids back to original parsed hunks", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key-123";

    mock.module("@anthropic-ai/sdk", () => ({
      default: class {
        messages = { create: makeMockCreate(validLLMResponse) };
      },
    }));

    const { analyzeDiff } = await import("../src/analyze.ts");
    const result = await analyzeDiff(sampleHunks);

    expect(result.title).toBe("Add bar import");
    expect(result.summary).toContain("bar import");
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].heading).toBe("New import");
    // The hunk should be the original parsed hunk, not from the LLM
    expect(result.sections[0].hunks[0].file).toBe("src/main.ts");
    expect(result.sections[0].hunks[0].diff).toContain("bar");
    expect(result.sections[0].hunks[0].startLine).toBe(1);
  });

  it("handles JSON wrapped in markdown code blocks", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key-123";

    const wrappedJSON = "```json\n" + validLLMResponse + "\n```";
    mock.module("@anthropic-ai/sdk", () => ({
      default: class {
        messages = { create: makeMockCreate(wrappedJSON) };
      },
    }));

    const { analyzeDiff } = await import("../src/analyze.ts");
    const result = await analyzeDiff(sampleHunks);
    expect(result.title).toBe("Add bar import");
  });

  it("throws on invalid JSON response", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key-123";

    mock.module("@anthropic-ai/sdk", () => ({
      default: class {
        messages = { create: makeMockCreate("this is not json") };
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

  it("filters out invalid hunk_ids", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key-123";

    const responseWithBadIds = JSON.stringify({
      title: "Test",
      summary: "Test",
      sections: [
        { heading: "S1", explanation: "E1", hunk_ids: [0, 99, -1] },
      ],
    });

    mock.module("@anthropic-ai/sdk", () => ({
      default: class {
        messages = { create: makeMockCreate(responseWithBadIds) };
      },
    }));

    const { analyzeDiff } = await import("../src/analyze.ts");
    const result = await analyzeDiff(sampleHunks);
    // Only hunk 0 is valid; 99 and -1 should be filtered out
    expect(result.sections[0].hunks).toHaveLength(1);
  });

  it("passes the title override in the prompt", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key-123";

    const capture = { prompt: "" };
    mock.module("@anthropic-ai/sdk", () => ({
      default: class {
        messages = { create: makeMockCreateWithCapture(validLLMResponse, capture) };
      },
    }));

    const { analyzeDiff } = await import("../src/analyze.ts");
    await analyzeDiff(sampleHunks, { title: "My Custom Title" });
    expect(capture.prompt).toContain("My Custom Title");
  });

  it("includes numbered hunk references in the prompt", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key-123";

    const capture = { prompt: "" };
    mock.module("@anthropic-ai/sdk", () => ({
      default: class {
        messages = { create: makeMockCreateWithCapture(validLLMResponse, capture) };
      },
    }));

    const { analyzeDiff } = await import("../src/analyze.ts");
    await analyzeDiff(sampleHunks);
    expect(capture.prompt).toContain("[Hunk 0]");
    expect(capture.prompt).toContain("hunk_ids");
  });
});
