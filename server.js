require("dotenv").config();
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
  "https://www.jeenora.com"
];

if (process.env.NODE_ENV === 'development') {
  allowedOrigins.push(
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:8081"
  );
}

if (process.env.ALLOWED_ORIGINS) {
  allowedOrigins.push(...process.env.ALLOWED_ORIGINS.split(','));
}

// Trust proxy (Necessary for rate-limiting behind Nginx/Proxy)
app.set('trust proxy', 1);

// ============================================================
// 🛡️ SECURITY MIDDLEWARE STACK
// ============================================================

// 1. CORS
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('CORS: origin not allowed'));
  },
  credentials: true,
}));

// 2. HELMET (Hardened)
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://checkout.razorpay.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https://res.cloudinary.com", "https://*.jeenora.com"],
      connectSrc: ["'self'", "https://api.razorpay.com", "wss://*.jeenora.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
}));

// 3. Size Limits
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ limit: '5mb', extended: true }));

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
  max: process.env.NODE_ENV === 'production' ? 100 : 1000,
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


// ... SOCKET.IO ...
const io = socket(server, {
  cors: { origin: allowedOrigins, credentials: true, methods: ["GET", "POST"] },
});
socketHelper.init(io);
require('./utiles/socketHandlers').initHandlers(io);
console.log('✅ Socket.io initialized and handlers balanced');


const userController = require("./controllers/analytics/userController");

setInterval(() => {
  userController.cleanupInactiveUsers().catch(console.error);
}, 5 * 60 * 1000); // 5 minutes is plenty for background cleanup

// --- API ROUTES ---
app.use("/api", require("./routes/apiRoutes"));

// --- AWARENESS & ANALYTICS ---
app.use("/api/awareness", require("./routes/Awareness/bannerRoutes"));
app.use("/api/awareness", require("./routes/Awareness/pointRoutes"));
app.use("/api/awareness", require("./routes/Awareness/imageRoutes"));
app.use("/api/awareness", require("./routes/Awareness/socialCampaignRoutes"));
app.use("/api/awareness", require("./routes/Awareness/emailCampaignRoutes"));
app.use("/api/awareness", require("./routes/Awareness/successStoryRoutes"));
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
  res.json({ message: "✅ API is working" });
});

// ============================================================
// 🚨  GLOBAL ERROR HANDLER (Prevents stack trace leakage)
// ============================================================
app.use((err, req, res, next) => {
  // Log internally for debugging
  console.error(`[ERROR] ${req.method} ${req.originalUrl} →`, err.message);

  // CORS error (already handled above, but catch it here too)
  if (err.message && err.message.startsWith('CORS')) {
    return res.status(403).json({ error: 'CORS policy: request not allowed', success: false });
  }

  // Don't expose internal details in production
  const statusCode = err.status || err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'An internal server error occurred'
    : err.message;

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
