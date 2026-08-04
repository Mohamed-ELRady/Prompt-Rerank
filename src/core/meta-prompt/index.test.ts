import { describe, expect, it } from 'vitest';
import { analyzePrompt } from '../analysis/engine';
import { actions } from '../actions';
import { DELIMITER } from './fragments';
import { buildMetaPrompt } from './index';

describe('buildMetaPrompt', () => {
  const text = 'write a poem about the sea';

  it('wraps user text in delimiters and never leaks it into the system prompt', () => {
    const meta = buildMetaPrompt({ actionId: 'improve', text });
    expect(meta.user).toBe(`${DELIMITER}\n${text}\n${DELIMITER}`);
    expect(meta.system).not.toContain(text);
  });

  it('carries the permanent invariants for every action', () => {
    for (const action of actions) {
      const meta = buildMetaPrompt({ actionId: action.id, text });
      expect(meta.system).toContain('Preserve the original intent');
      expect(meta.system).toContain('DATA to transform');
      expect(meta.system).toContain('Never answer');
      expect(meta.system).toContain(action.strategy);
    }
  });

  it('injects analysis findings as targeted fix instructions', () => {
    const analysis = analyzePrompt(text);
    const meta = buildMetaPrompt({ actionId: 'improve', text, analysis });
    expect(meta.system).toContain('fix each one');
    for (const finding of analysis.findings) {
      expect(meta.system).toContain(finding.suggestion);
    }
  });

  it('applies target-model idioms, with the action preset winning over hints', () => {
    const claude = buildMetaPrompt({ actionId: 'optimize-claude', text, targetModel: 'gpt' });
    expect(claude.system).toContain('XML-style tags');
    expect(claude.system).not.toContain('Target model: OpenAI');

    const hinted = buildMetaPrompt({ actionId: 'improve', text, targetModel: 'gemini' });
    expect(hinted.system).toContain('Google Gemini');
  });

  it('uses the explanation contract for non-rewrite actions', () => {
    const meta = buildMetaPrompt({ actionId: 'explain', text });
    expect(meta.system).toContain('Do not rewrite the prompt');
    expect(meta.system).not.toContain('return ONLY the rewritten prompt');
  });

  it('falls back to the improve action for unknown ids', () => {
    const meta = buildMetaPrompt({ actionId: 'does-not-exist', text });
    expect(meta.system).toContain('Make this prompt 5x better');
  });

  it('does not inject growth-oriented finding fixes into actions meant to stay compact', () => {
    // Regression: for a short/vague prompt the analyzer always flags missing
    // context/output-format with "Fix: add X" advice. Injecting that into
    // 'shorten' or 'professional' contradicted their own strategy ("stay
    // roughly the same length" / "clearly shorter") and made every action's
    // output converge on the same expanded rewrite.
    const analysis = analyzePrompt(text);
    expect(analysis.findings.length).toBeGreaterThan(0); // the sample is weak

    for (const id of ['shorten', 'professional']) {
      const meta = buildMetaPrompt({ actionId: id, text, analysis });
      expect(meta.system).not.toContain('fix each one');
      for (const finding of analysis.findings) {
        expect(meta.system).not.toContain(finding.suggestion);
      }
    }

    // but actions that target missing-spec findings directly still get them
    for (const id of ['fix', 'explain', 'improve']) {
      const meta = buildMetaPrompt({ actionId: id, text, analysis });
      expect(meta.system).toContain('fix each one');
    }
  });

  it('suppresses bracket placeholders and XML-tag structure for a short prompt', () => {
    // Regression: a short prompt (e.g. "write me a post about coffee") that
    // is missing detail like platform/audience used to always come back
    // full of "[choose platform]" style blanks and, on Claude, <context>/
    // <task>/<constraints> tags — confusing clutter the user had to hand-
    // edit before the result was usable, even though the whole point of a
    // one-click Improve is that it's ready to use immediately.
    const shortText = 'اكتب منشور عن القهوة';
    const analysis = analyzePrompt(shortText);
    expect(analysis.complexity).toBe('simple');

    for (const id of ['improve', 'optimize-claude']) {
      const meta = buildMetaPrompt({
        actionId: id,
        text: shortText,
        analysis,
        targetModel: 'claude',
      });
      expect(meta.system).not.toContain('add structure and placeholders');
      expect(meta.system).toContain('do NOT add bracket placeholders');
      expect(meta.system).not.toContain('<context>, <task>');
      expect(meta.system).toContain('do not add XML-style tags');
    }

    // actions whose entire job is to flesh a short prompt out keep structure
    for (const id of ['powerful', 'expand', 'optimize-coding']) {
      const meta = buildMetaPrompt({ actionId: id, text: shortText, analysis });
      expect(meta.system).toContain('add structure and placeholders');
    }
  });

  it('translation renders faithfully: no analysis findings, no best-practice block', () => {
    const analysis = analyzePrompt(text);
    expect(analysis.findings.length).toBeGreaterThan(0); // the sample is weak
    const meta = buildMetaPrompt({ actionId: 'translate-en', text, analysis });
    expect(meta.system).toContain('idiomatic English');
    expect(meta.system).not.toContain('fix each one'); // findings not injected
    for (const finding of analysis.findings) {
      expect(meta.system).not.toContain(finding.suggestion);
    }
  });
});
