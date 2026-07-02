import { loadStore, saveStore } from "../lib/store.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { streaks } = req.body || {};
  if (!Array.isArray(streaks)) return res.status(400).json({ error: "Missing streaks" });

  const store = await loadStore();
  store.streaks = streaks;
  await saveStore(store);

  res.status(200).json({ ok: true });
}
