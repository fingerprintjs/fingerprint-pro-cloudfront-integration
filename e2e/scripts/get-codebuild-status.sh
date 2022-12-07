#!/usr/bin/env sh

if [ "$CODEBUILD_BUILD_SUCCEEDING" == 1 ]; then
  echo "success"
else
  echo "failure"
fi
