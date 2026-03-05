import { useJiraStore } from '@/store/jira'

function getBase() {
  const { cloudId } = useJiraStore.getState()
  if (!cloudId) throw new Error('Jira not connected: no cloudId')
  return `/jira-api/ex/jira/${cloudId}/rest/api/3`
}

function headers() {
  const { accessToken } = useJiraStore.getState()
  if (!accessToken) throw new Error('Jira not connected: no access token')
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
}

async function ensureValidToken() {
  const store = useJiraStore.getState()
  if (!store.isTokenValid()) {
    const refreshed = await store.refreshAccessToken()
    if (!refreshed) throw new Error('Jira token expired and refresh failed')
  }
}

export interface JiraProject {
  id: string
  key: string
  name: string
}

export interface JiraIssue {
  id: string
  key: string
  summary: string
  projectKey: string
  projectName: string
  status: string
}

export async function fetchProjects(): Promise<JiraProject[]> {
  await ensureValidToken()
  const res = await fetch(`${getBase()}/project/search?maxResults=50`, {
    headers: headers(),
  })
  if (res.status === 401) {
    useJiraStore.getState().setExpired()
    throw new Error('Jira token expired')
  }
  if (!res.ok) throw new Error(`Jira projects: ${res.status}`)
  const data = await res.json()
  return data.values.map((p: { id: string; key: string; name: string }) => ({
    id: p.id,
    key: p.key,
    name: p.name,
  }))
}

export async function fetchIssues(projectKeys: string[]): Promise<JiraIssue[]> {
  if (projectKeys.length === 0) return []
  await ensureValidToken()
  const quoted = projectKeys.map((k) => `"${k}"`).join(', ')
  const jql = `project in (${quoted}) ORDER BY key ASC`
  const params = new URLSearchParams({
    jql,
    fields: 'summary,status,project',
    maxResults: '200',
  })
  const res = await fetch(`${getBase()}/search/jql?${params}`, {
    headers: headers(),
  })
  if (res.status === 401) {
    useJiraStore.getState().setExpired()
    throw new Error('Jira token expired')
  }
  if (!res.ok) throw new Error(`Jira issues: ${res.status}`)
  const data = await res.json()
  return data.issues.map(
    (i: {
      id: string
      key: string
      fields: {
        summary: string
        project: { key: string; name: string }
        status: { name: string }
      }
    }) => ({
      id: i.id,
      key: i.key,
      summary: i.fields.summary,
      projectKey: i.fields.project.key,
      projectName: i.fields.project.name,
      status: i.fields.status.name,
    }),
  )
}
