import { useJiraStore } from '@/store/jira'

function getBase() {
  const { authMethod, cloudId } = useJiraStore.getState()
  if (authMethod === 'token') {
    return '/jira-site/rest/api/3'
  }
  if (!cloudId) throw new Error('Jira not connected: no cloudId')
  return `/jira-api/ex/jira/${cloudId}/rest/api/3`
}

function getAccountId() {
  const { accountId } = useJiraStore.getState()
  if (!accountId) throw new Error('Jira not connected: no accountId')
  return accountId
}

function headers(): Record<string, string> {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
}

export interface JiraIssue {
  id: string
  key: string
  summary: string
  projectKey: string
  projectName: string
  status: string
}

export interface JiraWorklog {
  id: string
  issueId: string
  started: string
  timeSpent: string
  comment: string | null
  self: string
}

export async function fetchWorklogs(
  dateStart: string,
  dateEnd: string,
): Promise<{ worklogs: JiraWorklog[]; issues: JiraIssue[] }> {
  // Step 1: JQL to find only issues where current user logged work in the period
  const accountId = getAccountId()
  const jqlStart = dateStart.slice(0, 10) // "YYYY-MM-DD"
  const jqlEnd = dateEnd.slice(0, 10)
  const jql = `worklogDate >= "${jqlStart}" AND worklogDate <= "${jqlEnd}" AND worklogAuthor = currentUser()`
  const maxResults = 200
  const issues: JiraIssue[] = []
  let nextPageToken: string | undefined

  do {
    const params = new URLSearchParams({
      jql,
      fields: 'summary,status,project',
      maxResults: String(maxResults),
    })
    if (nextPageToken) params.set('nextPageToken', nextPageToken)

    const searchRes = await fetch(`${getBase()}/search/jql?${params}`, {
      headers: headers(),
    })
    if (searchRes.status === 401) {
      useJiraStore.getState().setExpired()
      throw new Error('Jira token expired')
    }
    if (!searchRes.ok) throw new Error(`Jira worklog search: ${searchRes.status}`)
    const searchData = await searchRes.json()

    for (const i of searchData.issues) {
      issues.push({
        id: i.id,
        key: i.key,
        summary: i.fields.summary,
        projectKey: i.fields.project.key,
        projectName: i.fields.project.name,
        status: i.fields.status.name,
      })
    }
    nextPageToken = searchData.nextPageToken
  } while (nextPageToken)

  if (issues.length === 0) return { worklogs: [], issues: [] }

  // Step 2: Fetch worklogs only for the matched issues, filtered by current user
  const all: JiraWorklog[] = []
  for (const issue of issues) {
    const wlParams = new URLSearchParams({
      startedAfter: String(new Date(dateStart).getTime()),
      startedBefore: String(new Date(dateEnd).getTime()),
    })
    const res = await fetch(`${getBase()}/issue/${issue.id}/worklog?${wlParams}`, {
      headers: headers(),
    })
    if (res.status === 401) {
      useJiraStore.getState().setExpired()
      throw new Error('Jira token expired')
    }
    if (!res.ok) continue // skip issues where worklogs can't be read

    const data = await res.json()
    for (const w of data.worklogs ?? []) {
      if (w.author?.accountId !== accountId) continue
      all.push({
        id: String(w.id),
        issueId: issue.id,
        started: w.started,
        timeSpent: w.timeSpentSeconds ? `${w.timeSpentSeconds}` : w.timeSpent,
        comment: w.comment
          ? typeof w.comment === 'string'
            ? w.comment
            : JSON.stringify(w.comment)
          : null,
        self: w.self ?? '',
      })
    }
  }

  return { worklogs: all, issues }
}

export async function fetchIssuesByIds(issueIds: string[]): Promise<JiraIssue[]> {
  if (issueIds.length === 0) return []

  const all: JiraIssue[] = []
  // Batch into chunks of 200 to stay within JQL length limits
  for (let i = 0; i < issueIds.length; i += 200) {
    const chunk = issueIds.slice(i, i + 200)
    const jql = `id in (${chunk.join(',')})`
    let nextPageToken: string | undefined

    do {
      const params = new URLSearchParams({
        jql,
        fields: 'summary,status,project',
        maxResults: '200',
      })
      if (nextPageToken) params.set('nextPageToken', nextPageToken)

      const res = await fetch(`${getBase()}/search/jql?${params}`, {
        headers: headers(),
      })
      if (res.status === 401) {
        useJiraStore.getState().setExpired()
        throw new Error('Jira token expired')
      }
      if (!res.ok) throw new Error(`Jira issues by ID: ${res.status}`)
      const data = await res.json()
      for (const i of data.issues) {
        all.push({
          id: i.id,
          key: i.key,
          summary: i.fields.summary,
          projectKey: i.fields.project.key,
          projectName: i.fields.project.name,
          status: i.fields.status.name,
        })
      }
      nextPageToken = data.nextPageToken
    } while (nextPageToken)
  }
  return all
}

export async function fetchIssues(): Promise<JiraIssue[]> {
  const aid = getAccountId()
  const jql = `(assignee = "${aid}" OR creator = "${aid}" OR reporter = "${aid}") ORDER BY key ASC`
  const all: JiraIssue[] = []
  const maxResults = 200
  let nextPageToken: string | undefined

  do {
    const params = new URLSearchParams({
      jql,
      fields: 'summary,status,project',
      maxResults: String(maxResults),
    })
    if (nextPageToken) params.set('nextPageToken', nextPageToken)

    const res = await fetch(`${getBase()}/search/jql?${params}`, {
      headers: headers(),
    })
    if (res.status === 401) {
      useJiraStore.getState().setExpired()
      throw new Error('Jira token expired')
    }
    if (!res.ok) throw new Error(`Jira issues: ${res.status}`)
    const data = await res.json()
    for (const i of data.issues) {
      all.push({
        id: i.id,
        key: i.key,
        summary: i.fields.summary,
        projectKey: i.fields.project.key,
        projectName: i.fields.project.name,
        status: i.fields.status.name,
      })
    }
    nextPageToken = data.nextPageToken
  } while (nextPageToken)

  return all
}
