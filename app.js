// ─── Sunrise App ─────────────────────────────────────────────────────────────

const STORAGE_KEY = 'sunrise_entries';
const NOTIF_KEY   = 'sunrise_notif_enabled';

// ─── Utilities ───────────────────────────────────────────────────────────────

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function formatDisplayDate(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}

function getEntries() {
  return SunriseDB.getEntries();
}

// ─── Daily Quote ─────────────────────────────────────────────────────────────

function getDailyQuote() {
  const now   = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff  = now - start;
  const dayOfYear = Math.floor(diff / 86400000);
  const idx   = dayOfYear % QUOTES.length;
  return QUOTES[idx];
}

// ─── Navigation ──────────────────────────────────────────────────────────────

const views   = document.querySelectorAll('.view');
const navBtns = document.querySelectorAll('.nav-btn');

function showView(name) {
  views.forEach(v => v.classList.remove('active'));
  navBtns.forEach(b => b.classList.remove('active'));

  const view = document.getElementById('view-' + name);
  const btn  = document.querySelector(`.nav-btn[data-view="${name}"]`);
  if (view) view.classList.add('active');
  if (btn)  btn.classList.add('active');

  if (name === 'history')  renderHistory();
  if (name === 'settings') initSettings();
}

navBtns.forEach(btn => {
  btn.addEventListener('click', () => showView(btn.dataset.view));
});

// ─── Today View ──────────────────────────────────────────────────────────────

function initToday() {
  // Date header
  document.getElementById('today-date').textContent = formatDisplayDate(todayKey());

  // Quote
  const q = getDailyQuote();
  document.getElementById('daily-quote').textContent  = q.text;
  document.getElementById('quote-author').textContent = q.author ? `— ${q.author}` : '';

  // Pre-fill form if today's entry exists
  const entries = getEntries();
  const entry   = entries[todayKey()];
  if (entry) {
    fillForm(entry);
    document.getElementById('save-btn').textContent = 'Update Today\'s Entry';
  }
}

function fillForm(entry) {
  const form = document.getElementById('journal-form');
  const fields = [
    'grateful1','grateful2','grateful3',
    'appreciated1','appreciated2','appreciated3',
    'forward1','forward2','forward3',
    'intention','awesome','thoughts'
  ];
  fields.forEach(name => {
    const el = form.elements[name];
    if (el && entry[name] !== undefined) el.value = entry[name];
  });
}

function readForm() {
  const form = document.getElementById('journal-form');
  const data = { savedAt: new Date().toISOString() };
  const fields = [
    'grateful1','grateful2','grateful3',
    'appreciated1','appreciated2','appreciated3',
    'forward1','forward2','forward3',
    'intention','awesome','thoughts'
  ];
  fields.forEach(name => {
    const el = form.elements[name];
    data[name] = el ? el.value.trim() : '';
  });
  return data;
}

document.getElementById('journal-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const entry  = readForm();
  const btn    = document.getElementById('save-btn');
  const status = document.getElementById('save-status');

  btn.disabled = true;
  btn.textContent = 'Saving…';

  try {
    await SunriseDB.saveEntry(todayKey(), entry);

    btn.textContent    = 'Update Today\'s Entry';
    status.textContent = '✓ Saved & encrypted';
    status.classList.add('visible');
    setTimeout(() => status.classList.remove('visible'), 3000);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    status.textContent = 'Error saving. Please try again.';
    status.classList.add('visible');
    console.error('Save failed:', err);
  } finally {
    btn.disabled = false;
  }
});

// ─── History View ─────────────────────────────────────────────────────────────

