// Rule-based assessment of a candidate's interview answers.
// Computes an overall score, a recommendation, per-category breakdown,
// and system-generated growth (development) areas. Scoring is based on the
// answer CONTENT via rudimentary keyword/pattern signals (specificity,
// examples, technical vocabulary, reasoning) — no external AI calls.

export type QA = { position: number; response: string | null };

export type CategoryKey =
  | 'behavioral'
  | 'backend'
  | 'frontend'
  | 'data'
  | 'security'
  | 'architecture';

export type CategoryScore = {
  key: CategoryKey;
  label: string;
  score: number; // 0–10
  answered: number;
  total: number;
};

export type Assessment = {
  score: number; // 0–10 overall
  answered: number;
  total: number;
  completionPct: number;
  recommendation: string;
  recommendationTone: 'strong' | 'hire' | 'maybe' | 'no';
  categories: CategoryScore[];
  growthAreas: string[];
};

const CATEGORIES: { key: CategoryKey; label: string; from: number; to: number }[] = [
  { key: 'behavioral', label: 'Behavioral & Communication', from: 1, to: 50 },
  { key: 'backend', label: 'Backend & Databases', from: 51, to: 66 },
  { key: 'frontend', label: 'Frontend & UI', from: 67, to: 81 },
  { key: 'data', label: 'Data & Analytics', from: 82, to: 94 },
  { key: 'security', label: 'Security', from: 95, to: 106 },
  { key: 'architecture', label: 'Architecture & System Design', from: 107, to: 120 },
];

const GROWTH_SUGGESTIONS: Record<CategoryKey, string> = {
  behavioral:
    'Behavioral & communication — practice structuring answers with concrete examples (STAR method).',
  backend:
    'Backend & databases — strengthen core language, SQL, and debugging fundamentals.',
  frontend:
    'Frontend & UI — deepen React, CSS layout, and accessibility knowledge.',
  data:
    'Data & analytics — practice SQL, data modeling, and ETL/dashboard concepts.',
  security:
    'Security — study the OWASP Top 10, authentication, and secure coding practices.',
  architecture:
    'Architecture & system design — practice designing APIs, transactions, and scalable systems.',
};

function categoryFor(position: number): CategoryKey {
  const c = CATEGORIES.find((c) => position >= c.from && position <= c.to);
  return (c?.key ?? 'behavioral') as CategoryKey;
}

// Rudimentary content analysis: scores what's actually IN the answer
// (specificity, concrete examples, technical vocabulary, reasoning, structure)
// rather than just its length. Intentionally simple keyword/pattern signals —
// no external AI calls.

