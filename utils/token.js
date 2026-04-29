import jwt from "jsonwebtoken";
import { v7 as uuidv7 } from "uuid";
import RefreshToken from "../models/RefreshToken.js";

export function generateAccessToken(userId) {
  return jwt.sign(
    { user_id: userId },
    process.env.JWT_SECRET,
    { expiresIn: "3m" }
  );
}

export async function generateRefreshToken(userId) {
  const token = uuidv7();
  
  const refreshToken = new RefreshToken({
    token: token,
    user_id: userId,
    expires_at: new Date(Date.now() + 5 * 60 * 1000)
  });
  
  await refreshToken.save();
  return token;
}

export async function invalidateRefreshToken(token) {
  await RefreshToken.findOneAndDelete({ token: token });
}

export async function verifyRefreshToken(token) {
  const refreshToken = await RefreshToken.findOne({ token: token });
  
  if (!refreshToken) {
    return null;
  }
  
  if (refreshToken.expires_at < new Date()) {
    await refreshToken.deleteOne();
    return null;
  }
  
  return refreshToken;
}