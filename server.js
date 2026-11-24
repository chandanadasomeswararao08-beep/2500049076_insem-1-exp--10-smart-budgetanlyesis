require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const cors = require("cors");
const path = require("path");
const authRoutes = require("./routes/auth");
const transactionRoutes = require("./routes/transactions");
const budgetRoutes = require("./routes/budgets");
const goalRoutes = require("./routes/goals");
const aiRoutes = require("./routes/ai");
const notificationRoutes = require("./routes/notifications");
const { apiLimiter } = require("./middleware/security");

function createApp(options = {}) {
  const app = express();
  if (typeof options.sendPasswordResetEmail === "function") {
    app.locals.sendPasswordResetEmail = options.sendPasswordResetEmail;
  }
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5000", credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use("/api", apiLimiter);
  app.use("/api/auth", authRoutes);
  app.use("/api/transactions", transactionRoutes);
  app.use("/api/budgets", budgetRoutes);
  app.use("/api/goals", goalRoutes);
  app.use("/api/ai", aiRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use(express.static(path.join(__dirname, "public")));
  app.get("/api/health", (_, res) => res.json({ status: "ok", app: "BudgetMind AI" }));
  app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
  return app;
}

const app = createApp();

if (require.main === module) {
  const port = process.env.PORT || 5000;
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => app.listen(port, () => console.log(`BudgetMind AI running at http://localhost:${port}`)))
    .catch(err => { console.error("MongoDB connection failed:", err.message); process.exit(1); });
}

module.exports = { app, createApp };
