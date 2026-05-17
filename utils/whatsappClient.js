const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const socketHelper = require('./socket');
const fs = require('fs');
const path = require('path');

class WhatsAppClient {
    constructor() {
        this.client = null;
        this.status = 'disconnected'; // disconnected, initializing, waiting_for_scan, connected
        this.qrCode = null;
    }

    async initialize(force = false) {
        if (!force && (this.status === 'connected' || this.status === 'initializing')) {
            console.log(`[WhatsApp] Already ${this.status}, skipping initialization.`);
            return;
        }

        if (force && this.client) {
            console.log('[WhatsApp] Force initialization requested. Destroying old client...');
            await this.destroy();
        }

        console.log('[WhatsApp] Starting initialization...');
        this.status = 'initializing';

        try {
            console.log('[WhatsApp] Launching Puppeteer browser...');
            this.client = new Client({
                authStrategy: new LocalAuth({
                    dataPath: path.join(process.cwd(), '.wwebjs_auth')
                }),
                puppeteer: {
                    headless: true,
                    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-extensions']
                }
            });

            // Set a safety timeout for initialization
            const initTimeout = setTimeout(() => {
                if (this.status === 'initializing') {
                    console.error('[WhatsApp] Initialization timed out! Retrying...');
                    this.initialize(true);
                }
            }, 45000); // 45 seconds timeout

            this.client.on('qr', async (qr) => {
                clearTimeout(initTimeout);
                console.log('[WhatsApp] QR RECEIVED! Automatic refresh triggered.');
                this.status = 'waiting_for_scan';
                try {
                    this.qrCode = await qrcode.toDataURL(qr);
                    const io = socketHelper.getIo();
                    if (io) io.emit('whatsapp_qr', { qr: this.qrCode });
                } catch (err) {
                    console.error('[WhatsApp] QR Generation Error:', err);
                }
            });

            this.client.on('ready', () => {
                clearTimeout(initTimeout);
                console.log('[WhatsApp] Client is READY!');
                this.status = 'connected';
                this.qrCode = null;
                const io = socketHelper.getIo();
                if (io) io.emit('whatsapp_ready');
            });

            this.client.on('authenticated', () => {
                console.log('[WhatsApp] Authenticated successfully.');
            });

            this.client.on('auth_failure', (msg) => {
                clearTimeout(initTimeout);
                console.error('[WhatsApp] Authentication failure:', msg);
                this.status = 'disconnected';
                const io = socketHelper.getIo();
                if (io) io.emit('whatsapp_auth_failed', { message: msg });
            });

            this.client.on('message', async (msg) => {
                const io = socketHelper.getIo();
                if (io) {
                    io.emit('whatsapp_log', {
                        msg: `Incoming from ${msg.from}: ${msg.body.substring(0, 50)}...`,
                        type: 'info'
                    });
                }

                // --- FORWARD TO AI ---
                try {
                    const aiMaster = require('../controllers/superadmin/aiMasterController');
                    await aiMaster.handleIncomingMessage(msg);
                } catch (aiErr) {
                    console.error('[WhatsApp AI Forward] Error:', aiErr.message);
                }
            });

        this.client.on('message_create', async (msg) => {
            if (msg.fromMe) {
                const io = socketHelper.getIo();
                if (io) {
                    io.emit('whatsapp_log', {
                        msg: `AI Response to ${msg.to}: ${msg.body.substring(0, 50)}...`,
                        type: 'success'
                    });
                }
            }
        });

        this.client.on('disconnected', async (reason) => {
                console.warn('[WhatsApp] Disconnected! Reason:', reason);
                this.status = 'disconnected';
                const io = socketHelper.getIo();
                if (io) io.emit('whatsapp_disconnected', { reason });
                await this.destroy();
                // Auto-retry initialization after a short delay
                setTimeout(() => this.initialize(), 5000);
            });

            await this.client.initialize();
        } catch (error) {
            console.error('[WhatsApp] Initialization error:', error);
            this.status = 'disconnected';
            // Retry after failure
            setTimeout(() => this.initialize(), 10000);
        }
    }

    async sendMessage(to, message) {
        if (this.status !== 'connected') {
            console.error(`[WhatsApp] Attempted to send message but status is: ${this.status}`);
            throw new Error(`WhatsApp not connected (Status: ${this.status})`);
        }

        // Format number: remove +, extra characters
        let formattedTo = to.replace(/[^0-9]/g, '');
        
        // AUTO-PREPEND 91 if it's a 10-digit number (Standard for Indian users)
        if (formattedTo.length === 10) {
            formattedTo = '91' + formattedTo;
        }

        const chatId = formattedTo.includes('@c.us') ? formattedTo : `${formattedTo}@c.us`;
        try {
            await this.client.sendMessage(chatId, message);
            return true;
        } catch (err) {
            console.error(`[WhatsApp] Send error to ${chatId}:`, err);
            throw err;
        }
    }

    async logout() {
        if (this.client) {
            try {
                await this.client.logout();
                this.status = 'disconnected';
                this.qrCode = null;
            } catch (err) {
                console.error('[WhatsApp] Logout error:', err);
            }
        }
    }

    async destroy() {
        if (this.client) {
            try {
                await this.client.destroy();
                this.client = null;
                this.status = 'disconnected';
                this.qrCode = null;
            } catch (err) {
                console.error('[WhatsApp] Destroy error:', err);
            }
        }
    }

    getStatus() {
        return {
            status: this.status,
            qrCode: this.qrCode
        };
    }
}

// Export a singleton instance
module.exports = new WhatsAppClient();
