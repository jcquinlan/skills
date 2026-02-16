import { describe, expect, it } from "bun:test";

describe("project setup", () => {
  it("bun test runner works", () => {
    expect(1 + 1).toBe(2);
  });

  it("can import zod", async () => {
    const { z } = await import("zod");
    expect(z.string().parse("hello")).toBe("hello");
  });

  it("can import shiki", async () => {
    const shiki = await import("shiki");
    expect(shiki).toBeDefined();
  });

  it("can import anthropic sdk", async () => {
    const anthropic = await import("@anthropic-ai/sdk");
    expect(anthropic).toBeDefined();
  });
});
