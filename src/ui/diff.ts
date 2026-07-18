/**
 * Minimal word-level diff (LCS) for the Before/After view. Inputs are user
 * prompts (small); above the token cap we skip highlighting rather than risk
 * quadratic blowup.
 */

export interface DiffSegment {
  kind: 'same' | 'added' | 'removed';
  text: string;
}

const TOKEN_CAP = 600;

export function diffWords(before: string, after: string): DiffSegment[] | null {
  const a = before.split(/(\s+)/).filter((t) => t !== '');
  const b = after.split(/(\s+)/).filter((t) => t !== '');
  if (a.length > TOKEN_CAP || b.length > TOKEN_CAP) {
    return null;
  }

  // LCS table
  const rows = a.length + 1;
  const cols = b.length + 1;
  const table = new Uint16Array(rows * cols);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i * cols + j] =
        a[i] === b[j]
          ? (table[(i + 1) * cols + j + 1] ?? 0) + 1
          : Math.max(table[(i + 1) * cols + j] ?? 0, table[i * cols + j + 1] ?? 0);
    }
  }

  const segments: DiffSegment[] = [];
  const push = (kind: DiffSegment['kind'], text: string) => {
    const last = segments[segments.length - 1];
    if (last?.kind === kind) {
      last.text += text;
    } else {
      segments.push({ kind, text });
    }
  };

  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push('same', a[i] ?? '');
      i++;
      j++;
    } else if ((table[(i + 1) * cols + j] ?? 0) >= (table[i * cols + j + 1] ?? 0)) {
      push('removed', a[i] ?? '');
      i++;
    } else {
      push('added', b[j] ?? '');
      j++;
    }
  }
  while (i < a.length) {
    push('removed', a[i++] ?? '');
  }
  while (j < b.length) {
    push('added', b[j++] ?? '');
  }
  return segments;
}
