// `import type`, not `import { type … }`: the inline form keeps a runtime
// side-effect import of core/types (zod) that would bloat the content entry.
import type { TargetModel } from '@/core/types';

/**
 * Per-platform profiles (SDD §5.2, FR-E2). The generic capture/insertion
 * strategies already speak the editor frameworks' event protocols, so a
 * profile only declares what is genuinely site-specific:
 *  - which AI model the site hosts ("Optimize for Model" auto-hint)
 *  - where the main composer lives (keyboard shortcut with no selection)
 * Adding a platform = one entry here. If a site ever needs a bespoke
 * insertion path, add an `insertOverride` to its profile — the apply flow
 * consults it before the generic ladder.
 */

export interface SiteProfile {
  id: string;
  /** matched against location.host */
  hosts: RegExp;
  targetModel?: TargetModel;
  /** CSS selector for the main prompt composer */
  composerSelector?: string;
}

export const siteProfiles: SiteProfile[] = [
  {
    id: 'chatgpt',
    hosts: /(^|\.)chatgpt\.com$|(^|\.)chat\.openai\.com$/,
    targetModel: 'gpt',
    composerSelector: '#prompt-textarea',
  },
  {
    id: 'claude',
    hosts: /(^|\.)claude\.ai$/,
    targetModel: 'claude',
    composerSelector: 'div[contenteditable="true"].ProseMirror',
  },
  {
    id: 'gemini',
    hosts: /(^|\.)gemini\.google\.com$/,
    targetModel: 'gemini',
    composerSelector: 'div.ql-editor[contenteditable="true"]',
  },
  {
    id: 'copilot',
    hosts: /(^|\.)copilot\.microsoft\.com$/,
    targetModel: 'gpt',
    composerSelector: 'textarea#userInput, textarea',
  },
  {
    id: 'perplexity',
    hosts: /(^|\.)perplexity\.ai$/,
    composerSelector: 'textarea',
  },
  {
    id: 'deepseek',
    hosts: /(^|\.)chat\.deepseek\.com$/,
    composerSelector: 'textarea#chat-input, textarea',
  },
  {
    id: 'poe',
    hosts: /(^|\.)poe\.com$/,
    composerSelector: 'textarea[class*="GrowingTextArea"], textarea',
  },
  {
    id: 'huggingchat',
    hosts: /(^|\.)huggingface\.co$/,
    composerSelector: 'textarea',
  },
  {
    id: 'grok',
    hosts: /(^|\.)grok\.com$/,
    composerSelector: 'textarea',
  },
  {
    id: 'mistral',
    hosts: /(^|\.)chat\.mistral\.ai$/,
    composerSelector: 'textarea',
  },
];

export function findSiteProfile(host: string): SiteProfile | undefined {
  return siteProfiles.find((profile) => profile.hosts.test(host));
}
