const mongoose = require("mongoose");
const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  type: { type: String, enum: ["income","expense"], required: true },
  title: { type: String, required: true, trim: true, maxlength: 100 },
  category: { type: String, required: true, trim: true, maxlength: 40 },
  amountPaise: { type: Number, required: true, min: 1 },
  date: { type: Date, required: true, default: Date.now },
  note: { type: String, maxlength: 300, default: "" }
}, { timestamps: true });
schema.index({ user: 1, date: -1 });
module.exports = mongoose.model("Transaction", schema);
