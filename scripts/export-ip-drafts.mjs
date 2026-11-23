import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { renderIpMarkSvg, markFileStem } from '../src/components/ai-tutors/ip-drafts/markSvg.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'src/components/ai-tutors/ip-drafts/assets')
const versions = ['a', 'b', 'c']
const roles = ['jianwei', 'zhizhu']
const modes = ['color', 'gray', 'silhouette']
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

mkdirSync(outDir, { recursive: true })

const files = []
for (const version of versions) {
  for (const role of roles) {
    for (const mode of modes) {
      const uid = `${version}-${role}-${mode}`
      const svg = renderIpMarkSvg({
        version,
        role,
        mode,
        detail: mode === 'color' ? 'hero' : 'icon',
        uid,
        labeled: true,
      })
      const stem = markFileStem(version, role, mode)
      const svgPath = join(outDir, `${stem}.svg`)
      writeFileSync(svgPath, `${svg}\n`)
      files.push({ version, role, mode, stem, svgPath })
    }
  }
}

const sheetCards = files
  .map(
    ({ stem, version, role, mode }) =>
      `<figure><img src="${stem}.svg" width="96" height="96" alt="${stem}"><figcaption>${version.toUpperCase()} ${role} ${mode}</figcaption></figure>`,
  )
  .join('')
writeFileSync(
  join(outDir, 'contact-sheet.html'),
  `<!doctype html><meta charset="utf-8"><title>见微知著三版出稿</title>
<style>
  body{margin:24px;background:#f8f4ec;color:#2c2c2c;font-family:sans-serif}
  h1{font-weight:500}
  .grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:16px}
  figure{margin:0;text-align:center}
  img{width:96px;height:96px;background:#f8f4ec}
  figcaption{margin-top:8px;font-size:12px;letter-spacing:.04em}
</style>
<h1>见微 / 知著 三版出稿</h1>
<p>SVG 源文件与本页同目录。32 / 96 / 256 PNG 由导出脚本栅格化。</p>
<div class="grid">${sheetCards}</div>
`,
)

function rasterWithChrome() {
  if (!existsSync(chrome)) {
    console.log('chrome not found; skipped png raster')
    return 0
  }
  let count = 0
  for (const file of files) {
    const sizes = file.mode === 'color' ? [32, 96, 256] : [32]
    for (const size of sizes) {
      const htmlPath = join(outDir, `${file.stem}-${size}.html`)
      const pngPath = join(outDir, `${file.stem}-${size}.png`)
      writeFileSync(
        htmlPath,
        `<!doctype html><meta charset="utf-8"><style>
          html,body{margin:0;background:#f8f4ec;width:${size}px;height:${size}px;overflow:hidden}
          img{width:${size}px;height:${size}px;display:block}
        </style><img src="${file.stem}.svg" width="${size}" height="${size}" alt="">`,
      )
      const result = spawnSync(
        chrome,
        [
          '--headless=new',
          '--disable-gpu',
          '--hide-scrollbars',
          '--force-device-scale-factor=1',
          `--window-size=${size},${size}`,
          `--screenshot=${pngPath}`,
          pathToFileURL(htmlPath).href,
        ],
        { encoding: 'utf8' },
      )
      if (result.status !== 0) {
        throw new Error(result.stderr || result.stdout || `chrome failed for ${pngPath}`)
      }
      unlinkSync(htmlPath)
      count += 1
    }
  }
  return count
}

const pngCount = rasterWithChrome()
console.log(`wrote ${files.length} svg files and ${pngCount} png files to ${outDir}`)

