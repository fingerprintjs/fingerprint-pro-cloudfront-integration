import * as winston from 'winston'
import { CloudFrontRequest } from 'aws-lambda'
import { getHeaderValue } from './utils/headers'

export function createLogger(request?: CloudFrontRequest) {
  const debugValue = request ? getHeaderValue(request, 'fpjs_debug') : undefined
  const isDebug = debugValue === 'true'

  return winston.createLogger({
    level: isDebug ? 'debug' : 'info',
    format: winston.format.json({
      space: 1,
      replacer: (_key, value) => {
        if (value instanceof Error) {
          return {
            name: value.name,
            message: value.message,
            stack: isDebug ? value.stack : undefined,
          }
        }

        return value
      },
    }),
    transports: [new winston.transports.Console()],
  })
}

export type Logger = winston.Logger
