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

  return new Promise((resolve) => {
    let settled = false;
    let pollHandle = null;

    function render() {
      if (window.Clerk.isSignedIn) {
        signInWrapper.classList.add("hidden");
        appContent.classList.remove("hidden");
        userButtonContainer.innerHTML = "";
        window.Clerk.mountUserButton(userButtonContainer);
        if (!settled) {
          settled = true;
          if (pollHandle) clearInterval(pollHandle);
          resolve({ getToken: () => window.Clerk.session.getToken() });
        }
      } else {
        appContent.classList.add("hidden");
        userButtonContainer.innerHTML = "";
        signInWrapper.classList.remove("hidden");
        if (!signInContainer.hasChildNodes()) {
          // withSignUp gives a single unified sign-in-or-up flow within this one
          // mounted component, instead of SignIn's default "Sign up" link, which
          // navigates away to Clerk's separately hosted Account Portal.
          window.Clerk.mountSignIn(signInContainer, { withSignUp: true });
        }
      }
    }

    render();
    window.Clerk.addListener(render);

    // Clerk's dev instance syncs sessions across the cross-origin *.accounts.dev
    // domain via a querystring token instead of a real cookie (Safari blocks
    // third-party cookies). That handshake can complete server-side without
    // addListener firing in this tab — a short poll is a cheap safety net so
    // the app notices within a couple seconds instead of needing a reload.
    pollHandle = setInterval(() => {
      if (!settled && window.Clerk.isSignedIn) render();
    }, 1200);
  });
}
