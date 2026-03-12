import { getCookie, setCookie } from '../_shared/cookies'

interface Env {
  GOOGLE_CLIENT_SECRET?: string
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const url = new URL(request.url)

  // POST /gcal-auth/oauth/token — exchange code or refresh, set cookies
  if (request.method === 'POST' && url.pathname === '/gcal-auth/oauth/token') {
    return handleOAuthToken(request, env, url)
  }

  return new Response('Not found', { status: 404 })
}

async function handleOAuthToken(request: Request, env: Env, url: URL): Promise<Response> {
  try {
    const body = await request.json<{
      grant_type: string
      code?: string
      client_id?: string
      redirect_uri?: string
      client_secret?: string
      refresh_token?: string
    }>()

    // Resolve secret: body (first connect personal) > cookie (re-connect personal) > env (org)
    const clientSecret =
      body.client_secret || getCookie(request, 'gcal_client_secret') || env.GOOGLE_CLIENT_SECRET
    if (!clientSecret) {
      return new Response('Server misconfigured: missing GOOGLE_CLIENT_SECRET', { status: 500 })
    }

    // Google uses application/x-www-form-urlencoded (not JSON)
    const params = new URLSearchParams()
    params.set('grant_type', body.grant_type)
    params.set('client_id', body.client_id ?? '')
    params.set('client_secret', clientSecret)
    if (body.code) params.set('code', body.code)
    if (body.redirect_uri) params.set('redirect_uri', body.redirect_uri)
    if (body.refresh_token) params.set('refresh_token', body.refresh_token)

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })

    if (!tokenRes.ok) {
      const text = await tokenRes.text()
      return new Response(text, {
        status: tokenRes.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const tokenData = await tokenRes.json<{
      access_token: string
      refresh_token?: string
      expires_in: number
    }>()

    const cookieOpts = { url }
    const headers = new Headers({ 'Content-Type': 'application/json' })

    // Always set access token
    headers.append(
      'Set-Cookie',
      setCookie('gcal_access_token', tokenData.access_token, {
        ...cookieOpts,
        maxAge: tokenData.expires_in || 3600,
      }),
    )

    // Set refresh token only on initial auth (Google doesn't return it on refresh)
    if (tokenData.refresh_token) {
      headers.append(
        'Set-Cookie',
        setCookie('gcal_refresh_token', tokenData.refresh_token, cookieOpts),
      )
    }

    // Store client_id for later refresh requests
    if (body.client_id) {
      headers.append(
        'Set-Cookie',
        setCookie('gcal_client_id', body.client_id, cookieOpts),
      )
    }

    // Store client_secret for personal flow (server needs it for refresh)
    if (body.client_secret) {
      headers.append(
        'Set-Cookie',
        setCookie('gcal_client_secret', body.client_secret, cookieOpts),
      )
    }

    // Determine auth method
    const authMethod = body.client_secret ? 'personal' : 'org'
    headers.append(
      'Set-Cookie',
      setCookie('gcal_auth_method', authMethod, cookieOpts),
    )

    return new Response(
      JSON.stringify({ connected: true, authMethod }),
      { headers },
    )
  } catch (e) {
    return new Response(`Token exchange error: ${(e as Error).message}`, { status: 500 })
  }
}
