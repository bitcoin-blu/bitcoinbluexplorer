#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
docker/init.sh local
SHORT_SHA="$(git rev-parse --short HEAD)"
docker buildx build \
  --tag bblu-explorer-frontend:local \
  --build-arg commitHash="$SHORT_SHA" \
  --load \
  ./frontend/
docker buildx build \
  --tag bblu-explorer-backend:local \
  --build-context rustgbt=./rust \
  --build-context backend=./backend \
  --build-arg commitHash="$SHORT_SHA" \
  --load \
  ./backend/
