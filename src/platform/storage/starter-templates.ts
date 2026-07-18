import type { Template } from './templates';

/** Read-only starter library seeded on first install (FR-F2). */
export const starterTemplates: Template[] = [
  {
    id: 'starter-expert-task',
    name: 'Expert task briefing',
    content:
      'You are a senior {{role}}. Task: {{task}}.\n\nContext: {{context}}\n\nConstraints:\n- {{constraint}}\n\nOutput format: {{format}}',
    favorite: false,
    createdAt: 0,
    userOwned: false,
  },
  {
    id: 'starter-code-review',
    name: 'Code review request',
    content:
      'Act as a senior {{language}} engineer. Review the following code for correctness, readability, and performance. For each issue: severity, why it matters, and a concrete fix. End with the top 3 improvements.\n\n```\n{{code}}\n```',
    favorite: false,
    createdAt: 0,
    userOwned: false,
  },
  {
    id: 'starter-summarize',
    name: 'Structured summary',
    content:
      'Summarize the following for {{audience}}. Output: a one-sentence TL;DR, 3-5 key points as bullets, and one recommended next step. Max {{word_limit}} words total.\n\n{{text}}',
    favorite: false,
    createdAt: 0,
    userOwned: false,
  },
  {
    id: 'starter-step-by-step',
    name: 'Teach me step by step',
    content:
      'Teach me {{topic}} assuming I am a {{level}}. Work step by step: explain one concept at a time with a concrete example, then check my understanding with one short question before moving on.',
    favorite: false,
    createdAt: 0,
    userOwned: false,
  },
  {
    id: 'starter-decision',
    name: 'Decision analysis',
    content:
      'Help me decide: {{decision}}.\n\nOptions considered: {{options}}\n\nAnalyze each option against these criteria: {{criteria}}. Present a comparison table, state your recommendation, and list the main risks of that recommendation.',
    favorite: false,
    createdAt: 0,
    userOwned: false,
  },
];

/** Extracts unique `{{variable}}` names in order of first appearance. */
export function templateVariables(content: string): string[] {
  const names: string[] = [];
  for (const match of content.matchAll(/\{\{\s*([\w-]+)\s*\}\}/g)) {
    const name = match[1] ?? '';
    if (name !== '' && !names.includes(name)) {
      names.push(name);
    }
  }
  return names;
}

export function fillTemplate(content: string, values: Record<string, string>): string {
  return content.replace(/\{\{\s*([\w-]+)\s*\}\}/g, (whole, name: string) => values[name] ?? whole);
}
