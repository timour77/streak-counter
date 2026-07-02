import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

import vapidPublicKeyHandler from "./api/vapid-public-key.js";
import subscribeHandler from "./api/subscribe.js";
import syncHandler from "./api/sync.js";
import testNotificationHandler from "./api/test-notification.js";
import rewardGifHandler from "./api/reward-gif.js";
import cronHandler from "./api/cron.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "public");
const PORT = process.env.PORT || 3000;

if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
  console.error("Missing VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY in .env. See setup instructions.");
  process.exit(1);
}

// This server exists for local development only. In production (Vercel), each
// file in api/ is deployed as its own serverless function instead — mounting
// the exact same handlers here means there's only one copy of the route logic.
const app = express();
app.use(express.json());
app.use(express.static(PUBLIC_DIR));

app.get("/api/vapid-public-key", vapidPublicKeyHandler);
app.post("/api/subscribe", subscribeHandler);
app.post("/api/sync", syncHandler);
app.post("/api/test-notification", testNotificationHandler);
app.get("/api/reward-gif", rewardGifHandler);
app.get("/api/cron", cronHandler);

app.listen(PORT, () => {
  console.log(`Streaks server running at http://localhost:${PORT}`);
  console.log(`The daily reminder only runs on a schedule via Vercel Cron in production (see vercel.json).`);
  console.log(`Locally, use the "Send test notification" button in the app to test push delivery.`);
});
