const commitSHA = process.env.COMMIT_SHA
const gitHubRepo = process.env.GITHUB_REPOSITORY

const apiURL = `repos/${gitHubRepo}/commits/${commitSHA}/check-runs`
const fullURL = `https://api.github.com/${apiURL}`

const E2E_TEST_NAME = "Run e2e for releases and pre-releases"
const POLL_WAIT_DURATION = 30_000

function checkEnv() {
  if (!commitSHA) {
    throw new Error("env var COMMIT_SHA not found.")
  }

  console.log(`COMMIT_SHA=${commitSHA}`)

  if (!gitHubRepo) {
    throw new Error("env var GITHUB_REPOSITORY not found.")
  }

  console.log(`GITHUB_REPOSITORY=${gitHubRepo}`)
}

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function findCheckRun() {
  const response = await fetch(fullURL)
  if (!response.ok) {
    throw new Error(`request to GitHub failed with HTTP ${response.status}.`)
  }

  const responseBody = await response.json()
  console.log(`# of check runs: ${responseBody.check_runs.length}`)
  return responseBody.check_runs.find(r => r.name === E2E_TEST_NAME)
}

async function main() {
  checkEnv()

  while (true) {
    const checkRun = await findCheckRun()
    if (checkRun) {
      const conclusion = checkRun.conclusion
      console.log(`conclusion=${conclusion}`)
      if (conclusion === "success") {
        break
      }

      if (conclusion === "failure") {
        throw new Error("e2e test has failed. Exiting")
      }
    }

    await wait(POLL_WAIT_DURATION)
  }

  console.log("e2e test has passed! Exiting")
}


main().catch((err) => {
  console.error(err)
  process.exit(1)
})
