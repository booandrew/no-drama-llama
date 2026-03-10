export const onRequest: PagesFunction = async (context) => {
  const { request } = context
  const host = request.headers.get('X-Jira-Host')

  if (!host) {
    return new Response('Missing X-Jira-Host header', { status: 400 })
  }

  const url = new URL(request.url)
  const targetPath = url.pathname.replace(/^\/jira-site/, '')
  const targetUrl = new URL(targetPath + url.search, `https://${host}`)

  const headers = new Headers(request.headers)
  headers.set('Host', host)
  headers.delete('X-Jira-Host')

  const proxyReq = new Request(targetUrl.toString(), {
    method: request.method,
    headers,
    body: request.body,
    redirect: 'manual',
  })

  try {
    const response = await fetch(proxyReq)
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    })
  } catch (err) {
    return new Response(`Proxy error: ${(err as Error).message}`, { status: 502 })
  }
}
