import webpush from "web-push";
import { loadStore, saveStore } from "./store.js";
import { isPendingToday } from "../public/streak-logic.js";

let vapidConfigured = false;

function ensureVapid() {
  if (vapidConfigured) return;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:you@example.com";
  if (!publicKey || !privateKey) {
    throw new Error("Missing VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY env vars");
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
}

async function pushToAll(store, payload) {
  const stillValid = [];
  for (const sub of store.subscriptions) {
    try {
      await webpush.sendNotification(sub, payload);
      stillValid.push(sub);
    } catch (err) {
      // 404/410 means the subscription is gone (uninstalled, permission revoked, etc).
      if (err.statusCode !== 404 && err.statusCode !== 410) stillValid.push(sub);
    }
  }
  store.subscriptions = stillValid;
  await saveStore(store);
}

export async function sendReminders({ force = false } = {}) {
  ensureVapid();
  const store = await loadStore();
  if (store.subscriptions.length === 0) return;

  const pending = (store.streaks || []).filter((s) => isPendingToday(s));

  if (pending.length === 0) {
    if (!force) return;
    await pushToAll(
      store,
      JSON.stringify({
        title: "Test notification",
        body: "Push notifications are working. All streaks are done for now!",
      })
    );
    return;
  }

  await pushToAll(
    store,
    JSON.stringify({
      title: pending.length === 1 ? "1 streak needs you today" : `${pending.length} streaks need you today`,
      body: pending.map((s) => `${s.emoji} ${s.name}`).join("\n"),
    })
  );
}
