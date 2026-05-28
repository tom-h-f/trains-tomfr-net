#!/bin/bash
set -e

echo "Deploying backend Durable Object worker..."
bun run deploy:hub

echo "Building and deploying frontend UI..."
bun run deploy:ui

echo "Syncing code to the bridge VM (tf1)..."
rsync -avz lib scripts types package.json tsconfig.json bun.lock tf1:/home/tom/trains-bridge/

echo "Updating dependencies on VM..."
ssh tf1 "cd /home/tom/trains-bridge && /home/tom/.bun/bin/bun install"

echo "Restarting trains-bridge service on VM..."
ssh tf1 "sudo systemctl restart trains-bridge"

echo "Deployment completed successfully!"
