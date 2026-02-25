// ─── Sunrise App ─────────────────────────────────────────────────────────────

const STORAGE_KEY          = 'sunrise_entries';
const NOTIF_KEY            = 'sunrise_notif_enabled';
const TZ_KEY               = 'sunrise_timezone';
const CUSTOM_QUESTIONS_KEY = 'sunrise_custom_questions';
const FIELD_SCHEMA_KEY     = 'sunrise_field_schema';
const USER_NAME_KEY        = 'sunrise_user_name';

// ─── Default field schema ─────────────────────────────────────────────────────

const DEFAULT_FIELD_SCHEMA = [
  { id: 'feeling',     label: 'How are you feeling?', icon: '🫧', type: 'text',
    placeholder: "Right now I'm feeling…",      hint: '' },
  { id: 'grateful',    label: 'Gratitude',             icon: '🌿', type: 'list',
    placeholder: "I'm grateful for…",           hint: 'Three things you are grateful for today' },
  { id: 'appreciated', label: 'Appreciation',          icon: '✨', type: 'list',
    placeholder: 'I appreciated…',              hint: 'Three things you appreciated recently' },
  { id: 'forward',     label: 'Looking Forward',       icon: '🌅', type: 'list',
    placeholder: "I'm looking forward to…",    hint: "Three things you're looking forward to" },
  { id: 'intention',   label: 'Intention',             icon: '🎯', type: 'text',
    placeholder: 'Today I intend to…',          hint: 'One intention for the day' },
  { id: 'awesome',     label: 'You Are Awesome',       icon: '💛', type: 'text',
    placeholder: 'I am awesome because…',       hint: 'One reason you are awesome' },
  { id: 'reflection',  label: 'Reflection',            icon: '❓', type: 'reflection',
    placeholder: 'My reflection…',              hint: '' },
  { id: 'thoughts',    label: 'On My Mind',            icon: '💭', type: 'textarea',
    placeholder: "What's on your mind today…",  hint: 'Any thoughts, feelings, or reflections' },
];

// ─── Field Schema ─────────────────────────────────────────────────────────────

function getFieldSchema() {
  try { return JSON.parse(localStorage.getItem(FIELD_SCHEMA_KEY)) || DEFAULT_FIELD_SCHEMA; }
  catch { return DEFAULT_FIELD_SCHEMA; }
}

function saveFieldSchema(schema) {
  localStorage.setItem(FIELD_SCHEMA_KEY, JSON.stringify(schema));
}

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

// ─── User Name & Greeting ─────────────────────────────────────────────────────

function getUserName() {
  return localStorage.getItem(USER_NAME_KEY) || '';
}

