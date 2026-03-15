#!/bin/bash
set -e

cd /www/wwwroot/Gitjeenoraserver || exit

echo "Pulling latest code..."
git fetch --all
git reset --hard origin/main

echo "Installing production dependencies..."
npm ci --omit=dev

echo "Reloading app..."
pm2 reload GitJeenoraserver --update-env

pm2 save

echo "Deployment successful."
