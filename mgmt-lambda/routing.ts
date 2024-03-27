export function removeLeadingAndTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '').replace(/^\/+/g, '')
}
