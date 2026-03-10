import { getCookie, setCookie, clearCookie } from '../_shared/cookies'
import { createProxy } from '../_shared/proxy'

const baseProxy = createProxy('https://www.googleapis.com', 'gcal-api')

export const onRequest: PagesFunction = async (context) => {
  const { request } = context
  const url = new URL(request.url)
  const path = url.pathname.replace(/^\/gcal-api\/?/, '')

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

  // All other paths: inject auth from cookies
  const accessToken = getCookie(request, 'gcal_access_token')
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
    const { accessToken, expiresIn, authMethod } = await request.json<{
      accessToken: string
      expiresIn: number
      authMethod: string
    }>()

    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'Missing accessToken' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const cookieOpts = { url }
    const headers = new Headers({ 'Content-Type': 'application/json' })
    headers.append(
      'Set-Cookie',
      setCookie('gcal_access_token', accessToken, {
        ...cookieOpts,
        maxAge: expiresIn || 3600,
      }),
    )
    headers.append(
      'Set-Cookie',
      setCookie('gcal_auth_method', authMethod || 'org', cookieOpts),
    )

    return new Response(JSON.stringify({ connected: true }), { headers })
  } catch (e) {
    return new Response(`Connect error: ${(e as Error).message}`, { status: 500 })
  }
}

function handleStatus(request: Request): Response {
  const connected = !!getCookie(request, 'gcal_access_token')
  const authMethod = getCookie(request, 'gcal_auth_method')
  return new Response(
    JSON.stringify({ connected, authMethod }),
    { headers: { 'Content-Type': 'application/json' } },
  )
}

function handleDisconnect(): Response {
  const headers = new Headers({ 'Content-Type': 'application/json' })
  headers.append('Set-Cookie', clearCookie('gcal_access_token'))
  headers.append('Set-Cookie', clearCookie('gcal_auth_method'))
  return new Response(JSON.stringify({ disconnected: true }), { headers })
}
