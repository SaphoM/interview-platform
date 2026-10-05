'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { assess, type Assessment } from '@/lib/assess';

type CandidateAssessment = {
  id: string;
  name: string;
  completed: boolean;
  assessment: Assessment;
};

const TONE_STYLES: Record<Assessment['recommendationTone'], string> = {
  strong: 'bg-green-100 text-green-700',
  hire: 'bg-emerald-100 text-emerald-700',
  maybe: 'bg-yellow-100 text-yellow-700',
  no: 'bg-red-100 text-red-700',
};

export default function CompareSection() {
  const [candidates, setCandidates] = useState<CandidateAssessment[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: qs }, { data: subs }] = await Promise.all([
        supabase.from('questions').select('position').order('position'),
        supabase
          .from('submissions')
          .select('id, intern_name, completed_at')
          .order('created_at', { ascending: false }),
      ]);

      // Supabase caps a single query at 1000 rows, so paginate to fetch every
      // answer (61+ candidates × 120 answers far exceeds one page).
      const answers: any[] = [];
      const pageSize = 1000;
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
          .from('answers')
          .select('submission_id, response, questions(position)')
          .range(from, from + pageSize - 1);
        if (error || !data || data.length === 0) break;
        answers.push(...data);
        if (data.length < pageSize) break;
      }

      const positions: number[] = ((qs as any[]) ?? []).map((q) => q.position);
      const bySub = new Map<string, Map<number, string | null>>();
      (answers ?? []).forEach((a: any) => {
        const sid = a.submission_id as string;
        if (!bySub.has(sid)) bySub.set(sid, new Map());
        bySub.get(sid)!.set(a.questions.position, a.response);
      });

      const list: CandidateAssessment[] = ((subs as any[]) ?? []).map((s) => {
        const ansMap = bySub.get(s.id) ?? new Map<number, string | null>();
        const qas = positions.map((p) => ({
          position: p,
          response: ansMap.get(p) ?? null,
        }));
        return {
          id: s.id as string,
          name: s.intern_name as string,
          completed: !!s.completed_at,
          assessment: assess(qas),
        };
      });

      list.sort((a, b) => b.assessment.score - a.assessment.score);
      setCandidates(list);
      setLoading(false);
    })();
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedCandidates = candidates.filter((c) => selected.has(c.id));

  if (loading) {
    return (
      <div className="bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg">
        <p className="text-gray-500">Loading comparison…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Leaderboard */}
      <div className="bg-white/95 backdrop-blur-sm rounded-xl overflow-hidden shadow-lg">
        {candidates.length === 0 ? (
          <p className="p-4 text-gray-500">No candidates to compare yet.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 text-left text-sm text-gray-500">
                <th className="p-4 w-10">
                  <span className="sr-only">Compare</span>
                </th>
                <th className="p-4">Rank</th>
                <th className="p-4">Candidate</th>
                <th className="p-4">Score</th>
                <th className="p-4">Recommendation</th>
                <th className="p-4">Top development area</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c, i) => (
                <tr
                  key={c.id}
                  className={`border-b border-gray-50 last:border-0 hover:bg-gray-50/50 ${
                    selected.has(c.id) ? 'bg-purple-50/60' : ''
                  }`}
                >
                  <td className="p-4">
                    <input
                      type="checkbox"
                      checked={selected.has(c.id)}
                      onChange={() => toggle(c.id)}
                      className="w-4 h-4 accent-purple-600"
                      aria-label={`Compare ${c.name}`}
                    />
                  </td>
                  <td className="p-4">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500/10 to-purple-600/10 text-sm font-semibold text-purple-600">
                      {i + 1}
                    </span>
                  </td>
                  <td className="p-4">
                    <p className="font-medium text-gray-900">{c.name}</p>
                    <p className="text-xs text-gray-500">
                      {c.completed ? 'Completed' : 'In progress'}
                    </p>
                  </td>
                  <td className="p-4">
                    <span className="text-lg font-semibold text-gray-900">
                      {c.assessment.score}
                    </span>
                    <span className="text-sm text-gray-400">/10</span>
                  </td>
                  <td className="p-4">
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium ${
                        TONE_STYLES[c.assessment.recommendationTone]
                      }`}
                    >
                      {c.assessment.recommendation}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-gray-600 max-w-xs">
                    {c.assessment.growthAreas[0]
                      ? c.assessment.growthAreas[0].split('—')[0]
                      : '—'}
                  </td>
                  <td className="p-4">
                    <Link
                      href={`/responses/${c.id}`}
                      className="text-sm text-purple-600 hover:underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Side-by-side */}
      {selectedCandidates.length >= 2 ? (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">
            Side-by-side ({selectedCandidates.length})
          </h2>
          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns: `repeat(${Math.min(
                selectedCandidates.length,
                3
              )}, minmax(0, 1fr))`,
            }}
          >
            {selectedCandidates.map((c) => (
              <CompareCard key={c.id} candidate={c} />
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-white/60">
          Select 2 or more candidates above to compare them side by side.
        </p>
      )}
    </div>
  );
}

function CompareCard({ candidate }: { candidate: CandidateAssessment }) {
  const a = candidate.assessment;
  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg">
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="font-semibold text-gray-900">{candidate.name}</h3>
        <span
          className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${
            TONE_STYLES[a.recommendationTone]
          }`}
        >
          {a.recommendation}
        </span>
      </div>
      <p className="text-2xl font-bold text-gray-900 mb-1">
        {a.score}
        <span className="text-sm text-gray-400 font-normal">/10</span>
      </p>
      <p className="text-xs text-gray-500 mb-4">
        {a.answered}/{a.total} answered · {a.completionPct}%
      </p>

      <div className="space-y-2 mb-4">
        {a.categories.map((c) => (
          <div key={c.key}>
            <div className="flex justify-between text-xs text-gray-600 mb-0.5">
              <span>{c.label}</span>
              <span>{c.score}/10</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full"
                style={{ width: `${c.score * 10}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">
          Development areas
        </p>
        {a.growthAreas.length === 0 ? (
          <p className="text-xs text-gray-600">No major gaps identified.</p>
        ) : (
          <ul className="space-y-1">
            {a.growthAreas.map((g, i) => (
              <li key={i} className="text-xs text-gray-700 flex gap-1.5">
                <span className="text-purple-500">•</span>
                <span>{g}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
