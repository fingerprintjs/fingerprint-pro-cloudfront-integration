export function resource(name: string) {
  const prefix = process.env.COMMIT_SHA ?? 'e2e'

  return `fpjs-dev-${prefix}-cloudfront-${name}`
}
