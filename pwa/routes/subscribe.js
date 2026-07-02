import { loadStore, saveStore } from "../lib/store.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { subscription } = req.body || {};
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: "Missing subscription" });
  }

  const store = await loadStore();
  const exists = store.subscriptions.some((s) => s.endpoint === subscription.endpoint);
  if (!exists) store.subscriptions.push(subscription);
  await saveStore(store);

  res.status(200).json({ ok: true });
}
