// ─── Sunrise App ─────────────────────────────────────────────────────────────

const STORAGE_KEY        = 'sunrise_entries';
const NOTIF_KEY          = 'sunrise_notif_enabled';
const TZ_KEY             = 'sunrise_timezone';
const CUSTOM_QUESTIONS_KEY = 'sunrise_custom_questions';

// ─── Timezone ────────────────────────────────────────────────────────────────

function getTimezone() {
  return localStorage.getItem(TZ_KEY) || Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function setTimezone(tz) {
  localStorage.setItem(TZ_KEY, tz);
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function todayKey() {
  const tz = getTimezone();
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return parts; // YYYY-MM-DD (en-CA locale gives this format)
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

// ─── Daily Question ───────────────────────────────────────────────────────────

function getCustomQuestions() {
  try { return JSON.parse(localStorage.getItem(CUSTOM_QUESTIONS_KEY)) || []; }
  catch { return []; }
}

function saveCustomQuestions(questions) {
  localStorage.setItem(CUSTOM_QUESTIONS_KEY, JSON.stringify(questions));
}

function getDailyQuestion() {
  const all = [...DAILY_QUESTIONS, ...getCustomQuestions()];
  const now      = new Date();
  const start    = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now - start) / 86400000);
  return all[dayOfYear % all.length];
}

// ─── Daily Quote ─────────────────────────────────────────────────────────────

function getRandomQuote() {
  return QUOTES[Math.floor(Math.random() * QUOTES.length)];
}

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
  refreshQuote();

  // Daily question
  document.getElementById('daily-question').textContent = getDailyQuestion();

  // Show today's saved entries count
  updateTodayEntryCount();

  // Always start with a fresh form for a new entry
  clearForm();
  document.getElementById('save-btn').textContent = 'Save Entry';

  // Wire up auto-resize on all wrapping textareas
  initAutoResize();
}

function refreshQuote() {
  const q = getRandomQuote();
  document.getElementById('daily-quote').textContent  = q.text;
  document.getElementById('quote-author').textContent = q.author ? `— ${q.author}` : '';
}

function updateTodayEntryCount() {
  const entries = getEntries();
  const todayEntries = entries[todayKey()] || [];
  const countEl = document.getElementById('today-entry-count');
  if (todayEntries.length > 0) {
    countEl.textContent = `${todayEntries.length} entr${todayEntries.length === 1 ? 'y' : 'ies'} saved today`;
    countEl.style.display = 'block';
  } else {
    countEl.style.display = 'none';
  }
}

function clearForm() {
  const form = document.getElementById('journal-form');
  const fields = [
    'feeling',
    'grateful1','grateful2','grateful3',
    'appreciated1','appreciated2','appreciated3',
    'forward1','forward2','forward3',
    'intention','awesome','reflection','thoughts'
  ];
  fields.forEach(name => {
    const el = form.elements[name];
    if (el) {
      el.value = '';
      if (el.classList.contains('field-wrap')) autoResize(el);
    }
  });
}

function fillForm(entry) {
  const form = document.getElementById('journal-form');
  const fields = [
    'feeling',
    'grateful1','grateful2','grateful3',
    'appreciated1','appreciated2','appreciated3',
    'forward1','forward2','forward3',
    'intention','awesome','reflection','thoughts'
  ];
  fields.forEach(name => {
    const el = form.elements[name];
    if (el && entry[name] !== undefined) {
      el.value = entry[name];
      if (el.classList.contains('field-wrap')) autoResize(el);
    }
  });
}

