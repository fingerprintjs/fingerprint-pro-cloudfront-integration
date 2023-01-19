# Contributing to FingerprintJS Pro Cloudflare Integration

## Working with code

We prefer using [yarn](https://yarnpkg.com/) for installing dependencies and running scripts.

The `main` and `develop` branches are locked for the push action. 

`main` branch is always where we create releases. If you have CloudFront Integration set up, the source code is from the `main` branch. 

`develop` branch can be taught of as candidate for the next release. The code always passes the tests in `develop` branch. 

For proposing changes, use the standard [pull request approach](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request). It's recommended to discuss fixes or new functionality in the Issues, first.

Create pull requests for `develop` branch. No pull requests to `main` branch will be accepted.

### How to build
After cloning the repo, run `yarn install` to install packages.

Run `yarn build` for creating a build in `dist` folder. After building, `dist/fingerprintjs-pro-cloudfront-lambda-function.js` file is created, and it is used to deploy to Lambda@Edge.

### How to deploy to Lambda@Edge

Install [AWS CLI](https://aws.amazon.com/cli/) provided by AWS.
Configure AWS CLI according to the [guide](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-quickstart.html).

You need Lambda function created at [AWS Console](https://us-east-1.console.aws.amazon.com/lambda). In case of Lambda@Edge function for CloudFront distribution it's required to create the function in `us-east-1` region.

Prepare a zip file that contains Lambda@Edge function (`dist/fingerprintjs-pro-cloudfront-lambda-function`).
Then, you can run `aws lambda update-function-code --function-name <LAMBDA_FUNCTION_NAME> --region <AWS_REGION> --zip-file fileb://lambda.zip --publish`

You can invoke the function from your local environment using [Invoke command](https://awscli.amazonaws.com/v2/documentation/api/latest/reference/lambda/invoke.html) from AWS CLI. For example, `aws lambda invoke --function-name <LAMBDA_FUNCTION_NAME> --region <AWS_REGION> --invocation-type RequestResponse --payload <EVENT_JSON>`. `<EVENT_JSON>` is the JSON that you want to provide to your Lambda function as input. Please refer to [examples](test/lambda) of events.

If you want to deploy your function to CloudFront distribution please follow the [guide](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-edge-how-it-works-tutorial.html#lambda-edge-how-it-works-tutorial-add-trigger).

### Code style

The code style is controlled by [ESLint](https://eslint.org/) and [Prettier](https://prettier.io/). Run to check that the code style is ok:
```shell
yarn lint
```

You aren't required to run the check manually, the CI will do it. Run the following command to fix style issues (not all issues can be fixed automatically):
```shell
yarn lint:fix
```

### Commit style

You are required to follow [conventional commits](https://www.conventionalcommits.org) rules.

### How to test

End-to-end tests are located in `e2e` folder and run by [playwright](https://github.com/microsoft/playwright) environment. 
These tests are run automatically by the `deploy_test_branch.yml` workflow on every PR automatically, you don't need to run them locally. 

### How to release a new version

The workflow `release.yml` is responsible for releasing a new version. It has to be run on `develop` branch, and at the end it will create a release and a PR to `main` branch.

### How to keep your worker up-to-date

CloudFront Integration by Fingerprint always uses the latest stable version for the customers and upgrades customer Lambda@Edge automatically by running CodePipeline once a new version of Lambda@Edge function is available on the public [S3 bucket](s3://fingerprint-pro-cloudfront-integration-lambda-function/release/lambda_latest.zip). The serverless application that contains the CodePipeline is responsible for delivering new updates from the S3 bucket to the customer's infrastructure.