import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// On Vercel there's no writable persistent filesystem between invocations, so we
// use Upstash Redis (via the Vercel Marketplace integration) when its env vars
// are present. Locally, without that integration configured, we fall back to a
// JSON file so `npm start` keeps working without any extra setup.
//
// Data is namespaced per Clerk user: each user gets their own
// `streaks:user:<userId>` key, and every userId is also added to a
// `streaks:known-users` set so the reminder cron can iterate all users without
// needing a Redis SCAN.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_DATA_FILE = path.join(__dirname, "..", "data", "store.json");
const KNOWN_USERS_KEY = "streaks:known-users";

// See lib/store.js history: the Vercel "Upstash for Redis" integration injects
// KV_REST_API_URL / KV_REST_API_TOKEN (legacy Vercel KV naming), not Upstash's
// own UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN — checking both covers
// either naming.
const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

function emptyUserStore() {
  return { subscriptions: [], streaks: [] };
}

function userKey(userId) {
  return `streaks:user:${userId}`;
}

let redisClient;
let redisAttempted = false;

async function getRedis() {
  if (redisAttempted) return redisClient;
  redisAttempted = true;
  if (!REDIS_URL || !REDIS_TOKEN) {
    redisClient = null;
    return redisClient;
  }
  try {
    const { Redis } = await import("@upstash/redis");
    redisClient = new Redis({ url: REDIS_URL, token: REDIS_TOKEN });
  } catch {
    redisClient = null;
  }
  return redisClient;
}

function loadLocalFile() {
  if (!fs.existsSync(LOCAL_DATA_FILE)) return { users: {} };
  try {
    const parsed = JSON.parse(fs.readFileSync(LOCAL_DATA_FILE, "utf-8"));
    return parsed && parsed.users ? parsed : { users: {} };
  } catch {
    return { users: {} };
  }
}

function saveLocalFile(data) {
  fs.mkdirSync(path.dirname(LOCAL_DATA_FILE), { recursive: true });
  fs.writeFileSync(LOCAL_DATA_FILE, JSON.stringify(data, null, 2));
}

export async function loadUserStore(userId) {
  const redis = await getRedis();
  if (redis) {
    const data = await redis.get(userKey(userId));
    return data || emptyUserStore();
  }
  const data = loadLocalFile();
  return data.users[userId] || emptyUserStore();
}

export async function saveUserStore(userId, store) {
  const redis = await getRedis();
  if (redis) {
    await redis.set(userKey(userId), store);
    await redis.sadd(KNOWN_USERS_KEY, userId);
    return;
  }
  const data = loadLocalFile();
  data.users[userId] = store;
  saveLocalFile(data);
}

export async function getAllUserIds() {
  const redis = await getRedis();
  if (redis) {
    return await redis.smembers(KNOWN_USERS_KEY);
  }
  const data = loadLocalFile();
  return Object.keys(data.users);
}
