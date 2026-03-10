import { createProxy } from '../_shared/proxy'

export const onRequest = createProxy('https://api.atlassian.com', 'jira-api')
