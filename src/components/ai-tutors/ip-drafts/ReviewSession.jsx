import { useState } from 'react'
import { PEDAGOGY } from './reviewCopy.js'
import { IP_ROLES, IP_VERSIONS } from './tokens.js'
import IpMark from './IpMark.jsx'

function EntryButton({ version, role, hideNames, onOpen, active }) {
  const meta = IP_ROLES[role]
  return (
    <button
      type="button"
      className={`ip-drafts-entry ip-drafts-entry--${role}${active ? ' is-on' : ''}`}
      onClick={onOpen}
    >
      <IpMark version={version} role={role} detail="avatar" className="h-11 w-11" />
      <span>
        <strong>{hideNames ? (role === 'jianwei' ? '入口一' : '入口二') : meta.entry}</strong>
        <em>{hideNames ? meta.motion : `${meta.name}：${meta.motion}`}</em>
      </span>
    </button>
  )
}

export default function ReviewSession({ version, hideNames, onVersionChange }) {
  const [courseIndex, setCourseIndex] = useState(0)
  const [openRole, setOpenRole] = useState(null)
  const sample = PEDAGOGY[courseIndex]

  function switchCourse(index) {
    setCourseIndex(index)
    setOpenRole(null)
  }

  function switchVersion(id) {
    onVersionChange?.(id)
    setOpenRole(null)
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {IP_VERSIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`ip-drafts-pill${version === item.id ? ' is-on' : ''}`}
            onClick={() => switchVersion(item.id)}
          >
            {hideNames ? `方案 ${item.id.toUpperCase()}` : item.name}
          </button>
        ))}
      </div>
      <p className="text-sm text-ink/60">
        同一张试卷回顾。三版只换头像，题目和入口文案不变。点击入口只展示首轮样例，不调用接口。
      </p>
      <div className="flex flex-wrap gap-2">
        {PEDAGOGY.map((item, index) => (
          <button
            key={item.course}
            type="button"
            className={`ip-drafts-pill${courseIndex === index ? ' is-on' : ''}`}
            onClick={() => switchCourse(index)}
          >
            {item.course}
          </button>
        ))}
      </div>

      <article className="rounded-student bg-white px-4 py-5 sm:px-5">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-ink">第 {courseIndex + 1} 题</span>
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-500">{sample.type}</span>
          <span className="rounded-full bg-coral-100 px-2.5 py-1 font-medium text-coral-600">答错</span>
        </div>
        <p className="mt-3 whitespace-pre-wrap text-base leading-relaxed text-gray-800">{sample.stem}</p>
        {sample.options.length > 0 && (
          <ul className="mt-3 space-y-2 text-sm text-gray-600">
            {sample.options.map((option) => (
              <li key={option}>{option}</li>
            ))}
          </ul>
        )}
        <div className="mt-4 space-y-3 text-sm leading-relaxed">
          <p className="text-gray-800">
            <span className="font-semibold">我的作答：</span>
            {sample.mine}
          </p>
          <p className="text-gray-800">
            <span className="font-semibold">正确答案：</span>
            {sample.answer}
          </p>
          <p className="whitespace-pre-wrap text-gray-700">
            <span className="font-semibold text-gray-800">解析：</span>
            {sample.explanation}
          </p>
        </div>

        <div className="ip-drafts-entries mt-4">
          <EntryButton
            version={version}
            role="jianwei"
            hideNames={hideNames}
            active={openRole === 'jianwei'}
            onOpen={() => setOpenRole('jianwei')}
          />
          <EntryButton
            version={version}
            role="zhizhu"
            hideNames={hideNames}
            active={openRole === 'zhizhu'}
            onOpen={() => setOpenRole('zhizhu')}
          />
        </div>

        {openRole ? (
          <div className={`ip-drafts-reply ip-drafts-reply--${openRole}`}>
            <p className="font-serif">
              {openRole === 'jianwei' ? '见微 · 首轮' : '知著 · 首轮'}
              {openRole === 'zhizhu' ? '（线索，不是答案）' : ''}
            </p>
            <p className="mt-2 text-sm leading-relaxed">{sample[openRole]}</p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-ink/50">点击前先说出两个入口分别会提供什么帮助。</p>
        )}
      </article>
    </section>
  )
}
