import { loadUserStore, saveUserStore } from "../lib/store.js";
import { requireUserId } from "../lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const userId = await requireUserId(req, res);
  if (!userId) return;

  const { subscription } = req.body || {};
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: "Missing subscription" });
  }

  const store = await loadUserStore(userId);
  const exists = store.subscriptions.some((s) => s.endpoint === subscription.endpoint);
  if (!exists) store.subscriptions.push(subscription);
  await saveUserStore(userId, store);

  res.status(200).json({ ok: true });
}
