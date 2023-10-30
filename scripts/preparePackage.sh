#!/bin/bash

cd dist
ls -a
zip -r package.zip *
ls -a
mv package.zip ../
cd ../
