import { describe, expect, it, afterEach } from "bun:test";
import { join } from "path";
import { existsSync, unlinkSync, readFileSync } from "fs";

const projectDir = join(import.meta.dir, "..");
const renderScript = join(projectDir, "src/render-tour.ts");

const validTourPlan = JSON.stringify({
  title: "Test Tour",
  summary: "A test tour for the render pipeline.",
  sections: [
    {
      heading: "Test section",
      explanation: "This tests the render-tour entry point.",
      hunks: [
        {
          file: "test.ts",
          startLine: 1,
          endLine: 3,
          diff: "@@ -1,2 +1,3 @@\n const a = 1;\n+const b = 2;\n export { a };",
        },
      ],
    },
  ],
});

const outputFile = join(projectDir, "test-render-output.html");

describe("render-tour.ts", () => {
  afterEach(() => {
    if (existsSync(outputFile)) unlinkSync(outputFile);
  });

  it("renders valid TourPlan JSON from stdin to HTML", async () => {
    const proc = Bun.spawn(["bun", "run", renderScript, "-o", outputFile], {
      cwd: projectDir,
      stdin: new Blob([validTourPlan]),
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();
    expect(exitCode).toBe(0);
    expect(stderr).toContain("Done!");
    expect(existsSync(outputFile)).toBe(true);

    const html = readFileSync(outputFile, "utf-8");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Test Tour");
    expect(html).toContain("Test section");
  });

  it("exits with error for empty stdin", async () => {
    const proc = Bun.spawn(["bun", "run", renderScript], {
      cwd: projectDir,
      stdin: new Blob([""]),
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("No input");
  });

  it("exits with error for invalid JSON", async () => {
    const proc = Bun.spawn(["bun", "run", renderScript], {
      cwd: projectDir,
      stdin: new Blob(["this is not json"]),
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("not valid JSON");
  });

  it("exits with error for JSON that doesn't match TourPlan schema", async () => {
    const badJson = JSON.stringify({ foo: "bar" });
    const proc = Bun.spawn(["bun", "run", renderScript], {
      cwd: projectDir,
      stdin: new Blob([badJson]),
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("does not match TourPlan schema");
  });

  it("defaults output to tour.html when -o is not specified", async () => {
    const defaultOutput = join(projectDir, "tour.html");
    try {
      const proc = Bun.spawn(["bun", "run", renderScript], {
        cwd: projectDir,
        stdin: new Blob([validTourPlan]),
        stdout: "pipe",
        stderr: "pipe",
      });
      const exitCode = await proc.exited;
      expect(exitCode).toBe(0);
      expect(existsSync(defaultOutput)).toBe(true);
    } finally {
      if (existsSync(defaultOutput)) unlinkSync(defaultOutput);
    }
  });
});
