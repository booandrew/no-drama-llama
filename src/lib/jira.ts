const CLOUD_ID = import.meta.env.VITE_JIRA_CLOUD_ID
const EMAIL = import.meta.env.VITE_JIRA_EMAIL
const TOKEN = import.meta.env.VITE_JIRA_TOKEN

const BASE = `/jira-api/ex/jira/${CLOUD_ID}/rest/api/3`

function headers() {
  return {
    Authorization: `Basic ${btoa(`${EMAIL}:${TOKEN}`)}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
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
  const res = await fetch(`${BASE}/project/search?maxResults=50`, {
    headers: headers(),
  })
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
  const quoted = projectKeys.map((k) => `"${k}"`).join(', ')
  const jql = `project in (${quoted}) ORDER BY key ASC`
  const params = new URLSearchParams({
    jql,
    fields: 'summary,status,project',
    maxResults: '200',
  })
  const res = await fetch(`${BASE}/search/jql?${params}`, {
    headers: headers(),
  })
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
