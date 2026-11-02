import { NavLink, Outlet } from 'react-router-dom'
import TeacherAccountSlot from './TeacherAccountSlot.jsx'

const NAV = [
  { to: '/teacher', label: '数据看板', end: true },
  { to: '/teacher/classes', label: '班级管理' },
  { to: '/teacher/materials', label: '资料管理' },
  { to: '/teacher/questions', label: '题库' },
  { to: '/teacher/papers', label: '组卷' },
  { to: '/teacher/review', label: '简答复核' },
]

/** 教师端外壳：中性灰白 + 深蓝，小圆角，侧边导航，高信息密度 */
export default function TeacherLayout() {
  return (
    <div className="min-h-screen flex bg-paper font-ui text-ink">
      <aside className="w-56 shrink-0 bg-ink text-white/80 flex flex-col print:hidden">
        <div className="book-title h-14 px-5 flex items-center text-white border-b border-gold/40">
          现代汉语 · 教师端
        </div>

        <nav className="flex-1 py-3">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `mx-2 block rounded-lg px-5 py-2 text-sm transition-colors ${
                  isActive ? 'bg-white/10 text-white' : 'hover:bg-white/10'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-end border-b border-gold/40 bg-white/80 px-4 print:hidden sm:px-6">
          <TeacherAccountSlot />
        </header>
        <main className="min-w-0 flex-1 p-6 print:p-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
