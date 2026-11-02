import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth-context.js'
import InkSeal from './InkSeal.jsx'

const NAV = [
  { to: '/student', label: '知识闯关', end: true },
  { to: '/student/practice', label: '自由组卷' },
  { to: '/student/wrong-book', label: '我的错题' },
  { to: '/student/materials', label: '资料宝库' },
]

/** 学生端外壳 */
export default function StudentLayout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/', { replace: true })
  }

  const displayName = profile?.display_name ?? '同学'

  return (
    <div className="min-h-screen overflow-x-hidden bg-paper font-ui text-ink">
      <header className="sticky top-0 z-20 border-b border-gold/70 bg-white/80 backdrop-blur">
        <div className="flex w-full flex-col gap-3 px-6 py-3 md:px-10 lg:flex-row lg:items-center lg:gap-6 xl:px-12 lg:py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <InkSeal className="h-12 w-14 shrink-0" />
              <span className="book-title shrink-0 text-2xl text-ink xl:text-[1.75rem]">知微追</span>
              <span aria-hidden="true" className="hidden h-6 w-px shrink-0 bg-gold md:block" />
              <span className="hidden min-w-0 truncate text-sm tracking-[0.2em] text-ink/55 md:inline">
                现代汉语研习工作台
              </span>
            </div>
            <div className="lg:hidden">
              <UserBar name={displayName} onSignOut={handleSignOut} />
            </div>
          </div>

          <nav className="grid grid-cols-2 gap-2 lg:flex lg:flex-1 lg:justify-center lg:gap-2">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `book-title inline-flex min-h-11 items-center justify-center rounded-lg px-3 py-2.5 text-base transition-colors lg:min-h-12 lg:px-5 lg:py-3 lg:text-lg ${
                    isActive
                      ? 'bg-peach text-ink'
                      : 'text-ink/70 hover:bg-peach/50'
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden lg:block">
            <UserBar name={displayName} onSignOut={handleSignOut} />
          </div>
        </div>
      </header>

      <main className="w-full px-6 py-6 md:px-10 md:py-8 xl:px-12">
        <Outlet />
      </main>
    </div>
  )
}

function UserBar({ name, onSignOut }) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <span className="min-w-0 max-w-[6.5rem] truncate px-2 py-2 text-base text-gray-600 sm:max-w-[10rem]">
        {name}
      </span>
      <button
        type="button"
        onClick={onSignOut}
        className="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-lg px-4 py-2 text-base text-ink/70 transition-colors hover:bg-peach/50"
      >
        退出
      </button>
    </div>
  )
}
