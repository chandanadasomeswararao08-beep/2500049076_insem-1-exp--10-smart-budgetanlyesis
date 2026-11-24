(function (root, factory) {
  const utilities = factory();
  if (typeof module === "object" && module.exports) module.exports = utilities;
  else root.BudgetMindUtils = utilities;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function toPaise(amount) {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      throw new TypeError("Amount must be a positive number.");
    }
    const paise = Math.round(value * 100);
    if (!Number.isSafeInteger(paise) || paise < 1) {
      throw new RangeError("Amount is outside the supported range.");
    }
    return paise;
  }

  function transactionsInMonth(transactions, date = new Date()) {
    const month = date.getMonth();
    const year = date.getFullYear();
    return (Array.isArray(transactions) ? transactions : []).filter((item) => {
      const itemDate = new Date(item.date);
      return !Number.isNaN(itemDate.getTime()) &&
        itemDate.getMonth() === month && itemDate.getFullYear() === year;
    });
  }

  function monthlyTotals(transactions) {
    const totals = (Array.isArray(transactions) ? transactions : []).reduce((result, item) => {
      const amount = Number(item.amountPaise) || 0;
      if (item.type === "income") result.incomePaise += amount;
      if (item.type === "expense") result.expensePaise += amount;
      return result;
    }, { incomePaise: 0, expensePaise: 0, balancePaise: 0 });
    totals.balancePaise = totals.incomePaise - totals.expensePaise;
    return totals;
  }

  function budgetPercent(spentPaise, limitPaise) {
    const spent = Number(spentPaise) || 0;
    const limit = Number(limitPaise) || 0;
    if (limit <= 0) return 0;
    return Math.min(100, Math.max(0, Math.round((spent / limit) * 100)));
  }

  function remainingPaise(targetPaise, savedPaise) {
    return Math.max(0, (Number(targetPaise) || 0) - (Number(savedPaise) || 0));
  }

  function filterTransactions(transactions, options = {}) {
    const type = String(options.type || "").toLowerCase();
    const search = String(options.search || "").trim().toLowerCase();
    return (Array.isArray(transactions) ? transactions : []).filter((item) => {
      const typeMatches = !type || item.type === type;
      const text = `${item.title || ""} ${item.category || ""}`.toLowerCase();
      return typeMatches && (!search || text.includes(search));
    });
  }

  return {
    toPaise,
    transactionsInMonth,
    monthlyTotals,
    budgetPercent,
    remainingPaise,
    filterTransactions
  };
});
