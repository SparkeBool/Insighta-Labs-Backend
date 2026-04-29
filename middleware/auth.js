import jwt from "jsonwebtoken";
import User from "../models/User.js";

export async function authenticate(req, res, next) {
  try {
    let token = req.headers.authorization?.split(" ")[1];
    
    if (!token && req.cookies?.access_token) {
      token = req.cookies.access_token;
    }
    
    if (!token) {
      return res.status(401).json({
        status: "error",
        message: "Authentication required"
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
        message: "Account is deactivated"
      });
    }
    
    req.user = user;
    next();
    
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        status: "error",
        message: "Token expired"
      });
    }
    
    return res.status(401).json({
      status: "error",
      message: "Invalid token"
    });
  }
}