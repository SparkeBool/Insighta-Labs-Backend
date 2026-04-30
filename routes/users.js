import express from "express";
import { authenticate } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/rbac.js";
import User from "../models/User.js";

const router = express.Router();

// GET /api/users/me - Get current authenticated user
router.get("/me", authenticate, async (req, res) => {
  try {
    res.json({
      status: "success",
      data: {
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
        avatar_url: req.user.avatar_url,
        role: req.user.role,
        is_active: req.user.is_active,
        last_login_at: req.user.last_login_at,
        created_at: req.user.created_at
      }
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Failed to fetch user data"
    });
  }
});

// GET /api/users - List all users (admin only)
router.get("/", authenticate, requireAdmin, async (req, res) => {
  try {
    const users = await User.find({}).select("-__v");
    res.json({
      status: "success",
      count: users.length,
      data: users
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Failed to fetch users"
    });
  }
});

export default router;