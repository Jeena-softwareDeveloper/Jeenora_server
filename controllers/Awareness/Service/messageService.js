const Campaign = require('../../models/Awareness/Subscriber/Campaign');
const Subscriber = require('../../models/Awareness/Subscriber/Subscriber');
const SubscriberCategory = require('../../models/Awareness/Subscriber/SubscriberCategory');
const EmailTemplate = require('../../models/Awareness/Subscriber/EmailTemplate');
const Analytics = require('../../models/Awareness/Subscriber/AnalyticsModel');
const nodemailer = require('nodemailer');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const mongoose = require('mongoose');
const cron = require('node-cron');
const { google } = require('googleapis');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// ==================== WHATSAPP CONFIGURATION ====================
const WHATSAPP_CONFIG = {
  defaultCountryCode: process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || '91',
  allowedCountryCodes: (process.env.WHATSAPP_ALLOWED_COUNTRY_CODES || '91,93,1,44,86').split(','),
  QR_EXPIRY_MS: 5 * 60 * 1000,
  INIT_TIMEOUT: 120000,
  MAX_RETRIES: 3
};

// ==================== GLOBAL VARIABLES ====================
let isWhatsAppReady = false;
let latestQR = null;
let qrGeneratedAt = null;
const scheduledCampaigns = new Map();
let io;
let waClient = null;
let initializationInProgress = false;
let isManualLogout = false;
let initializationTimeout = null;

// ==================== UTILITY FUNCTIONS ====================
const formatPhoneForWhatsApp = (phone) => {
  if (!phone) return null;
  let cleanPhone = phone.toString().trim().replace(/\D/g, '');
  if (cleanPhone.length === 10) {
    cleanPhone = WHATSAPP_CONFIG.defaultCountryCode + cleanPhone;
  }
  return cleanPhone.length >= 10 && cleanPhone.length <= 15 ? cleanPhone : null;
};

const analyzePhoneNumber = (phone) => {
  if (!phone) return { isValid: false };
  const cleanPhone = phone.toString().replace(/\D/g, '');
  const formatted = formatPhoneForWhatsApp(phone);
  return {
    original: phone,
    formatted: formatted,
    isValid: !!formatted,
    length: cleanPhone.length,
    type: cleanPhone.length === 10 ? '10-digit-local' : 'international'
  };
};

const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const generateTrackingPixel = (campaignId, recipient) => {
  const pixelUrl = `${process.env.BASE_URL}/api/tracking/pixel?campaign=${campaignId}&recipient=${encodeURIComponent(recipient)}`;
  return `<img src="${pixelUrl}" width="1" height="1" style="display:none" alt=""/>`;
};

// ==================== CLEANUP FUNCTIONS ====================
const cleanupBrowserProcesses = async () => {
  console.log('🧹 Cleaning up browser processes and session locks...');
  
  try {
    const { exec, execSync } = require('child_process');
    const fs = require('fs');
    const path = require('path');

    // 1. First, kill all Chrome/Chromium processes gently
    const killCommands = [
      'pkill -f "chrome.*whatsapp" || true',
      'pkill -f "chromium.*whatsapp" || true',
      'pkill -f "puppeteer.*whatsapp" || true',
      'pkill -f "chrome.*--type=renderer" || true',
      'pkill -f "chromium.*--type=renderer" || true'
    ];
    
    for (const cmd of killCommands) {
      exec(cmd);
    }
    
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 2. Force kill any remaining processes
    exec('pkill -9 -f "chrome\\|chromium\\|puppeteer" || true');

    await new Promise(resolve => setTimeout(resolve, 2000));

    // 3. Clean up session lock files
    const sessionPath = './whatsapp-sessions';
    if (fs.existsSync(sessionPath)) {
      // Remove SingletonLock files
      const removeLockFiles = (dir) => {
        try {
          const files = fs.readdirSync(dir);
          for (const file of files) {
            const filePath = path.join(dir, file);
            if (file === 'SingletonLock' || file === 'SingletonSocket' || file === 'SingletonCookie') {
              console.log(`🗑️ Removing lock file: ${filePath}`);
              try {
                fs.unlinkSync(filePath);
              } catch (e) {
                // Ignore if file doesn't exist
              }
            } else if (fs.statSync(filePath).isDirectory()) {
              removeLockFiles(filePath);
            }
          }
        } catch (error) {
          console.log('✅ Lock file cleanup completed');
        }
      };
      
      removeLockFiles(sessionPath);
    }

    // 4. Clear any remaining zombie processes
    exec('ps aux | grep -i "chrome\\|chromium\\|puppeteer" | grep -v grep | awk \'{print $2}\' | xargs -r kill -9 || true', () => {
      console.log('✅ All browser processes and locks cleaned up');
    });

  } catch (error) {
    console.log('✅ Cleanup completed');
  }
};

