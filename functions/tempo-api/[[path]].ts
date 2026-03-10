import { createProxy } from '../_shared/proxy'

export const onRequest = createProxy('https://api.tempo.io', 'tempo-api')