function readForm() {
  const form = document.getElementById('journal-form');
  const data = { savedAt: new Date().toISOString() };
  const fields = [
    'feeling',
    'grateful1','grateful2','grateful3',
    'appreciated1','appreciated2','appreciated3',
    'forward1','forward2','forward3',
    'intention','awesome','reflection','thoughts'
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

  // Check if the form has any content
  const hasContent = Object.entries(entry).some(([k, v]) => k !== 'savedAt' && v);
  if (!hasContent) return;

  const btn    = document.getElementById('save-btn');
  const status = document.getElementById('save-status');

  btn.disabled = true;
  btn.textContent = 'Saving…';

  try {
    await SunriseDB.appendEntry(todayKey(), entry);

    status.textContent = '✓ Saved & encrypted';
    status.classList.add('visible');
    setTimeout(() => status.classList.remove('visible'), 3000);

    // Clear form for a new entry and refresh quote
    clearForm();
    refreshQuote();
    updateTodayEntryCount();
    btn.textContent = 'Save Entry';

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
    const dayEntries = entries[dateKey];
    // Support both old single-entry format and new array format
    const entryArray = Array.isArray(dayEntries) ? dayEntries : [dayEntries];

    entryArray.forEach((entry, idx) => {
      const card  = document.createElement('button');
      card.className    = 'history-card';
      const entryLabel = entryArray.length > 1 ? ` (entry ${idx + 1})` : '';
      card.setAttribute('aria-label', `Entry for ${formatDisplayDate(dateKey)}${entryLabel}`);

      const preview = [
        entry.grateful1, entry.appreciated1, entry.intention
      ].filter(Boolean).join(' · ') || 'No preview available';

      const timeStr = entry.savedAt
        ? new Date(entry.savedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
        : '';

      card.innerHTML = `
        <div class="history-date">${formatDisplayDate(dateKey)}${entryArray.length > 1 ? ` <span class="history-entry-time">${timeStr}</span>` : ''}</div>
        <div class="history-preview">${escapeHTML(preview)}</div>
      `;

      card.addEventListener('click', () => openEntry(dateKey, entry));
      list.appendChild(card);
    });
  });
}

// ─── Entry Modal ─────────────────────────────────────────────────────────────

function openEntry(dateKey, entry) {
  const modal   = document.getElementById('entry-modal');
  const content = document.getElementById('modal-content');

  const sections = [
    { label: '🫧 Feeling',          items: [entry.feeling] },
    { label: '🌿 Gratitude',        items: [entry.grateful1, entry.grateful2, entry.grateful3] },
    { label: '✨ Appreciation',     items: [entry.appreciated1, entry.appreciated2, entry.appreciated3] },
    { label: '🌅 Looking Forward',  items: [entry.forward1, entry.forward2, entry.forward3] },
    { label: '🎯 Intention',        items: [entry.intention] },
    { label: '💛 You Are Awesome',  items: [entry.awesome] },
    { label: '? Reflection',        items: [entry.reflection], multiline: true },
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

  // Custom questions
  renderCustomQuestions();
  const newQuestionInput = document.getElementById('new-question-input');
  const addQuestionBtn   = document.getElementById('add-question-btn');
  newQuestionInput.addEventListener('input', () => autoResize(newQuestionInput));
  addQuestionBtn.addEventListener('click', () => {
    const text = newQuestionInput.value.trim();
    if (!text) return;
    const qs = getCustomQuestions();
    qs.push(text);
    saveCustomQuestions(qs);
    newQuestionInput.value = '';
    autoResize(newQuestionInput);
    renderCustomQuestions();
  });

  // Timezone
  const tzSelect = document.getElementById('tz-select');
  const tzStatus = document.getElementById('tz-status');
  tzSelect.value = getTimezone();
  tzSelect.addEventListener('change', () => {
    setTimezone(tzSelect.value);
    tzStatus.textContent = `✓ Timezone set to ${tzSelect.value}`;
    tzStatus.classList.add('visible');
    setTimeout(() => tzStatus.classList.remove('visible'), 3000);
    // Refresh the today view to use the new timezone
    document.getElementById('today-date').textContent = formatDisplayDate(todayKey());
    updateTodayEntryCount();
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

// ─── Custom Questions ─────────────────────────────────────────────────────────

function renderCustomQuestions() {
  const list      = document.getElementById('custom-questions-list');
  const questions = getCustomQuestions();

  if (questions.length === 0) {
    list.innerHTML = '';
    return;
  }

  list.innerHTML = questions.map((q, i) => `
    <div class="custom-question-item">
      <span class="custom-question-text">${escapeHTML(q)}</span>
      <button class="custom-question-delete" data-index="${i}" aria-label="Delete question">✕</button>
    </div>
  `).join('');

  list.querySelectorAll('.custom-question-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index, 10);
      const qs  = getCustomQuestions();
      qs.splice(idx, 1);
      saveCustomQuestions(qs);
      renderCustomQuestions();
    });
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

  // Wire up the Settings install button
  const btn = document.getElementById('install-btn');
  if (btn) {
    btn.style.display = 'inline-flex';
    document.getElementById('install-hint').style.display = 'none';
    btn.addEventListener('click', () => triggerInstallPrompt());
  }

  // If the user is already logged in when the event fires, show the banner
  if (!document.body.classList.contains('auth-locked')) {
    showInstallBanner();
  }
});

function showInstallBanner() {
  if (localStorage.getItem('sunrise_install_dismissed')) return;
  if (window.matchMedia('(display-mode: standalone)').matches) return;
  if (!deferredInstallPrompt) return;

  const banner = document.getElementById('install-banner');
  if (!banner) return;
  banner.style.display = 'flex';

  document.getElementById('install-banner-btn').addEventListener('click', () => {
    banner.style.display = 'none';
    triggerInstallPrompt();
  });

  document.getElementById('install-banner-dismiss').addEventListener('click', () => {
    banner.style.display = 'none';
    localStorage.setItem('sunrise_install_dismissed', 'true');
  });
}

async function triggerInstallPrompt() {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  if (outcome === 'accepted') {
    localStorage.setItem('sunrise_install_dismissed', 'true');
    const banner = document.getElementById('install-banner');
    if (banner) banner.style.display = 'none';
    const btn = document.getElementById('install-btn');
    if (btn) {
      btn.style.display = 'none';
      const hint = document.getElementById('install-hint');
      hint.style.display = 'block';
      hint.textContent = '✓ Sunrise added to your home screen!';
    }
  }
}

// ─── Service Worker Registration ──────────────────────────────────────────────

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then(reg => {
    console.log('SW registered:', reg.scope);

    if (localStorage.getItem(NOTIF_KEY) === 'true' && Notification.permission === 'granted') {
      navigator.serviceWorker.ready.then(() => scheduleNotifications());
    }
  }).catch(err => console.warn('SW registration failed:', err));
}

// ─── Auto-resize textareas ────────────────────────────────────────────────────

function autoResize(el) {
  el.style.height = '0px';
  el.style.height = el.scrollHeight + 'px';
}

function initAutoResize() {
  document.querySelectorAll('textarea.field-wrap').forEach(el => {
    el.addEventListener('input', () => autoResize(el));
    autoResize(el);
  });
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

  // Show install banner if the browser supports PWA installation
  showInstallBanner();
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
