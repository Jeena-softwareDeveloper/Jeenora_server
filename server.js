require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const cookieParser = require("cookie-parser");
const http = require("http");
const socket = require("socket.io");
const socketHelper = require("./utiles/socket");
const { dbConnect } = require("./utiles/db");
const swaggerUi = require("swagger-ui-express");
const swaggerFile = require("./swagger-output.json");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const xss = require("xss-clean");
const hpp = require("hpp");

const helmet = require("helmet");
const compression = require("compression");
// const CampaignController = require("./controllers/Awareness/CampaignController"); // Testing

// --- Créer serveur HTTP ---
const server = http.createServer(app);

// --- Origines autorisées ---
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  "http://10.248.6.136:3000",
  "http://10.248.6.136:3001",
  "http://10.248.6.136:5000",
  "http://10.248.6.136:5001",
  "http://10.248.6.136:8081",
  "http://10.248.6.86:3000",
  "http://10.248.6.86:3001",
  "http://10.248.6.86:5000",
  "http://10.248.6.86:5001",
  "http://10.248.6.86:8081",
  "http://10.38.52.136:3000",
  "http://10.38.52.136:3001",
  "http://10.38.52.136:5000",
  "http://10.38.52.136:5001",
  "http://10.38.52.136:8081",
  "http://10.60.57.136:3000",
  "http://10.60.57.136:3001",
  "http://10.60.57.136:5000",
  "http://10.60.57.136:5001",
  "http://10.60.57.136:8081",
  "http://localhost:5174",
  "http://localhost:5173",
  "https://hire.jeenora.com",
  "https://dashboard.jeenora.com",
  "https://jeenora.com",
  "https://www.jeenora.com",
  "http://localhost:8081"
];

if (process.env.ALLOWED_ORIGINS) {
  const origins = process.env.ALLOWED_ORIGINS.split(',');
  allowedOrigins.push(...origins);
}
// Trust proxy (Necessary for express-rate-limit to work behind Azure/Reverse Proxy)
app.set('trust proxy', 1);

// ============================================================
// 🛡️  SECURITY MIDDLEWARE STACK
// ============================================================

// 1. CORS - Only allow trusted origins
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('CORS: origin not allowed'));
    },
    credentials: true,
  })
);

// 2. HELMET – Secure HTTP headers (hardened config)
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow CDN images
  contentSecurityPolicy: false, // Keep disabled; we manage this at Nginx level
}));

// 3. Parse JSON / URL-encoded bodies with size limit
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// 4. COOKIES
app.use(cookieParser());

// 5. NoSQL INJECTION PREVENTION – Sanitise all req.body, req.params, req.query
app.use(mongoSanitize({
  replaceWith: '_',          // Replace $ and . with _ instead of stripping
  onSanitize: ({ req, key }) => {
    console.warn(`🚨 [NOSQL INJECTION] Sanitised key: ${key} on ${req.originalUrl}`);
  },
}));

// 6. XSS PROTECTION – Clean malicious HTML/JS from request bodies
app.use(xss());

// 7. HTTP PARAMETER POLLUTION PREVENTION
app.use(hpp({
  whitelist: ['sort', 'fields', 'page', 'limit', 'category', 'status'], // Allow duplicate query params for these
}));

// 8. GLOBAL API RATE LIMIT – 100 requests per minute per IP (all endpoints)
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 2000 : 200,
  message: { error: 'Too many requests, please slow down.', success: false },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', globalLimiter);

// 9. COMPRESSION
app.use(compression());

// 10. STATIC FILES
// app.use(express.static('public')); // Removed to stop serving the React UI

// 11. REQUEST LOGGER
app.use((req, res, next) => {
  console.log(`[REQ] ${req.method} ${req.originalUrl}`);
  next();
});

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerFile));
// ... SOCKET.IO ...
const io = socket(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST"],
  },
});
socketHelper.init(io);
require('./utiles/socketHandlers').initHandlers(io);
console.log('✅ Socket.io initialized and handlers balanced');


const userController = require("./controllers/analytics/userController");

setInterval(() => {
  userController.cleanupInactiveUsers().catch(console.error);
}, 5 * 60 * 1000); // 5 minutes is plenty for background cleanup

// --- ADMIN ROUTES ---
app.use("/api/admin/jobs", require("./routes/admin/adminJobRoutes"));
app.use("/api/admin/applications", require("./routes/admin/adminApplicationRoutes"));
app.use("/api/admin/resumes", require("./routes/admin/adminResumeRoutes"));
app.use("/api/admin/chat-support", require("./routes/admin/chatSupportRoutes"));

