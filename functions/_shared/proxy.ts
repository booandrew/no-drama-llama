function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function buildProxyTargetUrl(
  requestUrl: URL,
  targetOrigin: string,
  stripPrefix: string,
): URL | null {
  const upstream = new URL(targetOrigin)
  const prefix = new RegExp(`^/${escapeRegex(stripPrefix)}(?:/|$)`)
  const strippedPath = requestUrl.pathname.replace(prefix, '').replace(/^\/+/, '')
  const normalizedPath = `/${strippedPath}`
  const targetUrl = new URL(`${normalizedPath}${requestUrl.search}`, upstream)

  return targetUrl.origin === upstream.origin ? targetUrl : null
}

export function createProxy(targetOrigin: string, stripPrefix: string) {
  const handler: PagesFunction = async (context) => {
    const { request } = context
    const url = new URL(request.url)
    const targetUrl = buildProxyTargetUrl(url, targetOrigin, stripPrefix)
    if (!targetUrl) {
      return new Response('Invalid proxy path', { status: 400 })
    }

    const headers = new Headers(request.headers)
    headers.set('Host', targetUrl.hostname)
    headers.delete('Cookie')
    headers.delete('X-Jira-Host')

    const proxyReq = new Request(targetUrl.toString(), {
      method: request.method,
      headers,
      body: request.body,
      redirect: 'manual',
    })

    const response = await fetch(proxyReq)
    const responseHeaders = new Headers(response.headers)
    responseHeaders.delete('set-cookie')

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    })
  }
  return handler
}
