export type JiraValidationCode =
  | 'ok'
  | 'missing_scope'
  | 'expired'
  | 'invalid'
  | 'insufficient_access'
  | 'probe_failed'

export interface JiraValidationResult {
  ok: boolean
  code: JiraValidationCode
  message?: string
}

const SEARCH_PARAMS = new URLSearchParams({
  jql: 'project IS NOT EMPTY ORDER BY created DESC',
  fields: 'summary',
  maxResults: '1',
}).toString()

export async function validateJiraOAuthAccess(
  accessToken: string,
  cloudId: string,
): Promise<JiraValidationResult> {
  const headers = { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' }

  const [meRes, searchRes] = await Promise.all([
    fetch('https://api.atlassian.com/me', { headers }),
    fetch(`https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/search/jql?${SEARCH_PARAMS}`, {
      headers,
    }),
  ])

  if (meRes.status === 401 || searchRes.status === 401) {
    return {
      ok: false,
      code: 'expired',
      message: 'Jira access token is expired, invalid, or revoked.',
    }
  }

  if (!meRes.ok) {
    return {
      ok: false,
      code: 'probe_failed',
      message: `Jira identity check failed (${meRes.status})`,
    }
  }

  if (searchRes.status === 403) {
    return {
      ok: false,
      code: 'missing_scope',
      message:
        'Jira OAuth grant cannot read issues/worklogs. Confirm the app has read:jira-work and the site granted access.',
    }
  }

  if (searchRes.ok) {
    return { ok: true, code: 'ok' }
  }

  return {
    ok: false,
    code: 'probe_failed',
    message: `Jira issue search validation failed (${searchRes.status})`,
  }
}

export async function validateJiraTokenAccess(
  siteUrl: string,
  basicAuth: string,
): Promise<JiraValidationResult> {
  const headers = { Authorization: `Basic ${basicAuth}`, Accept: 'application/json' }

  const [meRes, searchRes] = await Promise.all([
    fetch(`https://${siteUrl}/rest/api/3/myself`, { headers }),
    fetch(`https://${siteUrl}/rest/api/3/search/jql?${SEARCH_PARAMS}`, { headers }),
  ])

  if (meRes.status === 401 || searchRes.status === 401) {
    return {
      ok: false,
      code: 'invalid',
      message: 'Jira API token is invalid, expired, or not accepted by this site.',
    }
  }

  if (!meRes.ok) {
    return {
      ok: false,
      code: 'probe_failed',
      message: `Jira identity check failed (${meRes.status})`,
    }
  }

  if (searchRes.status === 403) {
    return {
      ok: false,
      code: 'insufficient_access',
      message:
        'Jira API token authenticated, but issue/worklog read access is unavailable. Use OAuth, or use an unscoped API token with Jira access to this site.',
    }
  }

  if (searchRes.ok) {
    return { ok: true, code: 'ok' }
  }

  return {
    ok: false,
    code: 'probe_failed',
    message: `Jira issue search validation failed (${searchRes.status})`,
  }
}
