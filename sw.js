// ─── Sunrise Service Worker ───────────────────────────────────────────────────
// Handles: offline caching + scheduled 7am notifications

const CACHE_NAME = 'sunrise-v5';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './quotes.js',
  './questions.js',
  './crypto.js',
  './supabase-client.js',
  './supabase.min.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// ─── Install: cache all assets ───────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ─── Activate: clear old caches, then notify clients to reload ───────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      const stale = keys.filter(k => k !== CACHE_NAME);
      return Promise.all(stale.map(k => caches.delete(k))).then(() => stale.length > 0);
    }).then(wasUpdate => {
      return self.clients.claim().then(() => {
        if (wasUpdate) {
          // Tell all open tabs to reload so they get the fresh assets
          self.clients.matchAll({ type: 'window' }).then(clients => {
            clients.forEach(c => c.postMessage({ type: 'SW_UPDATED' }));
          });
        }
      });
    })
  );
});

// ─── Fetch: network-first, fall back to cache (so updates are always picked up)
self.addEventListener('fetch', event => {
  // Only intercept same-origin requests
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Update the cache with the fresh response
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Offline: serve from cache
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') return caches.match('./index.html');
        });
      })
  );
});

// ─── Notification scheduling ──────────────────────────────────────────────────
// The app sends a SCHEDULE_NOTIFICATION message; we store the config and
// set a recurring daily alarm using setTimeout chains managed by the SW.

let notifTimer = null;

function msUntilNext7am() {
  const now  = new Date();
  const next = new Date();
  next.setHours(7, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next - now;
}

function scheduleDaily7amNotification() {
  // Clear any existing timer
  if (notifTimer) clearTimeout(notifTimer);

  const delay = msUntilNext7am();

  notifTimer = setTimeout(() => {
    showMorningNotification();
    // Reschedule for next day
    scheduleDaily7amNotification();
  }, delay);
}

function showMorningNotification() {
  const messages = [
    'Good morning ☀️ Time for your daily reflection.',
    'Rise and reflect 🌅 Your journal is waiting.',
    'A new day begins. What are you grateful for? 🌿',
    'Morning! Take a moment to set your intention for today.',
    'Good morning. A few mindful minutes can shape your whole day. ✨',
  ];
  const msg = messages[Math.floor(Math.random() * messages.length)];

  self.registration.showNotification('Sunrise', {
    body: msg,
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    tag: 'sunrise-morning',         // replaces any existing notification
    renotify: false,
    requireInteraction: false,
    data: { url: self.registration.scope },
  });
}

// ─── Message handler ─────────────────────────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SCHEDULE_NOTIFICATION') {
    scheduleDaily7amNotification();
  }
});

// ─── Notification click: open/focus the app ───────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const appUrl = event.notification.data && event.notification.data.url
    ? event.notification.data.url
    : self.registration.scope;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const existing = clients.find(c => c.url.startsWith(self.registration.scope));
      if (existing) {
        existing.focus();
      } else {
        self.clients.openWindow(appUrl);
      }
    })
  );
});

// Auto-schedule on SW startup (persists when app is closed)
scheduleDaily7amNotification();
