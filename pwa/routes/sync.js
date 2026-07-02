import { loadUserStore, saveUserStore } from "../lib/store.js";
import { requireUserId } from "../lib/auth.js";

export default async function handler(req, res) {
  const userId = await requireUserId(req, res);
  if (!userId) return;

  if (req.method === "GET") {
    const store = await loadUserStore(userId);
    return res.status(200).json({ streaks: store.streaks });
  }

  if (req.method === "POST") {
    const { streaks } = req.body || {};
    if (!Array.isArray(streaks)) return res.status(400).json({ error: "Missing streaks" });

    const store = await loadUserStore(userId);
    store.streaks = streaks;
    await saveUserStore(userId, store);
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}
