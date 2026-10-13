#!/bin/bash
set -euo pipefail          # stop at the first failing command
SHA=$(git rev-parse --short HEAD)
IMAGE="sample-api:$SHA"

echo "=== Stage 1: Build ==="
npm install

echo "=== Stage 2: Test ==="
npm test

echo "=== Stage 3: Package ==="
docker build -t "$IMAGE" .
echo "Artifact: $IMAGE"

echo "=== Stage 4: Deploy to dev ==="
docker rm -f sample-api-dev 2>/dev/null || true
docker run -d --name sample-api-dev -p 3005:3000 "$IMAGE"
sleep 2
curl -fsS http://localhost:3005/health && echo " <- dev health check passed"

echo "=== Stage 5: Approval for production ==="
read -p "Deploy $IMAGE to production? (yes/no) " ANSWER
[ "$ANSWER" = "yes" ] && echo "Deploying to production (simulated)" || echo "Production deploy skipped"
