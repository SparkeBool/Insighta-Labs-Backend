import express from "express";
import { v7 as uuidv7 } from "uuid";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import RefreshToken from "../models/RefreshToken.js";
import { exchangeCodeForToken, getGitHubUser } from "../services/githubOAuth.js";
import { generateAccessToken, generateRefreshToken, invalidateRefreshToken, verifyRefreshToken } from "../utils/token.js";
import { authLimiter } from "../middleware/rateLimit.js";

const router = express.Router();
const pkceStore = new Map();

// GET /auth/github - Web Portal OAuth
router.get("/github", authLimiter, (req, res) => {
  const state = crypto.randomBytes(32).toString("hex");
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");
  
  const redirectUri = req.query.redirect_uri || process.env.FRONTEND_URL + "/auth/callback";
  
  pkceStore.set(state, { codeVerifier, expiresAt: Date.now() + 10 * 60 * 1000 });
  
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    redirect_uri: redirectUri,
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    scope: "read:user user:email"
  });
  
  const authUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;
  
  res.json({
    status: "success",
    auth_url: authUrl
  });
});

// GET /auth/github/callback - Web Portal OAuth Callback
router.get("/github/callback", authLimiter, async (req, res) => {
  try {
    const { code, state } = req.query;
    const redirectUri = req.query.redirect_uri || process.env.FRONTEND_URL + "/auth/callback";
    
    if (!code || !state) {
      return res.status(400).json({
        status: "error",
        message: "Missing code or state"
      });
    }
    
    const pkceData = pkceStore.get(state);
    
    if (!pkceData || pkceData.expiresAt < Date.now()) {
      return res.status(400).json({
        status: "error",
        message: "Invalid or expired state"
      });
    }
    
    pkceStore.delete(state);
    
    const tokenData = await exchangeCodeForToken(code, pkceData.codeVerifier, redirectUri);
    
    if (!tokenData.access_token) {
      return res.status(400).json({
        status: "error",
        message: "Failed to exchange code for token"
      });
    }
    
    const githubUser = await getGitHubUser(tokenData.access_token);
    
    let user = await User.findOne({ github_id: String(githubUser.id) });
    
    if (!user) {
      user = new User({
        id: uuidv7(),
        github_id: String(githubUser.id),
        username: githubUser.login,
        email: githubUser.email || `${githubUser.login}@github.user`,
        avatar_url: githubUser.avatar_url,
        role: "analyst",
        is_active: true,
        last_login_at: new Date(),
        created_at: new Date()
      });
    } else {
      user.last_login_at = new Date();
    }
    
    await user.save();
    
    const accessToken = generateAccessToken(user.id);
    const refreshToken = await generateRefreshToken(user.id);
    
    const isCli = redirectUri.includes("localhost:3101");
    
    if (isCli) {
      return res.json({
        status: "success",
        access_token: accessToken,
        refresh_token: refreshToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        }
      });
    } else {
      // WEB PORTAL - Set cookies with proper settings
      res.cookie("access_token", accessToken, {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        maxAge: 3 * 60 * 1000,
        path: "/",
        domain: undefined  // Let browser use current domain
      });
      
      res.cookie("refresh_token", refreshToken, {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        maxAge: 5 * 60 * 1000,
        path: "/",
        domain: undefined
      });
      
      // Send JSON response instead of redirect so frontend can handle
      return res.json({
        status: "success",
        redirect_url: process.env.FRONTEND_URL + "/auth/callback?success=true"
      });
    }
    
  } catch (error) {
    console.error("OAuth callback error:", error);
    res.status(500).json({
      status: "error",
      message: "Authentication failed"
    });
  }
});

// POST /auth/cli/callback - CLI Authentication Endpoint
router.post("/cli/callback", authLimiter, async (req, res) => { 
  try {
    const { github_id, username, email, avatar_url } = req.body;
    
    if (!github_id) {
      return res.status(400).json({
        status: "error",
        message: "Missing github_id"
      });
    }
    
    let user = await User.findOne({ github_id: String(github_id) });
    
    if (!user) {
      // TRD COMPLIANT: Default role is always "analyst" for all users
      user = new User({
        id: uuidv7(),
        github_id: String(github_id),
        username: username || "github_user",
        email: email || `${github_id}@github.user`,
        avatar_url: avatar_url || "",
        role: "analyst",  // Always analyst as per TRD
        is_active: true,
        last_login_at: new Date(),
        created_at: new Date()
      });
    } else {
      user.last_login_at = new Date();
    }
    
    await user.save();
    
    const accessToken = generateAccessToken(user.id);
    const refreshToken = await generateRefreshToken(user.id);
    
    res.json({
      status: "success",
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
    
  } catch (error) {
    console.error("CLI callback error:", error);
    res.status(500).json({
      status: "error",
      message: "Authentication failed"
    });
  }
});

// POST /auth/refresh - Refresh Tokens
router.post("/refresh", authLimiter, async (req, res) => {
  try {
    const { refresh_token } = req.body;
    
    if (!refresh_token) {
      return res.status(400).json({
        status: "error",
        message: "Refresh token required"
      });
    }
    
    const refreshTokenDoc = await verifyRefreshToken(refresh_token);
    
    if (!refreshTokenDoc) {
      return res.status(401).json({
        status: "error",
        message: "Invalid or expired refresh token"
      });
    }
    
    await invalidateRefreshToken(refresh_token);
    
    const accessToken = generateAccessToken(refreshTokenDoc.user_id);
    const newRefreshToken = await generateRefreshToken(refreshTokenDoc.user_id);
    
    res.json({
      status: "success",
      access_token: accessToken,
      refresh_token: newRefreshToken
    });
    
  } catch (error) {
    console.error("Refresh error:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to refresh token"
    });
  }
});

// POST /auth/logout - Logout
router.post("/logout", authLimiter, async (req, res) => {
  try {
    const refreshToken = req.body.refresh_token || req.cookies?.refresh_token;
    
    if (refreshToken) {
      await invalidateRefreshToken(refreshToken);
    }
    
    res.clearCookie("access_token", { path: "/" });
    res.clearCookie("refresh_token", { path: "/" });
    
    res.json({
      status: "success",
      message: "Logged out successfully"
    });
    
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({
      status: "error",
      message: "Logout failed"
    });
  }
});

// GET /auth/me - Get Current User
router.get("/me", async (req, res) => {
  try {
    let token = req.headers.authorization?.split(" ")[1];
    
    if (!token && req.cookies?.access_token) {
      token = req.cookies.access_token;
    }
    
    if (!token) {
      return res.status(401).json({
        status: "error",
        message: "Not authenticated"
      });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({ id: decoded.user_id });
    
    if (!user) {
      return res.status(401).json({
        status: "error",
        message: "User not found"
      });
    }
    
    if (!user.is_active) {
      return res.status(403).json({
        status: "error",
        message: "Account deactivated"
      });
    }
    
    res.json({
      status: "success",
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar_url: user.avatar_url,
        role: user.role
      }
    });
    
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        status: "error",
        message: "Token expired"
      });
    }
    res.status(401).json({
      status: "error",
      message: "Not authenticated"
    });
  }
});

export default router;