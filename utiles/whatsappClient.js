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
            return;
        }
        this.status = 'initializing';

        this.client = new Client({
            authStrategy: new LocalAuth({
                dataPath: path.join(process.cwd(), '.wwebjs_auth')
            }),
            webVersionCache: {
                type: 'remote',
                remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-js/main/dist/wppconnect-wa.js' 
            },
            puppeteer: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu',
                    '--hide-scrollbars',
                    '--disable-extensions',
                    '--disable-notifications',
                    '--disable-setuid-sandbox',
                    '--force-device-scale-factor=1'
                ]
            }
        });

        this.client.on('qr', async (qr) => {
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
            this.status = 'connected';
            this.qrCode = null;
            const io = socketHelper.getIo();
            io.emit('whatsapp_ready');
        });

        this.client.on('authenticated', () => {
        });

        this.client.on('auth_failure', (msg) => {
            console.error('[WhatsApp] Authentication failure:', msg);
            this.status = 'disconnected';
            const io = socketHelper.getIo();
            io.emit('whatsapp_auth_failed', { message: msg });
        });

        this.client.on('disconnected', (reason) => {
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
