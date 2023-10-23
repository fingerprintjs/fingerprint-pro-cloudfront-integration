export function normalizeSecret(secret: string) {
  const entries = Object.entries(JSON.parse(secret))

  return Object.fromEntries(entries.map(([key, value]) => [key.toLowerCase(), value]))
}
