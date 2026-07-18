/**
 * Pre-tokenized view of a prompt shared by all analyzer rules, so each rule
 * stays a cheap pure function over precomputed features (SDD §5.3).
 */

export interface TextModel {
  raw: string;
  words: string[];
  wordCount: number;
  sentences: string[];
  lines: string[];
  /** lowercase for keyword checks */
  lower: string;
  hasQuestion: boolean;
  hasCodeFence: boolean;
  hasList: boolean;
  hasRole: boolean;
  hasOutputFormat: boolean;
  hasExamples: boolean;
  hasConstraints: boolean;
  imperativeVerbs: string[];
}

const ROLE_PATTERNS = [
  /\bact as\b/,
  /\byou are an?\b/,
  /\bas an? (expert|senior|professional)\b/,
  /\brole\s*:/,
];

const OUTPUT_FORMAT_PATTERNS = [
  /\bjson\b/,
  /\bmarkdown\b/,
  /\btable\b/,
  /\bbullet(ed)?\s*(points?|list)?\b/,
  /\bnumbered list\b/,
  /\bformat\s*:/,
  /\boutput\s*(format|as|in)\b/,
  /\brespond (in|with|using)\b/,
  /\breturn (a|an|only|the)\b/,
  /\bcsv\b/,
  /\byaml\b/,
];

const EXAMPLE_PATTERNS = [
  /\bfor example\b/,
  /\be\.g\./,
  /\bexample\s*:/,
  /\bsuch as\b/,
  /\blike this\b/,
];

const CONSTRAINT_PATTERNS = [
  /\bmust\b/,
  /\bshould\b/,
  /\bdo not\b/,
  /\bdon't\b/,
  /\bavoid\b/,
  /\bno more than\b/,
  /\bat (least|most)\b/,
  /\bwithin\b/,
  /\bmax(imum)?\b/,
  /\bmin(imum)?\b/,
  /\bonly\b/,
  /\bexactly\b/,
  /\b\d+\s*(words?|sentences?|paragraphs?|items?|lines?|characters?)\b/,
];

/** Verbs that typically open a task instruction. */
const TASK_VERBS = [
  'write',
  'create',
  'generate',
  'make',
  'build',
  'explain',
  'summarize',
  'summarise',
  'analyze',
  'analyse',
  'translate',
  'rewrite',
  'refactor',
  'fix',
  'debug',
  'implement',
  'design',
  'draft',
  'compose',
  'list',
  'compare',
  'review',
  'describe',
  'develop',
  'optimize',
  'optimise',
  'improve',
  'convert',
  'extract',
  'classify',
  'plan',
  'outline',
  'brainstorm',
  'research',
  'find',
  'calculate',
  'solve',
  'teach',
  'help',
];

export function buildTextModel(raw: string): TextModel {
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();
  const words = trimmed.split(/\s+/).filter((w) => w !== '');
  const lines = trimmed.split(/\n/).map((l) => l.trim());
  const sentences = trimmed
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s !== '');

  const imperativeVerbs = [];
  for (const sentence of sentences) {
    // check the first two tokens so labeled forms ("Task: write …") count
    const tokens = sentence
      .toLowerCase()
      .split(/\s+/, 2)
      .map((t) => t.replace(/[^a-z']/g, ''));
    const verb = tokens.find((t) => TASK_VERBS.includes(t));
    if (verb !== undefined) {
      imperativeVerbs.push(verb);
    }
  }
  // also catch polite/indirect phrasings anywhere in the text
  for (const match of lower.matchAll(
    /\b(?:please|can you|could you|i want you to|i need you to|help me)\s+([a-z]+)/g,
  )) {
    const verb = match[1] ?? '';
    if (TASK_VERBS.includes(verb)) {
      imperativeVerbs.push(verb);
    }
  }

  return {
    raw: trimmed,
    words,
    wordCount: words.length,
    sentences,
    lines,
    lower,
    hasQuestion: trimmed.includes('?'),
    hasCodeFence: trimmed.includes('```'),
    hasList: lines.some((l) => /^([-*•]|\d+[.)])\s/.test(l)),
    hasRole: ROLE_PATTERNS.some((p) => p.test(lower)),
    hasOutputFormat: OUTPUT_FORMAT_PATTERNS.some((p) => p.test(lower)),
    hasExamples: EXAMPLE_PATTERNS.some((p) => p.test(lower)),
    hasConstraints: CONSTRAINT_PATTERNS.some((p) => p.test(lower)),
    imperativeVerbs,
  };
}
