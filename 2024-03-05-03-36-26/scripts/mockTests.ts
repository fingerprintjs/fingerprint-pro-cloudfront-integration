import { execSync } from 'child_process'
import { getCloudfrontUrls } from '../tests/src/cloudfront'

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

  for (const url of Object.values(cloudfrontUrls)) {
    console.info('Running mock server for', url)

    try {
      execSync(
        `npm exec -y "git+https://github.com/fingerprintjs/dx-team-mock-for-proxy-integrations-e2e-tests.git" -- --api-url="https://${apiUrl}" --host="${url}" --cdn-proxy-path="${agentPath}" --ingress-proxy-path="${resultPath}"`,
        {
          stdio: 'inherit',
        }
      )
    } catch (e) {
      console.error(e)

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
