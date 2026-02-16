#!/usr/bin/env bun

import { writeFileSync } from "fs";
import { TourPlanSchema } from "./schema.ts";
import { renderTour } from "./render.ts";

function parseArgs(argv: string[]): { output: string } {
  const args = { output: "tour.html" };
  for (let i = 0; i < argv.length; i++) {
    if ((argv[i] === "-o" || argv[i] === "--output") && i + 1 < argv.length) {
      args.output = argv[++i];
    }
  }
  return args;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  const reader = Bun.stdin.stream().getReader();
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const input = await readStdin();

  if (!input.trim()) {
    console.error("Error: No input. Pipe a TourPlan JSON to stdin.");
    console.error("Usage: echo '{...}' | bun run src/render-tour.ts [-o output.html]");
    process.exit(1);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(input);
  } catch {
    console.error("Error: Input is not valid JSON.");
    process.exit(1);
  }

  let plan;
  try {
    plan = TourPlanSchema.parse(raw);
  } catch (err) {
    console.error("Error: JSON does not match TourPlan schema.");
    if (err instanceof Error) console.error(err.message);
    process.exit(1);
  }

  console.error(`Rendering tour: "${plan.title}" (${plan.sections.length} sections)`);
  const html = await renderTour(plan);

  writeFileSync(args.output, html, "utf-8");
  const sizeKB = Math.round(html.length / 1024);
  console.error(`Done! Written to ${args.output} (${sizeKB}KB)`);
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
