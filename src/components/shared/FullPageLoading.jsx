export default function FullPageLoading({ text = '加载中…' }) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-3 text-gray-400">
      <div className="h-8 w-8 rounded-full border-4 border-gray-200 border-t-navy-500 animate-spin" />
      <p className="text-sm">{text}</p>
    </main>
  )
}
