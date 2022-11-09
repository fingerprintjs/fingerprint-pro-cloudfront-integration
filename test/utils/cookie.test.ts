import { updateCookie } from '../../src/utils/cookie'

const domain = 'fingerprint.com'

describe('updateCookie', () => {
  test('empty cookie', () => {
    expect(updateCookie('', domain)).toBe('')
  })

  test('simple', () => {
    const value = '_iidf'
    expect(updateCookie(value, domain)).toBe(value)
  })

  test('some non domain with =', () => {
    const value = '_iidf; Value=x;'
    expect(updateCookie(value, domain)).toBe(value)
  })

  test('key=value=with=equal=sign', () => {
    const value = 'key=value=with=equal=sign'
    expect(updateCookie(value, domain)).toBe(value)
  })

  test('without domain', () => {
    const initialValue =
      'iidt,dEbSJkkvz8Yiv4eFAGbOJWPL69y0Z8Z8vnpEk/mJkaZ4hXmM+zb+8iWRy1j6IuqK5Fq1BnLRi2BC/Q,,; ' +
      'Path,/; Expires,Fri, 27 Oct 2023 19:17:51 GMT; HttpOnly; Secure; SameSite,None'
    expect(updateCookie(initialValue, domain)).toBe(initialValue)
  })

  test('update domain', () => {
    const initialValue =
      'iidt,dEbSJkkvz8Yiv4eFAGbOJWPL69y0Z8Z8vnpEk/mJkaZ4hXmM+zb+8iWRy1j6IuqK5Fq1BnLRi2BC/Q,,; ' +
      'Path,/; Domain=hfdgjkjds.cloudfront.net; Expires,Fri, 27 Oct 2023 19:17:51 GMT; HttpOnly; Secure; SameSite,None'
    const expectedValue =
      'iidt,dEbSJkkvz8Yiv4eFAGbOJWPL69y0Z8Z8vnpEk/mJkaZ4hXmM+zb+8iWRy1j6IuqK5Fq1BnLRi2BC/Q,,; ' +
      'Path,/; Domain=fingerprint.com; Expires,Fri, 27 Oct 2023 19:17:51 GMT; HttpOnly; Secure; SameSite,None'
    expect(updateCookie(initialValue, domain)).toBe(expectedValue)
  })
})
