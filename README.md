<p align="center">
  <a href="https://fingerprint.com">
    <picture>
     <source media="(prefers-color-scheme: dark)" srcset="https://fingerprintjs.github.io/home/resources/logo_light.svg" />
     <source media="(prefers-color-scheme: light)" srcset=https://fingerprintjs.github.io/home/resources/logo_dark.svg" />
     <img src="https://fingerprintjs.github.io/home/resources/logo_dark.svg" alt="Fingerprint logo" width="312px" />
   </picture>
  </a>
<p align="center">
<a href="https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration"><img src="https://img.shields.io/github/v/release/fingerprintjs/fingerprint-pro-cloudfront-integration" alt="Current version"></a>
<a href="https://fingerprintjs.github.io/fingerprint-pro-cloudfront-integration/coverage"><img src="https://fingerprintjs.github.io/fingerprint-pro-cloudfront-integration/coverage/badges.svg" alt="coverage"></a>
<a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/:license-mit-blue.svg" alt="MIT license"></a>
<a href="https://discord.gg/39EpE2neBg"><img src="https://img.shields.io/discord/852099967190433792?style=logo&label=Discord&logo=Discord&logoColor=white" alt="Discord server"></a>
</p>

# Fingerprint Pro CloudFront Integration

[Fingerprint](https://fingerprint.com/) is a device intelligence platform offering 99.5% accurate visitor identification.

Fingerprint Pro CloudFront Integration is responsible for

- Proxying download requests of the latest Fingerprint Pro JS Agent between your site and Fingerprint CDN.
- Proxying identification requests and responses between your site and Fingerprint Pro's APIs.

This [improves](https://dev.fingerprint.com/docs/cloudfront-proxy-integration#the-benefits-of-using-the-cloudfront-integration) both accuracy and reliability of visitor identification and bot detection on your site.

> [!IMPORTANT]  
> CloudFront integration v1 has been [deprecated](https://dev.fingerprint.com/docs/cloudfront-proxy-integration).
> This repository now contains the source code for [CloudFront Integration v2](https://dev.fingerprint.com/docs/cloudfront-proxy-integration-v2).
> If you are currently using v1, see our guide for [Migrating CloudFront proxy integration from v1 to v2](https://dev.fingerprint.com/docs/cloudfront-integration-migration-from-v1-to-v2).

## Requirements

- AWS Account

> [!IMPORTANT]  
> The AWS CloudFront Proxy Integration is accessible and exclusively supported for customers on the Enterprise Plan. Other customers are encouraged to use [Custom subdomain setup](https://dev.fingerprint.com/docs/custom-subdomain-setup) or [Cloudflare Proxy Integration](https://dev.fingerprint.com/docs/cloudflare-integration).

> [!WARNING]  
> The underlying data contract in the identification logic can change to keep up with browser updates. Using the AWS CloudFront Proxy Integration might require occasional manual updates on your side. Ignoring these updates will lead to lower accuracy or service disruption.

## How to install

To set up CloudFront integration, you need to:

1. Create the required resources in your AWS infrastructure — a CloudFormation stack and a CloudFront distribution.
2. Configure the Fingerprint Pro JS Agent on your site to communicate with your created Lambda@Edge function using the [scriptUrlPattern](https://dev.fingerprint.com/docs/js-agent#scripturlpattern) and [endpoint](https://dev.fingerprint.com/docs/js-agent#endpoint) parameters.

See [CloudFront Proxy Integration guide](https://dev.fingerprint.com/docs/cloudfront-proxy-integration-v2) in our documentation for step-by-step instructions. If you have any questions, reach out to our [support team](https://fingerprint.com/support/).

## License

This project is licensed under the MIT license. See the [LICENSE](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/blob/main/LICENSE) file for more info.
