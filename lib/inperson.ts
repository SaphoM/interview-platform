// Rule-based generator for in-person follow-up questions. Builds exactly six
// questions per candidate from their written-round answers and assessment —
// no external AI calls. Every question cites why it was chosen (focus/rationale).

import {
  categoryForPosition,
  type Assessment,
  type CategoryKey,
} from './assess';

export type InPersonQA = {
  position: number;
  prompt: string;
  response: string | null;
};

export type TailoredQuestion = {
  focus: string;
  question: string;
  rationale: string;
};

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  behavioral: 'Behavioral & Communication',
  backend: 'Backend & Databases',
  frontend: 'Frontend & UI',
  data: 'Data & Analytics',
  security: 'Security',
  architecture: 'Architecture & System Design',
};

const WEAK_PROBES: Record<CategoryKey, string[]> = {
  behavioral: [
    'Tell me about a time you disagreed with a teammate and the disagreement slowed the work down. What did you actually say, and how did you get things moving again?',
    'Walk me through a STAR story from your last role — the situation, the specific action you took, and the measurable result.',
    'Describe a mistake you made at work. How did you own it, and what did you change about how you work afterwards?',
  ],
  backend: [
    'Think out loud as you design the API and database schema for a feature that lets users bookmark a job and get notified when its status changes.',
    'You get a report that one of your endpoints suddenly takes seconds to respond. Walk me through your debugging process, step by step.',
    'Explain how you would migrate a live table to a new schema without downtime. What breaks if you get it wrong?',
  ],
  frontend: [
    'A page you built gets janky once a list grows past a few thousand rows. How do you find the cause, and what is the fix?',
    'Walk me through how you would structure state in a React app where a form, a table, and a sidebar all depend on the same data.',
    'A designer hands you a pixel-perfect mock with no responsive rules. How do you decide on breakpoints and handle edge cases like very long names?',
  ],
  data: [
    'A stakeholder says the dashboard numbers "look wrong". How do you work out whether the data, the query, or the chart is at fault?',
    'Walk me through how you would model the tables behind this interview platform — candidates, questions, answers — plus the SQL to rank candidates by score.',
    'You are handed a messy CSV full of duplicates and missing values. What does your cleaning pipeline look like?',
  ],
  security: [
    'Your app needs admin logins. Walk me through how you would store credentials and sessions so that a leak would not compromise users.',
    'Someone files a bug saying they can see another user\'s data by editing an id in the URL. How do you fix it, and how do you check for the same class of bug elsewhere?',
    'Explain the difference between authentication and authorization using a concrete example from a project you have worked on.',
  ],
  architecture: [
    'Sketch how you would design a system that sends reminder emails to thousands of users exactly on time. Where does it fall over first?',
    'Two services need to stay in sync when one of them receives writes. Walk me through the options and the trade-offs you would weigh.',
    'You are asked to take a monolith serving 10,000 users and make it scale to 100,000. What do you do first, second, and third?',
  ],
};

const TECH_TERMS = [
  'react', 'next.js', 'typescript', 'javascript', 'node', 'express', 'sql',
  'postgresql', 'postgres', 'mysql', 'mongodb', 'redis', 'graphql', 'rest',
  'python', 'django', 'flask', 'pandas', 'java', 'spring', 'php', 'laravel',
  'docker', 'kubernetes', 'aws', 'firebase', 'supabase', 'git', 'tailwind',
  'css', 'html', 'jest', 'cypress', 'playwright', 'oauth', 'jwt',
  'encryption', 'microservices', 'websockets', 'kafka', 'etl', 'tableau',
];

const GENERAL_POOL: { focus: string; question: string }[] = [
  {
    focus: 'Opening',
    question:
      'Walk me through your background in about two minutes — the parts a CV does not show.',
  },
  {
    focus: 'Behavioral & Communication',
    question:
      'Tell me about a time you had to meet a tight deadline. What did you cut, what did you keep, and what was the outcome?',
  },
  {
    focus: 'Backend & Databases',
    question:
      'Design the API and database schema for a feature that lets users bookmark a job and get notified when its status changes. Think out loud.',
  },
  {
    focus: 'Frontend & UI',
    question:
      'A page you built is slow with a large list on screen. How do you find the cause and fix it?',
  },
  {
    focus: 'Security',
    question:
      'Your app needs admin logins. Walk me through how you would store credentials and sessions so a leak would not compromise users.',
  },
  {
    focus: 'Architecture & System Design',
    question:
      'You are asked to take a monolith serving 10,000 users and make it scale to 100,000. What do you do first, second, and third?',
  },
];

