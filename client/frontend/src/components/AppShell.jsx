import { Link, Outlet, useLocation } from 'react-router-dom'
import { Scale, Sparkles, UserRound, Users } from 'lucide-react'
import logo from '../assets/logo.png'

const NAV_ITEMS = [
  { label: 'Profile', href: '/profile', icon: UserRound },
  { label: 'Compare', href: '/compare', icon: Scale },
  { label: 'Friends', href: '/friends', icon: Users },
]

const AppShell = () => {
  const { pathname } = useLocation()

  return (
    <div className="relative min-h-screen overflow-clip bg-[#050816] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.08),transparent_28%),radial-gradient(circle_at_top_right,rgba(124,58,237,0.14),transparent_30%)]" />

      <header className="relative z-10 border-b border-white/6 bg-[#070b16]/90">
        <div className="mx-auto flex max-w-[1520px] items-center gap-3 px-5 py-3 sm:px-6 lg:px-8">
          <img className="h-10 w-10 object-contain" src={logo} alt="CodeCircle logo" />
          <span className="text-lg font-semibold tracking-tight text-white">CodeCircle</span>
        </div>
      </header>

      <div className="relative mx-auto flex max-w-[1520px] flex-col gap-5 px-4 py-5 sm:px-6 lg:flex-row lg:gap-6 lg:px-8 lg:py-6">
        <aside className="w-full shrink-0 space-y-5 lg:sticky lg:top-6 lg:w-[220px] lg:self-start">
          <nav aria-label="Main navigation" className="rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(14,21,39,0.98),rgba(9,14,28,0.98))] p-3 shadow-[0_20px_50px_rgba(0,0,0,0.32)] sm:p-4">
            <div className="grid grid-cols-3 gap-2 lg:grid-cols-1">
              {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
                const active = pathname === href

                return (
                  <Link
                    key={href}
                    to={href}
                    aria-current={active ? 'page' : undefined}
                    className={`flex min-w-0 items-center justify-center gap-2 rounded-2xl border px-2 py-3 text-sm font-medium transition-colors sm:gap-3 sm:px-4 sm:py-4 sm:text-base lg:justify-start ${
                      active
                        ? 'border-violet-500/20 bg-violet-500/12 text-violet-200 shadow-[0_0_24px_rgba(124,58,237,0.14)]'
                        : 'border-transparent text-slate-300 hover:border-white/8 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span className="truncate">{label}</span>
                  </Link>
                )
              })}
            </div>
          </nav>

          <section className="hidden overflow-hidden rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(14,21,39,0.98),rgba(9,14,28,0.98))] p-5 shadow-[0_20px_50px_rgba(0,0,0,0.32)] lg:block">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-violet-500/12 p-2 text-violet-300">
                <Sparkles className="h-5 w-5" />
              </div>
              <p className="font-semibold text-white">Pro Tip</p>
            </div>
            <div className="mt-5 space-y-3 text-sm leading-6 text-slate-300">
              <p>Solve consistently.</p>
              <p>Track smart.</p>
              <p>Grow together.</p>
            </div>
            <div className="relative mt-6 flex h-28 items-end gap-2 rounded-3xl bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.22),transparent_50%),linear-gradient(180deg,rgba(15,23,42,0.24),rgba(15,23,42,0.02))] px-5 pt-4">
              <span className="absolute right-5 top-3 text-amber-300">★</span>
              {[18, 34, 28, 46, 68].map((height) => (
                <div key={height} className="relative flex-1 rounded-t-xl bg-violet-500/30">
                  <div
                    className="absolute inset-x-0 bottom-0 rounded-t-xl bg-[linear-gradient(180deg,#9F7AEA,#7C3AED)]"
                    style={{ height }}
                  />
                </div>
              ))}
            </div>
          </section>
        </aside>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default AppShell
