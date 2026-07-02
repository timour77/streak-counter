import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

import vapidPublicKeyHandler from "./routes/vapid-public-key.js";
import subscribeHandler from "./routes/subscribe.js";
import syncHandler from "./routes/sync.js";
import testNotificationHandler from "./routes/test-notification.js";
import rewardGifHandler from "./routes/reward-gif.js";
import cronHandler from "./routes/cron.js";
import clerkConfigHandler from "./routes/clerk-config.js";
import { authMiddleware, CLERK_ENABLED } from "./lib/auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "public");
const PORT = process.env.PORT || 3000;

if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
  console.error("Missing VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY in .env. See setup instructions.");
  process.exit(1);
}

// Vercel deploys this file directly as a single Function (zero-config Express
// support), so the same app.js runs unchanged in both dev and prod. In prod,
// Vercel's CDN serves public/** directly and express.static() here is a no-op;
// locally there's no CDN, so it's what actually serves the frontend.
const app = express();
app.use(express.json());
app.use(express.static(PUBLIC_DIR));
app.use(await authMiddleware());

app.get("/api/clerk-config", clerkConfigHandler);
app.get("/api/vapid-public-key", vapidPublicKeyHandler);
app.post("/api/subscribe", subscribeHandler);
app.all("/api/sync", syncHandler);
app.post("/api/test-notification", testNotificationHandler);
app.get("/api/reward-gif", rewardGifHandler);
app.get("/api/cron", cronHandler);

app.listen(PORT, () => {
  console.log(`Streaks server running at http://localhost:${PORT}`);
  console.log(`The daily reminder only runs on a schedule via Vercel Cron in production (see vercel.json).`);
  console.log(`Locally, use the "Send test notification" button in the app to test push delivery.`);
  console.log(CLERK_ENABLED ? "Clerk auth is enabled." : "Clerk not configured — using a single local dev user.");
});
