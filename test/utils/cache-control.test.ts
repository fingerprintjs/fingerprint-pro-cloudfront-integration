import { updateCacheControlHeader } from '../../src/utils/cache-control'

describe('updateCacheControlHeader', () => {
  test('adjust max-age to lower value', () => {
    expect(updateCacheControlHeader('public, max-age=36000, s-maxage=36000', 3600)).toBe('public, max-age=3600, s-maxage=36000')
  })

  test('keep existing smaller value', () => {
    expect(updateCacheControlHeader('public, max-age=600, s-maxage=600', 3600)).toBe('public, max-age=600, s-maxage=600')
  })

  test('add max age if not exist', () => {
    expect(updateCacheControlHeader('no-cache', 3600)).toBe('no-cache, max-age=3600')
  })
})