import { getCookie, setCookie, clearCookie } from '../_shared/cookies'
import { createProxy } from '../_shared/proxy'

interface Env {
  JIRA_CLIENT_SECRET?: string
}

const JIRA_CLIENT_ID_COOKIE = 'jira_client_id'

const baseProxy = createProxy('https://api.atlassian.com', 'jira-api')

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const url = new URL(request.url)
  const path = url.pathname.replace(/^\/jira-api\/?/, '')

  // GET .auth/status
  if (request.method === 'GET' && path === '.auth/status') {
    return handleStatus(request)
  }

  // DELETE .auth/disconnect
  if (request.method === 'DELETE' && path === '.auth/disconnect') {
    return handleDisconnect()
  }

  // GET .auth/health
  if (request.method === 'GET' && path === '.auth/health') {
    return handleHealth(request, env, url)
  }

  // All other paths: inject auth from cookies
  const accessToken = getCookie(request, 'jira_access_token')

  if (!accessToken) {
    // Try refresh
    const refreshToken = getCookie(request, 'jira_refresh_token')
    if (refreshToken && env.JIRA_CLIENT_SECRET) {
      const refreshed = await tryRefresh(refreshToken, env.JIRA_CLIENT_SECRET, request, url)
      if (refreshed) return refreshed.proxy(context)
      // Refresh failed
      return new Response(JSON.stringify({ error: 'Token expired' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Inject Authorization header
  const newHeaders = new Headers(request.headers)
  newHeaders.set('Authorization', `Bearer ${accessToken}`)
  const newRequest = new Request(request.url, {
    method: request.method,
    headers: newHeaders,
    body: request.body,
    redirect: 'manual',
  })

  return baseProxy({ ...context, request: newRequest } as Parameters<PagesFunction>[0])
}

function handleStatus(request: Request): Response {
  const authMethod = getCookie(request, 'jira_auth_method')
  const accountId = getCookie(request, 'jira_account_id')
  const cloudId = getCookie(request, 'jira_cloud_id')
  const siteUrl = getCookie(request, 'jira_site_url')

  const connected = !!authMethod && (!!getCookie(request, 'jira_access_token') ||
    !!getCookie(request, 'jira_refresh_token') ||
    !!getCookie(request, 'jira_api_token'))

  return new Response(
    JSON.stringify({ connected, authMethod, accountId, cloudId, siteUrl }),
    { headers: { 'Content-Type': 'application/json' } },
  )
}

async function handleHealth(request: Request, env: Env, url: URL): Promise<Response> {
  const authMethod = getCookie(request, 'jira_auth_method')
  if (!authMethod) {
    return Response.json({ healthy: false, error: 'Not configured' })
  }

  try {
    if (authMethod === 'token') {
      const email = getCookie(request, 'jira_email')
      const apiToken = getCookie(request, 'jira_api_token')
      const siteUrl = getCookie(request, 'jira_site_url')
      if (!email || !apiToken || !siteUrl) {
        return Response.json({ healthy: false, error: 'Missing token credentials' })
      }
      const basic = btoa(`${email}:${apiToken}`)
      const res = await fetch(`https://${siteUrl}/rest/api/3/myself`, {
        headers: { Authorization: `Basic ${basic}`, Accept: 'application/json' },
      })
      if (res.ok) return Response.json({ healthy: true })
      return Response.json({ healthy: false, error: `Jira API: ${res.status}` })
    }

    // OAuth flow
    let accessToken = getCookie(request, 'jira_access_token')
    if (!accessToken) {
      // Try refresh
      const refreshToken = getCookie(request, 'jira_refresh_token')
      const clientId = getCookie(request, JIRA_CLIENT_ID_COOKIE)
      if (refreshToken && clientId && env.JIRA_CLIENT_SECRET) {
        const refreshRes = await fetch('https://auth.atlassian.com/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            grant_type: 'refresh_token',
            client_id: clientId,
            client_secret: env.JIRA_CLIENT_SECRET,
            refresh_token: refreshToken,
          }),
        })
        if (refreshRes.ok) {
          const data = await refreshRes.json<{
            access_token: string
            refresh_token: string
            expires_in: number
          }>()
          accessToken = data.access_token
          // Update cookies in the health response
          const cookieOpts = { url }
          const headers = new Headers({ 'Content-Type': 'application/json' })
          headers.append(
            'Set-Cookie',
            setCookie('jira_access_token', data.access_token, {
              ...cookieOpts,
              maxAge: data.expires_in,
            }),
          )
          headers.append(
            'Set-Cookie',
            setCookie('jira_refresh_token', data.refresh_token, cookieOpts),
          )
          // Verify with refreshed token
          const meRes = await fetch('https://api.atlassian.com/me', {
            headers: { Authorization: `Bearer ${data.access_token}`, Accept: 'application/json' },
          })
          return new Response(
            JSON.stringify({ healthy: meRes.ok, error: meRes.ok ? undefined : `Jira API: ${meRes.status}` }),
            { headers },
          )
        }
      }
      return Response.json({ healthy: false, error: 'Token expired, refresh failed' })
    }

    const res = await fetch('https://api.atlassian.com/me', {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    })
    if (res.ok) return Response.json({ healthy: true })
    return Response.json({ healthy: false, error: `Jira API: ${res.status}` })
  } catch (e) {
    return Response.json({ healthy: false, error: (e as Error).message })
  }
}

function handleDisconnect(): Response {
  const cookies = [
    clearCookie('jira_access_token'),
    clearCookie('jira_refresh_token'),
    clearCookie('jira_cloud_id'),
    clearCookie('jira_account_id'),
    clearCookie('jira_auth_method'),
    clearCookie('jira_email'),
    clearCookie('jira_api_token'),
    clearCookie('jira_site_url'),
    clearCookie(JIRA_CLIENT_ID_COOKIE),
  ]

  const headers = new Headers({ 'Content-Type': 'application/json' })
  for (const c of cookies) headers.append('Set-Cookie', c)

  return new Response(JSON.stringify({ disconnected: true }), { headers })
}

async function tryRefresh(
  refreshToken: string,
  clientSecret: string,
  request: Request,
  url: URL,
): Promise<{ proxy: PagesFunction } | null> {
  // Read client_id from cookie (set during initial OAuth)
  const clientId = getCookie(request, JIRA_CLIENT_ID_COOKIE)
  if (!clientId) return null

  try {
    const res = await fetch('https://auth.atlassian.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }),
    })

    if (!res.ok) return null

    const data = await res.json<{
      access_token: string
      refresh_token: string
      expires_in: number
    }>()

    const cookieOpts = { url }
    const setCookies = [
      setCookie('jira_access_token', data.access_token, {
        ...cookieOpts,
        maxAge: data.expires_in,
      }),
      setCookie('jira_refresh_token', data.refresh_token, cookieOpts),
    ]

    return {
      proxy: async (context) => {
        const newHeaders = new Headers(context.request.headers)
        newHeaders.set('Authorization', `Bearer ${data.access_token}`)
        const newRequest = new Request(context.request.url, {
          method: context.request.method,
          headers: newHeaders,
          body: context.request.body,
          redirect: 'manual',
        })

        const response = await baseProxy({
          ...context,
          request: newRequest,
        } as Parameters<PagesFunction>[0])

        // Append refresh cookies to the proxy response
        const responseHeaders = new Headers(response.headers)
        for (const c of setCookies) responseHeaders.append('Set-Cookie', c)

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
        })
      },
    }
  } catch {
    return null
  }
}
