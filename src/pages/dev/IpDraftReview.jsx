import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import InkSeal from '../../components/student/InkSeal.jsx'
import { AiTutorMascotPair } from '../../components/ai-tutors/AiTutorMascot.jsx'
import IpMark, { IpPair } from '../../components/ai-tutors/ip-drafts/IpMark.jsx'
import { ExpectationTrial, RecognitionTrial } from '../../components/ai-tutors/ip-drafts/ReviewTrials.jsx'
import {
  ACCEPTANCE,
  C_VS_EXISTING,
  DUTY_CARD,
  FAMILY_RULES,
  PEDAGOGY,
  REPLACE_SCOPE,
  REVIEW_ROWS,
  ROLLBACK,
  VERSION_CLAIMS,
} from '../../components/ai-tutors/ip-drafts/reviewCopy.js'
import { IP_ROLES, IP_VERSIONS } from '../../components/ai-tutors/ip-drafts/tokens.js'
import '../../components/ai-tutors/ip-drafts/ip-drafts.css'

function Frame({ size, children, caption }) {
  return (
    <figure className="flex flex-col items-center gap-2">
      <div className={`ip-drafts-mark ip-drafts-mark--${size} ring-[0.5px] ring-gold/80`}>{children}</div>
      {caption ? <figcaption className="text-xs tracking-wide text-ink/50">{caption}</figcaption> : null}
    </figure>
  )
}

function QuestionCard({ version, hideNames }) {
  const sample = PEDAGOGY[0]
  const jianwei = hideNames ? '角色甲' : IP_ROLES.jianwei.name
  const zhizhu = hideNames ? '角色乙' : IP_ROLES.zhizhu.name
  return (
    <article className="rounded-lg bg-white px-4 py-4">
      <p className="text-xs tracking-[0.16em] text-ink/45">
        {sample.course} · {sample.type}
      </p>
      <p className="mt-2 text-base">{sample.stem}</p>
      <ul className="mt-2 space-y-1 text-sm text-ink/70">
        {sample.options.map((option) => (
          <li key={option}>{option}</li>
        ))}
      </ul>
      <p className="mt-2 text-sm">学生作答：{sample.mine}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="ip-drafts-chip">
          <IpMark version={version} role="jianwei" detail="avatar" className="h-11 w-11" />
          <div>
            <strong>{hideNames ? '入口一' : IP_ROLES.jianwei.entry}</strong>
            <span>{jianwei}：{IP_ROLES.jianwei.motion}</span>
          </div>
        </div>
        <div className="ip-drafts-chip">
          <IpMark version={version} role="zhizhu" detail="avatar" className="h-11 w-11" />
          <div>
            <strong>{hideNames ? '入口二' : IP_ROLES.zhizhu.entry}</strong>
            <span>{zhizhu}：{IP_ROLES.zhizhu.motion}</span>
          </div>
        </div>
      </div>
    </article>
  )
}

function VersionBoard({ version, hideNames }) {
  const meta = IP_VERSIONS.find((item) => item.id === version)
  const claim = VERSION_CLAIMS[version]
  return (
    <article className="space-y-6 rounded-lg border-[0.5px] border-gold bg-white/70 p-4 sm:p-5">
      <header className="space-y-1">
        <h3 className="font-serif text-xl">{hideNames ? `方案 ${version.toUpperCase()}` : meta.name}</h3>
        <p className="text-sm text-ink/60">{meta.focus}</p>
        <p className="text-sm text-ink/70">见微：{claim.jianwei}</p>
        <p className="text-sm text-ink/70">知著：{claim.zhizhu}</p>
      </header>

      <div className="flex flex-wrap items-end justify-center gap-8 py-2">
        <Frame size="256" caption="256px 见微">
          <IpMark version={version} role="jianwei" detail="hero" labeled={!hideNames} />
        </Frame>
        <Frame size="256" caption="256px 知著">
          <IpMark version={version} role="zhizhu" detail="hero" labeled={!hideNames} />
        </Frame>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-xs tracking-[0.16em] text-ink/45">与 Logo 并排</p>
          <div className="flex items-end gap-4">
            <InkSeal className="h-24 w-24" />
            <IpPair version={version} detail="avatar" />
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs tracking-[0.16em] text-ink/45">96px 彩色</p>
          <div className="flex items-end gap-3">
            <Frame size="96" caption={hideNames ? '甲' : '见微'}>
              <IpMark version={version} role="jianwei" detail="avatar" />
            </Frame>
            <Frame size="96" caption={hideNames ? '乙' : '知著'}>
              <IpMark version={version} role="zhizhu" detail="avatar" />
            </Frame>
          </div>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-xs tracking-[0.16em] text-ink/45">32px 灰度（去渐变，保留朱砂）</p>
          <div className="flex items-end gap-4">
            <Frame size="32" caption={hideNames ? '甲' : '见微'}>
              <IpMark version={version} role="jianwei" mode="gray" detail="icon" />
            </Frame>
            <Frame size="32" caption={hideNames ? '乙' : '知著'}>
              <IpMark version={version} role="zhizhu" mode="gray" detail="icon" />
            </Frame>
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs tracking-[0.16em] text-ink/45">32px 单色剪影 + 一点朱砂</p>
          <div className="flex items-end gap-4">
            <Frame size="32" caption={hideNames ? '甲' : '见微'}>
              <IpMark version={version} role="jianwei" mode="silhouette" detail="icon" />
            </Frame>
            <Frame size="32" caption={hideNames ? '乙' : '知著'}>
              <IpMark version={version} role="zhizhu" mode="silhouette" detail="icon" />
            </Frame>
          </div>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs tracking-[0.16em] text-ink/45">同一道语文题上的入口</p>
        <QuestionCard version={version} hideNames={hideNames} />
      </div>
    </article>
  )
}