function renderHistory() {
  const entries  = getEntries();
  const keys     = Object.keys(entries).sort((a, b) => b.localeCompare(a));
  const list     = document.getElementById('history-list');
  const empty    = document.getElementById('history-empty');

  list.innerHTML = '';

  if (keys.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  keys.forEach(dateKey => {
    const entry = entries[dateKey];
    const card  = document.createElement('button');
    card.className    = 'history-card';
    card.setAttribute('aria-label', `Entry for ${formatDisplayDate(dateKey)}`);

    const preview = [
      entry.grateful1, entry.appreciated1, entry.intention
    ].filter(Boolean).join(' · ') || 'No preview available';

    card.innerHTML = `
      <div class="history-date">${formatDisplayDate(dateKey)}</div>
      <div class="history-preview">${escapeHTML(preview)}</div>
    `;

    card.addEventListener('click', () => openEntry(dateKey, entry));
    list.appendChild(card);
  });
}

// ─── Entry Modal ─────────────────────────────────────────────────────────────

function openEntry(dateKey, entry) {
  const modal   = document.getElementById('entry-modal');
  const content = document.getElementById('modal-content');

  const sections = [
    { label: '🌿 Gratitude',        items: [entry.grateful1, entry.grateful2, entry.grateful3] },
    { label: '✨ Appreciation',     items: [entry.appreciated1, entry.appreciated2, entry.appreciated3] },
    { label: '🌅 Looking Forward',  items: [entry.forward1, entry.forward2, entry.forward3] },
    { label: '🎯 Intention',        items: [entry.intention] },
    { label: '💛 You Are Awesome',  items: [entry.awesome] },
    { label: '💭 On My Mind',       items: [entry.thoughts], multiline: true },
  ];

  let html = `<div class="modal-date">${formatDisplayDate(dateKey)}</div>`;

  sections.forEach(sec => {
    const validItems = sec.items.filter(Boolean);
    if (validItems.length === 0) return;

    html += `<div class="modal-section">
      <div class="modal-section-title">${sec.label}</div>`;

    if (sec.multiline) {
      html += `<div class="modal-thought">${escapeHTML(validItems[0]).replace(/\n/g, '<br>')}</div>`;
    } else {
      validItems.forEach(item => {
        html += `<div class="modal-item">${escapeHTML(item)}</div>`;
      });
    }
    html += `</div>`;
  });

  if (entry.savedAt) {
    const saved = new Date(entry.savedAt);
    html += `<div class="modal-meta">Saved at ${saved.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>`;
  }

  content.innerHTML = html;
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('entry-modal').querySelector('.modal-backdrop').addEventListener('click', closeModal);

function closeModal() {
  document.getElementById('entry-modal').style.display = 'none';
  document.body.style.overflow = '';
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

// ─── Settings View ────────────────────────────────────────────────────────────

let settingsInitialized = false;

function initSettings() {
  if (settingsInitialized) return;
  settingsInitialized = true;

  const toggle = document.getElementById('notif-toggle');
  const status = document.getElementById('notif-status');

  toggle.checked = localStorage.getItem(NOTIF_KEY) === 'true';

  toggle.addEventListener('change', async () => {
    if (toggle.checked) {
      const granted = await requestNotificationPermission();
      if (granted) {
        localStorage.setItem(NOTIF_KEY, 'true');
        scheduleNotifications();
        status.textContent = '✓ Notifications enabled. You\'ll be reminded at 7am.';
        status.className   = 'notif-status success';
      } else {
        toggle.checked = false;
        localStorage.setItem(NOTIF_KEY, 'false');
        status.textContent = 'Notifications were blocked. Please enable them in your browser settings.';
        status.className   = 'notif-status error';
      }
    } else {
      localStorage.setItem(NOTIF_KEY, 'false');
      status.textContent = 'Notifications disabled.';
      status.className   = 'notif-status';
    }
  });

  // Export
  document.getElementById('export-btn').addEventListener('click', exportData);

  // Clear
  document.getElementById('clear-btn').addEventListener('click', async () => {
    if (confirm('This will permanently delete all your journal entries from the cloud. Are you sure?')) {
      await SunriseDB.deleteAllEntries();
      alert('All data cleared.');
    }
  });

  // Logout
  document.getElementById('logout-btn').addEventListener('click', async () => {
    if (confirm('Sign out of Sunrise?')) {
      await SunriseDB.signOut();
      location.reload();
    }
  });
}

// ─── Notifications ───────────────────────────────────────────────────────────

async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

function scheduleNotifications() {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'SCHEDULE_NOTIFICATION',
      hour: 7,
      minute: 0
    });
  }
}

// ─── Export ───────────────────────────────────────────────────────────────────

