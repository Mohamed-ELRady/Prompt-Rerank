import { useState } from 'react';
import { type PromptAnalysis } from '@/core/types';

function scoreColor(score: number): string {
  if (score >= 75) {
    return 'text-green-700 dark:text-green-400';
  }
  if (score >= 50) {
    return 'text-amber-600 dark:text-amber-400';
  }
  return 'text-red-600 dark:text-red-400';
}

/** Instant local analysis summary shown above the streamed result (FR-C1). */
export function AnalysisCard({ analysis }: { analysis: PromptAnalysis }) {
  const [expanded, setExpanded] = useState(false);
  const majors = analysis.findings.filter((f) => f.severity === 'major').length;

  return (
    <div className="mb-2 rounded-md border border-neutral-200 bg-neutral-50 p-2 text-xs dark:border-neutral-700 dark:bg-neutral-800/60">
      <div className="flex items-center justify-between">
        <p className="text-neutral-600 dark:text-neutral-300">
          Quality{' '}
          <strong className={scoreColor(analysis.score.overall)}>
            {analysis.score.overall}/100
          </strong>
          <span className="text-neutral-400"> · {analysis.taskType}</span>
          <span className="text-neutral-400">
            {' '}
            · {analysis.findings.length} finding{analysis.findings.length === 1 ? '' : 's'}
            {majors > 0 ? ` (${String(majors)} major)` : ''}
          </span>
        </p>
        {analysis.findings.length > 0 && (
          <button
            type="button"
            aria-expanded={expanded}
            className="text-violet-600 hover:underline dark:text-violet-400"
            onClick={() => {
              setExpanded(!expanded);
            }}
          >
            {expanded ? 'Hide' : 'Details'}
          </button>
        )}
      </div>
      {expanded && (
        <ul className="mt-1.5 space-y-1">
          {analysis.findings.map((finding, index) => (
            <li key={`${finding.id}-${String(index)}`} className="flex gap-1.5">
              <span
                aria-hidden="true"
                className={
                  finding.severity === 'major'
                    ? 'text-red-500'
                    : finding.severity === 'minor'
                      ? 'text-amber-500'
                      : 'text-neutral-400'
                }
              >
                ●
              </span>
              <span className="text-neutral-700 dark:text-neutral-200">{finding.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
