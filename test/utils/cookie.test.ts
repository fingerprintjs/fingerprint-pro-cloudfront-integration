import { adjustCookies, filterCookie } from '../../src/utils/cookie'

const domain = 'fingerprint.com'

describe('updateCookie', () => {
  test('empty cookie', () => {
    expect(adjustCookies([''], domain)).toBe('')
  })

  test('simple', () => {
    const value = '_iidf'
    expect(adjustCookies([value], domain)).toBe(value)
  })

  test('some non domain with =', () => {
    const value = '_iidf; Value=x;'
    expect(adjustCookies([value], domain)).toBe(value)
  })

  test('key=value=with=equal=sign', () => {
    const value = 'key=value=with=equal=sign'
    expect(adjustCookies([value], domain)).toBe(value)
  })

  test('with equal signs', () => {
    const value = ['_iidt=7A03Gwg==', '_vid_t=gEFRuIQlzYmv692/UL4GLA==']
    expect(adjustCookies(value, domain)).toBe('_iidt=7A03Gwg==; _vid_t=gEFRuIQlzYmv692/UL4GLA==')
  })

  test('without domain', () => {
    const initialValue =
      'iidt,dEbSJkkvz8Yiv4eFAGbOJWPL69y0Z8Z8vnpEk/mJkaZ4hXmM+zb+8iWRy1j6IuqK5Fq1BnLRi2BC/Q,,; ' +
      'Path,/; Expires,Fri, 27 Oct 2023 19:17:51 GMT; HttpOnly; Secure; SameSite,None'
    expect(adjustCookies([initialValue], domain)).toBe(initialValue)
  })

  test('update domain', () => {
    const initialValue =
      'iidt,dEbSJkkvz8Yiv4eFAGbOJWPL69y0Z8Z8vnpEk/mJkaZ4hXmM+zb+8iWRy1j6IuqK5Fq1BnLRi2BC/Q,,; ' +
      'Path,/; Domain=hfdgjkjds.cloudfront.net; Expires,Fri, 27 Oct 2023 19:17:51 GMT; HttpOnly; Secure; SameSite,None'
    const expectedValue =
      'iidt,dEbSJkkvz8Yiv4eFAGbOJWPL69y0Z8Z8vnpEk/mJkaZ4hXmM+zb+8iWRy1j6IuqK5Fq1BnLRi2BC/Q,,; ' +
      'Path,/; Domain=fingerprint.com; Expires,Fri, 27 Oct 2023 19:17:51 GMT; HttpOnly; Secure; SameSite,None'
    expect(adjustCookies([initialValue], domain)).toBe(expectedValue)
  })
})


describe('filterCookies', () => {
  const predicate = (key: string) => key === '_iidt'
  test('the same result', () => {
    const value = '_iidt=sfdsafdasf'
    expect(filterCookie(value, predicate)).toBe(value)
  })

  test('reduce', () => {
    const value = '_iidt=aass; vid_t=xcvbnm'
    expect(filterCookie(value, predicate)).toBe('_iidt=aass')
  })
  
  test('empty', () => {
    expect(filterCookie('', predicate)).toBe('')
  })

  test('no value', () => {
    expect(filterCookie('_iidt', predicate)).toBe('')
  })

  test('with equal signs', () => {
    const value = '_iidt=7A03Gwg==; _vid_t=gEFRuIQlzYmv692/UL4GLA=='
    expect(filterCookie(value, predicate)).toBe('_iidt=7A03Gwg==')
  })
})