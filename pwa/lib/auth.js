// Vercel's Clerk Marketplace integration injects NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
// (Next.js naming, even though this isn't a Next.js app) and CLERK_SECRET_KEY.
// Passed explicitly to clerkMiddleware() instead of relying on @clerk/express's
// own default env var names, which don't match what's actually injected.
const PUBLISHABLE_KEY = process.env.CLERK_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const SECRET_KEY = process.env.CLERK_SECRET_KEY;

export const CLERK_ENABLED = !!(PUBLISHABLE_KEY && SECRET_KEY);
export const CLERK_PUBLISHABLE_KEY = PUBLISHABLE_KEY;

const LOCAL_DEV_USER_ID = "local-dev-user";

export async function authMiddleware() {
  if (!CLERK_ENABLED) return (req, res, next) => next();
  const { clerkMiddleware } = await import("@clerk/express");
  return clerkMiddleware({ publishableKey: PUBLISHABLE_KEY, secretKey: SECRET_KEY });
}

// Returns the authenticated userId, or null (and writes a 401) if unauthenticated.
// Without Clerk configured (local dev with no keys set), everyone is treated as
// a single fixed local user so `npm start` keeps working with zero extra setup.
export async function requireUserId(req, res) {
  if (!CLERK_ENABLED) return LOCAL_DEV_USER_ID;
  const { getAuth } = await import("@clerk/express");
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return userId;
}
