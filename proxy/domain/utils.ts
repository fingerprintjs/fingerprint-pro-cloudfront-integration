import domainSuffixList from './domain-suffix-list-reversed.json'

export function getDomainFromHostname(hostname: string): string {
  if (!hostname) {
    return hostname
  }

  const matchingETLD = findETLDMatch(hostname)
  if (!matchingETLD) {
    return hostname
  }

  const lengthDiff = hostname.length - matchingETLD.length
  const partBeforeSuffix = hostname.substring(0, lengthDiff - 1)
  const lastDotIndex = partBeforeSuffix.lastIndexOf('.')
  if (lastDotIndex === -1) {
    return hostname
  }

  return hostname.substring(lastDotIndex + 1)
}

function findETLDMatch(hostname: string): string | null {
  let currentMatch = null
  for (const domain of domainSuffixList) {
    const domainSuffix = domain.suffix
    const lengthDiff = hostname.length - domainSuffix.length
    if (lengthDiff < 0) {
      continue
    }

    const endsWithSuffix = hostname.substring(lengthDiff).toLowerCase() === domainSuffix.toLowerCase()
    if (!endsWithSuffix) {
      continue
    }

    if (currentMatch == null || currentMatch.length < domainSuffix.length) {
      currentMatch = domainSuffix
    }
  }

  return currentMatch
}
