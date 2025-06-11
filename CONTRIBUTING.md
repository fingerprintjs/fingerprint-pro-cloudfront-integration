# Contributing to Fingerprint Pro CloudFront Integration

## Working with code

We prefer using [pnpm](https://pnpm.io/) for installing dependencies and running scripts.


For proposing changes, use the standard [pull request approach](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request). It's recommended to discuss fixes or new functionality in the Issues, first.

* The `main` and `rc` branches are locked for the push action.
* Releases are created from the `main` branch. If you have CloudFront Integration set up, it is running code from the `main` branch. Pull requests into the `main` branch are not accepted.
* The `rc` branch functions as a candidate for the next release. Create your pull requests into this branch. The code in `rc` must always pass the tests. 


### How to build
* After cloning the repository, run `pnpm install` to install dependencies.

* Run `pnpm build` to build the project into the `dist` folder. The created `dist/fingerprintjs-pro-cloudfront-lambda-function.js` file is meant to be deployed to Lambda@Edge.

### How to deploy to Lambda@Edge

1. Install the [AWS CLI](https://aws.amazon.com/cli/) and configure it according to the [AWS CLI Guide](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-quickstart.html).
2. Create a Lambda function using the [AWS Console](https://us-east-1.console.aws.amazon.com/lambda). For the Lambda function for CloudFront distribution, you must create it in the `us-east-1` region.
3. Prepare a `.zip` archive that contains the built Lambda@Edge function (`dist/fingerprintjs-pro-cloudfront-lambda-function.js`).
4. Run 
    ```shell
    aws lambda update-function-code --function-name <LAMBDA_FUNCTION_NAME> --region <AWS_REGION> --zip-file file://lambda.zip --publish
    ```

You can invoke the function from your local environment using the [Invoke command](https://awscli.amazonaws.com/v2/documentation/api/latest/reference/lambda/invoke.html) in the AWS CLI, for example `aws lambda invoke --function-name <LAMBDA_FUNCTION_NAME> --region <AWS_REGION> --invocation-type RequestResponse --payload <EVENT_JSON>`, where the `<EVENT_JSON>` is the JSON you want to provide to your Lambda function as input. See [examples of events here](proxy/test/lambda).

To deploy your function to your CloudFront distribution follow the [Cloudfront Developer Guide](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/lambda-edge-how-it-works-tutorial.html#lambda-edge-how-it-works-tutorial-add-trigger).

### Code style

Consistent code formatting is enforced by [ESLint](https://eslint.org/) and [Prettier](https://prettier.io/). To check your code, run:
```shell
pnpm lint
```

You don't need to do this manually, CI runs the check automatically. To fix all auto-fixable issues at once, run:
```shell
pnpm lint:fix
```

### Commit style

You are required to follow [conventional commits](https://www.conventionalcommits.org) rules.

### How to test

End-to-end tests are written using [Playwright](https://github.com/microsoft/playwright) and use [Terraform](https://developer.hashicorp.com/terraform) to deploy the required infrastructure. They are located in the [e2e](e2e) directory.
These tests run automatically on every pull request via the [terraform-e2e-tests-on-dev.yml](.github/workflows/terraform-e2e-tests-on-dev.yml) workflow, so there's no need to run them locally.

### How to release a new version

Every PR should target `rc` branch first. Upon merge, if there are relevant changes a new release candidate is created.
When that happens, an automated PR is created to `main` branch, and E2E tests run against it. If the tests pass, the PR can be merged and the release is created.

The integration is automatically released on every push to the main branch if there are relevant changes. The workflow must be approved by one of the maintainers, first.

### How to keep your integration up-to-date

CloudFront Integration by Fingerprint always uses the latest stable version for the customers and keeps it up-to-date by using the management Lambda function created during the installation.

### Testing against custom CDN and API hosts

During testing, you might need the integration to proxy requests to the CDN and API hosts of your choosing (for example, the staging environment) instead of the production Fingerprint CDN and API.

To achieve this, you can add your custom *host* (not URL) values to the **AWS Secret** associated with the proxy integration: 

```
FPJS_CDN_URL: your.cdn.net
FPJS_INGRESS_BASE_HOST: your.api.net
```

