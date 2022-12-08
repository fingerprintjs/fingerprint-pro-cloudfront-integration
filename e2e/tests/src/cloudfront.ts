import path from 'path'
import { getStackOutput } from '../../infra/utils/getStackOutput'
import { wait } from './utils/wait'
import fetch from 'node-fetch'

const stackPath = path.resolve(__dirname, '../../infra/cloudfront')

interface CloudfrontUrls {
  cloudfrontWithHeadersUrl: string
  cloudfrontWithSecretsUrl: string
}

let cachedOutput: CloudfrontUrls | undefined

export function getCloudfrontUrls() {
  if (!cachedOutput) {
    const output = getStackOutput<CloudfrontUrls>(stackPath)

    cachedOutput = {
      cloudfrontWithHeadersUrl: `https://${output.cloudfrontWithHeadersUrl}`,
      cloudfrontWithSecretsUrl: `https://${output.cloudfrontWithSecretsUrl}`,
    }
  }

  return cachedOutput
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
    }),
  )
}

function getBehaviourPath() {
  return process.env.BEHAVIOUR_PATH ?? 'fpjs'
}
