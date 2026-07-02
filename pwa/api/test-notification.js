import { sendReminders } from "../lib/reminders.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  await sendReminders({ force: true });
  res.status(200).json({ ok: true });
}
