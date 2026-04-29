import mongoose from "mongoose";

const profileSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  gender: {
    type: String,
    enum: ["male", "female"]
  },
  gender_probability: Number,
  age: Number,
  age_group: {
    type: String,
    enum: ["child", "teenager", "adult", "senior"]
  },
  country_id: {
    type: String,
    uppercase: true
  },
  country_name: String,
  country_probability: Number,
  created_at: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model("Profile", profileSchema);