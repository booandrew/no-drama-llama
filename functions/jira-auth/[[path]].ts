import { createProxy } from '../_shared/proxy'

interface Env {
  JIRA_CLIENT_SECRET?: string
}

const baseProxy = createProxy('https://auth.atlassian.com', 'jira-auth')

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const url = new URL(request.url)

  // Inject client_secret for T1A token exchange
  if (
    request.method === 'POST' &&
    url.pathname === '/jira-auth/oauth/token' &&
    env.JIRA_CLIENT_SECRET
  ) {
    try {
      const body = await request.json<Record<string, string>>()
      // Only inject if no client_secret already present
      if (!body.client_secret) {
        body.client_secret = env.JIRA_CLIENT_SECRET
      }

      const targetUrl = new URL('/oauth/token', 'https://auth.atlassian.com')
      const proxyReq = new Request(targetUrl.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const response = await fetch(proxyReq)
      const responseHeaders = new Headers(response.headers)
      responseHeaders.delete('set-cookie')

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      })
    } catch {
      // Fall through to base proxy on parse error
    }
  }

  return baseProxy(context)
}
