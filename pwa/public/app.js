import {
  computeStreakCount,
  isPendingToday,
  weekProgressLabel,
} from "./streak-logic.js";
import { initAuth } from "./clerk-auth.js";

const STORAGE_KEY = "streak-counter-data";

const listEl = document.getElementById("streak-list");
const addBtn = document.getElementById("add-streak-btn");
const dialog = document.getElementById("add-dialog");
const addForm = document.getElementById("add-form");
const cancelAddBtn = document.getElementById("cancel-add-btn");
const nameInput = document.getElementById("streak-name");
const emojiInput = document.getElementById("streak-emoji");
const typeSelect = document.getElementById("streak-type");
const targetLabel = document.getElementById("target-label");
const targetInput = document.getElementById("streak-target");
const iosBanner = document.getElementById("ios-install-banner");
const enableNotifBtn = document.getElementById("enable-notif-btn");
const testNotifBtn = document.getElementById("test-notif-btn");
const notifStatus = document.getElementById("notif-status");

function loadLocalStreaks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function uuid() {
  // crypto.randomUUID() only exists in secure contexts (HTTPS or localhost).
  // The app is also used over plain http://<lan-ip>:port from a phone, so it
  // needs a fallback that works everywhere.
  if (window.crypto && crypto.randomUUID && window.isSecureContext) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function toggleToday(streak) {
  const t = new Date();
  const key = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  const idx = streak.completions.indexOf(key);
  if (idx >= 0) streak.completions.splice(idx, 1);
  else streak.completions.push(key);
}

// ---------- Celebration (fires when a streak is marked done) ----------

function burstConfetti() {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:9998;";
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  const colors = ["#ff9500", "#32d74b", "#0a84ff", "#ff453a", "#ffd60a", "#bf5af2"];
  const pieces = Array.from({ length: 120 }, () => ({
    x: canvas.width / 2,
    y: canvas.height * 0.35,
    vx: (Math.random() - 0.5) * 16,
    vy: Math.random() * -14 - 4,
    size: Math.random() * 6 + 4,
    color: colors[(Math.random() * colors.length) | 0],
    rotation: Math.random() * Math.PI,
    spin: (Math.random() - 0.5) * 0.3,
  }));

  const start = performance.now();
  const duration = 1600;

  function frame(now) {
    const elapsed = now - start;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of pieces) {
      p.vy += 0.03;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.spin;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    }
    if (elapsed < duration) {
      requestAnimationFrame(frame);
    } else {
      canvas.remove();
    }
  }
  requestAnimationFrame(frame);
}

function showRewardGif(gifUrl) {
  const overlay = document.createElement("div");
  overlay.className = "reward-overlay";

  const card = document.createElement("div");
  card.className = "reward-card";

  const img = document.createElement("img");
  img.src = gifUrl;
  img.alt = "Celebration";

  const closeBtn = document.createElement("button");
  closeBtn.className = "secondary-btn";
  closeBtn.textContent = "Nice ✕";

  card.append(img, closeBtn);
  overlay.append(card);
  document.body.append(overlay);

  const close = () => overlay.remove();
  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  setTimeout(close, 5000);
}

async function celebrate() {
  burstConfetti();
  try {
    const res = await fetch("/api/reward-gif");
    const data = await res.json();
    if (data.gif) showRewardGif(data.gif);
  } catch {
    // Offline or server unreachable — confetti alone is still a fine reward.
  }
}

