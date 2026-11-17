import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import { aiTutorsDevProxy } from './server/ai-tutors/vite-plugin.mjs'

const juxingFile = path.resolve('public/juxing.html')
const SERVER_KEYS = [
  'DEEPSEEK_API_KEY',
  'AI_TUTORS_ENABLED',
  'AI_TUTORS_TIMEOUT_MS',
  'AI_TUTORS_RATE_LIMIT',
  'DEEPSEEK_API_URL',
  'DEEPSEEK_MODEL',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
]

function adoptServerEnv(mode) {
  const env = loadEnv(mode, process.cwd(), '')
  for (const key of SERVER_KEYS) {
    if (process.env[key] == null && env[key] != null) process.env[key] = env[key]
  }
  if (process.env.SUPABASE_URL == null && env.VITE_SUPABASE_URL) {
    process.env.SUPABASE_URL = env.VITE_SUPABASE_URL
  }
  if (process.env.SUPABASE_ANON_KEY == null && env.VITE_SUPABASE_ANON_KEY) {
    process.env.SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  adoptServerEnv(mode)
  return {
    plugins: [
      react(),
      tailwindcss(),
      aiTutorsDevProxy(),
      {
        name: 'serve-juxing-html',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            const url = req.url?.split('?')[0]
            if (url !== '/juxing.html') return next()
            res.setHeader('Content-Type', 'text/html; charset=utf-8')
            fs.createReadStream(juxingFile).pipe(res)
          })
        },
      },
    ],
  }
})