const cleanupWhatsAppSessions = async (clearSessionData = false) => {
  try {
    console.log('🧹 Cleaning up WhatsApp sessions...');
    
    await cleanupBrowserProcesses();
    
    if (clearSessionData) {
      try {
        const sessionPath = './whatsapp-sessions';
        if (require('fs').existsSync(sessionPath)) {
          require('fs').rmSync(sessionPath, { recursive: true, force: true });
          console.log('✅ All session data cleared');
        }
      } catch (e) {
        console.log('✅ Session cleanup completed');
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
  } catch (error) {
    console.log('✅ Cleanup completed');
  }
};

// ==================== WHATSAPP CLIENT MANAGEMENT ====================
const createWhatsAppClient = () => {
  console.log('🔧 Creating new WhatsApp client instance...');
  
  if (waClient) {
    try {
      waClient.removeAllListeners();
    } catch (e) {
      console.log('⚠️ Error removing listeners:', e.message);    }
  }
  
  waClient = new Client({ 
    authStrategy: new LocalAuth({ 
      clientId: "awareness-campaign-client",
      dataPath: "./whatsapp-sessions"
    }),
    puppeteer: {
      headless: "true",
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--single-process',
        '--no-default-browser-check',
        '--disable-extensions',
        '--disable-default-apps',
        '--disable-translate',
        '--disable-features=VizDisplayCompositor',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-ipc-flooding-protection',
        '--no-zygote',
        '--renderer-process-limit=1',
        '--no-pings'
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 
                     (process.platform === 'linux' ? '/usr/bin/chromium-browser' : undefined),
                       ignoreDefaultArgs: ['--disable-extensions'],
      timeout: 0
    },
    takeoverOnConflict: true, // Change to true
    restartOnAuthFail: true   // Change to true
  });

  // Event Handlers
  waClient.on('qr', (qr) => {
    console.log('🔄 WhatsApp QR Code Generated');
    latestQR = qr;
    qrGeneratedAt = Date.now();
    isWhatsAppReady = false;
    initializationInProgress = false;
    
    console.log('🔄 New QR code ready for scanning');
    sendWhatsAppStatus({ 
      message: '🔄 QR Generated. Scan to connect.',
      qrNeeded: true,
      initializing: false,
      connected: false
    });
  });

  waClient.on('ready', () => {
    console.log('💚 WhatsApp Client Ready!');
    console.log('✅ Connected to:', waClient.info?.pushname || 'Unknown');
    
    isWhatsAppReady = true;
    latestQR = null;
    qrGeneratedAt = null;
    initializationInProgress = false;
    isManualLogout = false;
    
    if (initializationTimeout) {
      clearTimeout(initializationTimeout);
      initializationTimeout = null;
    }
    
    sendWhatsAppStatus({ 
      message: '✅ WhatsApp Connected Successfully!', 
      initializing: false,
      connected: true,
      qrNeeded: false
    });
  });

  waClient.on('authenticated', () => {
    console.log('✅ WhatsApp Authenticated!');
    isWhatsAppReady = true;
    initializationInProgress = false;
  });

  waClient.on('auth_failure', (msg) => {
    console.error('❌ WhatsApp Auth Failure:', msg);
    isWhatsAppReady = false;
    latestQR = null;
    initializationInProgress = false;
    sendWhatsAppStatus({ 
      message: '❌ Authentication failed', 
      initializing: false 
    });
  });

  waClient.on('disconnected', (reason) => {
    console.log('🔴 WhatsApp Disconnected:', reason);
    isWhatsAppReady = false;
    initializationInProgress = false;
    
    if (isManualLogout) {
      console.log('🚫 Manual logout completed');
      return;
    }
    
    console.log('🔄 Attempting to reconnect...');
    setTimeout(() => {
      initializeWhatsApp();
    }, 5000);
  });

  console.log('✅ New WhatsApp client created');
  return waClient;
};

// ==================== WHATSAPP INITIALIZATION ====================
const initializeWhatsApp = async (retryCount = 0) => {
  if (initializationInProgress) {
    console.log('⚠️ Initialization already in progress, skipping...');
    return;
  }
  
  initializationInProgress = true;
  
  console.log(`🚀 Initializing WhatsApp Client... (Attempt: ${retryCount + 1})`);
  sendWhatsAppStatus({ 
    initializing: true, 
    message: '🔄 Initializing WhatsApp...' 
  });

  if (initializationTimeout) {
    clearTimeout(initializationTimeout);
  }

  initializationTimeout = setTimeout(() => {
    if (initializationInProgress && !isWhatsAppReady && !latestQR) {
      console.log('⏰ Initialization timeout');
      initializationInProgress = false;
      sendWhatsAppStatus({ 
        initializing: false, 
        message: '❌ Initialization timeout' 
      });
    }
  }, WHATSAPP_CONFIG.INIT_TIMEOUT);

  try {
    latestQR = null;
    qrGeneratedAt = null;
    isWhatsAppReady = false;

    createWhatsAppClient();
    
    await waClient.initialize();
    
    console.log('✅ WhatsApp initialization started');
    
  } catch (error) {
    console.error('❌ Initialization failed:', error.message);
    
    initializationInProgress = false;
    
    if (retryCount < WHATSAPP_CONFIG.MAX_RETRIES) {
      const delay = Math.pow(2, retryCount) * 5000;
      console.log(`🔄 Retrying in ${delay/1000}s... (${retryCount + 1}/${WHATSAPP_CONFIG.MAX_RETRIES})`);
      
  if (retryCount === WHATSAPP_CONFIG.MAX_RETRIES - 1) {
        await cleanupWhatsAppSessions(true);
      }

      setTimeout(() => {
        initializeWhatsApp(retryCount + 1);
      }, delay);
    } else {
      console.error('❌ Max retries reached');
      sendWhatsAppStatus({ 
        initializing: false, 
        message: '❌ Failed to initialize WhatsApp' 
      });
    }
  }
};

// ==================== SOCKET MANAGEMENT ====================
const setSocket = (socketServer) => {
  io = socketServer;
  
  io.on("connection", (socket) => {
    console.log(`✅ Socket Connected: ${socket.id}`);
    
    socket.emit('whatsapp-status', {
      initializing: initializationInProgress,
      connected: isWhatsAppReady,
      qrNeeded: !isWhatsAppReady && !!latestQR,
      message: isWhatsAppReady ? '✅ WhatsApp Connected' : 
               latestQR ? '🔄 QR Available' : '❌ WhatsApp Not Connected'
    });

    socket.on("disconnect", (reason) => {
      console.log(`🔴 Socket Disconnected: ${socket.id} - ${reason}`);
    });
  });

  if (!initializationInProgress && !isWhatsAppReady) {
    console.log('🔄 Starting WhatsApp initialization...');
    setTimeout(() => {
      initializeWhatsApp();
    }, 3000);
  }
};

const sendWhatsAppStatus = (status = {}) => {
  if (!io) return;

  const statusData = {
    initializing: status.initializing || false,
    connected: isWhatsAppReady,
    qrNeeded: !!latestQR,
    message: status.message || (
      isWhatsAppReady
        ? '✅ WhatsApp Connected'
        : latestQR
          ? '🔄 Scan QR to connect'
          : '❌ WhatsApp Not Connected'
    ),
    timestamp: new Date().toISOString()
  };

  io.emit('whatsapp-status', statusData);
};

// ==================== TRACKING FUNCTIONS ====================
const recordEmailOpen = async (campaignId, recipient, userAgent, ip) => {
  try {
    await Analytics.create({
      campaignId,
      type: 'email',
      event: 'opened',
      recipient,
      userAgent,
      ipAddress: ip,
      timestamp: new Date()
    });

    await Campaign.findByIdAndUpdate(campaignId, {
      $inc: { openedCount: 1 }
    });
  } catch (error) {
    console.error('Error tracking email open:', error);
  }
};

const recordEmailClick = async (campaignId, recipient, url, userAgent, ip) => {
  try {
    await Analytics.create({
      campaignId,
      type: 'email',
      event: 'clicked',
      recipient,
      details: { url },
      userAgent,
      ipAddress: ip,
      timestamp: new Date()
    });

    await Campaign.findByIdAndUpdate(campaignId, {
      $inc: { clickedCount: 1 }
    });
  } catch (error) {
    console.error('Error tracking email click:', error);
  }
};

// ==================== EMAIL SERVICE ====================
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS
    }
  });
};

let transporter = createTransporter();

const sendEmail = async (to, subject, message, campaignId = null, attachments = []) => {
  try {
    if (!validateEmail(to)) {
      console.error(`❌ INVALID EMAIL: ${to}`);
      return { success: false, error: 'Invalid email address' };
    }

    let finalMessage = message;
    if (campaignId) {
      const trackingPixel = generateTrackingPixel(campaignId, to);
      finalMessage = finalMessage.includes('</body>') 
        ? finalMessage.replace('</body>', `${trackingPixel}</body>`)
        : `${finalMessage}${trackingPixel}`;
    }

    const mailOptions = {
      from: process.env.GMAIL_USER,
      to,
      subject,
      html: finalMessage,
      text: message.replace(/<[^>]*>/g, ''),
      attachments
    };

    const result = await transporter.sendMail(mailOptions);
    
    if (campaignId) {
      await Analytics.create({
        campaignId,
        type: 'email',
        event: 'sent',
        recipient: to,
        messageId: result.messageId,
        timestamp: new Date()
      });
    }

    console.log(`📧 EMAIL SENT TO: ${to}`);
    return { success: true, messageId: result.messageId };
  } catch (err) {
    console.error(`❌ EMAIL FAILED: ${to}`, err.message);
    
    if (campaignId) {
      await Analytics.create({
        campaignId,
        type: 'email',
        event: 'failed',
        recipient: to,
        error: err.message,
        timestamp: new Date()
      });
    }
    
    return { success: false, error: err.message };
  }
};

// ==================== WHATSAPP SERVICE ====================
const sendWhatsApp = async (to, message, mediaUrl = null, campaignId = null) => {
  try {
    if (!isWhatsAppReady) {
      return { success: false, error: 'WhatsApp is not connected. Please connect WhatsApp first.' };
    }

    const state = await waClient.getState();
    if (state !== 'CONNECTED') {
      return { success: false, error: 'WhatsApp not connected' };
    }

    const phoneAnalysis = analyzePhoneNumber(to);
    if (!phoneAnalysis.isValid) {
      return { success: false, error: 'Invalid phone number' };
    }

    const cleanPhone = phoneAnalysis.formatted;
    const chatId = `${cleanPhone}@c.us`;

    let result;
    if (mediaUrl) {
      const media = await MessageMedia.fromUrl(mediaUrl);
      result = await waClient.sendMessage(chatId, media, { caption: message });
    } else {
      result = await waClient.sendMessage(chatId, message);
    }

    if (campaignId) {
      await Analytics.create({
        campaignId,
        type: 'whatsapp',
        event: 'sent',
        recipient: cleanPhone,
        messageId: result.id.id,
        timestamp: new Date()
      });
    }
    
    return { success: true, messageId: result.id.id };
  } catch (err) {
    console.error(`❌ WHATSAPP FAILED: ${to}`, err.message);
    
    if (campaignId) {
      await Analytics.create({
        campaignId,
        type: 'whatsapp',
        event: 'failed',
        recipient: to,
        error: err.message,
        timestamp: new Date()
      });
    }
    
    return { success: false, error: err.message };
  }
};

// ==================== WHATSAPP API ENDPOINTS ====================
const getWhatsAppStatus = async (req, res) => {
  try {
    let state = 'UNKNOWN';
    let detailedInfo = {};
    
    try {
      if (waClient) {
        state = await waClient.getState();
        detailedInfo = {
          pushname: waClient.info?.pushname,
          connected: state === 'CONNECTED',
          phone: waClient.info?.wid?.user,
          platform: waClient.info?.platform,
          version: waClient.info?.waVersion,
          isReady: isWhatsAppReady
        };
      }
    } catch (err) {
      state = 'ERROR';
      detailedInfo.error = err.message;
    }

    res.json({ 
      success: true,
      connected: isWhatsAppReady,
      state,
      qrNeeded: !isWhatsAppReady && !!latestQR,
      hasQR: !!latestQR,
      initializing: initializationInProgress,
      message: isWhatsAppReady ? '✅ WhatsApp Connected' : 
               latestQR ? '🔄 QR Available - Scan to Connect' : '❌ WhatsApp Not Connected',
      detailedInfo,
      canConnect: !isWhatsAppReady && !initializationInProgress
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      error: err.message
    });
  }
};

