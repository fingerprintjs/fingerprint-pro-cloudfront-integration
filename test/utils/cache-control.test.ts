import { updateCacheControlHeader } from '../../src/utils/cache-control'

describe('updateCacheControlHeader', () => {
  test('adjust max-age to lower value', () => {
    expect(updateCacheControlHeader('public, max-age=36000, s-maxage=36000')).toBe(
      'public, max-age=3600, s-maxage=60',
    )
  })

  test('keep existing smaller value', () => {
    expect(updateCacheControlHeader('public, max-age=600, s-maxage=600')).toBe(
      'public, max-age=600, s-maxage=60',
    )
  })

  test('add max age if not exist', () => {
    expect(updateCacheControlHeader('no-cache')).toBe('no-cache, max-age=3600, s-maxage=60')
  })
})