const EXTRA_FALLBACKS: { focus: string; question: string }[] = [
  {
    focus: 'Self-review',
    question:
      'Which of your written-round answers are you least confident in, and why?',
  },
  {
    focus: 'Teamwork',
    question:
      'Describe the best team you have worked on. What made it work, and what role did you play in it?',
  },
  {
    focus: 'Learning',
    question:
      'What is the most useful thing you have taught yourself recently, and how did you go about learning it?',
  },
  {
    focus: 'Trade-offs',
    question:
      'Give me an example of a shortcut you took that you would normally have avoided. When is a shortcut the right call?',
  },
];

function clean(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function snippet(text: string, max = 130): string {
  const t = clean(text);
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${cut.slice(0, space > max * 0.6 ? space : max)}…`;
}

function isAnswered(qa: InPersonQA): boolean {
  return (qa.response ?? '').trim().length > 0;
}

function isThin(qa: InPersonQA): boolean {
  const t = (qa.response ?? '').trim();
  return t.length > 0 && t.length < 80;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function topTechMention(answers: InPersonQA[]): { term: string; count: number } | null {
  const corpus = answers
    .map((a) => a.response ?? '')
    .join(' ')
    .toLowerCase();

  let bestTerm: string | null = null;
  let bestCount = 0;
  for (const term of TECH_TERMS) {
    const count = corpus.match(new RegExp(`\\b${escapeRegExp(term)}\\b`, 'g'))?.length ?? 0;
    if (count > bestCount) {
      bestTerm = term;
      bestCount = count;
    }
  }

  return bestTerm ? { term: bestTerm, count: bestCount } : null;
}

export function generateInPersonQuestions(
  name: string,
  qas: InPersonQA[],
  assessment: Assessment
): TailoredQuestion[] {
  const out: TailoredQuestion[] = [];
  const used = new Set<string>();
  const add = (q: TailoredQuestion): boolean => {
    const key = clean(q.question).toLowerCase();
    if (used.has(key)) return false;
    used.add(key);
    out.push(q);
    return true;
  };

  const answered = qas.filter(isAnswered);
  const categories = [...assessment.categories]
    .filter((c) => c.total > 0)
    .sort((a, b) => a.score - b.score);

  if (answered.length === 0) {
    const pool = [
      {
        focus: 'Opening',
        question: `${name}, you have not submitted the written round yet, so let's start fresh: walk me through your background in about two minutes.`,
        rationale: 'No written answers on file — open with a general screen.',
      },
      ...GENERAL_POOL.slice(1).map((g) => ({
        ...g,
        rationale: 'No written answers on file — general screening question.',
      })),
    ];
    return pool.slice(0, 6);
  }

  const weakest = categories[0];
  const secondWeakest = categories.find((c) => c.key !== weakest.key) ?? weakest;
  const strongest = categories[categories.length - 1];

  const catScore = (position: number): number =>
    categories.find((c) => c.key === categoryForPosition(position))?.score ?? 5;

  const probeIndex = (key: CategoryKey): number => {
    const inCat = answered.filter((q) => categoryForPosition(q.position) === key);
    return inCat.length % WEAK_PROBES[key].length;
  };

  // 1 — Opener: quote their own motivation answer, else a score-tailored open.
  const motivation = [3, 4]
    .map((p) => qas.find((q) => q.position === p))
    .find((q) => q && (q.response ?? '').trim().length >= 60);

  if (motivation) {
    add({
      focus: 'Motivation',
      question: `You wrote that you were drawn to this role because "${snippet(
        motivation.response!
      )}" — which part of the day-to-day here matters most to you, and what have you shipped recently that proves it?`,
      rationale: `Quotes their own answer to Q${motivation.position} from the written round.`,
    });
  } else {
    add({
      focus: 'Opening',
      question:
        assessment.score >= 6
          ? `You scored ${assessment.score}/10 in the written round with ${assessment.completionPct}% completion. In your own words, what should I know about you before we dig in?`
          : `You completed ${assessment.answered} of ${assessment.total} questions in the written round. Start fresh: walk me through your background and the work you are proudest of.`,
      rationale: `Tailored to their written-round score (${assessment.score}/10) and completion (${assessment.completionPct}%).`,
    });
  }

  // 2 — Deep dive: extend their longest answer in the strongest category.
  const bestAnswer = answered
    .filter((q) => categoryForPosition(q.position) === strongest.key)
    .sort((a, b) => (b.response ?? '').length - (a.response ?? '').length)[0];

  if (bestAnswer) {
    add({
      focus: `Deep dive · ${strongest.label}`,
      question: `You wrote: "${snippet(
        bestAnswer.response!
      )}" — take that further for me. What was the measurable outcome, what trade-off did you accept, and what would you do differently next time?`,
      rationale: `Extends their strongest area (${strongest.label}, ${strongest.score}/10) using their own words.`,
    });
  } else {
    add({
      focus: `Deep dive · ${strongest.label}`,
      question:
        'Tell me about the project you are proudest of and why. What was your specific contribution?',
      rationale: `${strongest.label} scored highest for them (${strongest.score}/10) — probe the work behind it.`,
    });
  }

  // 3 & 4 — Probes for the two weakest categories.
  add({
    focus: `Weak spot · ${weakest.label}`,
    question: WEAK_PROBES[weakest.key][probeIndex(weakest.key)],
    rationale: `${weakest.label} was their softest area at ${weakest.score}/10 (${weakest.answered}/${weakest.total} answered).`,
  });

  add({
    focus: `Gap check · ${secondWeakest.label}`,
    question: WEAK_PROBES[secondWeakest.key][
      (probeIndex(secondWeakest.key) + 1) % WEAK_PROBES[secondWeakest.key].length
    ],
    rationale: `${secondWeakest.label} was their second-weakest area at ${secondWeakest.score}/10.`,
  });

  // 5 — Re-ask what they skipped (or barely answered) in person.
  const skipped = qas
    .filter((q) => !isAnswered(q))
    .sort((a, b) => catScore(a.position) - catScore(b.position) || a.position - b.position);
  const skipTarget = skipped.find((q) => q.position >= 51) ?? skipped[0];

  if (skipTarget) {
    const key = categoryForPosition(skipTarget.position);
    add({
      focus: `Unanswered · ${CATEGORY_LABELS[key]}`,
      question: `You left this one blank online, so let's take it live: "${skipTarget.prompt}"`,
      rationale: `Not answered in the written round; ${CATEGORY_LABELS[key]} scored ${catScore(skipTarget.position)}/10 for them.`,
    });
  } else {
    const thinTarget = [...qas]
      .filter(isThin)
      .sort((a, b) => catScore(a.position) - catScore(b.position))[0];
    if (thinTarget) {
      const key = categoryForPosition(thinTarget.position);
      add({
        focus: `Expand · ${CATEGORY_LABELS[key]}`,
        question: `Your answer to "${thinTarget.prompt}" was brief online. Expand on it now — two or three sentences, ideally with a concrete example.`,
        rationale: `Answered with under 80 characters in the written round; ${CATEGORY_LABELS[key]} scored ${catScore(thinTarget.position)}/10.`,
      });
    } else {
      add({
        focus: 'Self-review',
        question:
          'Which of your written-round answers are you least confident in, and why?',
        rationale:
          'Every question was answered — use their own self-critique to find blind spots.',
      });
    }
  }

  // 6 — Stack scenario built from what they actually mentioned.
  const tech = topTechMention(answered);
  if (tech) {
    add({
      focus: `Stack · ${tech.term.toUpperCase()}`,
      question: `Your answers kept coming back to ${tech.term}. Give me the part of ${tech.term} that most candidates get wrong, and how you would catch that mistake in a code review.`,
      rationale: `Mentioned ${tech.count}× across their written answers — scenario built from their own stack.`,
    });
  } else if (assessment.score >= 8) {
    add({
      focus: "Devil's advocate",
      question: `You came out of the written round as a "${assessment.recommendation}" at ${assessment.score}/10. Play devil's advocate: what is the biggest risk in hiring you, and how would we mitigate it?`,
      rationale: 'Strong score — challenge self-awareness instead of basics.',
    });
  } else {
    add({
      focus: 'Live thinking',
      question: `Pick the hardest project you have worked on and walk me through the design decisions you made, out loud, as if you were whiteboarding them for me.`,
      rationale: `Scored ${assessment.score}/10 in the written round — observe reasoning live rather than on paper.`,
    });
  }

  for (const fallback of EXTRA_FALLBACKS) {
    if (out.length >= 6) break;
    add({ ...fallback, rationale: 'Filler — kept the set at six questions.' });
  }

  return out.slice(0, 6);
}
