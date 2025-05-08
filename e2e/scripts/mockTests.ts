import { execSync } from 'child_process'
import { getCloudfrontUrls } from '../tests/src/utils/cloudfront'
import { version } from '../../package.json'

function getEnv(name: string) {
  const value = process.env[name]

  if (!value) {
    throw new Error(`${name} is not set`)
  }

  return value
}

async function main() {
  let hasError = false

  const cloudfrontUrls = getCloudfrontUrls()

  const apiUrl = getEnv('API_URL')
  const behaviorPath = getEnv('FPJS_BEHAVIOR_PATH')
  const agentPath = `${behaviorPath}/${getEnv('FPJS_AGENT_DOWNLOAD_PATH')}`
  const resultPath = `${behaviorPath}/${getEnv('FPJS_GET_RESULT_PATH')}`

  console.info('Agent download path:', agentPath)
  console.info('Get result path:', resultPath)

  for (const [name, url] of Object.entries(cloudfrontUrls)) {
    if (name === 'cloudfrontWithoutVariables') {
      continue
    }
    console.info(`Running mock e2e tests for ${name}`, url)

    const agentUrl = new URL(url)
    agentUrl.pathname = agentPath

    const resultUrl = new URL(url)
    resultUrl.pathname = resultPath

    try {
      execSync(
        `npm exec -y "git+https://github.com/fingerprintjs/dx-team-mock-for-proxy-integrations-e2e-tests.git" -- --api-url="https://${apiUrl}" --cdn-proxy-url="${agentUrl.toString()}" --ingress-proxy-url="${resultUrl.toString()}" --traffic-name="fingerprintjs-pro-cloudfront" --integration-version="${version}"`,
        {
          stdio: 'inherit',
        }
      )
    } catch (e) {
      console.error(`Test for ${name} failed`, e)

      hasError = true
    }
  }

  if (hasError) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
