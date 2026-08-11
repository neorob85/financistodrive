#!/usr/bin/env sh
# Build the Docker image tagging it with the version from package.json + latest.
#
#   ./build.sh              -> financistodrive:1.0.0 + financistodrive:latest
#   IMAGE_NAME=myrepo/financistodrive ./build.sh
#   PUSH=1 ./build.sh       -> also pushes both tags to the registry
set -e

cd "$(dirname "$0")"

VERSION=$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' package.json | head -1)
IMAGE=${IMAGE_NAME:-financistodrive}

if [ -z "$VERSION" ]; then
  echo "Cannot read \"version\" from package.json" >&2
  exit 1
fi

echo "Building $IMAGE:$VERSION"

docker build \
  --build-arg APP_VERSION="$VERSION" \
  -t "$IMAGE:$VERSION" \
  -t "$IMAGE:latest" \
  .

if [ "$PUSH" = "1" ]; then
  docker push "$IMAGE:$VERSION"
  docker push "$IMAGE:latest"
fi

echo "Done: $IMAGE:$VERSION and $IMAGE:latest"
