require("dotenv").config();

// ============================================================
// 🛡️ ENVIRONMENT VALIDATION
// ============================================================
const requiredEnvVars = [
  'PORT',
  'NODE_ENV',
  'DB_URL',
  'FRONTEND_URL',
  'SECRET',
  'ADMIN_EMAIL',
  'ADMIN_PASSWORD',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'SMTP_HOST',
  'SMTP_PORT',
  'EMAIL_USER',
  'EMAIL_PASSWORD',
  'DEEPSEEK_API_KEY'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars);
  console.error('💡 Please check your .env file or set these variables');
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  } else {
    console.warn('⚠️  Development mode: Continuing with missing variables (some features may fail)');
  }
}

// Security warnings for exposed credentials in development
if (process.env.NODE_ENV === 'development') {
  const sensitiveDefaults = {
    'ADMIN_PASSWORD': 'Jeenora.12345',
    'EMAIL_PASSWORD': 'Jeena.1234'
  };

  for (const [varName, defaultValue] of Object.entries(sensitiveDefaults)) {
    if (process.env[varName] && process.env[varName].includes(defaultValue)) {
      console.warn(`⚠️  WARNING: ${varName} appears to be using default/example value`);
      console.warn(`   Consider changing this in production!`);
    }
  }
}
const express = require("express");
const app = express();
const cors = require("cors");
const cookieParser = require("cookie-parser");
const http = require("http");
const socket = require("socket.io");
const socketHelper = require("./utiles/socket");
const { dbConnect } = require("./utiles/db");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const xss = require("xss-clean");
const hpp = require("hpp");

const helmet = require("helmet");
const compression = require("compression");

// --- Create Server ---
const server = http.createServer(app);

// --- Environment-Aware Origins ---
let allowedOrigins = [
  "https://hire.jeenora.com",
  "https://dashboard.jeenora.com",
  "https://jeenora.com",
  "https://www.jeenora.com",
  "https://jeenoraecommerce.vercel.app"
];

if (process.env.NODE_ENV === 'development') {
  allowedOrigins.push(
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5173",
    "http://10.242.59.136:5173",
    "http://10.242.59.136:5174",
    "http://127.0.0.1:5175",
    "exp://192.23.1.35:8081"
  );
}

// Ensure unique origins and clean up
allowedOrigins = [...new Set(allowedOrigins.map(o => o.trim().replace(/\/$/, "")))];

console.log('Allowed Origins:', allowedOrigins);


// Trust proxy (Necessary for rate-limiting behind Nginx/Proxy)
app.set('trust proxy', 1);

// ============================================================
// 🛡️ SECURITY MIDDLEWARE STACK
// ============================================================

// 1. CORS
app.use(cors({
  origin: (origin, callback) => {
    // In development, allow ALL origins
    if (process.env.NODE_ENV === 'development') return callback(null, true);

    // Allow requests with no origin (mobile apps, server-to-server, curl health checks)
    // Security is enforced by the allowedOrigins list for browser requests that DO send origin
    if (!origin) return callback(null, true);

    const isAllowed = allowedOrigins.includes(origin) || 
                      (typeof origin === 'string' && origin.endsWith('.vercel.app')) || 
                      (typeof origin === 'string' && origin.endsWith('.jeenora.com')) || 
                      origin === 'https://jeenora.com';
    if (isAllowed) return callback(null, true);
    return callback(new Error('CORS: origin not allowed'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  // Explicitly allow headers required by the dashboard and ecommerce apps.
  // Wildcard '*' DOES NOT work with credentials: true in most strict browsers.
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'x-website-type'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining'],
  maxAge: 86400, // Cache preflight 24h
}));

// 2. HELMET (Hardened)
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'same-site' },
  // CSP for API server (no scripts served from here — strict)
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],           // Block everything by default
      scriptSrc: ["'none'"],            // API server serves no scripts
      styleSrc: ["'none'"],
      imgSrc: ["'self'"],
      connectSrc: ["'self'"],
      fontSrc: ["'none'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
      frameAncestors: ["'none'"],       // 🔴 Block clickjacking at API level
      formAction: ["'self'"],
      baseUri: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  // 🔴 Clickjacking protection
  frameguard: { action: 'deny' },
  // 🟠 MIME sniffing protection
  noSniff: true,
  // 🟠 Referrer Policy
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  // XSS Filter (legacy browsers)
  xssFilter: true,
  // HSTS (2 years, preload)
  hsts: {
    maxAge: 63072000,
    includeSubDomains: true,
    preload: true,
  },
  // Hide X-Powered-By
  hidePoweredBy: true,
}));

