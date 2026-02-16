import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { writeFileSync, unlinkSync, existsSync } from "fs";
import { join } from "path";

const testDir = join(import.meta.dir, "..");
const testDiffFile = join(testDir, "test-fixture.patch");

const validDiff = `diff --git a/src/main.ts b/src/main.ts
index abc1234..def5678 100644
--- a/src/main.ts
+++ b/src/main.ts
@@ -1,3 +1,4 @@
 import { foo } from "./foo";
+import { bar } from "./bar";

 foo();`;

describe("CLI", () => {
  const originalApiKey = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    // Write test fixture
    writeFileSync(testDiffFile, validDiff, "utf-8");
  });

  afterEach(() => {
    if (originalApiKey !== undefined) {
      process.env.ANTHROPIC_API_KEY = originalApiKey;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }
    // Clean up fixture
    if (existsSync(testDiffFile)) unlinkSync(testDiffFile);
  });

  it("exits with non-zero code for empty stdin input", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const proc = Bun.spawn(["bun", "run", "src/cli.ts"], {
      cwd: testDir,
      stdin: new Blob([""]),
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, ANTHROPIC_API_KEY: "test-key" },
    });
    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("No input provided");
  });

  it("exits with non-zero code for non-diff input", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const proc = Bun.spawn(["bun", "run", "src/cli.ts"], {
      cwd: testDir,
      stdin: new Blob(["this is just regular text with no diff markers"]),
      stdout: "pipe",
      stderr: "pipe",
      env: { ...process.env, ANTHROPIC_API_KEY: "test-key" },
    });
    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("not appear to be a valid unified diff");
  });

  it("exits with non-zero code if ANTHROPIC_API_KEY is missing", async () => {
    const env = { ...process.env, ANTHROPIC_API_KEY: "" };
    const proc = Bun.spawn(["bun", "run", "src/cli.ts", testDiffFile], {
      cwd: testDir,
      stdout: "pipe",
      stderr: "pipe",
      env,
    });
    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("ANTHROPIC_API_KEY");
  });

  it("reads diff from a file path argument", async () => {
    // This will fail at the API call step (no real key), but it should get past
    // input reading and validation
    const env = { ...process.env, ANTHROPIC_API_KEY: "" };
    const proc = Bun.spawn(["bun", "run", "src/cli.ts", testDiffFile], {
      cwd: testDir,
      stdout: "pipe",
      stderr: "pipe",
      env,
    });
    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();
    // Should fail on API key, not on "no input" — proving the file was read
    expect(stderr).toContain("ANTHROPIC_API_KEY");
    expect(stderr).not.toContain("No input provided");
  });

  it("package.json bin field maps difftour to src/cli.ts", async () => {
    const pkg = await Bun.file(join(testDir, "package.json")).json();
    expect(pkg.bin.difftour).toBe("src/cli.ts");
  });
});
