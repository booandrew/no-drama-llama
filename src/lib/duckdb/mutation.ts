const MUTATION_RE = /^\s*(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|COPY)/i

export function isMutation(sql: string): boolean {
  return MUTATION_RE.test(sql)
}
