export function updateCookie(cookieValue: string, domainName: string): string {
  const parts = cookieValue.split(';')
  for (let i = 0; i < parts.length; i++) {
    const s = parts[i].trim()
    const kv = s.split('=')
    if (kv[0].toLowerCase() === 'domain') {
      kv[1] = domainName
      parts[i] = `${kv[0]}=${kv[1]}`
    } else {
      parts[i] = s
    }
  }
  return parts.join('; ')
}

export function isAllowedCookie(cookie: string) {
  cookie
  return true
}
