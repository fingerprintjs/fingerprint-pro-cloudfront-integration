export function adjustCookies(cookies: string[], domainName: string): string {
  const newCookies: string[] = []
  cookies.forEach((it) => {
    const parts: string[] = it.split(';')
    
    parts.map((v: string) => {
      const s = v.trim()
      const kv = s.split('=')
      if (kv.length === 1) {
        newCookies.push(s)
      } else {
        if (kv[0].toLowerCase() === 'domain') {
          kv[1] = domainName
          newCookies.push(`${kv[0]}=${kv[1]}`)
        } else {
          newCookies.push(s)
        }
      }
    })
  })

  return newCookies.join('; ').trim()
}
