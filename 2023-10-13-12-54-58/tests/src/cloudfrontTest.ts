import { test } from '@playwright/test'
import { CloudfrontUrls, urlTypeCustomerVariableSourceMap } from './cloudfront'
import { extractUrlTypeFromProjectName } from './project'

export const cloudfrontTest = test.extend<{
  urlType: keyof CloudfrontUrls
  customerVariableSource: string | null
}>({
  urlType: async ({}, use, testInfo) => {
    const urlType = extractUrlTypeFromProjectName(testInfo.project.name)

    await use(urlType)
  },
  customerVariableSource: async ({ urlType }, use) => {
    await use(urlTypeCustomerVariableSourceMap[urlType])
  },
})
