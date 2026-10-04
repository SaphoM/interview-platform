'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <main className="min-h-screen flex items-center justify-center p-6 relative">
      {/* Admin shortcut */}
      <Link
        href="/dashboard"
        className="absolute top-5 right-5 text-sm text-white/60 hover:text-white transition-colors"
      >
        Admin →
      </Link>

      <div className="w-full max-w-md text-center">
        <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-8 h-8 text-white"
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

        <h1 className="text-3xl font-bold text-white mb-2">Technical Interview</h1>
        <p className="text-white/60 mb-8">
          Enter your name to begin. Your answers save automatically.
        </p>

        <form onSubmit={createSubmission} className="space-y-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Candidate name"
            autoFocus
            className="w-full bg-white/10 border border-white/30 rounded-lg px-4 py-3 text-white placeholder-white/50 focus:outline-none focus:border-white transition-colors"
          />
          {error && <p className="text-red-200 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={creating || !name.trim()}
            className="w-full bg-white text-gray-900 font-semibold px-6 py-3 rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? 'Starting…' : 'Start interview'}
          </button>
        </form>
      </div>
    </main>
  );
}
