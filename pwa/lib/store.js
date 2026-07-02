import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// On Vercel there's no writable persistent filesystem between invocations, so we
// use Upstash Redis (via the Vercel Marketplace integration) when its env vars
// are present. Locally, without that integration configured, we fall back to a
// JSON file so `npm start` keeps working without any extra setup.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_DATA_FILE = path.join(__dirname, "..", "data", "store.json");
const STORE_KEY = "streaks-store";

function emptyStore() {
  return { subscriptions: [], streaks: [] };
}

let redisClient;
let redisAttempted = false;

async function getRedis() {
  if (redisAttempted) return redisClient;
  redisAttempted = true;
  // Redis.fromEnv() doesn't throw when the env vars are missing — it only fails
  // later, on the first actual command. Check explicitly instead so local dev
  // (no Upstash configured) falls back to the file store instead of crashing.
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    redisClient = null;
    return redisClient;
  }
  try {
    const { Redis } = await import("@upstash/redis");
    redisClient = Redis.fromEnv();
  } catch {
    redisClient = null;
  }
  return redisClient;
}

export async function loadStore() {
  const redis = await getRedis();
  if (redis) {
    const data = await redis.get(STORE_KEY);
    return data || emptyStore();
  }
  if (!fs.existsSync(LOCAL_DATA_FILE)) return emptyStore();
  try {
    return JSON.parse(fs.readFileSync(LOCAL_DATA_FILE, "utf-8"));
  } catch {
    return emptyStore();
  }
}

export async function saveStore(store) {
  const redis = await getRedis();
  if (redis) {
    await redis.set(STORE_KEY, store);
    return;
  }
  fs.mkdirSync(path.dirname(LOCAL_DATA_FILE), { recursive: true });
  fs.writeFileSync(LOCAL_DATA_FILE, JSON.stringify(store, null, 2));
}
