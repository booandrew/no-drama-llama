import path from "path"
import http from "node:http"
import https from "node:https"
import { loadEnv } from "vite"
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

function jiraAuthSecretInjector(): Plugin {
  let clientSecret: string | undefined

  return {
    name: 'jira-auth-secret-injector',
    configResolved(config) {
      // Load all env vars (including non-VITE_ prefixed) from .env.local
      const env = loadEnv(config.mode, config.root, '')
      clientSecret = env.JIRA_CLIENT_SECRET
      if (!clientSecret) {
        console.warn('[jira-auth] JIRA_CLIENT_SECRET not set — T1A token exchange will fail')
      }
    },
    configureServer(server) {
      // Intercept POST /jira-auth/oauth/token to inject client_secret for T1A flow
      server.middlewares.use('/jira-auth/oauth/token', (req, res, next) => {
        if (req.method !== 'POST' || !clientSecret) {
          next()
          return
        }

        let body = ''
        req.on('data', (chunk: Buffer) => { body += chunk.toString() })
        req.on('end', () => {
          try {
            const parsed = JSON.parse(body)
            // Only inject if no client_secret already present
            if (!parsed.client_secret) {
              parsed.client_secret = clientSecret
            }
            const newBody = JSON.stringify(parsed)

            // Forward to Atlassian auth server
            const proxyReq = https.request(
              {
                hostname: 'auth.atlassian.com',
                path: '/oauth/token',
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Content-Length': Buffer.byteLength(newBody),
                },
              },
              (proxyRes) => {
                res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers)
                proxyRes.pipe(res)
              },
            )
            proxyReq.on('error', (err) => {
              console.error('[jira-auth-secret-injector]', err.message)
              if (!res.headersSent) {
                res.writeHead(502, { 'Content-Type': 'text/plain' })
                res.end(`Proxy error: ${err.message}`)
              }
            })
            proxyReq.end(newBody)
          } catch {
            next()
          }
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), jiraSiteProxy(), jiraAuthSecretInjector()],
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
