import { defineConfig, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// Dev-only CORS proxy for provider asset CDNs (Seedance TOS bucket, Veo
// media URIs, Kling temporary hosts). The browser refuses these direct
// fetches because the buckets don't return Access-Control-Allow-Origin.
// Mirrors PROXIED_HOSTS in src/providers/cors_proxy.ts — keep in sync.
const PROXY_ALLOWED_SUFFIXES = [
  'volces.com',
  'googleusercontent.com',
  'googleapis.com',
  'klingai.com',
]

const corsProxyPlugin = {
  name: 'pf-cors-proxy',
  configureServer(server: ViteDevServer) {
    server.middlewares.use('/cors-proxy', async (req, res) => {
      try {
        const target = new URL(req.url ?? '', 'http://localhost').searchParams.get('url')
        if (!target) { res.statusCode = 400; res.end('missing url'); return }
        let host = ''
        try { host = new URL(target).hostname } catch { res.statusCode = 400; res.end('invalid url'); return }
        if (!PROXY_ALLOWED_SUFFIXES.some(s => host === s || host.endsWith('.' + s))) {
          res.statusCode = 403; res.end('host not allowed'); return
        }
        const upstream = await fetch(target, { redirect: 'follow' })
        res.statusCode = upstream.status
        upstream.headers.forEach((v, k) => {
          if (['transfer-encoding', 'content-encoding', 'connection'].includes(k.toLowerCase())) return
          res.setHeader(k, v)
        })
        res.setHeader('access-control-allow-origin', '*')
        res.end(Buffer.from(await upstream.arrayBuffer()))
      } catch (err) {
        res.statusCode = 502
        res.end(`cors-proxy: ${err instanceof Error ? err.message : String(err)}`)
      }
    })
  },
}

export default defineConfig({
  plugins: [react(), tailwindcss(), corsProxyPlugin],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  server: {
    proxy: {
      '/api/ark': {
        target: 'https://ark.ap-southeast.bytepluses.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/ark/, '/api/v3'),
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
