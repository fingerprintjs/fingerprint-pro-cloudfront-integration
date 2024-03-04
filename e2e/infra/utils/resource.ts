export function resource(name: string) {
  const suffix = process.env.RESOURCE_SUFFIX ?? ''
  return `fpjs-dev-e2e-cloudfront-${name}${suffix ? `-${suffix}-` : ''}`
}
