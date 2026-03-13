# Deployment Summary - Jeenora Backend

**Date:** December 30, 2025
**Server IP:** 103.194.228.161
**Domain:** https://api.jeenora.com
**Port:** 5000 (Internal) / 443 (External HTTPS)
**Status:** ✅ Live & Secured with SSL (Certbot)

## 1. Overview
We successfully deployed the Node.js backend to your VPS. The application is now running under **PM2** (Process Manager) and is accessible via HTTP.

## 2. Steps Executed

### A. Environment Setup
1.  **System Update:** Updated Ubuntu packages.
2.  **Node.js Installation:** Installed Node.js v20.
3.  **Puppeteer Dependencies:** Installed necessary system libraries (Linux-specific) for PDF/Screenshot generation (Chromium support).
4.  **PM2 Installation:** Installed PM2 globally to keep the server running in the background.

### B. Codebase Deployment
1.  **Git Integration:** Cloned the repository `https://github.com/Jeena-softwareDeveloper/Jeenora_server.git`.
2.  **Dependencies:** Ran `npm install` to install all project libraries.

### C. Configuration
1.  **Environment Variables:** Created the `.env` file with:
    *   Database URL (MongoDB Atlas)
    *   Cloudinary Keys
    *   Port (5000)
    *   Payment Gateway Configs (PhonePe, Razorpay)
    *   `ALLOWED_ORIGINS` (Fixed CORS)
    *   Updated Redirect URLs from `localhost` to the VPS IP.

### D. Critical Bug Fixes (Linux Compatibility)
During deployment, the server failed to start due to **"Module Not Found"** errors.

*   **Issue:** Windows is case-insensitive (treats `file.js` and `File.js` as the same), but Linux is case-sensitive.
*   **The Error:** The code was importing `require('../../models/hire/ApplicationModel')` but the actual file name was `applicationModel.js` (lowercase 'a').
*   **The Fix:** We updated the imports in 4 files to match the exact filename:
    1.  `controllers/admin/adminJobController.js`
    2.  `controllers/admin/adminApplicationController.js`
    3.  `controllers/hire/applicationController.js`
    4.  `controllers/hire/jobMessageController.js`

### E. Firewall & Security
1.  **UFW (Uncomplicated Firewall):** Allowed traffic on Port **5000** and **22** (SSH).

## 3. How to Update in Future
If you make changes to your code locally and want to update the server:

1.  **Push changes from VS Code:**
    ```bash
    git add .
    git commit -m "Your message"
    git push origin main
    ```

2.  **Pull changes on VPS:**
    SSH into your server and run:
    ```bash
    cd Jeenora_server
    git pull origin main
    npm install  # Only if you installed new packages
    pm2 restart backend
    ```

## 4. Useful Commands
*   **Check Logs:** `pm2 logs backend`
*   **Restart Server:** `pm2 restart backend`
*   **Stop Server:** `pm2 stop backend`
*   **Server Status:** `pm2 list`
