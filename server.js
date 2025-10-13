const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
require("dotenv").config();

// Initialize achievements on startup
const { initializeAchievements } = require("./utils/achievements");
const { startScheduler } = require("./utils/scheduler");

// Import routes (we'll create these next)
const authRoutes = require("./routes/auth");
const trashRoutes = require("./routes/trash");
const cleanupRoutes = require("./routes/cleanup");
const achievementRoutes = require("./routes/achievements");
const pointsRoutes = require("./routes/points");
const aiRoutes = require("./routes/ai");
const mapsRoutes = require("./routes/maps");

const app = express();
const PORT = process.env.PORT || 3000;

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const originalSend = res.send;
  
  res.send = function(body) {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
    
    if (res.statusCode >= 400) {
      console.log(`[ERROR] Request body:`, req.body);
      console.log(`[ERROR] Response:`, typeof body === 'string' ? body : JSON.stringify(body));
    }
    
    return originalSend.call(this, body);
  };
  
  next();
});

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors({
  origin: true, // Allow all origins in development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use("/api/", limiter);

// Static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Basic health check
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/trash", trashRoutes);
app.use("/api/cleanup", cleanupRoutes);
app.use("/api/achievements", achievementRoutes);
app.use("/api/points", pointsRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/maps", mapsRoutes);

// Error handling middleware
app.use((error, req, res, next) => {
  console.error(`[SERVER ERROR] ${error.name}: ${error.message}`);
  console.error(`[SERVER ERROR] Request: ${req.method} ${req.originalUrl}`);
  console.error(`[SERVER ERROR] Body:`, req.body);
  console.error(`[SERVER ERROR] Stack:`, error.stack);
  res.status(500).json({ error: "Internal server error" });
});

// Get local network IP for convenience
const getLocalIP = () => {
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip internal and non-IPv4 addresses
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
};

// Start server - listen on all network interfaces (0.0.0.0)
app.listen(PORT, '0.0.0.0', async () => {
  const localIP = getLocalIP();
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Local: http://localhost:${PORT}/api/health`);
  console.log(`📍 Network: http://${localIP}:${PORT}/api/health`);
  console.log(`\n💡 For Expo app:`);
  console.log(`   iOS Simulator: Use localhost`);
  console.log(`   Android Emulator: Use 10.0.2.2`);
  console.log(`   Physical Device: Use ${localIP}`);

  // Initialize achievements
  await initializeAchievements();

  // Start scheduled tasks
  startScheduler();
});

module.exports = app;
