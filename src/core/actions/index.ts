import { type TargetModel } from '../types';

/**
 * Actions are data, not code (FR-B): each entry declares its UI placement and
 * which rewrite strategy fragment drives the meta-prompt. Adding an action is
 * a registry entry + a strategy string — no engine changes.
 */

export type ActionGroup = 'primary' | 'refine' | 'domain' | 'model';

export interface ActionDefinition {
  id: string;
  label: string;
  group: ActionGroup;
  /** false = analysis/explanation output, not a rewritten prompt */
  producesRewrite: boolean;
  /** one-line task description composed into the meta-prompt */
  strategy: string;
  /** pre-set target model for "Optimize for <model>" actions */
  targetModel?: TargetModel;
}

const improveAction: ActionDefinition = {
  id: 'improve',
  label: 'Improve',
  group: 'primary',
  producesRewrite: true,
  strategy:
    'Rewrite the prompt to be clearer, more specific, better structured, and more effective, applying prompt-engineering best practices.',
};

export const actions: ActionDefinition[] = [
  improveAction,
  {
    id: 'powerful',
    label: 'Make more powerful',
    group: 'primary',
    producesRewrite: true,
    strategy:
      'Substantially strengthen the prompt: assign an expert role, tighten the objective, add explicit quality criteria and output expectations, and structure it for maximum response quality.',
  },
  {
    id: 'fix',
    label: 'Fix issues',
    group: 'primary',
    producesRewrite: true,
    strategy:
      'Fix only the identified weaknesses (ambiguity, contradictions, missing specifications) with minimal other changes to wording and length.',
  },
  {
    id: 'explain',
    label: 'Explain weaknesses',
    group: 'primary',
    producesRewrite: false,
    strategy:
      'Explain the weaknesses of the prompt and how each one degrades AI responses. Do not rewrite it.',
  },
  {
    id: 'professional',
    label: 'Rewrite professionally',
    group: 'refine',
    producesRewrite: true,
    strategy:
      'Rewrite the prompt in precise professional language while keeping every requirement intact.',
  },
  {
    id: 'expand',
    label: 'Expand',
    group: 'refine',
    producesRewrite: true,
    strategy:
      'Expand the prompt with the structure a strong prompt should state — context, requirements, constraints, output expectations — without inventing new requirements.',
  },
  {
    id: 'shorten',
    label: 'Shorten',
    group: 'refine',
    producesRewrite: true,
    strategy: 'Rewrite the prompt as concisely as possible without losing any requirement.',
  },
  {
    id: 'alternative',
    label: 'Better alternative',
    group: 'refine',
    producesRewrite: true,
    strategy:
      'Propose a substantially different, better-engineered formulation that achieves the same goal — restructure freely (role, steps, examples, output contract) while preserving the objective.',
  },
  {
    id: 'optimize-coding',
    label: 'Optimize for coding',
    group: 'domain',
    producesRewrite: true,
    strategy:
      'Optimize the prompt for a software-engineering task: make the language, environment, inputs/outputs, edge cases and testing expectations explicit, and ask for code with brief reasoning.',
  },
  {
    id: 'optimize-writing',
    label: 'Optimize for writing',
    group: 'domain',
    producesRewrite: true,
    strategy:
      'Optimize the prompt for a writing task: specify audience, tone, length, structure and style constraints explicitly.',
  },
  {
    id: 'optimize-research',
    label: 'Optimize for research',
    group: 'domain',
    producesRewrite: true,
    strategy:
      'Optimize the prompt for research/analysis: require sourced claims, balanced perspectives, explicit methodology and a structured summary of findings.',
  },
  {
    id: 'optimize-business',
    label: 'Optimize for business',
    group: 'domain',
    producesRewrite: true,
    strategy:
      'Optimize the prompt for a business context: clarify objective, audience, success criteria and deliverable format expected by stakeholders.',
  },
  {
    id: 'optimize-education',
    label: 'Optimize for education',
    group: 'domain',
    producesRewrite: true,
    strategy:
      'Optimize the prompt for teaching/learning: state the learner level, ask for step-by-step explanations, examples, and checks for understanding.',
  },
  {
    id: 'optimize-gpt',
    label: 'Optimize for ChatGPT',
    group: 'model',
    producesRewrite: true,
    targetModel: 'gpt',
    strategy: 'Rewrite the prompt optimized for OpenAI GPT models, applying their best practices.',
  },
  {
    id: 'optimize-claude',
    label: 'Optimize for Claude',
    group: 'model',
    producesRewrite: true,
    targetModel: 'claude',
    strategy: 'Rewrite the prompt optimized for Anthropic Claude, applying its best practices.',
  },
  {
    id: 'optimize-gemini',
    label: 'Optimize for Gemini',
    group: 'model',
    producesRewrite: true,
    targetModel: 'gemini',
    strategy: 'Rewrite the prompt optimized for Google Gemini, applying its best practices.',
  },
];

export const actionById = new Map(actions.map((action) => [action.id, action]));

export function getAction(id: string): ActionDefinition {
  return actionById.get(id) ?? improveAction;
}
