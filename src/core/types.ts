import { z } from 'zod';

/** Scoring dimensions (FR-C1). */
export const dimensionSchema = z.enum([
  'clarity',
  'specificity',
  'context',
  'constraints',
  'outputSpec',
  'structure',
]);
export type Dimension = z.output<typeof dimensionSchema>;

export const severitySchema = z.enum(['info', 'minor', 'major']);
export type Severity = z.output<typeof severitySchema>;

export const findingSchema = z.object({
  id: z.string(),
  dimension: dimensionSchema,
  severity: severitySchema,
  /** human-readable, shown verbatim in the Explain Weaknesses report */
  message: z.string(),
  /** actionable fix, also injected into the rewrite meta-prompt */
  suggestion: z.string(),
});
export type Finding = z.output<typeof findingSchema>;

export const taskTypeSchema = z.enum([
  'coding',
  'writing',
  'research',
  'business',
  'education',
  'creative',
  'general',
]);
export type TaskType = z.output<typeof taskTypeSchema>;

export const complexitySchema = z.enum(['simple', 'moderate', 'complex']);

export const scoreSchema = z.object({
  overall: z.number().min(0).max(100),
  byDimension: z.record(dimensionSchema, z.number().min(0).max(100)),
});

export const promptAnalysisSchema = z.object({
  taskType: taskTypeSchema,
  complexity: complexitySchema,
  wordCount: z.number(),
  score: scoreSchema,
  findings: z.array(findingSchema),
});
export type PromptAnalysis = z.output<typeof promptAnalysisSchema>;

/** Models the rewrite can be idiom-tuned for (FR-B, "Optimize for Model"). */
export const targetModelSchema = z.enum(['gpt', 'claude', 'gemini', 'generic']);
export type TargetModel = z.output<typeof targetModelSchema>;
