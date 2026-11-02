import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'

const juxingFile = path.resolve('public/juxing.html')

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
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
})
