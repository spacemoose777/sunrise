// ─── Sunrise Trends View ──────────────────────────────────────────────────────
// All analysis runs on-device using entries already decrypted in memory.
// No entry data is ever sent to an external service.

// Mood valence map — custom moods default to 3 (neutral)
const MOOD_VALENCE = {
  'Happy': 5, 'Grateful': 5, 'Joyful': 5,
  'Content': 4, 'Calm': 4, 'Energised': 4, 'Focused': 4,
  'Tired': 2,
  'Anxious': 1, 'Stressed': 1, 'Irritated': 1, 'Sad': 1,
};

const TREND_PERIODS = [
  { days: 7,   label: '7d'  },
  { days: 14,  label: '14d' },
  { days: 30,  label: '30d' },
  { days: 90,  label: '3m'  },
  { days: 180, label: '6m'  },
  { days: 365, label: '1y'  },
];

const STOP_WORDS = new Set([
  'i','me','my','myself','we','our','us','you','your','yourself','it','its','itself',
  'he','him','his','she','her','they','them','their','this','that','these','those',
  'a','an','the','and','but','or','nor','so','yet','for','in','on','at','to','from',
  'of','with','by','about','as','into','through','during','before','after','above',
  'below','up','down','out','off','over','under','again','further','then','once',
  'is','are','was','were','be','been','being','have','has','had','do','does','did',
  'will','would','could','should','may','might','shall','can','need','dare','used',
  'not','no','nor','very','just','also','more','most','some','any','each','all',
  'both','few','same','too','here','there','when','where','why','how','what','which',
  'who','whom','am','if','than','only','own','such','while','although','though',
  'because','since','until','unless','however','feel','felt','feels','think','know',
  'want','need','went','come','came','still','really','much','make','made','even',
  'like','get','got','one','two','day','today','time','back','good','well','quite',
  'going','went','been','got','something','nothing','everything','anything','way',
  'thing','things','little','every','always','never','sometimes','often','maybe',
]);

let _trendDays = 30;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _getDates(days) {
  return Array.from({ length: days }, (_, i) => offsetDate(todayKey(), i - days + 1));
}

function _moodScore(label) {
  return MOOD_VALENCE[label] ?? 3;
}

function _dayMoodScore(logs) {
  if (!logs?.length) return null;
  const scores = logs.flatMap(l =>
    (Array.isArray(l.mood) ? l.mood : [l.mood]).map(_moodScore)
  );
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

function _barRow(label, widthPct, color, statHtml) {
  return `<div class="t-bar-row">
    <span class="t-bar-label">${label}</span>
    <div class="t-bar-track"><div class="t-bar-fill" style="width:${Math.max(2, widthPct)}%;background:${color}"></div></div>
    <span class="t-bar-stat">${statHtml}</span>
  </div>`;
}

function _emptyCard(title, msg) {
  return `<section class="card"><h2 class="section-title">${title}</h2><p class="section-hint">${msg}</p></section>`;
}

function _valenceColor(score) {
  if (score === null) return 'var(--bg-card-2)';
  if (score >= 4.2) return 'rgba(72, 199, 116, 0.28)';
  if (score >= 3.2) return 'rgba(72, 199, 116, 0.13)';
  if (score >= 2.2) return 'rgba(240, 168, 64, 0.22)';
  return 'rgba(224, 92, 92, 0.25)';
}

// ─── initTrends ───────────────────────────────────────────────────────────────

function initTrends() {
  // Wire period buttons (once — guard against duplicate listeners)
  if (!document.getElementById('trends-period-row').dataset.wired) {
    document.getElementById('trends-period-row').dataset.wired = '1';
    document.querySelectorAll('.period-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        _trendDays = parseInt(btn.dataset.days);
        document.querySelectorAll('.period-btn').forEach(b => b.classList.toggle('active', b === btn));
        _renderTrendsContent();
      });
    });
  }
  // Mark active period
  document.querySelectorAll('.period-btn').forEach(b =>
    b.classList.toggle('active', parseInt(b.dataset.days) === _trendDays)
  );
  _renderTrendsContent();
}

