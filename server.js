const express = require("express");
const dotenv  = require("dotenv");
const cors    = require("cors");
const connectDB     = require("./config/db");
const errorHandler  = require("./middleware/errorMiddleware");

dotenv.config();
connectDB();

const app = express();

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    
    // Strip trailing slash from origin before comparing
    const cleanOrigin = origin.replace(/\/$/, "");
    const allowedOrigin = (process.env.CLIENT_URL || "").replace(/\/$/, "");
    
    if (!allowedOrigin || cleanOrigin === allowedOrigin) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// NOTE: No more /uploads static folder — all files are served from Cloudinary CDN

// Routes
app.use("/api/auth",  require("./routes/authRoutes"));
app.use("/api/jobs",  require("./routes/jobRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));

// Health check
app.get("/", (req, res) => {
  res.json({
    message: "🌟 AbilityBridge API — Inclusive Employment Platform",
    version: "2.0.0",
    status: "running",
  });
});

// Error handler (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n AbilityBridge Server running on port ${PORT}`);
  console.log(` API: http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}\n`);
});
