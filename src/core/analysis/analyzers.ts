import { type Finding } from '../types';
import { type TextModel } from './text-model';

/**
 * Analyzer rules (FR-C1). Each rule is a pure function over the text model
 * returning zero or more typed findings. Adding a finding type = adding a
 * rule object here; nothing else changes (open/closed).
 */

export interface AnalyzerRule {
  id: string;
  detect(model: TextModel): Finding[];
}

const VAGUE_TERMS = [
  'some',
  'a few',
  'several',
  'various',
  'stuff',
  'things',
  'better',
  'good',
  'nice',
  'improve it',
  'make it better',
  'etc',
  'and so on',
  'somehow',
  'kind of',
  'sort of',
];

const CONFLICT_PAIRS: [RegExp, RegExp, string][] = [
  [
    /\b(short|brief|concise)\b/,
    /\b(detailed|comprehensive|in.?depth|thorough)\b/,
    'short vs. detailed',
  ],
  [/\bformal\b/, /\b(casual|informal|conversational)\b/, 'formal vs. casual'],
  [/\bsimple\b/, /\b(advanced|technical|expert)\b/, 'simple vs. technical'],
];

const INJECTION_PATTERNS = [
  /ignore (all |any )?(previous|prior|above) (instructions?|prompts?)/,
  /disregard (the )?(system|previous)/,
  /reveal (your|the) (system )?prompt/,
];

export const analyzerRules: AnalyzerRule[] = [
  {
    id: 'unclear_objective',
    detect: (m) =>
      m.imperativeVerbs.length === 0 && !m.hasQuestion
        ? [
            {
              id: 'unclear_objective',
              dimension: 'clarity',
              severity: 'major',
              message: 'No clear task or question is stated.',
              suggestion:
                'State the task explicitly, e.g. start with a verb: "Summarize…", "Write…".',
            },
          ]
        : [],
  },
  {
    id: 'missing_context',
    detect: (m) =>
      m.wordCount < 8
        ? [
            {
              id: 'missing_context',
              dimension: 'context',
              severity: 'major',
              message: 'The prompt is very short and gives the model almost nothing to work with.',
              suggestion:
                'Add background: who this is for, what you already have, and what outcome you need.',
            },
          ]
        : [],
  },
  {
    id: 'no_role',
    detect: (m) =>
      !m.hasRole && m.wordCount >= 15
        ? [
            {
              id: 'no_role',
              dimension: 'structure',
              severity: 'minor',
              message: 'No role or persona is assigned to the model.',
              suggestion:
                'Open with a role, e.g. "You are a senior data engineer…" to anchor tone and expertise.',
            },
          ]
        : [],
  },
  {
    id: 'missing_output_format',
    detect: (m) =>
      !m.hasOutputFormat
        ? [
            {
              id: 'missing_output_format',
              dimension: 'outputSpec',
              severity: m.wordCount >= 15 ? 'major' : 'minor',
              message: 'The expected output format is unspecified.',
              suggestion:
                'Say what the answer should look like: length, structure (list/table/JSON), tone.',
            },
          ]
        : [],
  },
  {
    id: 'no_constraints',
    detect: (m) =>
      !m.hasConstraints && m.wordCount >= 12
        ? [
            {
              id: 'no_constraints',
              dimension: 'constraints',
              severity: 'minor',
              message: 'No constraints bound the answer (length, scope, style, exclusions).',
              suggestion:
                'Add limits such as "no more than 300 words" or "only use the provided data".',
            },
          ]
        : [],
  },
  {
    id: 'no_examples',
    detect: (m) =>
      !m.hasExamples && m.wordCount >= 40
        ? [
            {
              id: 'no_examples',
              dimension: 'context',
              severity: 'info',
              message: 'A prompt of this complexity usually benefits from an example.',
              suggestion:
                'Show one input/output example of what a good answer looks like (few-shot).',
            },
          ]
        : [],
  },
  {
    id: 'vague_quantifier',
    detect: (m) => {
      const hits = VAGUE_TERMS.filter((t) => m.lower.includes(t));
      return hits.length > 0
        ? [
            {
              id: 'vague_quantifier',
              dimension: 'specificity',
              severity: hits.length > 2 ? 'major' : 'minor',
              message: `Vague wording weakens the request: ${hits.slice(0, 4).join(', ')}.`,
              suggestion: 'Replace vague terms with concrete numbers, names, or criteria.',
            },
          ]
        : [];
    },
  },
  {
    id: 'ambiguous_reference',
    detect: (m) => {
      const pronounStarts = m.sentences.filter((s) =>
        /^(it|this|that|they|these|those)\b/i.test(s),
      );
      return pronounStarts.length > 0 && m.sentences.length > 1
        ? [
            {
              id: 'ambiguous_reference',
              dimension: 'clarity',
              severity: 'minor',
              message:
                'Sentences start with pronouns ("it", "this") whose referent may be unclear to the model.',
              suggestion: 'Name the thing explicitly instead of using "it"/"this".',
            },
          ]
        : [];
    },
  },
  {
    id: 'wall_of_text',
    detect: (m) =>
      m.wordCount >= 80 && !m.hasList && m.lines.length <= 2
        ? [
            {
              id: 'wall_of_text',
              dimension: 'structure',
              severity: 'minor',
              message: 'Long unstructured text is harder for models to parse reliably.',
              suggestion:
                'Break the prompt into labeled sections or a bulleted list of requirements.',
            },
          ]
        : [],
  },
  {
    id: 'mixed_tasks',
    detect: (m) => {
      const distinct = new Set(m.imperativeVerbs);
      return distinct.size >= 3
        ? [
            {
              id: 'mixed_tasks',
              dimension: 'structure',
              severity: 'minor',
              message: `Several distinct tasks are bundled together (${[...distinct].slice(0, 4).join(', ')}).`,
              suggestion:
                'Number the sub-tasks, or split them into separate prompts for better results.',
            },
          ]
        : [];
    },
  },
  {
    id: 'conflicting_instructions',
    detect: (m) => {
      const conflicts = CONFLICT_PAIRS.filter(([a, b]) => a.test(m.lower) && b.test(m.lower));
      return conflicts.map(([, , label]) => ({
        id: 'conflicting_instructions',
        dimension: 'clarity',
        severity: 'major' as const,
        message: `The prompt asks for contradictory qualities (${label}).`,
        suggestion: 'Pick one, or state which applies to which part of the answer.',
      }));
    },
  },
  {
    id: 'injection_suspect',
    detect: (m) =>
      INJECTION_PATTERNS.some((p) => p.test(m.lower))
        ? [
            {
              id: 'injection_suspect',
              dimension: 'clarity',
              severity: 'info',
              message:
                'The text contains instruction-override phrasing, which the rewriter will treat as data.',
              suggestion: 'If this is intentional prompt content, keep it; otherwise remove it.',
            },
          ]
        : [],
  },
];
