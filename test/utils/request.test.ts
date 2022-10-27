import { getApiKey, getLoaderVersion, getRegion } from '../../src/utils/request'
import { CloudFrontRequest } from 'aws-lambda'

describe('api key', () => {
  test('api key is not defined', () => {
    const req: CloudFrontRequest = {
      clientIp: '1.1.1.1',
      method: 'GET',
      uri: 'fpjs/agent',
      querystring: 'version=3&loaderVersion=3.6.2',
      headers: {}      
    }
    expect(getApiKey(req)).toBe(undefined)
  })

  test('api key is present', () => {
    const req: CloudFrontRequest = {
      clientIp: '1.1.1.1',
      method: 'GET',
      uri: 'fpjs/agent',
      querystring: 'apiKey=ujKG34hUYKLJKJ1F&version=3&loaderVersion=3.6.2',
      headers: {}
    }
    expect(getApiKey(req)).toBe('ujKG34hUYKLJKJ1F')
  })
})

describe('loader version', () => {
  test('loader version is not defined', () => {
    const req: CloudFrontRequest = {
      clientIp: '1.1.1.1',
      method: 'GET',
      uri: 'fpjs/agent',
      querystring: 'apiKey=ujKG34hUYKLJKJ1F&version=3',
      headers: {}      
    }
    expect(getLoaderVersion(req)).toBe(undefined)
  })

  test('loader version is present', () => {
    const req: CloudFrontRequest = {
      clientIp: '1.1.1.1',
      method: 'GET',
      uri: 'fpjs/agent',
      querystring: 'apiKey=ujKG34hUYKLJKJ1F&version=3&loaderVersion=3.6.2',
      headers: {}      
    }
    expect(getLoaderVersion(req)).toBe('3.6.2')
  })
})

describe('region', () => {
  test('region is not defined, must return us', () => {
    const req: CloudFrontRequest = {
      clientIp: '1.1.1.1',
      method: 'GET',
      uri: 'fpjs/agent',
      querystring: 'apiKey=ujKG34hUYKLJKJ1F&version=3',
      headers: {}      
    }
    expect(getRegion(req)).toBe('us')
  })

  test('region is present', () => {
    const req: CloudFrontRequest = {
      clientIp: '1.1.1.1',
      method: 'GET',
      uri: 'fpjs/agent',
      querystring: 'apiKey=ujKG34hUYKLJKJ1F&version=3&loaderVersion=3.6.2&region=eu',
      headers: {}      
    }
    expect(getRegion(req)).toBe('eu')
  })
})

