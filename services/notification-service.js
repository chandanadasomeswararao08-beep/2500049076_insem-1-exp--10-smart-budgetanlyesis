const mongoose = require("mongoose");
const Budget = require("../models/Budget");
const Transaction = require("../models/Transaction");
const SavingsGoal = require("../models/SavingsGoal");
const Notification = require("../models/Notification");
const { buildBudgetAlert, buildGoalMilestoneAlerts } = require("../utils/notification-rules");

function currentMonthUtc(now = new Date()) {
  return now.toISOString().slice(0, 7);
}

async function reconcileUserNotifications(userId, now = new Date()) {
  const month = currentMonthUtc(now);
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  const [budgets, goals, spent] = await Promise.all([
    Budget.find({ user: userId, month }).lean(),
    SavingsGoal.find({ user: userId }).lean(),
    Transaction.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(String(userId)), type: "expense", date: { $gte: start, $lt: end } } },
      { $group: { _id: "$category", totalPaise: { $sum: "$amountPaise" } } }
    ])
  ]);
  const spentByCategory = new Map(spent.map(row => [row._id, row.totalPaise]));
  const candidates = budgets.map(budget => buildBudgetAlert(budget, spentByCategory.get(budget.category) || 0, month)).filter(Boolean);
  goals.forEach(goal => candidates.push(...buildGoalMilestoneAlerts(goal)));
  if (candidates.length) {
    const operations = candidates.map(candidate => ({
      updateOne: {
        filter: { user: userId, dedupeKey: candidate.dedupeKey },
        update: { $setOnInsert: { user: userId, ...candidate } },
        upsert: true
      }
    }));
    try { await Notification.bulkWrite(operations, { ordered: false }); }
    catch (error) { if (error.code !== 11000 && !error.writeErrors?.some(e => e.code === 11000)) throw error; }
  }
  return Notification.find({ user: userId, dismissedAt: null }).sort({ createdAt: -1 }).lean();
}
module.exports = { currentMonthUtc, reconcileUserNotifications };
