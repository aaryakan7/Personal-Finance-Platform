function normalizeMonth(input) {
  const match = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(String(input || ""));
  if (!match) {
    throw Object.assign(new Error("month must be in YYYY-MM format"), { status: 400 });
  }
  const [, year, month] = match;
  if (Number(month) < 1 || Number(month) > 12) {
    throw Object.assign(new Error("month must be in YYYY-MM format"), { status: 400 });
  }
  return `${year}-${month}-01`;
}

function currentMonth() {
  const now = new Date();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${now.getUTCFullYear()}-${month}-01`;
}

module.exports = { normalizeMonth, currentMonth };
