import { getCookie } from '../_shared/cookies'
import { jiraSiteHostError, normalizeJiraSiteHost } from '../_shared/jira-site'
import { buildProxyTargetUrl } from '../_shared/proxy'

export const onRequest: PagesFunction = async (context) => {
  const { request } = context

  const authMethod = getCookie(request, 'jira_auth_method')
  if (authMethod !== 'token') {
    return new Response('Jira site proxy requires API token auth method', { status: 400 })
  }

  const siteUrl = getCookie(request, 'jira_site_url')
  const email = getCookie(request, 'jira_email')
  const apiToken = getCookie(request, 'jira_api_token')

  if (!siteUrl || !email || !apiToken) {
    return new Response('Missing Jira credentials in cookies', { status: 401 })
  }

  const normalizedSiteUrl = normalizeJiraSiteHost(siteUrl)
  if (!normalizedSiteUrl) {
    return new Response(jiraSiteHostError(), { status: 400 })
  }

  const url = new URL(request.url)
  const targetUrl = buildProxyTargetUrl(url, `https://${normalizedSiteUrl}`, 'jira-site')
  if (!targetUrl) {
    return new Response('Invalid Jira proxy path', { status: 400 })
  }

  const basicAuth = btoa(`${email}:${apiToken}`)
  const headers = new Headers(request.headers)
  headers.set('Host', normalizedSiteUrl)
  headers.set('Authorization', `Basic ${basicAuth}`)
  headers.delete('X-Jira-Host')
  headers.delete('Cookie')

  const proxyReq = new Request(targetUrl.toString(), {
    method: request.method,
    headers,
    body: request.body,
    redirect: 'manual',
  })

  try {
    const response = await fetch(proxyReq)
    const responseHeaders = new Headers(response.headers)
    responseHeaders.delete('set-cookie')
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    })
  } catch (err) {
    return new Response(`Proxy error: ${(err as Error).message}`, { status: 502 })
  }
}