function setUserName(name) {
  localStorage.setItem(USER_NAME_KEY, name.trim());
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function updateGreeting() {
  const el = document.getElementById('greeting');
  if (!el) return;
  const name = getUserName();
  el.textContent = name ? `${getGreeting()}, ${name} ☀️` : '';
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
  document.getElementById('today-date').textContent = formatDisplayDate(todayKey());
  updateGreeting();
  refreshQuote();
  renderJournalForm();
  updateTodayEntryCount();
  clearForm();
  document.getElementById('save-btn').textContent = 'Save Entry';
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

// ─── Dynamic Form Rendering ───────────────────────────────────────────────────

function renderJournalForm() {
  const container = document.getElementById('journal-fields');
  const schema    = getFieldSchema();
  container.innerHTML = '';

  schema.forEach(field => {
    const section = document.createElement('section');

    if (field.type === 'reflection') {
      section.className = 'card question-card';
      section.innerHTML = `
        <div class="question-mark">?</div>
        <p class="question-label">Reflect on this</p>
        <p id="daily-question" class="question-text">${escapeHTML(getDailyQuestion())}</p>
        <textarea class="field field-wrap question-reflection" name="${field.id}" placeholder="${escapeHTML(field.placeholder)}" autocomplete="off" rows="1"></textarea>
      `;
    } else if (field.type === 'list') {
      section.className = 'card';
      section.innerHTML = `
        <h2 class="section-title"><span class="section-icon">${escapeHTML(field.icon)}</span> ${escapeHTML(field.label)}</h2>
        ${field.hint ? `<p class="section-hint">${escapeHTML(field.hint)}</p>` : ''}
        <div class="field-group">
          <textarea class="field field-wrap" name="${field.id}1" placeholder="${escapeHTML(field.placeholder)}" autocomplete="off" rows="1"></textarea>
          <textarea class="field field-wrap" name="${field.id}2" placeholder="${escapeHTML(field.placeholder)}" autocomplete="off" rows="1"></textarea>
          <textarea class="field field-wrap" name="${field.id}3" placeholder="${escapeHTML(field.placeholder)}" autocomplete="off" rows="1"></textarea>
        </div>
      `;
    } else if (field.type === 'textarea') {
      section.className = 'card';
      section.innerHTML = `
        <h2 class="section-title"><span class="section-icon">${escapeHTML(field.icon)}</span> ${escapeHTML(field.label)}</h2>
        ${field.hint ? `<p class="section-hint">${escapeHTML(field.hint)}</p>` : ''}
        <textarea class="field textarea" name="${field.id}" placeholder="${escapeHTML(field.placeholder)}" rows="5"></textarea>
      `;
    } else {
      // text (default)
      section.className = 'card';
      section.innerHTML = `
        <h2 class="section-title"><span class="section-icon">${escapeHTML(field.icon)}</span> ${escapeHTML(field.label)}</h2>
        ${field.hint ? `<p class="section-hint">${escapeHTML(field.hint)}</p>` : ''}
        <textarea class="field field-wrap" name="${field.id}" placeholder="${escapeHTML(field.placeholder)}" autocomplete="off" rows="1"></textarea>
      `;
    }

    container.appendChild(section);
  });

  // Wire auto-resize for these fresh elements
  container.querySelectorAll('textarea.field-wrap').forEach(el => {
    el.addEventListener('input', () => autoResize(el));
    autoResize(el);
  });
}

// ─── Form Helpers ─────────────────────────────────────────────────────────────

function getFormFieldNames() {
  return getFieldSchema().flatMap(f =>
    f.type === 'list' ? [`${f.id}1`, `${f.id}2`, `${f.id}3`] : [f.id]
  );
}

function clearForm() {
  const form = document.getElementById('journal-form');
  getFormFieldNames().forEach(name => {
    const el = form.elements[name];
    if (el) {
      el.value = '';
      if (el.classList.contains('field-wrap')) autoResize(el);
    }
  });
}

function fillForm(entry) {
  const form = document.getElementById('journal-form');
  getFormFieldNames().forEach(name => {
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
  getFormFieldNames().forEach(name => {
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

// ─── PDF / Print ──────────────────────────────────────────────────────────────

document.getElementById('print-blank-btn').addEventListener('click', () => triggerPrint(false));
document.getElementById('print-filled-btn').addEventListener('click', () => triggerPrint(true));

function buildPrintHTML(filled) {
  const schema = getFieldSchema();
  const date   = formatDisplayDate(todayKey());
  const name   = getUserName();
  const entry  = filled
    ? ((getEntries()[todayKey()] || []).slice(-1)[0] || null)
    : null;

  let html = `
    <div class="pv-header">
      <div class="pv-title">☀️ Sunrise Journal</div>
      <div class="pv-date">${escapeHTML(date)}</div>
      ${name ? `<div class="pv-greeting">${escapeHTML(getGreeting())}, ${escapeHTML(name)}</div>` : ''}
    </div>
  `;

  if (filled && !entry) {
    html += `<p class="pv-empty">No entry saved for today yet.</p>`;
  } else {
    schema.forEach(field => {
      if (field.type === 'list') {
        const items = entry
          ? [entry[field.id + '1'], entry[field.id + '2'], entry[field.id + '3']].filter(Boolean)
          : [];
        if (filled && items.length === 0) return;

        html += `<div class="pv-section"><div class="pv-label">${escapeHTML(field.icon)} ${escapeHTML(field.label)}</div>`;
        if (filled) {
          items.forEach((item, i) => {
            html += `<div class="pv-list-item"><span>${i + 1}.</span> ${escapeHTML(item)}</div>`;
          });
        } else {
          html += `<div class="pv-lines"><div class="pv-line"></div><div class="pv-line"></div><div class="pv-line"></div></div>`;
        }
        html += `</div>`;

      } else if (field.type === 'reflection') {
        const val = entry ? (entry[field.id] || '') : '';
        if (filled && !val) return;

        html += `<div class="pv-section"><div class="pv-label">${escapeHTML(field.icon)} ${escapeHTML(field.label)}</div>`;
        html += `<div class="pv-question">${escapeHTML(getDailyQuestion())}</div>`;
        if (filled) {
          html += `<div class="pv-value">${escapeHTML(val).replace(/\n/g, '<br>')}</div>`;
        } else {
          html += `<div class="pv-lines"><div class="pv-line"></div><div class="pv-line"></div></div>`;
        }
        html += `</div>`;

      } else {
        const val = entry ? (entry[field.id] || '') : '';
        if (filled && !val) return;
        const lineCount = field.type === 'textarea' ? 4 : 1;

        html += `<div class="pv-section"><div class="pv-label">${escapeHTML(field.icon)} ${escapeHTML(field.label)}</div>`;
        if (filled) {
          html += `<div class="pv-value">${escapeHTML(val).replace(/\n/g, '<br>')}</div>`;
        } else {
          html += `<div class="pv-lines">`;
          for (let i = 0; i < lineCount; i++) html += `<div class="pv-line"></div>`;
          html += `</div>`;
        }
        html += `</div>`;
      }
    });
  }

  return html;
}

function triggerPrint(filled) {
  document.getElementById('print-view').innerHTML = buildPrintHTML(filled);
  window.print();
}

// ─── History View ─────────────────────────────────────────────────────────────

function getEntryPreview(entry) {
  const schema = getFieldSchema();
  const bits = [];
  for (const field of schema) {
    if (bits.length >= 3) break;
    if (field.type === 'list') {
      const v = entry[field.id + '1'];
      if (v) bits.push(v);
    } else if (field.type !== 'textarea' && field.type !== 'reflection') {
      const v = entry[field.id];
      if (v) bits.push(v);
    }
  }
  return bits.join(' · ') || 'No preview available';
}

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

      const preview = getEntryPreview(entry);

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
  const schema  = getFieldSchema();

  let html = `<div class="modal-date">${formatDisplayDate(dateKey)}</div>`;

  schema.forEach(field => {
    if (field.type === 'list') {
      const items = [
        entry[field.id + '1'],
        entry[field.id + '2'],
        entry[field.id + '3'],
      ].filter(Boolean);
      if (!items.length) return;

      html += `<div class="modal-section">
        <div class="modal-section-title">${escapeHTML(field.icon)} ${escapeHTML(field.label)}</div>`;
      items.forEach(item => {
        html += `<div class="modal-item">${escapeHTML(item)}</div>`;
      });
      html += `</div>`;
    } else {
      const val = entry[field.id];
      if (!val) return;

      html += `<div class="modal-section">
        <div class="modal-section-title">${escapeHTML(field.icon)} ${escapeHTML(field.label)}</div>`;
      if (field.type === 'textarea' || field.type === 'reflection') {
        html += `<div class="modal-thought">${escapeHTML(val).replace(/\n/g, '<br>')}</div>`;
      } else {
        html += `<div class="modal-item">${escapeHTML(val)}</div>`;
      }
      html += `</div>`;
    }
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
  if (e.key === 'Escape') {
    closeModal();
    closeFieldEditor();
  }
});

// ─── Settings View ────────────────────────────────────────────────────────────

let settingsInitialized = false;

function initSettings() {
  if (settingsInitialized) return;
  settingsInitialized = true;

  // ── Personal / Name ──────────────────────────────────────────────────────
  const nameInput  = document.getElementById('user-name-input');
  const nameStatus = document.getElementById('name-status');
  nameInput.value  = getUserName();
  nameInput.addEventListener('input', () => {
    setUserName(nameInput.value);
    updateGreeting();
    nameStatus.textContent = '✓ Saved';
    nameStatus.classList.add('visible');
    setTimeout(() => nameStatus.classList.remove('visible'), 2000);
  });

  // ── Journal Fields ───────────────────────────────────────────────────────
  renderFieldSettings();
  document.getElementById('add-field-btn').addEventListener('click', () => openFieldEditor('add', -1));

  // Field editor modal wiring (one-time)
  document.getElementById('field-editor-close').addEventListener('click', closeFieldEditor);
  document.getElementById('field-editor-backdrop').addEventListener('click', closeFieldEditor);

  const labelEl = document.getElementById('field-editor-label');
  const iconEl  = document.getElementById('field-editor-icon');
  const suggEl  = document.getElementById('field-editor-suggestion');

  labelEl.addEventListener('input', () => {
    if (!labelEl.value.trim()) { suggEl.textContent = ''; return; }
    const s = suggestIcon(labelEl.value);
    iconEl.value = s;
    suggEl.textContent = (s !== '📝') ? `Suggested: ${s}` : '';
  });

  document.getElementById('field-editor-save').addEventListener('click', saveFieldEditorChanges);

  // ── Notifications ────────────────────────────────────────────────────────
  const toggle = document.getElementById('notif-toggle');
  const status = document.getElementById('notif-status');

  toggle.checked = localStorage.getItem(NOTIF_KEY) === 'true';

  toggle.addEventListener('change', async () => {
    if (toggle.checked) {
      const granted = await requestNotificationPermission();
      if (granted) {
        localStorage.setItem(NOTIF_KEY, 'true');
        scheduleNotifications();
        status.textContent = "✓ Notifications enabled. You'll be reminded at 7am.";
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

  // ── Custom Questions ─────────────────────────────────────────────────────
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

  // ── Timezone ─────────────────────────────────────────────────────────────
  const tzSelect = document.getElementById('tz-select');
  const tzStatus = document.getElementById('tz-status');
  tzSelect.value = getTimezone();
  tzSelect.addEventListener('change', () => {
    setTimezone(tzSelect.value);
    tzStatus.textContent = `✓ Timezone set to ${tzSelect.value}`;
    tzStatus.classList.add('visible');
    setTimeout(() => tzStatus.classList.remove('visible'), 3000);
    document.getElementById('today-date').textContent = formatDisplayDate(todayKey());
    updateTodayEntryCount();
  });

  // ── Export / Clear / Logout ───────────────────────────────────────────────
  document.getElementById('export-btn').addEventListener('click', exportData);

  document.getElementById('clear-btn').addEventListener('click', async () => {
    if (confirm('This will permanently delete all your journal entries from the cloud. Are you sure?')) {
      await SunriseDB.deleteAllEntries();
      alert('All data cleared.');
    }
  });

  document.getElementById('logout-btn').addEventListener('click', async () => {
    if (confirm('Sign out of Sunrise?')) {
      await SunriseDB.signOut();
      location.reload();
    }
  });
}

// ─── Field Schema Settings UI ─────────────────────────────────────────────────

function renderFieldSettings() {
  const list   = document.getElementById('field-schema-list');
  const schema = getFieldSchema();

  if (!schema.length) {
    list.innerHTML = '<p class="section-hint" style="margin-bottom:8px;">No fields yet. Add one below.</p>';
    return;
  }

  list.innerHTML = schema.map((f, i) => {
    const typeLabel = { text: 'Text', list: '3-list', textarea: 'Long text', reflection: 'Reflection' }[f.type] || f.type;
    return `
      <div class="fs-item">
        <span class="fs-icon">${escapeHTML(f.icon)}</span>
        <div class="fs-info">
          <span class="fs-label">${escapeHTML(f.label)}</span>
          <span class="fs-type">${typeLabel}</span>
        </div>
        <div class="fs-actions">
          <button class="fs-btn" data-action="up"   data-i="${i}" aria-label="Move up"   ${i === 0 ? 'disabled' : ''}>↑</button>
          <button class="fs-btn" data-action="down" data-i="${i}" aria-label="Move down" ${i === schema.length - 1 ? 'disabled' : ''}>↓</button>
          <button class="fs-btn" data-action="edit" data-i="${i}" aria-label="Edit">✎</button>
          <button class="fs-btn fs-btn-del" data-action="del" data-i="${i}" aria-label="Delete">✕</button>
        </div>
      </div>`;
  }).join('');

  list.querySelectorAll('.fs-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx    = parseInt(btn.dataset.i, 10);
      const action = btn.dataset.action;
      const s      = getFieldSchema();

      if (action === 'up' && idx > 0) {
        [s[idx - 1], s[idx]] = [s[idx], s[idx - 1]];
        saveFieldSchema(s); renderFieldSettings(); renderJournalForm();
      } else if (action === 'down' && idx < s.length - 1) {
        [s[idx], s[idx + 1]] = [s[idx + 1], s[idx]];
        saveFieldSchema(s); renderFieldSettings(); renderJournalForm();
      } else if (action === 'edit') {
        openFieldEditor('edit', idx);
      } else if (action === 'del') {
        const f = s[idx];
        if (confirm(`Remove "${f.label}" from your journal?`)) {
          s.splice(idx, 1);
          saveFieldSchema(s); renderFieldSettings(); renderJournalForm();
        }
      }
    });
  });
}

// ─── Field Editor Modal ───────────────────────────────────────────────────────

let _fieldEditorMode  = 'add';
let _fieldEditorIndex = -1;

function openFieldEditor(mode, index) {
  _fieldEditorMode  = mode;
  _fieldEditorIndex = index;

  const titleEl = document.getElementById('field-editor-title');
  const iconEl  = document.getElementById('field-editor-icon');
  const labelEl = document.getElementById('field-editor-label');
  const typeEl  = document.getElementById('field-editor-type');
  const hintEl  = document.getElementById('field-editor-hint');
  const suggEl  = document.getElementById('field-editor-suggestion');

  suggEl.textContent = '';

  if (mode === 'edit' && index >= 0) {
    const f = getFieldSchema()[index];
    titleEl.textContent = 'Edit Field';
    iconEl.value  = f.icon;
    labelEl.value = f.label;
    // Reflection type is shown as 'text' in the UI; its type change is locked
    typeEl.value    = (f.type === 'reflection') ? 'text' : f.type;
    typeEl.disabled = (f.type === 'reflection');
    hintEl.value  = f.hint || '';
  } else {
    titleEl.textContent = 'Add Field';
    iconEl.value  = '📝';
    labelEl.value = '';
    typeEl.value  = 'text';
    typeEl.disabled = false;
    hintEl.value  = '';
  }

  document.getElementById('field-editor-modal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  labelEl.focus();
}

function closeFieldEditor() {
  document.getElementById('field-editor-modal').style.display = 'none';
  document.body.style.overflow = '';
}

function saveFieldEditorChanges() {
  const icon  = (document.getElementById('field-editor-icon').value.trim()  || '📝');
  const label = document.getElementById('field-editor-label').value.trim();
  const type  = document.getElementById('field-editor-type').value;
  const hint  = document.getElementById('field-editor-hint').value.trim();

  if (!label) {
    document.getElementById('field-editor-label').focus();
    return;
  }

  const schema = getFieldSchema();

  if (_fieldEditorMode === 'add') {
    schema.push({
      id:          generateFieldId(label, schema),
      label, icon, type, hint,
      placeholder: `${label}…`,
    });
  } else {
    const orig = schema[_fieldEditorIndex];
    schema[_fieldEditorIndex] = {
      ...orig,
      label, icon,
      // Preserve 'reflection' type — it controls the question card
      type:        (orig.type === 'reflection') ? 'reflection' : type,
      hint,
      placeholder: `${label}…`,
    };
  }

  saveFieldSchema(schema);
  renderFieldSettings();
  renderJournalForm();
  closeFieldEditor();
}

function generateFieldId(label, schema) {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'field';
  const existing = new Set((schema || getFieldSchema()).map(f => f.id));
  let id = base, n = 2;
  while (existing.has(id)) { id = base + n; n++; }
  return id;
}

function suggestIcon(label) {
  const l = label.toLowerCase();
  const map = [
    [['sleep', 'rest', 'tired', 'dream'],                    '😴'],
    [['exercise', 'workout', 'fitness', 'gym', 'run', 'sport'], '🏃'],
    [['eat', 'food', 'meal', 'diet', 'nutrition'],            '🥗'],
    [['water', 'hydrat', 'drink'],                            '💧'],
    [['money', 'finance', 'budget', 'spend', 'save'],         '💰'],
    [['goal', 'achieve', 'success', 'win'],                   '🏆'],
    [['learn', 'study', 'read', 'book', 'education'],         '📚'],
    [['friend', 'social', 'connect', 'people'],               '🤝'],
    [['family', 'home', 'house'],                             '🏠'],
    [['love', 'heart', 'care', 'partner'],                    '❤️'],
    [['stress', 'anxiety', 'worry', 'fear'],                  '😰'],
    [['happy', 'joy', 'positive', 'smile', 'fun'],            '😊'],
    [['create', 'art', 'design', 'draw', 'music', 'write'],   '🎨'],
    [['work', 'job', 'career', 'professional', 'office'],     '💼'],
    [['nature', 'outdoor', 'walk', 'garden', 'plant'],        '🌱'],
    [['travel', 'adventure', 'explore', 'trip'],              '✈️'],
    [['breath', 'meditat', 'mindful', 'calm', 'peace'],       '🧘'],
    [['reflect', 'think', 'thought', 'mind'],                 '🧠'],
    [['gratitude', 'grateful', 'thank'],                      '🙏'],
    [['mood', 'feeling', 'emotion'],                          '😊'],
    [['intention', 'plan', 'purpose', 'focus'],               '🎯'],
    [['health', 'body', 'wellbeing', 'wellness'],             '💪'],
    [['challenge', 'hard', 'difficult', 'struggle'],          '💪'],
    [['win', 'celebrate', 'proud', 'accomplish'],             '🎉'],
  ];
  for (const [keys, emoji] of map) {
    if (keys.some(k => l.includes(k))) return emoji;
  }
  return '📝';
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

// ─── Export (JSON) ────────────────────────────────────────────────────────────

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

  // Reload the page when a new service worker activates (picks up fresh assets)
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data && event.data.type === 'SW_UPDATED') {
      window.location.reload();
    }
  });
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
