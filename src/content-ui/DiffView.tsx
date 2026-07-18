import { diffWords } from '@/ui/diff';

/** Before/After comparison with word-level highlighting (FR-A3). */
export function DiffView({ before, after }: { before: string; after: string }) {
  const segments = diffWords(before, after);

  if (!segments) {
    // over the diff token cap — stacked comparison without highlighting
    return (
      <div className="max-h-56 space-y-2 overflow-y-auto text-sm">
        <ComparisonBlock title="Before" text={before} />
        <ComparisonBlock title="After" text={after} />
      </div>
    );
  }

  return (
    <div className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-md bg-neutral-50 p-2 text-sm text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100">
      {segments.map((segment, index) =>
        segment.kind === 'same' ? (
          <span key={index}>{segment.text}</span>
        ) : segment.kind === 'added' ? (
          <ins
            key={index}
            className="rounded-sm bg-green-100 text-green-900 no-underline dark:bg-green-900/50 dark:text-green-200"
          >
            {segment.text}
          </ins>
        ) : (
          <del
            key={index}
            className="rounded-sm bg-red-100 text-red-900 dark:bg-red-900/50 dark:text-red-300"
          >
            {segment.text}
          </del>
        ),
      )}
    </div>
  );
}

function ComparisonBlock({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
        {title}
      </p>
      <p className="whitespace-pre-wrap rounded-md bg-neutral-50 p-2 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100">
        {text}
      </p>
    </div>
  );
}
