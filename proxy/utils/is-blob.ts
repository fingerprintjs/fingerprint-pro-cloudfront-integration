import type { Blob } from 'buffer'

/**
 * Special check for Blob in order to avoid doing "instanceof Blob" which breaks rollup build
 * */
export function isBlob(value: unknown): value is Blob {
  return Boolean(
    value &&
      typeof value === 'object' &&
      // In our case we only care about .text() method
      'text' in value &&
      typeof (value as Blob).text === 'function'
  )
}
