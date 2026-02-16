#!/usr/bin/env bun

import { readFileSync } from "fs";
import { writeFileSync } from "fs";
import { parseDiff } from "./parse.ts";
import { analyzeDiff } from "./analyze.ts";
import { renderTour } from "./render.ts";

interface CliArgs {
  output: string;
  title?: string;
  inputFile?: string;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { output: "tour.html" };
  let i = 0;

  while (i < argv.length) {
    const arg = argv[i];
    if (arg === "-o" || arg === "--output") {
      i++;
      if (i >= argv.length) {
        console.error("Error: -o/--output requires a filename argument.");
        process.exit(1);
      }
      args.output = argv[i]!;
    } else if (arg === "--title") {
      i++;
      if (i >= argv.length) {
        console.error("Error: --title requires a value.");
        process.exit(1);
      }
      args.title = argv[i];
    } else if (!arg.startsWith("-")) {
      args.inputFile = arg;
    }
    i++;
  }

  return args;
}

function isUnifiedDiff(text: string): boolean {
  return text.includes("---") && text.includes("+++");
}

async function readInput(inputFile?: string): Promise<string> {
  if (inputFile) {
    try {
      return readFileSync(inputFile, "utf-8");
    } catch (err) {
      console.error(`Error: Could not read file "${inputFile}".`);
      process.exit(1);
    }
  }

  // Read from stdin
  const chunks: Buffer[] = [];
  const stdin = Bun.stdin.stream();
  const reader = stdin.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks).toString("utf-8");
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const args = parseArgs(argv);

  // Check for API key early
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Error: ANTHROPIC_API_KEY is not set. Export it in your environment to use DiffTour.");
    process.exit(1);
  }

  const input = await readInput(args.inputFile);

  if (!input.trim()) {
    console.error("Error: No input provided. Pipe a diff or provide a file path.");
    console.error("Usage: git diff main | difftour");
    console.error("       difftour diff.patch");
    process.exit(1);
  }

  if (!isUnifiedDiff(input)) {
    console.error("Error: Input does not appear to be a valid unified diff.");
    console.error("A unified diff should contain '---' and '+++' lines.");
    process.exit(1);
  }

  const hunks = parseDiff(input);
  if (hunks.length === 0) {
    console.error("Error: No parseable hunks found in the diff.");
    process.exit(1);
  }

  console.error(`Analyzing ${hunks.length} hunk(s) across ${new Set(hunks.map((h) => h.file)).size} file(s)...`);

  const plan = await analyzeDiff(hunks, { title: args.title });

  console.error("Rendering tour...");
  const html = await renderTour(plan);

  writeFileSync(args.output, html, "utf-8");
  console.error(`Tour written to ${args.output}`);
}

// Run if this is the entry point
const isMain = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("cli.ts");
if (isMain) {
  main().catch((err) => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  });
}
