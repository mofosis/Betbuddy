#!/bin/bash
# Run this on your VPS to deploy/update
set -e

cd /opt/vps

echo "==> Pulling latest code..."
git -C betbuddy pull origin main
git -C vinoreveal pull origin main

echo "==> Building Docker images..."
docker compose build --pull

echo "==> Starting containers..."
docker compose up -d --remove-orphans

echo "==> Status:"
docker compose ps

echo "Done!"
