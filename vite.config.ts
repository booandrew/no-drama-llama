import path from "path"
import http from "node:http"
import https from "node:https"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react-swc"
import { defineConfig, type Plugin } from "vite"

function jiraSiteProxy(): Plugin {
  return {
    name: 'jira-site-proxy',
    configureServer(server) {
      server.middlewares.use('/jira-site', (req, res) => {
        const host = req.headers['x-jira-host'] as string | undefined
        if (!host) {
          res.writeHead(400, { 'Content-Type': 'text/plain' })
          res.end('Missing X-Jira-Host header')
          return
        }

        const targetPath = req.url ?? '/'
        const proxyReq = https.request(
          {
            hostname: host,
            port: 443,
            path: targetPath,
            method: req.method,
            headers: {
              ...req.headers,
              host,
              'x-jira-host': undefined,
            } as http.OutgoingHttpHeaders,
          },
          (proxyRes) => {
            res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers)
            proxyRes.pipe(res)
          },
        )

        proxyReq.on('error', (err) => {
          console.error('[jira-site-proxy]', err.message)
          if (!res.headersSent) {
            res.writeHead(502, { 'Content-Type': 'text/plain' })
            res.end(`Proxy error: ${err.message}`)
          }
        })

        req.pipe(proxyReq)
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), jiraSiteProxy()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    exclude: ['@duckdb/duckdb-wasm'],
  },
  server: {
    proxy: {
      '/jira-api': {
        target: 'https://api.atlassian.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/jira-api/, ''),
      },
      '/jira-auth': {
        target: 'https://auth.atlassian.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/jira-auth/, ''),
      },
      '/tempo-api': {
        target: 'https://api.tempo.io',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/tempo-api/, ''),
      },
    },
  },
})
