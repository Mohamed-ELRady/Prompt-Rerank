import { type PromptAnalysis, type TaskType } from '../types';
import { analyzerRules } from './analyzers';
import { computeScore } from './scoring';
import { buildTextModel, type TextModel } from './text-model';

/** Keyword profiles for task-type detection; first profile to score ≥2 wins. */
const TASK_PROFILES: [TaskType, RegExp[]][] = [
  [
    'coding',
    [
      /\b(code|function|bug|refactor|api|typescript|python|javascript|sql|regex|compile|debug|implement|class|script)\b/,
      /```/,
      /\b(error|exception|stack trace)\b/,
    ],
  ],
  [
    'research',
    [
      /\b(research|sources|citations?|literature|study|studies|evidence|compare .* approaches|analy[sz]e)\b/,
      /\b(pros and cons|trade-?offs)\b/,
    ],
  ],
  [
    'business',
    [
      /\b(business|marketing|sales|strategy|customers?|revenue|pitch|okrs?|kpis?|stakeholders?|meeting|email to)\b/,
    ],
  ],
  [
    'education',
    [/\b(explain|teach|lesson|student|beginner|eli5|step[- ]by[- ]step|tutorial|quiz|learn)\b/],
  ],
  ['creative', [/\b(story|poem|song|fiction|character|plot|creative|imagine|novel)\b/]],
  [
    'writing',
    [
      /\b(write|draft|essay|article|blog|rewrite|edit|proofread|summar[iy][sz]e|paragraph|letter)\b/,
    ],
  ],
];

function detectTaskType(model: TextModel): TaskType {
  // Profiles are ordered by specificity; first hit wins ("explain this code"
  // should read as coding, not education, so coding is checked first).
  for (const [taskType, patterns] of TASK_PROFILES) {
    if (patterns.some((p) => p.test(model.lower))) {
      return taskType;
    }
  }
  return 'general';
}

function detectComplexity(model: TextModel): PromptAnalysis['complexity'] {
  if (model.wordCount < 20) {
    return 'simple';
  }
  if (model.wordCount < 80 && new Set(model.imperativeVerbs).size <= 2) {
    return 'moderate';
  }
  return 'complex';
}

/** Deterministic local analysis — no LLM involved (assumption A6). */
export function analyzePrompt(text: string): PromptAnalysis {
  const model = buildTextModel(text);
  const findings = analyzerRules.flatMap((rule) => rule.detect(model));
  return {
    taskType: detectTaskType(model),
    complexity: detectComplexity(model),
    wordCount: model.wordCount,
    score: computeScore(findings),
    findings,
  };
}
