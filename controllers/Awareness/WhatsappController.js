const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const mongoose = require('mongoose');
const path = require('path');
const os = require('os');
const Analytics = require('../../models/Awareness/Subscriber/AnalyticsModel');
require('dotenv').config();


const WHATSAPP_CONFIG = {
  defaultCountryCode: process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || '91',
  allowedCountryCodes: (process.env.WHATSAPP_ALLOWED_COUNTRY_CODES || '91,93,1,44,86').split(','),
  QR_EXPIRY_MS: 5 * 60 * 1000,
  INIT_TIMEOUT: 120000,
  MAX_RETRIES: 3
};


const PLATFORM_CONFIG = {
  isWindows: process.platform === 'win32',
  isMac: process.platform === 'darwin',
  isLinux: process.platform === 'linux',
  platform: process.platform,
  arch: process.arch
};

console.log(`🖥️  Running on: ${PLATFORM_CONFIG.platform} (${PLATFORM_CONFIG.arch})`);


let isWhatsAppReady = false;
let latestQR = null;
let qrGeneratedAt = null;
let waClient = null;
let initializationInProgress = false;
let isManualLogout = false;
let initializationTimeout = null;
let io = null;


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


const cleanupBrowserProcesses = async () => {
  console.log('🧹 Cleaning up browser processes...');

  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    const fs = require('fs');

    const platform = process.platform;

    console.log(`🖥️  Performing cleanup for: ${platform}`);

    if (platform === 'win32') {

      try {
        await execAsync('taskkill /f /im chrome.exe /im chromium.exe /im chromedriver.exe /t 2>nul || exit 0');
        console.log('✅ Windows process cleanup completed');
      } catch (error) {
        console.log('✅ Windows cleanup finished');
      }
    } else {

      const killCommands = [
        'pkill -f "chrome.*whatsapp" || true',
        'pkill -f "chromium.*whatsapp" || true',
        'pkill -f "puppeteer.*whatsapp" || true',
        'pkill -f "chrome.*--type=renderer" || true',
        'pkill -f "chromium.*--type=renderer" || true',
        'pkill -f "chromedriver" || true'
      ];


      for (const cmd of killCommands) {
        try {
          await execAsync(cmd);
        } catch (e) {

        }
      }

      await new Promise(resolve => setTimeout(resolve, 2000));


      try {
        await execAsync('pkill -9 -f "chrome\\|chromium\\|puppeteer" || true');
      } catch (e) {

      }

      console.log('✅ Unix process cleanup completed');
    }

  } catch (error) {
    console.log('✅ Cleanup operations completed');
  }
};

const cleanupWhatsAppSessions = async (clearSessionData = false) => {
  try {
    console.log('🧹 Cleaning up WhatsApp sessions...');

    await cleanupBrowserProcesses();

    if (clearSessionData) {
      try {
        const sessionPath = './whatsapp-sessions';
        const fs = require('fs');

        if (fs.existsSync(sessionPath)) {

          if (process.platform === 'win32') {
            const { execSync } = require('child_process');
            execSync(`rmdir /s /q "${sessionPath}"`, { stdio: 'ignore' });
          } else {
            fs.rmSync(sessionPath, { recursive: true, force: true });
          }
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


const createWhatsAppClient = () => {
  console.log('🔧 Creating new WhatsApp client instance...');

  if (waClient) {
    try {
      waClient.removeAllListeners();
    } catch (e) {
      console.log('⚠️ Error removing listeners:', e.message);
    }
  }


  // Determine executable path dynamically
  let executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;

  if (!executablePath) {
    if (process.platform === 'win32') {
      const possiblePaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        path.join(os.homedir(), 'AppData\\Local\\Google\\Chrome\\Application\\chrome.exe')
      ];

      for (const p of possiblePaths) {
        // We need to require fs inside function if not globally avail or use existing import
        const fs = require('fs');
        if (fs.existsSync(p)) {
          console.log(`✅ Found Chrome at: ${p}`);
          executablePath = p;
          break;
        }
      }

      if (!executablePath) {
        console.warn('⚠️ Chrome not found in standard paths. Puppeteer will try to use bundled Chromium if available.');
      }
    } else if (process.platform === 'linux') {
      executablePath = '/usr/bin/chromium-browser';
    } else if (process.platform === 'darwin') {
      executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    }
  }

  waClient = new Client({
    authStrategy: new LocalAuth({
      clientId: "awareness-campaign-client",
      dataPath: sessionPath
    }),
    webVersionCache: {
      type: "remote",
      remotePath:
        "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html",
    },
    puppeteer: {
      headless: false, // Visible browser for debugging
      executablePath: executablePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--no-default-browser-check',
        '--disable-extensions',
        '--disable-default-apps',
        '--disable-translate',
        '--disable-features=VizDisplayCompositor',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-ipc-flooding-protection',
        '--renderer-process-limit=1',
        '--no-pings'
      ],
      ignoreDefaultArgs: ['--disable-extensions'],
      timeout: 0
    },
    takeoverOnConflict: true,
    restartOnAuthFail: true
  });


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
    console.log(`🖥️  Platform: ${PLATFORM_CONFIG.platform}`);

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
      isManualLogout = false;
      return;
    }

    console.log('🔄 Attempting to reconnect...');
    setTimeout(() => {
      initializeWhatsApp();
    }, 5000);
  });

  console.log('✅ New WhatsApp client created with multi-OS support');
  return waClient;
};


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
      console.log(`🔄 Retrying in ${delay / 1000}s... (${retryCount + 1}/${WHATSAPP_CONFIG.MAX_RETRIES})`);

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
    // console.log('🔄 Starting WhatsApp initialization...');
    // setTimeout(() => {
    //   initializeWhatsApp();
    // }, 3000);
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


