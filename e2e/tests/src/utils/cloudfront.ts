import { wait } from './wait'
import { readTerraformOutput } from './terraform'

export type CloudfrontUrls = {
  cloudfrontWithHeadersUrl: string
  cloudfrontWithSecretsUrl: string
}

export const urlTypeCustomerVariableSourceMap: Record<keyof CloudfrontUrls, string> = {
  cloudfrontWithHeadersUrl: 'HeaderCustomerVariables',
  cloudfrontWithSecretsUrl: 'SecretsManagerVariables',
}

let cache: CloudfrontUrls | undefined

function getCloudfrontUrlsFromEnv(): Partial<CloudfrontUrls> {
  return {
    cloudfrontWithHeadersUrl: process.env.CLOUDFRONT_WITH_HEADERS_URL,
    cloudfrontWithSecretsUrl: process.env.CLOUDFRONT_WITH_SECRETS_URL,
  }
}

export function getCloudfrontUrls(): CloudfrontUrls {
  if (!cache) {
    const fromEnv = getCloudfrontUrlsFromEnv()
    if (fromEnv.cloudfrontWithHeadersUrl && fromEnv.cloudfrontWithSecretsUrl) {
      cache = {
        cloudfrontWithHeadersUrl: `https://${fromEnv.cloudfrontWithHeadersUrl}`,
        cloudfrontWithSecretsUrl: `https://${fromEnv.cloudfrontWithSecretsUrl}`,
      }
      console.info('Using cloudfront urls from env')
    } else {
      const contents = readTerraformOutput()

      cache = {
        cloudfrontWithHeadersUrl: `https://${contents.cloudfront_with_headers_url.value}`,
        cloudfrontWithSecretsUrl: `https://${contents.cloudfront_with_secret_url.value}`,
      }

      console.info('Using cloudfront urls from terraform output')
    }
  }

  return cache
}

export function getCloudfrontUrl(urlType: keyof CloudfrontUrls, path: string) {
  const urls = getCloudfrontUrls()

  const url = new URL(urls[urlType])
  url.pathname = path

  return url.toString()
}

export async function waitForCloudfront(waitMs = 1000) {
  const urls = Object.values(getCloudfrontUrls()).map((url) => {
    const urlObject = new URL(url)
    urlObject.pathname = `/${getBehaviourPath()}/status`

    return urlObject.toString()
  })

  await Promise.all(
    urls.map((url) => {
      return new Promise<void>(async (resolve) => {
        const response = await fetch(url).catch((error) => {
          console.error(`Failed to get response from ${url}`, error)

          return null
        })

        if (response?.ok) {
          return resolve()
        }

        await wait(waitMs)
      })
    })
  )
}

function getBehaviourPath() {
  return process.env.BEHAVIOUR_PATH ?? 'fpjs'
}