// Answers that carry no real content.
const NON_ANSWER =
  /^\s*(i don'?t know|idk|not sure|no idea|dunno|n\/?a|na|skip|pass|no comment|nothing|none|no|yes|ok|okay|\.+|-+|\?+)[.!?\s]*$/i;

// Signals that an answer is grounded in real, specific experience.
const EXAMPLE_MARKERS =
  /(for example|for instance|such as|e\.g\.|when i|in my (last|previous|current)|at my (last|previous)|one time|a time (when|i)|i (built|led|designed|implemented|created|worked on|was responsible for))/i;

// Quantified / measurable detail.
const METRIC =
  /(\d+\s*%|\$\s?\d+|\b\d+(\.\d+)?\s*(years?|yrs?|months?|weeks?|days?|hours?|users?|customers?|clients?|projects?|people|engineers?|developers?|team members|members|requests?|transactions?|records?|rows?|tables?|servers?|services?|endpoints?|queries|million|thousand|k\b))/i;

// Domain vocabulary.
const TECH_TERMS =
  /(api|rest|graphql|sql|nosql|database|query|index|react|component|state|hook|javascript|typescript|java|python|php|spring|django|node(?:\.js)?|express|server|endpoint|function|algorithm|framework|library|unit test|integration test|testing|deploy|ci\/cd|docker|kubernetes|cache|caching|redis|security|authentication|authorization|encryption|owasp|xss|csrf|injection|pipeline|etl|model|schema|normali[sz]ation|transaction|acid|scalab|performance|optimi[sz]|debug|profil|monitor|logging|microservice|architecture|design pattern|git|agile|scrum)/i;

// Reasoning / structured thinking.
const REASONING =
  /(because|therefore|so that|in order to|as a result|which (meant|led|resulted|caused|allowed)|this (meant|led|resulted|allowed|helped)|consequently|trade-?off|pros and cons|the reason|my approach|i decided|we decided)/i;

function answerQuality(text: string | null): number {
  const t = (text ?? '').trim();
  if (!t) return 0;
  if (NON_ANSWER.test(t)) return 0;

  const len = t.length;
  let score: number;

  // Base substance from length.
  if (len < 15) return 0.1; // answered, but too thin to credit further
  else if (len < 50) score = 0.2;
  else if (len < 120) score = 0.35;
  else if (len < 250) score = 0.45;
  else score = 0.5;

  // Content-quality signals (rudimentary).
  if (EXAMPLE_MARKERS.test(t)) score += 0.15;
  if (METRIC.test(t)) score += 0.15;
  if (TECH_TERMS.test(t)) score += 0.1;
  if (REASONING.test(t)) score += 0.1;

  // Multi-sentence structure.
  const sentences = t.split(/[.!?]+/).filter((s) => s.trim().length > 5).length;
  if (sentences >= 2) score += 0.05;

  return Math.min(1, score);
}

function recommendationFor(score: number): {
  recommendation: string;
  recommendationTone: Assessment['recommendationTone'];
} {
  if (score >= 8) return { recommendation: 'Strong Hire', recommendationTone: 'strong' };
  if (score >= 6) return { recommendation: 'Hire', recommendationTone: 'hire' };
  if (score >= 4) return { recommendation: 'Maybe', recommendationTone: 'maybe' };
  return { recommendation: 'No Hire', recommendationTone: 'no' };
}

export function assess(qas: QA[]): Assessment {
  const total = qas.length;
  const byCategory = new Map<CategoryKey, { sum: number; answered: number; total: number }>();

  let sumAll = 0;
  let answeredAll = 0;

  for (const qa of qas) {
    const key = categoryFor(qa.position);
    const s = answerQuality(qa.response);
    const answered = (qa.response ?? '').trim().length > 0;

    sumAll += s;
    if (answered) answeredAll += 1;

    const agg = byCategory.get(key) ?? { sum: 0, answered: 0, total: 0 };
    agg.sum += s;
    agg.total += 1;
    if (answered) agg.answered += 1;
    byCategory.set(key, agg);
  }

  const score = total > 0 ? Math.round((sumAll / total) * 10) : 0;
  const completionPct = total > 0 ? Math.round((answeredAll / total) * 100) : 0;

  const categories: CategoryScore[] = CATEGORIES.map(({ key, label }) => {
    const agg = byCategory.get(key) ?? { sum: 0, answered: 0, total: 0 };
    return {
      key,
      label,
      score: agg.total > 0 ? Math.round((agg.sum / agg.total) * 10) : 0,
      answered: agg.answered,
      total: agg.total,
    };
  });

  const { recommendation, recommendationTone } = recommendationFor(score);

  // Growth areas: weakest categories (below a solid bar), phrased as suggestions.
  const sorted = [...categories].sort((a, b) => a.score - b.score);
  const weak = sorted.filter((c) => c.score < 6).slice(0, 3);
  const growthAreas = weak.map((c) => GROWTH_SUGGESTIONS[c.key]);
  if (completionPct < 70) {
    growthAreas.unshift(
      `Interview completeness — only ${completionPct}% of questions were answered; encourage fuller responses.`
    );
  }

  return {
    score,
    answered: answeredAll,
    total,
    completionPct,
    recommendation,
    recommendationTone,
    categories,
    growthAreas,
  };
}