async function main() {
  const { getToken } = await initAuth();

  async function authFetch(url, options = {}) {
    const token = await getToken();
    const headers = { ...options.headers };
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(url, { ...options, headers });
  }

  async function syncToServer(currentStreaks) {
    try {
      await authFetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ streaks: currentStreaks }),
      });
    } catch {
      // Offline or server not running — local data is still the source of truth for the UI.
    }
  }

  function saveStreaks(currentStreaks) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentStreaks));
    syncToServer(currentStreaks);
  }

  // The server (per signed-in user) is the source of truth, since the same
  // account may be used from more than one device; localStorage is just a
  // fast local cache, and the fallback if the initial fetch fails (offline).
  let streaks = loadLocalStreaks();
  try {
    const res = await authFetch("/api/sync");
    const data = await res.json();
    if (Array.isArray(data.streaks)) {
      streaks = data.streaks;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(streaks));
    }
  } catch {
    // Offline on first load — proceed with whatever's cached locally.
  }

  function render() {
    listEl.innerHTML = "";

    if (streaks.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "No streaks yet — tap + to add one.";
      listEl.appendChild(empty);
      return;
    }

    for (const streak of streaks) {
      const pending = isPendingToday(streak);
      const count = computeStreakCount(streak);

      const card = document.createElement("div");
      card.className = "streak-card";

      const toggle = document.createElement("button");
      toggle.className = "streak-toggle" + (pending ? "" : " done");
      toggle.textContent = pending ? "" : "✓";
      toggle.setAttribute("aria-label", pending ? "Mark done" : "Mark not done");
      toggle.addEventListener("click", () => {
        const wasPending = pending;
        toggleToday(streak);
        saveStreaks(streaks);
        render();
        if (wasPending) celebrate();
      });

      const main = document.createElement("div");
      main.className = "streak-main";
      const nameEl = document.createElement("div");
      nameEl.className = "streak-name";
      nameEl.textContent = `${streak.emoji} ${streak.name}`;
      const metaEl = document.createElement("div");
      metaEl.className = "streak-meta";
      metaEl.textContent = weekProgressLabel(streak);
      main.append(nameEl, metaEl);

      const countEl = document.createElement("div");
      countEl.className = "streak-count";
      countEl.textContent = `🔥 ${count}`;

      const delBtn = document.createElement("button");
      delBtn.className = "streak-delete";
      delBtn.textContent = "✕";
      delBtn.setAttribute("aria-label", "Delete streak");
      delBtn.addEventListener("click", () => {
        streaks = streaks.filter((s) => s.id !== streak.id);
        saveStreaks(streaks);
        render();
      });

      card.append(toggle, main, countEl, delBtn);
      listEl.appendChild(card);
    }
  }

  // ---------- Add streak dialog ----------

  addBtn.addEventListener("click", () => {
    addForm.reset();
    targetLabel.classList.add("hidden");
    dialog.showModal();
  });

  cancelAddBtn.addEventListener("click", () => dialog.close());

  typeSelect.addEventListener("change", () => {
    targetLabel.classList.toggle("hidden", typeSelect.value !== "weekly_n");
  });

  addForm.addEventListener("submit", (e) => {
    const name = nameInput.value.trim();
    if (!name) {
      e.preventDefault();
      return;
    }
    const streak = {
      id: uuid(),
      name,
      emoji: emojiInput.value.trim() || "🔥",
      type: typeSelect.value,
      target: typeSelect.value === "weekly_n" ? Number(targetInput.value) || 3 : undefined,
      completions: [],
      createdAt: new Date().toISOString(),
    };
    streaks.push(streak);
    saveStreaks(streaks);
    render();
  });

  render();

  // ---------- iOS install banner ----------

  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

  if (isIOS && !isStandalone) {
    iosBanner.classList.remove("hidden");
  }

  // ---------- Service worker + push notifications ----------

  let swRegistration = null;

  async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return null;
    swRegistration = await navigator.serviceWorker.register("sw.js");
    return swRegistration;
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
  }

  function updateNotifUI() {
    const supported = isStandalone && "PushManager" in window && "Notification" in window;
    if (!supported) {
      enableNotifBtn.classList.add("hidden");
      testNotifBtn.classList.add("hidden");
      notifStatus.textContent = isIOS
        ? "Add this app to your Home Screen first, then open it from there to enable reminders."
        : "";
      return;
    }
    if (Notification.permission === "granted") {
      enableNotifBtn.classList.add("hidden");
      testNotifBtn.classList.remove("hidden");
      notifStatus.textContent = "Reminders are enabled.";
    } else {
      enableNotifBtn.classList.remove("hidden");
      testNotifBtn.classList.add("hidden");
      notifStatus.textContent = "Enable reminders to get notified about pending streaks.";
    }
  }

  async function enableNotifications() {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      notifStatus.textContent = "Notifications permission was not granted.";
      return;
    }

    const reg = swRegistration || (await registerServiceWorker());
    const keyRes = await fetch("/api/vapid-public-key");
    const { publicKey } = await keyRes.json();

    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    await authFetch("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription }),
    });

    updateNotifUI();
  }

  enableNotifBtn.addEventListener("click", () => {
    enableNotifications().catch((err) => {
      notifStatus.textContent = `Could not enable notifications: ${err.message}`;
    });
  });

  testNotifBtn.addEventListener("click", async () => {
    notifStatus.textContent = "Sending test notification…";
    try {
      await authFetch("/api/test-notification", { method: "POST" });
      notifStatus.textContent = "Test notification sent (if any streak is pending today).";
    } catch (err) {
      notifStatus.textContent = `Failed to send test notification: ${err.message}`;
    }
  });

  registerServiceWorker().finally(updateNotifUI);
}

main();
