import { describe, expect, it } from 'vitest';
import { diffWords } from './diff';

describe('diffWords', () => {
  it('marks unchanged, added and removed words', () => {
    const segments = diffWords('write a poem', 'write a beautiful poem');
    expect(segments).not.toBeNull();
    const added = segments?.filter((s) => s.kind === 'added').map((s) => s.text.trim());
    expect(added).toContain('beautiful');
    expect(segments?.filter((s) => s.kind === 'removed')).toHaveLength(0);
  });

  it('round-trips: same segments + removed = before, same + added = after', () => {
    const before = 'the quick brown fox jumps over the lazy dog';
    const after = 'the slow brown fox leaps over a lazy dog today';
    const segments = diffWords(before, after);
    const rebuiltBefore = segments
      ?.filter((s) => s.kind !== 'added')
      .map((s) => s.text)
      .join('');
    const rebuiltAfter = segments
      ?.filter((s) => s.kind !== 'removed')
      .map((s) => s.text)
      .join('');
    expect(rebuiltBefore?.replace(/\s+/g, ' ')).toBe(before);
    expect(rebuiltAfter?.replace(/\s+/g, ' ')).toBe(after);
  });

  it('bails out above the token cap', () => {
    const long = Array(700).fill('word').join(' ');
    expect(diffWords(long, long)).toBeNull();
  });
});
