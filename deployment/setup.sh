#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "🚀 Starting VPS Setup for Jeenora Backend..."

# 1. Update System
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js 20 (LTS)
echo "🟢 Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Install Global Tools (PM2, Yarn)
echo "🛠️ Installing PM2..."
sudo npm install -g pm2

# 4. Install Dependencies for Puppeteer/Chrome
echo "🌐 Installing Puppeteer Dependencies..."
sudo apt install -y ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libgcc1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 lsb-release wget xdg-utils

# 5. Install Nginx (Optional, for Reverse Proxy)
echo "🌍 Installing Nginx..."
sudo apt install -y nginx

# 6. Allow Nginx in Firewall
if command -v ufw > /dev/null; then
    echo "🛡️ Configuring Firewall..."
    sudo ufw allow 'Nginx Full'
    sudo ufw allow OpenSSH
    sudo ufw --force enable
fi

echo "✅ VPS Setup Complete! You are ready to deploy your code."