function _renderTrendsContent() {
  const entries     = SunriseDB.getEntries();
  const habitSchema = getHabitSchema();
  const fieldSchema = getFieldSchema();
  const dates       = _getDates(_trendDays);

  const moodByDay  = {};
  const habitByDay = {};
  for (const d of dates) {
    const mr = entries['mood:' + d];
    moodByDay[d] = Array.isArray(mr) ? mr : (mr ? [mr] : []);
    const hr = entries['habits:' + d];
    const ho = Array.isArray(hr) ? hr[0] : hr;
    habitByDay[d] = (ho && typeof ho === 'object') ? ho : {};
  }

  document.getElementById('trends-content').innerHTML = [
    _sectionOverview(dates, moodByDay, habitByDay, habitSchema),
    _sectionMoodFreq(dates, moodByDay),
    _sectionHabits(dates, habitByDay, habitSchema),
    _sectionCorrelation(dates, moodByDay, habitByDay, habitSchema),
    _trendDays <= 30 ? _sectionDailyGrid(dates, moodByDay, habitByDay, habitSchema) : _sectionWeeklyGrid(dates, moodByDay, habitByDay, habitSchema),
    _sectionWords(dates, entries, fieldSchema),
  ].join('');
}

// ─── Section: Overview stats ──────────────────────────────────────────────────

function _sectionOverview(dates, moodByDay, habitByDay, habitSchema) {
  const moodDays  = dates.filter(d => moodByDay[d].length).length;
  const totalLogs = dates.reduce((n, d) => n + moodByDay[d].length, 0);
  const trackedDates = dates.filter(d => Object.keys(habitByDay[d]).length);

  let avgMood = null;
  const scoredDays = dates.filter(d => _dayMoodScore(moodByDay[d]) !== null);
  if (scoredDays.length) {
    avgMood = scoredDays.reduce((s, d) => s + _dayMoodScore(moodByDay[d]), 0) / scoredDays.length;
  }

  let avgHabits = null;
  if (habitSchema.length && trackedDates.length) {
    avgHabits = Math.round(
      trackedDates.reduce((n, d) =>
        n + habitSchema.filter(h => habitByDay[d][h.id]?.done).length, 0
      ) / trackedDates.length / habitSchema.length * 100
    );
  }

  const moodLabel = avgMood !== null
    ? avgMood >= 4.2 ? 'Great' : avgMood >= 3.2 ? 'Good' : avgMood >= 2.2 ? 'Mixed' : 'Tough'
    : '—';

  const stats = [
    { v: totalLogs,  l: 'mood logs' },
    { v: moodDays,   l: 'days tracked' },
    { v: avgMood !== null ? moodLabel : '—', l: 'avg mood' },
    { v: avgHabits !== null ? `${avgHabits}%` : '—', l: 'habits done' },
  ];

  return `<section class="card trends-overview">
    ${stats.map(s => `<div class="ov-stat"><span class="ov-val">${s.v}</span><span class="ov-lbl">${s.l}</span></div>`).join('')}
  </section>`;
}

// ─── Section: Mood frequency ──────────────────────────────────────────────────

function _sectionMoodFreq(dates, moodByDay) {
  const counts = {};
  let total = 0;
  for (const d of dates) {
    for (const log of moodByDay[d]) {
      for (const m of (Array.isArray(log.mood) ? log.mood : [log.mood])) {
        counts[m] = (counts[m] || 0) + 1;
        total++;
      }
    }
  }
  if (!total) return _emptyCard('<span class="section-icon">😊</span> Mood Frequency', 'No mood logs in this period.');

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const max = sorted[0][1];

  const bars = sorted.map(([label, count]) => {
    const pct   = Math.round(count / total * 100);
    const w     = Math.round(count / max * 100);
    const score = _moodScore(label);
    const col   = score >= 4 ? 'var(--accent)' : score <= 2 ? '#e05c5c' : '#f0a840';
    return _barRow(escapeHTML(label), w, col, `${count} <span class="t-pct">(${pct}%)</span>`);
  }).join('');

  return `<section class="card">
    <h2 class="section-title"><span class="section-icon">😊</span> Mood Frequency</h2>
    <p class="section-hint t-subhead">${total} logs · ${dates.filter(d => moodByDay[d].length).length} days</p>
    ${bars}
  </section>`;
}

// ─── Section: Habit completion ────────────────────────────────────────────────

function _sectionHabits(dates, habitByDay, schema) {
  if (!schema.length) return '';
  const tracked = dates.filter(d => Object.keys(habitByDay[d]).length);
  if (!tracked.length) return _emptyCard('<span class="section-icon">✅</span> Habit Completion', 'No habit data in this period.');

  const rows = schema.map(h => {
    const done = tracked.filter(d => habitByDay[d][h.id]?.done).length;
    const pct  = Math.round(done / tracked.length * 100);
    const col  = pct >= 70 ? 'var(--accent)' : pct >= 40 ? '#f0a840' : '#e05c5c';
    return _barRow(`${escapeHTML(h.icon)} ${escapeHTML(h.label)}`, pct, col, `${pct}%`);
  }).join('');

  return `<section class="card">
    <h2 class="section-title"><span class="section-icon">✅</span> Habit Completion</h2>
    <p class="section-hint t-subhead">% of ${tracked.length} tracked days each habit was done</p>
    ${rows}
  </section>`;
}

