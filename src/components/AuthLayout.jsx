// Shared frame for the sign-in and sign-up screens, in the ailean.dk look:
// paper ground, black ink, one orange signal.

export function Wordmark({ className = '' }) {
  return (
    <span className={`inline-flex items-center gap-3 text-sm font-bold tracking-[0.3em] text-ink ${className}`}>
      <span className="w-2.5 h-2.5 bg-signal" aria-hidden="true" />
      AILEAN
    </span>
  );
}

export const inputClass =
  'w-full px-4 py-3 rounded-lg border border-line bg-white text-sm text-ink placeholder:text-gray-400 focus:outline-none focus:border-ink focus:ring-2 focus:ring-ink/10 transition';

export const primaryButtonClass =
  'w-full py-3 rounded-full bg-ink hover:bg-ink-hover text-white text-sm font-semibold transition disabled:opacity-60';

export default function AuthLayout({ headline, intro, points, topRight, children }) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-paper text-ink">
      {/* Mobile header */}
      <div className="lg:hidden px-6 pt-6 pb-2 flex items-center justify-between">
        <Wordmark />
        {topRight}
      </div>

      {/* Left: what Ailean is — desktop */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-14 border-r border-line">
        <Wordmark />
        <div className="max-w-md">
          <h2 className="text-5xl font-semibold leading-[1.05] tracking-tight mb-6">{headline}</h2>
          <p className="text-lg text-mid leading-relaxed mb-10">{intro}</p>
          <ul className="space-y-3 text-sm">
            {points.map(p => (
              <li key={p} className="flex items-center gap-3">
                <span className="w-1.5 h-1.5 bg-signal shrink-0" aria-hidden="true" />
                {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-mid">ailean.dk</p>
      </div>

      {/* Right: the form */}
      <div className="flex-1 flex items-center justify-center px-6 py-10 relative">
        {topRight && <div className="hidden lg:block absolute top-5 right-6">{topRight}</div>}
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}

export function OrDivider() {
  return (
    <div className="my-5 flex items-center gap-3">
      <div className="flex-1 h-px bg-line" />
      <span className="text-xs text-mid">or</span>
      <div className="flex-1 h-px bg-line" />
    </div>
  );
}

export function ErrorBox({ children }) {
  return <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{children}</div>;
}
