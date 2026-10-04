'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type Row = { prompt: string; position: number; response: string | null };
type Sub = { intern_name: string; created_at: string; completed_at: string | null };

export default function SubmissionDetail() {
  const { id } = useParams<{ id: string }>();
  const [sub, setSub] = useState<Sub | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: s }, { data: answers }] = await Promise.all([
        supabase
          .from('submissions')
          .select('intern_name, created_at, completed_at')
          .eq('id', id)
          .single(),
        supabase
          .from('answers')
          .select('response, questions(prompt, position)')
          .eq('submission_id', id),
      ]);

      setSub(s as Sub);

      const flattened: Row[] = (answers ?? []).map((a: any) => ({
        prompt: a.questions.prompt,
        position: a.questions.position,
        response: a.response,
      }));
      flattened.sort((a, b) => a.position - b.position);
      setRows(flattened);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <main className="p-10 text-white">Loading…</main>;
  if (!sub) return <main className="p-10 text-white">Not found.</main>;

  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-1 text-white">{sub.intern_name}</h1>
      <p className="text-sm text-white/60 mb-8">
        {new Date(sub.created_at).toLocaleString()}
        {sub.completed_at ? ' · completed' : ' · in progress'}
      </p>

      {rows.map((r, i) => (
        <section key={i} className="mb-8">
          <p className="font-medium mb-2 text-white">{r.prompt}</p>
          <pre className="bg-white/10 border border-white/20 rounded-lg p-3 whitespace-pre-wrap text-sm text-white">
            {r.response || <em className="text-white/40">(no answer)</em>}
          </pre>
        </section>
      ))}
    </main>
  );
}
