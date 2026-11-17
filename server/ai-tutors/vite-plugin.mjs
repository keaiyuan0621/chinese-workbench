import { handleTutorRequest } from './handler.mjs'

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let bytes = 0
    req.on('data', (chunk) => {
      bytes += chunk.length
      if (bytes > 32768) { reject(Object.assign(new Error('too large'), { status: 413 })); return }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function isTutorPath(url) {
  const path = String(url ?? '').split('?')[0]
  return path === '/api/tutor' || path === '/.netlify/functions/tutor'
}

export function aiTutorsDevProxy() {
  return {
    name: 'ai-tutors-dev-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!isTutorPath(req.url)) return next()
        try {
          const body = req.method === 'POST' || req.method === 'PUT' ? await readBody(req) : ''
          const event = {
            httpMethod: req.method,
            headers: req.headers,
            body,
            isBase64Encoded: false,
          }
          const result = await handleTutorRequest(event, { allowDevPreview: true })
          res.statusCode = result.statusCode
          for (const [key, value] of Object.entries(result.headers ?? {})) {
            res.setHeader(key, value)
          }
          res.end(result.body ?? '')
        } catch (error) {
          res.statusCode = error?.status === 413 ? 413 : 500
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ ok: false, error: 'upstream', message: '讲解服务暂时不可用，请稍后重试' }))
        }
      })
    },
  }
}
