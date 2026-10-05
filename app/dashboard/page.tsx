'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  isAuthenticated,
  login,
  logout,
  fetchLogins,
  ADMIN_EMAIL,
  type AdminLogin,
} from '@/lib/admin';
import { assess, type Assessment } from '@/lib/assess';
import CompareSection from './CompareSection';

type Sub = {
  id: string;
  intern_name: string;
  created_at: string;
  completed_at: string | null;
};

type Question = { position: number; prompt: string };

type Section = 'overview' | 'candidates' | 'questions' | 'compare' | 'sessions' | 'settings';

type Settings = {
  duration: number;
  allowPause: boolean;
  autosaveInterval: number;
};

const SETTINGS_KEY = 'interview-settings';
const SECTIONS: { id: Section; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'candidates', label: 'Candidates' },
  { id: 'questions', label: 'Questions' },
  { id: 'compare', label: 'Compare' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'settings', label: 'Settings' },
];

const TONE_STYLES: Record<Assessment['recommendationTone'], string> = {
  strong: 'bg-green-100 text-green-700',
  hire: 'bg-emerald-100 text-emerald-700',
  maybe: 'bg-yellow-100 text-yellow-700',
  no: 'bg-red-100 text-red-700',
};

// ===== Auth gate =====
export default function DashboardPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    setAuthed(isAuthenticated());
  }, []);

  if (authed === null) {
    return (
      <main className="min-h-screen flex items-center justify-center text-white">
        Loading…
      </main>
    );
  }

  if (!authed) {
    return <AdminLogin onSuccess={() => setAuthed(true)} />;
  }

  return (
    <AdminDashboard
      onLogout={() => {
        logout();
        setAuthed(false);
      }}
    />
  );
}

// ===== Login screen =====
function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await login(email, password);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? 'Login failed.');
      return;
    }
    onSuccess();
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4">
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
                d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Admin sign in</h1>
          <p className="text-white/60 text-sm mt-1">
            Enter your credentials to access the dashboard
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            autoComplete="username"
            autoFocus
            className="w-full bg-white/10 border border-white/30 rounded-lg px-4 py-3 text-white placeholder-white/50 focus:outline-none focus:border-white transition-colors"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            className="w-full bg-white/10 border border-white/30 rounded-lg px-4 py-3 text-white placeholder-white/50 focus:outline-none focus:border-white transition-colors"
          />
          {error && <p className="text-red-200 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={submitting || !email || !password}
            className="w-full bg-white text-gray-900 font-semibold px-6 py-3 rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  );
}

