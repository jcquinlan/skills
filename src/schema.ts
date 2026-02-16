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
});

export type Section = z.infer<typeof SectionSchema>;

export const TourPlanSchema = z.object({
  title: z.string(),
  summary: z.string(),
  sections: z.array(SectionSchema),
});

export type TourPlan = z.infer<typeof TourPlanSchema>;
