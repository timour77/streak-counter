import { sendRemindersForAllUsers } from "../lib/reminders.js";

// Triggered daily by Vercel Cron (see vercel.json). Vercel signs the request
// with an Authorization: Bearer <CRON_SECRET> header when CRON_SECRET is set,
// which is the only thing stopping this public URL from being spammed by
// anyone who finds it.
export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  await sendRemindersForAllUsers();
  res.status(200).json({ ok: true });
}
