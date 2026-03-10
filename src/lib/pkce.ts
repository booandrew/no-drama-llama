function base64UrlEncode(bytes: Uint8Array): string {
  const str = btoa(String.fromCharCode(...bytes))
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function generateCodeVerifier(length = 64): string {
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  return base64UrlEncode(array)
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return base64UrlEncode(new Uint8Array(digest))
}
