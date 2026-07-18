import { describe, expect, it } from 'vitest';
import { findSiteProfile, siteProfiles } from './profiles';

describe('site profiles', () => {
  it('has unique ids', () => {
    expect(new Set(siteProfiles.map((p) => p.id)).size).toBe(siteProfiles.length);
  });

  it.each([
    ['chatgpt.com', 'chatgpt', 'gpt'],
    ['chat.openai.com', 'chatgpt', 'gpt'],
    ['claude.ai', 'claude', 'claude'],
    ['gemini.google.com', 'gemini', 'gemini'],
    ['copilot.microsoft.com', 'copilot', 'gpt'],
  ] as const)('%s → %s (model hint: %s)', (host, id, model) => {
    const profile = findSiteProfile(host);
    expect(profile?.id).toBe(id);
    expect(profile?.targetModel).toBe(model);
  });

  it.each([
    ['perplexity.ai', 'perplexity'],
    ['chat.deepseek.com', 'deepseek'],
    ['poe.com', 'poe'],
    ['huggingface.co', 'huggingchat'],
  ] as const)('%s → %s with no model hint', (host, id) => {
    const profile = findSiteProfile(host);
    expect(profile?.id).toBe(id);
    expect(profile?.targetModel).toBeUndefined();
  });

  it('does not match lookalike domains', () => {
    expect(findSiteProfile('notchatgpt.com')).toBeUndefined();
    expect(findSiteProfile('claude.ai.evil.example')).toBeUndefined();
    expect(findSiteProfile('example.com')).toBeUndefined();
  });
});
