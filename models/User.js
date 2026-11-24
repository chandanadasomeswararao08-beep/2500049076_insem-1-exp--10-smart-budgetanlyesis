const mongoose = require("mongoose");
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 70 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  currency: { type: String, default: "INR", enum: ["INR","USD","EUR","GBP"] },
  notifications: { type: Boolean, default: true },
  passwordResetTokenHash: { type: String, default: null, select: false },
  passwordResetExpires: { type: Date, default: null, select: false }
}, { timestamps: true });
module.exports = mongoose.model("User", userSchema);
