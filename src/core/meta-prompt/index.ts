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

  const sections: string[][] = [
    baseContract(),
    [`Your task: ${action.strategy}`],
    action.producesRewrite ? bestPractices() : [],
    input.analysis ? findingFixes(input.analysis.findings) : [],
    input.analysis ? taskTypeHint(input.analysis.taskType) : [],
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
