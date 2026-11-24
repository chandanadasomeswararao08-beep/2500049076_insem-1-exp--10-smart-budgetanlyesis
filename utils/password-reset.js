const crypto = require("crypto");

const RESET_TOKEN_BYTES = 32;
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;

function hashResetToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function createResetToken(now = Date.now()) {
  const token = crypto.randomBytes(RESET_TOKEN_BYTES).toString("hex");
  return {
    token,
    tokenHash: hashResetToken(token),
    expiresAt: new Date(now + RESET_TOKEN_TTL_MS)
  };
}

function isValidResetToken(token) {
  return typeof token === "string" && /^[a-f0-9]{64}$/i.test(token);
}

function isValidNewPassword(password) {
  return typeof password === "string" && password.length >= 8 && password.length <= 128;
}

module.exports = {
  RESET_TOKEN_TTL_MS,
  createResetToken,
  hashResetToken,
  isValidResetToken,
  isValidNewPassword
};
