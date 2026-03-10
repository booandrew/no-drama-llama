export function createProxy(targetOrigin: string, stripPrefix: string) {
  const handler: PagesFunction = async (context) => {
    const { request } = context
    const url = new URL(request.url)
    const targetPath = url.pathname.replace(new RegExp(`^/${stripPrefix}`), '')
    const targetUrl = new URL(targetPath + url.search, targetOrigin)

    const headers = new Headers(request.headers)
    headers.set('Host', targetUrl.hostname)
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
