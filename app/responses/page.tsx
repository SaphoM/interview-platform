'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type Sub = {
  id: string;
  intern_name: string;
  created_at: string;
  completed_at: string | null;
};

export default function ResponsesPage() {
  const router = useRouter();
  const [subs, setSubs] = useState<Sub[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSubs();
  }, []);

  async function fetchSubs() {
    const { data } = await supabase
      .from('submissions')
      .select('id, intern_name, created_at, completed_at')
      .order('created_at', { ascending: false });
    setSubs((data as Sub[]) ?? []);
    setLoading(false);
  }

  async function createSubmission(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    const { data, error } = await supabase
      .from('submissions')
      .insert({ intern_name: name.trim() })
      .select('id')
      .single();
    setCreating(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push(`/interview/${data.id}`);
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(160deg, #4f6df5 0%, #6d4af5 50%, #8b3fd9 100%)' }}>
      <div className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-semibold text-white mb-8">Submissions</h1>

        {/* Start interview card */}
        <div className="flex flex-col items-center mb-12">
          <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mb-5">
            <svg
              className="w-7 h-7 text-white"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 20.25a7.5 7.5 0 0 1 15 0"
              />
            </svg>
          </div>

          <h2 className="text-2xl font-bold text-white text-center mb-6 tracking-wide">
            START INTERVIEW
          </h2>

          <form onSubmit={createSubmission} className="w-full max-w-lg space-y-4">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Candidate name"
              className="w-full bg-transparent border border-white/50 rounded-lg px-3 py-2 text-white placeholder-white/60 focus:outline-none focus:border-white transition-colors"
            />
            {error && <p className="text-red-200 text-sm">{error}</p>}
            <div className="flex justify-center">
              <button
                type="submit"
                disabled={creating || !name.trim()}
                className="bg-white text-gray-900 font-semibold px-6 py-2 rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? 'Starting…' : 'START INTERVIEW'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}