// ===== Dashboard (gated) =====
function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const router = useRouter();
  const [active, setActive] = useState<Section>('overview');
  const [subs, setSubs] = useState<Sub[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [logins, setLogins] = useState<AdminLogin[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [qSearch, setQSearch] = useState('');
  const [settings, setSettings] = useState<Settings>({
    duration: 30,
    allowPause: true,
    autosaveInterval: 4000,
  });
  const [saved, setSaved] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Sub | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [scores, setScores] = useState<
    Record<
      string,
      { score: number; recommendation: string; tone: Assessment['recommendationTone'] }
    >
  >({});
  const [sortBy, setSortBy] = useState<'score' | 'newest' | 'name'>('score');
  const revealedRef = useRef(false);
  const mainRef = useRef<HTMLElement | null>(null);

  // Load data + persisted settings
  useEffect(() => {
    fetchSubs();
    fetchQuestions();
    fetchScores();
    fetchLogins().then(setLogins);
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      try {
        setSettings(JSON.parse(stored));
      } catch {
        // ignore malformed settings
      }
    }
  }, []);

  // Scroll-spy: highlight the section currently in view
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActive(entry.target.id as Section);
          }
        });
      },
      { root: mainRef.current, rootMargin: '-25% 0px -60% 0px' }
    );
    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  // Reveal sections as they float into view
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      { root: mainRef.current, threshold: 0.08 }
    );
    document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
    revealedRef.current = true;
    return () => observer.disconnect();
  }, [loading]);

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

  // Compute a content-based score per candidate for performance sorting.
  async function fetchScores() {
    const { data: qs } = await supabase
      .from('questions')
      .select('position')
      .order('position');

    // Supabase caps a query at 1000 rows — paginate to fetch every answer.
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

    const map: Record<
      string,
      { score: number; recommendation: string; tone: Assessment['recommendationTone'] }
    > = {};
    bySub.forEach((ansMap, sid) => {
      const qas = positions.map((p) => ({
        position: p,
        response: ansMap.get(p) ?? null,
      }));
      const a = assess(qas);
      map[sid] = {
        score: a.score,
        recommendation: a.recommendation,
        tone: a.recommendationTone,
      };
    });
    setScores(map);
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

  async function confirmDelete() {
    if (!pendingDelete) return;
    const deleted = pendingDelete;
    setDeleting(true);
    setDeleteError(null);
    // Optimistically remove from the UI immediately
    setSubs((prev) => prev.filter((s) => s.id !== deleted.id));
    const { error } = await supabase
      .from('submissions')
      .delete()
      .eq('id', deleted.id);
    setDeleting(false);
    if (error) {
      setDeleteError(error.message);
      // Restore the list on failure
      fetchSubs();
      return;
    }
    setPendingDelete(null);
    fetchSubs();
  }

  function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }

  const total = subs.length;
  const completed = subs.filter((s) => s.completed_at).length;
  const inProgress = total - completed;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  const filtered = subs
    .filter((s) => s.intern_name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'score') {
        // Top performers first; candidates without a score sink to the bottom.
        return (scores[b.id]?.score ?? -1) - (scores[a.id]?.score ?? -1);
      }
      if (sortBy === 'name') {
        return a.intern_name.localeCompare(b.intern_name);
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const filteredQuestions = questions.filter((q) =>
    q.prompt.toLowerCase().includes(qSearch.toLowerCase())
  );

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Static background accents */}
      <div className="pointer-events-none fixed top-0 left-0 z-0">
        <div className="w-[28rem] h-[28rem] rounded-full bg-blue-400/20 blur-3xl" />
      </div>
      <div className="pointer-events-none fixed top-1/3 right-0 z-0">
        <div className="w-[24rem] h-[24rem] rounded-full bg-purple-400/20 blur-3xl" />
      </div>

      {/* Sidebar */}
      <aside className="w-60 bg-white/95 backdrop-blur-sm flex flex-col fixed h-full shadow-lg z-20">
        <div className="p-4 border-b border-gray-100">
          <span className="text-lg font-semibold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
            Interview Platform
          </span>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {SECTIONS.map(({ id, label }) => (
            <NavItem
              key={id}
              active={active === id}
              onClick={() => scrollTo(id)}
            >
              {label}
            </NavItem>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">Admin</p>
              <p className="text-xs text-gray-500 truncate">{ADMIN_EMAIL}</p>
            </div>
            <button
              onClick={onLogout}
              title="Sign out"
              className="text-gray-400 hover:text-red-600 transition-colors shrink-0"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9"
                />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content — scrolls inside this container, not the whole page */}
      <main
        ref={mainRef}
        className="flex-1 ml-60 p-6 relative z-10 space-y-10 overflow-y-auto themed-scroll"
      >
        {/* Overview */}
        <section id="overview" className="reveal scroll-mt-6">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-white">Overview</h1>
            <p className="text-sm text-white/60">
              Track candidate progress and performance
            </p>
          </div>

          <div className="grid grid-cols-4 gap-4 mb-6">
            <StatCard
              label="Total Candidates"
              value={total}
              delay={0}
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                </svg>
              }
            />
            <StatCard
              label="Completed"
              value={completed}
              delay={80}
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              }
            />
            <StatCard
              label="In Progress"
              value={inProgress}
              delay={160}
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              }
            />
            <StatCard
              label="Completion Rate"
              value={`${completionRate}%`}
              delay={240}
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                </svg>
              }
            />
          </div>

          <div className="bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg stagger">
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
        </section>

        {/* Candidates */}
        <section id="candidates" className="reveal scroll-mt-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-white">Candidates</h1>
              <p className="text-sm text-white/60">
                {total} total · {completed} completed · {inProgress} in progress
              </p>
            </div>
            <div className="flex gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-white/40"
              >
                <option value="score">Top performers</option>
                <option value="newest">Newest first</option>
                <option value="name">Name A–Z</option>
              </select>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search candidates..."
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder-white/50 focus:outline-none focus:border-white/40"
              />
            </div>
          </div>

          <div className="bg-white/95 backdrop-blur-sm rounded-xl overflow-hidden shadow-lg">
            {loading ? (
              <p className="p-4 text-gray-500">Loading…</p>
            ) : filtered.length === 0 ? (
              <p className="p-4 text-gray-500">
                {subs.length === 0 ? 'No candidates yet.' : 'No matches found.'}
              </p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-sm text-gray-500">
                    <th className="p-4">Name</th>
                    <th className="p-4">Date</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Performance</th>
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
                        {scores[s.id] ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900">
                              {scores[s.id].score}/10
                            </span>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${
                                TONE_STYLES[scores[s.id].tone]
                              }`}
                            >
                              {scores[s.id].recommendation}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
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
                            onClick={() => setPendingDelete(s)}
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
        </section>

        {/* Questions */}
        <section id="questions" className="reveal scroll-mt-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-white">Questions</h1>
              <p className="text-sm text-white/60">
                {questions.length} questions in the bank
              </p>
            </div>
            <input
              value={qSearch}
              onChange={(e) => setQSearch(e.target.value)}
              placeholder="Search questions..."
              className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder-white/50 focus:outline-none focus:border-white/40"
            />
          </div>

          <div className="bg-white/95 backdrop-blur-sm rounded-xl overflow-hidden shadow-lg">
            {questions.length === 0 ? (
              <p className="p-4 text-gray-500">No questions loaded.</p>
            ) : filteredQuestions.length === 0 ? (
              <p className="p-4 text-gray-500">No matches found.</p>
            ) : (
              <ul className="divide-y divide-gray-50 max-h-[70vh] overflow-y-auto">
                {filteredQuestions.map((q) => (
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
        </section>

        {/* Compare */}
        <section id="compare" className="reveal scroll-mt-6">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-white">Compare</h1>
            <p className="text-sm text-white/60">
              Assess outcomes and compare candidates side by side
            </p>
          </div>
          <CompareSection />
        </section>

        {/* Sessions */}
        <section id="sessions" className="reveal scroll-mt-6">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-white">Sessions</h1>
            <p className="text-sm text-white/60">
              Devices and locations that have signed in
            </p>
          </div>

          <div className="bg-white/95 backdrop-blur-sm rounded-xl overflow-hidden shadow-lg">
            {logins.length === 0 ? (
              <p className="p-4 text-gray-500">No logins recorded yet.</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-sm text-gray-500">
                    <th className="p-4">Device</th>
                    <th className="p-4">Location</th>
                    <th className="p-4">IP</th>
                    <th className="p-4">Signed in</th>
                  </tr>
                </thead>
                <tbody>
                  {logins.map((l) => (
                    <tr key={l.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                      <td className="p-4">
                        <p className="font-medium text-gray-900">
                          {l.browser ?? 'Unknown'} · {l.os ?? 'Unknown'}
                        </p>
                        <p className="text-xs text-gray-500">{l.device_type ?? '—'}</p>
                      </td>
                      <td className="p-4 text-sm text-gray-700">
                        {[l.city, l.region, l.country].filter(Boolean).join(', ') ||
                          'Unknown'}
                      </td>
                      <td className="p-4 text-sm text-gray-500">{l.ip ?? '—'}</td>
                      <td className="p-4 text-sm text-gray-500">
                        {new Date(l.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Settings */}
        <section id="settings" className="reveal scroll-mt-6">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-white">Settings</h1>
            <p className="text-sm text-white/60">
              Configure the interview experience
            </p>
          </div>

          <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg max-w-xl">
            <div className="p-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Interview defaults</h2>
            </div>
            <div className="p-4 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Interview duration (minutes)
                </label>
                <input
                  type="number"
                  min={5}
                  max={240}
                  value={settings.duration}
                  onChange={(e) =>
                    setSettings({ ...settings, duration: Number(e.target.value) })
                  }
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-purple-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Autosave interval
                </label>
                <select
                  value={settings.autosaveInterval}
                  onChange={(e) =>
                    setSettings({ ...settings, autosaveInterval: Number(e.target.value) })
                  }
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-purple-400"
                >
                  <option value={2000}>Every 2 seconds</option>
                  <option value={4000}>Every 4 seconds</option>
                  <option value={10000}>Every 10 seconds</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">Allow candidate pause</p>
                  <p className="text-xs text-gray-500">
                    Let candidates pause the timer during the interview
                  </p>
                </div>
                <button
                  role="switch"
                  aria-checked={settings.allowPause}
                  onClick={() =>
                    setSettings({ ...settings, allowPause: !settings.allowPause })
                  }
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    settings.allowPause
                      ? 'bg-gradient-to-r from-blue-500 to-purple-600'
                      : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      settings.allowPause ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-end">
              <button
                onClick={saveSettings}
                className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity"
              >
                {saved ? 'Saved ✓' : 'Save changes'}
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Delete confirmation modal */}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !deleting && setPendingDelete(null)}
          />
          <div className="relative bg-white rounded-xl shadow-2xl max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Delete candidate?
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              This will permanently delete{" "}
              <span className="font-medium text-gray-900">
                {pendingDelete.intern_name}
              </span>{" "}
              and all their answers. This action cannot be undone.
            </p>
            {deleteError && (
              <p className="text-red-600 text-sm mb-4">{deleteError}</p>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setPendingDelete(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NavItem({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
        active
          ? 'bg-gradient-to-r from-blue-500/10 to-purple-600/10 text-purple-700 font-medium'
          : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      {children}
    </button>
  );
}

function StatCard({
  label,
  value,
  icon,
  delay,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  delay?: number;
}) {
  return (
    <div
      className="stagger bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg"
      style={{ transitionDelay: `${delay ?? 0}ms` }}
    >
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