// Permissions-Policy header (helmet doesn't add this natively)
app.use((req, res, next) => {
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()'
  );
  next();
});

// 3. Size Limits
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 4. Cookies
app.use(cookieParser());

// 5. NoSQL Injection
app.use(mongoSanitize({ replaceWith: '_' }));

// 6. XSS
app.use(xss());

// 7. HPP
app.use(hpp({ whitelist: ['sort', 'fields', 'page', 'limit', 'category', 'status'] }));

// 8. Global Rate Limit
const globalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 1000 : 100000, // Unlimited in dev
  message: { error: 'Too many requests, please slow down.', success: false },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', globalLimiter);

// 9. Compression
app.use(compression());

// 10. Request Logger (Development Only)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`[REQ] ${req.method} ${req.originalUrl}`);
    next();
  });
}


// --- SOCKET.IO ---

const io = socket(server, {
  cors: { 
    origin: (origin, callback) => {
      if (process.env.NODE_ENV === 'development' || !origin) return callback(null, true);
      const isAllowed = allowedOrigins.includes(origin) || 
                        (typeof origin === 'string' && origin.endsWith('.vercel.app')) || 
                        (typeof origin === 'string' && origin.endsWith('.jeenora.com')) || 
                        origin === 'https://jeenora.com';
      if (isAllowed) return callback(null, true);
      return callback(new Error('CORS: origin not allowed'));
    },
    credentials: true, 
    methods: ["GET", "POST"] 
  },
  transports: ['websocket', 'polling'], // Prioritize websocket
  allowEIO3: true // Support older clients if needed
});
socketHelper.init(io);
require('./utiles/socketHandlers').initHandlers(io);
console.log('✅ Socket.io initialized (WS prioritized)');


const userController = require("./controllers/analytics/userController");

setInterval(() => {
  userController.cleanupInactiveUsers().catch(console.error);
}, 5 * 60 * 1000); // 5 minutes is plenty for background cleanup

// ============================================================
// 🤖 AI CRON JOBS — Predictive Intelligence (2030-level)
// ============================================================
const cron = require('node-cron');
const aiMasterController = require('./controllers/wear/aiMasterController');
const orderController = require('./controllers/wear/orderController');
const whatsappClient = require('./utiles/whatsappClient');
// 🚀 Initialize WhatsApp Client on startup (attempts auto-reconnect if session exists)
whatsappClient.initialize();

// 📦 Smart Logistics AI Tracking — runs every 6 hours
cron.schedule('0 */6 * * *', async () => {
  try {
    console.log('[CRON] 📦 Starting Automated AI Logistics Tracking...');
    await orderController.automated_tracking_check();
  } catch (error) {
    console.error('[CRON] ❌ Logistics Tracking crashed:', error.message);
  }
});

// 🔔 Predictive Restock Alert — runs every day at 9:00 AM IST
cron.schedule('30 3 * * *', async () => {
  try {
    console.log('[CRON] ⏰ 9:00 AM IST — Starting Predictive Restock AI Job...');
    await aiMasterController.run_predictive_restock_cron();
  } catch (error) {
    console.error('[CRON] ❌ Restock cron crashed:', error.message);
  }
}, { timezone: 'Asia/Kolkata' });

// 📊 Admin Daily Briefing — runs every day at 8:00 AM IST
cron.schedule('0 2 * * *', async () => {
  try {
    console.log('[CRON] ⏰ 8:00 AM IST — Starting Admin Daily Briefing...');
    await aiMasterController.generate_admin_daily_briefing();
  } catch (error) {
    console.error('[CRON] ❌ Admin Briefing cron crashed:', error.message);
  }
}, { timezone: 'Asia/Kolkata' });

// 📈 Supplier Weekly Growth Report — runs every Monday at 10:00 AM IST
cron.schedule('30 4 * * 1', async () => {
  try {
    console.log('[CRON] ⏰ Monday 10:00 AM IST — Starting Supplier Weekly Reports...');
    await aiMasterController.generate_supplier_weekly_report();
  } catch (error) {
    console.error('[CRON] ❌ Supplier Report cron crashed:', error.message);
  }
}, { timezone: 'Asia/Kolkata' });

