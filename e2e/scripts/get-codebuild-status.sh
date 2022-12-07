#!/usr/bin/env sh

# Check if $CODEBUILD_BUILD_SUCCEEDING equals 1. If yes, then echo "success", otherwise echo "error"
if [ "$CODEBUILD_BUILD_SUCCEEDING" == 1 ]; then
  echo "success"
else
  echo "error"
fi