const getWhatsAppQR = async (req, res) => {
  try {
    console.log('🔄 QR Code Request Received');
    
    if (isWhatsAppReady) {
      return res.json({ 
        success: true,
        qr: null, 
        message: 'WhatsApp is already connected',
        connected: true
      });
    }
    
    if (latestQR && qrGeneratedAt) {
      const isExpired = (Date.now() - qrGeneratedAt) > WHATSAPP_CONFIG.QR_EXPIRY_MS;
      
      if (!isExpired) {
        console.log('✅ Serving existing QR code');
        const qrImage = await qrcode.toDataURL(latestQR);
        return res.json({ 
          success: true,
          qr: qrImage,
          expiresAt: new Date(qrGeneratedAt + WHATSAPP_CONFIG.QR_EXPIRY_MS),
          message: 'QR code available',
          connected: false
        });
      } else {
        console.log('❌ QR code expired');
        latestQR = null;
        qrGeneratedAt = null;
      }
    }

    if (!latestQR && !initializationInProgress) {
      console.log('🔄 No QR available, starting initialization...');
      initializeWhatsApp();
      
      return res.json({ 
        success: true,
        qr: null, 
        message: 'WhatsApp is initializing, please wait...',
        connected: false,
        initializing: true
      });
    }

    if (initializationInProgress) {
      return res.json({ 
        success: true,
        qr: null, 
        message: 'WhatsApp is initializing, please wait...',
        connected: false,
        initializing: true
      });
    }

    res.json({ 
      success: true,
      qr: null, 
      message: 'QR code will be available shortly...',
      connected: false,
      initializing: false
    });
  } catch (err) {
    console.error('❌ QR error:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

const resetWhatsApp = async (req, res) => {
  try {
    console.log('🔄 Manual WhatsApp logout requested...');
    isManualLogout = true;
    
    sendWhatsAppStatus({ 
      initializing: true, 
      message: '🔄 Logging out from WhatsApp...' 
    });

    isWhatsAppReady = false;
    latestQR = null;
    qrGeneratedAt = null;
    initializationInProgress = false;

    if (initializationTimeout) {
      clearTimeout(initializationTimeout);
      initializationTimeout = null;
    }

    if (waClient) {
      try {
        const state = await waClient.getState();
        console.log('📱 Current state:', state);
        
        if (state === 'CONNECTED') {
          console.log('🔴 Logging out from WhatsApp...');
          await waClient.logout();
          console.log('✅ Logout command sent');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (logoutError) {
        console.log('⚠️ Logout command failed:', logoutError.message);
      }

      try {
        console.log('🔴 Destroying client...');
        waClient.removeAllListeners();
        await waClient.destroy();
        console.log('✅ Client destroyed');
      } catch (destroyError) {
        console.log('⚠️ Client destruction completed');
      }
    }

    console.log('🧹 Cleaning up sessions...');
    await cleanupWhatsAppSessions(true);
    
    await new Promise(resolve => setTimeout(resolve, 3000));

    sendWhatsAppStatus({ 
      initializing: false,
      connected: false,
      qrNeeded: true,
      message: '🔴 WhatsApp Logged Out. You can now reconnect.',
      state: 'DISCONNECTED'
    });

    res.json({ 
      success: true,
      message: 'WhatsApp logged out successfully. You can now reconnect.'
    });
    
  } catch (err) {
    console.error('❌ Logout error:', err);
    
    await cleanupWhatsAppSessions(true);
    
    isWhatsAppReady = false;
    isManualLogout = true;
    initializationInProgress = false;
    
    sendWhatsAppStatus({ 
      initializing: false,
      connected: false,
      message: '🔴 WhatsApp Logout Completed'
    });
    
    res.json({ 
      success: true,
      message: 'WhatsApp logged out. You can now reconnect.'
    });
  }
};

const forceReconnectWhatsApp = async (req, res) => {
  try {
    if (initializationInProgress) {
      return res.json({
        success: false,
        error: 'WhatsApp is already initializing'
      });
    }
    
    initializeWhatsApp();
    
    res.json({
      success: true,
      message: 'WhatsApp reconnection initiated'
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

const refreshQRCode = async (req, res) => {
  try {
    console.log('🔄 Force refreshing QR code...');
    
    if (isWhatsAppReady) {
      return res.json({
        success: true,
        message: 'WhatsApp is already connected'
      });
    }

    if (initializationInProgress) {
      return res.json({
        success: true,
        message: 'WhatsApp is already initializing'
      });
    }

    latestQR = null;
    qrGeneratedAt = null;
    
    await cleanupWhatsAppSessions(true);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    initializeWhatsApp();
    
    res.json({
      success: true,
      message: 'QR code refresh started. Please wait...',
      initializing: true
    });
  } catch (err) {
    console.error('❌ Refresh error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

const sendSingleWhatsApp = async (req, res) => {
  try {
    const { to, message, mediaUrl } = req.body;

    if (!to || !message) {
      return res.status(400).json({ 
        success: false,
        error: 'Phone number and message are required' 
      });
    }

    const result = await sendWhatsApp(to, message, mediaUrl);
    
    if (result.success) {
      res.json({ 
        success: true,
        message: 'WhatsApp message sent successfully',
        messageId: result.messageId
      });
    } else {
      res.status(500).json({ 
        success: false,
        error: result.error 
      });
    }
  } catch (err) {
    console.error('Send single WhatsApp error:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

const sendBulkWhatsApp = async (req, res) => {
  try {
    const { contacts, message, mediaUrl } = req.body;

    if (!contacts || !message) {
      return res.status(400).json({ 
        success: false,
        error: 'Contacts and message are required' 
      });
    }

    const results = [];
    for (const contact of contacts) {
      const result = await sendWhatsApp(contact, message, mediaUrl);
      results.push({
        contact,
        success: result.success,
        messageId: result.messageId,
        error: result.error
      });
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    const successful = results.filter(r => r.success).length;
    
    res.json({
      success: true,
      message: `Bulk WhatsApp messages sent. ${successful}/${contacts.length} successful`,
      results
    });
  } catch (err) {
    console.error('Send bulk WhatsApp error:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

const sendMediaWhatsApp = async (req, res) => {
  try {
    const { to, message, mediaUrl, caption } = req.body;

    if (!to || !mediaUrl) {
      return res.status(400).json({ 
        success: false,
        error: 'Phone number and media URL are required' 
      });
    }

    const result = await sendWhatsApp(to, caption || message, mediaUrl);
    
    if (result.success) {
      res.json({ 
        success: true,
        message: 'WhatsApp media sent successfully',
        messageId: result.messageId
      });
    } else {
      res.status(500).json({ 
        success: false,
        error: result.error 
      });
    }
  } catch (err) {
    console.error('Send media WhatsApp error:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

const getWhatsAppContacts = async (req, res) => {
  try {
    if (!isWhatsAppReady) {
      return res.status(400).json({ 
        success: false,
        error: 'WhatsApp is not connected' 
      });
    }

    const contacts = await waClient.getContacts();
    const formattedContacts = contacts
      .filter(contact => contact.id.user && !contact.isGroup)
      .map(contact => ({
        id: contact.id._serialized,
        name: contact.name || contact.pushname || 'Unknown',
        phone: contact.id.user,
        isBusiness: contact.isBusiness || false,
        isEnterprise: contact.isEnterprise || false
      }));

    res.json({
      success: true,
      contacts: formattedContacts,
      total: formattedContacts.length
    });
  } catch (err) {
    console.error('Get WhatsApp contacts error:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

const getWhatsAppGroups = async (req, res) => {
  try {
    if (!isWhatsAppReady) {
      return res.status(400).json({ 
        success: false,
        error: 'WhatsApp is not connected' 
      });
    }

    const chats = await waClient.getChats();
    const groups = chats
      .filter(chat => chat.isGroup)
      .map(group => ({
        id: group.id._serialized,
        name: group.name,
        participants: group.participants.length,
        isReadOnly: group.isReadOnly
      }));

    res.json({
      success: true,
      groups: groups,
      total: groups.length
    });
  } catch (err) {
    console.error('Get WhatsApp groups error:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

// ==================== CAMPAIGN CRUD OPERATIONS ====================
const createCampaign = async (req, res) => {
  try {
    const { 
      title, 
      mode, 
      subject, 
      message, 
      categoryIds = [], 
      contacts = [],
      scheduleType = 'immediate',
      scheduledDate = null,
      scheduledTime = '09:00',
      recurringPattern = 'daily',
      repeatCount = 1,
      recurrenceConfig = {},
      mediaUrl = null,
      templateId = null,
      trackingEnabled = true,
      sendOptions = {}
    } = req.body;

    if (!title || !mode || !message) {
      return res.status(400).json({ error: 'Title, mode, and message are required' });
    }

    if (!['email', 'whatsapp'].includes(mode)) {
      return res.status(400).json({ error: 'Mode must be "email" or "whatsapp"' });
    }

    if (mode === 'email' && !subject) {
      return res.status(400).json({ error: 'Subject is required for email campaigns' });
    }

    if (mode === 'whatsapp' && !isWhatsAppReady) {
      return res.status(400).json({ error: 'WhatsApp is not connected. Please connect WhatsApp first.' });
    }

    const subscribers = await Subscriber.find({ category: { $in: categoryIds } });
    
    const categoryEmails = subscribers
      .map(s => s.email)
      .filter(email => email && validateEmail(email));

    const categoryPhones = subscribers
      .map(s => s.phone)
      .filter(phone => phone && analyzePhoneNumber(phone).isValid)
      .map(phone => analyzePhoneNumber(phone).formatted);

    const validContacts = contacts.filter(contact => {
      if (mode === 'email') {
        return contact.email && validateEmail(contact.email);
      } else {
        const phoneToCheck = contact.countryCode ? contact.countryCode + contact.phone : contact.phone;
        return phoneToCheck && analyzePhoneNumber(phoneToCheck).isValid;
      }
    });

    const manualEmails = validContacts.map(c => c.email).filter(email => email);
    const manualPhones = validContacts.map(contact => {
      if (mode === 'whatsapp' && contact.phone) {
        const fullPhone = contact.countryCode ? contact.countryCode + contact.phone : contact.phone;
        return analyzePhoneNumber(fullPhone).formatted;
      }
      return null;
    }).filter(phone => phone);

    const allEmails = [...new Set([...categoryEmails, ...manualEmails])];
    const allPhones = [...new Set([...categoryPhones, ...manualPhones])];

    if (mode === 'email' && allEmails.length === 0) {
      return res.status(400).json({ error: 'No valid email recipients found' });
    }

    if (mode === 'whatsapp' && allPhones.length === 0) {
      return res.status(400).json({ error: 'No valid phone recipients found' });
    }

    let finalScheduledDate = null;
    if (scheduleType === 'scheduled' && scheduledDate) {
      const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
      if (isNaN(scheduledDateTime.getTime())) {
        return res.status(400).json({ error: 'Invalid scheduled date format' });
      }
      finalScheduledDate = scheduledDateTime;
    }
let finalTemplateId = templateId;
if (!finalTemplateId || finalTemplateId === "" || finalTemplateId === "null") {
  finalTemplateId = undefined;
}

    const campaignData = {
      title,
      mode,
      subject: mode === 'email' ? subject : undefined,
      message,
      category: categoryIds,
      contacts: validContacts,
      emails: allEmails,
      phones: allPhones,
      status: scheduleType === 'immediate' ? 'pending' : 'scheduled',
      totalRecipients: mode === 'email' ? allEmails.length : allPhones.length,
      scheduleType,
      scheduledDate: finalScheduledDate,
      recurringPattern: scheduleType === 'recurring' ? recurringPattern : undefined,
      repeatCount: scheduleType === 'recurring' ? repeatCount : 1,
      recurrenceConfig: scheduleType === 'recurring' ? {
        interval: recurrenceConfig.interval || 1,
        frequency: recurrenceConfig.frequency || 'days',
        times: recurrenceConfig.times || repeatCount || 1,
        startTime: recurrenceConfig.startTime || '09:00',
        timezone: recurrenceConfig.timezone || 'Asia/Kolkata'
      } : undefined,
      currentRepeat: 0,
      mediaUrl,
      templateId:finalTemplateId,
      trackingEnabled,
      sendOptions: {
        delayBetweenMessages: sendOptions.delayBetweenMessages || (mode === 'whatsapp' ? 2000 : 1000),
        maxRetries: sendOptions.maxRetries || 1,
        retryDelay: sendOptions.retryDelay || 300000,
        batchSize: sendOptions.batchSize || (mode === 'whatsapp' ? 5 : 10)
      },
      isActive: true
    };

    const campaign = await Campaign.create(campaignData);
    const populatedCampaign = await campaign.populate('category');

    if (scheduleType === 'scheduled') {
      await scheduleCampaign(campaign._id);
    } else if (scheduleType === 'recurring') {
      await scheduleRecurringCampaign(campaign._id);
    }

    if (scheduleType === 'immediate') {
      sendCampaignToRecipients(campaign);
    }

    res.status(201).json({ 
      success: true,
      message: 'Campaign created successfully', 
      campaign: populatedCampaign 
    });
  } catch (err) {
    console.error('Create campaign error:', err);
    res.status(500).json({ 
      success: false,
      error: 'Failed to create campaign: ' + err.message 
    });
  }
};

const getCampaigns = async (req, res) => {
  try {
    const { status, mode, scheduleType, isActive, page = 1, limit = 10 } = req.query;
    
    let query = {};
    if (status) query.status = status;
    if (mode) query.mode = mode;
    if (scheduleType) query.scheduleType = scheduleType;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const campaigns = await Campaign.find(query)
      .populate('category')
      .populate('templateId')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Campaign.countDocuments(query);

    res.json({
      success: true,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      campaigns
    });
  } catch (err) {
    console.error('Get campaigns error:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

const getCampaignById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid campaign ID' 
      });
    }

    const campaign = await Campaign.findById(id)
      .populate('category')
      .populate('templateId');
      
    if (!campaign) {
      return res.status(404).json({ 
        success: false,
        error: 'Campaign not found' 
      });
    }
    
    res.json({ 
      success: true,
      campaign 
    });
  } catch (err) {
    console.error('Get campaign error:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

const updateCampaign = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('🔄 Updating campaign:', id);
    console.log('📨 Update data received:', JSON.stringify(req.body, null, 2));

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid campaign ID' 
      });
    }

    // Find the existing campaign first
    const existingCampaign = await Campaign.findById(id);
    if (!existingCampaign) {
      return res.status(404).json({ 
        success: false,
        error: 'Campaign not found' 
      });
    }

    const updateData = { ...req.body };
    console.log('📝 Processing update data:', updateData);

    // Handle schedule time properly
    if (updateData.scheduleType === 'scheduled' && updateData.scheduledDate) {
      console.log('📅 Handling scheduled campaign update');
      
      // If scheduledDate is already a Date object or ISO string, use it directly
      let scheduledDateTime;
      if (updateData.scheduledDate instanceof Date) {
        scheduledDateTime = updateData.scheduledDate;
      } else if (typeof updateData.scheduledDate === 'string') {
        scheduledDateTime = new Date(updateData.scheduledDate);
      }
      
      if (scheduledDateTime && !isNaN(scheduledDateTime.getTime())) {
        console.log('✅ Valid scheduled date:', scheduledDateTime);
        updateData.scheduledDate = scheduledDateTime;
        
        // Set status based on whether the scheduled time is in future or past
        const now = new Date();
        if (scheduledDateTime > now) {
          updateData.status = 'scheduled';
          console.log('⏰ Campaign scheduled for future');
        } else {
          updateData.status = 'pending';
          console.log('⚠️ Scheduled time passed, setting to pending');
        }
      } else {
        console.error('❌ Invalid scheduled date format:', updateData.scheduledDate);
        return res.status(400).json({ error: 'Invalid scheduled date format' });
      }

      // Clear any existing scheduled job
      if (scheduledCampaigns.has(id)) {
        const scheduled = scheduledCampaigns.get(id);
        if (scheduled && scheduled.stop) {
          scheduled.stop();
        } else if (scheduled) {
          clearTimeout(scheduled);
        }
        scheduledCampaigns.delete(id);
        console.log('🗑️ Cleared existing scheduled job');
      }

      // Schedule the campaign with new time if it's in future
      if (scheduledDateTime > new Date()) {
        await scheduleCampaign(id);
        console.log('✅ New schedule set');
      }
    }

    // Handle recurring campaigns
    if (updateData.scheduleType === 'recurring') {
      console.log('🔄 Handling recurring campaign update');
      updateData.status = 'pending';
      
      // Clear any existing scheduled job
      if (scheduledCampaigns.has(id)) {
        const scheduled = scheduledCampaigns.get(id);
        if (scheduled && scheduled.stop) {
          scheduled.stop();
        } else if (scheduled) {
          clearTimeout(scheduled);
        }
        scheduledCampaigns.delete(id);
      }
      
      // Schedule recurring campaign
      await scheduleRecurringCampaign(id);
    }

    // Handle immediate campaigns
    if (updateData.scheduleType === 'immediate') {
      console.log('🚀 Handling immediate campaign update');
      updateData.scheduledDate = undefined;
      updateData.scheduledTime = undefined;
      updateData.status = 'pending';
      
      // Clear any existing scheduled job
      if (scheduledCampaigns.has(id)) {
        const scheduled = scheduledCampaigns.get(id);
        if (scheduled && scheduled.stop) {
          scheduled.stop();
        } else if (scheduled) {
          clearTimeout(scheduled);
        }
        scheduledCampaigns.delete(id);
      }
    }

    console.log('💾 Saving campaign to database...');
    const campaign = await Campaign.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('category').populate('templateId');

    console.log('✅ Campaign updated successfully:', campaign._id);

    res.json({ 
      success: true,
      message: 'Campaign updated successfully', 
      campaign 
    });
    
  } catch (err) {
    console.error('❌ Update campaign error:', err);
    console.error('❌ Error stack:', err.stack);
    
    // Check for specific MongoDB validation errors
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(error => error.message);
      return res.status(400).json({ 
        success: false,
        error: `Validation failed: ${errors.join(', ')}` 
      });
    }
    
    // Check for duplicate key errors
    if (err.code === 11000) {
      return res.status(400).json({ 
        success: false,
        error: 'Campaign with this title already exists' 
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: err.message || 'Failed to update campaign' 
    });
  }
};

const deleteCampaign = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid campaign ID' 
      });
    }

    const campaign = await Campaign.findById(id);
    if (!campaign) {
      return res.status(404).json({ 
        success: false,
        error: 'Campaign not found' 
      });
    }

    if (campaign.status === 'sending') {
      return res.status(400).json({ 
        success: false,
        error: 'Cannot delete a campaign that is currently being sent' 
      });
    }

    if (scheduledCampaigns.has(id)) {
      const scheduled = scheduledCampaigns.get(id);
      if (scheduled && scheduled.stop) {
        scheduled.stop();
      } else if (scheduled) {
        clearTimeout(scheduled);
      }
      scheduledCampaigns.delete(id);
    }

    await Campaign.findByIdAndDelete(id);
    
    res.json({ 
      success: true,
      message: 'Campaign deleted successfully'
    });
  } catch (err) {
    console.error('Delete campaign error:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

// ==================== CAMPAIGN ACTIONS ====================
const startCampaign = async (req, res) => {
  try {
    const { id } = req.params;

    const campaign = await Campaign.findById(id);
    if (!campaign) {
      return res.status(404).json({ 
        success: false,
        error: 'Campaign not found' 
      });
    }

    if (campaign.status === 'sending') {
      return res.status(400).json({ 
        success: false,
        error: 'Campaign is already sending' 
      });
    }

    if (campaign.mode === 'whatsapp' && !isWhatsAppReady) {
      return res.status(400).json({ 
        success: false,
        error: 'WhatsApp is not connected. Please connect WhatsApp first.' 
      });
    }

    campaign.status = 'sending';
    campaign.startedAt = new Date();
    await campaign.save();

    sendCampaignToRecipients(campaign);

    res.json({ 
      success: true,
      message: 'Campaign started successfully',
      campaign: await campaign.populate('category')
    });
  } catch (err) {
    console.error('Start campaign error:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

const stopCampaign = async (req, res) => {
  try {
    const { id } = req.params;

    const campaign = await Campaign.findById(id);
    if (!campaign) {
      return res.status(404).json({ 
        success: false,
        error: 'Campaign not found' 
      });
    }

    if (campaign.status !== 'sending') {
      return res.status(400).json({ 
        success: false,
        error: 'Campaign is not currently sending' 
      });
    }

    campaign.status = 'paused';
    await campaign.save();

    res.json({ 
      success: true,
      message: 'Campaign stopped successfully',
      campaign: await campaign.populate('category')
    });
  } catch (err) {
    console.error('Stop campaign error:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

const pauseCampaign = async (req, res) => {
  try {
    const { id } = req.params;

    const campaign = await Campaign.findById(id);
    if (!campaign) {
      return res.status(404).json({ 
        success: false,
        error: 'Campaign not found' 
      });
    }

    if (campaign.status === 'sending') {
      return res.status(400).json({ 
        success: false,
        error: 'Cannot pause a campaign that is currently sending. Please stop it first.' 
      });
    }

    if (!campaign.isActive) {
      return res.status(400).json({ 
        success: false,
        error: 'Campaign is already paused' 
      });
    }

    campaign.isActive = false;
    campaign.status = 'paused';
    
    if (scheduledCampaigns.has(id)) {
      const scheduled = scheduledCampaigns.get(id);
      if (scheduled && scheduled.stop) {
        scheduled.stop();
      } else if (scheduled) {
        clearTimeout(scheduled);
      }
      scheduledCampaigns.delete(id);
    }

    await campaign.save();

    res.json({ 
      success: true,
      message: 'Campaign paused successfully',
      campaign: await campaign.populate('category')
    });
  } catch (err) {
    console.error('Pause campaign error:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

const resumeCampaign = async (req, res) => {
  try {
    const { id } = req.params;

    const campaign = await Campaign.findById(id);
    if (!campaign) {
      return res.status(404).json({ 
        success: false,
        error: 'Campaign not found' 
      });
    }

    if (campaign.isActive) {
      return res.status(400).json({ 
        success: false,
        error: 'Campaign is already active' 
      });
    }

    campaign.isActive = true;
    
    if (campaign.scheduleType === 'scheduled') {
      campaign.status = 'scheduled';
      await scheduleCampaign(campaign._id);
    } else if (campaign.scheduleType === 'recurring') {
      campaign.status = 'pending';
      await scheduleRecurringCampaign(campaign._id);
    } else {
      campaign.status = 'pending';
    }

    await campaign.save();

    res.json({ 
      success: true,
      message: 'Campaign resumed successfully',
      campaign: await campaign.populate('category')
    });
  } catch (err) {
    console.error('Resume campaign error:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

const resendCampaign = async (req, res) => {
  try {
    const { id } = req.params;

    const campaign = await Campaign.findById(id);
    if (!campaign) {
      return res.status(404).json({ 
        success: false,
        error: 'Campaign not found' 
      });
    }

    const updateData = {
      status: campaign.scheduleType === 'scheduled' ? 'scheduled' : 'pending',
      startedAt: null,
      completedAt: null,
      results: [],
      successCount: 0,
      failedCount: 0,
      openedCount: 0,
      clickedCount: 0,
      deliveredCount: 0,
      readCount: 0,
      currentRepeat: 0,
      lastSentAt: null,
      error: null,
      isActive: true
    };

    if (campaign.scheduleType === 'recurring') {
      updateData.currentRepeat = 0;
    }

    const updatedCampaign = await Campaign.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).populate('category').populate('templateId');

    await Analytics.deleteMany({ campaignId: id });

    if (campaign.scheduleType === 'scheduled') {
      await scheduleCampaign(id);
    } else if (campaign.scheduleType === 'recurring') {
      await scheduleRecurringCampaign(id);
    }

    res.json({ 
      success: true,
      message: 'Campaign reset for resending successfully',
      campaign: updatedCampaign
    });
  } catch (err) {
    console.error('Resend campaign error:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

const duplicateCampaign = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`🔄 Duplicating campaign: ${id}`);

    const originalCampaign = await Campaign.findById(id);
    if (!originalCampaign) {
      return res.status(404).json({ 
        success: false,
        error: 'Campaign not found' 
      });
    }

     // Create clean duplicate data
    const duplicateData = {
      title: `${originalCampaign.title} (Copy)`,
      mode: originalCampaign.mode,
      subject: originalCampaign.subject,
      message: originalCampaign.message,
      category: originalCampaign.category || [],
      contacts: originalCampaign.contacts || [],
      emails: originalCampaign.emails || [],
      phones: originalCampaign.phones || [],
      status: 'pending', // Always set to pending for duplicates
      totalRecipients: originalCampaign.totalRecipients || 0,
      scheduleType: originalCampaign.scheduleType,
      scheduledDate: originalCampaign.scheduledDate,
      scheduledTime: originalCampaign.scheduledTime,
      recurringPattern: originalCampaign.recurringPattern,
      repeatCount: originalCampaign.repeatCount,
      recurrenceConfig: originalCampaign.recurrenceConfig,
      currentRepeat: 0,
      mediaUrl: originalCampaign.mediaUrl,
      templateId: originalCampaign.templateId,
      trackingEnabled: originalCampaign.trackingEnabled,
      sendOptions: originalCampaign.sendOptions || {
        delayBetweenMessages: 2000,
        maxRetries: 1,
        retryDelay: 300000,
        batchSize: 5,
      },
      isActive: true,
      results: [],
      successCount: 0,
      failedCount: 0,
      openedCount: 0,
      clickedCount: 0,
      deliveredCount: 0,
      readCount: 0,
      startedAt: null,
      completedAt: null,
      lastSentAt: null,
      error: null
    };

    console.log('📝 Creating duplicate campaign with data:', duplicateData);

    const duplicateCampaign = await Campaign.create(duplicateData);
    
    console.log('✅ Duplicate campaign created:', duplicateCampaign._id);

    const populatedDuplicate = await Campaign.findById(duplicateCampaign._id)
      .populate('category')
      .populate('templateId');

    res.json({ 
      success: true,
      message: 'Campaign duplicated successfully',
      campaign: populatedDuplicate
    });
    
  } catch (err) {
    console.error('❌ Duplicate campaign error:', err);
    res.status(500).json({ 
      success: false,
      error: err.message || 'Failed to duplicate campaign' 
    });
  }
};

const getCampaignStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const campaign = await Campaign.findById(id);
    if (!campaign) {
      return res.status(404).json({ 
        success: false,
        error: 'Campaign not found' 
      });
    }

    const analytics = await Analytics.find({ campaignId: id });
    
    const sentCount = analytics.filter(a => a.event === 'sent').length;
    const openedCount = analytics.filter(a => a.event === 'opened').length;
    const clickedCount = analytics.filter(a => a.event === 'clicked').length;

    res.json({
      success: true,
      campaign: {
        id: campaign._id,
        title: campaign.title,
        status: campaign.status,
        mode: campaign.mode,
        progress: {
          total: campaign.totalRecipients,
          sent: sentCount,
          failed: campaign.failedCount,
          opened: openedCount,
          clicked: clickedCount
        },
        startedAt: campaign.startedAt,
        completedAt: campaign.completedAt
      },
      analytics: {
        deliveryRate: campaign.totalRecipients > 0 ? ((sentCount / campaign.totalRecipients) * 100).toFixed(2) : 0,
        openRate: sentCount > 0 ? ((openedCount / sentCount) * 100).toFixed(2) : 0,
        clickRate: openedCount > 0 ? ((clickedCount / openedCount) * 100).toFixed(2) : 0
      }
    });
  } catch (err) {
    console.error('Get campaign status error:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

// ==================== CORE CAMPAIGN SENDING ====================
const sendCampaignToRecipients = async (campaign) => {
  try {
    const recipients = campaign.mode === 'email' 
      ? (campaign.emails || [])
      : (campaign.phones || []);

    if (recipients.length === 0) {
      console.error(`❌ No recipients available for campaign: ${campaign.title}`);
      return [];
    }

    const BATCH_SIZE = campaign.sendOptions?.batchSize || (campaign.mode === 'email' ? 5 : 3);
    const BATCH_DELAY = campaign.sendOptions?.delayBetweenMessages || (campaign.mode === 'email' ? 2000 : 5000);

    const results = [];

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE);
      
      try {
        const batchPromises = batch.map(recipient => {
          if (campaign.mode === 'email') {
            return sendWithRetry(
              () => sendEmail(recipient, campaign.subject, campaign.message, campaign._id), 
              campaign.sendOptions
            );
          } else {
            return sendWithRetry(
              () => sendWhatsApp(recipient, campaign.message, campaign.mediaUrl, campaign._id), 
              campaign.sendOptions
            );
          }
        });

        const batchResults = await Promise.allSettled(batchPromises);
        
        batchResults.forEach((result, index) => {
          const recipient = batch[index];
          const status = result.status === 'fulfilled' && result.value.success ? 'sent' : 'failed';
          const error = result.status === 'rejected' ? result.reason.message : 
                       (result.status === 'fulfilled' && !result.value.success ? result.value.error : undefined);
          
          results.push({
            recipient,
            status,
            error,
            sentAt: new Date(),
            attempt: 1,
            messageId: result.status === 'fulfilled' ? result.value.messageId : undefined
          });
        });

        if (i % (BATCH_SIZE * 3) === 0) {
          try {
            campaign.results = results;
            campaign.successCount = results.filter(r => r.status === 'sent').length;
            campaign.failedCount = results.filter(r => r.status === 'failed').length;
            await campaign.save();
          } catch (saveError) {
            console.error('❌ Error saving campaign progress:', saveError.message);
          }
        }

        if (i + BATCH_SIZE < recipients.length) {
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
        }
      } catch (batchError) {
        console.error(`❌ Batch failed:`, batchError);
        
        batch.forEach(recipient => {
          results.push({
            recipient,
            status: 'failed',
            error: 'Batch processing error: ' + batchError.message,
            sentAt: new Date(),
            attempt: 1
          });
        });
      }
    }

    campaign.status = campaign.scheduleType === 'recurring' && campaign.currentRepeat < campaign.repeatCount 
      ? 'pending' 
      : 'sent';
    campaign.completedAt = new Date();
    campaign.results = results;
    campaign.successCount = results.filter(r => r.status === 'sent').length;
    campaign.failedCount = results.filter(r => r.status === 'failed').length;
    campaign.lastSentAt = new Date();
    await campaign.save();

    if (campaign.scheduleType === 'recurring' && campaign.currentRepeat < campaign.repeatCount) {
      scheduleRecurringCampaign(campaign._id);
    }

    return results;
  } catch (error) {
    console.error('❌ Error in sendCampaignToRecipients:', error);
    
    await Campaign.findByIdAndUpdate(campaign._id, { 
      status: 'failed',
      error: error.message 
    });
    
    return [];
  }
};

const sendWithRetry = async (sendFn, options, retryCount = 0) => {
  const maxRetries = options?.maxRetries || 1;
  
  try {
    const result = await sendFn();
    return result;
  } catch (error) {
    if (retryCount < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, options.retryDelay || 300000));
      return sendWithRetry(sendFn, options, retryCount + 1);
    }
    return { success: false, error: error.message };
  }
};

// ==================== SCHEDULING FUNCTIONS ====================
const scheduleCampaign = async (campaignId) => {
  try {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign || campaign.status !== 'scheduled') return;

    const scheduledTime = new Date(campaign.scheduledDate).getTime();
    const now = Date.now();
    const delay = scheduledTime - now;

    if (delay > 0) {
      if (scheduledCampaigns.has(campaignId)) {
        const existing = scheduledCampaigns.get(campaignId);
        if (existing) clearTimeout(existing);
      }

      const timeoutId = setTimeout(async () => {
        try {
          await executeScheduledCampaign(campaign);
        } catch (error) {
          console.error(`❌ Scheduled campaign execution failed: ${error.message}`);
        } finally {
          scheduledCampaigns.delete(campaignId);
        }
      }, delay);

      scheduledCampaigns.set(campaignId, timeoutId);
    } else {
      campaign.status = 'pending';
      await campaign.save();
    }
  } catch (error) {
    console.error(`❌ Error scheduling campaign: ${error.message}`);
  }
};

const scheduleRecurringCampaign = async (campaignId) => {
  try {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign || !campaign.isActive) return;

    if (campaign.scheduleType === 'recurring' && campaign.currentRepeat < campaign.repeatCount) {
      campaign.status = 'pending';
      await campaign.save();
    }
  } catch (error) {
    console.error(`❌ Error scheduling recurring campaign: ${error.message}`);
  }
};

const executeScheduledCampaign = async (campaign) => {
  try {
    campaign.status = 'sending';
    await campaign.save();
    
    await sendCampaignToRecipients(campaign);
    
    return true;
  } catch (error) {
    console.error(`❌ Scheduled campaign failed: ${error.message}`);
    campaign.status = 'failed';
    campaign.error = error.message;
    await campaign.save();
    return false;
  }
};

// ==================== EMAIL INTEGRATION ====================
const sendSingleEmail = async (req, res) => {
  try {
    const { to, subject, message, attachments } = req.body;

    if (!to || !subject || !message) {
      return res.status(400).json({ 
        success: false,
        error: 'To, subject, and message are required' 
      });
    }

    const result = await sendEmail(to, subject, message, null, attachments);
    
    if (result.success) {
      res.json({ 
        success: true,
        message: 'Email sent successfully',
        messageId: result.messageId
      });
    } else {
      res.status(500).json({ 
        success: false,
        error: result.error 
      });
    }
  } catch (err) {
    console.error('Send single email error:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

const sendBulkEmail = async (req, res) => {
  try {
    const { contacts, subject, message, attachments } = req.body;

    if (!contacts || !subject || !message) {
      return res.status(400).json({ 
        success: false,
        error: 'Contacts, subject, and message are required' 
      });
    }

    const results = [];
    for (const contact of contacts) {
      const result = await sendEmail(contact, subject, message, null, attachments);
      results.push({
        contact,
        success: result.success,
        messageId: result.messageId,
        error: result.error
      });
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const successful = results.filter(r => r.success).length;
    
    res.json({
      success: true,
      message: `Bulk emails sent. ${successful}/${contacts.length} successful`,
      results
    });
  } catch (err) {
    console.error('Send bulk email error:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

const getEmailTemplates = async (req, res) => {
  try {
    const { category, page = 1, limit = 10 } = req.query;
    
    let query = { isActive: true };
    if (category) query.category = category;

    const templates = await EmailTemplate.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await EmailTemplate.countDocuments(query);

    res.json({
      success: true,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      templates
    });
  } catch (err) {
    console.error('Get email templates error:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

const createEmailTemplate = async (req, res) => {
  try {
    const { name, subject, body, category, variables } = req.body;

    if (!name || !subject || !body) {
      return res.status(400).json({ 
        success: false,
        error: 'Name, subject, and body are required' 
      });
    }

    const template = await EmailTemplate.create({
      name,
      subject,
      body,
      category,
      variables
    });

    res.status(201).json({
      success: true,
      message: 'Email template created successfully',
      template
    });
  } catch (err) {
    console.error('Create email template error:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

// ==================== ANALYTICS & MONITORING ====================
const getCampaignAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid campaign ID' 
      });
    }

    const campaign = await Campaign.findById(id);
    if (!campaign) {
      return res.status(404).json({ 
        success: false,
        error: 'Campaign not found' 
      });
    }

    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter.timestamp = {};
      if (startDate) dateFilter.timestamp.$gte = new Date(startDate);
      if (endDate) dateFilter.timestamp.$lte = new Date(endDate);
    }

    const analytics = await Analytics.find({
      campaignId: id,
      ...dateFilter
    }).sort({ timestamp: 1 });

    const events = analytics.reduce((acc, curr) => {
      acc[curr.event] = (acc[curr.event] || 0) + 1;
      return acc;
    }, {});

    res.json({
      success: true,
      campaign: {
        id: campaign._id,
        title: campaign.title,
        mode: campaign.mode,
        status: campaign.status
      },
      summary: {
        totalRecipients: campaign.totalRecipients,
        sent: events.sent || 0,
        delivered: events.delivered || 0,
        opened: events.opened || 0,
        clicked: events.clicked || 0,
        failed: events.failed || 0,
        deliveryRate: campaign.totalRecipients > 0 ? ((events.sent || 0) / campaign.totalRecipients * 100).toFixed(2) : 0,
        openRate: events.sent > 0 ? ((events.opened || 0) / events.sent * 100).toFixed(2) : 0,
        clickRate: events.opened > 0 ? ((events.clicked || 0) / events.opened * 100).toFixed(2) : 0
      },
      analytics: analytics.slice(0, 100)
    });
  } catch (err) {
    console.error('Get campaign analytics error:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

const getWhatsAppStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter.timestamp = {};
      if (startDate) dateFilter.timestamp.$gte = new Date(startDate);
      if (endDate) dateFilter.timestamp.$lte = new Date(endDate);
    }

    const stats = await Analytics.aggregate([
      {
        $match: {
          type: 'whatsapp',
          ...dateFilter
        }
      },
      {
        $group: {
          _id: '$event',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      eventBreakdown: stats,
      period: {
        startDate: startDate || 'all',
        endDate: endDate || 'all'
      }
    });
  } catch (err) {
    console.error('Get WhatsApp stats error:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

const getGmailStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter.timestamp = {};
      if (startDate) dateFilter.timestamp.$gte = new Date(startDate);
      if (endDate) dateFilter.timestamp.$lte = new Date(endDate);
    }

    const stats = await Analytics.aggregate([
      {
        $match: {
          type: 'email',
          ...dateFilter
        }
      },
      {
        $group: {
          _id: '$event',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      eventBreakdown: stats,
      period: {
        startDate: startDate || 'all',
        endDate: endDate || 'all'
      }
    });
  } catch (err) {
    console.error('Get Gmail stats error:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

const generateReports = async (req, res) => {
  try {
    const { reportType, startDate, endDate } = req.query;

    let matchStage = {};
    if (startDate || endDate) {
      matchStage.timestamp = {};
      if (startDate) matchStage.timestamp.$gte = new Date(startDate);
      if (endDate) matchStage.timestamp.$lte = new Date(endDate);
    }

    let report;
    switch (reportType) {
      case 'campaign-performance':
        report = await Analytics.aggregate([
          { $match: matchStage },
          {
            $group: {
              _id: '$campaignId',
              totalSent: { $sum: { $cond: [{ $eq: ['$event', 'sent'] }, 1, 0] } },
              totalOpened: { $sum: { $cond: [{ $eq: ['$event', 'opened'] }, 1, 0] } },
              totalClicked: { $sum: { $cond: [{ $eq: ['$event', 'clicked'] }, 1, 0] } },
              totalFailed: { $sum: { $cond: [{ $eq: ['$event', 'failed'] }, 1, 0] } }
            }
          },
          {
            $lookup: {
              from: 'campaigns',
              localField: '_id',
              foreignField: '_id',
              as: 'campaign'
            }
          },
          {
            $unwind: '$campaign'
          },
          {
            $project: {
              campaignTitle: '$campaign.title',
              campaignMode: '$campaign.mode',
              totalSent: 1,
              totalOpened: 1,
              totalClicked: 1,
              totalFailed: 1,
              deliveryRate: {
                $multiply: [
                  { $divide: ['$totalSent', { $add: ['$totalSent', '$totalFailed'] }] },
                  100
                ]
              }
            }
          }
        ]);
        break;

      case 'channel-performance':
        report = await Analytics.aggregate([
          { $match: matchStage },
          {
            $group: {
              _id: '$type',
              totalSent: { $sum: { $cond: [{ $eq: ['$event', 'sent'] }, 1, 0] } },
              totalOpened: { $sum: { $cond: [{ $eq: ['$event', 'opened'] }, 1, 0] } },
              totalClicked: { $sum: { $cond: [{ $eq: ['$event', 'clicked'] }, 1, 0] } }
            }
          }
        ]);
        break;

      default:
        return res.status(400).json({ 
          success: false,
          error: 'Invalid report type' 
        });
    }

    res.json({
      success: true,
      reportType,
      period: {
        startDate: startDate || 'all',
        endDate: endDate || 'all'
      },
      data: report
    });
  } catch (err) {
    console.error('Generate reports error:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

// ==================== COMPREHENSIVE ANALYTICS ====================
const getComprehensiveAnalytics = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    
    let startDate = new Date();
    switch (period) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      default:
        startDate.setDate(startDate.getDate() - 30);
    }

    const campaignStats = await Campaign.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$mode',
          totalCampaigns: { $sum: 1 },
          totalRecipients: { $sum: '$totalRecipients' },
          totalSent: { $sum: '$successCount' },
          totalFailed: { $sum: '$failedCount' },
          avgDeliveryRate: { $avg: { $divide: ['$successCount', '$totalRecipients'] } }
        }
      }
    ]);

    const eventTimeline = await Analytics.aggregate([
      {
        $match: {
          timestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            type: '$type'
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.date': 1 }
      }
    ]);

    const topCampaigns = await Campaign.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          status: 'sent'
        }
      },
      {
        $project: {
          title: 1,
          mode: 1,
          totalRecipients: 1,
          successCount: 1,
          failedCount: 1,
          deliveryRate: { $divide: ['$successCount', '$totalRecipients'] },
          openRate: { $divide: ['$openedCount', '$successCount'] },
          clickRate: { $divide: ['$clickedCount', { $max: ['$openedCount', 1] }] }
        }
      },
      {
        $sort: { deliveryRate: -1 }
      },
      {
        $limit: 10
      }
    ]);

    res.json({
      success: true,
      period,
      summary: {
        totalCampaigns: campaignStats.reduce((sum, stat) => sum + stat.totalCampaigns, 0),
        totalRecipients: campaignStats.reduce((sum, stat) => sum + stat.totalRecipients, 0),
        totalSent: campaignStats.reduce((sum, stat) => sum + stat.totalSent, 0),
        overallDeliveryRate: campaignStats.reduce((sum, stat) => sum + (stat.avgDeliveryRate || 0), 0) / campaignStats.length
      },
      byChannel: campaignStats,
      timeline: eventTimeline,
      topCampaigns
    });
  } catch (err) {
    console.error('Get comprehensive analytics error:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

// ==================== TRACKING ROUTES ====================
const trackEmailOpenPixel = async (req, res) => {
  try {
    const { campaign, recipient } = req.query;
    
    if (!campaign || !recipient) {
      return res.status(400).send('Missing parameters');
    }

    const userAgent = req.get('User-Agent');
    const ip = req.ip || req.connection.remoteAddress;

    await recordEmailOpen(campaign, recipient, userAgent, ip);

    res.set('Content-Type', 'image/png');
    res.send(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64'));
  } catch (err) {
    res.set('Content-Type', 'image/png');
    res.send(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64'));
  }
};

const trackEmailClickRedirect = async (req, res) => {
  try {
    const { campaign, recipient, url } = req.query;
    
    if (!campaign || !recipient || !url) {
      return res.status(400).send('Missing parameters');
    }

    const userAgent = req.get('User-Agent');
    const ip = req.ip || req.connection.remoteAddress;

    await recordEmailClick(campaign, recipient, url, userAgent, ip);

    res.redirect(url);
  } catch (err) {
    res.redirect(url || '/');
  }
};

// ==================== CAMPAIGN STATISTICS ====================
const getCampaignStats = async (req, res) => {
  try {
    const totalCampaigns = await Campaign.countDocuments();
    const sentCampaigns = await Campaign.countDocuments({ status: 'sent' });
    const pendingCampaigns = await Campaign.countDocuments({ status: 'pending' });
    const scheduledCampaignsCount = await Campaign.countDocuments({ status: 'scheduled' });
    const sendingCampaigns = await Campaign.countDocuments({ status: 'sending' });
    const failedCampaigns = await Campaign.countDocuments({ status: 'failed' });
    const pausedCampaigns = await Campaign.countDocuments({ status: 'paused' });

    const emailCampaigns = await Campaign.countDocuments({ mode: 'email' });
    const whatsappCampaigns = await Campaign.countDocuments({ mode: 'whatsapp' });

    const sentCampaignsData = await Campaign.find({ status: 'sent' });
    const totalRecipients = sentCampaignsData.reduce((sum, campaign) => sum + campaign.totalRecipients, 0);
    const totalSent = sentCampaignsData.reduce((sum, campaign) => sum + (campaign.successCount || 0), 0);
    const totalFailed = sentCampaignsData.reduce((sum, campaign) => sum + (campaign.failedCount || 0), 0);

    res.json({
      success: true,
      totalCampaigns,
      sentCampaigns,
      pendingCampaigns,
      scheduledCampaigns: scheduledCampaignsCount,
      sendingCampaigns,
      failedCampaigns,
      pausedCampaigns,
      emailCampaigns,
      whatsappCampaigns,
      totalRecipients,
      totalSent,
      totalFailed,
      deliveryRate: totalRecipients > 0 ? ((totalSent / totalRecipients) * 100).toFixed(2) : 0,
      activeCampaigns: await Campaign.countDocuments({ isActive: true })
    });
  } catch (err) {
    console.error('Get campaign stats error:', err);
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
};

// ==================== HEALTH CHECK ====================
const healthCheck = async (req, res) => {
  try {
    const services = {
      database: false,
      whatsapp: false,
      email: false
    };

    try {
      await mongoose.connection.db.admin().ping();
      services.database = true;
    } catch (dbError) {
      console.error('Database health check failed:', dbError);
    }

    services.whatsapp = isWhatsAppReady;

    try {
      await transporter.verify();
      services.email = true;
    } catch (emailError) {
      console.error('Email service health check failed:', emailError);
    }

    const overallStatus = services.database && services.whatsapp && services.email;

    res.json({
      success: true,
      status: overallStatus ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services,
      whatsappDetails: {
        connected: isWhatsAppReady,
        state: waClient ? (await waClient.getState()) : 'NOT_INITIALIZED',
        hasQR: !!latestQR,
        initializing: initializationInProgress
      }
    });
  } catch (err) {
    console.error('Health check error:', err);
    res.status(500).json({ 
      success: false,
      status: 'unhealthy',
      error: err.message 
    });
  }
};

// ==================== STARTUP INITIALIZATION ====================
const initializeOnStartup = async () => {
  console.log('🚀 Server starting, waiting before WhatsApp initialization...');
  
  // Wait longer before initializing to ensure server is fully up
  setTimeout(() => {
    if (!initializationInProgress && !isWhatsAppReady) {
      console.log('🔄 Starting WhatsApp initialization after server warmup...');
      initializeWhatsApp();
    }
  }, 10000); // Increased from 5000 to 10000
};

// Start initialization
initializeOnStartup();

// ==================== EXPORTS ====================
module.exports = {
  // WhatsApp Connection
  getWhatsAppStatus,
  getWhatsAppQR,
  resetWhatsApp,
  forceReconnectWhatsApp,
  refreshQRCode,
  setSocket,
  
  // WhatsApp Messaging
  sendSingleWhatsApp,
  sendBulkWhatsApp,
  sendMediaWhatsApp,
  getWhatsAppContacts,
  getWhatsAppGroups,
  
  // Campaign CRUD
  createCampaign,
  getCampaigns,
  getCampaignById,
  updateCampaign,
  deleteCampaign,
  
  // Campaign Actions
  startCampaign,
  stopCampaign,
  pauseCampaign,
  resumeCampaign,
  resendCampaign,
  duplicateCampaign,
  getCampaignStatus,
  getCampaignStats,
  
  // Email Integration
  sendSingleEmail,
  sendBulkEmail,
  getEmailTemplates,
  createEmailTemplate,
  
  // Gmail OAuth
  gmailAuth: async (req, res) => {
    try {
      const gmailOAuth2Client = new google.auth.OAuth2(
        process.env.GMAIL_OAUTH_CLIENT_ID,
        process.env.GMAIL_OAUTH_CLIENT_SECRET,
        process.env.GMAIL_OAUTH_REDIRECT_URI
      );

      const authUrl = gmailOAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/gmail.send'],
        prompt: 'consent'
      });

      res.json({ 
        success: true,
        authUrl 
      });
    } catch (err) {
      console.error('Gmail auth error:', err);
      res.status(500).json({ 
        success: false,
        error: err.message 
      });
    }
  },
  
  gmailCallback: async (req, res) => {
    try {
      const { code } = req.query;
      const gmailOAuth2Client = new google.auth.OAuth2(
        process.env.GMAIL_OAUTH_CLIENT_ID,
        process.env.GMAIL_OAUTH_CLIENT_SECRET,
        process.env.GMAIL_OAUTH_REDIRECT_URI
      );
      
      if (!code) {
        return res.status(400).json({ 
          success: false,
          error: 'Authorization code is required' 
        });
      }

      const { tokens } = await gmailOAuth2Client.getToken(code);
      gmailOAuth2Client.setCredentials(tokens);

      transporter = nodemailer.createTransporter({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: process.env.GMAIL_USER,
          clientId: process.env.GMAIL_OAUTH_CLIENT_ID,
          clientSecret: process.env.GMAIL_OAUTH_CLIENT_SECRET,
          refreshToken: tokens.refresh_token,
          accessToken: tokens.access_token
        }
      });

      res.json({ 
        success: true,
        message: 'Gmail OAuth authentication successful'
      });
    } catch (err) {
      console.error('Gmail callback error:', err);
      res.status(500).json({ 
        success: false,
        error: err.message 
      });
    }
  },
  
  // Analytics & Monitoring
  getCampaignAnalytics,
  getWhatsAppStats,
  getGmailStats,
  generateReports,
  getComprehensiveAnalytics,
  
  // Tracking
  trackEmailOpen: trackEmailOpenPixel,
  trackEmailClick: trackEmailClickRedirect,
  
  // Utility
  healthCheck,
  validatePhoneNumber: async (req, res) => {
    try {
      const { phone } = req.body;
      const analysis = analyzePhoneNumber(phone);
      res.json({
        success: true,
        ...analysis
      });
    } catch (err) {
      res.status(500).json({ 
        success: false,
        error: err.message 
      });
    }
  },
  
  validateCampaignData: async (req, res) => {
    try {
      const data = req.body;
      const errors = [];

      if (!data.title?.trim()) {
        errors.push('Campaign title is required');
      }

      if (!data.mode || !['email', 'whatsapp'].includes(data.mode)) {
        errors.push('Valid campaign mode (email/whatsapp) is required');
      }

      if (data.mode === 'email' && !data.subject?.trim()) {
        errors.push('Email subject is required for email campaigns');
      }

      if (!data.message?.trim()) {
        errors.push('Campaign message is required');
      }

      if (data.scheduleType === 'scheduled' && !data.scheduledDate) {
        errors.push('Scheduled date is required for scheduled campaigns');
      }

      if (data.scheduleType === 'recurring') {
        if (!data.recurringPattern) {
          errors.push('Recurring pattern is required for recurring campaigns');
        }
        if (!data.repeatCount || data.repeatCount < 1) {
          errors.push('Valid repeat count is required for recurring campaigns');
        }
      }

      res.json({
        success: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
        message: errors.length === 0 ? 'Campaign data is valid' : 'Validation failed'
      });
    } catch (err) {
      res.status(500).json({ 
        success: false,
        error: err.message 
      });
    }
  }
};