// 📊 Supplier Daily Performance Pulse — Scheduled from .env
const supplierReportTime = process.env.SUPPLIER_REPORT_TIME || '20:00';
const [reportHour, reportMinute] = supplierReportTime.split(':');
cron.schedule(`${reportMinute} ${reportHour} * * *`, async () => {
  try {
    console.log(`[CRON] ⏰ ${supplierReportTime} — Starting Daily Supplier Performance Pulse...`);
    await aiMasterController.generate_supplier_daily_report();
  } catch (error) {
    console.error('[CRON] ❌ Daily Supplier Report cron crashed:', error.message);
  }
}, { timezone: 'Asia/Kolkata' });

console.log('[CRON] ✅ AI Predictive & Performance Crons registered.');

// --- API ROUTES ---
app.use("/api", require("./routes/apiRoutes"));
app.use("/api/v1", require("./routes/apiRoutes")); // Legacy/Versioned Compatibility

// --- AWARENESS & ANALYTICS ---
app.use("/api/awareness", require("./routes/Awareness/bannerRoutes"));
app.use("/api/awareness", require("./routes/Awareness/pointRoutes"));
app.use("/api/awareness", require("./routes/Awareness/imageRoutes"));
app.use("/api/awareness", require("./routes/Awareness/socialCampaignRoutes"));
app.use("/api/awareness/rewards", require("./routes/Awareness/rewardRoutes"));
app.use("/api/awareness", require("./routes/Awareness/emailCampaignRoutes"));
app.use("/api/awareness", require("./routes/Awareness/successStoryRoutes"));
// Proxy/Alias for misspelled frontend request
app.use("/api/awareness/successstorys", require("./routes/Awareness/successStoryRoutes"));

app.use("/api/awareness", require("./routes/Awareness/guideRoutes"));
app.use("/api/awareness", require("./routes/Awareness/videoRoutes"));
app.use("/api/awareness", require("./routes/Awareness/accountsRoutes"));
app.use("/api/awareness", require("./routes/Awareness/communityRoutes"));
app.use("/api/awareness", require("./routes/Awareness/aiDoctorRoutes"));
app.use("/api/awareness", require("./routes/Awareness/statsRoutes"));
app.use("/api/awareness", require("./routes/Awareness/pesticideRoutes"));
app.use("/api/awareness", require("./routes/Awareness/tickerRoutes"));
app.use("/api/awareness", require("./routes/Awareness/homeContentRoutes"));

app.get("/api/test", (req, res) => {
  res.json({ message: "✅ API is working", version: "2.1" });
});

// ============================================================
// 🚨  GLOBAL ERROR HANDLER (Prevents stack trace leakage)
// ============================================================
app.use((err, req, res, next) => {
  // Log internally for debugging
  console.error(`[ERROR] ${req.method} ${req.originalUrl} →`, err.message);

  const statusCode = err.status || err.statusCode || 500;
  
  // CORS error
  if (err.message && err.message.startsWith('CORS')) {
    return res.status(403).json({ error: 'CORS policy: request not allowed', success: false });
  }

  // Handle Payload Too Large
  if (statusCode === 413) {
    return res.status(413).json({ error: 'File/Request too large! Please reduce image size.', success: false });
  }

  // In production, mask 500 errors but show specific client errors (400, 404, 413, etc)
  let message = err.message;
  if (process.env.NODE_ENV === 'production' && statusCode >= 500) {
    message = 'An internal server error occurred';
  }

  return res.status(statusCode).json({ error: message, success: false });
});

app.get("*", (req, res) => {
  if (req.originalUrl.startsWith("/api")) {
    console.log(`[404 NOT FOUND] ${req.method} ${req.originalUrl}`);
    return res.status(404).json({ error: "❌ API route not found", success: false });
  }
  res.status(200).send("✅ Jeenora API Server is Running");
});

const port = process.env.PORT || 5000;
dbConnect()
  .then(() => {
    server.listen(port, () => console.log(`✅ Server running on port ${port}`));
  })
  .catch((err) => {
    console.error("❌ Failed to connect to DB:", err.message);
    process.exit(1);
  });
