export function updateCacheControlHeader(headerValue: string, maxAge: number): string {
  headerValue = updateCacheControlAge(headerValue, 'max-age', maxAge)
  headerValue = updateCacheControlAge(headerValue, 's-maxage', maxAge)
  return headerValue
}

function updateCacheControlAge(headerValue: string, type: 'max-age' | 's-maxage', cacheMaxAge: number): string {
  const cacheControlDirectives = headerValue.split(', ')
  const maxAgeIndex = cacheControlDirectives.findIndex(
    (directive) => directive.split('=')[0].trim().toLowerCase() === type,
  )
  if (maxAgeIndex === -1) {
    cacheControlDirectives.push(`${type}=${cacheMaxAge}`)
  } else {
    const oldMaxAge = Number(cacheControlDirectives[maxAgeIndex].split('=')[1])
    const newMaxAge = Math.min(cacheMaxAge, oldMaxAge)
    cacheControlDirectives[maxAgeIndex] = `${type}=${newMaxAge}`
  }
  return cacheControlDirectives.join(', ')
}
