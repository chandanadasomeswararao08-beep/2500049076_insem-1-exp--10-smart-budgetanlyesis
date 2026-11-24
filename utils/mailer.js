const nodemailer = require("nodemailer");

function createTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: String(SMTP_SECURE).toLowerCase() === "true",
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
}

async function sendPasswordResetEmail({ to, resetUrl }) {
  const transporter = createTransport();
  if (!transporter) throw new Error("SMTP is not configured");
  await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject: "Reset your BudgetMind AI password",
    text: `We received a request to reset your BudgetMind AI password.\n\nOpen this link within 15 minutes to choose a new password:\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#172b40"><h2>Reset your BudgetMind AI password</h2><p>We received a request to reset your password.</p><p><a href="${resetUrl}" style="display:inline-block;background:#1eaa78;color:white;padding:12px 18px;border-radius:8px;text-decoration:none">Choose a new password</a></p><p>This link expires in 15 minutes and can only be used once.</p><p>If you did not request this, you can safely ignore this email.</p></div>`
  });
}

module.exports = { sendPasswordResetEmail };