export default function IpDraftReview() {
  const [hideNames, setHideNames] = useState(false)
  if (!import.meta.env.DEV) return <Navigate to="/" replace />

  return (
    <div className="ip-drafts min-h-screen px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-10">
        <header className="space-y-3">
          <p className="text-sm tracking-[0.2em] text-ink/45">仅开发环境可见 · 评审通过前不接入产品</p>
          <h1 className="font-serif text-3xl">见微 / 知著 三版出稿</h1>
          <p className="max-w-3xl text-sm leading-relaxed text-ink/70">
            粉色见微负责拆细节，蓝色知著负责往下问。三版共用 Logo 的同心圆、飞白和朱砂。
            本页只供同屏评审；错题回看里的默认头像仍是旧稿。Cursor 只汇总材料，不代填通过或不通过。
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/dev/ai-tutors" className="text-sm underline decoration-gold underline-offset-4">
              现有讲解界面预览
            </Link>
            <button
              type="button"
              className="rounded-md border-[0.5px] border-gold bg-white px-3 py-1.5 text-sm"
              onClick={() => setHideNames((value) => !value)}
            >
              {hideNames ? '显示角色名' : '遮住名字做辨识测试'}
            </button>
          </div>
        </header>

        <section className="space-y-3">
          <h2 className="font-serif text-2xl">形象-职责对照卡</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {DUTY_CARD.map((item) => (
              <article key={item.role} className="rounded-lg border-[0.5px] border-gold bg-white/80 p-4">
                <p className="text-xs tracking-[0.16em] text-ink/45">{item.motion}</p>
                <h3 className="mt-1 font-serif text-xl">{item.name}</h3>
                <p className="mt-2 text-sm leading-relaxed">{item.shape}</p>
                <p className="mt-1 text-sm text-ink/70">朱砂：{item.cinnabar}</p>
                <p className="mt-3 text-sm">做：{item.does}</p>
                <p className="mt-1 text-sm text-ink/60">不做：{item.doesNot}</p>
              </article>
            ))}
          </div>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink/70">
            {FAMILY_RULES.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="font-serif text-2xl">量化验收口径</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink/75">
            <li>{ACCEPTANCE.testers}</li>
            <li>{ACCEPTANCE.timing}</li>
            <li>{ACCEPTANCE.order}</li>
            <li>{ACCEPTANCE.sil32}</li>
            <li>{ACCEPTANCE.color96}</li>
            <li>{ACCEPTANCE.family}</li>
            <li>{ACCEPTANCE.anti}</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="font-serif text-2xl">三版同屏</h2>
          <div className="ip-drafts-strip rounded-lg border-[0.5px] border-gold bg-white/70 p-4">
            {IP_VERSIONS.map((item) => (
              <figure key={item.id} className="flex flex-col items-center gap-2">
                <IpPair version={item.id} detail="avatar" />
                <figcaption className="text-xs tracking-wide text-ink/50">
                  {hideNames ? `方案 ${item.id.toUpperCase()}` : item.name}
                </figcaption>
              </figure>
            ))}
          </div>
          <div className="ip-drafts-board">
            {IP_VERSIONS.map((item) => (
              <VersionBoard key={item.id} version={item.id} hideNames={hideNames} />
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="font-serif text-2xl">同一错题 · 三版入口</h2>
          <p className="text-sm text-ink/60">
            交互把三版放进同一道语文题。文案固定为「让见微拆开讲」「跟知著想一想」。
          </p>
          <div className="grid gap-4 lg:grid-cols-3">
            {IP_VERSIONS.map((item) => (
              <div key={item.id} className="space-y-2">
                <p className="text-xs tracking-[0.16em] text-ink/45">
                  {hideNames ? `方案 ${item.id.toUpperCase()}` : item.name}
                </p>
                <QuestionCard version={item.id} hideNames={hideNames} />
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="font-serif text-2xl">试次记录</h2>
          <RecognitionTrial />
          <ExpectationTrial />
        </section>

        <section className="space-y-3">
          <h2 className="font-serif text-2xl">C 版与现有 SVG</h2>
          <p className="text-sm leading-relaxed text-ink/70">{C_VS_EXISTING.question}</p>
          <div className="flex flex-wrap items-end gap-8 rounded-lg border-[0.5px] border-gold bg-white/80 p-4">
            <figure className="space-y-2">
              <p className="text-xs tracking-[0.16em] text-ink/45">现有吉祥物</p>
              <AiTutorMascotPair />
            </figure>
            <figure className="space-y-2">
              <p className="text-xs tracking-[0.16em] text-ink/45">C 印章徽记</p>
              <IpPair version="c" detail="avatar" />
            </figure>
            <figure className="space-y-2">
              <p className="text-xs tracking-[0.16em] text-ink/45">产品 Logo</p>
              <InkSeal className="h-16 w-16" />
            </figure>
          </div>
          <p className="text-sm text-ink/60">选项：{C_VS_EXISTING.options.join('  /  ')}</p>
        </section>

        <section className="space-y-3">
          <h2 className="font-serif text-2xl">跨课程样例（教研）</h2>
          <p className="text-sm text-ink/60">三角色职责固定。知著首轮只给线索；开放题最容易失守，故列入。</p>
          <div className="space-y-4">
            {PEDAGOGY.map((item) => (
              <article key={item.course} className="rounded-lg border-[0.5px] border-gold bg-white/80 p-4">
                <p className="text-xs tracking-[0.16em] text-ink/45">
                  {item.course} · {item.type}
                </p>
                <p className="mt-2 text-base">{item.stem}</p>
                {item.options.length > 0 && (
                  <ul className="mt-2 space-y-1 text-sm text-ink/70">
                    {item.options.map((option) => (
                      <li key={option}>{option}</li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 text-sm">学生作答：{item.mine}</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="font-serif">见微 · 首轮</p>
                    <p className="mt-1 text-sm leading-relaxed text-ink/80">{item.jianwei}</p>
                  </div>
                  <div>
                    <p className="font-serif">知著 · 首轮</p>
                    <p className="mt-1 text-sm leading-relaxed text-ink/80">{item.zhizhu}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="font-serif text-2xl">若定稿后的替换范围</h2>
          <table>
            <thead>
              <tr>
                <th>表面</th>
                <th>现在</th>
                <th>定稿后</th>
                <th>回滚</th>
              </tr>
            </thead>
            <tbody>
              {REPLACE_SCOPE.map((row) => (
                <tr key={row.surface}>
                  <td>{row.surface}</td>
                  <td>{row.now}</td>
                  <td>{row.after}</td>
                  <td>{row.rollback}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink/70">
            {ROLLBACK.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="font-serif text-2xl">评审记录（三方各签一行）</h2>
          <p className="text-sm text-ink/60">
            Cursor 不裁结论。每项需附证据：32px 灰度截图、试用者口述、跨课程样例。接入前把本表与选定方案写入 PR。
          </p>
          <table>
            <thead>
              <tr>
                <th>项目</th>
                <th>A</th>
                <th>B</th>
                <th>C</th>
                <th>证据</th>
              </tr>
            </thead>
            <tbody>
              {REVIEW_ROWS.map((row) => (
                <tr key={row.id}>
                  <td>{row.label}</td>
                  <td />
                  <td />
                  <td />
                  <td />
                </tr>
              ))}
            </tbody>
          </table>
          <div className="grid gap-4 pt-2 sm:grid-cols-3">
            {['视觉', '交互', '教研'].map((team) => (
              <p key={team} className="text-sm">
                {team}签字
                <span className="ip-drafts-sign ml-2 inline-block align-bottom" />
              </p>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
