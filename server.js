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

// --- Sécurité & perf ---
const helmet = require("helmet");
const compression = require("compression");
const CampaignController = require("./controllers/Awareness/CampaignController");
const WhatsappController = require("./controllers/Awareness/WhatsappController");

// --- Créer serveur HTTP ---
const server = http.createServer(app);

// --- Origines autorisées ---
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:5174",
  "http://localhost:5000",
  "http://localhost:5173"
];

if (process.env.ALLOWED_ORIGINS) {
  const origins = process.env.ALLOWED_ORIGINS.split(',');
  allowedOrigins.push(...origins);
}

// --- Middlewares globaux ---
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
app.use(helmet());
app.use(compression());

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
// ... existing code ...

app.use("/api/admin/jobs", require("./routes/admin/adminJobRoutes")); // Admin Job Management
app.use("/api/admin/applications", require("./routes/admin/adminApplicationRoutes")); // Admin Application Management
app.use("/api/admin/resumes", require("./routes/admin/adminResumeRoutes")); // Admin Resume Management
app.use("/api/admin/chat-support", require("./routes/admin/chatSupportRoutes")); // Admin Chat Support
let allCustomer = [];
let allSeller = [];
let admin = {};

const addUser = (customerId, socketId, userInfo) => {
  if (!allCustomer.some((u) => u.customerId === customerId)) {
    allCustomer.push({ customerId, socketId, userInfo });
  }
};

const addSeller = (sellerId, socketId, userInfo) => {
  const checkSeller = allSeller.find((u) => u.sellerId === sellerId);
  if (checkSeller) {
    checkSeller.socketId = socketId;
    checkSeller.userInfo = userInfo;
  } else {
    allSeller.push({ sellerId, socketId, userInfo });
  }
};

const findCustomer = (customerId) =>
  allCustomer.find((c) => c.customerId === customerId);
const findSeller = (sellerId) => allSeller.find((c) => c.sellerId === sellerId);

const remove = (socketId) => {
  allCustomer = allCustomer.filter((c) => c.socketId !== socketId);
  allSeller = allSeller.filter((c) => c.socketId !== socketId);
};

io.on("connection", (soc) => {
  console.log("🔌 New socket connection");

  soc.on("add_user", (customerId, userInfo) => {
    addUser(customerId, soc.id, userInfo);
    io.emit("activeSeller", allSeller);
  });

  soc.on("add_seller", (sellerId, userInfo) => {
    addSeller(sellerId, soc.id, userInfo);
    io.emit("activeSeller", allSeller);
  });

  soc.on("add_hireuser", (sellerId, userInfo) => {
    console.log('Hire User Added:', sellerId, soc.id);
    addSeller(sellerId, soc.id, userInfo);
    io.emit("activeSeller", allSeller);
  });

  soc.on("send_seller_message", (msg) => {
    const customer = findCustomer(msg.receverId);
    if (customer) {
      soc.to(customer.socketId).emit("seller_message", msg);
    }
  });

  soc.on("send_customer_message", (msg) => {
    const seller = findSeller(msg.receverId);
    if (seller) {
      soc.to(seller.socketId).emit("customer_message", msg);
    }
  });

  soc.on("send_message_admin_to_seller", (msg) => {
    console.log('Admin to Seller:', msg);
    const seller = findSeller(msg.receverId);
    console.log('Found Seller:', seller ? 'Yes' : 'No', msg.receverId);
    if (seller) {
      soc.to(seller.socketId).emit("receved_admin_message", msg);
    }
  });

  soc.on("send_message_seller_to_admin", (msg) => {
    console.log('Seller to Admin:', msg);
    if (admin.socketId) {
      soc.to(admin.socketId).emit("receved_seller_message", msg);
    }
  });

  soc.on("send_message_hire_to_admin", (msg) => {
    console.log('Hire to Admin:', msg);
    if (admin.socketId) {
      soc.to(admin.socketId).emit("receved_seller_message", msg);
    } else {
      console.log('Admin not connected for Hire message');
    }
  });

  soc.on("send_message_admin_to_hire", (msg) => {
    console.log('Admin to Hire:', msg);
    const seller = findSeller(msg.receverId);
    if (seller) {
      soc.to(seller.socketId).emit("receved_admin_message", msg);
    } else {
      console.log('Hire User not found:', msg.receverId);
    }
  });

  // --- HIRE: Admin <-> User (Candidate) Live Messaging ---
  soc.on("send_message_admin_to_user", (msg) => {
    // msg should contain receiverId (userId of the candidate)
    const user = allCustomer.find((c) => c.customerId === msg.receiverId);
    if (user) {
      soc.to(user.socketId).emit("received_admin_message", msg);
    }
  });

  soc.on("send_message_user_to_admin", (msg) => {
    // User sending message to admin/seller
    // If msg.receiverId is provided (e.g. for a specific Seller), use findSeller
    // Else if generic admin, use admin.socketId

    if (msg.receiverId) {
      // Check if receiver is a seller (Employer)
      const seller = findSeller(msg.receiverId);
      if (seller) {
        soc.to(seller.socketId).emit("received_user_message", msg);
        return;
      }
    }

    // Default to main Admin if no specific seller found or ID matches admin
    if (admin.socketId) {
      soc.to(admin.socketId).emit("received_user_message", msg);
    }
  });

  // --- CHAT UPDATES: Read Receipts & Online Status ---
  soc.on('join_application_chat', ({ applicationId, userId, role }) => {
    soc.join(applicationId); // Join a specific room for this application chat
    // Notify others in room
    soc.to(applicationId).emit('chat_partner_status', { applicationId, status: 'online', userId, role });
  });

  soc.on('leave_application_chat', ({ applicationId, userId, role }) => {
    soc.leave(applicationId);
    soc.to(applicationId).emit('chat_partner_status', { applicationId, status: 'offline', userId, role });
  });

  soc.on('message_read_signal', ({ applicationId, readerId }) => {
    // Relay read status to others in the room
    soc.to(applicationId).emit('message_read_update', { applicationId, readerId });
  });

  soc.on("add_admin", (adminInfo) => {
    delete adminInfo.email;
    delete adminInfo.password;
    admin = { ...adminInfo, socketId: soc.id };
    console.log("Admin connected:", admin.socketId);
    io.emit("activeSeller", allSeller);
  });

  soc.on("disconnect", () => {
    console.log("🚫 Socket disconnected");
    remove(soc.id);
    io.emit("activeSeller", allSeller);
  });
});

