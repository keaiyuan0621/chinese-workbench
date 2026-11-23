import { useId } from 'react'
import { renderIpMarkSvg } from './markSvg.js'

export default function IpMark({
  version = 'a',
  role = 'jianwei',
  mode = 'color',
  detail = 'avatar',
  uid,
  labeled = false,
  className = 'h-24 w-24',
  width,
  height,
}) {
  const reactId = useId().replace(/:/g, '')
  const markup = renderIpMarkSvg({
    version,
    role,
    mode,
    detail,
    uid: uid || `ip-${version}-${role}-${reactId}`,
    labeled,
    width,
    height,
  })
  return <span className={`ip-drafts-svg ${className}`.trim()} dangerouslySetInnerHTML={{ __html: markup }} />
}

export function IpPair({ version = 'a', mode = 'color', detail = 'avatar', className = '' }) {
  return (
    <span className={`ip-drafts-pair ${className}`.trim()}>
      <IpMark version={version} role="jianwei" mode={mode} detail={detail} />
      <IpMark version={version} role="zhizhu" mode={mode} detail={detail} />
    </span>
  )
}
