import { describe, expect, it } from 'vitest';
import { actions, getAction } from './index';

describe('action registry', () => {
  it('has unique ids', () => {
    expect(new Set(actions.map((a) => a.id)).size).toBe(actions.length);
  });

  it('covers every capability from the product spec', () => {
    const ids = actions.map((a) => a.id);
    for (const required of [
      'improve',
      'powerful',
      'fix',
      'professional',
      'expand',
      'shorten',
      'explain',
      'alternative',
      'optimize-coding',
      'optimize-writing',
      'optimize-research',
      'optimize-business',
      'optimize-education',
      'optimize-gpt',
      'optimize-claude',
      'optimize-gemini',
      'translate-en',
    ]) {
      expect(ids).toContain(required);
    }
  });

  it('has translation opt out of analysis-driven "improvement"', () => {
    expect(getAction('translate-en').usesAnalysis).toBe(false);
  });

  it('marks only explain as non-rewriting', () => {
    expect(actions.filter((a) => !a.producesRewrite).map((a) => a.id)).toEqual(['explain']);
  });

  it('falls back to improve for unknown ids', () => {
    expect(getAction('nope').id).toBe('improve');
  });
});
