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
