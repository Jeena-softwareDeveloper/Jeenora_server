#!/bin/bash
set -e

# Change to the project directory
cd /www/wwwroot/Gitjeenoraserver || exit

echo "Pulling latest code from main branch..."
git fetch --all
git reset --hard origin/main

echo "Installing production dependencies..."
# npm ci is used for reliable, reproducible builds in production
npm ci --omit=dev

echo "Applying environment changes and reloading app..."
# Reload with --update-env ensures new environment variables are picked up
pm2 reload GitJeenoraserver --update-env

# Save the PM2 process list to persist across reboots
pm2 save

echo "------------------------------------------------"
echo "✅ Deployment successful!"
echo "------------------------------------------------"