function exportData() {
  const entries = getEntries();
  const json    = JSON.stringify(entries, null, 2);
  const blob    = new Blob([json], { type: 'application/json' });
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement('a');
  a.href        = url;
  a.download    = `sunrise-journal-${todayKey()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── PWA Install Prompt ───────────────────────────────────────────────────────

let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const btn = document.getElementById('install-btn');
  if (btn) {
    btn.style.display = 'inline-flex';
    document.getElementById('install-hint').style.display = 'none';
    btn.addEventListener('click', async () => {
      deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      if (outcome === 'accepted') {
        btn.style.display = 'none';
        document.getElementById('install-hint').style.display = 'block';
        document.getElementById('install-hint').textContent = '✓ Sunrise added to your home screen!';
      }
      deferredInstallPrompt = null;
    });
  }
});

// ─── Service Worker Registration ──────────────────────────────────────────────

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then(reg => {
    console.log('SW registered:', reg.scope);

    if (localStorage.getItem(NOTIF_KEY) === 'true' && Notification.permission === 'granted') {
      navigator.serviceWorker.ready.then(() => scheduleNotifications());
    }
  }).catch(err => console.warn('SW registration failed:', err));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeHTML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Auth Flow ────────────────────────────────────────────────────────────────

const authScreen     = document.getElementById('auth-screen');
const authForm       = document.getElementById('auth-form');
const authEmail      = document.getElementById('auth-email');
const authPassword   = document.getElementById('auth-password');
const authError      = document.getElementById('auth-error');
const authSubtitle   = document.getElementById('auth-subtitle');
const authSubmitBtn  = document.getElementById('auth-submit-btn');
const authEmailGroup = document.getElementById('auth-email-group');

function showAuthScreen(mode) {
  authScreen.classList.remove('hidden');
  document.body.classList.add('auth-locked');
  authError.textContent = '';
  authPassword.value = '';

  if (mode === 'unlock') {
    authSubtitle.textContent = 'Enter your password to unlock';
    authEmailGroup.style.display = 'none';
    authSubmitBtn.textContent = 'Unlock';
  } else {
    authSubtitle.textContent = 'Sign in to your journal';
    authEmailGroup.style.display = 'block';
    authSubmitBtn.textContent = 'Sign In';
  }
}

function hideAuthScreen() {
  authScreen.classList.add('hidden');
  document.body.classList.remove('auth-locked');
}

authForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const password = authPassword.value;
  if (!password) return;

  authError.textContent = '';
  authSubmitBtn.disabled = true;
  const isUnlock = authEmailGroup.style.display === 'none';
  authSubmitBtn.innerHTML = '<span class="spinner"></span>' + (isUnlock ? ' Unlocking…' : ' Signing in…');

  try {
    if (isUnlock) {
      await SunriseDB.unlockWithPassword(password);
    } else {
      const email = authEmail.value;
      if (!email) throw new Error('Please enter your email');
      await SunriseDB.signIn(email, password);
    }

    authPassword.value = '';
    hideAuthScreen();
    await postLoginInit();

  } catch (err) {
    authError.textContent = err.message || 'Sign in failed. Check your credentials.';
    authSubmitBtn.textContent = isUnlock ? 'Unlock' : 'Sign In';
  } finally {
    authSubmitBtn.disabled = false;
  }
});

async function postLoginInit() {
  // Check for localStorage migration
  const local = SunriseDB.hasLocalStorageEntries();
  if (local.found && local.count > 0) {
    showMigrationPrompt(local.count);
  }

  initToday();

  const user = SunriseDB.getUser();
  if (user) {
    document.getElementById('account-email').textContent = user.email;
  }
}

// ─── Migration ──────────────────────────────────────────────────────────────

function showMigrationPrompt(count) {
  const prompt = document.getElementById('migration-prompt');
  document.getElementById('migration-count').textContent =
    `Found ${count} journal entr${count === 1 ? 'y' : 'ies'} on this device.`;
  prompt.style.display = 'flex';
}

document.getElementById('migration-import').addEventListener('click', async () => {
  const btn = document.getElementById('migration-import');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Importing…';

  try {
    const count = await SunriseDB.importLocalStorageEntries();
    alert(`Successfully imported ${count} entries.`);
    initToday();
    renderHistory();
  } catch (err) {
    alert('Import failed: ' + err.message);
  } finally {
    document.getElementById('migration-prompt').style.display = 'none';
  }
});

document.getElementById('migration-skip').addEventListener('click', () => {
  document.getElementById('migration-prompt').style.display = 'none';
  localStorage.removeItem(STORAGE_KEY);
});

// ─── Boot ─────────────────────────────────────────────────────────────────

(async function boot() {
  const session = await SunriseDB.getSession();

  if (session && SunriseDB.getCryptoKey()) {
    // Fully authenticated with key in memory
    hideAuthScreen();
    await postLoginInit();
  } else if (session) {
    // Session exists but key is lost (page refresh)
    showAuthScreen('unlock');
  } else {
    // No session
    showAuthScreen('login');
  }
})();
