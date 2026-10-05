// Rule-based assessment of a candidate's interview answers.
// Computes an overall score, a recommendation, per-category breakdown,
// and system-generated growth (development) areas. No external AI calls —
// the heuristics reward answer substance and completeness per skill category.

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

// Rough substance heuristic based on answer length.
function strength(text: string | null): number {
  const t = (text ?? '').trim();
  if (t.length === 0) return 0;
  if (t.length < 40) return 0.3;
  if (t.length < 150) return 0.7;
  return 1.0;
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
    const s = strength(qa.response);
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
