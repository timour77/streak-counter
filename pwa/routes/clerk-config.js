import { CLERK_ENABLED, CLERK_PUBLISHABLE_KEY } from "../lib/auth.js";

export default function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  res.status(200).json({
    enabled: CLERK_ENABLED,
    publishableKey: CLERK_ENABLED ? CLERK_PUBLISHABLE_KEY : null,
  });
}
