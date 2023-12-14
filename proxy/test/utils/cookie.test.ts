import { filterCookie } from '../../utils/cookie'

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
