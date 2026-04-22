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

    async initialize() {
        if (this.status === 'connected' || this.status === 'initializing') {
            console.log(`[WhatsApp] Already ${this.status}, skipping initialize.`);
            return;
        }

        console.log('[WhatsApp] Initializing WhatsApp Client...');
        this.status = 'initializing';

        this.client = new Client({
            authStrategy: new LocalAuth({
                dataPath: path.join(process.cwd(), '.wwebjs_auth')
            }),
            puppeteer: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process',
                    '--disable-gpu'
                ]
            }
        });

        this.client.on('qr', async (qr) => {
            console.log('[WhatsApp] QR Received');
            this.status = 'waiting_for_scan';
            try {
                this.qrCode = await qrcode.toDataURL(qr);
                const io = socketHelper.getIo();
                io.emit('whatsapp_qr', { qr: this.qrCode });
            } catch (err) {
                console.error('[WhatsApp] QR Generation Error:', err);
            }
        });

        this.client.on('ready', () => {
            console.log('[WhatsApp] Client is READY');
            this.status = 'connected';
            this.qrCode = null;
            const io = socketHelper.getIo();
            io.emit('whatsapp_ready');
        });

        this.client.on('authenticated', () => {
            console.log('[WhatsApp] Authenticated successfully');
        });

        this.client.on('auth_failure', (msg) => {
            console.error('[WhatsApp] Authentication failure:', msg);
            this.status = 'disconnected';
            const io = socketHelper.getIo();
            io.emit('whatsapp_auth_failed', { message: msg });
        });

        this.client.on('disconnected', (reason) => {
            console.log('[WhatsApp] Client was logged out:', reason);
            this.status = 'disconnected';
            const io = socketHelper.getIo();
            io.emit('whatsapp_disconnected', { reason });
            this.destroy();
        });

        try {
            await this.client.initialize();
        } catch (error) {
            console.error('[WhatsApp] Initialization error:', error);
            this.status = 'disconnected';
        }
    }

    async sendMessage(to, message) {
        if (this.status !== 'connected') {
            throw new Error('WhatsApp not connected');
        }

        // Format number: remove +, extra characters, and append @c.us
        const formattedTo = to.replace(/[^0-9]/g, '');
        const chatId = formattedTo.includes('@c.us') ? formattedTo : `${formattedTo}@c.us`;
        
        try {
            await this.client.sendMessage(chatId, message);
            return true;
        } catch (err) {
            console.error('[WhatsApp] Send error:', err);
            throw err;
        }
    }

    async logout() {
        if (this.client) {
            try {
                await this.client.logout();
                this.status = 'disconnected';
                this.qrCode = null;
                console.log('[WhatsApp] Logged out successfully');
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