const sendWhatsApp = async (to, message, mediaUrl = null, campaignId = null) => {
  try {
    if (mediaUrl && mediaUrl.includes('http://')) {
      mediaUrl = mediaUrl.replace('http://', 'https://');
    }

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
      canConnect: !isWhatsAppReady && !initializationInProgress,
      platform: PLATFORM_CONFIG.platform
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
    let { to, message, mediaUrl } = req.body;

    if (mediaUrl && mediaUrl.includes('http://')) {
      mediaUrl = mediaUrl.replace('http://', 'https://');
    }

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
    let { contacts, message, mediaUrl } = req.body;

    if (mediaUrl && mediaUrl.includes('http://')) {
      mediaUrl = mediaUrl.replace('http://', 'https://');
    }

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
    let { to, message, mediaUrl, caption } = req.body;

    if (mediaUrl && mediaUrl.includes('http://')) {
      mediaUrl = mediaUrl.replace('http://', 'https://');
    }

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


const getPlatformInfo = async (req, res) => {
  try {
    const platformInfo = {
      platform: PLATFORM_CONFIG.platform,
      arch: PLATFORM_CONFIG.arch,
      isWindows: PLATFORM_CONFIG.isWindows,
      isMac: PLATFORM_CONFIG.isMac,
      isLinux: PLATFORM_CONFIG.isLinux,
      hostname: os.hostname(),
      type: os.type(),
      release: os.release(),
      cpus: os.cpus().length,
      totalMemory: Math.round(os.totalmem() / (1024 * 1024 * 1024)) + ' GB',
      uptime: Math.round(os.uptime() / 3600) + ' hours',
      nodeVersion: process.version
    };

    res.json({
      success: true,
      platformInfo
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};


const initializeOnStartup = async () => {
  console.log('🚀 Server starting, waiting before WhatsApp initialization...');
  console.log(`🖥️  Platform: ${PLATFORM_CONFIG.platform} | Architecture: ${PLATFORM_CONFIG.arch}`);


  if (PLATFORM_CONFIG.isWindows) {
    console.log('💻 Running on Windows - Sessions maintained in ./whatsapp-sessions/');
  } else if (PLATFORM_CONFIG.isMac) {
    console.log('🍎 Running on macOS - Sessions maintained in ./whatsapp-sessions/');
  } else if (PLATFORM_CONFIG.isLinux) {
    console.log('🐧 Running on Linux - Sessions maintained in ./whatsapp-sessions/');
  }

  setTimeout(() => {
    if (!initializationInProgress && !isWhatsAppReady) {
      console.log('🔄 Starting WhatsApp initialization after server warmup...');
      initializeWhatsApp();
    }
  }, 10000);
};


initializeOnStartup();


module.exports = {

  getWhatsAppStatus,
  getWhatsAppQR,
  resetWhatsApp,
  forceReconnectWhatsApp,
  refreshQRCode,
  setSocket,


  sendSingleWhatsApp,
  sendBulkWhatsApp,
  sendMediaWhatsApp,


  getWhatsAppContacts,
  getWhatsAppGroups,


  getPlatformInfo,


  sendWhatsApp,
  isWhatsAppReady: () => isWhatsAppReady,
  analyzePhoneNumber,
  formatPhoneForWhatsApp,


  initializeWhatsApp,
  initializeOnStartup
};