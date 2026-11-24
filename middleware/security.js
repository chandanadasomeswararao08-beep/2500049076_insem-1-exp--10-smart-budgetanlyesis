const rateLimit = require("express-rate-limit");
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: "draft-7", legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, message: { message: "Too many attempts. Try again later." } });
module.exports = { apiLimiter, authLimiter };
