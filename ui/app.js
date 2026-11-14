/* Tassel - interface.
   Plain DOM, no framework: state `S` is saved to disk, runtime `R` is not.
   Clicks are routed by data-act, value changes by data-path / data-change. */
(() => {
  'use strict';

  /* ---------------------------------------------------------------- */
  /* Small helpers                                                      */
  /* ---------------------------------------------------------------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const norm = (s) => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const words = (s) => (String(s || '').trim().match(/\S+/g) || []).length;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + 's'}`;

  // Every bridge call answers { ok, data } or { ok:false, error }.
  async function api(name, payload) {
    const res = await window.tassel[name](payload);
    if (!res || !res.ok) throw new Error((res && res.error) || 'Something went wrong.');
    return res.data;
  }

  const ICONS = {
    programs: '<path d="M3 9l9-5 9 5-9 5-9-5z"/><path d="M7 11.5V16s2 2 5 2 5-2 5-2v-4.5"/>',
    profile: '<circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
    essays: '<path d="M4 20h4L18.5 9.5l-4-4L4 16v4z"/><path d="M13 7l4 4"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    forward: '<path d="M9 5l7 7-7 7"/>',
    reload: '<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    spark: '<path d="M11 3l1.9 5.1L18 10l-5.1 1.9L11 17l-1.9-5.1L4 10l5.1-1.9z"/><path d="M18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    edit: '<path d="M4 20h4L18.5 9.5l-4-4L4 16v4z"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    panel: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    external: '<path d="M14 5h5v5M19 5l-8 8M11 7H6v11h11v-5"/>',
    upload: '<path d="M12 16V5M7 9l5-5 5 5M5 19h14"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    file: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 7.5l8.5 6 8.5-6"/>',
    minus: '<path d="M5 12h14"/>',
  };
  const ico = (name) =>
    `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  const mark = (cls = 'mark') =>
    `<svg class="${cls}" viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M19 31.5V42c0 0 5 5.5 13 5.5S45 42 45 42V31.5" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M32 11 58 24 32 37 6 24Z" fill="currentColor" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M32 24l19 5.5V41" stroke="#C8962B" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M51 41v9" stroke="#C8962B" stroke-width="7.5" stroke-linecap="round"/></svg>`;

  /* ---------------------------------------------------------------- */
  /* State                                                              */
  /* ---------------------------------------------------------------- */
  const blankProfile = () => ({
    personal: {},
    education: [],
    tests: {},
    experience: [],
    recommenders: [],
    research: {},
    story: '',
    documents: {},
    answers: [],
  });
  const defaults = () => ({
    v: 1,
    onboarded: false,
    fields: [], // every field or program title the applicant is considering
    field: '', // the same list as one line of text, for the AI
    countries: [], // regions, countries or cities, free text
    levels: ['masters'], // 'masters' and/or 'phd'
    term: '',
    view: 'programs',
    profile: blankProfile(),
    programs: [],
    essays: [],
    settings: { model: '', autopilot: false, panel: true, aiApp: false, groupBy: 'university' }, // aiApp: the applicant uses their own AI app over MCP
  });
  function hydrate(raw) {
    const d = defaults();
    if (!raw || typeof raw !== 'object') return d;
    const s = { ...d, ...raw };
    s.profile = { ...d.profile, ...(raw.profile || {}) };
    for (const k of ['personal', 'tests', 'documents']) if (!s.profile[k] || typeof s.profile[k] !== 'object') s.profile[k] = {};
    for (const k of ['education', 'experience', 'recommenders', 'answers']) if (!Array.isArray(s.profile[k])) s.profile[k] = [];
    s.settings = { ...d.settings, ...(raw.settings || {}) };
    for (const k of ['programs', 'essays', 'countries']) if (!Array.isArray(s[k])) s[k] = [];
    s.levels = (Array.isArray(s.levels) ? s.levels : []).filter((l) => LEVELS[l]);
    if (!s.levels.length) s.levels = ['masters'];
    s.programs = s.programs.filter((p) => p && typeof p === 'object' && p.university && p.program).map(upgradeApplication);
    if (!s.profile.research || typeof s.profile.research !== 'object') s.profile.research = {};
    if (!Array.isArray(s.fields)) s.fields = typeof raw.field === 'string' && raw.field.trim() ? [raw.field.trim()] : [];
    s.field = s.fields.join(', ');
    if (!['programs', 'profile', 'essays', 'letters', 'settings'].includes(s.view)) s.view = 'programs';
    return s;
  }

  let S = defaults();
  const R = {
    info: { platform: 'win32', models: {}, practiceUrl: '', defaultModel: '' },
    hasKey: false,
    tabs: [],
    logos: {}, // website domain -> image (data URL), '' when the site has none, null while asking
    openCheck: null, // application whose checklist is unfolded
    batch: null, // a run through several applications at once: { items, stopped }
    sync: { enabled: false, dir: '', available: true },
    active: 'home',
    drafting: new Set(), // essay ids being drafted
    essaySource: new Map(), // essay id -> { tabId, ref } while that field is on screen
    modal: null,
    mcp: { calls: 0, lastAt: 0 }, // activity from an AI app connected over MCP, this session
    mcpInfo: null, // how to connect one (from the main process)
  };

  let saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 250);
  }
  function flush() {
    clearTimeout(saveTimer);
    saveTimer = null;
    window.tassel.saveState(S);
  }
  window.addEventListener('beforeunload', flush);

  // Trimmed, no blanks, no repeats (ignoring case and punctuation).
  const uniq = (list) => {
    const seen = new Set();
    const out = [];
    for (const item of list || []) {
      const v = String(item == null ? '' : item).replace(/\s+/g, ' ').trim();
      if (!v || seen.has(norm(v))) continue;
      seen.add(norm(v));
      out.push(v);
    }
    return out;
  };
  function setFields(list) {
    S.fields = uniq(list);
    S.field = S.fields.join(', ');
  }

  // True when the applicant has set up their own AI app, or one is talking to Tassel right now.
  const usesApp = () => !!S.settings.aiApp || R.mcp.calls > 0;

  const getPath = (path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), S);
  function setPath(path, value) {
    const keys = path.split('.');
    let o = S;
    for (let i = 0; i < keys.length - 1; i++) {
      if (o[keys[i]] == null) o[keys[i]] = {};
      o = o[keys[i]];
    }
    o[keys[keys.length - 1]] = value;
  }

  /* ---------------------------------------------------------------- */
  /* Toasts and dialogs                                                 */
  /* ---------------------------------------------------------------- */
  function toast(text, kind) {
    const el = document.createElement('div');
    el.className = 'toast' + (kind ? ' ' + kind : '');
    el.textContent = text;
    $('#toasts').appendChild(el);
    setTimeout(() => el.classList.add('out'), kind === 'bad' ? 5200 : 2800);
    setTimeout(() => el.remove(), kind === 'bad' ? 5500 : 3100);
  }

  function openModal({ html, wide, handlers, onClose, onInput }) {
    const host = $('#modal');
    host.innerHTML = `<div class="dialog${wide ? ' wide' : ''}" role="dialog" aria-modal="true">${html}</div>`;
    host.hidden = false;
    R.modal = { handlers: handlers || {}, onClose, onInput };
    const first = $('[autofocus]', host) || $('input:not([type=checkbox]),textarea,select', host) || $('button', host);
    if (first) setTimeout(() => first.focus(), 30);
  }
  function setModal(html) {
    const dialog = $('#modal .dialog');
    if (dialog) dialog.innerHTML = html;
  }
  function closeModal(result) {
    const m = R.modal;
    R.modal = null;
    $('#modal').hidden = true;
    $('#modal').innerHTML = '';
    if (m && m.onClose) m.onClose(result);
  }
  function confirmDialog({ title, body, confirm = 'Confirm', danger }) {
    return new Promise((resolve) => {
      openModal({
        html: `
          <div class="dialog-head"><div class="grow"><h2>${esc(title)}</h2><p>${esc(body)}</p></div></div>
          <div class="dialog-foot">
            <button class="btn ghost" data-act="m-cancel">Cancel</button>
            <button class="btn ${danger ? 'danger' : 'primary'}" data-act="m-ok" autofocus>${esc(confirm)}</button>
          </div>`,
        handlers: { 'm-cancel': () => closeModal(false), 'm-ok': () => closeModal(true) },
        onClose: (r) => resolve(!!r),
      });
    });
  }

  /* ---------------------------------------------------------------- */
  /* Applications, grouped by university                                */
  /* ---------------------------------------------------------------- */
  const STATUS = { not_started: 'Not started', in_progress: 'In progress', ready: 'Ready to review', submitted: 'Submitted' };
  const LEVELS = { masters: "Master's", phd: 'PhD' };
  const levelFromName = (name) => (/\b(ph\.?\s?d|d\.?\s?phil|doctora\w*)\b/i.test(name || '') ? 'phd' : 'masters');
  const levelsText = (levels) => {
    const l = (levels && levels.length ? levels : ['masters']).map((k) => LEVELS[k]).filter(Boolean);
    return l.join(' and ') || LEVELS.masters;
  };
  // How an application sits against the applicant's standing. An estimate to plan with, never a prediction.
  const TIERS = { reach: 'Reach', target: 'Target', safer: 'Safer' };
  const TIER_HELP = {
    reach: 'Admits stronger profiles than yours on average. Worth trying, not worth counting on.',
    target: 'Your profile is in the range this program usually admits.',
    safer: 'Your profile is above what this program usually admits.',
  };
  const TIER_CLASS = { reach: 'warn', target: 'info', safer: 'good' };
  const tierOf = (v) => {
    const t = String(v || '').toLowerCase();
    return TIERS[t] ? t : /safe|likely/.test(t) ? 'safer' : /match/.test(t) ? 'target' : '';
  };
  const CREST = ['#1E6B52', '#34506E', '#8A6412', '#7A3E5C', '#2F5D62', '#5B4B8A', '#9A4B2F'];
  const crestColor = (name) => {
    let h = 0;
    for (const ch of String(name || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return CREST[h % CREST.length];
  };
  const initial = (name) => (String(name || '?').replace(/^(the|university of|université|universität)\s+/i, '').trim()[0] || '?').toUpperCase();
  const parseDay = (iso) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  };
  const daysUntil = (iso) => {
    const d = parseDay(iso);
    if (!d) return null;
    const now = new Date();
    return Math.round((d - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
  };
  const fmtDay = (iso) => {
    const d = parseDay(iso);
    return d ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  };
  const inDays = (d) => (d === 0 ? 'today' : d === 1 ? 'tomorrow' : `${d} days`);
  const programById = (id) => S.programs.find((p) => p.id === id);
  const programName = (p) => (p ? `${p.university} – ${p.program}` : 'General');

  /* ---- The built-in university list ---- */
  const UNIS = window.TASSEL_UNIS || [];
  // Exact name, or one of the short names people type ("MIT", "LSE").
  function findUni(name) {
    const n = norm(name);
    if (!n) return null;
    return UNIS.find((u) => norm(u[0]) === n) || UNIS.find((u) => u[3] && ` ${norm(u[3])} `.includes(` ${n} `) && n.length >= 2 && !n.includes(' ')) || null;
  }
  function searchUnis(q, limit = 7) {
    const n = norm(q);
    if (!n) return [];
    const scored = [];
    for (const u of UNIS) {
      const name = norm(u[0]);
      const alias = ` ${norm(u[3])} `;
      let s = 0;
      if (name === n || (alias.includes(` ${n} `) && !n.includes(' '))) s = 100;
      else if (name.startsWith(n) || name.replace(/^(the )?university of /, '').startsWith(n)) s = 80; // "mich" finds University of Michigan
      else if (` ${name}`.includes(` ${n}`)) s = 60;
      else if (alias.includes(` ${n}`)) s = 50;
      else if (n.split(' ').every((tok) => ` ${name}${alias}${norm(u[1])}`.includes(` ${tok}`))) s = 30;
      if (s) scored.push([s, u]);
    }
    return scored
      .sort((a, b) => b[0] - a[0] || a[1][0].length - b[1][0].length)
      .slice(0, limit)
      .map(([s, u]) => ({ u, exact: s === 100 }));
  }

  const hostOf = (url) => {
    try {
      return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    } catch {
      return '';
    }
  };
  // The university's own website domain, used for its logo.
  function domainFor(p) {
    if (p.website) return hostOf(normUrl(p.website));
    const known = findUni(p.university);
    if (known) return known[2];
    // An application page on the university's own domain tells us the domain; shared portals do not.
    const h = hostOf(p.url);
    const m = /([a-z0-9-]+\.(?:edu|ac\.[a-z]{2}|edu\.[a-z]{2}))$/.exec(h);
    return m ? m[1] : '';
  }

  // Shared application systems worth knowing about (from the address of the application page).
  const PLATFORMS = [
    [/(^|\.)liaisoncas\.(com|org)$/, 'Liaison CAS', 'A shared application (GradCAS and its sister systems). One account covers every program you apply to through it.'],
    [/(^|\.)applyweb\.com$/, 'ApplyWeb', 'Portal software many universities use. Each university still needs its own account.'],
    [/(^|\.)uni-assist\.de$/, 'uni-assist', 'Checks international documents for German universities. It charges a fee per course.'],
    [/(^|\.)studielink\.nl$/, 'Studielink', 'The Dutch national enrolment portal. The university usually wants its own application as well.'],
    [/(^|\.)universityadmissions\.se$/, 'Universityadmissions.se', 'One shared application for programs in Sweden.'],
    [/(^|\.)(go)?applytexas\.org$/, 'ApplyTexas', 'The shared application for Texas public universities.'],
  ];
  const platformOf = (url) => {
    const h = hostOf(url);
    const hit = h && PLATFORMS.find(([re]) => re.test(h));
    return hit ? { name: hit[1], tip: hit[2] } : null;
  };

  /* ---- Logos (fetched once from the university's own site, then kept) ---- */
  function requestLogo(domain) {
    R.logos[domain] = null; // asked, not back yet
    api('logo', { domain })
      .then((data) => {
        R.logos[domain] = data || '';
        if (!data) return;
        for (const el of $$('[data-logo]')) {
          if (el.dataset.logo !== domain) continue;
          el.classList.add('has-logo');
          el.style.background = '';
          el.innerHTML = `<img src="${data}" alt="">`;
        }
      })
      .catch(() => {
        R.logos[domain] = '';
      });
  }
  function logoHtml(name, domain, cls) {
    if (domain && R.logos[domain] === undefined) requestLogo(domain);
    const data = domain && R.logos[domain];
    return data
      ? `<span class="${cls} has-logo" data-logo="${esc(domain)}"><img src="${data}" alt=""></span>`
      : `<span class="${cls}" data-logo="${esc(domain || '')}" style="background:${crestColor(name)}">${esc(initial(name))}</span>`;
  }

  /* ---- Dates ---- */
  const validDay = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '');
  const allDates = (p) =>
    [...(validDay(p.deadline) ? [{ label: 'Application deadline', date: p.deadline, main: true }] : []), ...(p.extraDeadlines || []).filter((d) => d && validDay(d.date))].sort((a, b) =>
      a.date < b.date ? -1 : a.date > b.date ? 1 : 0
    );
  const nextDate = (p) => allDates(p).find((d) => daysUntil(d.date) >= 0) || null;
  const sortDate = (p) => (nextDate(p) || { date: p.deadline || '9999' }).date || '9999';

  function sortedPrograms() {
    return [...S.programs].sort((a, b) => {
      const sa = a.status === 'submitted' ? 1 : 0;
      const sb = b.status === 'submitted' ? 1 : 0;
      if (sa !== sb) return sa - sb;
      const da = sortDate(a);
      const db = sortDate(b);
      if (da !== db) return da < db ? -1 : 1;
      return a.university.localeCompare(b.university) || a.program.localeCompare(b.program);
    });
  }
  // One entry per university, each holding its applications. Universities with the nearest deadline come first.
  function groupedPrograms() {
    const groups = new Map();
    for (const p of sortedPrograms()) {
      const key = norm(p.university);
      if (!groups.has(key)) groups.set(key, { key, name: p.university, apps: [] });
      groups.get(key).apps.push(p);
    }
    return [...groups.values()];
  }
  const siblings = (p) => S.programs.filter((x) => norm(x.university) === norm(p.university));

  function deadlineInfo(p) {
    const dates = allDates(p);
    if (!dates.length) return null;
    const title = dates.map((d) => `${d.label}: ${fmtDay(d.date)}`).join('\n');
    if (p.status === 'submitted') return { cls: '', text: p.deadline ? fmtDay(p.deadline) : fmtDay(dates[0].date), title };
    const next = nextDate(p);
    if (!next) return { cls: 'bad', text: 'Deadline passed', title };
    const d = daysUntil(next.date);
    return { cls: d <= 14 ? 'warn' : '', text: `${next.main ? '' : next.label + ': '}${fmtDay(next.date)} · ${inDays(d)}`, title };
  }
  function deadlinePill(p) {
    const info = deadlineInfo(p);
    return info ? `<span class="pill ${info.cls}" title="${esc(info.title)}">${esc(info.text)}</span>` : '';
  }

  /* ---- The checklist every application carries ---- */
  const CHECK_BASE = ['Application form', 'Statement of purpose and essays', 'CV / résumé', 'Transcripts', 'Test scores sent', 'Recommendation letters', 'Application fee'];
  const CHECK_PHD = ['Research proposal', 'Writing sample', 'Contact potential supervisors'];
  const newChecklist = (level) => [...CHECK_BASE, ...(level === 'phd' ? CHECK_PHD : [])].map((label) => ({ id: uid(), label, done: false }));
  const checkProgress = (p) => ({ done: (p.checklist || []).filter((c) => c.done).length, total: (p.checklist || []).length });

  // Every application is created here, so they all have the same shape.
  function newApplication(data) {
    const level = LEVELS[data.level] ? data.level : levelFromName(data.program);
    return {
      id: uid(),
      status: 'not_started',
      addedAt: Date.now(),
      university: '',
      program: '',
      country: '',
      url: '',
      website: '',
      deadline: '',
      extraDeadlines: [],
      fee: '',
      note: '',
      fit: '', // one line on why it is a reach / target / safer choice
      ...data,
      level,
      tier: tierOf(data.tier),
      checklist: newChecklist(level),
      letters: defaultLetters(level),
    };
  }
  // Older saved applications get the newer fields.
  function upgradeApplication(p) {
    if (!LEVELS[p.level]) p.level = levelFromName(p.program);
    if (!Array.isArray(p.extraDeadlines)) p.extraDeadlines = [];
    if (!Array.isArray(p.checklist)) p.checklist = newChecklist(p.level);
    if (!p.letters || typeof p.letters !== 'object') p.letters = defaultLetters(p.level);
    for (const k of ['website', 'fee', 'note', 'country', 'url', 'deadline', 'fit']) if (typeof p[k] !== 'string') p[k] = '';
    p.tier = tierOf(p.tier);
    return p;
  }

  /* ---------------------------------------------------------------- */
  /* Recommendation letters: who was asked for which application,      */
  /* and who has delivered. Tassel never emails anyone; it hands you    */
  /* the text to send.                                                  */
  /* ---------------------------------------------------------------- */
  const LETTER_STATES = { todo: 'Not asked', asked: 'Asked', submitted: 'Submitted' };
  const todayIso = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const defaultLetters = (level) => ({ needed: level === 'phd' ? 3 : 2, by: {} });

  // The named people in the profile. Each gets a lasting id the first time it is needed.
  function recommenders() {
    let changed = false;
    for (const r of S.profile.recommenders) {
      if (r && !r.id) {
        r.id = uid();
        changed = true;
      }
    }
    if (changed) save();
    return S.profile.recommenders.filter((r) => r && String(r.name || '').trim());
  }
  function lettersOf(p) {
    if (!p.letters || typeof p.letters !== 'object') p.letters = defaultLetters(p.level);
    if (!p.letters.by || typeof p.letters.by !== 'object') p.letters.by = {};
    if (!Number.isInteger(p.letters.needed) || p.letters.needed < 0) p.letters.needed = defaultLetters(p.level).needed;
    return p.letters;
  }
  const letterState = (p, rec) => {
    const e = lettersOf(p).by[rec.id];
    return e && LETTER_STATES[e.state] ? e.state : 'todo';
  };
  function letterCounts(p) {
    const states = recommenders().map((r) => letterState(p, r));
    return { needed: lettersOf(p).needed, waiting: states.filter((s) => s === 'asked').length, submitted: states.filter((s) => s === 'submitted').length };
  }
  // The checklist's "Recommendation letters" line ticks itself once enough letters are in.
  function syncLetterCheck(p) {
    const c = letterCounts(p);
    const item = (p.checklist || []).find((x) => norm(x.label) === 'recommendation letters');
    if (item && c.needed > 0) item.done = c.submitted >= c.needed;
  }
  function setLetter(p, recId, state) {
    const L = lettersOf(p);
    const prev = L.by[recId] || {};
    if (state === 'todo') delete L.by[recId];
    else if (state === 'asked') L.by[recId] = { state, askedOn: prev.askedOn || todayIso() };
    else L.by[recId] = { state: 'submitted', askedOn: prev.askedOn || todayIso(), doneOn: prev.doneOn || todayIso() };
    syncLetterCheck(p);
  }
  // The date a letter is due: a date named for recommendations if there is one, else the application deadline.
  const letterDue = (p) => {
    const own = (p.extraDeadlines || []).find((d) => validDay(d.date) && /recommend|letter|reference/i.test(d.label || ''));
    return own ? own.date : validDay(p.deadline) ? p.deadline : '';
  };
  const daysSince = (iso) => {
    const d = daysUntil(iso);
    return d == null ? null : -d;
  };
  // "asked 16 days ago", and whether it is time to nudge.
  function letterNote(p, rec) {
    const e = lettersOf(p).by[rec.id];
    if (!e) return { text: '', nudge: false };
    if (e.state === 'submitted') return { text: e.doneOn ? `in since ${fmtDay(e.doneOn)}` : 'in', nudge: false };
    const ago = daysSince(e.askedOn);
    const due = letterDue(p);
    const left = due ? daysUntil(due) : null;
    const nudge = ago != null && ago >= 14 && left != null && left >= 0 && left <= 21;
    const text = ago == null ? 'asked' : ago <= 0 ? 'asked today' : `asked ${plural(ago, 'day')} ago`;
    return { text: nudge ? `${text}, due in ${inDays(left)}: worth a reminder` : text, nudge };
  }

  function lettersPill(p) {
    const c = letterCounts(p);
    if (!c.needed) return '';
    const due = letterDue(p);
    const soon = due && daysUntil(due) >= 0 && daysUntil(due) <= 21;
    const cls = c.submitted >= c.needed ? 'good' : soon && p.status !== 'submitted' ? 'warn' : '';
    return `<button class="pill check letters ${cls} ${R.openCheck === p.id ? 'on' : ''}" data-act="toggle-check" data-id="${p.id}" title="Recommendation letters: ${c.submitted} of ${c.needed} in, ${c.waiting} asked and waiting">${ico('mail')}${c.submitted}/${c.needed}</button>`;
  }
  const letterSeg = (p, rec) => {
    const st = letterState(p, rec);
    return `<div class="seg small letter-seg" role="group" aria-label="Letter from ${esc(rec.name)}">${Object.entries(LETTER_STATES)
      .map(([k, v]) => `<button class="${st === k ? 'on is-' + k : ''}" data-act="letter-set" data-id="${p.id}" data-rec="${esc(rec.id)}" data-state="${k}">${v}</button>`)
      .join('')}</div>`;
  };

  // The letters part of an application's checklist panel.
  function lettersBoxHtml(p) {
    const recs = recommenders();
    const c = letterCounts(p);
    return `<div class="letters-box">
      <div class="letters-head"><b>Recommendation letters</b><span class="hint">This program needs</span>
        <span class="stepper"><button class="icon-btn" data-act="letter-need" data-id="${p.id}" data-d="-1" title="One fewer" aria-label="One fewer letter">${ico('minus')}</button><b>${c.needed}</b><button class="icon-btn" data-act="letter-need" data-id="${p.id}" data-d="1" title="One more" aria-label="One more letter">${ico('plus')}</button></span>
        <span class="hint">${c.submitted} in, ${c.waiting} asked and waiting</span><span class="grow"></span>
        <button class="link" data-act="go" data-view="letters">All letters</button></div>
      ${
        recs.length
          ? recs
              .map((r) => {
                const note = letterNote(p, r);
                return `<div class="letter-row"><div class="grow"><b>${esc(r.name)}</b><span class="hint ${note.nudge ? 'nudge' : ''}">${esc([r.relationship || r.title, note.text].filter(Boolean).join(' · '))}</span></div>${letterSeg(p, r)}</div>`;
              })
              .join('')
          : `<p class="hint">Add the people writing your letters under <button class="link" data-act="go-recs">Profile</button>, then track them here.</p>`
      }</div>`;
  }

  // The email text for one recommender: a first request, or a reminder for what is still open.
  function letterMessage(rec, kind) {
    const per = S.profile.personal;
    const me = [per.firstName, per.lastName].filter(Boolean).join(' ') || '[your name]';
    const want = kind === 'remind' ? 'asked' : 'todo';
    const apps = sortedPrograms().filter((p) => p.status !== 'submitted' && lettersOf(p).needed > 0 && letterState(p, rec) === want);
    const lines = apps.map((p) => `- ${p.university}, ${p.program}${letterDue(p) ? ` (due ${fmtDay(letterDue(p))})` : ''}`);
    const body =
      kind === 'remind'
        ? ['Thank you again for agreeing to write for me. A gentle reminder that these letters are still open:', '', ...lines, '', 'Each program should have emailed you its own upload link. Please tell me if any of them did not arrive and I will have it sent again.']
        : [
            `I am applying to graduate programs${S.term ? ` for ${S.term}` : ''} and would be very grateful if you would write a letter of recommendation for me. These are the programs:`,
            '',
            ...lines,
            '',
            'Each one will email you a link for uploading the letter. I am happy to send my CV, my statement, and anything else that would help.',
          ];
    return { count: apps.length, text: [`Dear ${rec.name},`, '', ...body, '', 'With thanks,', me].join('\n') };
  }

  function renderLetters() {
    const recs = recommenders();
    const apps = sortedPrograms().filter((p) => lettersOf(p).needed > 0);
    const head = `<div class="view-head"><div class="grow"><h1>Recommendation letters</h1>
      <div class="sub">Who has been asked for which application, and what is still open. Tassel never emails anyone: it gives you the text to send.</div></div>
      <div class="actions"><button class="btn" data-act="go-recs">${ico('plus')}Add a recommender</button></div></div>`;
    if (!recs.length) {
      return `<div class="view-inner">${head}<div class="card empty">${mark('mark-big')}<h2>No recommenders yet</h2>
        <p>Add the people writing your letters to your profile. Then you can track every letter for every application here.</p>
        <div class="actions"><button class="btn primary lg" data-act="go-recs">${ico('plus')}Add a recommender</button></div></div></div>`;
    }
    if (!apps.length) {
      return `<div class="view-inner">${head}<div class="card empty"><h2>No applications to track yet</h2>
        <p>Once you have applications on your list, each one appears here under each recommender.</p>
        <div class="actions"><button class="btn primary lg" data-act="go" data-view="programs">Go to applications</button></div></div></div>`;
    }
    const short = apps.filter((p) => p.status !== 'submitted' && recs.length < lettersOf(p).needed).length;
    const cards = recs
      .map((r) => {
        const open = apps.filter((p) => p.status !== 'submitted');
        const todo = open.filter((p) => letterState(p, r) === 'todo').length;
        const waiting = open.filter((p) => letterState(p, r) === 'asked').length;
        const inCount = apps.filter((p) => letterState(p, r) === 'submitted').length;
        return `<div class="card uni" data-rec-card="${esc(r.id)}">
          <div class="uni-head">
            <span class="crest" style="background:${crestColor(r.name)}">${esc(initial(r.name.replace(/^(dr|prof|professor|mr|mrs|ms)\.?\s+/i, '')))}</span>
            <div class="grow"><div class="uni-name">${esc(r.name)}</div>
              <div class="uni-sub">${[r.title, r.organization, r.email].filter(Boolean).map(esc).join(' · ') || '&nbsp;'}</div></div>
            <span class="pill tiny ${todo ? '' : 'good'}">${todo} to ask</span><span class="pill tiny ${waiting ? 'warn' : ''}">${waiting} waiting</span><span class="pill tiny ${inCount ? 'good' : ''}">${inCount} in</span>
          </div>
          <div class="letter-actions">
            ${todo ? `<button class="btn sm" data-act="letters-copy" data-rec="${esc(r.id)}" data-kind="ask">${ico('copy')}Copy request email</button><button class="btn sm" data-act="letters-ask-all" data-rec="${esc(r.id)}">${ico('check')}Mark all ${todo} as asked</button>` : ''}
            ${waiting ? `<button class="btn sm" data-act="letters-copy" data-rec="${esc(r.id)}" data-kind="remind">${ico('copy')}Copy reminder email</button>` : ''}
            ${!todo && !waiting ? `<span class="done-line">${ico('check')} Every letter from ${esc(r.name)} is in.</span>` : ''}
          </div>
          ${apps
            .map((p) => {
              const note = letterNote(p, r);
              return `<div class="app ${p.status === 'submitted' ? 'done' : ''}"><div class="app-main">
                <div class="app-name">${logoHtml(p.university, domainFor(p), 'tab-dot')}<span class="app-uni">${esc(p.university)}</span><span>${esc(p.program)}</span></div>
                ${note.text ? `<div class="note ${note.nudge ? 'nudge' : ''}">${esc(note.text)}</div>` : ''}</div>
                <div class="meta">${letterDue(p) ? `<span class="pill ${daysUntil(letterDue(p)) < 0 ? 'bad' : daysUntil(letterDue(p)) <= 14 ? 'warn' : ''}">${daysUntil(letterDue(p)) < 0 ? 'Passed' : `Due ${esc(fmtDay(letterDue(p)))}`}</span>` : ''}${letterSeg(p, r)}</div></div>`;
            })
            .join('')}
        </div>`;
      })
      .join('');
    return `<div class="view-inner">${head}
      ${short ? `<div class="banner"><div class="grow"><strong>${plural(short, 'application')} ${short === 1 ? 'needs' : 'need'} more letters than you have recommenders.</strong> Add another recommender, or lower the number that application needs in its checklist.</div><button class="btn sm dark" data-act="go-recs">Add a recommender</button></div>` : ''}
      <div class="uni-list">${cards}</div></div>`;
  }

  function checklistHtml(p) {
    const dates = allDates(p);
    const platform = platformOf(p.url);
    return `<div class="checkpanel">
      <div class="check-grid">${(p.checklist || [])
        .map(
          (c) => `<label class="check-item ${c.done ? 'done' : ''}"><input type="checkbox" data-change="check" data-id="${p.id}" data-item="${c.id}" ${c.done ? 'checked' : ''}>
            <span>${esc(c.label)}</span><button class="icon-btn tiny" data-act="check-remove" data-id="${p.id}" data-item="${c.id}" title="Stop tracking this" aria-label="Remove ${esc(c.label)}">${ico('x')}</button></label>`
        )
        .join('')}</div>
      <form class="row" data-submit="check-add" data-id="${p.id}"><input class="input" placeholder="Track something else, e.g. interview, portfolio, GRE subject test" aria-label="Add to checklist"><button class="btn sm" type="submit">Add</button></form>
      ${lettersBoxHtml(p)}
      <div class="check-facts">
        ${dates.length ? dates.map((d) => `<span><b>${esc(d.label)}</b> ${esc(fmtDay(d.date))}${daysUntil(d.date) >= 0 ? ` (${inDays(daysUntil(d.date))})` : ' (passed)'}</span>`).join('') : '<span>No dates yet. Add them with the pencil.</span>'}
        ${p.fee ? `<span><b>Fee</b> ${esc(p.fee)}</span>` : ''}
        ${platform ? `<span><b>${esc(platform.name)}</b> ${esc(platform.tip)}</span>` : ''}
      </div></div>`;
  }

  function applicationRowHtml(p, showUni) {
    const prog = checkProgress(p);
    const tier = p.tier ? `<span class="pill tiny ${TIER_CLASS[p.tier]}" title="${esc(TIER_HELP[p.tier])}">${TIERS[p.tier]}</span>` : '';
    const platform = platformOf(p.url);
    const open = p.url
      ? `<button class="btn sm primary" data-act="open-program" data-id="${p.id}">${p.status === 'not_started' ? 'Start' : 'Open'}${ico('arrow')}</button>`
      : `<button class="btn sm" data-act="edit-program" data-id="${p.id}">Add link</button>`;
    return `<div class="app ${p.status === 'submitted' ? 'done' : ''}" data-app="${p.id}">
        <div class="app-main">
          <div class="app-name">${showUni === true ? `${logoHtml(p.university, domainFor(p), 'tab-dot')}<span class="app-uni">${esc(p.university)}</span>` : ''}<span class="selectable">${esc(p.program)}</span>${showUni === true ? '' : tier}<span class="pill tiny ${p.level === 'phd' ? 'info' : ''}">${LEVELS[p.level]}</span>${platform ? `<span class="pill tiny" title="${esc(platform.tip)}">${esc(platform.name)}</span>` : ''}</div>
          ${p.fit || p.note ? `<div class="note" title="${esc([p.fit, p.note].filter(Boolean).join(' · '))}">${esc([p.fit, p.note].filter(Boolean).join(' · '))}</div>` : ''}
        </div>
        <div class="meta">
          ${deadlinePill(p)}
          ${lettersPill(p)}
          <button class="pill check ${prog.total && prog.done === prog.total ? 'good' : ''} ${R.openCheck === p.id ? 'on' : ''}" data-act="toggle-check" data-id="${p.id}" title="Checklist for this application">${ico('check')}${prog.done}/${prog.total}</button>
          <select class="status s-${p.status}" data-change="status" data-id="${p.id}" aria-label="Status">
            ${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${p.status === k ? 'selected' : ''}>${v}</option>`).join('')}
          </select>
          ${open}
          <button class="icon-btn" data-act="edit-program" data-id="${p.id}" title="Edit" aria-label="Edit ${esc(p.program)}">${ico('edit')}</button>
          <button class="icon-btn" data-act="remove-program" data-id="${p.id}" title="Remove" aria-label="Remove ${esc(p.program)}">${ico('trash')}</button>
        </div>
      </div>
      ${R.openCheck === p.id ? checklistHtml(p) : ''}`;
  }

  // How the list is spread across reach / target / safer, with a nudge when it is lopsided.
  function mixHtml() {
    const open = S.programs.filter((p) => p.status !== 'submitted');
    const count = (t) => open.filter((p) => p.tier === t).length;
    const [r, t, s] = [count('reach'), count('target'), count('safer')];
    if (!r && !t && !s) return open.length ? '<span class="hint">Not sorted into reach, target and safer yet.</span>' : '';
    const parts = [
      [r, 'reach', 'warn'],
      [t, 'target', 'info'],
      [s, 'safer', 'good'],
    ].map(([n, label, cls]) => `<span class="pill tiny ${n ? cls : ''}">${n} ${label}</span>`);
    let advice = 'A balanced list.';
    if (!s) advice = 'No safer choice yet: add at least one or two.';
    else if (!t) advice = 'No target programs: most of a list should be targets.';
    else if (r > t + s) advice = 'Mostly reaches: add more targets so the list is not a long shot.';
    else if (!r) advice = 'No reach: one or two ambitious choices cost little to try.';
    return parts.join('') + `<span class="hint">${esc(advice)}</span>`;
  }

  /* ---- Working through many applications at once ---- */
  const canBatch = (p) => !!p.url && p.status !== 'submitted';
  const BATCH_STATE = {
    queued: ['Waiting', ''],
    working: ['Working…', 'info'],
    signin: ['Sign in needed', 'warn'],
    needs: ['Needs you', 'warn'],
    review: ['Ready for your review', 'good'],
    noai: ['Basics filled; needs an AI for the rest', 'warn'],
    done: ['Filled what it could', 'good'],
    failed: ['Could not finish', 'bad'],
  };
  function batchBoardHtml() {
    const b = R.batch;
    if (!b || !b.items.length) return '';
    const left = b.items.filter((i) => i.state === 'queued' || i.state === 'working').length;
    return `<div class="card batch">
      <div class="uni-head"><div class="grow"><div class="uni-name">${left ? `Working through ${plural(b.items.length, 'application')}…` : `Went through ${plural(b.items.length, 'application')}`}</div>
        <div class="uni-sub">${left ? `${left} still to go. You can keep using Tassel meanwhile.` : 'Open each one that needs you. Tassel never submits; that part is yours.'}</div></div>
        ${left ? '' : `<button class="btn sm" data-act="batch-again">Continue all</button>`}
        <button class="btn sm ghost" data-act="batch-close">${left ? 'Stop' : 'Hide'}</button></div>
      ${b.items
        .map((i) => {
          const p = programById(i.programId);
          if (!p) return '';
          const [label, cls] = BATCH_STATE[i.state] || BATCH_STATE.queued;
          return `<div class="app"><div class="app-main"><div class="app-name">${logoHtml(p.university, domainFor(p), 'tab-dot')}<span class="app-uni">${esc(p.university)}</span><span>${esc(p.program)}</span></div>
            ${i.detail ? `<div class="note">${esc(i.detail)}</div>` : ''}</div>
            <div class="meta">${i.state === 'working' ? '<span class="spin"></span>' : ''}<span class="pill ${cls}">${esc(label)}</span>
            ${i.tabId && R.tabs.some((t) => t.id === i.tabId) ? `<button class="btn sm" data-act="tab" data-id="${i.tabId}">Open${ico('arrow')}</button>` : ''}</div></div>`;
        })
        .join('')}</div>`;
  }

  // What happened to one application's tab, in the batch board's terms.
  function batchOutcome(tab, res) {
    if (!res) return ['failed', 'The page did not respond. Open it and press Fill this page.'];
    if (res.pageKind === 'login') return ['signin', 'Sign in or create your account on this site, then press Continue all.'];
    if (res.pageKind === 'review') return ['review', 'Everything Tassel could fill is in. Read it through and submit it yourself.'];
    if (res.pageKind === 'payment') return ['needs', 'It reached the payment page. That part is yours.'];
    const n = blockers(tab);
    if (n) return ['needs', `${plural(n, 'thing')} for you on “${res.heading || 'this page'}”.`];
    if (res.noKey) return ['noai', 'Ask your AI app to finish this application, or add an API key.'];
    if (res.aiError) return ['failed', res.note || 'The AI could not be reached.'];
    if (res.pageKind === 'empty') return ['needs', 'No form on this page. Open the application form in this tab, then press Continue all.'];
    return ['done', tab.next ? 'Stopped here. Open it to carry on.' : 'No next step found on this page. Open it to carry on.'];
  }

  // Open several applications in background tabs and fill each as far as it will go.
  // Two at a time: fast enough, and gentle on the computer and on the AI's rate limits.
  async function runBatch(ids) {
    const items = ids.map((id) => ({ programId: id, tabId: null, state: 'queued', detail: '' }));
    const batch = { items, stopped: false };
    R.batch = batch;
    const show = () => {
      // Keep the board current, but never redraw the page under someone who is typing in it.
      const typing = document.activeElement && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName) && document.activeElement.closest('#view');
      if (R.batch === batch && R.active === 'home' && S.view === 'programs' && !R.modal && !typing) refreshHome();
      else renderTabs();
    };
    show();
    const queue = [...items];
    const worker = async () => {
      while (queue.length && !batch.stopped) {
        const item = queue.shift();
        const p = programById(item.programId);
        if (!p || !p.url) {
          item.state = 'failed';
          item.detail = 'No application link.';
          show();
          continue;
        }
        item.state = 'working';
        show();
        let tab = R.tabs.find((t) => t.programId === p.id);
        if (!tab) tab = openTab({ url: p.url, programId: p.id, title: p.university, background: true });
        if (!tab) {
          item.state = 'failed';
          item.detail = 'Too many tabs are open. Close some and press Continue all.';
          show();
          continue;
        }
        item.tabId = tab.id;
        await waitLoaded(tab, 30000);
        await sleep(600);
        const res = await fillAndAdvance(tab, false, true);
        [item.state, item.detail] = batchOutcome(tab, res);
        show();
      }
    };
    await Promise.all([worker(), worker()]);
    if (R.batch === batch && !batch.stopped) {
      const needs = items.filter((i) => i.state !== 'done' && i.state !== 'review').length;
      toast(needs ? `Done with the first pass. ${plural(needs, 'application')} ${needs === 1 ? 'needs' : 'need'} you.` : 'Done. Every application is filled as far as Tassel can take it.');
    }
    show();
  }

  function batchDialog() {
    const apps = sortedPrograms().filter(canBatch);
    if (!apps.length) return toast('Add application links first: Tassel needs to know where each form is.', 'bad');
    const noLink = S.programs.filter((p) => !p.url && p.status !== 'submitted').length;
    openModal({
      wide: true,
      html: `<div class="dialog-head"><div class="grow"><h2>Start all applications</h2>
          <p>Tassel opens each one in its own tab and fills it page by page, two at a time. It stops wherever something needs you (signing in, a question, an essay, the final review) and lists those for you. It never submits.</p></div></div>
        <div class="dialog-body">${apps
          .map(
            (p) => `<label class="result"><input type="checkbox" data-id="${p.id}" checked>
              <div class="grow"><div class="uni">${esc(p.university)}</div><div class="deg">${esc(p.program)} · ${LEVELS[p.level]}${p.tier ? ` · ${TIERS[p.tier]}` : ''}${p.deadline ? ` · due ${esc(fmtDay(p.deadline))}` : ''}</div></div>
              <span class="pill tiny">${STATUS[p.status]}</span></label>`
          )
          .join('')}
          ${noLink ? `<p class="hint" style="margin-top:8px">${plural(noLink, 'application')} without a link ${noLink === 1 ? 'is' : 'are'} left out. Add the link with the pencil.</p>` : ''}
          ${R.hasKey ? '' : `<div class="ob-note" style="margin-top:12px">${ico('info')}<div>Without an API key, this pass fills the basics on each first page. To go further, ask your AI app: “Use Tassel. Fill in all my applications, one after another.”</div></div>`}</div>
        <div class="dialog-foot"><button class="btn ghost" data-act="m-cancel">Cancel</button>
          <button class="btn primary" data-act="m-ok" autofocus>${ico('spark')}Start</button></div>`,
      handlers: {
        'm-cancel': () => closeModal(),
        'm-ok': () => {
          const ids = $$('#modal .result input:checked').map((el) => el.dataset.id);
          if (!ids.length) return toast('Tick at least one application.', 'bad');
          if (ids.length + R.tabs.filter((t) => !ids.includes(t.programId)).length > MAX_TABS) return toast(`That is more than ${MAX_TABS} tabs at once. Untick a few and run them next.`, 'bad');
          closeModal();
          runBatch(ids);
        },
      },
    });
  }

  const uniSearchHtml = (kind, placeholder) =>
    `<div class="tagwrap uni-search">${ico('search')}<input class="input" data-uni-search="${kind}" placeholder="${esc(placeholder)}" autocomplete="off" spellcheck="false" aria-label="${esc(placeholder)}">
      <div class="tag-suggest" role="listbox" hidden></div></div>`;

  function renderPrograms() {
    const groups = groupedPrograms();
    const list = S.programs;
    const active = list.filter((p) => p.status === 'in_progress' || p.status === 'ready').length;
    const submitted = list.filter((p) => p.status === 'submitted').length;
    const upcoming = list
      .filter((p) => p.status !== 'submitted' && nextDate(p))
      .map((p) => ({ p, d: nextDate(p) }))
      .sort((a, b) => (a.d.date < b.d.date ? -1 : 1))[0];

    const head = `
      <div class="view-head">
        <div class="grow">
          <h1>Your applications</h1>
          <div class="sub">${esc(levelsText(S.levels))}${S.field ? ` in ${esc(S.field)}` : ' applications'}${list.length ? ` · ${plural(groups.length, 'university', 'universities')} · ${plural(list.length, 'application')}` : ''}</div>
        </div>
        <div class="actions">
          ${list.some(canBatch) ? `<button class="btn dark" data-act="batch" title="Open several applications and fill them one after another">${ico('spark')}Start all…</button>` : ''}
          <button class="btn primary" data-act="find-programs">${ico('search')}Find programs for me</button>
        </div>
      </div>
      ${uniSearchHtml('page', 'Search for a university to add, e.g. Michigan, LSE, ETH')}`;

    let keyBanner = '';
    if (!R.hasKey && !usesApp()) {
      keyBanner = `<div class="banner"><div class="grow"><strong>No AI is connected yet.</strong> Tassel can fill in the basics from your profile, but it needs an AI to find programs, answer the rest of each form and draft essays. Connect the AI app you already use, or add an API key.</div><button class="btn sm dark" data-act="go" data-view="settings">Connect an AI</button></div>`;
    } else if (!R.hasKey) {
      keyBanner = `<div class="banner calm"><div class="grow"><strong>Your AI app does the AI work.</strong> Ask it things like “Use Tassel to find programs for me” or “fill in my application”.</div><button class="btn sm" data-act="say">What can I ask?</button></div>`;
    }

    if (!list.length) {
      return `<div class="view-inner">${head}${keyBanner}
        <div class="card empty">
          ${mark('mark-big')}
          <h2>Start your list</h2>
          <p>Search for a university above, or let Tassel find programs that fit what you want to study. You can apply to several programs at the same university.</p>
          <div class="actions">
            <button class="btn primary lg" data-act="find-programs">${ico('search')}Find programs for me</button>
            <button class="btn lg" data-act="add-program">${ico('plus')}Add one by hand</button>
          </div>
          <div class="tiny">Want to see it work first? <button class="link" data-act="practice">Try the practice application</button> – nothing is sent anywhere.</div>
        </div></div>`;
    }

    const byTier = S.settings.groupBy === 'tier';
    const tierCards = ['reach', 'target', 'safer', '']
      .map((t) => {
        const apps = sortedPrograms().filter((p) => (p.tier || '') === t);
        if (!apps.length) return '';
        return `<div class="card uni"><div class="uni-head tier-head"><span class="pill ${t ? TIER_CLASS[t] : ''}">${t ? TIERS[t] : 'Not sorted yet'}</span>
            <div class="grow uni-sub">${esc(t ? TIER_HELP[t] : 'Tassel sorts the programs it finds for you. Sort these yourself with the pencil, or ask your AI to.')}</div>
            <span class="uni-sub">${plural(apps.length, 'application')}</span></div>
          ${apps.map((p) => applicationRowHtml(p, true)).join('')}</div>`;
      })
      .join('');

    const cards = groups
      .map((g) => {
        const first = g.apps[0];
        const domain = g.apps.map(domainFor).find(Boolean) || '';
        const country = g.apps.map((a) => a.country).find(Boolean) || '';
        return `<div class="card uni">
          <div class="uni-head">
            ${logoHtml(g.name, domain, 'crest')}
            <div class="grow"><div class="uni-name">${esc(g.name)}</div>
              <div class="uni-sub">${[country, domain].filter(Boolean).map(esc).join(' · ') || '&nbsp;'}${g.apps.length > 1 ? ` · ${g.apps.length} applications` : ''}</div></div>
            <button class="btn sm ghost" data-act="add-program" data-uni="${esc(first.university)}">${ico('plus')}Add a program</button>
          </div>
          ${g.apps.map((p) => applicationRowHtml(p)).join('')}
        </div>`;
      })
      .join('');

    return `<div class="view-inner">${head}${keyBanner}
      <div class="stats">
        <div class="card stat"><div class="n">${list.length}</div><div class="l">${list.length === 1 ? 'Application' : 'Applications'} at ${plural(groups.length, 'university', 'universities')}</div></div>
        <div class="card stat"><div class="n">${active}</div><div class="l">In progress</div></div>
        <div class="card stat"><div class="n">${submitted}</div><div class="l">Submitted</div></div>
        <div class="card stat"><div class="n small">${upcoming ? esc(fmtDay(upcoming.d.date)) : '–'}</div><div class="l">${upcoming ? `Next date · ${esc(upcoming.p.university)}` : 'Next date'}</div></div>
      </div>
      ${batchBoardHtml()}
      <div class="list-bar">
        <div class="mix">${mixHtml()}</div>
        <div class="seg small" role="group" aria-label="Group by"><button class="${byTier ? '' : 'on'}" data-act="group-by" data-by="university">By university</button><button class="${byTier ? 'on' : ''}" data-act="group-by" data-by="tier">By chance</button></div>
      </div>
      <div class="uni-list">${byTier ? tierCards : cards}</div>
      <p class="hint" style="margin-top:18px"><button class="link" data-act="add-program">Add one by hand</button> · New here? <button class="link" data-act="practice">Try the practice application</button> to watch Tassel fill in a form. Nothing is sent anywhere.</p>
    </div>`;
  }

  const normUrl = (u) => {
    u = String(u || '').trim();
    if (!u) return '';
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(u)) u = 'https://' + u;
    try {
      const parsed = new URL(u);
      return /^https?:$/.test(parsed.protocol) ? parsed.href : '';
    } catch {
      return '';
    }
  };

  /* ---- University search box (on the page and in the dialog) ---- */
  const uniSg = { input: null, items: [], index: -1 };
  function paintUniSuggest() {
    const input = uniSg.input;
    const box = input && input.closest('.tagwrap') && $('.tag-suggest', input.closest('.tagwrap'));
    if (!box) return;
    box.hidden = !uniSg.items.length;
    box.innerHTML = uniSg.items
      .map(({ u }, i) => `<button type="button" class="sg ${i === uniSg.index ? 'on' : ''}" role="option" data-act="uni-pick" data-i="${i}">${esc(u[0])}<span class="sg-sub">${esc(u[1])}</span></button>`)
      .join('');
  }
  function showUniSuggest(input) {
    uniSg.input = input;
    uniSg.items = searchUnis(input.value);
    // Pre-select only a sure thing ("LSE", a full name). Otherwise Enter keeps what was typed.
    uniSg.index = uniSg.items.length && uniSg.items[0].exact ? 0 : -1;
    paintUniSuggest();
  }
  function hideUniSuggest() {
    uniSg.items = [];
    uniSg.index = -1;
    for (const box of $$('.uni-search .tag-suggest, .uni-field .tag-suggest')) box.hidden = true;
  }
  function pickUni(u, input) {
    hideUniSuggest();
    if (input && input.dataset.uniSearch === 'dialog') {
      input.value = u[0];
      if ($('#pgCountry') && !$('#pgCountry').value.trim()) $('#pgCountry').value = u[1];
      if ($('#pgSite')) $('#pgSite').value = u[2];
      if ($('#pgProg')) $('#pgProg').focus();
      return;
    }
    if (input) input.value = '';
    programDialog(null, { university: u[0], country: u[1], website: u[2] });
  }
  // Enter in the page's search box with nothing highlighted: use what was typed.
  function addTypedUni(input) {
    const typed = input.value.trim();
    if (!typed) return;
    const known = findUni(typed);
    if (known) return pickUni(known, input);
    hideUniSuggest();
    input.value = '';
    programDialog(null, { university: typed });
  }

  function programDialog(id, preset) {
    const p = id ? programById(id) : null;
    const base = p || { university: '', program: '', url: '', deadline: '', country: '', website: '', fee: '', note: '', extraDeadlines: [], level: (S.levels && S.levels[0]) || 'masters', ...(preset || {}) };
    const sameUni = !p && preset && preset.university ? siblings({ university: preset.university })[0] : null;
    if (sameUni) {
      base.country = base.country || sameUni.country;
      base.website = base.website || sameUni.website;
    }
    const st = { level: LEVELS[base.level] ? base.level : 'masters', levelTouched: !!p, tier: tierOf(base.tier) };
    const dateRow = (d) => `<div class="date-row"><input class="input" data-date-label value="${esc(d.label || '')}" placeholder="What is it? e.g. Funding deadline" aria-label="Date name">
      <input class="input" type="date" data-date-day value="${esc(d.date || '')}" aria-label="Date"><button type="button" class="icon-btn" data-act="m-date-x" title="Remove this date" aria-label="Remove this date">${ico('x')}</button></div>`;
    const showLevel = () => {
      for (const b of $$('#pgLevel button')) b.classList.toggle('on', b.dataset.level === st.level);
    };
    const startLevel = st.level;
    openModal({
      wide: true,
      // Typing "PhD" in the program name flips the level for you, until you choose one by hand.
      onInput: (el) => {
        if (el.id !== 'pgProg' || st.levelTouched) return;
        st.level = levelFromName(el.value) === 'phd' ? 'phd' : startLevel;
        showLevel();
      },
      html: `
        <div class="dialog-head"><div class="grow"><h2>${p ? 'Edit application' : preset && preset.university ? `Add a program at ${esc(preset.university)}` : 'Add an application'}</h2>
          <p>One entry per program. Add several for the same university if you are applying to more than one.</p></div></div>
        <div class="dialog-body"><div class="grid">
          <div class="field w12 uni-field"><span>University</span><div class="tagwrap"><input id="pgUni" data-uni-search="dialog" value="${esc(base.university)}" placeholder="Start typing, e.g. Michigan, LSE, ETH" autocomplete="off" spellcheck="false" ${base.university ? '' : 'autofocus'}>
            <div class="tag-suggest" role="listbox" hidden></div></div></div>
          <label class="field w8"><span>Program</span><input id="pgProg" value="${esc(base.program)}" placeholder="e.g. MSc Economics, PhD in Economics" ${base.university ? 'autofocus' : ''}></label>
          <div class="field w4"><span>Level</span><div class="seg" id="pgLevel">${Object.entries(LEVELS)
            .map(([k, v]) => `<button type="button" class="${st.level === k ? 'on' : ''}" data-act="m-level" data-level="${k}">${v}</button>`)
            .join('')}</div></div>
          <label class="field w12"><span>Application link <em>(optional, you can add it later)</em></span><input id="pgUrl" value="${esc(base.url)}" placeholder="https://…"></label>
          <label class="field w4"><span>Application deadline <em>(optional)</em></span><input id="pgDeadline" type="date" value="${esc(base.deadline)}"></label>
          <label class="field w4"><span>Fee <em>(optional)</em></span><input id="pgFee" value="${esc(base.fee)}" placeholder="e.g. $90"></label>
          <label class="field w4"><span>Country <em>(optional)</em></span><input id="pgCountry" value="${esc(base.country)}"></label>
          <div class="field w12"><span>Other dates <em>(funding, recommendations, interviews)</em></span>
            <div id="pgDates">${(base.extraDeadlines || []).map(dateRow).join('')}</div>
            <div><button type="button" class="link" data-act="m-date-add">${ico('plus')} Add a date</button></div></div>
          <div class="field w6"><span>Your chances <em>(an estimate to plan with)</em></span><div class="seg" id="pgTier">${[['', 'Not set'], ...Object.entries(TIERS)].map(([k, v]) => `<button type="button" class="${st.tier === k ? 'on' : ''}" data-act="m-tier" data-tier="${k}" title="${esc(TIER_HELP[k] || '')}">${v}</button>`).join('')}</div></div>
          <label class="field w6"><span>Why <em>(optional)</em></span><input id="pgFit" value="${esc(base.fit || '')}" placeholder="e.g. GPA above their average, GRE a little below"></label>
          <label class="field w6"><span>University website <em>(for its logo)</em></span><input id="pgSite" value="${esc(base.website)}" placeholder="e.g. umich.edu"></label>
          <label class="field w6"><span>Note <em>(optional)</em></span><input id="pgNote" value="${esc(base.note)}" placeholder="Anything you want to remember"></label>
        </div><p class="hint" id="pgErr" style="color:var(--red);margin-top:10px" hidden></p></div>
        <div class="dialog-foot">
          <button class="btn ghost" data-act="m-cancel">Cancel</button>
          <button class="btn primary" data-act="m-save">${p ? 'Save' : 'Add to my list'}</button>
        </div>`,
      handlers: {
        'm-cancel': () => closeModal(),
        'm-level': (el) => {
          st.level = el.dataset.level;
          st.levelTouched = true;
          showLevel();
        },
        'm-tier': (el) => {
          st.tier = el.dataset.tier;
          for (const b of $$('#pgTier button')) b.classList.toggle('on', b === el);
        },
        'm-date-add': () => {
          $('#pgDates').insertAdjacentHTML('beforeend', dateRow({}));
          const rows = $$('#pgDates [data-date-label]');
          rows[rows.length - 1].focus();
        },
        'm-date-x': (el) => el.closest('.date-row').remove(),
        'm-save': () => {
          hideUniSuggest();
          const typedUni = $('#pgUni').value.trim();
          const known = findUni(typedUni);
          const university = known ? known[0] : typedUni;
          const program = $('#pgProg').value.trim();
          const rawUrl = $('#pgUrl').value.trim();
          const url = normUrl(rawUrl);
          const rawSite = $('#pgSite').value.trim();
          const website = rawSite ? hostOf(normUrl(rawSite)) : known ? known[2] : '';
          const err = $('#pgErr');
          const fail = (msg, sel) => {
            err.textContent = msg;
            err.hidden = false;
            $(sel).focus();
          };
          if (!university) return fail('Enter the university name.', '#pgUni');
          if (!program) return fail('Enter the program name.', '#pgProg');
          if (rawUrl && !url) return fail('That link does not look right. It should start with https://', '#pgUrl');
          if (rawSite && !website) return fail('That website does not look right. Try something like umich.edu', '#pgSite');
          const clash = S.programs.find((x) => x !== p && norm(x.university) === norm(university) && norm(x.program) === norm(program));
          if (clash) return fail('That program at that university is already on your list.', '#pgProg');
          const extraDeadlines = $$('#pgDates .date-row')
            .map((row) => ({ label: $('[data-date-label]', row).value.trim() || 'Other date', date: $('[data-date-day]', row).value }))
            .filter((d) => validDay(d.date));
          // Typing "PhD" in the name is enough to mark it a PhD, unless the level was chosen by hand.
          const level = st.level;
          const data = { university, program, level, tier: st.tier, fit: $('#pgFit').value.trim(), url, website, deadline: $('#pgDeadline').value, extraDeadlines, fee: $('#pgFee').value.trim(), country: $('#pgCountry').value.trim() || (known ? known[1] : ''), note: $('#pgNote').value.trim() };
          if (p) {
            Object.assign(p, data);
            if (level === 'phd') for (const label of CHECK_PHD) if (!p.checklist.some((c) => norm(c.label) === norm(label))) p.checklist.push({ id: uid(), label, done: false });
          } else {
            S.programs.push(newApplication(data));
          }
          // One website per university: keep its applications in step so they share a logo.
          if (website) for (const x of siblings({ university })) x.website = website;
          save();
          closeModal();
          refreshHome();
          toast(p ? 'Saved.' : `${program} at ${university} added.`);
        },
      },
    });
  }

  const REGIONS = ['United States', 'United Kingdom', 'Canada', 'Germany', 'Netherlands', 'Australia', 'Europe', 'Asia', 'Anywhere'];

  function findDialog() {
    if (!R.hasKey) return needsAi('find');
    const st = { phase: 'form', fields: [...S.fields], countries: [...S.countries], levels: [...S.levels], count: 12, mix: 'balanced', notes: '', results: [], error: '', token: 0 };
    const keepNotes = () => {
      if ($('#fdNotes')) st.notes = $('#fdNotes').value.trim();
    };
    TAGSETS['find-fields'] = { ...FIELD_TAGS, get: () => st.fields, set: (v) => (st.fields = v), redraw: () => (keepNotes(), setModal(formHtml())) };
    TAGSETS['find-places'] = { ...PLACE_TAGS, get: () => st.countries, set: (v) => (st.countries = v), redraw: () => (keepNotes(), setModal(formHtml())) };
    const formHtml = () => `
      <div class="dialog-head"><div class="grow"><h2>Find programs</h2><p>Tassel searches the web for real programs and where to apply.</p></div></div>
      <div class="dialog-body">
        <div class="grid">
          <div class="field w12"><span>What do you want to study? <em>Add as many fields or program titles as you like.</em></span>${tagsHtml('find-fields', { small: true, autofocus: true })}</div>
          <div class="field w12"><span>Which degree?</span><div class="chips">${Object.entries(LEVELS).map(([k, v]) => `<button type="button" class="chip ${st.levels.includes(k) ? 'on' : ''}" data-act="m-flevel" data-level="${k}">${v}</button>`).join('')}</div></div>
          <div class="field w12"><span>Where? <em>Regions, countries or cities.</em></span>${tagsHtml('find-places', { small: true })}</div>
          <div class="field w6"><span>Which schools?</span><div class="chips">${[['balanced', 'A balanced mix'], ['top', 'Top schools'], ['safer', 'Safer choices']].map(([k, v]) => `<button type="button" class="chip ${st.mix === k ? 'on' : ''}" data-act="m-mix" data-mix="${k}">${v}</button>`).join('')}</div></div>
          <div class="field w6"><span>How many?</span><div class="chips">${[8, 12, 20].map((k) => `<button type="button" class="chip ${st.count === k ? 'on' : ''}" data-act="m-count" data-count="${k}">${k}</button>`).join('')}</div></div>
          <label class="field w12"><span>Anything else? <em>(optional)</em></span><input id="fdNotes" value="${esc(st.notes)}" placeholder="e.g. one-year programs, funding available, no GRE"></label>
        </div>
        ${st.error ? `<div class="ob-note err" style="margin-top:14px">${ico('info')}<div>${esc(st.error)}</div></div>` : ''}
      </div>
      <div class="dialog-foot">
        <button class="btn ghost" data-act="m-cancel">Cancel</button>
        <button class="btn primary" data-act="m-search">${ico('search')}Search</button>
      </div>`;
    const searchingHtml = () => `
      <div class="dialog-body"><div class="searching"><span class="spin"></span>
        <h2 style="margin-top:16px">Searching for ${esc(st.fields.join(', '))} programs…</h2>
        <p>Tassel is reading university pages. This usually takes about a minute.</p></div></div>
      <div class="dialog-foot"><button class="btn ghost" data-act="m-cancel">Cancel</button></div>`;
    const resultsHtml = () => `
      <div class="dialog-head"><div class="grow"><h2>${plural(st.results.length, 'program')} found</h2><p>Untick any you don't want. Reach, target and safer are estimates from your profile, not predictions. Deadlines and links come from the web, so check them on the university's page.</p></div></div>
      <div class="dialog-body">${st.results
        .map(
          (r, i) => `
        <label class="result"><input type="checkbox" data-i="${i}" checked>
          <div class="grow"><div class="uni">${esc(r.university)}${tierOf(r.tier) ? ` <span class="pill tiny ${TIER_CLASS[tierOf(r.tier)]}">${TIERS[tierOf(r.tier)]}</span>` : ''}</div>
          <div class="deg">${esc(r.program)} · ${LEVELS[r.level] || LEVELS[levelFromName(r.program)]}${r.country ? ` · ${esc(r.country)}` : ''}${r.deadline ? ` · deadline ${esc(fmtDay(r.deadline))}` : ''}</div>
          ${r.fit || r.note ? `<div class="deg">${esc([r.fit, r.note].filter(Boolean).join(' · '))}</div>` : ''}
          <div class="url">${esc(r.url || 'No application link found – you can add one later')}</div></div>
        </label>`
        )
        .join('')}</div>
      <div class="dialog-foot">
        <button class="btn ghost" data-act="m-back">Search again</button><div class="grow"></div>
        <button class="btn ghost" data-act="m-cancel">Cancel</button>
        <button class="btn primary" data-act="m-add">Add to my list</button>
      </div>`;
    const readForm = () => {
      commitTags(); // anything typed but not yet entered still counts
      keepNotes();
    };
    openModal({
      wide: true,
      html: formHtml(),
      onClose: () => {
        st.token++;
        delete TAGSETS['find-fields'];
        delete TAGSETS['find-places'];
      },
      handlers: {
        'm-cancel': () => closeModal(),
        'm-back': () => {
          st.error = '';
          setModal(formHtml());
        },
        'm-mix': (el) => {
          readForm();
          st.mix = el.dataset.mix;
          setModal(formHtml());
        },
        'm-count': (el) => {
          readForm();
          st.count = +el.dataset.count;
          setModal(formHtml());
        },
        'm-flevel': (el) => {
          readForm();
          const k = el.dataset.level;
          const next = st.levels.includes(k) ? st.levels.filter((x) => x !== k) : [...st.levels, k];
          if (next.length) st.levels = Object.keys(LEVELS).filter((x) => next.includes(x));
          setModal(formHtml());
        },
        'm-search': async () => {
          readForm();
          if (!st.fields.length) {
            st.error = 'Say what you want to study first.';
            setModal(formHtml());
            return;
          }
          st.error = '';
          const token = ++st.token;
          setModal(searchingHtml());
          try {
            const found = await api('findPrograms', {
              model: S.settings.model,
              field: st.fields.join(', '),
              levels: st.levels,
              countries: st.countries.filter((c) => c !== 'Anywhere'),
              notes: st.notes,
              count: st.count,
              mix: st.mix,
              profile: S.profile,
              existing: S.programs.map((p) => ({ university: p.university, program: p.program })),
            });
            if (token !== st.token) return; // dialog was closed or restarted
            const have = new Set(S.programs.map((p) => norm(p.university + ' ' + p.program)));
            st.results = found.filter((r) => !have.has(norm(r.university + ' ' + r.program)));
            if (!st.results.length) {
              st.error = 'Nothing new turned up. Try a broader field or more places.';
              setModal(formHtml());
              return;
            }
            setModal(resultsHtml());
          } catch (err) {
            if (token !== st.token) return;
            st.error = err.message;
            setModal(formHtml());
          }
        },
        'm-add': () => {
          const picked = $$('#modal .result input:checked').map((el) => st.results[+el.dataset.i]);
          if (!picked.length) return toast('Tick at least one program.', 'bad');
          for (const r of picked) S.programs.push(newApplication(r));
          setFields([...S.fields, ...st.fields]); // remember anything new you searched for
          if (!S.countries.length) S.countries = st.countries;
          save();
          closeModal();
          refreshHome();
          toast(`${plural(picked.length, 'program')} added to your list.`);
        },
      },
    });
  }

  /* ---------------------------------------------------------------- */
  /* Profile                                                            */
  /* ---------------------------------------------------------------- */
  const PERSONAL = [
    ['firstName', 'First name', 4],
    ['middleName', 'Middle name', 4],
    ['lastName', 'Last name', 4],
    ['preferredName', 'Preferred name', 4],
    ['email', 'Email', 4, 'email'],
    ['phone', 'Phone', 4, 'tel', '+1 555 010 0100'],
    ['dob', 'Date of birth', 4, 'date'],
    ['gender', 'Gender', 4],
    ['citizenship', 'Citizenship', 4, 'text', 'e.g. United States'],
    ['countryOfBirth', 'Country of birth', 4],
    ['linkedin', 'LinkedIn', 4, 'text', 'https://linkedin.com/in/…'],
    ['website', 'Website', 4],
    ['address1', 'Address line 1', 8],
    ['address2', 'Address line 2', 4, 'text', 'Apt, suite, unit'],
    ['city', 'City', 4],
    ['state', 'State / Province', 4],
    ['postalCode', 'ZIP / Postal code', 4],
    ['country', 'Country', 4, 'text', 'e.g. United States'],
  ];
  const TESTS = [
    ['greVerbal', 'GRE Verbal', 3],
    ['greQuant', 'GRE Quant', 3],
    ['greWriting', 'GRE Writing', 3],
    ['greDate', 'GRE test date', 3, 'date'],
    ['gmat', 'GMAT total', 3],
    ['gmatDate', 'GMAT test date', 3, 'date'],
    ['toefl', 'TOEFL total', 3],
    ['toeflDate', 'TOEFL test date', 3, 'date'],
    ['ielts', 'IELTS overall', 3],
    ['ieltsDate', 'IELTS test date', 3, 'date'],
  ];
  const LISTS = {
    education: {
      title: 'Education',
      blurb: 'Every university you have attended, most recent first.',
      add: 'Add a school',
      name: (it) => it.institution || 'School',
      fields: [
        ['institution', 'Institution', 6],
        ['degree', 'Degree', 3, 'text', 'e.g. BA, BSc'],
        ['major', 'Major / field', 3],
        ['gpa', 'GPA / grade', 3, 'text', 'e.g. 3.7 / 4.0'],
        ['startDate', 'Started', 3, 'text', 'YYYY-MM'],
        ['endDate', 'Finished (or expected)', 3, 'text', 'YYYY-MM'],
        ['country', 'Country', 3],
      ],
    },
    experience: {
      title: 'Work and research experience',
      blurb: 'Jobs, internships, research and volunteering.',
      add: 'Add experience',
      name: (it) => it.organization || 'Experience',
      fields: [
        ['organization', 'Organization', 6],
        ['title', 'Your role', 6],
        ['startDate', 'Started', 3, 'text', 'YYYY-MM'],
        ['endDate', 'Finished', 3, 'text', 'YYYY-MM or Present'],
        ['location', 'Location', 6],
        ['description', 'What you did', 12, 'textarea', 'A few lines. Tassel uses this for forms and essays.'],
      ],
    },
    recommenders: {
      title: 'Recommenders',
      blurb: 'The people writing your letters. Tassel fills in their details when a form asks.',
      add: 'Add a recommender',
      name: (it) => it.name || 'Recommender',
      fields: [
        ['name', 'Full name', 6],
        ['title', 'Title', 6, 'text', 'e.g. Associate Professor'],
        ['organization', 'Institution / organization', 6],
        ['email', 'Email', 6, 'email'],
        ['phone', 'Phone', 6, 'tel'],
        ['relationship', 'How they know you', 6, 'text', 'e.g. Thesis advisor'],
      ],
    },
  };
  const DOCS = [
    ['cv', 'CV / Résumé'],
    ['transcript', 'Transcript'],
    ['statement', 'Statement of purpose'],
    ['testReport', 'Test score report'],
    ['passport', 'Passport copy'],
    ['writingSample', 'Writing sample'],
    ['proposal', 'Research proposal'],
    ['other', 'Other document'],
  ];

  function completeness() {
    const p = S.profile;
    const per = p.personal;
    const checks = [per.firstName, per.lastName, per.email, per.phone, per.dob, per.citizenship, per.address1, per.city, per.country, p.education.length, (p.story || '').trim().length > 40, p.documents.cv];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }

  function fieldHtml(path, [key, label, w = 4, type = 'text', ph = '']) {
    const value = getPath(`${path}.${key}`) || '';
    const cls = `field w${w}`;
    if (type === 'textarea') {
      return `<label class="${cls}"><span>${esc(label)}</span><textarea data-path="${path}.${key}" rows="3" placeholder="${esc(ph)}">${esc(value)}</textarea></label>`;
    }
    return `<label class="${cls}"><span>${esc(label)}</span><input type="${type}" data-path="${path}.${key}" value="${esc(value)}" placeholder="${esc(ph)}"></label>`;
  }

  function listHtml(kind) {
    const def = LISTS[kind];
    const items = S.profile[kind];
    return `
      <section class="card section" id="sec-${kind}">
        <div class="section-head"><div class="grow"><h2>${def.title}</h2><p>${def.blurb}</p></div>
          <button class="btn sm" data-act="list-add" data-kind="${kind}">${ico('plus')}${def.add}</button></div>
        ${items
          .map(
            (it, i) => `
          <div class="item">
            <button class="icon-btn remove" data-act="list-remove" data-kind="${kind}" data-i="${i}" title="Remove" aria-label="Remove ${esc(def.name(it))}">${ico('trash')}</button>
            <div class="item-title">${esc(def.name(it))}</div>
            <div class="grid">${def.fields.map((f) => fieldHtml(`profile.${kind}.${i}`, f)).join('')}</div>
          </div>`
          )
          .join('')}
        ${items.length ? '' : `<p class="hint">Nothing here yet.</p>`}
      </section>`;
  }

  const baseName = (p) => String(p || '').split(/[\\/]/).pop();

  function renderProfile() {
    const p = S.profile;
    return `<div class="view-inner">
      <div class="view-head">
        <div class="grow"><h1>Your profile</h1><div class="sub">Fill this in once. Tassel uses it for every application, and it never leaves this computer except to answer a form.</div></div>
        <div class="actions"><span class="saved-tick" id="savedTick">${ico('check')} Saved</span>
          <button class="btn primary" data-act="import-cv" id="importCv">${ico('upload')}Import from my CV</button></div>
      </div>

      <section class="card section"><div class="section-head"><div class="grow"><h2>About you</h2></div></div>
        <div class="grid">${PERSONAL.map((f) => fieldHtml('profile.personal', f)).join('')}</div></section>

      ${listHtml('education')}

      <section class="card section"><div class="section-head"><div class="grow"><h2>Test scores</h2><p>Leave blank any test you have not taken.</p></div></div>
        <div class="grid">${TESTS.map((f) => fieldHtml('profile.tests', f)).join('')}</div></section>

      ${listHtml('experience')}
      ${listHtml('recommenders')}

      <section class="card section"><div class="section-head"><div class="grow"><h2>Research</h2>
        <p>For PhD and research-based master's applications. Leave blank if it does not apply.</p></div></div>
        <div class="grid">
          <label class="field w12"><span>Research interests</span><textarea data-path="profile.research.interests" rows="3" placeholder="The questions and areas you want to work on, and the methods you use.">${esc((p.research || {}).interests || '')}</textarea></label>
          <label class="field w12"><span>Publications, theses and presentations</span><textarea data-path="profile.research.publications" rows="3" placeholder="One per line: title, where, year.">${esc((p.research || {}).publications || '')}</textarea></label>
        </div></section>

      <section class="card section"><div class="section-head"><div class="grow"><h2>Your story</h2>
        <p>In your own words: what you want to study and why, what you have done that you are proud of, and where you are headed. Essay drafts are built from this, so the more specific you are, the more they sound like you.</p></div></div>
        <textarea class="input" data-path="profile.story" rows="8" placeholder="I want to study… because…">${esc(p.story)}</textarea></section>

      <section class="card section"><div class="section-head"><div class="grow"><h2>Documents</h2><p>Tassel attaches these when an application asks for an upload.</p></div></div>
        ${DOCS.map(([key, label]) => {
          const path = p.documents[key];
          return `<div class="doc-row" data-doc="${key}"><div class="name">${esc(label)}</div>
            <div class="file ${path ? 'has' : ''}" title="${esc(path || '')}">${path ? esc(baseName(path)) : 'Not added'}</div>
            <button class="btn sm" data-act="doc-pick" data-key="${key}">${path ? 'Replace' : 'Choose file'}</button>
            ${path ? `<button class="icon-btn" data-act="doc-clear" data-key="${key}" title="Remove" aria-label="Remove ${esc(label)}">${ico('trash')}</button>` : ''}</div>`;
        }).join('')}</section>

      <section class="card section"><div class="section-head"><div class="grow"><h2>Saved answers</h2>
        <p>When Tassel asks you something on an application, your answer is kept here and reused so you are never asked twice.</p></div></div>
        ${
          p.answers.length
            ? p.answers
                .map(
                  (a, i) => `<div class="qa-row"><div class="q selectable">${esc(a.q)}</div>
              <input class="input" data-path="profile.answers.${i}.a" value="${esc(a.a)}" aria-label="Answer">
              <button class="icon-btn" data-act="answer-remove" data-i="${i}" title="Forget this answer" aria-label="Forget this answer">${ico('trash')}</button></div>`
                )
                .join('')
            : `<p class="hint">No saved answers yet.</p>`
        }</section>
    </div>`;
  }

  async function checkDocs() {
    for (const [key] of DOCS) {
      const path = S.profile.documents[key];
      if (!path) continue;
      let ok = true;
      try {
        ok = await api('fileExists', { path });
      } catch {}
      const el = $(`.doc-row[data-doc="${key}"] .file`);
      if (el && !ok) {
        el.classList.add('missing');
        el.textContent = `${baseName(path)} – file not found, choose it again`;
      }
    }
  }

  function mergeResume(r, filePath) {
    const p = S.profile;
    let n = 0;
    for (const [k, v] of Object.entries(r.personal || {})) {
      if (v && !p.personal[k]) {
        p.personal[k] = v;
        n++;
      }
    }
    for (const [k, v] of Object.entries(r.tests || {})) {
      if (v && !p.tests[k]) {
        p.tests[k] = v;
        n++;
      }
    }
    const clean = (list, keys) => (Array.isArray(list) ? list : []).map((it) => Object.fromEntries(keys.map((k) => [k, (it && it[k]) || ''])));
    if (!p.education.length) {
      p.education = clean(r.education, LISTS.education.fields.map((f) => f[0])).filter((e) => e.institution);
      n += p.education.length;
    }
    if (!p.experience.length) {
      p.experience = clean(r.experience, LISTS.experience.fields.map((f) => f[0])).filter((e) => e.organization);
      n += p.experience.length;
    }
    if (!p.story && r.story) p.story = r.story;
    if (!p.documents.cv) keepDoc('cv', filePath); // copied into the synced folder when syncing is on
    return n;
  }

  async function importCv(button) {
    if (!R.hasKey) {
      needsAi('cv');
      return false;
    }
    let filePath = '';
    try {
      filePath = await api('pickFile', { title: 'Choose your CV (PDF)', pdfOnly: true });
    } catch (err) {
      toast(err.message, 'bad');
    }
    if (!filePath) return false;
    const original = button ? button.innerHTML : '';
    if (button) {
      button.disabled = true;
      button.innerHTML = `<span class="spin light"></span>Reading your CV…`;
    }
    try {
      const data = await api('readResume', { model: S.settings.model, filePath });
      const n = mergeResume(data, filePath);
      save();
      toast(n ? `Imported ${plural(n, 'detail')} from your CV. Check them over.` : 'Your profile already had everything in that CV.');
      return true;
    } catch (err) {
      toast(err.message, 'bad');
      return false;
    } finally {
      if (button && button.isConnected) {
        button.disabled = false;
        button.innerHTML = original;
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /* Essays                                                             */
  /* ---------------------------------------------------------------- */
  const essayById = (id) => S.essays.find((e) => e.id === id);
  const liveSource = (essay) => {
    const src = R.essaySource.get(essay.id);
    if (!src) return null;
    const tab = R.tabs.find((t) => t.id === src.tabId);
    return tab && tab.wcId ? { tab, ref: src.ref } : null;
  };

  function essayOptionsHtml(e) {
    return `<div class="options">${e.options
      .map(
        (o, i) => `<button class="option" data-act="essay-read" data-id="${e.id}" data-i="${i}">
          <span class="angle">${esc(o.angle || `Draft ${i + 1}`)}</span>
          <span class="preview">${esc(o.text)}</span>
          <span class="wc">${words(o.text)} words · click to read</span></button>`
      )
      .join('')}</div>`;
  }

  function essayCardHtml(e) {
    const prog = programById(e.programId);
    const drafting = R.drafting.has(e.id);
    const hasText = !!(e.text || e.manual);
    const showOptions = e.options && e.options.length && (e.showOptions || !hasText);
    const wc = words(e.text);
    const over = e.wordLimit && wc > e.wordLimit;
    const live = liveSource(e);
    let body = '';
    if (drafting) body += `<div class="working"><span class="spin"></span>Writing three drafts from your profile…</div>`;
    if (!drafting && showOptions) body += essayOptionsHtml(e);
    if (!drafting && !hasText && !(e.options && e.options.length)) {
      body += `<div class="essay-foot" style="margin-top:14px">
        <button class="btn primary" data-act="essay-draft" data-id="${e.id}">${ico('spark')}Draft 3 options</button>
        <button class="btn ghost" data-act="essay-manual" data-id="${e.id}">Write it myself</button></div>`;
    }
    if (hasText) {
      body += `<textarea class="final" data-essay="${e.id}" placeholder="Write your answer here…" spellcheck="true">${esc(e.text)}</textarea>
        <div class="essay-foot">
          <span class="wc ${over ? 'over' : ''}" data-wc="${e.id}">${wc} words${e.wordLimit ? ` of ${e.wordLimit}` : ''}</span><div class="grow"></div>
          ${e.options && e.options.length && !showOptions ? `<button class="btn sm ghost" data-act="essay-options" data-id="${e.id}">See the drafts</button>` : ''}
          <button class="btn sm" data-act="essay-copy" data-id="${e.id}">${ico('copy')}Copy</button>
          ${live ? `<button class="btn sm primary" data-act="essay-insert" data-id="${e.id}">Put it in the application</button>` : ''}
        </div>`;
    }
    if (!drafting && (hasText || (e.options && e.options.length))) {
      body += `<div class="steer"><input class="input" data-steer="${e.id}" placeholder="Tell Tassel what to change, e.g. more about my thesis, less formal" aria-label="Guidance for a redraft">
        <button class="btn" data-act="essay-draft" data-id="${e.id}">${ico('spark')}${e.options && e.options.length ? 'Redraft' : 'Draft 3 options'}</button></div>`;
    }
    return `<div class="card essay" data-essay-card="${e.id}">
      <div class="essay-top"><div class="grow">
        <div class="for">${esc(programName(prog))}</div>
        <div class="prompt selectable">${esc(e.prompt)}</div>
        <div class="limit">${e.wordLimit ? `Up to ${e.wordLimit} words` : 'No word limit given'}${e.text ? ' · answered' : ''}</div></div>
        <button class="icon-btn" data-act="essay-remove" data-id="${e.id}" title="Remove" aria-label="Remove this prompt">${ico('trash')}</button></div>
      ${body}</div>`;
  }

  function renderEssays() {
    const head = `<div class="view-head"><div class="grow"><h1>Essays</h1>
      <div class="sub">Every written prompt across your applications. Tassel drafts three takes; you pick one and make it yours.</div></div>
      <div class="actions"><button class="btn" data-act="essay-add">${ico('plus')}Add a prompt</button></div></div>`;
    if (!S.essays.length) {
      return `<div class="view-inner">${head}<div class="card empty">${mark('mark-big')}<h2>No prompts yet</h2>
        <p>When Tassel finds an essay question on an application, it lands here. You can also paste a prompt in yourself.</p>
        <div class="actions"><button class="btn primary lg" data-act="essay-add">${ico('plus')}Add a prompt</button></div></div></div>`;
    }
    const order = [...S.essays].sort((a, b) => Number(!!a.text) - Number(!!b.text));
    return `<div class="view-inner">${head}
      <p class="hint" style="margin:-8px 0 16px">Drafts are a starting point built only from your profile. Edit them until they are true and sound like you, and check each program's rules on AI help.</p>
      ${order.map(essayCardHtml).join('')}</div>`;
  }

  function essayDialog() {
    openModal({
      html: `
        <div class="dialog-head"><div class="grow"><h2>Add a prompt</h2><p>Paste the question exactly as the application asks it.</p></div></div>
        <div class="dialog-body"><div class="grid">
          <label class="field w12"><span>Which program?</span><select id="esProg"><option value="">General (any program)</option>${S.programs.map((p) => `<option value="${p.id}">${esc(programName(p))}</option>`).join('')}</select></label>
          <label class="field w12"><span>The prompt</span><textarea id="esPrompt" rows="4" placeholder="e.g. Describe your reasons for pursuing graduate study…" autofocus></textarea></label>
          <label class="field w6"><span>Word limit <em>(optional)</em></span><input id="esLimit" type="number" min="0" step="50" placeholder="e.g. 500"></label>
        </div></div>
        <div class="dialog-foot"><button class="btn ghost" data-act="m-cancel">Cancel</button><button class="btn primary" data-act="m-save">Add prompt</button></div>`,
      handlers: {
        'm-cancel': () => closeModal(),
        'm-save': () => {
          const prompt = $('#esPrompt').value.trim();
          if (!prompt) return $('#esPrompt').focus();
          S.essays.push({ id: uid(), programId: $('#esProg').value || null, prompt, wordLimit: Math.max(0, parseInt($('#esLimit').value, 10) || 0), options: [], chosen: null, text: '' });
          save();
          closeModal();
          refreshHome();
        },
      },
    });
  }

  async function draftEssay(id) {
    const e = essayById(id);
    if (!e || R.drafting.has(id)) return;
    if (!R.hasKey) return needsAi('essay', e.prompt);
    const steerEl = $(`[data-steer="${id}"]`);
    const steer = steerEl ? steerEl.value.trim() : '';
    const prog = programById(e.programId);
    R.drafting.add(id);
    repaintEssay(id);
    try {
      const options = await api('draftEssays', {
        model: S.settings.model,
        profile: S.profile,
        field: S.field,
        program: prog ? { university: prog.university, program: prog.program } : null,
        prompt: e.prompt,
        wordLimit: e.wordLimit,
        steer,
      });
      e.options = options;
      e.chosen = null;
      e.showOptions = true;
      save();
    } catch (err) {
      toast(err.message, 'bad');
    } finally {
      R.drafting.delete(id);
      repaintEssay(id);
    }
  }

  async function insertEssay(e, quiet) {
    const live = liveSource(e);
    if (!live || !e.text) return false;
    try {
      const res = await api('applyFills', { wcId: live.tab.wcId, fills: [{ ref: live.ref, value: e.text }] });
      if (res[0] && res[0].ok) {
        if (!quiet) toast('Your answer is in the application.');
        return true;
      }
      if (!quiet) toast((res[0] && res[0].note) || 'Could not put the answer on the page.', 'bad');
    } catch (err) {
      if (!quiet) toast(err.message, 'bad');
    }
    return false;
  }

  async function useDraft(id, i) {
    const e = essayById(id);
    if (!e || !e.options[i]) return;
    e.text = e.options[i].text;
    e.chosen = i;
    e.manual = false;
    e.showOptions = false;
    save();
    const live = liveSource(e);
    const inserted = await insertEssay(e, true);
    if (inserted && live) addLog(live.tab, { tone: 'good', text: `Essay added: “${e.options[i].angle || 'your draft'}”. Edit it any time under Essays.` });
    toast(inserted ? 'Draft chosen and added to the application.' : 'Draft chosen. You can edit it under Essays.');
    repaintEssay(id);
    if (inserted && live) maybeAutoAdvance(live.tab);
  }

  function readDraft(id, i) {
    const e = essayById(id);
    const o = e && e.options[i];
    if (!o) return;
    const wc = words(o.text);
    openModal({
      wide: true,
      html: `
        <div class="dialog-head"><div class="grow"><h2>${esc(o.angle || `Draft ${i + 1}`)}</h2>
          <p>${wc} words${e.wordLimit ? ` · limit ${e.wordLimit}` : ''}. Anything in [square brackets] is a detail only you can add.</p></div></div>
        <div class="dialog-body"><div class="reader">${esc(o.text)}</div></div>
        <div class="dialog-foot"><button class="btn ghost" data-act="m-cancel">Back</button>
          <button class="btn primary" data-act="m-ok" autofocus>Use this draft</button></div>`,
      handlers: {
        'm-cancel': () => closeModal(),
        'm-ok': () => {
          closeModal();
          useDraft(id, i);
        },
      },
    });
  }

  // Re-render wherever this essay is on screen (Essays view and/or the side panel).
  function repaintEssay(id) {
    const card = $(`[data-essay-card="${id}"]`);
    const e = essayById(id);
    if (card && e) card.outerHTML = essayCardHtml(e);
    renderSide();
    const tab = activeTab();
    if (tab) renderAgent(tab);
  }

  /* ---------------------------------------------------------------- */
  /* Settings                                                           */
  /* ---------------------------------------------------------------- */
  const MODEL_COPY = {
    'claude-opus-5-5': ['Most careful', 'Best on tricky forms and essays. Recommended.'],
    'claude-sonnet-5-5': ['Balanced', 'A little quicker, still strong.'],
    'claude-haiku-5-5': ['Fastest', 'Quickest and cheapest. Fine for simple forms.'],
  };
  const currentModel = () => (R.info.models[S.settings.model] ? S.settings.model : R.info.defaultModel);

  function renderSettings() {
    const model = currentModel();
    return `<div class="view-inner">
      <div class="view-head"><div class="grow"><h1>Settings</h1></div></div>

      <section class="card section" id="sec-app"><div class="section-head"><div class="grow"><h2>Connect your AI app <span class="pill good">No API key</span></h2>
        <p>Use the AI app you already have. It connects to Tassel through MCP and works inside Tassel for you: it can build your profile from a conversation, find programs, fill in applications and draft essays. Tassel's limits still apply to it: it cannot submit, pay, sign, or type passwords.</p></div></div>
        ${connectHtml()}
        <div class="say-list"><div class="field"><span>Things to say to it</span></div>${['profile', 'cv', 'find', 'fill', 'all'].map((k) => promptRow(k)).join('')}</div>
      </section>

      <section class="card section" id="sec-ai"><div class="section-head"><div class="grow"><h2>Or use an API key</h2>
        <p>With an Anthropic API key, Tassel's built-in AI does the work itself: one press of Fill this page, Autopilot, program search and essay drafts inside the app. The key is stored encrypted on this computer and only ever sent to Anthropic.</p></div></div>
        ${
          R.hasKey
            ? `<div class="doc-row"><div class="name" style="display:flex;align-items:center;gap:8px;color:var(--green-ink)">${ico('check')} AI connected</div><div class="file" id="keyMsg">Your key is saved on this computer.</div>
               <button class="btn sm" data-act="key-test">Test</button><button class="btn sm danger" data-act="key-remove">Remove key</button></div>`
            : `<div class="grid"><label class="field w8"><span>Anthropic API key</span><input id="keyInput" type="password" placeholder="sk-ant-…" autocomplete="off" spellcheck="false"></label>
               <div class="field w4"><span>&nbsp;</span><button class="btn primary" data-act="key-save">Save key</button></div></div>
               <p class="hint" style="margin-top:10px" id="keyMsg">No key yet? <button class="link" data-act="ext" data-url="https://console.anthropic.com/settings/keys">Create one in the Anthropic Console ${ico('external')}</button></p>`
        }
        <div style="margin-top:18px"><div class="field"><span>How careful should Tassel be?</span></div>
        <div class="choices" style="margin-top:6px">${Object.keys(R.info.models)
          .map((id) => `<button class="choice ${id === model ? 'on' : ''}" data-act="model" data-id="${id}"><b>${esc((MODEL_COPY[id] || [id])[0])}</b><span>${esc((MODEL_COPY[id] || ['', ''])[1])} (${esc(R.info.models[id].label)})</span></button>`)
          .join('')}</div></div>
      </section>

      <section class="card section"><div class="section-head"><div class="grow"><h2>What you are applying for</h2></div></div>
        <div class="grid">
          <div class="field w12"><span>Fields or program titles <em>Add as many as you like.</em></span>${tagsHtml('set-fields', { small: true })}</div>
          <div class="field w12"><span>Where <em>Regions, countries or cities.</em></span>${tagsHtml('set-places', { small: true })}</div>
          <div class="field w6"><span>Degree</span><div class="chips">${Object.entries(LEVELS).map(([k, v]) => `<button class="chip ${S.levels.includes(k) ? 'on' : ''}" data-act="level" data-level="${k}">${v}</button>`).join('')}</div></div>
          <label class="field w6"><span>Intended start</span><input data-path="term" value="${esc(S.term)}" placeholder="e.g. Fall 2027"></label>
        </div></section>

      <section class="card section" id="sec-sync"><div class="section-head"><div class="grow"><h2>Use Tassel on more than one device</h2>
        <p>Keep Tassel's data in a folder that already syncs between your computers (OneDrive, iCloud Drive, Dropbox, Google Drive), and point Tassel at that same folder on each one. Your documents travel with it. Your AI key and university sign-ins stay on each device.</p></div></div>
        ${
          R.sync.enabled
            ? `<div class="doc-row"><div class="name" style="display:flex;align-items:center;gap:8px;color:var(--green-ink)">${ico('check')} Syncing</div>
                <div class="file has selectable" title="${esc(R.sync.dir)}">${esc(R.sync.dir)}</div>
                <button class="btn sm" data-act="sync-choose">Change folder</button><button class="btn sm danger" data-act="sync-off">Stop syncing</button></div>
               ${R.sync.available ? '' : `<div class="ob-note err" style="margin-top:10px">${ico('info')}<div>That folder cannot be reached right now, so Tassel is using this device's last copy. Changes will go to the folder once it is back.</div></div>`}`
            : `<div class="actions"><button class="btn" data-act="sync-choose">Choose a synced folder…</button></div>`
        }
        <p class="hint" style="margin-top:10px">Use one device at a time. When you come back to a device, Tassel picks up what changed on the other one.</p></section>

      <section class="card section"><div class="section-head"><div class="grow"><h2>Your data</h2>
        <p>Your profile, applications and essays live in one file${R.sync.enabled ? ' in your synced folder' : ' on this computer'}. Sign-ins to university sites are kept in Tassel's own browser, separate from your regular browser.</p></div></div>
        <div class="actions"><button class="btn" data-act="open-data">Show my data file</button>
        <button class="btn danger" data-act="reset">Erase everything…</button></div></section>

      <section class="card section"><div class="section-head">${mark('mark')}<div class="grow" style="margin-left:4px"><h2>Tassel ${esc(R.info.version || '')}</h2>
        <p>Apply once. Everywhere. Tassel never submits an application, pays a fee, types a password or ticks a legal box. Those are always yours.</p></div></div></section>
    </div>`;
  }

  /* ---------------------------------------------------------------- */
  /* Documents, and syncing between devices                             */
  /* ---------------------------------------------------------------- */
  // Remember a document. With syncing on, Tassel copies it into the synced folder so every device has it.
  async function keepDoc(key, path) {
    let stored = path;
    try {
      stored = await api('importDoc', { path, key });
    } catch {}
    S.profile.documents[key] = stored;
    save();
  }

  // Swap everything on screen for another copy of the data (the one in the synced folder).
  function adoptState(state) {
    clearTimeout(saveTimer); // never write the old copy over the one just loaded
    saveTimer = null;
    const view = S.view;
    S = hydrate(state);
    S.view = view;
    R.openCheck = null;
    if (!R.info.models[S.settings.model]) S.settings.model = R.info.defaultModel;
    if (S.onboarded && inSetup()) {
      $('#onboard').hidden = true;
      $('#onboard').innerHTML = '';
    }
    renderTabs();
    const tab = activeTab();
    if (tab) {
      renderSide();
      paint(tab);
    } else {
      refreshHome();
    }
  }

  function syncChoiceDialog(pick) {
    return new Promise((resolve) => {
      openModal({
        html: `<div class="dialog-head"><div class="grow"><h2>That folder already has Tassel data</h2>
            <p>${esc(pick.summary || 'It was saved by Tassel on another device.')}</p><p style="margin-top:8px">Which copy should both devices use from now on?</p></div></div>
          <div class="dialog-foot"><button class="btn ghost" data-act="m-cancel">Cancel</button>
            <button class="btn" data-act="m-mine">Use this device's data</button>
            <button class="btn primary" data-act="m-theirs" autofocus>Use the folder's data</button></div>`,
        handlers: { 'm-cancel': () => closeModal(null), 'm-mine': () => closeModal('mine'), 'm-theirs': () => closeModal('theirs') },
        onClose: (r) => resolve(r || null),
      });
    });
  }

  async function chooseSyncFolder() {
    let pick;
    try {
      pick = await api('syncChoose');
    } catch (err) {
      return toast(err.message, 'bad');
    }
    if (!pick) return;
    let adopt = false;
    if (pick.hasData) {
      const choice = await syncChoiceDialog(pick);
      if (!choice) return;
      adopt = choice === 'theirs';
    }
    try {
      flush();
      const res = await api('syncEnable', { dir: pick.dir, adopt, state: S });
      R.sync = res.sync;
      adoptState(res.state);
      toast(adopt ? 'Syncing. This device now shows the data from that folder.' : 'Syncing. Your data now lives in that folder.');
    } catch (err) {
      toast(err.message, 'bad');
    }
  }

  // Did the other device save something since we last looked?
  async function checkSync() {
    if (!R.sync.enabled) return;
    try {
      const res = await api('stateCheck');
      if (!res) return;
      const was = R.sync.available;
      R.sync = res.sync;
      if (res.state) {
        adoptState(res.state);
        toast('Updated with the changes from your other device.');
      } else if (was !== R.sync.available && R.active === 'home' && S.view === 'settings') {
        refreshHome();
      }
    } catch {}
  }

  /* ---------------------------------------------------------------- */
  /* Home shell                                                         */
  /* ---------------------------------------------------------------- */
  function renderSide() {
    const pct = completeness();
    const open = S.essays.filter((e) => !e.text).length;
    const item = (view, label, icon, count, attn) =>
      `<button class="nav-item ${S.view === view ? 'active' : ''}" data-act="go" data-view="${view}">${ico(icon)}<span>${label}</span>${count ? `<span class="count ${attn ? 'attn' : ''}">${count}</span>` : ''}</button>`;
    const c = 2 * Math.PI * 15;
    $('#side').innerHTML = `
      ${item('programs', 'Applications', 'programs', S.programs.length)}
      ${item('profile', 'Profile', 'profile')}
      ${item('essays', 'Essays', 'essays', open, true)}
      ${item('letters', 'Letters', 'mail', S.programs.filter((p) => p.status !== 'submitted').reduce((sum, p) => sum + letterCounts(p).waiting, 0), true)}
      ${item('settings', 'Settings', 'settings')}
      <div class="side-spacer"></div>
      <div class="side-card">
        <div class="row">
          <svg class="ring" viewBox="0 0 38 38"><circle class="bg" cx="19" cy="19" r="15"/><circle class="fg" cx="19" cy="19" r="15" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - pct / 100)).toFixed(1)}"/></svg>
          <div><strong>Profile · ${pct}%</strong><div class="small">${pct >= 100 ? 'Tassel has what it needs.' : 'The more Tassel knows, the less it asks you.'}</div></div>
        </div>
        ${pct < 100 && S.view !== 'profile' ? `<button class="btn sm" data-act="go" data-view="profile">Finish my profile</button>` : ''}
      </div>
      <button class="key-pill ${R.hasKey || R.mcp.calls ? 'ok' : ''}" data-act="go" data-view="settings"><span class="dot"></span>${
        R.mcp.calls ? 'Your AI app is connected' : R.hasKey ? 'AI connected' : S.settings.aiApp ? 'Waiting for your AI app' : 'Connect an AI'
      }</button>`;
  }

  function renderView() {
    const view = $('#view');
    const html = S.view === 'profile' ? renderProfile() : S.view === 'letters' ? renderLetters() : S.view === 'essays' ? renderEssays() : S.view === 'settings' ? renderSettings() : renderPrograms();
    view.innerHTML = html;
    if (S.view === 'profile') checkDocs();
  }

  // Re-render the home pane, keeping the scroll position.
  function refreshHome() {
    const view = $('#view');
    const top = view.scrollTop;
    renderSide();
    renderView();
    view.scrollTop = top;
  }

  function go(view) {
    S.view = view;
    save();
    if (R.active !== 'home') switchTo('home');
    renderSide();
    renderView();
    $('#view').scrollTop = 0;
  }

  /* ---------------------------------------------------------------- */
  /* Browser tabs                                                       */
  /* ---------------------------------------------------------------- */
  const activeTab = () => R.tabs.find((t) => t.id === R.active) || null;
  const isPractice = (url) => !!R.info.practiceUrl && String(url || '').startsWith(R.info.practiceUrl);

  const MAX_TABS = 16;
  function openTab({ url, programId = null, title = '', background = false }) {
    const existing = programId && R.tabs.find((t) => t.programId === programId);
    if (existing) return switchTo(existing.id);
    if (R.tabs.length >= MAX_TABS) {
      if (!background) toast('That is a lot of tabs. Close one first.', 'bad');
      return null;
    }
    const tab = {
      id: uid(),
      programId,
      title: title || 'New tab',
      url,
      wv: null,
      wcId: null,
      loading: true,
      navigated: false,
      busy: false,
      progress: '',
      chain: false,
      armed: false,
      lastSig: '',
      pageKind: '',
      log: [],
      pending: null,
      next: null,
    };
    const wv = document.createElement('webview');
    wv.setAttribute('partition', 'persist:tassel');
    wv.setAttribute('allowpopups', '');
    wv.setAttribute('src', url);
    tab.wv = wv;
    $('#webviews').appendChild(wv);

    wv.addEventListener('dom-ready', () => {
      try {
        tab.wcId = wv.getWebContentsId();
      } catch {}
      if (R.active === tab.id) renderToolbar(tab);
    });
    wv.addEventListener('did-start-loading', () => {
      tab.loading = true;
      renderTabs();
      if (R.active === tab.id) renderToolbar(tab);
    });
    wv.addEventListener('did-stop-loading', () => {
      tab.loading = false;
      renderTabs();
      if (R.active === tab.id) renderToolbar(tab);
      // Autopilot: once you have started Tassel on this application, it fills each new page as it opens.
      if (tab.navigated && S.settings.autopilot && tab.armed && !tab.chain && !tab.busy) {
        tab.navigated = false;
        setTimeout(() => {
          if (R.tabs.includes(tab) && !tab.busy && !tab.chain) fillAndAdvance(tab);
        }, 900);
      }
      tab.navigated = false;
    });
    wv.addEventListener('did-navigate', (e) => {
      tab.url = e.url;
      tab.navigated = true;
      if (!tab.chain) {
        tab.pending = null;
        tab.next = null;
        tab.pageKind = '';
      }
      if (R.active === tab.id) {
        renderToolbar(tab);
        renderAgent(tab);
      }
    });
    wv.addEventListener('did-navigate-in-page', (e) => {
      if (!e.isMainFrame) return;
      tab.url = e.url;
      if (R.active === tab.id) renderToolbar(tab);
    });
    wv.addEventListener('page-title-updated', (e) => {
      tab.pageTitle = e.title;
      if (!tab.programId && !isPractice(tab.url)) tab.title = e.title || tab.title;
      renderTabs();
    });
    wv.addEventListener('did-fail-load', (e) => {
      if (!e.isMainFrame || e.errorCode === -3) return;
      tab.loading = false;
      addLog(tab, { tone: 'bad', text: `This page could not be loaded (${e.errorDescription || 'error ' + e.errorCode}). Check the link or your connection.` });
    });

    R.tabs.push(tab);
    if (background) renderTabs();
    else switchTo(tab.id);
    return tab;
  }

  function closeTab(id) {
    const i = R.tabs.findIndex((t) => t.id === id);
    if (i < 0) return;
    const [tab] = R.tabs.splice(i, 1);
    tab.wv.remove();
    for (const [essayId, src] of R.essaySource) if (src.tabId === id) R.essaySource.delete(essayId);
    if (R.active === id) switchTo(R.tabs[i] ? R.tabs[i].id : R.tabs[i - 1] ? R.tabs[i - 1].id : 'home');
    else renderTabs();
  }

  function switchTo(id) {
    R.active = id;
    const tab = activeTab();
    $('#home').classList.toggle('off', !!tab);
    $('#browser').classList.toggle('off', !tab);
    for (const t of R.tabs) t.wv.classList.toggle('active', t === tab);
    renderTabs();
    if (tab) {
      renderToolbar(tab);
      renderAgent(tab);
    } else {
      refreshHome();
    }
  }

  function renderTabs() {
    $('#homeTab').classList.toggle('active', R.active === 'home');
    $('#tabs').innerHTML = R.tabs
      .map((t) => {
        const prog = programById(t.programId);
        const name = prog ? prog.university : t.title;
        // Two applications at one university: say which program each tab is.
        const label = prog && siblings(prog).length > 1 ? `${prog.university} · ${prog.program}` : name;
        const dot = prog ? logoHtml(name, domainFor(prog), 'tab-dot') : `<span class="tab-dot" style="background:${crestColor(name)}">${esc(initial(name))}</span>`;
        return `<div class="tab ${t.id === R.active ? 'active' : ''}" data-act="tab" data-id="${t.id}" role="tab" tabindex="0" title="${esc(prog ? programName(prog) : t.title)}">
          ${t.loading || t.busy ? '<span class="spin"></span>' : dot}
          <span class="tab-title">${esc(label)}</span>
          <button class="tab-close" data-act="tab-close" data-id="${t.id}" title="Close tab (Ctrl+W)" aria-label="Close tab">${ico('x')}</button></div>`;
      })
      .join('');
  }

  function renderToolbar(tab) {
    let back = false;
    let fwd = false;
    try {
      if (tab.wcId) {
        back = tab.wv.canGoBack();
        fwd = tab.wv.canGoForward();
      }
    } catch {}
    $('#navBack').disabled = !back;
    $('#navForward').disabled = !fwd;
    $('#navReload').innerHTML = ico(tab.loading ? 'x' : 'reload');
    $('#navReload').title = tab.loading ? 'Stop' : 'Reload';
    const input = $('#urlInput');
    if (document.activeElement !== input) input.value = isPractice(tab.url) ? 'Practice application – nothing is sent anywhere' : tab.url || '';
    $('#urlLock').innerHTML = /^https:/i.test(tab.url) ? ico('lock') : ico('info');
    $('#autopilot').checked = !!S.settings.autopilot;
    // The application's next date, always in view while you work on it.
    const chip = $('#deadlineChip');
    const app = programById(tab.programId);
    const due = app && deadlineInfo(app);
    chip.hidden = !due;
    if (due) {
      chip.className = 'pill ' + due.cls;
      chip.textContent = app.status === 'submitted' ? 'Submitted' : due.cls === 'bad' || due.text.includes(': ') ? due.text : 'Due ' + due.text;
      chip.title = due.title;
    }
    const btn = $('#fillBtn');
    btn.disabled = tab.busy;
    $('#fillIco').innerHTML = tab.busy ? '<span class="spin light"></span>' : ico('spark');
    $('#fillLabel').textContent = tab.busy ? 'Working…' : 'Fill this page';
    $('#agentToggle').classList.toggle('on', S.settings.panel !== false);
    $('#agent').classList.toggle('closed', S.settings.panel === false);
    let bar = $('#webviews .loadbar');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'loadbar';
      $('#webviews').appendChild(bar);
    }
    bar.classList.toggle('on', !!tab.loading);
  }

  /* ---------------------------------------------------------------- */
  /* Tassel side panel                                                  */
  /* ---------------------------------------------------------------- */
  function addLog(tab, entry) {
    tab.log.unshift({ at: Date.now(), ...entry });
    if (tab.log.length > 60) tab.log.length = 60;
    if (R.active === tab.id) renderAgent(tab);
  }

  const blockers = (tab) => {
    const p = tab.pending;
    if (!p) return 0;
    const essays = p.essays.filter((id) => {
      const e = essayById(id);
      return e && !e.text;
    }).length;
    // Optional uploads and optional sensitive fields are shown, but they do not hold Autopilot back.
    return (
      p.questions.length +
      essays +
      p.uploads.filter((u) => !u.done && u.required).length +
      p.left.filter((l) => l.blocking).length +
      p.failed.length
    );
  };

  // With Autopilot on, move to the next page as soon as the last thing that needed the applicant is done.
  function maybeAutoAdvance(tab) {
    if (!tab || !S.settings.autopilot || tab.busy || tab.chain || !tab.next || tab.pageKind !== 'form' || blockers(tab) > 0) return;
    setTimeout(async () => {
      if (!R.tabs.includes(tab) || tab.busy || tab.chain || !tab.next || blockers(tab) > 0 || !S.settings.autopilot) return;
      addLogQuiet(tab, { text: `That was the last thing here, so Tassel pressed “${tab.next.text}”.` });
      if (await advance(tab)) fillAndAdvance(tab, true);
    }, 700);
  }

  function questionHtml(q) {
    const choice = q.kind === 'select' || q.kind === 'radio' || q.kind === 'checkbox' || q.kind === 'multiselect';
    return `<div class="a-card need" data-q="${esc(q.ref)}">
      <div class="q-text">${esc(q.question)}</div>
      ${q.options.length ? `<div class="chips">${q.options.map((o) => `<button class="chip" data-act="q-pick" data-ref="${esc(q.ref)}" data-v="${esc(o)}" title="${esc(o)}">${esc(o)}</button>`).join('')}</div>` : ''}
      ${q.allOptions ? `<select class="input" data-change="q-select" data-ref="${esc(q.ref)}" aria-label="More choices"><option value="">More choices…</option>${q.allOptions.map((o) => `<option>${esc(o)}</option>`).join('')}</select>` : ''}
      ${choice ? '' : `<form class="row" data-submit="q-type" data-ref="${esc(q.ref)}"><input class="input" placeholder="Type your answer" aria-label="Your answer"><button class="btn sm dark" type="submit">Use</button></form>`}
      <div class="foot"><label title="Reuse this answer on other applications"><input type="checkbox" class="remember" checked> Remember</label><div class="grow"></div>
        <button class="link muted" data-act="reveal" data-ref="${esc(q.ref)}">Show on page</button>
        <button class="link muted" data-act="q-skip" data-ref="${esc(q.ref)}">Skip</button></div>
    </div>`;
  }

  function panelEssayHtml(id) {
    const e = essayById(id);
    if (!e) return '';
    if (e.text) {
      return `<div class="a-card"><div class="prompt">${esc(e.prompt)}</div>
        <div class="done-line" style="margin-top:8px">${ico('check')} Answer added</div>
        <div class="foot"><button class="link" data-act="essay-edit" data-id="${id}">Edit under Essays</button></div></div>`;
    }
    let body;
    if (R.drafting.has(id)) body = `<div class="working" style="padding:4px 0 0"><span class="spin"></span>Writing three drafts…</div>`;
    else if (e.options && e.options.length) {
      body =
        e.options
          .map((o, i) => `<button class="a-opt" data-act="essay-read" data-id="${id}" data-i="${i}"><b>${esc(o.angle || `Draft ${i + 1}`)}</b><span>${esc(o.text)}</span></button>`)
          .join('') + `<div class="foot"><button class="link muted" data-act="essay-draft" data-id="${id}">Redraft</button><div class="grow"></div><button class="link muted" data-act="reveal" data-ref="${esc((R.essaySource.get(id) || {}).ref || '')}">Show on page</button></div>`;
    } else {
      body = `<button class="btn primary sm" data-act="essay-draft" data-id="${id}" style="width:100%">${ico('spark')}Draft 3 options</button>
        <div class="foot"><button class="link muted" data-act="reveal" data-ref="${esc((R.essaySource.get(id) || {}).ref || '')}">Show on page</button><div class="grow"></div><span>or write it on the page yourself</span></div>`;
    }
    return `<div class="a-card need"><div class="prompt">${esc(e.prompt)}</div>
      <div class="limit">${e.wordLimit ? `Up to ${e.wordLimit} words` : 'Essay question'}</div>${body}</div>`;
  }

  function logHtml(entry) {
    if (entry.items) {
      const n = entry.items.length;
      return `<div class="log good"><div class="head">${ico('check')}<span class="grow">${entry.by === 'app' ? 'Your AI app filled' : 'Filled'} ${plural(n, 'field')}${entry.heading ? ` on “${esc(entry.heading)}”` : ''}</span></div>
        <details ${entry.open ? 'open' : ''}><summary>See what was entered</summary><div class="kv">${entry.items
          .map((it) => `<div class="k" title="${esc(it.label)}">${esc(it.label || 'Field')}</div><div class="v selectable" title="${esc(it.value)}">${esc(it.value)}</div>`)
          .join('')}</div></details></div>`;
    }
    return `<div class="log ${entry.tone || ''}">${esc(entry.text)}</div>`;
  }

  function renderAgent(tab) {
    const host = $('#agent');
    const prog = programById(tab.programId);
    const p = tab.pending;
    const parts = [];

    if (tab.busy) parts.push(`<div class="busy"><span class="spin light"></span><span>${esc(tab.progress || 'Working…')}</span></div>`);

    if (p) {
      const count = blockers(tab);
      if (count) parts.push(`<div class="a-title">Needs you <span class="n">${count}</span></div>`);
      parts.push(...p.questions.map(questionHtml));
      parts.push(...p.essays.map(panelEssayHtml));
      for (const u of p.uploads.filter((x) => !x.done)) {
        parts.push(`<div class="a-card ${u.required ? 'need' : ''}"><div class="q-text">${ico('file')} ${esc(u.label)}</div><div class="hint">${esc(u.note || 'Attach this file.')}</div>
          <div class="row"><button class="btn sm" data-act="upload-pick" data-ref="${esc(u.ref)}">Choose a file…</button>
          <button class="btn sm ghost" data-act="reveal" data-ref="${esc(u.ref)}">Show on page</button></div></div>`);
      }
      if (p.failed.length) {
        parts.push(`<div class="a-card need"><div class="q-text">Could not fill ${plural(p.failed.length, 'field')}</div>
          <ul class="left-list">${p.failed.map((f) => `<li><span class="what" title="${esc(f.note)}">${esc(f.label || 'Field')}</span><button class="link muted" data-act="reveal" data-ref="${esc(f.ref)}">Show</button></li>`).join('')}</ul></div>`);
      }
      if (p.left.length) {
        parts.push(`<div class="a-card"><div class="q-text">Left for you, on purpose</div>
          <ul class="left-list">${p.left.map((f) => `<li><span class="what" title="${esc(f.label)}">${esc(f.label)}</span><span class="why">${esc(f.reason.split(' - ')[0])}</span><button class="link muted" data-act="reveal" data-ref="${esc(f.ref)}">Show</button></li>`).join('')}</ul></div>`);
      }
    }

    if (!tab.log.length && !p && !tab.busy) {
      parts.push(`<div class="a-card"><div class="q-text">Here is how this works</div>
        <ol class="welcome-steps">
          <li><span>Sign in or create your account on this site. Tassel never types passwords.</span></li>
          <li><span>Open the application form.</span></li>
          <li><span>Press <b>Fill this page</b>. Tassel fills what it knows and asks you about the rest.</span></li>
        </ol></div>`);
      if (!R.hasKey && usesApp()) {
        parts.push(`<div class="a-card"><div class="q-text">Or let your AI app do it</div><div class="hint">Say this to the AI app you connected:</div>
          <div class="say-text selectable" style="margin:8px 0">${esc(PROMPTS.fill(prog ? prog.university : ''))}</div>
          <button class="btn sm" data-act="copy-text" data-text="${esc(PROMPTS.fill(prog ? prog.university : ''))}">${ico('copy')}Copy</button></div>`);
      } else if (!R.hasKey) {
        parts.push(`<div class="log warn">No AI is connected yet, so Tassel can only fill the basics (name, contact, address). <button class="link" data-act="go" data-view="settings">Connect an AI</button></div>`);
      }
    }

    if (tab.log.length) {
      parts.push(`<div class="a-title">Activity</div>`);
      parts.push(...tab.log.map(logHtml));
    }

    let foot = '';
    if (!tab.busy && tab.next) {
      const n = blockers(tab);
      foot = `<button class="btn dark" data-act="next-page">${esc(tab.next.text.length > 26 ? 'Next page' : tab.next.text)}${ico('arrow')}</button>
        <div class="hint">${n ? `${plural(n, 'thing')} above still ${n === 1 ? 'needs' : 'need'} you. You can move on anyway.` : 'Tassel presses it, then fills the next page.'}</div>`;
    } else if (!tab.busy && tab.pageKind === 'review') {
      foot = `<div class="hint">This looks like the final review. Read everything, then submit it yourself.</div>`;
    } else if (!tab.busy && tab.pageKind === 'payment') {
      foot = `<div class="hint">This is a payment page. That part is yours.</div>`;
    }

    host.innerHTML = `
      <div class="agent-head">${mark('mark')}<div class="grow"><div class="who">Tassel</div>
        <div class="where">${esc(prog ? `${programName(prog)} · ${LEVELS[prog.level]}` : isPractice(tab.url) ? 'Practice application' : tab.pageTitle || 'This page')}</div></div></div>
      <div class="agent-body">${parts.join('')}</div>
      ${foot ? `<div class="agent-foot">${foot}</div>` : ''}`;
  }

  /* ---------------------------------------------------------------- */
  /* Filling                                                            */
  /* ---------------------------------------------------------------- */
  function paint(tab) {
    renderTabs();
    if (R.active === tab.id) {
      renderToolbar(tab);
      renderAgent(tab);
    }
  }

  function saveAnswer(q, a) {
    q = String(q || '').trim();
    a = String(a || '').trim();
    if (!q || !a) return;
    const hit = S.profile.answers.find((x) => norm(x.q) === norm(q));
    if (hit) hit.a = a;
    else S.profile.answers.push({ q, a });
    save();
  }

  async function absorb(tab, res) {
    const prog = programById(tab.programId);
    tab.pageKind = res.pageKind;
    tab.next = res.next;
    tab.pending = { questions: res.questions, essays: [], uploads: res.uploads, left: res.left, failed: res.failed };

    if (res.filled.length) addLogQuiet(tab, { items: res.filled, heading: res.heading, open: res.filled.length <= 6 });
    for (const u of res.uploads.filter((x) => x.done)) addLogQuiet(tab, { tone: 'good', text: `Attached ${u.file} to “${u.label}”.` });

    for (const found of res.essays) {
      let essay = S.essays.find((e) => (e.programId || null) === (tab.programId || null) && norm(e.prompt) === norm(found.prompt));
      if (!essay) {
        essay = { id: uid(), programId: tab.programId || null, prompt: found.prompt, wordLimit: found.wordLimit, options: [], chosen: null, text: '' };
        S.essays.push(essay);
      } else if (found.wordLimit && !essay.wordLimit) essay.wordLimit = found.wordLimit;
      R.essaySource.set(essay.id, { tabId: tab.id, ref: found.ref });
      tab.pending.essays.push(essay.id);
      // An answer you already settled on goes straight back in.
      if (essay.text && (await insertEssay(essay, true))) addLogQuiet(tab, { tone: 'good', text: 'Put your saved essay answer back into the form.' });
    }

    if (res.note) addLogQuiet(tab, { tone: res.aiError || res.pageKind === 'login' || res.noKey ? 'warn' : '', text: res.note });
    if (!res.filled.length && !res.note && !blockers(tab) && res.fieldCount) addLogQuiet(tab, { text: 'Everything on this page is already filled in.' });
    if (res.pageKind === 'review') addLogQuiet(tab, { tone: 'warn', text: 'This looks like the final review page. Read it through, then submit it yourself.' });

    if (prog) {
      if (res.pageKind === 'review' && prog.status !== 'submitted') prog.status = 'ready';
      else if (prog.status === 'not_started' && (res.filled.length || res.questions.length || res.essays.length)) prog.status = 'in_progress';
    }
    save();
  }
  const addLogQuiet = (tab, entry) => {
    tab.log.unshift({ at: Date.now(), ...entry });
    if (tab.log.length > 60) tab.log.length = 60;
  };

  async function runFill(tab) {
    if (tab.busy) return null;
    if (!tab.wcId) {
      toast('This page is still loading. Try again in a moment.');
      return null;
    }
    tab.busy = true;
    tab.armed = true;
    tab.progress = 'Reading the page…';
    paint(tab);
    let res = null;
    try {
      const prog = programById(tab.programId);
      res = await api('fillPage', {
        wcId: tab.wcId,
        profile: S.profile,
        program: prog ? { university: prog.university, program: prog.program } : null,
        field: S.field,
        term: S.term,
        model: S.settings.model,
      });
      await absorb(tab, res);
    } catch (err) {
      addLogQuiet(tab, { tone: 'bad', text: err.message });
      res = null;
    }
    tab.busy = false;
    tab.progress = '';
    paint(tab);
    return res;
  }

  const canAdvance = (tab, res) => res.pageKind === 'form' && !!tab.next && !res.noKey && !res.aiError && blockers(tab) === 0;

  async function settle(tab) {
    await sleep(700);
    const start = Date.now();
    while (tab.loading && Date.now() - start < 12000) await sleep(150);
    await sleep(600);
  }

  // Press the form's own "Next" button, then wait for the next page.
  async function advance(tab) {
    const next = tab.next;
    if (!next || !tab.wcId) return false;
    tab.chain = true;
    tab.busy = true;
    tab.progress = 'Opening the next page…';
    paint(tab);
    let ok = false;
    try {
      const r = await api('clickRef', { wcId: tab.wcId, ref: next.ref });
      ok = !!(r && r.ok);
    } catch {}
    if (ok) await settle(tab);
    tab.busy = false;
    tab.chain = false;
    tab.navigated = false;
    tab.progress = '';
    if (!ok) {
      addLog(tab, { tone: 'warn', text: 'Could not press that button. Press it on the page yourself, then Fill this page.' });
      paint(tab);
      return false;
    }
    tab.pending = null;
    tab.next = null;
    return true;
  }

  // Fill this page; with Autopilot on, keep going while nothing needs the applicant.
  async function fillAndAdvance(tab, cameFromNext, keepGoing) {
    let last = null;
    for (let hop = 0; hop < 15; hop++) {
      const before = tab.lastSig;
      const res = await runFill(tab);
      if (!res) return last;
      last = res;
      if ((hop > 0 || cameFromNext) && res.signature && res.signature === before) {
        addLog(tab, { tone: 'warn', text: 'The form stayed on the same page. It probably wants something fixed first: look for a message on the page.' });
        return last;
      }
      tab.lastSig = res.signature;
      if (!(keepGoing || S.settings.autopilot) || !canAdvance(tab, res)) return last;
      addLogQuiet(tab, { text: `Nothing needed you here, so Tassel pressed “${tab.next.text}”.` });
      if (!(await advance(tab))) return last;
    }
    return last;
  }

  async function answerQuestion(tab, ref, value, card) {
    const q = tab.pending && tab.pending.questions.find((x) => x.ref === ref);
    value = String(value || '').trim();
    if (!q || !value) return;
    const remember = !card || !$('.remember', card) || $('.remember', card).checked;
    try {
      const res = await api('applyFills', { wcId: tab.wcId, fills: [{ ref, value }] });
      const r = res[0];
      if (!r || !r.ok) return toast((r && r.note) || 'Could not put that answer on the page.', 'bad');
      tab.pending.questions = tab.pending.questions.filter((x) => x.ref !== ref);
      if (remember) saveAnswer(q.label || q.question, r.value && q.kind !== 'checkbox' ? r.value : value);
      addLog(tab, { tone: 'good', text: `${q.label || q.question}: ${q.kind === 'checkbox' ? value : r.value || value}` });
      renderSide();
      maybeAutoAdvance(tab);
    } catch (err) {
      toast(err.message, 'bad');
    }
  }

  /* ---------------------------------------------------------------- */
  /* An outside AI app, working through MCP                             */
  /* (the tool list lives in mcp/tools.js; the hard limits in agent.js) */
  /* ---------------------------------------------------------------- */
  const text = (v) => (v == null ? '' : String(v)).replace(/\s+/g, ' ').trim();
  const isDay = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v);
  const programBrief = (p) => ({
    id: p.id,
    university: p.university,
    program: p.program,
    level: p.level,
    chance: p.tier || '',
    why: p.fit || '',
    country: p.country || '',
    url: p.url || '',
    university_website: p.website || '',
    deadline: p.deadline || '',
    other_dates: (p.extraDeadlines || []).map((d) => ({ label: d.label, date: d.date })),
    fee: p.fee || '',
    status: p.status,
    checklist: (p.checklist || []).map((c) => ({ item: c.label, done: !!c.done })),
    letters_needed: lettersOf(p).needed,
    letters: recommenders().map((r) => ({ recommender: r.name, state: letterState(p, r), asked_on: (lettersOf(p).by[r.id] || {}).askedOn || '' })),
    note: p.note || '',
  });
  const tabTitle = (t) => {
    const prog = programById(t.programId);
    return prog ? programName(prog) : isPractice(t.url) ? 'Practice application' : t.pageTitle || t.title;
  };
  const shownUrl = (url) => (isPractice(url) ? 'practice application (built into Tassel)' : url);

  function profileGaps() {
    const p = S.profile;
    const per = p.personal;
    const gaps = [];
    for (const [key, label] of [['firstName', 'first name'], ['lastName', 'last name'], ['email', 'email'], ['phone', 'phone'], ['dob', 'date of birth'], ['citizenship', 'citizenship'], ['address1', 'address'], ['city', 'city'], ['country', 'country']]) {
      if (!per[key]) gaps.push(label);
    }
    if (!p.education.length) gaps.push('education history');
    if (!p.experience.length) gaps.push('work or research experience');
    if (!p.recommenders.length) gaps.push('recommenders');
    if ((p.story || '').trim().length < 40) gaps.push('their story (why this field, goals)');
    if (!p.documents.cv) gaps.push('CV file (the applicant adds it in Tassel under Profile > Documents)');
    return gaps;
  }

  function mcpTab(a) {
    const tab = a.tab_id ? R.tabs.find((t) => t.id === a.tab_id) : activeTab() || R.tabs[R.tabs.length - 1];
    if (!tab) throw new Error(a.tab_id ? 'That tab is closed. Call open_application.' : 'No application is open. Call open_application first.');
    return tab;
  }
  async function waitLoaded(tab, ms = 25000) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (tab.wcId && !tab.loading) return true;
      await sleep(150);
    }
    return !!tab.wcId;
  }
  const inSetup = () => !$('#onboard').hidden;

  const mcpTools = {
    tassel_overview() {
      return {
        setup_finished: !inSetup(),
        wants_to_study: S.fields,
        degree_levels: S.levels,
        where: S.countries,
        intended_start: S.term || '',
        profile: { complete_percent: completeness(), missing: profileGaps() },
        programs: S.programs.map(programBrief),
        open_tabs: R.tabs.map((t) => ({ tab_id: t.id, program_id: t.programId || null, title: tabTitle(t), url: shownUrl(t.url), showing: t.id === R.active })),
        essays_without_an_answer: S.essays.filter((e) => !e.text).map((e) => ({ essay_id: e.id, program_id: e.programId || null, prompt: e.prompt, word_limit: e.wordLimit || 0 })),
      };
    },

    get_profile() {
      const p = S.profile;
      return {
        personal: p.personal,
        education: p.education,
        tests: p.tests,
        experience: p.experience,
        recommenders: p.recommenders,
        research: p.research || {},
        story: p.story || '',
        documents_on_file: Object.entries(p.documents).filter(([, v]) => v).map(([k, v]) => ({ document: k, file: baseName(v) })),
        saved_answers: p.answers.map((x) => ({ question: x.q, answer: x.a })),
        wants_to_study: S.fields,
        where: S.countries,
        intended_start: S.term || '',
      };
    },

    update_profile(a) {
      const p = S.profile;
      const saved = [];
      const ignored = [];
      const per = a.personal && typeof a.personal === 'object' ? a.personal : {};
      const tests = a.tests && typeof a.tests === 'object' ? a.tests : {};
      if (per.dob != null && text(per.dob) && !isDay(text(per.dob))) throw new Error('personal.dob must be YYYY-MM-DD.');
      const take = (src, keys, dest, label) => {
        for (const [k, v] of Object.entries(src)) {
          if (!keys.includes(k)) ignored.push(`${label}.${k}`);
          else if (typeof v === 'string' || typeof v === 'number') {
            dest[k] = text(v);
            saved.push(`${label}.${k}`);
          }
        }
      };
      take(per, PERSONAL.map((f) => f[0]), p.personal, 'personal');
      take(tests, TESTS.map((f) => f[0]), p.tests, 'tests');
      take(a.research && typeof a.research === 'object' ? a.research : {}, ['interests', 'publications'], p.research, 'research');
      if (typeof a.story === 'string') {
        p.story = a.story.trim();
        saved.push('story');
      }
      const addRows = (items, kind) => {
        const keys = LISTS[kind].fields.map((f) => f[0]);
        for (const it of Array.isArray(items) ? items : []) {
          if (!it || typeof it !== 'object') continue;
          const row = Object.fromEntries(keys.map((k) => [k, text(it[k])]));
          if (!row[keys[0]]) continue;
          // Same school / employer / person again: update that entry rather than add a twin.
          const existing = p[kind].find((r) => norm(r[keys[0]]) === norm(row[keys[0]]));
          if (existing) for (const k of keys) existing[k] = row[k] || existing[k] || '';
          else p[kind].push({ id: uid(), ...row });
          saved.push(`${kind}: ${row[keys[0]]}`);
        }
      };
      addRows(a.add_education, 'education');
      addRows(a.add_experience, 'experience');
      addRows(a.add_recommenders, 'recommenders');
      for (const sa of Array.isArray(a.saved_answers) ? a.saved_answers : []) {
        if (sa && text(sa.question) && text(sa.answer)) {
          saveAnswer(sa.question, sa.answer);
          saved.push(`answer: ${text(sa.question)}`);
        }
      }
      if (!saved.length) throw new Error('Nothing was saved. Include at least one known field.' + (ignored.length ? ` Unknown: ${ignored.join(', ')}.` : ''));
      return { saved, ignored_unknown_fields: ignored, profile_complete_percent: completeness(), still_missing: profileGaps() };
    },

    set_interests(a) {
      if (Array.isArray(a.fields)) setFields(a.fields);
      if (Array.isArray(a.places)) S.countries = uniq(a.places);
      if (typeof a.start_term === 'string') S.term = text(a.start_term);
      if (Array.isArray(a.levels)) {
        const levels = Object.keys(LEVELS).filter((k) => a.levels.includes(k));
        if (levels.length) S.levels = levels;
      }
      return { wants_to_study: S.fields, degree_levels: S.levels, where: S.countries, intended_start: S.term || '' };
    },

    list_programs() {
      return { programs: sortedPrograms().map(programBrief) };
    },

    add_programs(a) {
      const added = [];
      const skipped = [];
      const have = new Set(S.programs.map((p) => norm(p.university + ' ' + p.program)));
      for (const it of Array.isArray(a.programs) ? a.programs : []) {
        const university = text(it && it.university);
        const program = text(it && it.program);
        if (!university || !program) {
          skipped.push({ university, program, why: 'university and program are both required' });
          continue;
        }
        const key = norm(university + ' ' + program);
        if (have.has(key)) {
          skipped.push({ university, program, why: 'already on the list' });
          continue;
        }
        have.add(key);
        const known = findUni(university);
        const p = newApplication({ university: known ? known[0] : university, program, level: it.level, tier: it.chance, fit: text(it.why), country: text(it.country) || (known ? known[1] : ''), url: normUrl(it.url), website: hostOf(normUrl(it.website)) || (known ? known[2] : ''), deadline: isDay(text(it.deadline)) ? text(it.deadline) : '', fee: text(it.fee), note: text(it.note) });
        S.programs.push(p);
        added.push(programBrief(p));
      }
      if (!added.length && !skipped.length) throw new Error('Give at least one program.');
      return { added, skipped };
    },

    update_program(a) {
      const p = programById(a.id);
      if (!p) throw new Error('No program with that id. Call list_programs.');
      if (a.status != null) {
        if (!STATUS[a.status]) throw new Error('status must be one of: ' + Object.keys(STATUS).join(', '));
        p.status = a.status;
      }
      if (a.url != null) {
        const url = normUrl(a.url);
        if (text(a.url) && !url) throw new Error('url must be a valid https:// address.');
        p.url = url;
      }
      if (a.deadline != null) {
        if (text(a.deadline) && !isDay(text(a.deadline))) throw new Error('deadline must be YYYY-MM-DD.');
        p.deadline = text(a.deadline);
      }
      if (a.note != null) p.note = text(a.note);
      if (a.fee != null) p.fee = text(a.fee);
      if (a.chance != null) {
        if (text(a.chance) && !tierOf(a.chance)) throw new Error('chance must be reach, target or safer.');
        p.tier = tierOf(a.chance);
      }
      if (a.why != null) p.fit = text(a.why);
      if (a.level != null) {
        if (!LEVELS[a.level]) throw new Error('level must be masters or phd.');
        p.level = a.level;
      }
      if (a.university_website != null) {
        const site = hostOf(normUrl(a.university_website));
        if (text(a.university_website) && !site) throw new Error('university_website must be a domain such as umich.edu.');
        for (const x of siblings(p)) x.website = site;
      }
      for (const d of Array.isArray(a.add_dates) ? a.add_dates : []) {
        if (!d || !isDay(text(d.date))) throw new Error('Each added date needs a date as YYYY-MM-DD.');
        p.extraDeadlines = p.extraDeadlines.filter((x) => norm(x.label) !== norm(d.label));
        p.extraDeadlines.push({ label: text(d.label) || 'Other date', date: text(d.date) });
      }
      if (a.letters_needed != null) {
        const need = parseInt(a.letters_needed, 10);
        if (!(need >= 0 && need <= 6)) throw new Error('letters_needed must be a number from 0 to 6.');
        lettersOf(p).needed = need;
      }
      for (const l of Array.isArray(a.letters) ? a.letters : []) {
        const rec = recommenders().find((r) => norm(r.name) === norm(l && l.recommender));
        if (!rec) throw new Error(`No recommender called "${text(l && l.recommender)}". The profile has: ${recommenders().map((r) => r.name).join(', ') || 'none yet (add them with update_profile)'}.`);
        if (!LETTER_STATES[l.state]) throw new Error('A letter state must be todo, asked or submitted.');
        setLetter(p, rec.id, l.state);
      }
      syncLetterCheck(p);
      for (const c of Array.isArray(a.checklist) ? a.checklist : []) {
        const label = text(c && c.item);
        if (!label) continue;
        const item = p.checklist.find((x) => norm(x.label) === norm(label));
        if (item) item.done = !!c.done;
        else p.checklist.push({ id: uid(), label, done: !!c.done });
      }
      return programBrief(p);
    },

    async open_application(a) {
      if (inSetup()) throw new Error("The applicant is still in Tassel's first-run setup. Ask them to finish its three short steps in the Tassel window first.");
      let url = '';
      let programId = null;
      let title = '';
      if (a.practice) {
        url = R.info.practiceUrl;
        title = 'Practice application';
      } else if (a.program_id) {
        const p = programById(a.program_id);
        if (!p) throw new Error('No program with that id. Call list_programs.');
        if (!p.url && a.url) p.url = normUrl(a.url);
        if (!p.url) throw new Error(`${p.university} has no application link yet. Find the real link, then call update_program with it.`);
        url = p.url;
        programId = p.id;
        title = p.university;
      } else if (a.url) {
        url = normUrl(a.url);
        if (!url) throw new Error('url must be a valid https:// address.');
      } else {
        throw new Error('Give program_id, url, or practice=true.');
      }
      let tab = programId ? R.tabs.find((t) => t.programId === programId) : a.practice ? R.tabs.find((t) => !t.programId && isPractice(t.url)) : null;
      if (tab) switchTo(tab.id);
      else tab = openTab({ url, programId, title });
      if (!tab) throw new Error('Too many tabs are open in Tassel. Ask the applicant to close one.');
      await waitLoaded(tab);
      await sleep(400);
      return { tab_id: tab.id, title: tabTitle(tab), url: shownUrl(tab.url), next_step: 'Call read_page.' };
    },

    async read_page(a) {
      const tab = mcpTab(a);
      await waitLoaded(tab, 15000);
      if (!tab.wcId) throw new Error('The page is still loading. Try again in a moment.');
      const page = await api('describePage', { wcId: tab.wcId });
      page.url = shownUrl(page.url);
      return { tab_id: tab.id, program_id: tab.programId || null, ...page };
    },

    async fill_fields(a) {
      const tab = mcpTab(a);
      if (!Array.isArray(a.fills) || !a.fills.length) throw new Error('Give at least one fill: { id, value }.');
      if (!tab.wcId) throw new Error('The page is still loading. Try again in a moment.');
      const results = await api('safeFill', { wcId: tab.wcId, fills: a.fills.map((f) => ({ id: f && f.id, value: f && f.value })) });
      const done = results.filter((r) => r.ok);
      if (done.length) {
        addLogQuiet(tab, { items: done.map((r) => ({ label: r.label, value: r.value })), by: 'app', open: done.length <= 6 });
        const prog = programById(tab.programId);
        if (prog && prog.status === 'not_started') prog.status = 'in_progress';
      }
      return { filled: done.length, not_filled: results.length - done.length, results };
    },

    async attach_document(a) {
      const tab = mcpTab(a);
      const path = S.profile.documents[a.document];
      if (!path) throw new Error(`There is no "${a.document}" on file. Ask the applicant to add it in Tassel under Profile > Documents.`);
      if (!tab.wcId) throw new Error('The page is still loading. Try again in a moment.');
      const res = await api('safeUpload', { wcId: tab.wcId, ref: a.field_id, path });
      addLogQuiet(tab, { tone: 'good', text: `Your AI app attached ${baseName(path)} to “${res.label}”.` });
      return { attached: baseName(path), to: res.label };
    },

    async click_button(a) {
      const tab = mcpTab(a);
      if (!tab.wcId) throw new Error('The page is still loading. Try again in a moment.');
      tab.chain = true; // keep Autopilot from reacting to this navigation
      try {
        const res = await api('safeClick', { wcId: tab.wcId, ref: a.button_id });
        await settle(tab);
        tab.pending = null;
        tab.next = null;
        addLogQuiet(tab, { text: `Your AI app pressed “${res.pressed}”.` });
        return { pressed: res.pressed, next_step: 'Call read_page to see the page now showing.' };
      } finally {
        tab.chain = false;
        tab.navigated = false;
      }
    },

    list_essays() {
      return {
        essays: S.essays.map((e) => ({
          essay_id: e.id,
          program_id: e.programId || null,
          program: programName(programById(e.programId)),
          prompt: e.prompt,
          word_limit: e.wordLimit || 0,
          answer: e.text || '',
          drafts: (e.options || []).map((o) => ({ angle: o.angle, text: o.text })),
        })),
      };
    },

    async save_essay(a) {
      const prompt = text(a.prompt);
      if (!prompt) throw new Error('Give the prompt.');
      const drafts = (Array.isArray(a.drafts) ? a.drafts : [])
        .filter((d) => d && String(d.text || '').trim())
        .slice(0, 3)
        .map((d, i) => ({ angle: text(d.angle) || `Draft ${i + 1}`, text: String(d.text).trim() }));
      if (!drafts.length) throw new Error('Give at least one draft with text.');
      let tab = null;
      if (a.field_id) {
        tab = mcpTab(a);
        const page = await api('describePage', { wcId: tab.wcId });
        const f = page.fields.find((x) => x.id === a.field_id);
        if (!f || f.off_limits || !['textarea', 'text', 'richtext'].includes(f.kind)) throw new Error('field_id must be a text field from read_page on the open page.');
      }
      const programId = a.program_id && programById(a.program_id) ? a.program_id : (tab && tab.programId) || null;
      let e = S.essays.find((x) => (x.programId || null) === programId && norm(x.prompt) === norm(prompt));
      if (!e) {
        e = { id: uid(), programId, prompt, wordLimit: 0, options: [], chosen: null, text: '' };
        S.essays.push(e);
      }
      const limit = Math.max(0, parseInt(a.word_limit, 10) || 0);
      if (limit) e.wordLimit = limit;
      e.options = drafts;
      e.showOptions = true;
      if (tab) {
        R.essaySource.set(e.id, { tabId: tab.id, ref: a.field_id });
        if (!tab.pending) tab.pending = { questions: [], essays: [], uploads: [], left: [], failed: [] };
        if (!tab.pending.essays.includes(e.id)) tab.pending.essays.push(e.id);
      }
      let typed = false;
      const pick = Number.isInteger(a.chosen) ? a.chosen - 1 : -1;
      if (drafts[pick]) {
        e.text = drafts[pick].text;
        e.chosen = pick;
        e.manual = false;
        e.showOptions = false;
        typed = await insertEssay(e, true);
      }
      return {
        essay_id: e.id,
        drafts_saved: drafts.length,
        chosen: drafts[pick] ? pick + 1 : null,
        typed_into_form: typed,
        note: drafts[pick] ? '' : 'Saved. The applicant can read the drafts and pick one in Tassel under Essays. Tell them they are there.',
      };
    },
  };

  window.tassel.onMcpCall(async ({ id, tool, args }) => {
    let msg;
    try {
      const fn = mcpTools[tool];
      if (!fn) throw new Error(`Unknown tool: ${tool}`);
      msg = { id, ok: true, data: await fn(args && typeof args === 'object' ? args : {}) };
    } catch (err) {
      msg = { id, ok: false, error: (err && err.message) || String(err) };
    }
    const first = !R.mcp.calls;
    R.mcp.calls++;
    R.mcp.lastAt = Date.now();
    save();
    window.tassel.mcpResult(msg);
    if (first) toast('Your AI app is connected to Tassel.');
    // Show the result, without yanking a form out from under someone who is typing in it.
    const typing = document.activeElement && document.activeElement.closest && document.activeElement.closest('#view') && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    const tab = activeTab();
    if (tab) paint(tab);
    else if (typing || R.modal || inSetup()) renderSide();
    else refreshHome();
  });

  /* ---- Connecting an AI app, and what to say to it ---- */
  const quoted = (list) => list.join(', ');
  const PROMPTS = {
    profile: () => 'Use Tassel. Interview me to build my Tassel profile: ask me a few questions at a time and save my answers as we go.',
    cv: () => 'Use Tassel. Read my attached CV and save everything in it to my Tassel profile. Then ask me about anything important that is still missing.',
    find: () =>
      `Use Tassel. Find real ${levelsText(S.levels)} programs${S.fields.length ? ` in ${quoted(S.fields)}` : ''}${S.countries.length && !S.countries.includes('Anywhere') ? ` in ${quoted(S.countries)}` : ''} and add them to my Tassel list with application links and deadlines. Look at my profile first and sort them into reach, target and safer choices for me, with a balanced mix.`,
    all: () => 'Use Tassel. Fill in all my applications, one after another: open each, fill every page from my profile, collect the questions you cannot answer and ask me them together, and stop each one at its review page.',
    fill: (name) => `Use Tassel. Fill in my ${name || 'next'} application: open it, fill every page from my profile, ask me anything you do not know, and stop at the review page so I can submit it myself.`,
    essay: (prompt) => `Use Tassel. Draft three different options for this essay prompt and save them to Tassel so I can pick one: “${prompt}”`,
  };
  const PROMPT_LABELS = { profile: 'Build my profile by chatting', cv: 'Fill my profile from my CV', find: 'Find programs for me', fill: 'Fill in an application', all: 'Fill in all my applications', essay: 'Draft an essay' };

  const promptRow = (key, arg) => {
    const value = PROMPTS[key](arg);
    return `<div class="say"><div class="say-what">${esc(PROMPT_LABELS[key])}</div><div class="say-text selectable">${esc(value)}</div>
      <button class="btn sm" data-act="copy-text" data-text="${esc(value)}">${ico('copy')}Copy</button></div>`;
  };

  // The three ways to hook an AI app up. Used in Settings and in first-run setup.
  function connectHtml() {
    const info = R.mcpInfo || {};
    let status;
    if (R.mcp.calls) status = `<div class="done-line">${ico('check')} Your AI app is connected and talking to Tassel.</div>`;
    else if (info.claudeDesktopInstalled) status = `<div class="ob-note">${ico('info')}<div>Tassel is added to Claude Desktop. Quit and reopen Claude Desktop, then say <b>“Use Tassel”</b> in a chat.</div></div>`;
    else status = '';
    return `<div class="connect">
      <div class="connect-row">${
        info.claudeDesktopFound
          ? `<button class="btn dark" data-act="mcp-claude">${info.claudeDesktopInstalled ? 'Re-add to Claude Desktop' : 'Add to Claude Desktop'}</button>`
          : ''
      }
        <button class="btn" data-act="copy-text" data-text="${esc(info.claudeCode || '')}" data-done="Command copied. Paste it into a terminal.">${ico('copy')}Copy command for Claude Code</button>
        <button class="btn" data-act="copy-text" data-text="${esc(info.json || '')}" data-done="Settings copied. Paste them into your AI app's MCP settings.">${ico('copy')}Copy settings for other apps</button>
      </div>
      ${status}
      <p class="hint">Works with any AI app that supports local MCP servers. Keep Tassel open while your AI app is working.${
        info.claudeDesktopInstalled ? ` <button class="link muted" data-act="mcp-remove">Remove from Claude Desktop</button>` : ''
      }</p></div>`;
  }

  function sayDialog(keys, arg, title, intro) {
    openModal({
      wide: true,
      html: `<div class="dialog-head"><div class="grow"><h2>${esc(title || 'Ask your AI app')}</h2>
          <p>${esc(intro || 'Tassel has no API key, so the AI app you connected does this part. Paste this into it:')}</p></div></div>
        <div class="dialog-body">${keys.map((k) => promptRow(k, arg)).join('')}</div>
        <div class="dialog-foot"><button class="link muted" data-act="go" data-view="settings">AI settings</button><div class="grow"></div>
          <button class="btn primary" data-act="m-cancel" autofocus>Done</button></div>`,
      handlers: { 'm-cancel': () => closeModal(), go: (el) => (closeModal(), go(el.dataset.view)) },
    });
  }

  // Something needs an AI and Tassel has no key: point to the connected AI app, or to Settings.
  function needsAi(key, arg) {
    if (usesApp()) return sayDialog([key], arg);
    openModal({
      html: `<div class="dialog-head"><div class="grow"><h2>This part needs an AI</h2>
          <p>Connect the AI app you already use (no API key needed), or add an Anthropic API key. Both are in Settings.</p></div></div>
        <div class="dialog-foot"><button class="btn ghost" data-act="m-cancel">Not now</button>
          <button class="btn primary" data-act="m-ok" autofocus>Connect an AI</button></div>`,
      handlers: { 'm-cancel': () => closeModal(), 'm-ok': () => (closeModal(), go('settings')) },
    });
  }

  /* ---------------------------------------------------------------- */
  /* Onboarding                                                         */
  /* ---------------------------------------------------------------- */
  const FIELD_IDEAS = ['Economics', 'Computer Science', 'Data Science', 'Public Policy', 'Finance', 'Business (MBA)', 'Psychology', 'Engineering'];
  const ob = { step: 0, fields: [], countries: [], levels: ['masters'], mode: '', key: '', busy: false, note: '', err: false, first: '', last: '', email: '', imported: false };

  /* ---- Tag boxes: pick several, or type your own ---- */
  const DATA = window.TASSEL_DATA || { regions: [], countries: [], cities: [], fields: [], related: {} };

  // Idea chips for fields follow what has already been added (Economics -> Econometrics, Public Policy, ...).
  function fieldIdeas(list) {
    const out = [];
    for (const f of list) {
      const n = ` ${norm(f)} `;
      for (const [key, rel] of Object.entries(DATA.related)) if (n.includes(` ${norm(key)} `)) out.push(...rel);
    }
    return uniq([...out, ...FIELD_IDEAS]);
  }
  const FIELD_TAGS = { ideas: fieldIdeas, pool: DATA.fields, placeholder: 'Type a field or program title', more: 'Add another' };
  const PLACE_TAGS = {
    ideas: () => REGIONS,
    pool: uniq([...DATA.regions, ...DATA.countries, ...DATA.cities]),
    placeholder: 'Type a country, region or city',
    more: 'Add another',
    exclusive: 'Anywhere',
  };
  const TAGSETS = {
    'ob-fields': { ...FIELD_TAGS, get: () => ob.fields, set: (v) => ((ob.fields = v), (ob.note = '')), redraw: () => renderOnboard() },
    'ob-places': { ...PLACE_TAGS, get: () => ob.countries, set: (v) => (ob.countries = v), redraw: () => renderOnboard() },
    'set-fields': { ...FIELD_TAGS, get: () => S.fields, set: (v) => (setFields(v), save()), redraw: () => refreshHome() },
    'set-places': { ...PLACE_TAGS, get: () => S.countries, set: (v) => ((S.countries = v), save()), redraw: () => refreshHome() },
  };

  function tagsHtml(id, { small, autofocus } = {}) {
    const t = TAGSETS[id];
    const list = t.get();
    const ideas = t
      .ideas(list)
      .filter((i) => !list.some((v) => norm(v) === norm(i)))
      .slice(0, 8);
    return `<div class="tagwrap"><div class="tagbox ${small ? 'sm' : ''}" data-tagbox="${id}">${list
      .map((v) => `<span class="tag">${esc(v)}<button type="button" data-act="tag-x" data-set="${id}" data-v="${esc(v)}" aria-label="Remove ${esc(v)}">${ico('x')}</button></span>`)
      .join('')}<input class="tag-input" data-set="${id}" placeholder="${esc(list.length ? t.more : t.placeholder)}" aria-label="${esc(t.placeholder)}" autocomplete="off" spellcheck="false" ${autofocus ? 'autofocus' : ''}></div>
      <div class="tag-suggest" role="listbox" hidden></div></div>
      ${ideas.length ? `<div class="chips tag-ideas">${ideas.map((i) => `<button type="button" class="chip" data-act="tag-add" data-set="${id}" data-v="${esc(i)}">${ico('plus')}${esc(i)}</button>`).join('')}</div>` : ''}`;
  }

  /* ---- Suggestions while typing ---- */
  const suggest = { id: null, items: [], index: -1 };

  function suggestionsFor(id, text) {
    const t = TAGSETS[id];
    const q = norm(text);
    if (!t || !t.pool || !q) return [];
    const have = new Set(t.get().map(norm));
    const starts = [];
    const inside = [];
    for (const item of t.pool) {
      const n = norm(item);
      if (have.has(n)) continue;
      if (n.startsWith(q)) starts.push(item);
      else if (` ${n}`.includes(` ${q}`)) inside.push(item);
    }
    return [...starts, ...inside].slice(0, 6);
  }

  function paintSuggest(input) {
    const box = input && input.closest('.tagwrap') && $('.tag-suggest', input.closest('.tagwrap'));
    if (!box) return;
    box.hidden = !suggest.items.length;
    box.innerHTML = suggest.items
      .map((item, i) => `<button type="button" class="sg ${i === suggest.index ? 'on' : ''}" role="option" data-act="tag-add" data-set="${suggest.id}" data-v="${esc(item)}">${esc(item)}</button>`)
      .join('');
  }

  function showSuggest(input) {
    suggest.id = input.dataset.set;
    suggest.items = suggestionsFor(suggest.id, input.value);
    // Pre-select the top match only when it starts with what was typed, so Enter on "ger" gives "Germany"
    // but Enter on something of your own ("MSc Finance") adds exactly that.
    suggest.index = suggest.items.length && norm(suggest.items[0]).startsWith(norm(input.value)) ? 0 : -1;
    paintSuggest(input);
  }

  function hideSuggest() {
    suggest.items = [];
    suggest.index = -1;
    for (const box of $$('.tag-suggest')) box.hidden = true;
  }

  // Pick a value (a suggestion or an idea chip), dropping the half-typed text it completes.
  function pickTag(id, value, fromSuggest) {
    const input = $(`.tag-input[data-set="${id}"]`);
    if (input && (fromSuggest || norm(value).startsWith(norm(input.value)))) input.value = '';
    hideSuggest();
    changeTags(id, () => addTags(id, [value]));
  }

  // Add values to a tag set (without redrawing). "Anywhere" replaces everything else, and vice versa.
  function addTags(id, values) {
    const t = TAGSETS[id];
    if (!t) return;
    let list = [...t.get()];
    for (const raw of values) {
      for (const v of String(raw).split(/[,;\n]/)) {
        const value = v.replace(/\s+/g, ' ').trim();
        if (!value) continue;
        if (t.exclusive && norm(value) === norm(t.exclusive)) list = [t.exclusive];
        else {
          if (t.exclusive) list = list.filter((x) => norm(x) !== norm(t.exclusive));
          list.push(value);
        }
      }
    }
    t.set(uniq(list));
  }

  // Anything typed into a tag box but not yet entered still counts.
  function commitTags() {
    for (const input of $$('.tag-input')) {
      if (input.value.trim()) addTags(input.dataset.set, [input.value]);
      input.value = '';
    }
  }

  function changeTags(id, fn) {
    const t = TAGSETS[id];
    if (!t) return;
    commitTags();
    fn(t);
    R.focusTag = id; // tells the redraw which box keeps the caret
    t.redraw();
    R.focusTag = null;
    const input = $(`.tag-input[data-set="${id}"]`);
    if (input) input.focus(); // straight away, so fast typing is never dropped
  }

  function renderOnboard() {
    const host = $('#onboard');
    const steps = ['What you want to study', 'Connect the AI', 'About you'];
    let main = '';
    if (ob.step === 0) {
      main = `<h2>What do you want to study?</h2>
        <p class="lead">Add every field or program title you are considering, as many as you like. Pick from the ideas or type your own.</p>
        ${tagsHtml('ob-fields', { autofocus: true })}
        ${ob.note ? `<div class="ob-note err">${ico('info')}<div>${esc(ob.note)}</div></div>` : ''}
        <div class="label">Which degree?</div>
        <div class="chips">${Object.entries(LEVELS).map(([k, v]) => `<button class="chip ${ob.levels.includes(k) ? 'on' : ''}" data-act="ob-level" data-level="${k}">${v}</button>`).join('')}</div>
        <div class="label">Where would you like to study?</div>
        <p class="hint" style="margin:-2px 0 8px">Regions, countries or cities. Add as many as you like, or leave it empty for anywhere.</p>
        ${tagsHtml('ob-places')}
        <div class="ob-actions"><div class="grow"></div><button class="btn primary lg" data-act="ob-next">Continue${ico('arrow')}</button></div>`;
    } else if (ob.step === 1) {
      const choice = (mode, title, sub) =>
        `<button class="choice ${ob.mode === mode ? 'on' : ''}" data-act="ob-mode" data-mode="${mode}"><b>${title}</b><span>${sub}</span></button>`;
      main = `<h2>Connect an AI</h2>
        <p class="lead">Tassel needs an AI to read application forms and write drafts. Use the AI app you already have, or an API key.</p>
        <div class="choices two">
          ${choice('app', 'My own AI app', 'Claude Desktop, Claude Code, Cursor and others. No API key.')}
          ${choice('key', 'An API key', "Paste an Anthropic key and Tassel's built-in AI does the work.")}
        </div>
        ${ob.mode === 'app' ? `<div style="margin-top:18px">${connectHtml()}</div>` : ''}
        ${
          ob.mode === 'key'
            ? `<input class="input big-input" style="margin-top:18px" id="obKey" type="password" value="${esc(ob.key)}" placeholder="sk-ant-…" autocomplete="off" spellcheck="false" autofocus>
        <p class="hint" style="margin-top:10px">No key yet? <button class="link" data-act="ext" data-url="https://console.anthropic.com/settings/keys">Create one in the Anthropic Console ${ico('external')}</button></p>
        ${ob.note ? '' : `<div class="ob-note">${ico('lock')}<div>Your key is stored encrypted on this computer and is only ever sent to Anthropic.</div></div>`}`
            : ''
        }
        ${ob.note ? `<div class="ob-note ${ob.err ? 'err' : ''}">${ico(ob.err ? 'info' : 'check')}<div>${esc(ob.note)}</div></div>` : ''}
        <div class="ob-actions"><button class="btn ghost" data-act="ob-back">Back</button><div class="grow"></div>
          <button class="btn ghost" data-act="ob-skip">Skip for now</button>
          <button class="btn primary lg" data-act="ob-next" ${ob.busy ? 'disabled' : ''}>${ob.busy ? '<span class="spin light"></span>Checking…' : `Continue${ico('arrow')}`}</button></div>`;
    } else {
      main = `<h2>Now, about you</h2>
        <p class="lead">Tassel fills applications from your profile. The quickest way to build it is from your CV.</p>
        <button class="btn dark lg" data-act="ob-cv" id="obCv" style="width:100%" ${R.hasKey ? '' : 'disabled'}>${ico('upload')}${ob.imported ? 'CV imported – import a different one' : 'Import my CV (PDF)'}</button>
        ${
          R.hasKey
            ? ''
            : S.settings.aiApp
              ? `<p class="hint" style="margin-top:8px">Using your own AI app? After setup, give it your CV and say: “Use Tassel. Read my CV and fill in my profile.”</p>`
              : `<p class="hint" style="margin-top:8px">CV import needs an API key. With your own AI app, you can hand it your CV after setup instead.</p>`
        }
        ${ob.note ? `<div class="ob-note ${ob.err ? 'err' : ''}">${ico(ob.err ? 'info' : 'check')}<div>${esc(ob.note)}</div></div>` : ''}
        <div class="ob-or">or start with the basics</div>
        <div class="grid">
          <label class="field w6"><span>First name</span><input id="obFirst" value="${esc(ob.first)}"></label>
          <label class="field w6"><span>Last name</span><input id="obLast" value="${esc(ob.last)}"></label>
          <label class="field w12"><span>Email</span><input id="obEmail" type="email" value="${esc(ob.email)}"></label>
        </div>
        <div class="ob-actions"><button class="btn ghost" data-act="ob-back">Back</button><div class="grow"></div>
          <button class="btn primary lg" data-act="ob-finish">Open Tassel${ico('arrow')}</button></div>`;
    }
    host.innerHTML = `
      <div class="ob-drag"></div>
      <div class="ob-side">${mark('mark')}
        <h1>Apply once.<br>Everywhere.</h1>
        <p>Set up your profile one time. Tassel fills in every application, asks you only what it can't know, and leaves the final submit to you.</p>
        <div class="ob-steps">${steps.map((s, i) => `<div class="ob-step ${i === ob.step ? 'now' : i < ob.step ? 'done' : ''}"><span class="num">${i < ob.step ? '✓' : i + 1}</span>${s}</div>`).join('')}</div>
      </div>
      <div class="ob-main"><div class="ob-card">${main}</div></div>`;
    host.hidden = false;
    const focus = R.focusTag ? $(`.tag-input[data-set="${R.focusTag}"]`, host) : $('[autofocus]', host);
    if (focus) focus.focus();
  }

  function readOnboard() {
    commitTags();
    if ($('#obKey')) ob.key = $('#obKey').value.trim();
    if ($('#obFirst')) {
      ob.first = $('#obFirst').value.trim();
      ob.last = $('#obLast').value.trim();
      ob.email = $('#obEmail').value.trim();
    }
  }

  async function onboardNext() {
    readOnboard();
    if (ob.step === 0) {
      if (!ob.fields.length) {
        ob.note = 'Add at least one field so Tassel knows what to look for.';
        return renderOnboard();
      }
      ob.step = 1;
      ob.note = '';
      ob.err = false;
      return renderOnboard();
    }
    if (ob.step === 1) {
      if (ob.mode === 'app') {
        S.settings.aiApp = true;
        ob.note = '';
        ob.err = false;
        ob.step = 2;
        return renderOnboard();
      }
      if (ob.mode !== 'key') {
        ob.note = 'Pick one of the two, or press Skip for now.';
        ob.err = true;
        return renderOnboard();
      }
      if (!ob.key) return $('#obKey').focus();
      ob.busy = true;
      ob.note = '';
      renderOnboard();
      try {
        await api('setKey', { key: ob.key });
        await api('testKey', { model: S.settings.model });
        R.hasKey = true;
        ob.key = '';
        ob.note = '';
        ob.err = false;
        ob.step = 2;
      } catch (err) {
        await api('setKey', { key: '' }).catch(() => {});
        R.hasKey = false;
        ob.note = err.message;
        ob.err = true;
      }
      ob.busy = false;
      renderOnboard();
    }
  }

  function finishOnboard() {
    readOnboard();
    setFields(ob.fields);
    S.countries = uniq(ob.countries);
    S.levels = ob.levels.length ? [...ob.levels] : ['masters'];
    const per = S.profile.personal;
    if (ob.first && !per.firstName) per.firstName = ob.first;
    if (ob.last && !per.lastName) per.lastName = ob.last;
    if (ob.email && !per.email) per.email = ob.email;
    S.onboarded = true;
    S.view = 'programs';
    flush();
    $('#onboard').hidden = true;
    $('#onboard').innerHTML = '';
    switchTo('home');
    if (R.hasKey && !S.programs.length) setTimeout(findDialog, 350);
    else if (!R.hasKey && S.settings.aiApp) {
      setTimeout(() => sayDialog(['profile', 'cv', 'find', 'fill', 'all'], '', 'You are set up. Now talk to your AI app', 'Open the AI app you connected and paste any of these. It does the work inside Tassel while you watch.'), 350);
    }
  }

  /* ---------------------------------------------------------------- */
  /* Actions (clicks)                                                   */
  /* ---------------------------------------------------------------- */
  const actions = {
    tab: (el) => switchTo(el.dataset.id),
    'tab-close': (el) => closeTab(el.dataset.id),
    go: (el) => go(el.dataset.view),
    ext: (el) => api('openExternal', { url: el.dataset.url }).catch((err) => toast(err.message, 'bad')),

    // Programs
    'add-program': (el) => programDialog(null, el.dataset.uni ? { university: el.dataset.uni } : null),
    'uni-pick': (el) => {
      const hit = uniSg.items[+el.dataset.i];
      if (hit) pickUni(hit.u, uniSg.input);
    },
    batch: () => batchDialog(),
    'batch-again': () => {
      const b = R.batch;
      if (!b) return;
      const ids = b.items.filter((i) => i.state !== 'review' && programById(i.programId)).map((i) => i.programId);
      if (!ids.length) return toast('Nothing left to continue. Open the ones marked ready and review them.');
      runBatch(ids);
    },
    'batch-close': () => {
      if (R.batch) R.batch.stopped = true;
      R.batch = null;
      refreshHome();
    },
    'group-by': (el) => {
      S.settings.groupBy = el.dataset.by === 'tier' ? 'tier' : 'university';
      save();
      refreshHome();
    },
    'go-recs': () => {
      go('profile');
      const sec = $('#sec-recommenders');
      if (sec) sec.scrollIntoView({ block: 'start' });
    },
    'letter-set': (el) => {
      const p = programById(el.dataset.id);
      if (!p || !LETTER_STATES[el.dataset.state]) return;
      setLetter(p, el.dataset.rec, el.dataset.state);
      save();
      refreshHome();
    },
    'letter-need': (el) => {
      const p = programById(el.dataset.id);
      if (!p) return;
      const L = lettersOf(p);
      L.needed = Math.max(0, Math.min(6, L.needed + (+el.dataset.d || 0)));
      syncLetterCheck(p);
      save();
      refreshHome();
    },
    'letters-ask-all': (el) => {
      const rec = recommenders().find((r) => r.id === el.dataset.rec);
      if (!rec) return;
      let count = 0;
      for (const p of S.programs) {
        if (p.status === 'submitted' || !lettersOf(p).needed || letterState(p, rec) !== 'todo') continue;
        setLetter(p, rec.id, 'asked');
        count++;
      }
      save();
      refreshHome();
      toast(`Marked ${plural(count, 'letter')} from ${rec.name} as asked.`);
    },
    'letters-copy': async (el) => {
      const rec = recommenders().find((r) => r.id === el.dataset.rec);
      if (!rec) return;
      const msg = letterMessage(rec, el.dataset.kind);
      try {
        await navigator.clipboard.writeText(msg.text);
        toast(`Copied. Paste it into an email to ${rec.email || rec.name}.`);
      } catch {
        toast('Could not copy. Try again with the Tassel window in front.', 'bad');
      }
    },
    'toggle-check': (el) => {
      R.openCheck = R.openCheck === el.dataset.id ? null : el.dataset.id;
      refreshHome();
    },
    'check-remove': (el) => {
      const p = programById(el.dataset.id);
      if (!p) return;
      p.checklist = p.checklist.filter((c) => c.id !== el.dataset.item);
      save();
      refreshHome();
    },
    level: (el) => {
      const k = el.dataset.level;
      const next = S.levels.includes(k) ? S.levels.filter((x) => x !== k) : [...S.levels, k];
      if (!next.length) return toast('Keep at least one.');
      S.levels = Object.keys(LEVELS).filter((x) => next.includes(x));
      save();
      refreshHome();
    },
    'ob-level': (el) => {
      readOnboard();
      const k = el.dataset.level;
      const next = ob.levels.includes(k) ? ob.levels.filter((x) => x !== k) : [...ob.levels, k];
      if (next.length) ob.levels = Object.keys(LEVELS).filter((x) => next.includes(x));
      renderOnboard();
    },
    'edit-program': (el) => programDialog(el.dataset.id),
    'find-programs': () => findDialog(),
    practice: () => openTab({ url: R.info.practiceUrl, title: 'Practice application' }),
    'open-program': (el) => {
      const p = programById(el.dataset.id);
      if (p && p.url) openTab({ url: p.url, programId: p.id, title: p.university });
    },
    'remove-program': async (el) => {
      const p = programById(el.dataset.id);
      if (!p) return;
      const yes = await confirmDialog({ title: `Remove ${p.program} at ${p.university}?`, body: 'This application comes off your list. Essays you wrote for it are kept.', confirm: 'Remove', danger: true });
      if (!yes) return;
      S.programs = S.programs.filter((x) => x.id !== p.id);
      const tab = R.tabs.find((t) => t.programId === p.id);
      if (tab) closeTab(tab.id);
      save();
      refreshHome();
    },

    // Profile
    'import-cv': async (el) => {
      if (await importCv(el)) refreshHome();
    },
    'list-add': (el) => {
      const kind = el.dataset.kind;
      S.profile[kind].push({ id: uid() });
      save();
      refreshHome();
      const items = $$(`#sec-${kind} .item`);
      const last = items[items.length - 1];
      if (last) {
        last.scrollIntoView({ block: 'center', behavior: 'smooth' });
        const input = $('input', last);
        if (input) input.focus({ preventScroll: true });
      }
    },
    'list-remove': async (el) => {
      const { kind, i } = el.dataset;
      const it = S.profile[kind][+i];
      const filled = it && Object.values(it).some(Boolean);
      if (filled && !(await confirmDialog({ title: `Remove ${LISTS[kind].name(it)}?`, body: 'This entry will be deleted from your profile.', confirm: 'Remove', danger: true }))) return;
      S.profile[kind].splice(+i, 1);
      save();
      refreshHome();
    },
    'doc-pick': async (el) => {
      try {
        const path = await api('pickFile', { title: 'Choose a file' });
        if (!path) return;
        await keepDoc(el.dataset.key, path);
        save();
        refreshHome();
      } catch (err) {
        toast(err.message, 'bad');
      }
    },
    'doc-clear': (el) => {
      delete S.profile.documents[el.dataset.key];
      save();
      refreshHome();
    },
    'answer-remove': (el) => {
      S.profile.answers.splice(+el.dataset.i, 1);
      save();
      refreshHome();
    },

    // Essays
    'essay-add': () => essayDialog(),
    'essay-draft': (el) => draftEssay(el.dataset.id),
    'essay-read': (el) => readDraft(el.dataset.id, +el.dataset.i),
    'essay-manual': (el) => {
      const e = essayById(el.dataset.id);
      if (!e) return;
      e.manual = true;
      save();
      repaintEssay(e.id);
      const ta = $(`textarea[data-essay="${e.id}"]`);
      if (ta) ta.focus();
    },
    'essay-options': (el) => {
      const e = essayById(el.dataset.id);
      if (!e) return;
      e.showOptions = true;
      repaintEssay(e.id);
    },
    'essay-copy': async (el) => {
      const e = essayById(el.dataset.id);
      if (!e) return;
      try {
        await navigator.clipboard.writeText(e.text || '');
        toast('Copied.');
      } catch {
        toast('Could not copy. Select the text and press Ctrl+C.', 'bad');
      }
    },
    'essay-insert': async (el) => {
      const e = essayById(el.dataset.id);
      if (e) await insertEssay(e);
    },
    'essay-edit': (el) => {
      go('essays');
      const card = $(`[data-essay-card="${el.dataset.id}"]`);
      if (card) card.scrollIntoView({ block: 'center' });
    },
    'essay-remove': async (el) => {
      const e = essayById(el.dataset.id);
      if (!e) return;
      if ((e.text || (e.options && e.options.length)) && !(await confirmDialog({ title: 'Remove this prompt?', body: 'Its drafts and your answer will be deleted.', confirm: 'Remove', danger: true }))) return;
      S.essays = S.essays.filter((x) => x.id !== e.id);
      R.essaySource.delete(e.id);
      for (const t of R.tabs) if (t.pending) t.pending.essays = t.pending.essays.filter((id) => id !== e.id);
      save();
      refreshHome();
    },

    // Settings
    'key-save': async () => {
      const input = $('#keyInput');
      const key = input.value.trim();
      if (!key) return input.focus();
      const msg = $('#keyMsg');
      msg.textContent = 'Checking the key…';
      try {
        await api('setKey', { key });
        await api('testKey', { model: S.settings.model });
        R.hasKey = true;
        toast('AI connected.');
        refreshHome();
      } catch (err) {
        await api('setKey', { key: '' }).catch(() => {});
        R.hasKey = false;
        msg.textContent = err.message;
        msg.style.color = 'var(--red)';
      }
    },
    'key-test': async () => {
      const msg = $('#keyMsg');
      msg.textContent = 'Testing…';
      try {
        await api('testKey', { model: S.settings.model });
        msg.textContent = 'Working. Tassel can reach the AI.';
      } catch (err) {
        msg.textContent = err.message;
      }
    },
    'key-remove': async () => {
      if (!(await confirmDialog({ title: 'Remove your AI key?', body: 'Tassel will only be able to fill the basics until you add a key again.', confirm: 'Remove key', danger: true }))) return;
      await api('setKey', { key: '' }).catch(() => {});
      R.hasKey = false;
      refreshHome();
    },
    model: (el) => {
      S.settings.model = el.dataset.id;
      save();
      refreshHome();
    },
    // Tag boxes (fields of study, places)
    'tag-add': (el) => pickTag(el.dataset.set, el.dataset.v, !!el.closest('.tag-suggest')),
    'tag-x': (el) => changeTags(el.dataset.set, (t) => t.set(t.get().filter((v) => v !== el.dataset.v))),
    'open-data': () => api('openDataFolder').catch((err) => toast(err.message, 'bad')),
    'sync-choose': () => chooseSyncFolder(),
    'sync-off': async () => {
      if (!(await confirmDialog({ title: 'Stop syncing?', body: 'Tassel will keep a copy of everything on this computer and stop using the synced folder. The folder itself is left as it is.', confirm: 'Stop syncing' }))) return;
      try {
        flush();
        const res = await api('syncDisable', { state: S });
        R.sync = res.sync;
        adoptState(res.state);
        toast('Syncing is off. Your data is on this computer.');
      } catch (err) {
        toast(err.message, 'bad');
      }
    },
    reset: async () => {
      const yes = await confirmDialog({
        title: 'Erase everything?',
        body: 'This deletes your profile, programs, essays, AI key and university sign-ins from this computer. It cannot be undone.',
        confirm: 'Erase everything',
        danger: true,
      });
      if (!yes) return;
      for (const t of [...R.tabs]) closeTab(t.id);
      clearTimeout(saveTimer);
      try {
        await api('resetAll');
      } catch (err) {
        return toast(err.message, 'bad');
      }
      S = defaults();
      S.settings.model = R.info.defaultModel;
      R.hasKey = false;
      Object.assign(ob, { step: 0, fields: [], countries: [], levels: ['masters'], mode: '', key: '', busy: false, note: '', err: false, first: '', last: '', email: '', imported: false });
      R.essaySource.clear();
      renderSide();
      renderView();
      renderOnboard();
    },

    // Browser
    'nav-back': () => {
      const t = activeTab();
      if (t && t.wcId) t.wv.goBack();
    },
    'nav-forward': () => {
      const t = activeTab();
      if (t && t.wcId) t.wv.goForward();
    },
    'nav-reload': () => {
      const t = activeTab();
      if (!t || !t.wcId) return;
      if (t.loading) t.wv.stop();
      else t.wv.reload();
    },
    'toggle-agent': () => {
      S.settings.panel = S.settings.panel === false;
      save();
      const t = activeTab();
      if (t) renderToolbar(t);
    },
    fill: () => {
      const t = activeTab();
      if (t) fillAndAdvance(t);
    },
    'next-page': async () => {
      const t = activeTab();
      if (!t || t.busy) return;
      if (await advance(t)) fillAndAdvance(t, true);
    },
    reveal: (el) => {
      const t = activeTab();
      if (t && t.wcId && el.dataset.ref) api('revealRef', { wcId: t.wcId, ref: el.dataset.ref }).catch(() => {});
    },
    'q-pick': (el) => {
      const t = activeTab();
      if (t) answerQuestion(t, el.dataset.ref, el.dataset.v, el.closest('.a-card'));
    },
    'q-skip': (el) => {
      const t = activeTab();
      if (!t || !t.pending) return;
      t.pending.questions = t.pending.questions.filter((x) => x.ref !== el.dataset.ref);
      renderAgent(t);
      maybeAutoAdvance(t);
    },
    'upload-pick': async (el) => {
      const t = activeTab();
      if (!t || !t.pending) return;
      const u = t.pending.uploads.find((x) => x.ref === el.dataset.ref);
      if (!u) return;
      try {
        const path = await api('pickFile', { title: `Choose a file for “${u.label}”` });
        if (!path) return;
        await api('uploadFile', { wcId: t.wcId, ref: u.ref, path });
        u.done = true;
        if (u.document && u.document !== 'other' && !S.profile.documents[u.document]) await keepDoc(u.document, path);
        addLog(t, { tone: 'good', text: `Attached ${baseName(path)} to “${u.label}”.` });
        maybeAutoAdvance(t);
      } catch (err) {
        toast(err.message, 'bad');
      }
    },

    // Onboarding
    'ob-mode': (el) => {
      readOnboard();
      ob.mode = el.dataset.mode;
      ob.note = '';
      ob.err = false;
      renderOnboard();
    },

    // Connecting an AI app over MCP
    'copy-text': async (el) => {
      try {
        await navigator.clipboard.writeText(el.dataset.text || '');
        toast(el.dataset.done || 'Copied.');
        if (el.closest('.connect') && !S.settings.aiApp) {
          S.settings.aiApp = true;
          save();
        }
      } catch {
        toast('Could not copy. Select the text and press Ctrl+C.', 'bad');
      }
    },
    'mcp-claude': async () => {
      try {
        await api('mcpInstallClaude');
        R.mcpInfo = await api('mcpInfo');
        S.settings.aiApp = true;
        save();
        toast('Added. Quit and reopen Claude Desktop, then say “Use Tassel”.');
      } catch (err) {
        toast(err.message, 'bad');
      }
      if (inSetup()) renderOnboard();
      else refreshHome();
    },
    'mcp-remove': async () => {
      try {
        await api('mcpRemoveClaude');
        R.mcpInfo = await api('mcpInfo');
        toast('Removed from Claude Desktop.');
      } catch (err) {
        toast(err.message, 'bad');
      }
      if (inSetup()) renderOnboard();
      else refreshHome();
    },
    say: () => sayDialog(['profile', 'cv', 'find', 'fill', 'all'], '', 'Things to say to your AI app', 'Paste any of these into the AI app you connected. It does the work inside Tassel while you watch.'),

    'ob-next': () => onboardNext(),
    'ob-back': () => {
      readOnboard();
      ob.step = Math.max(0, ob.step - 1);
      ob.note = '';
      ob.err = false;
      renderOnboard();
    },
    'ob-skip': () => {
      readOnboard();
      ob.step = 2;
      ob.note = '';
      ob.err = false;
      renderOnboard();
    },
    'ob-cv': async (el) => {
      readOnboard();
      const ok = await importCv(el);
      if (ok) {
        const per = S.profile.personal;
        ob.imported = true;
        ob.first = per.firstName || ob.first;
        ob.last = per.lastName || ob.last;
        ob.email = per.email || ob.email;
        ob.err = false;
        ob.note = `Got it${per.firstName ? ', ' + per.firstName : ''}. Found ${plural(S.profile.education.length, 'school')} and ${plural(S.profile.experience.length, 'role')}. You can review everything under Profile.`;
      }
      renderOnboard();
    },
    'ob-finish': () => finishOnboard(),
  };

  /* ---------------------------------------------------------------- */
  /* Event wiring                                                       */
  /* ---------------------------------------------------------------- */
  document.addEventListener('click', (ev) => {
    if (ev.target.id === 'modal') return closeModal();
    if (ev.target.classList.contains('tagbox')) {
      const input = $('.tag-input', ev.target);
      if (input) input.focus();
      return;
    }
    const el = ev.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const act = el.dataset.act;
    if (R.modal && el.closest('#modal')) {
      const h = R.modal.handlers[act] || actions[act];
      if (h) h(el, ev);
      return;
    }
    // A tab's close button sits inside the tab: handle the innermost action only.
    if (actions[act]) actions[act](el, ev);
  });

  let tickTimer = null;
  let sideTimer = null;
  // Keep the caret in the tag box while a suggestion is being clicked.
  document.addEventListener('mousedown', (ev) => {
    if (ev.target.closest && ev.target.closest('.sg')) ev.preventDefault();
  });

  document.addEventListener('focusout', (ev) => {
    if (ev.target.dataset && ev.target.dataset.uniSearch) {
      setTimeout(() => {
        if (document.activeElement !== uniSg.input) hideUniSuggest();
      }, 180);
      return;
    }
    if (!(ev.target.classList && ev.target.classList.contains('tag-input'))) return;
    // Close the list once the caret has really left this box (not when the box was merely redrawn).
    setTimeout(() => {
      const now = document.activeElement;
      const stillHere = now && now.classList && now.classList.contains('tag-input') && now.dataset.set === suggest.id;
      if (!stillHere) hideSuggest();
    }, 180);
  });

  document.addEventListener('input', (ev) => {
    const el = ev.target;
    if (el.classList.contains('tag-input')) return showSuggest(el);
    if (el.dataset.uniSearch) return showUniSuggest(el);
    if (R.modal && R.modal.onInput && el.closest('#modal')) R.modal.onInput(el);
    if (el.dataset.path) {
      setPath(el.dataset.path, el.value);
      save();
      const tick = $('#savedTick');
      if (tick) {
        tick.classList.add('show');
        clearTimeout(tickTimer);
        tickTimer = setTimeout(() => tick.classList.remove('show'), 1400);
      }
      clearTimeout(sideTimer);
      sideTimer = setTimeout(renderSide, 400);
      return;
    }
    if (el.dataset.essay) {
      const e = essayById(el.dataset.essay);
      if (!e) return;
      e.text = el.value;
      save();
      const wc = $(`[data-wc="${e.id}"]`);
      if (wc) {
        const n = words(e.text);
        wc.textContent = `${n} words${e.wordLimit ? ` of ${e.wordLimit}` : ''}`;
        wc.classList.toggle('over', !!e.wordLimit && n > e.wordLimit);
      }
    }
  });

  document.addEventListener('change', (ev) => {
    const el = ev.target;
    const kind = el.dataset.change;
    if (kind === 'check') {
      const p = programById(el.dataset.id);
      const item = p && p.checklist.find((c) => c.id === el.dataset.item);
      if (!item) return;
      item.done = el.checked;
      save();
      refreshHome();
    } else if (kind === 'status') {
      const p = programById(el.dataset.id);
      if (!p) return;
      p.status = el.value;
      save();
      refreshHome();
    } else if (kind === 'q-select') {
      const t = activeTab();
      if (t && el.value) answerQuestion(t, el.dataset.ref, el.value, el.closest('.a-card'));
    } else if (el.id === 'autopilot') {
      S.settings.autopilot = el.checked;
      save();
      toast(el.checked ? 'Autopilot on. Tassel moves to the next page when nothing needs you. It never submits.' : 'Autopilot off.');
    }
  });

  document.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const form = ev.target;
    if (form.id === 'urlForm') {
      const t = activeTab();
      const raw = $('#urlInput').value.trim();
      if (!t || !raw) return;
      const looksLikeUrl = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) || (/^[^\s]+\.[^\s]{2,}$/.test(raw) && !raw.includes(' '));
      const url = looksLikeUrl ? normUrl(raw) : 'https://www.google.com/search?q=' + encodeURIComponent(raw);
      if (!url) return toast('That does not look like a web address.', 'bad');
      $('#urlInput').blur();
      try {
        t.wv.loadURL(url).catch(() => {});
      } catch {
        t.wv.setAttribute('src', url); // tab not attached yet
      }
    } else if (form.dataset.submit === 'check-add') {
      const p = programById(form.dataset.id);
      const label = $('input', form).value.trim();
      if (!p || !label) return;
      p.checklist.push({ id: uid(), label, done: false });
      save();
      refreshHome();
    } else if (form.dataset.submit === 'q-type') {
      const t = activeTab();
      const input = $('input', form);
      if (t && input.value.trim()) answerQuestion(t, form.dataset.ref, input.value, form.closest('.a-card'));
    }
  });

  $('#urlInput').addEventListener('focus', (ev) => {
    const t = activeTab();
    if (t && isPractice(t.url)) ev.target.value = '';
    setTimeout(() => ev.target.select(), 0);
  });
  $('#urlInput').addEventListener('blur', () => {
    const t = activeTab();
    if (t) renderToolbar(t);
  });

  document.addEventListener('keydown', (ev) => {
    const mod = ev.ctrlKey || ev.metaKey;
    // University search boxes: arrows move, Enter takes the highlighted one (or, on the page, what you typed).
    if (ev.target.dataset && ev.target.dataset.uniSearch) {
      const input = ev.target;
      const open = uniSg.input === input && uniSg.items.length > 0;
      if (open && (ev.key === 'ArrowDown' || ev.key === 'ArrowUp')) {
        ev.preventDefault();
        const n = uniSg.items.length;
        uniSg.index = ev.key === 'ArrowDown' ? (uniSg.index + 1) % n : (uniSg.index - 1 + n) % n;
        return paintUniSuggest();
      }
      if (open && ev.key === 'Escape') {
        ev.preventDefault();
        return hideUniSuggest();
      }
      if (ev.key === 'Enter') {
        if (open && uniSg.index >= 0) {
          ev.preventDefault();
          return pickUni(uniSg.items[uniSg.index].u, input);
        }
        if (input.dataset.uniSearch === 'page') {
          ev.preventDefault();
          return addTypedUni(input);
        }
        hideUniSuggest();
      }
    }
    // Tag boxes: arrows move through suggestions; Enter takes the highlighted one or what you typed;
    // comma adds what you typed; Backspace on an empty box removes the last tag.
    if (ev.target.classList && ev.target.classList.contains('tag-input')) {
      const input = ev.target;
      const id = input.dataset.set;
      const open = suggest.id === id && suggest.items.length > 0;
      if (open && (ev.key === 'ArrowDown' || ev.key === 'ArrowUp')) {
        ev.preventDefault();
        const n = suggest.items.length;
        suggest.index = ev.key === 'ArrowDown' ? (suggest.index + 1) % n : (suggest.index - 1 + n) % n;
        return paintSuggest(input);
      }
      if (open && ev.key === 'Escape') {
        ev.preventDefault();
        return hideSuggest();
      }
      if (open && suggest.index >= 0 && (ev.key === 'Enter' || ev.key === 'Tab')) {
        ev.preventDefault();
        return pickTag(id, suggest.items[suggest.index], true);
      }
      if ((ev.key === 'Enter' || ev.key === ',') && input.value.trim()) {
        ev.preventDefault();
        hideSuggest();
        return changeTags(id, () => {});
      }
      if (ev.key === ',') return ev.preventDefault();
      if (ev.key === 'Backspace' && !input.value && TAGSETS[id] && TAGSETS[id].get().length) {
        ev.preventDefault();
        return changeTags(id, (t) => t.set(t.get().slice(0, -1)));
      }
    }
    if (ev.key === 'Escape' && R.modal) return closeModal();
    if (ev.key === 'Enter' && !mod && !$('#onboard').hidden && ev.target.tagName === 'INPUT') {
      if (ob.step < 2) onboardNext();
      else finishOnboard();
      return;
    }
    if (ev.key === 'Enter' && R.modal && ev.target.tagName === 'INPUT' && ev.target.type !== 'checkbox') {
      const h = R.modal.handlers['m-save'] || R.modal.handlers['m-search'];
      if (h) {
        ev.preventDefault();
        h(ev.target, ev);
      }
      return;
    }
    if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.classList && ev.target.classList.contains('tab') && ev.target.dataset.id) {
      ev.preventDefault();
      return switchTo(ev.target.dataset.id);
    }
    if (!mod || R.modal || !$('#onboard').hidden) return;
    const t = activeTab();
    if (ev.key === 'Enter' && t) {
      ev.preventDefault();
      fillAndAdvance(t);
    } else if (ev.key.toLowerCase() === 'w' && t) {
      ev.preventDefault();
      closeTab(t.id);
    } else if (ev.key === '1') {
      ev.preventDefault();
      switchTo('home');
    } else if (ev.key.toLowerCase() === 'l' && t) {
      ev.preventDefault();
      $('#urlInput').focus();
    }
  });

  window.addEventListener('focus', checkSync);
  setInterval(checkSync, 30000);
  window.tassel.onExternalState((state) => {
    adoptState(state);
    toast('Your other device saved newer changes, so Tassel loaded those.');
  });

  window.tassel.onProgress(({ wcId, text }) => {
    const tab = R.tabs.find((t) => t.wcId === wcId);
    if (!tab || !tab.busy) return;
    tab.progress = text;
    if (R.active === tab.id) renderAgent(tab);
  });

  /* ---------------------------------------------------------------- */
  /* Start                                                              */
  /* ---------------------------------------------------------------- */
  function endSplash() {
    const splash = $('#splash');
    if (!splash || splash.classList.contains('leaving')) return;
    splash.classList.add('leaving');
    document.body.classList.remove('booting');
    window.tassel.setChrome('light');
    setTimeout(() => splash.remove(), 750);
  }

  async function start() {
    const began = Date.now();
    $('#navBack').innerHTML = ico('back');
    $('#navForward').innerHTML = ico('forward');
    $('#navReload').innerHTML = ico('reload');
    $('#agentToggle').innerHTML = ico('panel');
    $('#fillIco').innerHTML = ico('spark');
    $('#splash').addEventListener('click', endSplash);
    try {
      R.info = await api('info');
      S = hydrate(await api('loadState'));
      R.hasKey = (await api('keyStatus')).hasKey;
      R.mcpInfo = await api('mcpInfo');
      R.sync = await api('syncStatus');
    } catch (err) {
      console.error(err);
    }
    if (!R.info.models[S.settings.model]) S.settings.model = R.info.defaultModel;
    if (R.info.platform === 'darwin') document.body.classList.add('mac');

    if (!S.onboarded) {
      ob.fields = [...S.fields];
      ob.countries = [...S.countries];
      ob.levels = [...S.levels];
      renderOnboard();
    }
    renderTabs();
    renderSide();
    renderView();

    if (R.info.smoke) window.__tassel = { S: () => S, R, go, openTab, switchTo, fillAndAdvance, endSplash, finishOnboard, renderOnboard, ob, refreshHome, adoptState, checkSync, flush, letterMessage, recommenders };
    const wait = Math.max(0, 2500 - (Date.now() - began));
    setTimeout(endSplash, wait);
  }

  start();
})();
