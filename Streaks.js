// Variables used by Scriptable.
// icon-color: red; icon-glyph: fire;

const FILE_NAME = "streak-counter-data.json";

// ---------- Storage ----------

function dataPath() {
  const fm = FileManager.local();
  return fm.joinPath(fm.documentsDirectory(), FILE_NAME);
}

function loadData() {
  const fm = FileManager.local();
  const path = dataPath();
  if (!fm.fileExists(path)) return { streaks: [] };
  try {
    return JSON.parse(fm.readString(path));
  } catch (e) {
    return { streaks: [] };
  }
}

function saveData(data) {
  const fm = FileManager.local();
  fm.writeString(dataPath(), JSON.stringify(data));
}

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ---------- Date helpers ----------
// All dates are handled in local time and formatted as YYYY-MM-DD strings,
// since completions are day-granularity and Date#toISOString() would shift
// the date across a UTC day boundary.

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday .. 6 = Saturday
  const diff = day === 0 ? -6 : 1 - day; // shift back to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ---------- Streak logic ----------

function targetFor(streak) {
  return streak.type === "weekly_n" ? streak.target : 1;
}

function typeLabel(streak) {
  if (streak.type === "daily") return "Daily";
  if (streak.type === "weekly") return "Weekly";
  return `${streak.target}x / week`;
}

function countCompletionsInWeek(streak, weekStart) {
  const set = new Set(streak.completions);
  let count = 0;
  for (let i = 0; i < 7; i++) {
    if (set.has(formatDate(addDays(weekStart, i)))) count++;
  }
  return count;
}

function computeDailyStreakCount(streak) {
  const set = new Set(streak.completions);
  let cursor = new Date();
  if (!set.has(formatDate(cursor))) {
    cursor = addDays(cursor, -1);
  }
  let count = 0;
  while (set.has(formatDate(cursor))) {
    count++;
    cursor = addDays(cursor, -1);
  }
  return count;
}

function computeWeeklyStreakCount(streak) {
  const target = targetFor(streak);
  const thisWeekStart = getWeekStart(new Date());
  let count = 0;
  if (countCompletionsInWeek(streak, thisWeekStart) >= target) count++;
  let cursor = addDays(thisWeekStart, -7);
  while (countCompletionsInWeek(streak, cursor) >= target) {
    count++;
    cursor = addDays(cursor, -7);
  }
  return count;
}

function computeStreakCount(streak) {
  return streak.type === "daily"
    ? computeDailyStreakCount(streak)
    : computeWeeklyStreakCount(streak);
}

function isPendingToday(streak) {
  const set = new Set(streak.completions);
  if (streak.type === "daily") {
    return !set.has(formatDate(new Date()));
  }
  const target = targetFor(streak);
  return countCompletionsInWeek(streak, getWeekStart(new Date())) < target;
}

function toggleToday(streak) {
  const t = formatDate(new Date());
  const idx = streak.completions.indexOf(t);
  if (idx >= 0) streak.completions.splice(idx, 1);
  else streak.completions.push(t);
}

// ---------- Add streak flow ----------

async function promptNewStreak() {
  const info = new Alert();
  info.title = "New Streak";
  info.message = "What do you want to track?";
  info.addTextField("e.g. Meditate", "");
  info.addTextField("Emoji (optional)", "🔥");
  info.addAction("Next");
  info.addCancelAction("Cancel");
  const infoRes = await info.presentAlert();
  if (infoRes === -1) return null;

  const name = info.textFieldValue(0).trim();
  if (!name) return null;
  const emoji = info.textFieldValue(1).trim() || "🔥";

  const freq = new Alert();
  freq.title = "How often?";
  freq.addAction("Daily");
  freq.addAction("Weekly (once a week)");
  freq.addAction("2x per week");
  freq.addAction("3x per week");
  freq.addAction("4x per week");
  freq.addAction("5x per week");
  freq.addAction("6x per week");
  freq.addCancelAction("Cancel");
  const freqRes = await freq.presentSheet();
  if (freqRes === -1) return null;

  let type, target;
  if (freqRes === 0) {
    type = "daily";
  } else if (freqRes === 1) {
    type = "weekly";
  } else {
    type = "weekly_n";
    target = freqRes; // index 2 -> "2x", 3 -> "3x", ... matches target count
  }

  return {
    id: uuid(),
    name,
    emoji,
    type,
    target,
    completions: [],
    createdAt: new Date().toISOString(),
  };
}