// ─── Section: Mood × Habits correlation ──────────────────────────────────────

function _sectionCorrelation(dates, moodByDay, habitByDay, schema) {
  if (!schema.length) return '';

  const corrs = schema.map(h => {
    const done = dates.filter(d =>
      habitByDay[d][h.id]?.done && moodByDay[d].length && Object.keys(habitByDay[d]).length
    );
    const skip = dates.filter(d =>
      !habitByDay[d][h.id]?.done && moodByDay[d].length && Object.keys(habitByDay[d]).length
    );
    if (done.length < 2 || skip.length < 2) return null;

    const avgDone = done.reduce((s, d) => s + _dayMoodScore(moodByDay[d]), 0) / done.length;
    const avgSkip = skip.reduce((s, d) => s + _dayMoodScore(moodByDay[d]), 0) / skip.length;
    const diff    = Math.round((avgDone - avgSkip) / Math.max(avgSkip, 0.1) * 100);
    return { h, avgDone, avgSkip, diff, nDone: done.length, nSkip: skip.length };
  }).filter(Boolean).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  if (!corrs.length) return `<section class="card">
    <h2 class="section-title"><span class="section-icon">🔗</span> Mood × Habits</h2>
    <p class="section-hint">Not enough data yet. Log moods and habits on the same days to unlock correlations.</p>
  </section>`;

  const rows = corrs.map(({ h, avgDone, avgSkip, diff, nDone }) => {
    const pos  = diff > 5, neg = diff < -5;
    const badge = pos ? `<span class="corr-badge corr-pos">↑${diff}%</span>`
                : neg ? `<span class="corr-badge corr-neg">↓${Math.abs(diff)}%</span>`
                : `<span class="corr-badge corr-neu">≈ similar</span>`;
    const doneCol = pos ? 'var(--accent)' : neg ? '#e05c5c' : 'var(--text-muted)';
    const doneW   = Math.round(avgDone / 5 * 100);
    const skipW   = Math.round(avgSkip / 5 * 100);
    return `<div class="corr-group">
      <div class="corr-head">${escapeHTML(h.icon)} <strong>${escapeHTML(h.label)}</strong>${badge}
        <span class="corr-n">(${nDone} days done)</span>
      </div>
      ${_barRow('Done', doneW, doneCol, avgDone.toFixed(1))}
      ${_barRow('Skipped', skipW, 'var(--text-hint)', avgSkip.toFixed(1))}
    </div>`;
  }).join('');

  return `<section class="card">
    <h2 class="section-title"><span class="section-icon">🔗</span> Mood × Habits</h2>
    <p class="section-hint t-subhead">Avg mood score (1–5) on days you did each habit vs skipped it</p>
    ${rows}
    <p class="section-hint" style="font-size:0.72rem;margin-top:14px;opacity:0.7">1 = anxious/sad · 3 = neutral · 5 = happy/grateful</p>
  </section>`;
}

// ─── Section: Daily grid (≤30 days) ──────────────────────────────────────────

function _sectionDailyGrid(dates, moodByDay, habitByDay, schema) {
  const cells = dates.map(d => {
    const score    = _dayMoodScore(moodByDay[d]);
    const bg       = _valenceColor(score);
    const parts    = d.split('-');
    const label    = `${parseInt(parts[1])}/${parseInt(parts[2])}`;
    const hasData  = moodByDay[d].length || Object.keys(habitByDay[d]).length;
    const doneCount = schema.filter(h => habitByDay[d][h.id]?.done).length;
    const total    = schema.length;

    const dots = schema.length
      ? `<div class="dc-dots">${schema.map(h =>
          `<span class="dc-dot${habitByDay[d][h.id]?.done ? ' on' : ''}"></span>`
        ).join('')}</div>`
      : '';

    const scoreEl = score !== null ? `<span class="dc-score">${score.toFixed(1)}</span>` : '';
    const dim = !hasData ? ' dc-empty' : '';

    return `<div class="day-cell${dim}" style="background:${bg}" title="${d}${score !== null ? ' · Mood ' + score.toFixed(1) + '/5' : ''}${total ? ' · Habits ' + doneCount + '/' + total : ''}">
      <span class="dc-date">${label}</span>
      ${scoreEl}
      ${dots}
    </div>`;
  }).join('');

  return `<section class="card">
    <h2 class="section-title"><span class="section-icon">📅</span> Daily View</h2>
    <p class="section-hint t-subhead">Colour = mood · dots = habits (filled = done)</p>
    <div class="day-grid">${cells}</div>
    <div class="day-legend">
      <span class="dc-legend-item"><span class="dc-legend-swatch" style="background:rgba(72,199,116,0.28)"></span>positive</span>
      <span class="dc-legend-item"><span class="dc-legend-swatch" style="background:rgba(240,168,64,0.22)"></span>neutral</span>
      <span class="dc-legend-item"><span class="dc-legend-swatch" style="background:rgba(224,92,92,0.25)"></span>difficult</span>
    </div>
  </section>`;
}

