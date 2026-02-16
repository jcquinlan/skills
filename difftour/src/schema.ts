import { z } from "zod";

export const HunkSchema = z.object({
  file: z.string(),
  startLine: z.number(),
  endLine: z.number(),
  diff: z.string(),
});

export type Hunk = z.infer<typeof HunkSchema>;

export const SectionSchema = z.object({
  heading: z.string(),
  explanation: z.string(),
  hunks: z.array(HunkSchema),
  language: z.string().optional(),
});

export type Section = z.infer<typeof SectionSchema>;

export const TourPlanSchema = z.object({
  title: z.string(),
  summary: z.string(),
  sections: z.array(SectionSchema),
});

export type TourPlan = z.infer<typeof TourPlanSchema>;

// Lightweight schema for LLM responses — references hunks by index instead of
// echoing back the full diff text, cutting response size dramatically.
export const LLMSectionSchema = z.object({
  heading: z.string(),
  explanation: z.string(),
  hunk_ids: z.array(z.number()),
  language: z.string().optional(),
});

export type LLMSection = z.infer<typeof LLMSectionSchema>;

export const LLMTourPlanSchema = z.object({
  title: z.string(),
  summary: z.string(),
  sections: z.array(LLMSectionSchema),
});

export type LLMTourPlan = z.infer<typeof LLMTourPlanSchema>;
