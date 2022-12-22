export function adjustCookies(cookies: string[], domainName: string): string {
  const newCookies: string[] = []
  cookies.forEach((it) => {
    const parts: string[] = it.split(';')

    parts.map((v: string) => {
      const s = v.trim()
      const ind = s.indexOf('=')
      if (ind !== -1) {
        const key = s.substring(0, ind)
        let value = s.substring(ind + 1)
        if (key.toLowerCase() === 'domain') {
          value = domainName
        }
        newCookies.push(`${key}=${value}`)
      } else {
        newCookies.push(s)
      }
    })
  })

  return newCookies.join('; ').trim()
}

export function filterCookie(cookie: string, filterPredicate: (key: string) => boolean): string {
  const newCookie: string[] = []
  const parts = cookie.split(';')

  parts.forEach((it) => {
    const s = it.trim()
    const ind = s.indexOf('=')
    if (ind !== -1) {
      const key = s.substring(0, ind)
      const value = s.substring(ind + 1)
      if (filterPredicate(key)) {
        newCookie.push(`${key}=${value}`)
      }
    }
  })

  return newCookie.join('; ').trim()
}
