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

type Question = { position: number; prompt: string };

export default function Dashboard() {
  const router = useRouter();
  const [subs, setSubs] = useState<Sub[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [qSearch, setQSearch] = useState('');

  useEffect(() => {
    fetchSubs();
    fetchQuestions();
  }, []);

  async function fetchSubs() {
    const { data } = await supabase
      .from('submissions')
      .select('id, intern_name, created_at, completed_at')
      .order('created_at', { ascending: false });
    setSubs((data as Sub[]) ?? []);
    setLoading(false);
  }

  async function fetchQuestions() {
    const { data } = await supabase
      .from('questions')
      .select('position, prompt')
      .order('position');
    setQuestions((data as Question[]) ?? []);
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

  async function deleteSub(id: string) {
    await supabase.from('submissions').delete().eq('id', id);
    fetchSubs();
  }

  const total = subs.length;
  const completed = subs.filter((s) => s.completed_at).length;
  const inProgress = total - completed;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  const filtered = subs.filter((s) =>
    s.intern_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-60 bg-white/95 backdrop-blur-sm flex flex-col fixed h-full shadow-lg">
        <div className="p-4 border-b border-gray-100">
          <span className="text-lg font-semibold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
            Interview Platform
          </span>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <NavItem active>Overview</NavItem>
          <NavItem>Candidates</NavItem>
          <NavItem>Questions</NavItem>
          <NavItem>Settings</NavItem>
        </nav>
        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600" />
            <div>
              <p className="text-sm font-medium text-gray-900">Admin</p>
              <p className="text-xs text-gray-500">admin@company.com</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-60 p-6">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-white">Overview</h1>
            <p className="text-sm text-white/60">Track candidate progress and performance</p>
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search candidates..."
            className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder-white/50 focus:outline-none focus:border-white/40"
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Total Candidates"
            value={total}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
              </svg>
            }
          />
          <StatCard
            label="Completed"
            value={completed}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            }
          />
          <StatCard
            label="In Progress"
            value={inProgress}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            }
          />
          <StatCard
            label="Completion Rate"
            value={`${completionRate}%`}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
              </svg>
            }
          />
        </div>

        {/* Start interview */}
        <div className="bg-white/95 backdrop-blur-sm rounded-xl p-4 mb-6 shadow-lg">
          <form onSubmit={createSubmission} className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Candidate name"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-purple-400"
            />
            <button
              type="submit"
              disabled={creating || !name.trim()}
              className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {creating ? 'Starting…' : 'Start interview'}
            </button>
          </form>
          {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
        </div>

        {/* Candidate list */}
        <div className="bg-white/95 backdrop-blur-sm rounded-xl overflow-hidden shadow-lg mb-6">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Candidates</h2>
          </div>
          {loading ? (
            <p className="p-4 text-gray-500">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="p-4 text-gray-500">No candidates yet.</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 text-left text-sm text-gray-500">
                  <th className="p-4">Name</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <td className="p-4 font-medium text-gray-900">{s.intern_name}</td>
                    <td className="p-4 text-sm text-gray-500">
                      {new Date(s.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-4">
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          s.completed_at
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {s.completed_at ? 'Completed' : 'In Progress'}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-3">
                        <Link
                          href={`/responses/${s.id}`}
                          className="text-sm text-purple-600 hover:underline"
                        >
                          View
                        </Link>
                        <button
                          onClick={() => deleteSub(s.id)}
                          className="text-sm text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Question bank */}
        <div className="bg-white/95 backdrop-blur-sm rounded-xl overflow-hidden shadow-lg">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">Question Bank</h2>
              <p className="text-sm text-gray-500">{questions.length} questions available</p>
            </div>
            <input
              value={qSearch}
              onChange={(e) => setQSearch(e.target.value)}
              placeholder="Search questions..."
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-purple-400"
            />
          </div>
          {questions.length === 0 ? (
            <p className="p-4 text-gray-500">No questions loaded.</p>
          ) : (
            <ul className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
              {questions
                .filter((q) =>
                  q.prompt.toLowerCase().includes(qSearch.toLowerCase())
                )
                .map((q) => (
                  <li key={q.position} className="px-4 py-3 flex items-start gap-4 hover:bg-gray-50/50">
                    <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/10 to-purple-600/10 flex items-center justify-center text-sm font-medium text-purple-600">
                      {q.position}
                    </span>
                    <p className="text-sm text-gray-900 leading-relaxed">{q.prompt}</p>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}

function NavItem({
  children,
  active,
}: {
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <div
      className={`px-3 py-2 rounded-lg text-sm ${
        active
          ? 'bg-gradient-to-r from-blue-500/10 to-purple-600/10 text-purple-700 font-medium'
          : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      {children}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/10 to-purple-600/10 flex items-center justify-center text-purple-600">
          {icon}
        </div>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
      <p className="text-2xl font-semibold text-gray-900">{value}</p>
    </div>
  );
}
