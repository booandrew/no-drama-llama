const ATLASSIAN_CLOUD_SUFFIX = '.atlassian.net'

export function normalizeJiraSiteHost(siteUrl: string): string | null {
  const trimmed = siteUrl.trim().replace(/\/+$/, '')
  if (!trimmed) return null

  const withScheme = trimmed.includes('://') ? trimmed : `https://${trimmed}`

  let url: URL
  try {
    url = new URL(withScheme)
  } catch {
    return null
  }

  if (url.username || url.password || url.port) return null
  if (url.pathname !== '/' || url.search || url.hash) return null

  const hostname = url.hostname.toLowerCase()
  if (!hostname.endsWith(ATLASSIAN_CLOUD_SUFFIX)) return null

  const subdomain = hostname.slice(0, -ATLASSIAN_CLOUD_SUFFIX.length)
  if (!subdomain) return null

  return hostname
}

export function jiraSiteHostError(): string {
  return 'Jira API-token mode only supports Atlassian Cloud sites (*.atlassian.net).'
}
