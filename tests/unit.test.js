const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const finance = require("../public/js/finance-utils");
const { buildBudgetAlert, buildGoalMilestoneAlerts } = require("../utils/notification-rules");
const {
  RESET_TOKEN_TTL_MS,
  createResetToken,
  hashResetToken,
  isValidResetToken,
  isValidNewPassword
} = require("../utils/password-reset");

test("money conversion stores whole paise safely", () => {
  assert.equal(finance.toPaise(125.5), 12550);
  assert.equal(finance.toPaise("0.10"), 10);
  assert.throws(() => finance.toPaise(0), /positive number/);
  assert.throws(() => finance.toPaise("not money"), /positive number/);
  assert.throws(() => finance.toPaise(Number.MAX_SAFE_INTEGER), /supported range/);
});

test("monthly totals add income and expenses without mixing dates", () => {
  const records = [
    { type: "income", amountPaise: 250000 },
    { type: "expense", amountPaise: 7250 },
    { type: "other", amountPaise: 50000 }
  ];
  assert.deepEqual(finance.monthlyTotals(records), {
    incomePaise: 250000,
    expensePaise: 7250,
    balancePaise: 242750
  });
  const inMonth = finance.transactionsInMonth([
    { date: "2026-11-02T10:00:00.000Z" },
    { date: "2026-10-31T10:00:00.000Z" },
    { date: "not-a-date" }
  ], new Date("2026-11-16T12:00:00.000Z"));
  assert.equal(inMonth.length, 1);
});

test("budget and goal progress stay within valid display bounds", () => {
  assert.equal(finance.budgetPercent(8000, 10000), 80);
  assert.equal(finance.budgetPercent(12000, 10000), 100);
  assert.equal(finance.budgetPercent(100, 0), 0);
  assert.equal(finance.remainingPaise(10000, 3500), 6500);
  assert.equal(finance.remainingPaise(10000, 12000), 0);
});

test("transaction search filters by type and case-insensitive text", () => {
  const records = [
    { type: "expense", title: "Weekly groceries", category: "Food" },
    { type: "income", title: "Part-time work", category: "Salary" },
    { type: "expense", title: "Bus ticket", category: "Travel" }
  ];
  assert.equal(finance.filterTransactions(records, { type: "expense", search: "FOOD" }).length, 1);
  assert.equal(finance.filterTransactions(records, { search: "work" })[0].type, "income");
  assert.equal(finance.filterTransactions(records, { search: "missing" }).length, 0);
});

test("password reset tokens are random, hashed and time-limited", () => {
  const now = 1_800_000_000_000;
  const first = createResetToken(now);
  const second = createResetToken(now);
  assert.match(first.token, /^[a-f0-9]{64}$/);
  assert.notEqual(first.token, second.token);
  assert.equal(first.tokenHash, hashResetToken(first.token));
  assert.notEqual(first.tokenHash, first.token);
  assert.equal(first.expiresAt.getTime(), now + RESET_TOKEN_TTL_MS);
  assert.equal(isValidResetToken(first.token), true);
  assert.equal(isValidResetToken("short"), false);
});

test("new password length is bounded", () => {
  assert.equal(isValidNewPassword("12345678"), true);
  assert.equal(isValidNewPassword("short"), false);
  assert.equal(isValidNewPassword("x".repeat(129)), false);
  assert.equal(isValidNewPassword(null), false);
});

test("browser entry page loads finance helpers before the main application", () => {
  const html = fs.readFileSync(path.join(__dirname, "../public/index.html"), "utf8");
  const helperScript = html.indexOf('src="js/finance-utils.js"');
  const appScript = html.indexOf('src="js/app.js"');
  assert.notEqual(helperScript, -1);
  assert.ok(appScript > helperScript);

  const context = { globalThis: null };
  context.globalThis = context;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../public/js/finance-utils.js"), "utf8"), context);
  assert.equal(typeof context.BudgetMindUtils.toPaise, "function");
  assert.equal(context.BudgetMindUtils.toPaise(1.25), 125);
});


test("budget alerts trigger at 80 percent and switch to overspent at 100 percent", () => {
  const budget = { _id: "budget-1", category: "Food", limitPaise: 10000 };
  assert.equal(buildBudgetAlert(budget, 7999, "2026-11"), null);
  assert.equal(buildBudgetAlert(budget, 8000, "2026-11").type, "budget_warning");
  const over = buildBudgetAlert(budget, 10100, "2026-11");
  assert.equal(over.type, "budget_over");
  assert.match(over.message, /101%/);
});

test("goal notifications include reached milestones only and use stable dedupe keys", () => {
  const goal = { _id: "goal-abc", title: "Laptop", targetPaise: 10000, savedPaise: 5000 };
  const alerts = buildGoalMilestoneAlerts(goal);
  assert.deepEqual(alerts.map(a => a.milestone), [25, 50]);
  assert.equal(alerts[0].dedupeKey, "goal:goal-abc:25");
  assert.deepEqual(buildGoalMilestoneAlerts({ ...goal, savedPaise: 10000 }).map(a => a.milestone), [25, 50, 75, 100]);
  assert.deepEqual(buildGoalMilestoneAlerts({ ...goal, targetPaise: 0 }), []);
});


test("notification center markup and actions are wired in the frontend", () => {
  const html = fs.readFileSync(path.join(__dirname, "../public/index.html"), "utf8");
  const app = fs.readFileSync(path.join(__dirname, "../public/js/app.js"), "utf8");
  assert.match(html, /id="notificationsBtn"/);
  assert.match(html, /id="notificationsPanel"/);
  assert.match(html, /id="markAllRead"/);
  assert.match(app, /api\("\/notifications"\)/);
  assert.match(app, /notifications\/read-all/);
  assert.match(app, /notification-read/);
  assert.match(app, /class="dismiss"/);
});
