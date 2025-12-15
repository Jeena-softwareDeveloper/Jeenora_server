require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const cookieParser = require("cookie-parser");
const http = require("http");
const socket = require("socket.io");
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
  "http://localhost:5173",
  "http://localhost:5000",
];

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

// --- SOCKET.IO ---
const io = socket(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST"],
  },
});

let allCustomer = [];
let allSeller = [];
let admin = {};

const addUser = (customerId, socketId, userInfo) => {
  if (!allCustomer.some((u) => u.customerId === customerId)) {
    allCustomer.push({ customerId, socketId, userInfo });
  }
};

const addSeller = (sellerId, socketId, userInfo) => {
  if (!allSeller.some((u) => u.sellerId === sellerId)) {
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
    const seller = findSeller(msg.receverId);
    if (seller) {
      soc.to(seller.socketId).emit("receved_admin_message", msg);
    }
  });

  soc.on("send_message_seller_to_admin", (msg) => {
    if (admin.socketId) {
      soc.to(admin.socketId).emit("receved_seller_message", msg);
    }
  });

  soc.on("add_admin", (adminInfo) => {
    delete adminInfo.email;
    delete adminInfo.password;
    admin = { ...adminInfo, socketId: soc.id };
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
app.use("/api/hire/skills", require("./routes/hire/skillCategoryRoutes")); // #swagger.tags = ['Hire Skills']
app.use("/api/hire/user", require("./routes/hire/hireUserRoutes")); // #swagger.tags = ['Hire Profile']
app.use("/api/hire/payment", require("./routes/hire/paymentRoutes")); // #swagger.tags = ['Hire Payment']
app.use("/api/hire/job", require("./routes/hire/jobRoutes")); // #swagger.tags = ['Hire Jobs']
app.use("/api/hire/setting", require("./routes/hire/adminSettingRoutes")); // #swagger.tags = ['Hire Admin']
app.use("/api/hire/notification", require("./routes/hire/notificationRoutes")); // #swagger.tags = ['Hire Notifications']
app.use("/api/hire/location", require("./routes/hire/locationRoutes")); // #swagger.tags = ['Hire Location']
app.use("/api/hire/resume", require("./routes/hire/resumeRequestRoutes")); // #swagger.tags = ['Hire Resume']


app.use("/api/hire/resume", require("./routes/hire/resumeEditorRoutes")); // #swagger.tags = ['Hire Resume Editor']
app.use("/api/hire/auth", require("./routes/hire/hireAuthRoutes")); // #swagger.tags = ['Hire Auth']
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
