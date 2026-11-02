/** 尚未实现的页面占位 */
export default function ComingSoon({ title, variant = 'teacher' }) {
  const student = variant === 'student'
  return (
    <div
      className={
        student
          ? 'rounded-student bg-white p-10 text-center shadow-sm ring-1 ring-lavender-100'
          : 'rounded-teacher bg-white p-10 text-center border border-gray-200'
      }
    >
      <div className="text-3xl">{student ? '🚧' : '🛠️'}</div>
      <h1
        className={`mt-3 text-lg font-semibold ${student ? 'text-lavender-600' : 'text-navy-800'}`}
      >
        {title}
      </h1>
      <p className="mt-1 text-sm text-gray-500">该功能正在开发中，敬请期待。</p>
    </div>
  )
}
