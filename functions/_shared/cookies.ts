interface CookieOptions {
  maxAge?: number
  path?: string
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'Strict' | 'Lax' | 'None'
}

const DEFAULTS: CookieOptions = {
  maxAge: 31536000,
  path: '/',
  httpOnly: true,
  secure: true,
  sameSite: 'Strict',
}

function isLocalDev(url: URL): boolean {
  return url.hostname === 'localhost' || url.hostname === '127.0.0.1'
}

export function setCookie(
  name: string,
  value: string,
  opts: CookieOptions & { url?: URL } = {},
): string {
  const { url, ...rest } = opts
  const o = { ...DEFAULTS, ...rest }
  if (url && isLocalDev(url)) o.secure = false

  let header = `${name}=${encodeURIComponent(value)}`
  if (o.maxAge != null) header += `; Max-Age=${o.maxAge}`
  if (o.path) header += `; Path=${o.path}`
  if (o.httpOnly) header += '; HttpOnly'
  if (o.secure) header += '; Secure'
  if (o.sameSite) header += `; SameSite=${o.sameSite}`
  return header
}

export function clearCookie(name: string, path = '/'): string {
  return `${name}=; Max-Age=0; Path=${path}; HttpOnly; SameSite=Strict`
}

export function getCookie(request: Request, name: string): string | null {
  const header = request.headers.get('Cookie')
  if (!header) return null
  for (const pair of header.split(';')) {
    const [k, ...rest] = pair.split('=')
    if (k.trim() === name) {
      return decodeURIComponent(rest.join('=').trim())
    }
  }
  return null
}

export function setJsonCookie<T>(
  name: string,
  obj: T,
  opts: CookieOptions & { url?: URL } = {},
): string {
  return setCookie(name, JSON.stringify(obj), opts)
}

export function getJsonCookie<T>(request: Request, name: string): T | null {
  const raw = getCookie(request, name)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}
