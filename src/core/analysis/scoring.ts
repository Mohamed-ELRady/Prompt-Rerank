import { type Dimension, type Finding, type Severity } from '../types';

/**
 * Score aggregation (FR-C1). All tuning knobs live in this one config object
 * so quality calibration is a data change guarded by snapshot tests.
 */
export const scoringConfig = {
  penalties: { info: 5, minor: 14, major: 30 } satisfies Record<Severity, number>,
  weights: {
    clarity: 0.25,
    specificity: 0.2,
    context: 0.15,
    constraints: 0.15,
    outputSpec: 0.15,
    structure: 0.1,
  } satisfies Record<Dimension, number>,
};

export interface Score {
  overall: number;
  byDimension: Record<Dimension, number>;
}

export function computeScore(findings: Finding[]): Score {
  const byDimension = {
    clarity: 100,
    specificity: 100,
    context: 100,
    constraints: 100,
    outputSpec: 100,
    structure: 100,
  } satisfies Record<Dimension, number> as Record<Dimension, number>;

  for (const finding of findings) {
    byDimension[finding.dimension] = Math.max(
      0,
      byDimension[finding.dimension] - scoringConfig.penalties[finding.severity],
    );
  }

  const overall = Math.round(
    (Object.entries(scoringConfig.weights) as [Dimension, number][]).reduce(
      (sum, [dimension, weight]) => sum + byDimension[dimension] * weight,
      0,
    ),
  );

  return { overall, byDimension };
}