// --- WEAR SECTION ---
app.use("/api/home", require("./routes/wear/homeRoutes"));
app.use("/api/auth", require("./routes/Awareness/farmerAuthRoutes"));
app.use("/api", require("./routes/apiRoutes"));
app.use("/api/v1", require("./routes/apiRoutes"));
app.use("/api", require("./routes/wear/legacyAuthRoutes"));
app.use("/api", require("./routes/wear/orderRoutes"));
app.use("/api", require("./routes/wear/cardRoutes"));
app.use("/api", require("./routes/wear/categoryRoutes"));
app.use("/api/awareness", require("./routes/Awareness/bannerRoutes"));
app.use("/api/awareness", require("./routes/Awareness/pointRoutes"));
app.use("/api/awareness", require("./routes/Awareness/imageRoutes"));
app.use("/api/awareness", require("./routes/Awareness/successStoryRoutes"));
app.use("/api/awareness", require("./routes/Awareness/campaignRoutes"));
app.use("/api/awareness", require("./routes/Awareness/guideRoutes"));
app.use("/api/awareness", require("./routes/Awareness/videoRoutes"));
app.use("/api/awareness", require("./routes/Awareness/accountsRoutes"));
app.use("/api/awareness", require("./routes/Awareness/communityRoutes"));
app.use("/api/awareness", require("./routes/Awareness/aiDoctorRoutes"));
app.use("/api/awareness", require("./routes/Awareness/statsRoutes"));
app.use("/api/awareness", require("./routes/Awareness/tickerRoutes"));
app.use("/api/analytics", require("./routes/analytics/index"));
app.use("/api", require("./routes/wear/sellerRoutes"));
app.use("/api", require("./routes/wear/productRoutes"));
app.use("/api", require("./routes/wear/customerAuthRoutes"));
app.use("/api", require("./routes/wear/chatRoutes"));
app.use("/api", require("./routes/wear/paymentRoutes"));
app.use("/api", require("./routes/wear/dashboardRoutes"));

// --- HIRE SECTION ---
app.use("/api/hire/skills", require("./routes/hire/skillCategoryRoutes"));
app.use("/api/hire/user", require("./routes/hire/hireUserRoutes"));
app.use("/api/hire/payment", require("./routes/hire/paymentRoutes"));
app.use("/api/hire/job", require("./routes/hire/jobRoutes"));
app.use("/api/hire/jobs", require("./routes/hire/jobSearchRoutes"));
app.use("/api/hire/applications", require("./routes/hire/applicationRoutes"));
app.use("/api/hire/setting", require("./routes/hire/adminSettingRoutes"));
app.use("/api/hire/notifications", require("./routes/hire/notificationRoutes"));
app.use("/api/hire/location", require("./routes/hire/locationRoutes"));
app.use("/api/hire/resume-requests", require("./routes/hire/resumeRequestRoutes"));
app.use("/api/hire/resumes", require("./routes/hire/hireResumeRoutes"));
app.use("/api/hire/resume-editor", require("./routes/hire/hireResumeEditorRoutes"));
app.use("/api/hire/profile", require("./routes/hire/hireProfileRoutes"));
app.use("/api/hire", require("./routes/hire/resumeEditorRoutes"));
app.use("/api/hire/auth", require("./routes/hire/hireAuthRoutes"));
app.use("/api/hire/otp", require("./routes/hire/otpRoutes"));
app.use("/api/hire/password", require("./routes/hire/passwordResetRoutes"));
app.use("/api/hire/interview", require("./routes/hire/interviewRoutes"));
app.use("/api/hire/employer", require("./routes/hire/employerRoutes"));
app.use("/api/hire/static", require("./routes/hire/staticContentRoutes"));

// --- WEAR MODULES ---
app.use("/api/wear/auth", require("./routes/wear/buyerAuthRoutes")); // Wear Buyer Auth (Firebase/Trusted)
app.use("/api/wear/category", require("./routes/wear/wearCategoryRoutes"));
app.use("/api/wear/log", require("./routes/wear/wearLogRoutes"));
app.use("/api/wear/supplier", require("./routes/wear/supplierRoutes"));
app.use("/api/wear/wishlist", require("./routes/wear/wearWishlistRoutes"));
app.use("/api/wear/cart", require("./routes/wear/wearCartRoutes"));
app.use("/api/wear/review", require("./routes/wear/wearReviewRoutes"));
app.use("/api/wear/banner", require("./routes/wear/wearBannerRoutes"));
app.use("/api", require("./routes/wear/wearOfferRoutes"));
app.use("/api", require("./routes/wear/productOfferRoutes"));
app.use("/api", require("./routes/wear/deliveryRoutes"));

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
    return res.status(404).json({ error: "❌ API route not found" });
  }
  res.send("✅ Why You are Check With me Fool back it");
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