// ---------- Interactive app UI ----------

async function showMainTable() {
  const data = loadData();
  const table = new UITable();
  table.showSeparators = true;

  function render() {
    table.removeAllRows();

    const titleRow = new UITableRow();
    titleRow.isHeader = true;
    titleRow.addText("🔥 Streaks");
    table.addRow(titleRow);

    if (data.streaks.length === 0) {
      const emptyRow = new UITableRow();
      emptyRow.addText("No streaks yet", "Tap + Add Streak below to create one");
      table.addRow(emptyRow);
    }

    for (const streak of data.streaks) {
      const row = new UITableRow();
      row.height = 60;
      row.dismissOnSelect = false;

      const pending = isPendingToday(streak);
      const count = computeStreakCount(streak);
      const status = pending ? "⭕ pending" : "✅ done";
      const textCell = row.addText(
        `${streak.emoji}  ${streak.name}`,
        `${typeLabel(streak)} · 🔥${count} · ${status}`
      );
      textCell.widthWeight = 80;
      row.onSelect = () => {
        toggleToday(streak);
        saveData(data);
        render();
      };

      const delCell = row.addButton("Delete");
      delCell.widthWeight = 20;
      delCell.onTap = () => {
        data.streaks = data.streaks.filter((s) => s.id !== streak.id);
        saveData(data);
        render();
      };

      table.addRow(row);
    }

    const addRow = new UITableRow();
    addRow.dismissOnSelect = false;
    addRow.addText("➕ Add Streak");
    addRow.onSelect = async () => {
      const streak = await promptNewStreak();
      if (streak) {
        data.streaks.push(streak);
        saveData(data);
      }
      render();
    };
    table.addRow(addRow);

    table.reload();
  }

  render();
  await table.present(false);
}

// ---------- Widget ----------

function buildWidget() {
  const data = loadData();
  const widget = new ListWidget();
  widget.backgroundColor = new Color("#1c1c1e");

  const title = widget.addText("🔥 Streaks");
  title.font = Font.boldSystemFont(16);
  title.textColor = Color.white();
  widget.addSpacer(8);

  if (data.streaks.length === 0) {
    const empty = widget.addText("No streaks yet");
    empty.textColor = Color.gray();
    empty.font = Font.systemFont(13);
  }

  const maxRows = config.widgetFamily === "large" ? 10 : 4;
  for (const streak of data.streaks.slice(0, maxRows)) {
    const row = widget.addStack();
    row.layoutHorizontally();
    row.centerAlignContent();

    const pending = isPendingToday(streak);
    const count = computeStreakCount(streak);
    const label = row.addText(`${pending ? "⭕" : "✅"} ${streak.emoji} ${streak.name}`);
    label.font = Font.systemFont(13);
    label.textColor = Color.white();
    row.addSpacer();
    const countLabel = row.addText(`${count}`);
    countLabel.font = Font.systemFont(13);
    countLabel.textColor = Color.orange();

    widget.addSpacer(4);
  }

  widget.refreshAfterDate = addDays(new Date(), 0.02); // refresh roughly every ~30 min
  return widget;
}

// ---------- Reminder mode (triggered from a Shortcuts Automation) ----------

async function sendReminderNotification() {
  const data = loadData();
  const pending = data.streaks.filter(isPendingToday);
  if (pending.length === 0) return;

  const n = new Notification();
  n.title = pending.length === 1 ? "1 streak needs you today" : `${pending.length} streaks need you today`;
  n.body = pending.map((s) => `${s.emoji} ${s.name}`).join("\n");
  n.sound = "default";
  n.threadIdentifier = "streak-reminders";
  await n.schedule();
}

// ---------- Entry point ----------

if (config.runsInWidget) {
  const widget = buildWidget();
  Script.setWidget(widget);
  Script.complete();
} else if (args.shortcutParameter === "remind") {
  await sendReminderNotification();
  Script.complete();
} else {
  await showMainTable();
  Script.complete();
}
