'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type Question = { id: number; prompt: string; position: number };
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export default function InterviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [responses, setResponses] = useState<Record<number, string>>({});
  const [saveState, setSaveState] = useState<Record<number, SaveState>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: qs }, { data: existing }] = await Promise.all([
        supabase.from('questions').select('*').order('position'),
        supabase
          .from('answers')
          .select('question_id, response')
          .eq('submission_id', id),
      ]);

      setQuestions((qs as Question[]) ?? []);

      const map: Record<number, string> = {};
      (existing ?? []).forEach((a: any) => (map[a.question_id] = a.response ?? ''));
      setResponses(map);
      setLoading(false);
    })();
  }, [id]);

  async function saveAnswer(questionId: number, value: string) {
    setSaveState((s) => ({ ...s, [questionId]: 'saving' }));
    const { error } = await supabase.from('answers').upsert(
      { submission_id: id, question_id: questionId, response: value },
      { onConflict: 'submission_id,question_id' }
    );
    setSaveState((s) => ({ ...s, [questionId]: error ? 'error' : 'saved' }));
  }

  async function submitAll() {
    setSubmitting(true);
    await Promise.all(
      questions.map((q) => saveAnswer(q.id, responses[q.id] ?? ''))
    );
    await supabase
      .from('submissions')
      .update({ completed_at: new Date().toISOString() })
      .eq('id', id);
    router.push('/thanks');
  }

  const answered = questions.filter(
    (q) => (responses[q.id] ?? '').trim().length > 0
  ).length;
  const pct = questions.length ? Math.round((answered / questions.length) * 100) : 0;

  if (loading) return <main className="p-10 text-white">Loading…</main>;

  return (
    <main className="max-w-3xl mx-auto p-6 pb-32">
      <div className="mb-8">
        <div className="flex items-baseline justify-between gap-4 mb-2">
          <h1 className="text-2xl font-semibold text-white">Interview questions</h1>
          <span className="text-sm text-white/60 whitespace-nowrap">
            {answered} of {questions.length} answered
          </span>
        </div>
        <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-white rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {questions.map((q, i) => (
        <section key={q.id} className="mb-10">
          <div className="flex items-start justify-between gap-4 mb-2">
            <p className="font-medium whitespace-pre-wrap text-white">
              <span className="text-white/40 font-normal mr-2">Q{i + 1}</span>
              {q.prompt}
            </p>
            <SaveBadge state={saveState[q.id] ?? 'idle'} />
          </div>
          <textarea
            className="w-full bg-white/10 border border-white/30 rounded-lg p-3 min-h-40 font-mono text-sm text-white placeholder-white/40 focus:outline-none focus:border-white transition-colors"
            value={responses[q.id] ?? ''}
            onChange={(e) =>
              setResponses((r) => ({ ...r, [q.id]: e.target.value }))
            }
            onBlur={() => saveAnswer(q.id, responses[q.id] ?? '')}
          />
        </section>
      ))}

      <div className="fixed bottom-0 left-0 right-0 bg-black/20 backdrop-blur-sm border-t border-white/20 p-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <span className="text-sm text-white/60">{pct}% complete</span>
          <button
            onClick={submitAll}
            disabled={submitting}
            className="bg-white text-gray-900 px-6 py-2 rounded-full font-medium hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Submit interview'}
          </button>
        </div>
      </div>
    </main>
  );
}

function SaveBadge({ state }: { state: SaveState }) {
  const text = { idle: '', saving: 'Saving…', saved: 'Saved', error: 'Save failed' }[state];
  if (!text) return null;
  const color =
    state === 'error' ? 'text-red-300' : state === 'saved' ? 'text-green-300' : 'text-white/50';
  return <span className={`text-xs ${color} whitespace-nowrap`}>{text}</span>;
}
