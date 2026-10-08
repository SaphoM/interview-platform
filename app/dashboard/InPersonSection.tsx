'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { assess, type Assessment } from '@/lib/assess';
import { generateInPersonQuestions, type TailoredQuestion } from '@/lib/inperson';

type Candidate = {
  id: string;
  name: string;
  completed: boolean;
  assessment: Assessment;
  questions: TailoredQuestion[];
};

type QuestionRow = { position: number; prompt: string };
type SubmissionRow = {
  id: string;
  intern_name: string;
  completed_at: string | null;
};
type AnswerRow = {
  submission_id: string;
  response: string | null;
  questions: { position: number };
};

type Props = {
  selectedId: string | null;
  onSelect: (id: string) => void;
};

const TONE_STYLES: Record<Assessment['recommendationTone'], string> = {
  strong: 'bg-green-100 text-green-700',
  hire: 'bg-emerald-100 text-emerald-700',
  maybe: 'bg-yellow-100 text-yellow-700',
  no: 'bg-red-100 text-red-700',
};

export default function InPersonSection({ selectedId, onSelect }: Props) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: qs }, { data: subs }] = await Promise.all([
        supabase.from('questions').select('position, prompt').order('position'),
        supabase
          .from('submissions')
          .select('id, intern_name, completed_at')
          .order('created_at', { ascending: false }),
      ]);

      // Supabase caps a single query at 1000 rows, so paginate to fetch every answer.
      const answers: AnswerRow[] = [];
      const pageSize = 1000;
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
          .from('answers')
          .select('submission_id, response, questions(position)')
          .range(from, from + pageSize - 1);
        if (error || !data || data.length === 0) break;
        answers.push(...((data as unknown as AnswerRow[]) ?? []));
        if (data.length < pageSize) break;
      }

      const prompts = new Map<number, string>();
      ((qs as QuestionRow[]) ?? []).forEach((q) => prompts.set(q.position, q.prompt));
      const positions = [...prompts.keys()].sort((a, b) => a - b);

      const bySub = new Map<string, Map<number, string | null>>();
      answers.forEach((a) => {
        if (!bySub.has(a.submission_id)) bySub.set(a.submission_id, new Map());
        bySub.get(a.submission_id)!.set(a.questions.position, a.response);
      });

      const list: Candidate[] = ((subs as SubmissionRow[]) ?? []).map((s) => {
        const ansMap = bySub.get(s.id) ?? new Map<number, string | null>();
        const qas = positions.map((p) => ({
          position: p,
          prompt: prompts.get(p) ?? '',
          response: ansMap.get(p) ?? null,
        }));
        const assessment = assess(
          qas.map((q) => ({ position: q.position, response: q.response }))
        );
        return {
          id: s.id,
          name: s.intern_name,
          completed: !!s.completed_at,
          assessment,
          questions: generateInPersonQuestions(s.intern_name, qas, assessment),
        };
      });

      setCandidates(list);
      setLoading(false);
    })();
  }, []);

  const active =
    candidates.find((c) => c.id === selectedId) ?? candidates[0] ?? null;

  function copyAll() {
    if (!active) return;
    const text = [
      `In-person interview — ${active.name}`,
      '',
      ...active.questions.map((q, i) => `${i + 1}. ${q.question}`),
    ].join('\n');
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (loading) {
    return (
      <div className="bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg">
        <p className="text-gray-500">Loading candidates…</p>
      </div>
    );
  }

  if (!active) {
    return (
      <div className="bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg">
        <p className="text-gray-500">No candidates yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={active.id}
          onChange={(e) => onSelect(e.target.value)}
          className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/40 max-w-xs"
          aria-label="Select candidate"
        >
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} — {c.assessment.score}/10 ({c.assessment.recommendation})
            </option>
          ))}
        </select>
        <button
          onClick={copyAll}
          className="bg-white/10 border border-white/20 hover:bg-white/20 text-white text-sm px-3 py-2 rounded-lg transition-colors"
        >
          {copied ? 'Copied ✓' : 'Copy questions'}
        </button>
      </div>

      <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-semibold text-gray-900">{active.name}</h2>
            <p className="text-xs text-gray-500">
              {active.completed ? 'Completed' : 'In progress'} ·{' '}
              {active.assessment.answered}/{active.assessment.total} answered ·{' '}
              {active.assessment.completionPct}%
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-gray-900">
              {active.assessment.score}
              <span className="text-sm text-gray-400 font-normal">/10</span>
            </span>
            <span
              className={`text-xs px-2 py-1 rounded-full font-medium ${
                TONE_STYLES[active.assessment.recommendationTone]
              }`}
            >
              {active.assessment.recommendation}
            </span>
          </div>
        </div>

        <ol className="divide-y divide-gray-50">
          {active.questions.map((q, i) => (
            <li key={i} className="p-4 flex items-start gap-4 hover:bg-gray-50/50">
              <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/10 to-purple-600/10 flex items-center justify-center text-sm font-medium text-purple-600">
                {i + 1}
              </span>
              <div className="min-w-0">
                <span className="inline-block text-[11px] uppercase tracking-wide font-medium text-purple-600 bg-purple-50 rounded px-1.5 py-0.5">
                  {q.focus}
                </span>
                <p className="text-sm text-gray-900 leading-relaxed mt-1.5">
                  {q.question}
                </p>
                <p className="text-xs text-gray-500 mt-1 italic">{q.rationale}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="p-3 border-t border-gray-100 bg-gray-50/60">
          <p className="text-xs text-gray-500">
            Six questions generated from {active.name}&apos;s written-round
            answers and category scores — rule-based, ready for the face-to-face
            round.
          </p>
        </div>
      </div>
    </div>
  );
}
