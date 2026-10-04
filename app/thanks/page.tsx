export default function Thanks() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-8 h-8 text-white"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold mb-2 text-white">Thanks — you're done.</h1>
        <p className="text-white/60">You can close this tab.</p>
      </div>
    </main>
  );
}
