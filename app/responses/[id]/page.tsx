'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { assess, type Assessment } from '@/lib/assess';

type Row = { prompt: string; position: number; response: string | null };
type Sub = { intern_name: string; created_at: string; completed_at: string | null };

const TONE_STYLES: Record<Assessment['recommendationTone'], string> = {
  strong: 'bg-green-400/20 text-green-200 border-green-300/40',
  hire: 'bg-emerald-400/20 text-emerald-200 border-emerald-300/40',
  maybe: 'bg-yellow-400/20 text-yellow-200 border-yellow-300/40',
  no: 'bg-red-400/20 text-red-200 border-red-300/40',
};

export default function SubmissionDetail() {
  const { id } = useParams<{ id: string }>();
  const [sub, setSub] = useState<Sub | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: s }, { data: qs }, { data: answers }] = await Promise.all([
        supabase
          .from('submissions')
          .select('intern_name, created_at, completed_at')
          .eq('id', id)
          .single(),
        supabase.from('questions').select('position, prompt').order('position'),
        supabase
          .from('answers')
          .select('response, questions(position)')
          .eq('submission_id', id),
      ]);

      setSub(s as Sub);

      const answerMap = new Map<number, string | null>();
      (answers ?? []).forEach((a: any) =>
        answerMap.set(a.questions.position, a.response)
      );

      // Build the full 120-question view, unanswered marked null.
      const fullRows: Row[] = ((qs as any[]) ?? []).map((q) => ({
        position: q.position,
        prompt: q.prompt,
        response: answerMap.get(q.position) ?? null,
      }));
      fullRows.sort((a, b) => a.position - b.position);

      setRows(fullRows);
      setAssessment(
        assess(fullRows.map((r) => ({ position: r.position, response: r.response })))
      );
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <main className="p-10 text-white">Loading…</main>;
  if (!sub) return <main className="p-10 text-white">Not found.</main>;

  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-1 text-white">{sub.intern_name}</h1>
      <p className="text-sm text-white/60 mb-6">
        {new Date(sub.created_at).toLocaleString()}
        {sub.completed_at ? ' · completed' : ' · in progress'}
      </p>

      {assessment && <AssessmentCard assessment={assessment} />}

      <h2 className="text-lg font-semibold text-white mb-4">Answers</h2>
      {rows.map((r) => (
        <section key={r.position} className="mb-8">
          <p className="font-medium mb-2 text-white">
            <span className="text-white/40 font-normal mr-2">Q{r.position}</span>
            {r.prompt}
          </p>
          <pre className="bg-white/10 border border-white/20 rounded-lg p-3 whitespace-pre-wrap text-sm text-white">
            {r.response?.trim() ? (
              r.response
            ) : (
              <em className="text-white/40">(no answer)</em>
            )}
          </pre>
        </section>
      ))}
    </main>
  );
}

function AssessmentCard({ assessment }: { assessment: Assessment }) {
  return (
    <div className="bg-white/10 border border-white/20 rounded-xl p-5 mb-8">
      <div className="flex items-start justify-between gap-6 flex-wrap mb-5">
        <div>
          <p className="text-white/60 text-xs uppercase tracking-wide mb-1">
            Overall score
          </p>
          <p className="text-4xl font-bold text-white">
            {assessment.score}
            <span className="text-lg text-white/50 font-normal">/10</span>
          </p>
          <p className="text-white/60 text-sm mt-1">
            {assessment.answered}/{assessment.total} answered ·{' '}
            {assessment.completionPct}%
          </p>
        </div>
        <div>
          <p className="text-white/60 text-xs uppercase tracking-wide mb-1">
            Recommendation
          </p>
          <span
            className={`inline-block text-sm font-medium px-3 py-1.5 rounded-full border ${
              TONE_STYLES[assessment.recommendationTone]
            }`}
          >
            {assessment.recommendation}
          </span>
        </div>
      </div>

      <div className="space-y-2.5 mb-5">
        {assessment.categories.map((c) => (
          <div key={c.key}>
            <div className="flex justify-between text-xs text-white/70 mb-1">
              <span>{c.label}</span>
              <span>
                {c.score}/10 · {c.answered}/{c.total}
              </span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-400 to-purple-500 rounded-full transition-all"
                style={{ width: `${c.score * 10}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div>
        <p className="text-white/60 text-xs uppercase tracking-wide mb-2">
          Recommended development areas
        </p>
        {assessment.growthAreas.length === 0 ? (
          <p className="text-sm text-white/80">
            Strong all-round performance — no major gaps identified.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {assessment.growthAreas.map((g, i) => (
              <li key={i} className="text-sm text-white/90 flex gap-2">
                <span className="text-purple-300">•</span>
                <span>{g}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
