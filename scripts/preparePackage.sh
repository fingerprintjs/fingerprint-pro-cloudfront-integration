#!/bin/bash

cd dist

zip -r lambda_latest.zip fingerprintjs-pro-cloudfront-lambda-function.js
zip -r mgmt_lambda_latest.zip fingerprintjs-pro-cloudfront-mgmt-lambda-function.js

mv lambda_latest.zip ../
mv mgmt_lambda_latest.zip ../

cd ../
