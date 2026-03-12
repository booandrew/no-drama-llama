import { getCookie, setCookie, clearCookie } from '../_shared/cookies'
import { createProxy } from '../_shared/proxy'

interface Env {
  GOOGLE_CLIENT_SECRET?: string
}

const baseProxy = createProxy('https://www.googleapis.com', 'gcal-api')

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const url = new URL(request.url)
  const path = url.pathname.replace(/^\/gcal-api\/?/, '')

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
  const accessToken = getCookie(request, 'gcal_access_token')

  if (!accessToken) {
    // Try server-side refresh
    const refreshResult = await tryRefresh(request, env, url)
    if (refreshResult) return refreshResult.proxy(context)

    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const newHeaders = new Headers(request.headers)
  newHeaders.set('Authorization', `Bearer ${accessToken}`)
  const newRequest = new Request(request.url, {
    method: request.method,
    headers: newHeaders,
    body: request.body,
    redirect: 'manual',
  })

  const response = await baseProxy({
    ...context,
    request: newRequest,
  } as Parameters<PagesFunction>[0])

  // Token rejected — try server-side refresh and retry
  if (response.status === 401) {
    const refreshResult = await tryRefresh(request, env, url)
    if (refreshResult) return refreshResult.proxy(context)
  }

  return response
}

function handleStatus(request: Request): Response {
  const connected =
    !!getCookie(request, 'gcal_access_token') || !!getCookie(request, 'gcal_refresh_token')
  const authMethod = getCookie(request, 'gcal_auth_method')
  return new Response(
    JSON.stringify({ connected, authMethod }),
    { headers: { 'Content-Type': 'application/json' } },
  )
}

async function handleHealth(request: Request, env: Env, url: URL): Promise<Response> {
  const accessToken = getCookie(request, 'gcal_access_token')

  // No access token — go straight to refresh
  if (!accessToken) {
    return refreshVerifyAndRespond(request, env, url)
  }

  // Have access token — verify it
  try {
    const res = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary',
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
    if (res.ok) {
      return Response.json({ healthy: true })
    }

    // Token rejected — try refresh
    return refreshVerifyAndRespond(request, env, url)
  } catch (e) {
    return Response.json({ healthy: false, error: (e as Error).message })
  }
}

async function refreshVerifyAndRespond(
  request: Request,
  env: Env,
  url: URL,
): Promise<Response> {
  const refreshResult = await doRefresh(request, env)
  if (!refreshResult) {
    return Response.json({ healthy: false, error: 'Token expired, refresh failed' })
  }

  const res = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary',
    { headers: { Authorization: `Bearer ${refreshResult.accessToken}` } },
  )
  const headers = new Headers({ 'Content-Type': 'application/json' })
  headers.append(
    'Set-Cookie',
    setCookie('gcal_access_token', refreshResult.accessToken, {
      url,
      maxAge: refreshResult.expiresIn,
    }),
  )
  return new Response(
    JSON.stringify({
      healthy: res.ok,
      error: res.ok ? undefined : `Google API: ${res.status}`,
    }),
    { headers },
  )
}

function handleDisconnect(): Response {
  const cookies = [
    clearCookie('gcal_access_token'),
    clearCookie('gcal_refresh_token'),
    clearCookie('gcal_client_id'),
    clearCookie('gcal_client_secret'),
    clearCookie('gcal_auth_method'),
  ]
  const headers = new Headers({ 'Content-Type': 'application/json' })
  for (const c of cookies) headers.append('Set-Cookie', c)
  return new Response(JSON.stringify({ disconnected: true }), { headers })
}

// ── Refresh helpers ──────────────────────────────────────────────────

interface RefreshResult {
  accessToken: string
  expiresIn: number
}

async function doRefresh(request: Request, env: Env): Promise<RefreshResult | null> {
  const refreshToken = getCookie(request, 'gcal_refresh_token')
  const clientId = getCookie(request, 'gcal_client_id')
  if (!refreshToken || !clientId) return null

  // Personal flow stores client_secret in cookie; org flow uses env
  const clientSecret = getCookie(request, 'gcal_client_secret') || env.GOOGLE_CLIENT_SECRET
  if (!clientSecret) return null

  try {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    })

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })

    if (!res.ok) return null

    const data = await res.json<{ access_token: string; expires_in: number }>()
    return { accessToken: data.access_token, expiresIn: data.expires_in }
  } catch {
    return null
  }
}

async function tryRefresh(
  request: Request,
  env: Env,
  url: URL,
): Promise<{ proxy: PagesFunction } | null> {
  const result = await doRefresh(request, env)
  if (!result) return null

  const cookieHeader = setCookie('gcal_access_token', result.accessToken, {
    url,
    maxAge: result.expiresIn,
  })

  return {
    proxy: async (context) => {
      const newHeaders = new Headers(context.request.headers)
      newHeaders.set('Authorization', `Bearer ${result.accessToken}`)
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

      // Append refresh cookie to the proxy response
      const responseHeaders = new Headers(response.headers)
      responseHeaders.append('Set-Cookie', cookieHeader)

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      })
    },
  }
}
