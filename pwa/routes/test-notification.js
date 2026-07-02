import { sendReminderForUser } from "../lib/reminders.js";
import { requireUserId } from "../lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const userId = await requireUserId(req, res);
  if (!userId) return;

  await sendReminderForUser(userId, { force: true });
  res.status(200).json({ ok: true });
}
