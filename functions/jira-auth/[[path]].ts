import { setCookie, clearCookie } from '../_shared/cookies'

interface Env {
  JIRA_CLIENT_SECRET?: string
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const url = new URL(request.url)

  // POST /jira-auth/oauth/token — exchange code or refresh, set cookies
  if (request.method === 'POST' && url.pathname === '/jira-auth/oauth/token') {
    return handleOAuthToken(request, env, url)
  }

  // POST /jira-auth/.auth/connect-token — API token flow
  if (request.method === 'POST' && url.pathname === '/jira-auth/.auth/connect-token') {
    return handleConnectToken(request, url)
  }

  return new Response('Not found', { status: 404 })
}

async function handleOAuthToken(request: Request, env: Env, url: URL): Promise<Response> {
  if (!env.JIRA_CLIENT_SECRET) {
    return new Response('Server misconfigured: missing JIRA_CLIENT_SECRET', { status: 500 })
  }

  try {
    const body = await request.json<Record<string, string>>()
    if (!body.client_secret) {
      body.client_secret = env.JIRA_CLIENT_SECRET
    }

    // 1. Exchange code/refresh with Atlassian
    const tokenRes = await fetch('https://auth.atlassian.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!tokenRes.ok) {
      const text = await tokenRes.text()
      return new Response(text, { status: tokenRes.status })
    }

    const tokenData = await tokenRes.json<{
      access_token: string
      refresh_token: string
      expires_in: number
    }>()

    // 2. Fetch accessible resources to get cloudId
    const resourcesRes = await fetch(
      'https://api.atlassian.com/oauth/token/accessible-resources',
      { headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: 'application/json' } },
    )
    if (!resourcesRes.ok) {
      return new Response(`Accessible resources failed: ${resourcesRes.status}`, { status: 502 })
    }
    const resources = await resourcesRes.json<{ id: string }[]>()
    if (!resources.length) {
      return new Response('No accessible Jira sites found', { status: 404 })
    }
    const cloudId = resources[0].id

    // 3. Fetch current user
    const meRes = await fetch('https://api.atlassian.com/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: 'application/json' },
    })
    if (!meRes.ok) {
      return new Response(`Failed to fetch Jira user: ${meRes.status}`, { status: 502 })
    }
    const me = await meRes.json<{ account_id: string }>()

    // 4. Set cookies (include client_id for later refresh)
    const cookieOpts = { url }
    const cookies = [
      setCookie('jira_access_token', tokenData.access_token, {
        ...cookieOpts,
        maxAge: tokenData.expires_in,
      }),
      setCookie('jira_refresh_token', tokenData.refresh_token, cookieOpts),
      setCookie('jira_cloud_id', cloudId, cookieOpts),
      setCookie('jira_account_id', me.account_id, cookieOpts),
      setCookie('jira_auth_method', 'oauth-org', cookieOpts),
    ]
    if (body.client_id) {
      cookies.push(setCookie('jira_client_id', body.client_id, cookieOpts))
    }

    // 5. Return metadata only
    const headers = new Headers({ 'Content-Type': 'application/json' })
    for (const c of cookies) headers.append('Set-Cookie', c)

    return new Response(
      JSON.stringify({
        connected: true,
        cloudId,
        accountId: me.account_id,
        authMethod: 'oauth-org',
      }),
      { headers },
    )
  } catch (e) {
    return new Response(`Token exchange error: ${(e as Error).message}`, { status: 500 })
  }
}

async function handleConnectToken(request: Request, url: URL): Promise<Response> {
  try {
    const { siteUrl, email, apiToken } = await request.json<{
      siteUrl: string
      email: string
      apiToken: string
    }>()

    // Validate credentials by calling Jira
    const basicAuth = btoa(`${email}:${apiToken}`)
    const meRes = await fetch(`https://${siteUrl}/rest/api/3/myself`, {
      headers: { Authorization: `Basic ${basicAuth}`, Accept: 'application/json' },
    })
    if (!meRes.ok) {
      const text = await meRes.text()
      return new Response(
        JSON.stringify({ error: `Auth failed: ${meRes.status} ${text}` }),
        { status: meRes.status, headers: { 'Content-Type': 'application/json' } },
      )
    }
    const me = await meRes.json<{ accountId: string }>()

    const cookieOpts = { url }
    const cookies = [
      setCookie('jira_auth_method', 'token', cookieOpts),
      setCookie('jira_email', email, cookieOpts),
      setCookie('jira_api_token', apiToken, cookieOpts),
      setCookie('jira_site_url', siteUrl, cookieOpts),
      setCookie('jira_account_id', me.accountId, cookieOpts),
    ]

    // Clear any OAuth cookies
    cookies.push(clearCookie('jira_access_token'))
    cookies.push(clearCookie('jira_refresh_token'))
    cookies.push(clearCookie('jira_cloud_id'))

    const headers = new Headers({ 'Content-Type': 'application/json' })
    for (const c of cookies) headers.append('Set-Cookie', c)

    return new Response(
      JSON.stringify({
        connected: true,
        accountId: me.accountId,
        authMethod: 'token',
      }),
      { headers },
    )
  } catch (e) {
    return new Response(`Connect error: ${(e as Error).message}`, { status: 500 })
  }
}
