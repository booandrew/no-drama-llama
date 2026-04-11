import { getCookie, setCookie, clearCookie } from '../_shared/cookies'
import { createProxy } from '../_shared/proxy'

const baseProxy = createProxy('https://api.tempo.io', 'tempo-api')

type TempoValidationCode =
  | 'ok'
  | 'missing_scope'
  | 'expired'
  | 'invalid'
  | 'probe_failed'

interface TempoValidationResult {
  ok: boolean
  code: TempoValidationCode
  message?: string
  missingScopes?: string[]
  capabilities: {
    userSchedule: boolean
    worklogs: boolean
  }
}

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

    const validation = await validateTempoToken(token)
    if (!validation.ok) {
      return new Response(
        JSON.stringify({
          error: validation.message ?? 'Tempo token validation failed',
          code: validation.code,
          missingScopes: validation.missingScopes ?? [],
          capabilities: validation.capabilities,
        }),
        {
          status: validation.code === 'expired' || validation.code === 'invalid' ? 401 : 403,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    const headers = new Headers({ 'Content-Type': 'application/json' })
    headers.append('Set-Cookie', setCookie('tempo_access_token', token, { url }))

    return new Response(
      JSON.stringify({
        connected: true,
        capabilities: validation.capabilities,
      }),
      { headers },
    )
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
    return Response.json({
      healthy: false,
      code: 'invalid',
      error: 'No Tempo token stored',
      capabilities: { userSchedule: false, worklogs: false },
    })
  }
  try {
    const validation = await validateTempoToken(accessToken)
    return Response.json({
      healthy: validation.ok,
      code: validation.code,
      error: validation.message,
      missingScopes: validation.missingScopes ?? [],
      capabilities: validation.capabilities,
    })
  } catch (e) {
    return Response.json({
      healthy: false,
      code: 'probe_failed',
      error: (e as Error).message,
      capabilities: { userSchedule: false, worklogs: false },
    })
  }
}

function handleDisconnect(): Response {
  const headers = new Headers({ 'Content-Type': 'application/json' })
  headers.append('Set-Cookie', clearCookie('tempo_access_token'))
  return new Response(JSON.stringify({ disconnected: true }), { headers })
}

async function validateTempoToken(accessToken: string): Promise<TempoValidationResult> {
  const today = new Date().toISOString().slice(0, 10)
  const headers = { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' }

  const [scheduleRes, workAttrsRes] = await Promise.all([
    fetch(`https://api.tempo.io/4/user-schedule?from=${today}&to=${today}`, { headers }),
    fetch('https://api.tempo.io/4/work-attributes', { headers }),
  ])

  if (scheduleRes.status === 401 || workAttrsRes.status === 401) {
    return {
      ok: false,
      code: 'expired',
      message: 'Tempo token is invalid, expired, or revoked.',
      capabilities: { userSchedule: false, worklogs: false },
    }
  }

  const capabilities = {
    userSchedule: scheduleRes.ok,
    worklogs: workAttrsRes.ok,
  }

  const missingScopes: string[] = []
  if (scheduleRes.status === 403) missingScopes.push('Schemes (View)')
  if (workAttrsRes.status === 403) missingScopes.push('Worklogs (View)')

  if (missingScopes.length > 0) {
    return {
      ok: false,
      code: 'missing_scope',
      message:
        `Tempo token is missing required scope${missingScopes.length > 1 ? 's' : ''}: ` +
        missingScopes.join(', '),
      missingScopes,
      capabilities,
    }
  }

  if (scheduleRes.ok && workAttrsRes.ok) {
    return { ok: true, code: 'ok', capabilities }
  }

  return {
    ok: false,
    code: 'probe_failed',
    message: `Tempo validation failed (${scheduleRes.status}/${workAttrsRes.status})`,
    capabilities,
  }
}
