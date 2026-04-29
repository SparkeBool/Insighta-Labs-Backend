import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  github_id: {
    type: String,
    required: true,
    unique: true
  },
  username: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  avatar_url: String,
  role: {
    type: String,
    enum: ["admin", "analyst"],
    default: "analyst"
  },
  is_active: {
    type: Boolean,
    default: true
  },
  last_login_at: Date,
  created_at: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model("User", userSchema);