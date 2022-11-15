const CACHE_MAX_AGE = 3600
const SHARED_CACHE_MAX_AGE = 60

export function updateCacheControlHeader(headerValue: string): string {
  headerValue = updateCacheControlAge(headerValue, 'max-age', CACHE_MAX_AGE)
  headerValue = updateCacheControlAge(headerValue, 's-maxage', SHARED_CACHE_MAX_AGE)
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
