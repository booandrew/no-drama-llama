import { getCookie, setCookie, clearCookie } from '../_shared/cookies'
import { createProxy } from '../_shared/proxy'

const baseProxy = createProxy('https://api.tempo.io', 'tempo-api')

export const onRequest: PagesFunction = async (context) => {
  const { request } = context
  const url = new URL(request.url)
  const path = url.pathname.replace(/^\/tempo-api\/?/, '')

  // POST .auth/connect
  if (request.method === 'POST' && path === '.auth/connect') {
    return handleConnect(request, url)
  }

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
    return handleHealth(request)
  }

  // All other paths: inject auth from cookies
  const accessToken = getCookie(request, 'tempo_access_token')
  if (!accessToken) {
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

  return baseProxy({ ...context, request: newRequest } as Parameters<PagesFunction>[0])
}

async function handleConnect(request: Request, url: URL): Promise<Response> {
  try {
    const { token } = await request.json<{ token: string }>()
    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing token' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const headers = new Headers({ 'Content-Type': 'application/json' })
    headers.append('Set-Cookie', setCookie('tempo_access_token', token, { url }))

    return new Response(JSON.stringify({ connected: true }), { headers })
  } catch (e) {
    return new Response(`Connect error: ${(e as Error).message}`, { status: 500 })
  }
}

function handleStatus(request: Request): Response {
  const connected = !!getCookie(request, 'tempo_access_token')
  return new Response(
    JSON.stringify({ connected }),
    { headers: { 'Content-Type': 'application/json' } },
  )
}

async function handleHealth(request: Request): Promise<Response> {
  const accessToken = getCookie(request, 'tempo_access_token')
  if (!accessToken) {
    return Response.json({ healthy: false, error: 'No access token' })
  }
  try {
    const res = await fetch('https://api.tempo.io/4/work-attributes', {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    })
    if (res.ok) return Response.json({ healthy: true })
    return Response.json({ healthy: false, error: `Tempo API: ${res.status}` })
  } catch (e) {
    return Response.json({ healthy: false, error: (e as Error).message })
  }
}

function handleDisconnect(): Response {
  const headers = new Headers({ 'Content-Type': 'application/json' })
  headers.append('Set-Cookie', clearCookie('tempo_access_token'))
  return new Response(JSON.stringify({ disconnected: true }), { headers })
}
