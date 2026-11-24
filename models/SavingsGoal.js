const mongoose = require("mongoose");
const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 90 },
  targetPaise: { type: Number, required: true, min: 1 },
  savedPaise: { type: Number, default: 0, min: 0 },
  targetDate: { type: Date },
  color: { type: String, default: "green" }
}, { timestamps: true });
module.exports = mongoose.model("SavingsGoal", schema);
