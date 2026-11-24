require("dotenv").config();
const test = require("node:test");
const assert = require("node:assert/strict");

const testUri = process.env.MONGODB_TEST_URI;
const resetAllowed = String(process.env.ALLOW_TEST_DB_RESET || "").toLowerCase() === "true";

test("BudgetMind API integration flow", {
  skip: !testUri ? "Set MONGODB_TEST_URI to a dedicated test database." : !resetAllowed ? "Set ALLOW_TEST_DB_RESET=true after confirming the test database is disposable." : false
}, async (t) => {
  const databaseName = (testUri.split("?")[0].split("/").pop() || "").trim();
  assert.match(databaseName, /test/i, "Refusing to run destructive API tests unless the database name contains 'test'.");
  assert.equal(resetAllowed, true, "Explicit permission is required because this test suite clears the test database.");

  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = process.env.JWT_SECRET || "local-api-test-secret-change-this-value";

  const mongoose = require("mongoose");
  const { createApp } = require("../server");
  const User = require("../models/User");
  const Transaction = require("../models/Transaction");
  const Budget = require("../models/Budget");
  const SavingsGoal = require("../models/SavingsGoal");
  const Notification = require("../models/Notification");
  const { hashResetToken } = require("../utils/password-reset");
  let sentResetEmail = null;

  await mongoose.connect(testUri);
  await mongoose.connection.dropDatabase();

  const server = createApp({
    sendPasswordResetEmail: async (message) => { sentResetEmail = message; }
  }).listen(0);
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  async function call(path, { method = "GET", body, cookie } = {}) {
    const headers = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (cookie) headers.Cookie = cookie;
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({}));
    const setCookie = response.headers.getSetCookie?.()[0] || response.headers.get("set-cookie");
    return { status: response.status, payload, setCookie };
  }

  const health = await call("/api/health");
  assert.equal(health.status, 200);
  assert.equal(health.payload.status, "ok");

  const unauthenticated = await call("/api/transactions");
  assert.equal(unauthenticated.status, 401);

  const registration = await call("/api/auth/register", {
    method: "POST",
    body: { name: "Test User", email: "test-user@example.test", password: "StrongPass123" }
  });
  assert.equal(registration.status, 201);
  assert.match(registration.setCookie || "", /bm_token=.*HttpOnly/i);
  const cookie = registration.setCookie.split(";")[0];

  const profile = await call("/api/auth/me", { cookie });
  assert.equal(profile.status, 200);
  assert.equal(profile.payload.user.email, "test-user@example.test");
  assert.equal("password" in profile.payload.user, false);

  const transaction = await call("/api/transactions", {
    method: "POST",
    cookie,
    body: { type: "expense", title: "Lunch", category: "Food", amount: 125.5 }
  });
  assert.equal(transaction.status, 201);
  assert.equal(transaction.payload.amountPaise, 12550);

  const month = new Date().toISOString().slice(0, 7);
  const budget = await call("/api/budgets", {
    method: "POST",
    cookie,
    body: { category: "Food", month, limit: 1000 }
  });
  assert.equal(budget.status, 200);
  assert.equal(budget.payload.limitPaise, 100000);

  const budgetList = await call(`/api/budgets?month=${month}`, { cookie });
  assert.equal(budgetList.status, 200);
  assert.equal(budgetList.payload[0].spentPaise, 12550);

  const updatedTransaction = await call(`/api/transactions/${transaction.payload._id}`, {
    method: "PUT",
    cookie,
    body: { title: "Lunch updated", type: "expense", category: "Food", amount: 150 }
  });
  assert.equal(updatedTransaction.status, 200);
  assert.equal(updatedTransaction.payload.title, "Lunch updated");
  assert.equal(updatedTransaction.payload.amountPaise, 15000);

  const goal = await call("/api/goals", {
    method: "POST",
    cookie,
    body: { title: "Emergency savings", target: 5000 }
  });
  assert.equal(goal.status, 201);
  const contribution = await call(`/api/goals/${goal.payload._id}/contribute`, {
    method: "POST",
    cookie,
    body: { amount: 250 }
  });
  assert.equal(contribution.status, 200);
  assert.equal(contribution.payload.savedPaise, 25000);

  const secondExpense = await call("/api/transactions", {
    method: "POST", cookie, body: { type: "expense", title: "Extra groceries", category: "Food", amount: 800 }
  });
  assert.equal(secondExpense.status, 201);
  const milestoneContribution = await call(`/api/goals/${goal.payload._id}/contribute`, {
    method: "POST", cookie, body: { amount: 2250 }
  });
  assert.equal(milestoneContribution.status, 200);
  assert.equal(milestoneContribution.payload.savedPaise, 250000);

  const notificationList = await call("/api/notifications", { cookie });
  assert.equal(notificationList.status, 200);
  assert.equal(notificationList.payload.enabled, true);
  assert.ok(notificationList.payload.notifications.some(n => n.type === "budget_warning" && n.title.includes("Food")));
  assert.ok(notificationList.payload.notifications.some(n => n.type === "goal_milestone" && n.milestone === 50));
  const budgetAlert = notificationList.payload.notifications.find(n => n.type === "budget_warning");
  const goalAlert = notificationList.payload.notifications.find(n => n.type === "goal_milestone" && n.milestone === 50);
  const markOneRead = await call(`/api/notifications/${goalAlert._id}/read`, { method: "PUT", cookie });
  assert.equal(markOneRead.status, 200);
  const markAllRead = await call("/api/notifications/read-all", { method: "PUT", cookie });
  assert.equal(markAllRead.status, 200);
  const readList = await call("/api/notifications", { cookie });
  assert.equal(readList.payload.unreadCount, 0);
  const dismissed = await call(`/api/notifications/${budgetAlert._id}`, { method: "DELETE", cookie });
  assert.equal(dismissed.status, 200);
  const activeList = await call("/api/notifications", { cookie });
  assert.ok(!activeList.payload.notifications.some(n => n._id === budgetAlert._id));
  const disabledPrefs = await call("/api/auth/profile", {
    method: "PUT", cookie, body: { name: "Test User", currency: "INR", notifications: false }
  });
  assert.equal(disabledPrefs.status, 200);
  const disabledFeed = await call("/api/notifications", { cookie });
  assert.equal(disabledFeed.payload.enabled, false);
  assert.equal(disabledFeed.payload.notifications.length, 0);
  const enabledPrefs = await call("/api/auth/profile", {
    method: "PUT", cookie, body: { name: "Test User", currency: "INR", notifications: true }
  });
  assert.equal(enabledPrefs.status, 200);

  const unknownEmail = await call("/api/auth/forgot-password", {
    method: "POST",
    body: { email: "nobody@example.test" }
  });
  assert.equal(unknownEmail.status, 200);
  assert.match(unknownEmail.payload.message, /If an account exists/i);

  const knownEmail = await call("/api/auth/forgot-password", {
    method: "POST",
    body: { email: "test-user@example.test" }
  });
  assert.equal(knownEmail.status, 200);
  assert.equal(knownEmail.payload.message, unknownEmail.payload.message);
  assert.equal(sentResetEmail.to, "test-user@example.test");
  const rawToken = new URL(sentResetEmail.resetUrl).searchParams.get("resetToken");
  assert.match(rawToken || "", /^[a-f0-9]{64}$/);
  const storedReset = await User.findOne({ email: "test-user@example.test" }).select("+passwordResetTokenHash +passwordResetExpires");
  assert.equal(storedReset.passwordResetTokenHash, hashResetToken(rawToken));
  assert.ok(storedReset.passwordResetExpires.getTime() > Date.now());

  const reset = await call("/api/auth/reset-password", {
    method: "POST",
    body: { token: rawToken, newPassword: "NewStrongPass456" }
  });
  assert.equal(reset.status, 200);
  const reused = await call("/api/auth/reset-password", {
    method: "POST",
    body: { token: rawToken, newPassword: "AnotherStrong789" }
  });
  assert.equal(reused.status, 400);

  const login = await call("/api/auth/login", {
    method: "POST",
    body: { email: "test-user@example.test", password: "NewStrongPass456" }
  });
  assert.equal(login.status, 200);

  const secondUser = await call("/api/auth/register", {
    method: "POST",
    body: { name: "Second User", email: "second-user@example.test", password: "StrongPass123" }
  });
  assert.equal(secondUser.status, 201);
  const secondCookie = secondUser.setCookie.split(";")[0];
  const isolatedTransactions = await call("/api/transactions", { cookie: secondCookie });
  assert.equal(isolatedTransactions.status, 200);
  assert.equal(isolatedTransactions.payload.length, 0);
  const isolatedNotifications = await call("/api/notifications", { cookie: secondCookie });
  assert.equal(isolatedNotifications.status, 200);
  assert.equal(isolatedNotifications.payload.notifications.length, 0);

  const transactionDeletion = await call(`/api/transactions/${transaction.payload._id}`, {
    method: "DELETE",
    cookie
  });
  assert.equal(transactionDeletion.status, 200);

  const deletion = await call("/api/auth/account", { method: "DELETE", cookie });
  assert.equal(deletion.status, 200);
  assert.equal(await User.countDocuments({ email: "test-user@example.test" }), 0);
  assert.equal(await Transaction.countDocuments({ user: profile.payload.user._id }), 0);
  assert.equal(await Budget.countDocuments({ user: profile.payload.user._id }), 0);
  assert.equal(await SavingsGoal.countDocuments({ user: profile.payload.user._id }), 0);
  assert.equal(await Notification.countDocuments({ user: profile.payload.user._id }), 0);
});
