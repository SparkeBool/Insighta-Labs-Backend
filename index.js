import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.js";
import profileRoutes from "./routes/profiles.js";
import exportRoutes from "./routes/export.js";
import userRoutes from "./routes/users.js";
import { requestLogger } from "./middleware/logger.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// CORS - Allow all origins with credentials
app.use(cors({
  origin: true,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-API-Version", "Cookie"]
}));

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(express.json());
app.use(cookieParser());
app.use(requestLogger);

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Routes
app.use("/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/profiles", exportRoutes);
app.use("/api/profiles", profileRoutes);

// Handle preflight requests
app.options("*", cors());

app.get("/", (req, res) => {
  res.json({
    message: "Insighta Labs+ API",
    status: "running",
    version: "3.0.0"
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;