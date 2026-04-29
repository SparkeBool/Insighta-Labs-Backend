import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.js";
import profileRoutes from "./routes/profiles.js";
import exportRoutes from "./routes/export.js";
import { requestLogger } from "./middleware/logger.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: true,  
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization", "X-API-Version", "Cookie"],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
}));

app.use(express.json());
app.use(cookieParser());
app.use(requestLogger);

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Routes - ORDER MATTERS: export must come before profile routes with params
app.use("/auth", authRoutes);
app.use("/api/profiles", exportRoutes);  // Export first (before /:id route)
app.use("/api/profiles", profileRoutes); // Then profile routes

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