// ─── Section: Weekly grid (>30 days) ─────────────────────────────────────────

function _sectionWeeklyGrid(dates, moodByDay, habitByDay, schema) {
  // Group dates into weeks of 7
  const weeks = [];
  for (let i = 0; i < dates.length; i += 7) weeks.push(dates.slice(i, i + 7));

  const cells = weeks.map(week => {
    const moodScores = week.map(d => _dayMoodScore(moodByDay[d])).filter(s => s !== null);
    const avgScore   = moodScores.length ? moodScores.reduce((a, b) => a + b, 0) / moodScores.length : null;
    const bg         = _valenceColor(avgScore);
    const label      = week[0].slice(5).replace('-', '/');  // "MM/DD"
    const daysTracked = schema.length ? week.filter(d => Object.keys(habitByDay[d]).length).length : 0;
    const avgHabits  = daysTracked
      ? Math.round(week.reduce((n, d) => n + schema.filter(h => habitByDay[d][h.id]?.done).length, 0)
          / daysTracked / Math.max(schema.length, 1) * 100)
      : null;

    return `<div class="week-cell" style="background:${bg}" title="w/c ${week[0]}">
      <span class="wc-label">${label}</span>
      ${avgScore !== null ? `<span class="wc-score">${avgScore.toFixed(1)}</span>` : ''}
      ${avgHabits !== null ? `<span class="wc-habits">${avgHabits}%</span>` : ''}
    </div>`;
  }).join('');

  return `<section class="card">
    <h2 class="section-title"><span class="section-icon">📅</span> Weekly Overview</h2>
    <p class="section-hint t-subhead">Each cell = one week · score = avg mood · % = habit completion</p>
    <div class="week-grid">${cells}</div>
    <div class="day-legend">
      <span class="dc-legend-item"><span class="dc-legend-swatch" style="background:rgba(72,199,116,0.28)"></span>positive</span>
      <span class="dc-legend-item"><span class="dc-legend-swatch" style="background:rgba(240,168,64,0.22)"></span>neutral</span>
      <span class="dc-legend-item"><span class="dc-legend-swatch" style="background:rgba(224,92,92,0.25)"></span>difficult</span>
    </div>
  </section>`;
}

// ─── Section: Journal word insights ───────────────────────────────────────────

function _sectionWords(dates, entries, fieldSchema) {
  const textFields = fieldSchema.filter(f => f.type === 'textarea' || f.type === 'text').map(f => f.id);
  const counts = {};

  for (const d of dates) {
    const dayEntries = entries[d];
    if (!dayEntries) continue;
    const arr = Array.isArray(dayEntries) ? dayEntries : [dayEntries];
    for (const entry of arr) {
      for (const fid of textFields) {
        const text = entry[fid];
        if (!text || typeof text !== 'string') continue;
        text.toLowerCase()
          .replace(/[^a-z\s]/g, ' ')
          .split(/\s+/)
          .filter(w => w.length > 3 && !STOP_WORDS.has(w))
          .forEach(w => { counts[w] = (counts[w] || 0) + 1; });
      }
    }
  }

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 20);

  const body = sorted.length
    ? sorted.map(([word, count]) => {
        const w = Math.round(count / sorted[0][1] * 100);
        return _barRow(escapeHTML(word), w, 'var(--accent)', count.toString());
      }).join('')
    : '<p class="section-hint">No journal entries in this period.</p>';

  return `<section class="card">
    <h2 class="section-title"><span class="section-icon">📝</span> Journal Insights</h2>
    <p class="section-hint t-subhead">Most frequent words in your entries this period</p>
    ${body}
    <p class="privacy-note">🔒 All analysis runs on your device — your journal is never shared or used for advertising.</p>
  </section>`;
}