const userController = require("./controllers/analytics/userController");

setInterval(() => {
  console.log("⏱️ Running automatic user session cleanup...");
  userController.cleanupInactiveUsers().catch(console.error);
}, 60 * 1000);

// --- ROUTES API ---
app.use("/api/home", require("./routes/home/homeRoutes"));
app.use("/api", require("./routes/authRoutes"));
app.use("/api", require("./routes/order/orderRoutes"));
app.use("/api", require("./routes/home/cardRoutes"));
app.use("/api", require("./routes/dashboard/categoryRoutes"));
app.use("/api/awareness", require("./routes/Awareness/bannerRoutes"));
app.use("/api/awareness", require("./routes/Awareness/pointRoutes"));
app.use("/api/awareness", require("./routes/Awareness/imageRoutes"));
app.use("/api/awareness", require("./routes/Awareness/successStoryRoutes"));
app.use("/api/awareness", require("./routes/Awareness/campaignRoutes"));
app.use("/api/awareness", require("./routes/Awareness/guideRoutes"));
app.use("/api/awareness", require("./routes/Awareness/videoRoutes"));
app.use("/api/awareness", require("./routes/Awareness/accountsRoutes"));
app.use("/api/awareness", require("./routes/Awareness/bannerRoutes"));
//app.use("/api/analytics", require("./routes/analytics/awareness"));
//app.use("/api/analytics", require("./routes/analytics/core"));
//app.use("/api/analytics", require("./routes/analytics/ecommerce"));
app.use("/api/analytics", require("./routes/analytics/index"));
app.use("/api", require("./routes/dashboard/sellerRoutes"));
app.use("/api", require("./routes/home/customerAuthRoutes"));
app.use("/api", require("./routes/chatRoutes"));
app.use("/api", require("./routes/paymentRoutes"));
app.use("/api", require("./routes/dashboard/dashboardRoutes"));
app.use("/api/hire/skills", require("./routes/hire/skillCategoryRoutes"));
app.use("/api/hire/user", require("./routes/hire/hireUserRoutes"));
app.use("/api/hire/payment", require("./routes/hire/paymentRoutes"));
app.use("/api/hire/job", require("./routes/hire/jobRoutes"));
// app.use("/api/admin/jobs", require("./routes/admin/adminJobRoutes")); // Duplicate
// app.use("/api/admin/applications", require("./routes/admin/adminApplicationRoutes")); // Duplicate
// app.use("/api/admin/resumes", require("./routes/admin/adminResumeRoutes")); // Duplicate
// app.use("/api/admin/chat-support", require("./routes/admin/chatSupportRoutes")); // Moved up
app.use("/api/hire/jobs", require("./routes/hire/jobSearchRoutes")); // Public Job Search
app.use("/api/hire/applications", require("./routes/hire/applicationRoutes")); // Job Applications
app.use("/api/hire/setting", require("./routes/hire/adminSettingRoutes"));
app.use("/api/hire/notifications", require("./routes/hire/notificationRoutes"));
app.use("/api/hire/location", require("./routes/hire/locationRoutes"));
app.use("/api/hire/resume-requests", require("./routes/hire/resumeRequestRoutes")); // #swagger.tags = ['Hire Resume Request']
app.use("/api/hire/resumes", require("./routes/hire/hireResumeRoutes")); // #swagger.tags = ['Hire Resume Management']
app.use("/api/hire/resume-editor", require("./routes/hire/hireResumeEditorRoutes")); // #swagger.tags = ['Hire Resume Editor']
app.use("/api/hire/profile", require("./routes/hire/hireProfileRoutes")); // #swagger.tags = ['Hire Profile']
app.use("/api/hire", require("./routes/hire/resumeEditorRoutes")); // Editor Management

// app.use("/api/hire/resume-request", require("./routes/hire/resumeEditorRoutes")); // #swagger.tags = ['Hire Resume Editor'] - Might be legacy
app.use("/api/hire/auth", require("./routes/hire/hireAuthRoutes"));
app.use("/api/hire/otp", require("./routes/hire/otpRoutes")); // OTP verification for signup/login
app.use("/api/hire/password", require("./routes/hire/passwordResetRoutes")); // Password reset
app.use("/api/hire/interview", require("./routes/hire/interviewRoutes")); // #swagger.tags = ['Hire Interview']
app.use("/api/hire/employer", require("./routes/hire/employerRoutes")); // #swagger.tags = ['Hire Employer']


WhatsappController.setSocket(io);
app.get("/api/test", (req, res) => {
  res.json({ message: "✅ API is working on Azure with Socket.IO" });
});

app.get("*", (req, res) => {
  if (req.originalUrl.startsWith("/api")) {
    return res.status(404).json({ error: "❌ API route not found" });
  }
  res.send("✅ BimaStore Backend is running. No frontend served here.");
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
