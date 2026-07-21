import { getAction } from '../actions';
import { type PromptAnalysis, type TargetModel } from '../types';
import {
  baseContract,
  bestPractices,
  explainOutputContract,
  findingFixes,
  modelIdioms,
  rewriteOutputContract,
  taskTypeHint,
  wrapUserText,
} from './fragments';

export interface MetaPromptInput {
  actionId: string;
  text: string;
  analysis?: PromptAnalysis;
  /** explicit user choice or a site hint; the action's own setting wins */
  targetModel?: TargetModel;
}

export interface MetaPrompt {
  system: string;
  user: string;
}

/**
 * Composes the system prompt from independent fragments (SDD §5.3):
 * base contract → action strategy → analysis-driven fixes → task-type and
 * target-model idioms → output contract.
 */
export function buildMetaPrompt(input: MetaPromptInput): MetaPrompt {
  const action = getAction(input.actionId);
  const targetModel = action.targetModel ?? input.targetModel ?? 'generic';

  // Generic best-practices only where they help. Focused actions (shorten,
  // fix, professional, expand) opt out so the block doesn't drown out — or
  // contradict — their specific goal and make every action look the same.
  const useBestPractices = action.producesRewrite && action.applyBestPractices !== false;
  // Analysis findings turn a rewrite into an "improved" version; translation
  // opts out so it stays a faithful render of the original.
  const analysis = action.usesAnalysis === false ? undefined : input.analysis;
  // The "Fix: add X / specify Y" findings are always framed as ADDING
  // content, so — like best-practices — they default to off wherever
  // best-practices is off, unless an action explicitly opts back in (e.g.
  // 'fix', where missing-spec findings ARE the task; 'expand', where they
  // reinforce it). Without this, e.g. 'shorten' and 'professional' still
  // got told to "add background/output format", which for a typically
  // short input was the single most concrete instruction in the whole
  // prompt and made every action converge on the same expanded rewrite.
  const useFindingFixes = action.applyFindingFixes ?? useBestPractices;

  const sections: string[][] = [
    baseContract(),
    [
      `Your task — this is the SPECIFIC transformation the user picked, and the result MUST clearly reflect it (not a generic "improved" version): ${action.strategy}`,
    ],
    useBestPractices ? bestPractices() : [],
    analysis && useFindingFixes ? findingFixes(analysis.findings) : [],
    analysis ? taskTypeHint(analysis.taskType) : [],
    modelIdioms(targetModel),
    action.producesRewrite ? rewriteOutputContract() : explainOutputContract(),
  ];

  return {
    system: sections
      .filter((section) => section.length > 0)
      .map((section) => section.join('\n'))
      .join('\n\n'),
    user: wrapUserText(input.text),
  };
}
