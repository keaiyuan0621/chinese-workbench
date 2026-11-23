import { Link, Navigate } from 'react-router-dom'
import AiTutorPanel from '../../components/ai-tutors/AiTutorPanel.jsx'
import { formatStudentAnswer } from '../../lib/practice.js'

const SAMPLES = [
  {
    id: 'preview-phoneme',
    type: '单选',
    stem: '下列关于音位的表述，正确的一项是？',
    options: [
      { key: 'A', text: '音位是具体的语音，可以直接听见' },
      { key: 'B', text: '音位是从语音中归纳出来的、具有区别意义作用的最小语音单位' },
      { key: 'C', text: '音位等于音素，二者没有分别' },
      { key: 'D', text: '音位没有辨义作用' },
    ],
    answer: 'B',
    explanation:
      '音位是音系学概念，从具体音素中归纳而来，其作用是区别意义。音素是语音的最小单位；音位是能区别意义的最小语音单位。',
    student_answer: 'C',
  },
  {
    id: 'preview-subject',
    type: '简答',
    stem: '请说明主语和施事的区别，并各举一例。',
    options: [],
    answer: '',
    reference_answer:
      '主语是句法成分，施事是语义角色。主语可以由施事充当，也可以由受事、工具等充当。例如「小王打球」里「小王」既是主语也是施事；「球打破了」里「球」是主语，却是受事。',
    explanation:
      '答题时先把句法和语义两套术语分开，再各举能对得上的例子。不要把「主语」直接说成「发出动作的人」。',
    student_answer: '主语就是发出动作的人，比如小王打球。',
  },
]

export default function AiTutorsPreview() {
  if (!import.meta.env.DEV) return <Navigate to="/" replace />

  return (
    <div className="min-h-screen bg-paper px-4 py-8 text-ink sm:px-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-2">
          <p className="text-sm tracking-[0.2em] text-ink/50">仅开发环境可见</p>
          <h1 className="text-2xl">见微 / 知著 界面预览</h1>
          <p className="text-sm leading-relaxed text-gray-600">
            这两道是示例题，用来看双角色入口、切换、提问、加载和失败重试。不必登录学生账户。
            生产鉴权不会被绕过；若本机已注入服务端密钥，这里可以打到真实接口，否则会诚实提示未配置。
          </p>
          <p className="text-sm">
            <Link to="/dev/ip-drafts" className="underline decoration-gold underline-offset-4">
              见微 / 知著三版形象评审
            </Link>
          </p>
        </header>

        <ol className="space-y-4">
          {SAMPLES.map((question, index) => {
            const mine = formatStudentAnswer(question, question.student_answer)
            return (
              <li key={question.id} className="rounded-student bg-white px-4 py-5 sm:px-5">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold text-ink">示例第 {index + 1} 题</span>
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-500">{question.type}</span>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-base leading-relaxed text-gray-800">{question.stem}</p>
                {question.options.length > 0 && (
                  <ul className="mt-3 space-y-2 text-sm text-gray-600">
                    {question.options.map((option) => (
                      <li key={option.key}>
                        <span className="font-semibold text-gray-800">{option.key}.</span> {option.text}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-4 space-y-3 text-sm leading-relaxed">
                  <p className="text-gray-800">
                    <span className="font-semibold">我的作答：</span>
                    {mine || '未作答'}
                  </p>
                  <p className="whitespace-pre-wrap text-gray-700">
                    <span className="font-semibold text-gray-800">解析：</span>
                    {question.explanation}
                  </p>
                </div>
                <AiTutorPanel
                  preview
                  question={question}
                  studentAnswer={mine}
                  originalExplanation={question.explanation}
                />
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
