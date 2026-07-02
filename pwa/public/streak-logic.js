// Pure streak calculation logic, shared between the browser (app.js) and the
// server (server.js) so "is this streak pending today" is computed identically
// in both places. Dates are handled in local time and formatted as YYYY-MM-DD,
// since Date#toISOString() would shift the date across a UTC day boundary.

export function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday .. 6 = Saturday
  const diff = day === 0 ? -6 : 1 - day; // shift back to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function targetFor(streak) {
  return streak.type === "weekly_n" ? streak.target : 1;
}

export function typeLabel(streak) {
  if (streak.type === "daily") return "Daily";
  if (streak.type === "weekly") return "Weekly";
  return `${streak.target}x / week`;
}

export function countCompletionsInWeek(streak, weekStart) {
  const set = new Set(streak.completions);
  let count = 0;
  for (let i = 0; i < 7; i++) {
    if (set.has(formatDate(addDays(weekStart, i)))) count++;
  }
  return count;
}

export function computeDailyStreakCount(streak, now = new Date()) {
  const set = new Set(streak.completions);
  let cursor = new Date(now);
  if (!set.has(formatDate(cursor))) cursor = addDays(cursor, -1);
  let count = 0;
  while (set.has(formatDate(cursor))) {
    count++;
    cursor = addDays(cursor, -1);
  }
  return count;
}

export function computeWeeklyStreakCount(streak, now = new Date()) {
  const target = targetFor(streak);
  const thisWeekStart = getWeekStart(now);
  let count = 0;
  if (countCompletionsInWeek(streak, thisWeekStart) >= target) count++;
  let cursor = addDays(thisWeekStart, -7);
  while (countCompletionsInWeek(streak, cursor) >= target) {
    count++;
    cursor = addDays(cursor, -7);
  }
  return count;
}

export function computeStreakCount(streak, now = new Date()) {
  return streak.type === "daily"
    ? computeDailyStreakCount(streak, now)
    : computeWeeklyStreakCount(streak, now);
}

export function isPendingToday(streak, now = new Date()) {
  const set = new Set(streak.completions);
  if (streak.type === "daily") return !set.has(formatDate(now));
  const target = targetFor(streak);
  return countCompletionsInWeek(streak, getWeekStart(now)) < target;
}

export function weekProgressLabel(streak, now = new Date()) {
  if (streak.type === "daily") return isPendingToday(streak, now) ? "Not done today" : "Done today";
  const target = targetFor(streak);
  const done = countCompletionsInWeek(streak, getWeekStart(now));
  return `${done}/${target} this week`;
}
