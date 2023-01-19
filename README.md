<p align="center">
  <a href="https://fingerprint.com">
    <picture>
     <source media="(prefers-color-scheme: dark)" srcset="assets/logo_light.svg" />
     <source media="(prefers-color-scheme: light)" srcset="assets/logo_dark.svg" />
     <img src="assets/logo_dark.svg" alt="Fingerprint logo" width="312px" />
   </picture>
  </a>
<p align="center">
<a href="https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration">
  <img src="https://img.shields.io/github/v/release/fingerprintjs/fingerprint-pro-cloudfront-integration" alt="Current version">
</a>
<a href="https://fingerprintjs.github.io/fingerprint-pro-cloudfront-integration">
  <img src="https://fingerprintjs.github.io/fingerprint-pro-cloudfront-integration/badges.svg" alt="coverage">
</a>
<a href="https://opensource.org/licenses/MIT">
  <img src="https://img.shields.io/:license-mit-blue.svg" alt="MIT license">
</a>
<a href="https://discord.gg/39EpE2neBg">
  <img src="https://img.shields.io/discord/852099967190433792?style=logo&label=Discord&logo=Discord&logoColor=white" alt="Discord server">
</a>

# Fingerprint Pro CloudFront Integration

> **Warning**
> This project is in the Private Beta phase. For more information, reach out to [support@fingerprint.com](mailto:support@fingerprint.com).

Fingerprint Pro CloudFront Integration is responsible for

* Proxying download requests of the latest Fingerprint Pro JS Agent between your site and Fingerprint CDN.
* Proxying identification requests and responses between your site and Fingerprint Pro's APIs.

This [improves](https://dev.fingerprint.com/docs/cloudfront-proxy-integration#the-benefits-of-using-the-cloudfront-integration) both accurancy and reliability of visitor identification and bot detection on your site.

## Setup

To set up Cloudfront integration, you need to 

1. Create the required resources in your AWS infrastructure — a secret stored in the Secret Manager, a CloudFormation stack, and a CloudFront distribution.
2. Configure the Fingerprint Pro JS Agent on your site to communicate with your created Lambda@Edge function using the [endpoint](https://dev.fingerprint.com/docs/js-agent#endpoint) parameter.


See [Cloudflare Proxy Integration guide](https://dev.fingerprint.com/docs/cloudfront-proxy-integration) in our documentation for step-by-step instructions. Some steps require contacting our support team, which you can do at [support@fingerprint.com](mailto:support@fingerprint.com). 

## License

This project is licensed under the MIT license. See the [LICENSE](https://github.com/fingerprintjs/fingerprintjs-pro-cloudflare-worker/blob/main/LICENSE) file for more info.
