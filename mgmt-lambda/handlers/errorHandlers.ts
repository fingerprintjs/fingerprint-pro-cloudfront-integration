import { APIGatewayProxyResult } from 'aws-lambda'

export async function handleNoAthentication(): Promise<APIGatewayProxyResult> {
  const body = {
    status: 'Token is not specified or not valid',
  }
  return {
    statusCode: 401,
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
    },
  }
}

export async function handleWrongConfiguration(error: any): Promise<APIGatewayProxyResult> {
  const body = {
    status:
      'Wrong function configuration. Check environment variables for Lambda@Edge function and CloudFront Distribution id',
    error: error.message || error,
  }
  return {
    statusCode: 500,
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
    },
  }
}

export async function handleNotFound(): Promise<APIGatewayProxyResult> {
  const body = {
    status: 'Path not found',
  }
  return {
    statusCode: 404,
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
    },
  }
}
