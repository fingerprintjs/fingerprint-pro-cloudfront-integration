export function updateCookie(cookieValue: string, domainName: string): string {
  const parts = cookieValue.split(';')

  const updated = parts.map((it) => {
    const s = it.trim()
    const kv = s.split('=')
    if (kv.length === 1) {
      return s
    } else {
      if (kv[0].toLowerCase() === 'domain') {
        kv[1] = domainName
        return `${kv[0]}=${kv[1]}`
      } else {
        return s
      }
    }
  })

  return updated.join('; ').trim()
}
