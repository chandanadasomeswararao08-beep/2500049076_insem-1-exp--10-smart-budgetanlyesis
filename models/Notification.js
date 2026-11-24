const mongoose = require("mongoose");
const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  type: { type: String, enum: ["budget_warning", "budget_over", "goal_milestone"], required: true },
  dedupeKey: { type: String, required: true },
  title: { type: String, required: true, maxlength: 140 },
  message: { type: String, required: true, maxlength: 280 },
  readAt: { type: Date, default: null },
  dismissedAt: { type: Date, default: null },
  milestone: { type: Number, default: null }
}, { timestamps: true });
schema.index({ user: 1, dedupeKey: 1 }, { unique: true });
schema.index({ user: 1, dismissedAt: 1, createdAt: -1 });
module.exports = mongoose.model("Notification", schema);
