const BUDGET_WARNING_PERCENT = 80;
const GOAL_MILESTONES = [25, 50, 75, 100];

function buildBudgetAlert(budget, spentPaise, month) {
  const limit = Number(budget.limitPaise || 0);
  const spent = Number(spentPaise || 0);
  if (!Number.isFinite(limit) || limit <= 0 || !Number.isFinite(spent) || spent < 0) return null;
  const pct = (spent / limit) * 100;
  if (pct >= 100) {
    return {
      type: "budget_over",
      dedupeKey: `budget:${budget._id}:${month}:over`,
      title: `${budget.category} budget exceeded`,
      message: `${budget.category} spending is ${Math.round(pct)}% of the ${month} budget. Review the category before adding more spending.`
    };
  }
  if (pct >= BUDGET_WARNING_PERCENT) {
    return {
      type: "budget_warning",
      dedupeKey: `budget:${budget._id}:${month}:80`,
      title: `${budget.category} budget is nearly used`,
      message: `${budget.category} spending is ${Math.round(pct)}% of the ${month} budget. You are close to your limit.`
    };
  }
  return null;
}


function buildGoalMilestoneAlerts(goal) {
  const target = Number(goal.targetPaise || 0);
  const saved = Number(goal.savedPaise || 0);
  if (!Number.isFinite(target) || target <= 0 || !Number.isFinite(saved) || saved < 0) return [];
  const pct = (saved / target) * 100;
  return GOAL_MILESTONES.filter(milestone => pct >= milestone).map(milestone => ({
    type: "goal_milestone",
    dedupeKey: `goal:${goal._id}:${milestone}`,
    title: milestone === 100 ? `${goal.title} goal completed!` : `${milestone}% of ${goal.title}`,
    message: milestone === 100 ? `You reached your ${goal.title} savings target. Great progress!` : `You reached ${milestone}% of your ${goal.title} savings target.`,
    milestone
  }));
}


module.exports = { BUDGET_WARNING_PERCENT, GOAL_MILESTONES, buildBudgetAlert, buildGoalMilestoneAlerts };
