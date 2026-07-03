// Loads Clerk without a bundler (script tags + the documented data-clerk-publishable-key
// attribute), gates #app-content behind #sign-in-container, and keeps both in sync with
// auth state. Resolves once the user is signed in (or immediately if Clerk isn't
// configured, e.g. local dev), with a getToken() for authenticated API calls.

function decodeFrontendApi(publishableKey) {
  const base64Part = publishableKey.split("_")[2] || "";
  return atob(base64Part).replace(/\$$/, "");
}

function loadScript(src, attrs = {}) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.crossOrigin = "anonymous";
    for (const [key, value] of Object.entries(attrs)) script.setAttribute(key, value);
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

// Hides the "hidden" appearance elements below: Clerk merges a string value in
// `appearance.elements` in as an extra class on that element, and styles.css
// defines a real `.hidden { display: none }`, so this piggybacks on that.
const HIDE_HEADER_APPEARANCE = { elements: { header: "hidden" } };

export async function initAuth() {
  const authLoading = document.getElementById("auth-loading");
  // mountSignIn() mutates its target element's own class attribute (replaces it
  // with Clerk's internal classes), which silently wipes out any layout class
  // applied directly to that element. Mounting into an inner div and doing our
  // own hidden/visible + centering on an outer wrapper avoids that entirely.
  const signInWrapper = document.getElementById("sign-in-wrapper");
  const signInContainer = document.getElementById("sign-in-container");
  const appContent = document.getElementById("app-content");
  const userButtonContainer = document.getElementById("user-button-container");

  const configRes = await fetch("/api/clerk-config");
  const config = await configRes.json();

  if (!config.enabled) {
    authLoading.classList.add("hidden");
    appContent.classList.remove("hidden");
    return { getToken: async () => null };
  }

  const fapi = decodeFrontendApi(config.publishableKey);
  await loadScript(`https://${fapi}/npm/@clerk/ui@1/dist/ui.browser.js`);
  await loadScript(`https://${fapi}/npm/@clerk/clerk-js@6/dist/clerk.browser.js`, {
    "data-clerk-publishable-key": config.publishableKey,
  });

  await window.Clerk.load({ ui: { ClerkUI: window.__internal_ClerkUICtor } });
  authLoading.classList.add("hidden");

  const wasSignedIn = window.Clerk.isSignedIn;

  // This shell has no framework bindings to reactively re-render when auth state
  // flips underneath it, and Clerk's dev-instance cross-origin (*.accounts.dev)
  // session handshake doesn't even notify this tab's in-memory client without an
  // explicit refetch. Reloading on any change is what Clerk's own docs recommend
  // for non-framework sign-out flows, and it's what already works today when
  // reloading manually — so do it automatically instead of trying to patch the
  // DOM in place (which previously left both sign-in and sign-out needing a
  // manual refresh to take effect).
  window.Clerk.addListener(({ session }) => {
    // Clerk emits `session: undefined` as a transient "still loading" state
    // during routine background token refreshes, distinct from `null` (truly
    // signed out) — treating it as a change caused spurious reloads for
    // already-signed-in users, which could race with and cancel a real
    // sign-out's network call before the session was actually revoked.
    if (session === undefined) return;
    if (Boolean(session) !== wasSignedIn) window.location.reload();
  });

  if (wasSignedIn) {
    signInWrapper.classList.add("hidden");
    appContent.classList.remove("hidden");
    window.Clerk.mountUserButton(userButtonContainer);
    return { getToken: () => window.Clerk.session.getToken() };
  }

  appContent.classList.add("hidden");
  signInWrapper.classList.remove("hidden");
  // withSignUp gives a single unified sign-in-or-up flow within this one
  // mounted component, instead of SignIn's default "Sign up" link, which
  // navigates away to Clerk's separately hosted Account Portal.
  window.Clerk.mountSignIn(signInContainer, { withSignUp: true, appearance: HIDE_HEADER_APPEARANCE });

  // addListener alone doesn't reliably fire for the cross-origin dev-instance
  // handshake above, so poll a real client refetch as a safety net — checking
  // window.Clerk.isSignedIn alone isn't enough since that flag is exactly what
  // fails to update without a refetch.
  const pollHandle = setInterval(async () => {
    try {
      await window.Clerk.client.reload();
    } catch {
      return; // offline — try again next tick
    }
    if (window.Clerk.isSignedIn) {
      clearInterval(pollHandle);
      window.location.reload();
    }
  }, 1500);

  // Intentionally never resolves: the page reloads once sign-in completes
  // (above), and the reloaded page's initAuth() resolves immediately since
  // Clerk now reports the user as signed in.
  return new Promise(() => {});
}
