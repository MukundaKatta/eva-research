import { z } from "zod";

export const ThemeSchema = z.object({
  title: z.string(),
  evidence: z.array(z.string().url()),
  hypothesis: z.string(),
  confidence: z.number().min(0).max(1),
});

export const ExperimentSchema = z.object({
  id: z.string(),
  try_this: z.string(),
  platform: z.enum(["x", "yt", "reddit", "newsletter"]),
  estimated_effort_min: z.number().int().positive(),
  theme_ref: z.string(),
});

export const WeeklyMemoSchema = z.object({
  week_of: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Must be YYYY-WW format"),
  themes: z.array(ThemeSchema).min(1).max(10),
  experiments: z.array(ExperimentSchema).min(1).max(20),
});

export type ValidatedMemo = z.infer<typeof WeeklyMemoSchema>;
