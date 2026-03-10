import { createProxy } from '../_shared/proxy'

export const onRequest = createProxy('https://auth.atlassian.com', 'jira-auth')
