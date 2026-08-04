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
  /**
   * Whether to append the generic "add role / format / examples / sections"
   * best-practice block. Off for focused actions (shorten, fix, professional)
   * where it would fight the strategy and make every action look the same.
   * Defaults to true for rewrite actions.
   */
  applyBestPractices?: boolean;
  /**
   * Whether analysis findings and the task-type hint are injected into the
   * meta-prompt. Off for translation, where the goal is a faithful render of
   * the original — not an "improved" version. Defaults to true.
   */
  usesAnalysis?: boolean;
  /**
   * Whether the analyzer's "Fix: add X / specify Y" findings are injected.
   * These are always framed as ADDING content (context, format, examples),
   * so they actively contradict actions whose whole point is to NOT grow the
   * prompt (shorten, professional) — for a typically short/vague input this
   * block was the single most concrete instruction in the whole system
   * prompt and drowned out the action's own strategy, making every action
   * converge on the same expanded rewrite. Off by default when
   * applyBestPractices is false; set explicitly to override (e.g. 'fix'
   * wants both false-for-best-practices and true-for-finding-fixes, since
   * "missing specifications" is literally what it targets).
   */
  applyFindingFixes?: boolean;
  /**
   * Whether to use XML-tag / labeled-section structure and [bracket]
   * placeholders for missing detail, regardless of how short the input is.
   * By default this is decided from the analyzed complexity (short prompts
   * get a plain-sentence rewrite instead of a template full of blanks the
   * user has to hand-fill) — set true for actions whose whole purpose is to
   * flesh a short prompt out (expand, powerful, domain optimizers), where
   * suppressing structure would defeat the action.
   */
  forceStructure?: boolean;
  /** overrides the default sampling temperature for this action */
  temperature?: number;
}

const improveAction: ActionDefinition = {
  id: 'improve',
  label: 'Improve',
  group: 'primary',
  producesRewrite: true,
  // One directive, deliberately blunt: light polishing was the most common
  // complaint about this action, and a target multiplier gives the model a
  // clear bar to clear instead of a checklist to skim.
  strategy:
    'Make this prompt 5x better than it currently is. That is the whole instruction — do not merely polish or reword it. Rewrite it into a dramatically stronger prompt that will get a far better answer from an AI, while keeping the user’s original goal exactly intact.',
};

export const actions: ActionDefinition[] = [
  improveAction,
  {
    id: 'powerful',
    label: 'Make more powerful',
    group: 'primary',
    producesRewrite: true,
    forceStructure: true, // "structure it for maximum response quality" IS the point
    strategy:
      'Substantially strengthen the prompt: assign an expert role, tighten the objective, add explicit quality criteria and output expectations, and structure it for maximum response quality.',
  },
  {
    id: 'fix',
    label: 'Fix issues',
    group: 'primary',
    producesRewrite: true,
    applyBestPractices: false,
    applyFindingFixes: true, // "missing specifications" is exactly what fix targets
    strategy:
      'Fix ONLY the identified weaknesses (ambiguity, contradictions, missing specifications). Make the smallest edits possible: keep the original wording, structure, and length as close to the original as you can. Do not add a role, examples, or new sections unless one directly fixes a listed weakness.',
  },
  {
    id: 'explain',
    label: 'Explain weaknesses',
    group: 'primary',
    producesRewrite: false,
    applyFindingFixes: true, // the report is literally about these findings
    strategy:
      'Explain the weaknesses of the prompt and how each one degrades AI responses. Do not rewrite it.',
  },
  {
    id: 'professional',
    label: 'Rewrite professionally',
    group: 'refine',
    producesRewrite: true,
    applyBestPractices: false,
    strategy:
      'Rewrite the prompt in precise, professional, formal language. Keep the SAME requirements, structure, and roughly the same length — only elevate the wording, tone, and clarity. Do not add new sections, examples, or requirements.',
  },
  {
    id: 'expand',
    label: 'Expand',
    group: 'refine',
    producesRewrite: true,
    applyBestPractices: false,
    applyFindingFixes: true, // "add missing X" findings reinforce expand's own goal
    forceStructure: true, // spelling out labeled sections IS the point
    strategy:
      'Expand the prompt so it is clearly LONGER and more detailed than the original: spell out context, requirements, constraints, and output expectations as separate labeled sections. Do not invent new requirements — elaborate on what is implied, using [placeholders] for missing specifics.',
  },
  {
    id: 'shorten',
    label: 'Shorten',
    group: 'refine',
    producesRewrite: true,
    applyBestPractices: false,
    strategy:
      'Rewrite the prompt so it is clearly SHORTER than the original — aim for roughly half the length or less. Strip filler, redundancy, and pleasantries; keep only the essential instruction and any hard requirements. The result must be noticeably more compact.',
  },
  {
    id: 'alternative',
    label: 'Better alternative',
    group: 'refine',
    producesRewrite: true,
    temperature: 0.8,
    strategy:
      'Propose a SUBSTANTIALLY DIFFERENT, better-engineered formulation that achieves the same goal. Do not lightly edit the original — restructure it from scratch (different angle, role, ordering, or framing) while preserving the objective. It should read as a genuinely fresh alternative.',
  },
  {
    id: 'translate-en',
    label: 'Translate to English',
    group: 'refine',
    producesRewrite: true,
    applyBestPractices: false,
    usesAnalysis: false,
    strategy:
      'Translate the prompt into clear, natural, idiomatic English — the way a native English speaker would phrase the very same request. Convey the full meaning and intent faithfully; NEVER translate word-for-word or produce stilted, literal English. Keep it as a prompt (do not answer it), and do not add, remove, or "improve" any requirements. If it is already in English, only refine its phrasing lightly.',
  },
  {
    id: 'optimize-coding',
    label: 'Optimize for coding',
    group: 'domain',
    producesRewrite: true,
    forceStructure: true, // spelling out language/env/edge-cases IS the point
    strategy:
      'Optimize the prompt for a software-engineering task: make the language, environment, inputs/outputs, edge cases and testing expectations explicit, and ask for code with brief reasoning.',
  },
  {
    id: 'optimize-writing',
    label: 'Optimize for writing',
    group: 'domain',
    producesRewrite: true,
    forceStructure: true, // spelling out audience/tone/length IS the point
    strategy:
      'Optimize the prompt for a writing task: specify audience, tone, length, structure and style constraints explicitly.',
  },
  {
    id: 'optimize-research',
    label: 'Optimize for research',
    group: 'domain',
    producesRewrite: true,
    forceStructure: true, // spelling out methodology/sourcing IS the point
    strategy:
      'Optimize the prompt for research/analysis: require sourced claims, balanced perspectives, explicit methodology and a structured summary of findings.',
  },
  {
    id: 'optimize-business',
    label: 'Optimize for business',
    group: 'domain',
    producesRewrite: true,
    forceStructure: true, // spelling out objective/audience/criteria IS the point
    strategy:
      'Optimize the prompt for a business context: clarify objective, audience, success criteria and deliverable format expected by stakeholders.',
  },
  {
    id: 'optimize-education',
    label: 'Optimize for education',
    group: 'domain',
    producesRewrite: true,
    forceStructure: true, // spelling out level/steps/checks IS the point
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
