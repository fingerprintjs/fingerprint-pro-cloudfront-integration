import { expect } from '@playwright/test'
import { StatusInfo } from '../../../../src/handlers/handleStatus'
import { OBFUSCATED_VALUE } from '../../../../src/utils/customer-variables/maybe-obfuscate-variable'
import { cloudfrontTest } from '../cloudfrontTest'

cloudfrontTest.describe('Status check', () => {
  cloudfrontTest(
    'should return correct status info',
    async ({ page, customerVariableSource: expectedCustomerVariableSource, urlType }) => {
      if (urlType === 'cloudfrontWithoutVariables') {
        cloudfrontTest.skip()
      }

      await page.goto('/fpjs/status', {
        waitUntil: 'networkidle',
      })

      const json = (await page.evaluate(() => {
        return JSON.parse(document.body.textContent ?? '')
      })) as StatusInfo

      expect(json).toBeTruthy()
      expect(typeof json.version).toBe('string')
      expect(json.envInfo).toBeTruthy()

      json.envInfo.forEach((env) => {
        expect(env.isSet).toBe(true)
        expect(env.value).toBeTruthy()
        expect(env.resolvedBy).toBe(expectedCustomerVariableSource)
        expect(typeof env.envVarName).toBe('string')

        if (env.envVarName === 'fpjs_pre_shared_secret') {
          expect(env.value).toBe(OBFUSCATED_VALUE)
        }
      })
    },
  )
})
