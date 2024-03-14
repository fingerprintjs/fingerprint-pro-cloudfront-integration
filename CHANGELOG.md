## [2.0.1-rc.2](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/compare/v2.0.1-rc.1...v2.0.1-rc.2) (2024-03-14)


### Bug Fixes

* use default region for getting secret ([ec596ec](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/ec596ec9d28869a082d783c8af491b7be65e9699))

## [2.0.1-rc.1](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/compare/v2.0.0...v2.0.1-rc.1) (2024-03-11)


### Bug Fixes

* normalize secret before retrieving values ([26ab35f](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/26ab35fdfae90a796f8a6822bcfe26613a95653d))

## [2.0.0-rc.2](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/compare/v2.0.0-rc.1...v2.0.0-rc.2) (2024-03-08)


### Bug Fixes

* normalize secret before retrieving values ([e51702e](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/e51702e6bfe54db2ff7969be37f9646b815469c8))

## [2.0.0](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/compare/v1.4.0...v2.0.0) (2024-03-01)


### ⚠ BREAKING CHANGES

* use node 20

### Features

* add endpoints structure and error handlers ([c473539](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/c473539d7613ae444b8f4746f0b5a21b5f8c521e))
* add event and ctx types ([82c053b](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/82c053b805dbd93b82683c57d85771b891b49792))
* add lambda function update ([38b445f](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/38b445f8c04c71936e92432f2586e8ca09a811b7))
* add settings secret, update mgmt lambda permissions ([#162](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/issues/162)) ([ab3caa5](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/ab3caa58276da4492f316b2a6a53ddd3149b00ce))
* improve error handling in mgmt-lambda ([3736d14](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/3736d14c55d596271ad7f077fa17fabebd9681f2))
* increase timeout for Fingerprint lambda ([1e0ae54](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/1e0ae5486c93b51136e59e1369641aad6de3c8f7))
* introduce deployment settings ([ec13d5f](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/ec13d5f8f6e4c84f20b2f91bbcbb56ef16a8237d))
* introduce mgmt-token scheme for authorization ([#176](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/issues/176)) ([c884027](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/c88402799c96a97f4f1ea99601c8fdba357dd20b))
* **mgmt-lambda-update:** introduce error codes ([6929756](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/6929756b015f10d76b08c35dbf2f96db8fe4ddb3))
* pass AWS clients into handlers ([1aa3dc8](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/1aa3dc839a8724c7b4c224dfbaeb9ff54c440300))
* rework logging ([#184](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/issues/184)) ([a88941c](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/a88941cdd58a41fbec23e23d4cf5201afc24105e))
* reworked getting env, updated tests ([0b29764](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/0b29764d366ca2266a67473882fd87f3a6b03529))
* rollout as a code ([#161](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/issues/161)) ([0636c1a](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/0636c1aa4f230f466e6f1d49542559cc9f5b5ede))
* update all cache behavior that has fingerprint pro association ([#186](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/issues/186)) ([2970364](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/2970364d224245b3fbc12e83c0a46abe0c1c6755))
* update lambda existence check ([403680c](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/403680cf76058fbfa75ad38619466fc2fcf2d522))
* update package management ([#189](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/issues/189)) ([5135b1b](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/5135b1b6068b68c085bbb6429b22d85d529dccd5))
* update secrets manager to V3, retrieve secret in mgmt-lambda ([a60bee4](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/a60bee41bd1e4759b86230671d3fde61185d5560))
* upgrade Lambda functions runtime to Node 20 ([2818c30](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/2818c3065331b2565e7bc55f318d564b1d80bb3c))
* use AWS SDK v3 Client mock for testing ([0bb22ce](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/0bb22ce72eb3424cc712b6b386f13ac1d6dad248))


### Bug Fixes

* cloudformation templatex ([#188](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/issues/188)) ([a32e4ff](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/a32e4ffee5086321355fffc2e5f0f2a6d87ee972))
* remove aws-sdk v2 usage ([b1d0d72](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/b1d0d7281bc25a286fa842249de512df9b21e641))
* remove CodePipeline client ([ed7d52d](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/ed7d52d3c8e67e97bb8276f4b39143c45bb63529))
* remove CodePipeline part from mgmt code ([fb79578](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/fb79578b29199ca09f71bdf5bd9b83fb21f3beab))
* set correct type for public URL events ([379ec65](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/379ec65a5cbdf6da0fb370bc435ac470831ad558))
* update handleResult tests with comparing hrefs ([aeb49c8](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/aeb49c8e3c0a3007cd8891fe74bb86ecf449c817))
* update logging ([07664bc](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/07664bc351a914365c9fef1adff67295dfc0dfa4))

## [2.0.0-rc.1](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/compare/v1.4.0...v2.0.0-rc.1) (2024-02-29)


### ⚠ BREAKING CHANGES

* use node 20

### Features

* add endpoints structure and error handlers ([c473539](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/c473539d7613ae444b8f4746f0b5a21b5f8c521e))
* add event and ctx types ([82c053b](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/82c053b805dbd93b82683c57d85771b891b49792))
* add lambda function update ([38b445f](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/38b445f8c04c71936e92432f2586e8ca09a811b7))
* add settings secret, update mgmt lambda permissions ([#162](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/issues/162)) ([ab3caa5](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/ab3caa58276da4492f316b2a6a53ddd3149b00ce))
* improve error handling in mgmt-lambda ([3736d14](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/3736d14c55d596271ad7f077fa17fabebd9681f2))
* increase timeout for Fingerprint lambda ([1e0ae54](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/1e0ae5486c93b51136e59e1369641aad6de3c8f7))
* introduce deployment settings ([ec13d5f](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/ec13d5f8f6e4c84f20b2f91bbcbb56ef16a8237d))
* introduce mgmt-token scheme for authorization ([#176](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/issues/176)) ([c884027](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/c88402799c96a97f4f1ea99601c8fdba357dd20b))
* **mgmt-lambda-update:** introduce error codes ([6929756](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/6929756b015f10d76b08c35dbf2f96db8fe4ddb3))
* pass AWS clients into handlers ([1aa3dc8](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/1aa3dc839a8724c7b4c224dfbaeb9ff54c440300))
* rework logging ([#184](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/issues/184)) ([a88941c](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/a88941cdd58a41fbec23e23d4cf5201afc24105e))
* reworked getting env, updated tests ([0b29764](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/0b29764d366ca2266a67473882fd87f3a6b03529))
* rollout as a code ([#161](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/issues/161)) ([0636c1a](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/0636c1aa4f230f466e6f1d49542559cc9f5b5ede))
* update all cache behavior that has fingerprint pro association ([#186](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/issues/186)) ([2970364](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/2970364d224245b3fbc12e83c0a46abe0c1c6755))
* update lambda existence check ([403680c](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/403680cf76058fbfa75ad38619466fc2fcf2d522))
* update package management ([#189](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/issues/189)) ([5135b1b](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/5135b1b6068b68c085bbb6429b22d85d529dccd5))
* update secrets manager to V3, retrieve secret in mgmt-lambda ([a60bee4](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/a60bee41bd1e4759b86230671d3fde61185d5560))
* upgrade Lambda functions runtime to Node 20 ([2818c30](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/2818c3065331b2565e7bc55f318d564b1d80bb3c))
* use AWS SDK v3 Client mock for testing ([0bb22ce](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/0bb22ce72eb3424cc712b6b386f13ac1d6dad248))


### Bug Fixes

* cloudformation templatex ([#188](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/issues/188)) ([a32e4ff](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/a32e4ffee5086321355fffc2e5f0f2a6d87ee972))
* remove aws-sdk v2 usage ([b1d0d72](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/b1d0d7281bc25a286fa842249de512df9b21e641))
* remove CodePipeline client ([ed7d52d](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/ed7d52d3c8e67e97bb8276f4b39143c45bb63529))
* remove CodePipeline part from mgmt code ([fb79578](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/fb79578b29199ca09f71bdf5bd9b83fb21f3beab))
* set correct type for public URL events ([379ec65](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/379ec65a5cbdf6da0fb370bc435ac470831ad558))
* update handleResult tests with comparing hrefs ([aeb49c8](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/aeb49c8e3c0a3007cd8891fe74bb86ecf449c817))
* update logging ([07664bc](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/07664bc351a914365c9fef1adff67295dfc0dfa4))

## [1.4.1-rc.1](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/compare/v1.4.0...v1.4.1-rc.1) (2023-12-15)


### Bug Fixes

* install node in the release buildspec ([c940d20](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/c940d20ce6a6352cd8f958203be270f37f0b6b2f))

## [1.4.0](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/compare/v1.3.3...v1.4.0) (2023-12-14)


### Features

* **proxy-host-header:** add proxy host header, remove PSL ([0a23f39](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/0a23f397fe25d8872e1b950941248f3204add9de))


### Bug Fixes

* remove domain field from handlers options ([e14bb50](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/e14bb506a02648d15d07700c3a6d36deb0098ee7))
* update test data ([2f4a94e](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/2f4a94e07ea18b43d553bc91429a6d90c132570d))

## [1.4.0-rc.1](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/compare/v1.3.3...v1.4.0-rc.1) (2023-12-14)


### Features

* **proxy-host-header:** add proxy host header, remove PSL ([0a23f39](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/0a23f397fe25d8872e1b950941248f3204add9de))


### Bug Fixes

* remove domain field from handlers options ([e14bb50](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/e14bb506a02648d15d07700c3a6d36deb0098ee7))
* update test data ([2f4a94e](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/2f4a94e07ea18b43d553bc91429a6d90c132570d))

## [1.3.3](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/compare/v1.3.2...v1.3.3) (2023-12-13)


### Bug Fixes

* add types for parameter extraction functions ([d84aaeb](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/d84aaeb50bb61b44116b359a46f4227727e728c7))
* improve endpoint creation ([006c91b](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/006c91b594c41fe4fb85a143496d4738aaf06793))

## [1.3.3-rc.1](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/compare/v1.3.2...v1.3.3-rc.1) (2023-12-13)


### Bug Fixes

* add types for parameter extraction functions ([d84aaeb](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/d84aaeb50bb61b44116b359a46f4227727e728c7))
* improve endpoint creation ([006c91b](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/006c91b594c41fe4fb85a143496d4738aaf06793))

## [1.3.2](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/compare/v1.3.1...v1.3.2) (2023-12-04)


### Bug Fixes

* **build:** validate env values ([4ccc2d4](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/4ccc2d4851cbd322e44dd85d593c53637cfb75a4))


### Documentation

* **README:** mention new release flow ([92ff0fe](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/92ff0fe6b88319048e679bca7fb3f31caf760699))

## [1.3.2-rc.1](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/compare/v1.3.1...v1.3.2-rc.1) (2023-12-04)


### Bug Fixes

* **build:** validate env values ([4ccc2d4](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/4ccc2d4851cbd322e44dd85d593c53637cfb75a4))


### Documentation

* **README:** mention new release flow ([92ff0fe](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/92ff0fe6b88319048e679bca7fb3f31caf760699))

## [1.3.2-rc.1](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/compare/v1.3.1...v1.3.2-rc.1) (2023-12-01)


### Bug Fixes

* **build:** validate env values ([4ccc2d4](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/4ccc2d4851cbd322e44dd85d593c53637cfb75a4))

## [1.3.1](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/compare/v1.3.0...v1.3.1) (2023-11-09)


### Build System

* **deps:** bump @babel/traverse from 7.20.0 to 7.23.3 ([08e41a3](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/08e41a3caf882982fa49890ab185caee1b16eeb5))

## [1.3.0](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/compare/v1.2.0...v1.3.0) (2023-10-31)


### Features

* enable semantic-release with prod releases ([7847f0a](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/7847f0a81a8dcfa384d2939f3acaeabd4b7a2e4a))

## [1.2.0](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/compare/v1.1.6...v1.2.0) (2023-10-30)


### Features

* migrate to semantic-release ([d809899](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/d8098992691bb632e6a774c576e160d7ddbe2a27))


### Bug Fixes

* change TTL=0 for Fingerprint integration cache policy ([7f1e741](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/7f1e741674a7b1a87ea46639b171ad2d0efa8e13))


### Documentation

* **README:** add requirements section ([f468840](https://github.com/fingerprintjs/fingerprint-pro-cloudfront-integration/commit/f4688400f190733e110b52c37bb1648cef57c1db))
