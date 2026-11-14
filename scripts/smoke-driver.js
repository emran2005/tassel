// Test driver, loaded by main.js only when TASSEL_SMOKE is set (see scripts/smoke.js).
// It drives the real window through every screen, with a stand-in for the AI so the whole
// fill pipeline can be checked without an API key, and saves screenshots + results.json.
const { app, webContents } = require('electron');
const fs = require('fs');
const path = require('path');

module.exports = function smoke(win) {
  const outDir = process.env.TASSEL_SMOKE;
  fs.mkdirSync(outDir, { recursive: true });
  const ai = require('../src/ai');
  const store = require('../src/store');
  const results = { checks: [], errors: [] };
  const check = (name, pass, detail) => {
    results.checks.push({ name, pass: !!pass, detail });
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  ' + JSON.stringify(detail) : ''}`);
  };

  /* ---- stand-in AI ---- */
  store.setKey('smoke-test-key');
  const calls = { map: 0, essays: 0, find: 0 };
  ai.testKey = async () => true;
  let findArgs = null;
  ai.findPrograms = async (args) => {
    findArgs = args;
    calls.find++;
    return [
      { university: 'Northfield University', program: 'MSc Economics', country: 'United States', url: 'https://example.edu/apply', deadline: '2026-12-15', note: 'GRE optional; one-year program', tier: 'target', fit: 'GPA sits in their usual range' },
      { university: 'Harrow Institute of Technology', program: 'MS Applied Economics', country: 'United States', url: 'https://example.org/grad', deadline: '2027-01-10', note: 'Rolling admissions', tier: 'reach', fit: 'Admits mostly 3.9+ with research' },
      { university: 'University of Eastmoor', program: 'MSc Economics and Policy', country: 'United Kingdom', url: '', deadline: '', note: 'No application fee', tier: 'safer', fit: 'Well above their average intake' },
    ];
  };
  ai.draftEssays = async ({ prompt }) => {
    calls.essays++;
    return [
      { angle: 'The thesis that started it', text: `Draft A for: ${prompt.slice(0, 40)}. My undergraduate thesis on regional labor markets [name the dataset] is where this began.` },
      { angle: 'The question I want to answer', text: 'Draft B. I want to understand why policy shocks land so unevenly across places.' },
      { angle: 'Where I am headed', text: 'Draft C. After this degree I plan to work in applied policy research.' },
    ];
  };
  ai.mapFields = async ({ fields, buttons, profile }) => {
    calls.map++;
    const plan = { page_kind: 'form', fills: [], questions: [], essays: [], uploads: [], next_button: '', note: '' };
    const edu = profile.education[0] || {};
    const rec = profile.recommenders[0] || {};
    for (const f of fields) {
      const l = (f.label || '').toLowerCase();
      if (f.kind === 'file') plan.uploads.push({ id: f.id, document: /transcript/.test(l) ? 'transcript' : 'cv' });
      else if (f.kind === 'textarea') plan.essays.push({ id: f.id, prompt: f.label, word_limit: /500/.test(l) ? 500 : 150 });
      else if (/citizenship/.test(l)) plan.fills.push({ id: f.id, value: 'United States of America' });
      else if (/^country/.test(l)) plan.fills.push({ id: f.id, value: 'United States of America' });
      else if (/gender/.test(l)) plan.questions.push({ id: f.id, question: 'Which gender should I select?', options: f.options });
      else if (/start term/.test(l)) plan.questions.push({ id: f.id, question: 'When do you want to start?', options: ['Fall 2027', 'Spring 2028', 'Not a real option'] });
      else if (/mode of study/.test(l)) plan.fills.push({ id: f.id, value: 'Full-time' });
      else if (/institution/.test(l)) plan.fills.push({ id: f.id, value: edu.institution });
      else if (/degree awarded/.test(l)) plan.fills.push({ id: f.id, value: 'Bachelor of Science (BSc)' });
      else if (/major/.test(l)) plan.fills.push({ id: f.id, value: edu.major });
      else if (/gpa/.test(l)) plan.fills.push({ id: f.id, value: '3.72' });
      else if (/graduation date/.test(l)) plan.fills.push({ id: f.id, value: '06/2025' });
      else if (/gre verbal/.test(l)) plan.fills.push({ id: f.id, value: profile.tests.greVerbal });
      else if (/gre quant/.test(l)) plan.fills.push({ id: f.id, value: profile.tests.greQuant });
      else if (/hear about/.test(l)) plan.questions.push({ id: f.id, question: 'How did you hear about Northfield?', options: ['Web search', 'A professor or advisor'] });
      else if (/disciplinary/.test(l)) plan.questions.push({ id: f.id, question: 'Have you ever been subject to academic disciplinary action?', options: ['Yes', 'No'] });
      else if (/recommender name/.test(l)) plan.fills.push({ id: f.id, value: rec.name });
      else if (/recommender email/.test(l)) plan.fills.push({ id: f.id, value: rec.email });
      else if (/news/.test(l)) plan.fills.push({ id: f.id, value: 'false' });
    }
    const next = buttons.find((b) => /save and continue/i.test(b.text));
    if (next) plan.next_button = next.id;
    return plan;
  };

  /* ---- helpers ---- */
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const ui = (code) => win.webContents.executeJavaScript(code, true);
  const shot = async (name) => {
    await sleep(350);
    const img = await win.webContents.capturePage();
    fs.writeFileSync(path.join(outDir, name + '.png'), img.toPNG());
  };
  const click = (sel) => ui(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false; el.click(); return true; })()`);
  const type = (sel, value) =>
    ui(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false; el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  const guest = () => webContents.getAllWebContents().find((w) => w.getType() === 'webview' && !w.isDestroyed());
  const page = (code) => guest().executeJavaScript(code, true);
  const waitFor = async (fn, ms = 8000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      try {
        if (await fn()) return true;
      } catch {}
      await sleep(150);
    }
    return false;
  };
  const idle = () => waitFor(() => ui(`!window.__tassel.R.tabs.some(t => t.busy)`), 15000);

  const dummyPdf = path.join(outDir, 'Jordan-Avery-CV.pdf');
  fs.writeFileSync(dummyPdf, '%PDF-1.4\n% smoke test file\n');

  async function run() {
    win.webContents.on('console-message', (e) => {
      const level = e.level || '';
      if (level === 'error' || level === 3) results.errors.push(e.message);
    });

    await sleep(1700);
    await shot('01-opening');
    await waitFor(() => ui(`!document.getElementById('splash')`), 6000);

    // Onboarding
    await shot('02-onboard-study');
    check('onboarding shows on first run', await ui(`!document.getElementById('onboard').hidden`));
    const press = (sel, key) =>
      ui(`document.querySelector(${JSON.stringify(sel)}).dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(key)}, bubbles: true, cancelable: true }))`);
    const F = '.tag-input[data-set="ob-fields"]';
    const P = '.tag-input[data-set="ob-places"]';
    await click('[data-act="ob-next"]'); // nothing chosen yet: must not advance
    await sleep(150);
    check('setup: cannot continue with no field', (await ui(`window.__tassel.ob.step`)) === 0 && (await ui(`!!document.querySelector('.ob-note.err')`)));
    await click('[data-act="ob-level"][data-level="phd"]'); // master's and PhD
    await sleep(120);
    await type(F, 'Economics'); // typed + Enter
    await press(F, 'Enter');
    await sleep(150);
    await click('[data-act="tag-add"][data-set="ob-fields"][data-v="Public Policy"]'); // picked from the ideas
    await sleep(150);
    await type(F, 'Zoology');
    await press(F, 'Enter');
    await sleep(150);
    await click('[data-act="tag-x"][data-set="ob-fields"][data-v="Zoology"]'); // removed again
    await sleep(150);
    await click('[data-act="tag-add"][data-set="ob-places"][data-v="Anywhere"]');
    await sleep(150);
    await type(F, 'MSc Finance'); // typed, never entered: must still count
    await click('[data-act="tag-add"][data-set="ob-places"][data-v="United States"]'); // replaces "Anywhere"
    await sleep(150);
    check('setup: idea chips follow what you added (Economics -> Econometrics)', await ui(`!!document.querySelector('[data-act="tag-add"][data-set="ob-fields"][data-v="Econometrics"]')`));
    await type(P, 'ger'); // suggestions while typing
    await sleep(150);
    const sg = await ui(`(() => { const box = document.querySelector('[data-tagbox="ob-places"]').parentElement.querySelector('.tag-suggest'); return { open: !box.hidden, items: [...box.querySelectorAll('.sg')].map(b => b.textContent), on: (box.querySelector('.sg.on') || {}).textContent }; })()`);
    check('setup: typing "ger" suggests Germany', sg.open && sg.items[0] === 'Germany' && sg.on === 'Germany', sg);
    await shot('02a-suggestions');
    await press(P, 'Enter');
    await sleep(200);
    check('setup: Enter takes the suggestion', (await ui(`window.__tassel.ob.countries.join('|')`)) === 'United States|Germany');
    await click('[data-act="tag-x"][data-set="ob-places"][data-v="Germany"]');
    await sleep(150);
    await type(P, 'Munich'); // a city typed by hand, left pending
    await shot('02b-onboard-study-filled');
    await click('[data-act="ob-next"]');
    await sleep(150);
    const picked = await ui(`({ fields: window.__tassel.ob.fields, places: window.__tassel.ob.countries, step: window.__tassel.ob.step })`);
    check('setup: several fields, typed and picked', picked.fields.join('|') === 'Economics|Public Policy|MSc Finance' && picked.step === 1, picked.fields);
    check('setup: places are free text, "Anywhere" is exclusive', picked.places.join('|') === 'United States|Munich', picked.places);
    await shot('03-onboard-ai');
    await click('[data-act="ob-skip"]');
    await type('#obFirst', 'Jordan');
    await type('#obLast', 'Avery');
    await type('#obEmail', 'jordan.avery@example.com');
    await shot('04-onboard-you');
    await click('[data-act="ob-finish"]');
    await sleep(700);
    const savedSetup = await ui(`({ fields: window.__tassel.S().fields, field: window.__tassel.S().field, places: window.__tassel.S().countries })`);
    check('onboarding saved every field and place', savedSetup.field === 'Economics, Public Policy, MSc Finance' && savedSetup.fields.length === 3 && savedSetup.places.length === 2, savedSetup);

    // Find programs (opens by itself after onboarding when the AI is connected)
    check('find dialog opened', await waitFor(() => ui(`!!document.querySelector('.tag-input[data-set="find-fields"]')`), 3000));
    check('find dialog starts with your fields and places', (await ui(`document.querySelectorAll('#modal .tag').length`)) === 5);
    await shot('05-find');
    await click('[data-act="m-mix"][data-mix="top"]');
    await sleep(100);
    await click('[data-act="m-count"][data-count="20"]');
    await sleep(100);
    await click('[data-act="m-search"]');
    await waitFor(() => ui(`!!document.querySelector('#modal .result')`), 5000);
    await shot('06-find-results');
    await click('[data-act="m-add"]');
    await sleep(300);
    check('3 programs added', (await ui(`window.__tassel.S().programs.length`)) === 3);
    await shot('07-programs');
    check('setup saved both degree levels', (await ui(`window.__tassel.S().levels.join('|')`)) === 'masters|phd' && (await ui(`document.querySelector('.view-head .sub').textContent`)).includes("Master's and PhD"));
    check('search is told how many, how ambitious, and the applicant\'s standing', findArgs && findArgs.count === 20 && findArgs.mix === 'top' && !!findArgs.profile && findArgs.levels.join('|') === 'masters|phd', findArgs && { count: findArgs.count, mix: findArgs.mix });
    const mix = await ui(`({ tiers: window.__tassel.S().programs.map(p => p.tier).join('|'), line: document.querySelector('.mix').textContent, fit: document.querySelector('.app .note').textContent })`);
    check('found programs arrive sorted into reach / target / safer, with a reason', mix.tiers === 'target|reach|safer' && /1 reach/.test(mix.line) && /1 target/.test(mix.line) && /1 safer/.test(mix.line) && /balanced/i.test(mix.line) && /GPA sits in their usual range/.test(mix.fit), mix);
    await click('[data-act="group-by"][data-by="tier"]');
    await sleep(200);
    const tv = await ui(`[...document.querySelectorAll('.tier-head .pill')].map(p => p.textContent)`);
    check('grouping by chance: reach, target, safer sections', tv.join('|') === 'Reach|Target|Safer' && (await ui(`document.querySelectorAll('.app .app-uni').length`)) === 3, tv);
    await shot('07d-by-chance');
    await click('[data-act="group-by"][data-by="university"]');
    await sleep(200);
    check('applications are grouped: one card per university', (await ui(`document.querySelectorAll('.uni').length`)) === 3 && (await ui(`document.querySelectorAll('.app').length`)) === 3);

    // A second program at the same university (a PhD), with an extra date.
    await click('[data-act="add-program"][data-uni="Northfield University"]');
    await sleep(200);
    check('add-a-program dialog knows the university', (await ui(`document.querySelector('#pgUni').value`)) === 'Northfield University' && (await ui(`document.querySelector('#pgCountry').value`)) === 'United States');
    await type('#pgProg', 'PhD in Economics');
    await type('#pgDeadline', '2027-01-05');
    await type('#pgFee', '$95');
    await click('[data-act="m-date-add"]');
    await type('#pgDates [data-date-label]', 'Funding deadline');
    await type('#pgDates [data-date-day]', '2026-12-01');
    await shot('07a-add-second-program');
    await click('[data-act="m-save"]');
    await sleep(300);
    const phd = await ui(`(() => { const p = window.__tassel.S().programs.find(x => x.program === 'PhD in Economics'); return p && { level: p.level, checks: p.checklist.length, dates: p.extraDeadlines, fee: p.fee, uni: p.university }; })()`);
    check('second program: recognised as a PhD, with its own checklist and dates', phd && phd.level === 'phd' && phd.checks === 10 && phd.dates.length === 1 && phd.dates[0].label === 'Funding deadline' && phd.fee === '$95', phd);
    check('one university card now holds two applications', (await ui(`document.querySelectorAll('.uni').length`)) === 3 && (await ui(`[...document.querySelectorAll('.uni')].find(u => u.textContent.includes('Northfield')).querySelectorAll('.app').length`)) === 2);
    check('nearest date shown is the funding deadline', (await ui(`[...document.querySelectorAll('.app')].find(a => a.textContent.includes('PhD in Economics')).querySelector('.pill:not(.tiny):not(.check)').textContent`)).startsWith('Funding deadline: Dec 1, 2026'));
    await click('[data-act="add-program"][data-uni="Northfield University"]');
    await sleep(150);
    await type('#pgProg', 'PhD in Economics');
    await click('[data-act="m-save"]');
    await sleep(150);
    check('the same program cannot be added twice', (await ui(`!document.querySelector('#pgErr').hidden`)) && (await ui(`window.__tassel.S().programs.length`)) === 4);
    await click('[data-act="m-cancel"]');

    // University search: suggestions, short names, logo.
    const U = '[data-uni-search="page"]';
    await type(U, 'mich');
    await sleep(150);
    const us = await ui(`[...document.querySelectorAll('.uni-search .sg')].map(b => b.textContent)`);
    check('university search: "mich" suggests Michigan', us.length >= 2 && us[0].startsWith('University of Michigan'), us.slice(0, 3));
    await shot('07b-university-search');
    await type(U, 'LSE');
    await sleep(150);
    await press(U, 'Enter');
    await sleep(250);
    const lse = await ui(`({ uni: document.querySelector('#pgUni').value, site: document.querySelector('#pgSite').value, country: document.querySelector('#pgCountry').value })`);
    check('university search: "LSE" + Enter picks the London School of Economics', lse.uni === 'London School of Economics and Political Science' && lse.site === 'lse.ac.uk' && lse.country === 'United Kingdom', lse);
    await type('#pgProg', 'MSc Economics');
    await click('[data-act="m-save"]');
    await sleep(300);
    check('searched university added', (await ui(`window.__tassel.S().programs.length`)) === 5 && (await ui(`document.querySelectorAll('.uni').length`)) === 4);
    const gotLogo = await waitFor(() => ui(`!!window.__tassel.R.logos['lse.ac.uk']`), 20000);
    if (gotLogo) check('logo fetched from the university site and shown', await ui(`!!document.querySelector('.crest.has-logo img[src^="data:image/"]')`));
    else console.log('SKIP  logo test (lse.ac.uk did not answer - offline?)');

    // Checklist on one application
    const phdId = await ui(`window.__tassel.S().programs.find(x => x.program === 'PhD in Economics').id`);
    await click(`[data-act="toggle-check"][data-id="${phdId}"]`);
    await sleep(150);
    await click('.checkpanel input[type="checkbox"]');
    await sleep(150);
    await ui(`(() => { const f = document.querySelector('.checkpanel form'); f.querySelector('input').value = 'Interview'; f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); })()`);
    await sleep(200);
    const ck = await ui(`(() => { const p = window.__tassel.S().programs.find(x => x.program === 'PhD in Economics'); return { done: p.checklist.filter(c => c.done).length, total: p.checklist.length, pill: document.querySelector('[data-act="toggle-check"][data-id="' + p.id + '"]:not(.letters)').textContent.trim(), facts: document.querySelector('.check-facts').textContent }; })()`);
    check('checklist: tick an item, add your own, see dates and fee', ck.done === 1 && ck.total === 11 && ck.pill === '1/11' && /Funding deadline/.test(ck.facts) && /\$95/.test(ck.facts), ck);
    await shot('07c-grouped-with-checklist');
    await click(`[data-act="toggle-check"][data-id="${phdId}"]`);

    // Profile
    await ui(`(() => { const S = window.__tassel.S(); Object.assign(S.profile.personal, {
        middleName: 'Lee', phone: '+1 555 010 0199', dob: '2002-03-14', gender: 'Female', citizenship: 'United States',
        address1: '18 Alder Street', city: 'Madison', state: 'Wisconsin', postalCode: '53703', country: 'United States' });
      S.profile.education = [{ institution: 'Lakeshore State University', degree: 'BSc', major: 'Economics', gpa: '3.72 / 4.0', startDate: '2021-09', endDate: '2025-06', country: 'United States' }];
      S.profile.tests = { greVerbal: '162', greQuant: '167', greWriting: '4.5' };
      S.profile.recommenders = [{ name: 'Dr. Priya Raman', title: 'Associate Professor', organization: 'Lakeshore State University', email: 'p.raman@example.edu', relationship: 'Thesis advisor' }];
      S.profile.story = 'I want to study how regional labor markets respond to policy shocks. My thesis used county-level data to look at minimum wage changes.';
      S.profile.documents.cv = ${JSON.stringify(dummyPdf)};
      window.__tassel.go('profile'); })()`);
    await shot('08-profile');
    await ui(`document.getElementById('view').scrollTop = 99999`);
    await shot('09-profile-bottom');

    // Recommendation letters
    await ui(`window.__tassel.go('letters')`);
    await sleep(200);
    const l0 = await ui(`({ cards: document.querySelectorAll('[data-rec-card]').length, rows: document.querySelectorAll('[data-rec-card] .app').length, needs: window.__tassel.S().programs.map(p => p.letters.needed).sort().join('') })`);
    check("letters: one card per recommender, a row per application; master's need 2, the PhD needs 3", l0.cards === 1 && l0.rows === 5 && l0.needs === '22223', l0);
    const ask = await ui(`window.__tassel.letterMessage(window.__tassel.recommenders()[0], 'ask')`);
    check('letters: the request email names every program and its date', ask.count === 5 && /^Dear Dr\. Priya Raman,/.test(ask.text) && ask.text.includes('- Northfield University, MSc Economics (due Dec 15, 2026)') && /Jordan Lee Avery|Jordan Avery/.test(ask.text.split('\n').pop()), ask.text.split('\n').slice(0, 3));
    await click('[data-act="letters-ask-all"]');
    await sleep(200);
    await click('[data-rec-card] [data-act="letter-set"][data-state="submitted"]');
    await sleep(200);
    const l1 = await ui(`({ nav: [...document.querySelectorAll('.nav-item')].find(x => x.textContent.includes('Letters')).querySelector('.count').textContent,` +
      ` pills: [...document.querySelectorAll('[data-rec-card] .uni-head .pill')].map(p => p.textContent).join('|'), remind: window.__tassel.letterMessage(window.__tassel.recommenders()[0], 'remind').count,` +
      ` request: !!document.querySelector('[data-act="letters-copy"][data-kind="ask"]') })`);
    check('letters: ask everyone at once, mark one in, see what is still open', l1.nav === '4' && l1.pills === '0 to ask|4 waiting|1 in' && l1.remind === 4 && !l1.request, l1);
    // A letter asked two weeks ago with the deadline close gets flagged.
    const soon = new Date(Date.now() + 10 * 864e5);
    const soonIso = `${soon.getFullYear()}-${String(soon.getMonth() + 1).padStart(2, '0')}-${String(soon.getDate()).padStart(2, '0')}`;
    const past = new Date(Date.now() - 16 * 864e5);
    const pastIso = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, '0')}-${String(past.getDate()).padStart(2, '0')}`;
    await ui(`(() => { const T = window.__tassel; const p = T.S().programs.find(x => x.university.startsWith('London School')); p.deadline = '${soonIso}'; p.letters.by[T.recommenders()[0].id] = { state: 'asked', askedOn: '${pastIso}' }; T.refreshHome(); })()`);
    await sleep(200);
    check('letters: an overdue one is flagged for a reminder', /asked 16 days ago, due in 10 days: worth a reminder/.test(await ui(`(document.querySelector('[data-rec-card] .note.nudge') || {}).textContent || ''`)));
    await shot('09a-letters');
    await ui(`(() => { const T = window.__tassel; T.S().programs.find(x => x.university.startsWith('London School')).deadline = ''; T.go('programs'); })()`);
    // Inside one application: lower how many it needs; the checklist line ticks itself.
    const phdApp = await ui(`window.__tassel.S().programs.find(x => x.program === 'PhD in Economics').id`);
    await click(`[data-act="toggle-check"][data-id="${phdApp}"]`);
    await sleep(150);
    await click('[data-act="letter-need"][data-d="-1"]');
    await sleep(150);
    await click('[data-act="letter-need"][data-d="-1"]');
    await sleep(150);
    const l2 = await ui(`(() => { const p = window.__tassel.S().programs.find(x => x.program === 'PhD in Economics'); return { needed: p.letters.needed, ticked: p.checklist.find(c => c.label === 'Recommendation letters').done,` +
      ` pill: [...document.querySelectorAll('.app')].find(a => a.textContent.includes('PhD in Economics')).querySelector('.pill.check').textContent.trim(), box: !!document.querySelector('.letters-box .letter-seg') }; })()`);
    check('letters: shown in the application, and the checklist line ticks itself when enough are in', l2.needed === 1 && l2.ticked === true && l2.pill === '1/1' && l2.box, l2);
    await shot('09b-letters-in-application');
    await click(`[data-act="toggle-check"][data-id="${phdApp}"]`);

    // Practice application
    await ui(`window.__tassel.go('programs')`);
    await click('[data-act="practice"]');
    check('practice tab loaded', await waitFor(() => ui(`window.__tassel.R.tabs[0] && !!window.__tassel.R.tabs[0].wcId && !window.__tassel.R.tabs[0].loading`), 10000));
    await sleep(500);
    await shot('10-practice-before');

    // Page 1
    await click('#fillBtn');
    await sleep(200);
    await idle();
    await shot('11-practice-page1');
    const p1 = await page(`({ fn: fn.value, mn: mn.value, ln: ln.value, dob: dob.value, cit: cit.value, ssn: ssn.value, em: em.value, ph: ph.value,
      a1: a1.value, city: city.value, st: st.value, zip: zip.value, ctry: ctry.value, ecn: ecn.value, ecp: ecp.value,
      gender: (document.querySelector('input[name=gender]:checked') || {}).value || '' })`);
    check('page 1: name, contact, address filled', p1.fn === 'Jordan' && p1.mn === 'Lee' && p1.ln === 'Avery' && p1.em === 'jordan.avery@example.com' && p1.ph === '+1 555 010 0199' && p1.a1 === '18 Alder Street' && p1.city === 'Madison' && p1.st === 'Wisconsin' && p1.zip === '53703', p1);
    check('page 1: date of birth filled', p1.dob === '2002-03-14', p1.dob);
    check('page 1: selects matched "United States of America"', p1.cit === 'United States of America' && p1.ctry === 'United States of America', [p1.cit, p1.ctry]);
    check('page 1: SSN left alone', p1.ssn === '');
    check('page 1: emergency contact NOT filled with applicant details', p1.ecn === '' && p1.ecp === '', [p1.ecn, p1.ecp]);
    check('page 1: gender asked, not guessed', p1.gender === '' && (await ui(`window.__tassel.R.tabs[0].pending.questions.length`)) === 1);
    await click('[data-act="q-pick"][data-v="Female"]');
    await sleep(500);
    check('page 1: answering the question fills the radio', (await page(`(document.querySelector('input[name=gender]:checked') || {}).value`)) === 'F');
    check('answer remembered', await ui(`window.__tassel.S().profile.answers.some(a => a.a === 'Female')`));
    await shot('12-practice-page1-answered');

    // Page 2 via the Next button in the panel
    await click('[data-act="next-page"]');
    await sleep(600);
    await idle();
    await shot('13-practice-page2');
    const p2 = await page(`({ step: document.querySelector('.steps .on').textContent, term: term.value, mode: mode.value, inst: inst.value, deg: deg.value, maj: maj.value,
      gpa: gpa.value, grad: grad.value, grev: grev.value, greq: greq.value, cv: cv.files.length ? cv.files[0].name : '', tr: tr.files.length, hear: hear.value })`);
    check('page 2 reached', /Academic/.test(p2.step), p2.step);
    check('page 2: academic fields filled', p2.mode === 'Full-time' && p2.inst === 'Lakeshore State University' && p2.deg === 'Bachelor of Science (BSc)' && p2.maj === 'Economics' && p2.gpa === '3.72' && p2.grad === '06/2025' && p2.grev === '162' && p2.greq === '167', p2);
    check('page 2: CV attached', p2.cv === 'Jordan-Avery-CV.pdf', p2.cv);
    check('page 2: missing transcript not attached, flagged', p2.tr === 0 && (await ui(`window.__tassel.R.tabs[0].pending.uploads.filter(u => !u.done).length`)) === 1);
    const q2 = await ui(`window.__tassel.R.tabs[0].pending.questions.map(q => ({ q: q.question, o: q.options }))`);
    check('page 2: three questions, invalid option removed', q2.length === 3 && !JSON.stringify(q2).includes('Not a real option'), q2);
    await click('[data-act="q-pick"][data-v="Fall 2027"]');
    await sleep(400);
    await click('[data-act="q-pick"][data-v="Web search"]');
    await sleep(400);
    await click('[data-act="q-pick"][data-v="No"]');
    await sleep(400);
    const p2b = await page(`({ term: term.value, hear: hear.value, disc: (document.querySelector('input[name=discipline]:checked') || {}).value })`);
    check('page 2: answers applied', p2b.term === 'Fall 2027' && p2b.hear === 'Web search' && p2b.disc === 'no', p2b);
    await shot('14-practice-page2-answered');

    // Page 3: essays + consent
    await click('[data-act="next-page"]');
    await sleep(600);
    await idle();
    await shot('15-practice-page3');
    const st3 = await ui(`(() => { const t = window.__tassel.R.tabs[0]; return { essays: t.pending.essays.length, left: t.pending.left.map(l => l.label), next: !!t.next }; })()`);
    check('page 3: two essay prompts found', st3.essays === 2, st3);
    check('page 3: certification left for the applicant', st3.left.length === 1 && /certify/i.test(st3.left[0]), st3.left);
    const p3 = await page(`({ rn: rn.value, re: re.value, cert: cert.checked, news: news.checked, sop: sop.value })`);
    check('page 3: recommender filled, boxes untouched', p3.rn === 'Dr. Priya Raman' && p3.re === 'p.raman@example.edu' && !p3.cert && !p3.news && p3.sop === '', p3);
    await click('#agent [data-act="essay-draft"]');
    await waitFor(() => ui(`!!document.querySelector('#agent .a-opt')`), 5000);
    await shot('16-essay-options');
    await click('#agent .a-opt');
    await sleep(300);
    await shot('17-essay-reader');
    await click('#modal [data-act="m-ok"]');
    await sleep(700);
    const sop = await page(`sop.value`);
    check('page 3: chosen draft typed into the form', /^Draft A for: Statement of purpose/.test(sop), sop.slice(0, 60));
    await shot('18-essay-inserted');

    // Essays, settings
    await ui(`window.__tassel.go('essays')`);
    await shot('19-essays');
    await ui(`window.__tassel.go('settings')`);
    await shot('20-settings');
    await ui(`window.__tassel.go('programs')`);
    await click('[data-act="add-program"]');
    await shot('21-add-program');
    await click('[data-act="m-cancel"]');

    // Autopilot: a program tab, saved answers reused, pages advance by themselves, stops where a human is needed.
    await ui(`(() => { const T = window.__tassel; const S = T.S(); const t = T.R.tabs[0];
      document.querySelector('[data-act="tab-close"][data-id="' + t.id + '"]').click();
      S.programs.find(p => p.university === 'Northfield University').url = T.R.info.practiceUrl;
      S.settings.autopilot = true; T.refreshHome(); })()`);
    check('tab closed', (await ui(`window.__tassel.R.tabs.length`)) === 0);
    await click('[data-act="open-program"]');
    await waitFor(() => ui(`window.__tassel.R.tabs[0] && !!window.__tassel.R.tabs[0].wcId && !window.__tassel.R.tabs[0].loading`), 10000);
    await sleep(400);
    await click('#fillBtn');
    const reached3 = await waitFor(async () => /Statements/.test(await page(`document.querySelector('.steps .on').textContent`)) && (await ui(`!window.__tassel.R.tabs[0].busy`)), 25000);
    await sleep(500);
    await shot('22-autopilot-stopped');
    const chrome = await ui(`({ chip: document.querySelector('#deadlineChip').hidden ? '' : document.querySelector('#deadlineChip').textContent, tab: document.querySelector('#tabs .tab-title').textContent, where: document.querySelector('.agent-head .where').textContent })`);
    check('application tab shows its deadline, program and level', /^Due Dec 15, 2026/.test(chrome.chip) && chrome.tab === 'Northfield University · MSc Economics' && /Master's$/.test(chrome.where), chrome);
    check('autopilot: went from page 1 to page 3 on one click', reached3);
    const auto = await ui(`(() => { const T = window.__tassel; const t = T.R.tabs[0]; const S = T.S();
      return { status: S.programs.find(p => p.university === 'Northfield University').status, essays: S.essays.length,
        blockers: t.pending.essays.length + t.pending.left.length, next: !!t.next }; })()`);
    check('autopilot: stopped for the essays and the certification', auto.blockers === 3, auto);
    check('program marked in progress', auto.status === 'in_progress', auto.status);
    const still = await page(`({ step: document.querySelector('.steps .on').textContent, cert: cert.checked, gender: (document.querySelector('input[name=gender]:checked') || {}).value, term: term.value })`);
    check('autopilot: never ticked the certification or moved past it', /Statements/.test(still.step) && !still.cert, still);
    check('saved answers were reused without asking', still.gender === 'F' && still.term === 'Fall 2027', still);

    // Start all: several applications at once, in background tabs.
    await ui(`(() => { const T = window.__tassel; const S = T.S(); S.settings.autopilot = false;` +
      ` for (const name of ['Harrow Institute of Technology', 'London School of Economics and Political Science']) S.programs.find(p => p.university === name).url = T.R.info.practiceUrl;` +
      ` T.switchTo('home'); T.go('programs'); })()`);
    await click('[data-act="batch"]');
    await sleep(250);
    check('start-all dialog lists every application that has a link', (await ui(`document.querySelectorAll('#modal .result').length`)) === 3);
    await shot('22a-start-all');
    await click('#modal [data-act="m-ok"]');
    const batchDone = await waitFor(() => ui(`!!window.__tassel.R.batch && window.__tassel.R.batch.items.every(i => i.state !== 'queued' && i.state !== 'working')`), 90000);
    await sleep(600);
    const bt = await ui(`(() => { const T = window.__tassel; return { states: T.R.batch.items.map(i => i.state).join('|'), tabs: T.R.tabs.length, active: T.R.active, rows: document.querySelectorAll('.batch .app').length,` +
      ` harrow: T.S().programs.find(p => p.university === 'Harrow Institute of Technology').status, details: T.R.batch.items.map(i => i.detail) }; })()`);
    check('start all: three applications worked through in the background', batchDone && bt.tabs === 3 && bt.active === 'home' && bt.rows === 3, bt);
    check('start all: each one filled as far as it can go, then waits for you', bt.states === 'needs|needs|needs' && bt.harrow === 'in_progress' && bt.details.every((d) => /for you on/.test(d)), bt);
    const reached = [];
    for (const wc of webContents.getAllWebContents().filter((w) => w.getType() === 'webview' && !w.isDestroyed())) reached.push(await wc.executeJavaScript(`document.querySelector('.steps .on').textContent`));
    check('start all: every tab got to page 3 by itself (Autopilot was off)', reached.length === 3 && reached.every((r) => /Statements/.test(r)), reached);
    await shot('22b-start-all-done');
    await click('[data-act="batch-close"]');

    // A real website over https (public test form). Nothing is submitted.
    await ui(`(() => { const T = window.__tassel; T.S().settings.autopilot = false; T.openTab({ url: 'https://httpbin.org/forms/post', title: 'Real site test' }); })()`);
    const online = await waitFor(async () => {
      const t = webContents.getAllWebContents().find((w) => w.getType() === 'webview' && /httpbin/.test(w.getURL()));
      return t && !t.isLoading() && (await t.executeJavaScript(`!!document.querySelector('input[name=custemail]')`));
    }, 20000);
    if (!online) {
      console.log('SKIP  real website test (page did not load - offline?)');
    } else {
      await sleep(600);
      await click('#fillBtn');
      await sleep(300);
      await idle();
      const real = webContents.getAllWebContents().find((w) => w.getType() === 'webview' && /httpbin/.test(w.getURL()));
      const rv = await real.executeJavaScript(`({ tel: document.querySelector('input[name=custtel]').value, email: document.querySelector('input[name=custemail]').value, url: location.href })`);
      check('real https site: phone and email filled, nothing submitted', rv.tel === '+1 555 010 0199' && rv.email === 'jordan.avery@example.com' && /forms\/post$/.test(rv.url), rv);
      await shot('23-real-site');
    }

    // The real window, including the native title bar buttons.
    try {
      await ui(`window.__tassel.switchTo('home')`);
      await sleep(400);
      const { desktopCapturer } = require('electron');
      const sources = await desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width: 1400, height: 900 } });
      const me = sources.find((s) => s.name === 'Tassel');
      if (me) fs.writeFileSync(path.join(outDir, '24-window.png'), me.thumbnail.toPNG());
    } catch (err) {
      console.log('window capture skipped', err.message);
    }

    // Persistence
    await ui(`window.dispatchEvent(new Event('beforeunload'))`);
    await sleep(400);
    const saved = store.loadState();
    check('state persisted to disk', saved && saved.programs.length === 5 && saved.profile.personal.firstName === 'Jordan' && saved.essays.length >= 4, saved && saved.essays.length);
    check('AI key file is encrypted on disk', (() => { try { const b = fs.readFileSync(path.join(app.getPath('userData'), 'tassel-key.bin')); return b.subarray(0, 4).toString() === 'enc:' && !b.includes('smoke-test-key'); } catch { return false; } })());
    check('AI stand-in was used', calls.map >= 6 && calls.essays === 1 && calls.find === 1, calls);

    /* ---- Folder sync between devices ---- */
    const syncDir = path.join(outDir, 'synced-folder');
    fs.rmSync(syncDir, { recursive: true, force: true });
    fs.mkdirSync(syncDir, { recursive: true });
    const syncFile = path.join(syncDir, 'tassel-data.json');
    const turnOn = (adopt) =>
      ui(`(async () => { const T = window.__tassel; T.flush(); const r = await window.tassel.syncEnable({ dir: ${JSON.stringify(syncDir)}, adopt: ${adopt}, state: T.S() });
        if (r.ok) { T.R.sync = r.data.sync; T.adoptState(r.data.state); } return r.ok ? '' : r.error; })()`);
    check('sync: turns on for an empty folder', (await turnOn(false)) === '');
    const shared = JSON.parse(fs.readFileSync(syncFile, 'utf8'));
    const cvToken = await ui(`window.__tassel.S().profile.documents.cv`);
    check('sync: data file is in the folder', shared.programs.length === 5 && shared.profile.personal.firstName === 'Jordan');
    check('sync: the CV travels with it', cvToken === 'sync:documents/cv-Jordan-Avery-CV.pdf' && fs.existsSync(path.join(syncDir, 'documents', 'cv-Jordan-Avery-CV.pdf')) && (await ui(`window.tassel.fileExists({ path: window.__tassel.S().profile.documents.cv }).then(r => r.data)`)) === true, cvToken);
    await ui(`window.__tassel.go('settings')`);
    await ui(`document.getElementById('sec-sync').scrollIntoView({ block: 'center' })`);
    await shot('24a-sync-on');
    await ui(`document.getElementById('view').scrollTop = 99999`);
    await shot('24b-settings-bottom');
    // "The other device" saves a change.
    const other = JSON.parse(fs.readFileSync(syncFile, 'utf8'));
    other.profile.personal.preferredName = 'FromLaptop';
    other.savedAt = Date.now() + 5000;
    await sleep(1100); // let the file time move on
    fs.writeFileSync(syncFile, JSON.stringify(other));
    await ui(`window.__tassel.checkSync()`);
    await sleep(300);
    check('sync: picks up a change made on the other device', (await ui(`window.__tassel.S().profile.personal.preferredName`)) === 'FromLaptop');
    // The other device saves again while this one is about to save: this one must not overwrite it.
    const other2 = JSON.parse(fs.readFileSync(syncFile, 'utf8'));
    other2.profile.personal.preferredName = 'LaptopWins';
    other2.savedAt = Date.now() + 9000;
    await sleep(1100);
    fs.writeFileSync(syncFile, JSON.stringify(other2));
    await ui(`(() => { const T = window.__tassel; T.S().profile.personal.middleName = 'Stale'; T.flush(); })()`);
    await sleep(500);
    const afterClash = { here: await ui(`window.__tassel.S().profile.personal.preferredName`), mid: await ui(`window.__tassel.S().profile.personal.middleName`), file: JSON.parse(fs.readFileSync(syncFile, 'utf8')).profile.personal.preferredName };
    check('sync: never overwrites newer changes from the other device', afterClash.here === 'LaptopWins' && afterClash.file === 'LaptopWins' && afterClash.mid === 'Lee', afterClash);
    // Joining a folder that already has data (what the second device does).
    check('sync: a second device can adopt the folder', store.inspectFolder(syncDir).hasData && /5 applications/.test(store.inspectFolder(syncDir).summary), store.inspectFolder(syncDir).summary);
    const off = await ui(`(async () => { const T = window.__tassel; T.flush(); const r = await window.tassel.syncDisable({ state: T.S() }); if (r.ok) { T.R.sync = r.data.sync; T.adoptState(r.data.state); } return r.ok ? T.S().profile.documents.cv : r.error; })()`);
    check('sync: turning it off keeps the data and documents working', off === path.join(syncDir, 'documents', 'cv-Jordan-Avery-CV.pdf') && store.syncStatus().enabled === false && store.loadState().programs.length === 5, off);
    await ui(`(() => { const T = window.__tassel; delete T.S().profile.personal.preferredName; T.flush(); T.go('programs'); })()`);

    // Without an AI key: the basics still fill, and Tassel says clearly what it could not do.
    await store.setKey('');
    await ui(`(() => { const T = window.__tassel; for (const t of [...T.R.tabs]) document.querySelector('[data-act="tab-close"][data-id="' + t.id + '"]').click();
      T.R.hasKey = false; T.go('programs'); })()`);
    check('no key: banner explains what is missing', await ui(`!!document.querySelector('.banner')`));
    await shot('25-no-key-home');
    await click('[data-act="practice"]');
    await waitFor(() => ui(`window.__tassel.R.tabs[0] && !!window.__tassel.R.tabs[0].wcId && !window.__tassel.R.tabs[0].loading`), 10000);
    await sleep(400);
    const before = calls.map;
    await click('#fillBtn');
    await sleep(300);
    await idle();
    const nk = await page(`({ fn: fn.value, em: em.value, city: city.value })`);
    const nkLog = await ui(`window.__tassel.R.tabs[0].log.map(l => l.text || '').join(' | ')`);
    check('no key: basics filled from the profile', nk.fn === 'Jordan' && nk.em === 'jordan.avery@example.com' && nk.city === 'Madison', nk);
    check('no key: AI not called, and the panel says why fields are left', calls.map === before && /need the AI/.test(nkLog), nkLog);
    await shot('26-no-key-fill');

    /* ---- An AI app connected over MCP (no API key in Tassel) ---- */
    await ui(`(() => { const T = window.__tassel; for (const t of [...T.R.tabs]) document.querySelector('[data-act="tab-close"][data-id="' + t.id + '"]').click(); T.go('settings'); })()`);
    await shot('27-settings-connect');
    const { spawn } = require('child_process');
    const http = require('http');
    const connect = require('../src/connect');
    const control = require('../src/control');
    const spec = connect.launchSpec(); // exactly what an AI app would be told to run
    const child = spawn(spec.command, spec.args, { env: { ...process.env, ...spec.env }, stdio: ['pipe', 'pipe', 'pipe'] });
    let buf = '';
    let nextId = 1;
    const waiters = new Map();
    child.stdout.on('data', (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line) continue;
        const m = JSON.parse(line);
        const w = waiters.get(m.id);
        if (w) {
          waiters.delete(m.id);
          w(m);
        }
      }
    });
    child.stderr.on('data', (d) => console.log('bridge stderr:', String(d)));
    const rpc = (method, params) =>
      new Promise((resolve, reject) => {
        const id = nextId++;
        waiters.set(id, resolve);
        child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
        setTimeout(() => waiters.has(id) && reject(new Error('no answer to ' + method)), 45000);
      });
    const tool = async (name, args) => {
      const m = await rpc('tools/call', { name, arguments: args || {} });
      const t = m.result.content[0].text;
      return m.result.isError ? { error: t } : JSON.parse(t);
    };

    const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'smoke', version: '1' } });
    check('MCP: handshake', init.result.protocolVersion === '2025-06-18' && init.result.serverInfo.name === 'tassel' && !!init.result.capabilities.tools && /never submit/i.test(init.result.instructions), init.result.serverInfo);
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
    const listed = await rpc('tools/list', {});
    check('MCP: 14 tools, all with schemas', listed.result.tools.length === 14 && listed.result.tools.every((t) => t.name && t.description && t.inputSchema.type === 'object'), listed.result.tools.map((t) => t.name));
    const unknown = await rpc('resources/list', {});
    check('MCP: unknown method answered with an error, not silence', unknown.error && unknown.error.code === -32601);

    const ov = await tool('tassel_overview');
    check('MCP: overview', ov.wants_to_study.length === 3 && ov.programs.length === 5 && ov.degree_levels.length === 2 && ov.profile.complete_percent === 100, { study: ov.wants_to_study, programs: ov.programs.length });
    const up = await tool('update_profile', {
      personal: { preferredName: 'Jo', countryOfBirth: 'United States', shoeSize: '9' },
      add_experience: [{ organization: 'State Budget Office', title: 'Research Intern', startDate: '2024-06', endDate: '2024-08' }],
      saved_answers: [{ question: 'Mode of study', answer: 'Full-time' }],
    });
    const afterUp = await ui(`({ pn: window.__tassel.S().profile.personal.preferredName, exp: window.__tassel.S().profile.experience.length, ans: window.__tassel.S().profile.answers.some(a => a.q === 'Mode of study'), app: window.__tassel.S().settings.aiApp })`);
    check('MCP: chat-style profile update is saved in Tassel', afterUp.pn === 'Jo' && afterUp.exp === 1 && afterUp.ans && up.ignored_unknown_fields.includes('personal.shoeSize'), { afterUp, ignored: up.ignored_unknown_fields });
    check('MCP: Tassel shows the AI app as connected, without changing saved settings', afterUp.app === false && (await ui(`document.querySelector('.key-pill').textContent`)).includes('Your AI app is connected'));
    const badDob = await tool('update_profile', { personal: { dob: 'March 14' } });
    check('MCP: a badly formed date is rejected, not stored', !!badDob.error && (await ui(`window.__tassel.S().profile.personal.dob`)) === '2002-03-14', badDob.error);
    const addP = await tool('add_programs', { programs: [{ university: 'Calder University', program: 'MSc Econometrics', country: 'Canada', url: 'calder.example.edu/apply', deadline: '2027-02-01' }, { university: 'Northfield University', program: 'MSc Economics' }] });
    check('MCP: programs added, duplicates skipped', addP.added.length === 1 && addP.skipped.length === 1 && addP.added[0].url === 'https://calder.example.edu/apply', addP);

    const addPhd = await tool('add_programs', { programs: [{ university: 'MIT', program: 'PhD in Economics', level: 'phd', deadline: '2026-12-15', fee: '$90' }] });
    const mitId = addPhd.added[0].id;
    const upd = await tool('update_program', { id: mitId, add_dates: [{ label: 'Recommendations due', date: '2026-12-20' }], checklist: [{ item: 'Transcripts', done: true }, { item: 'Email Prof. Lee', done: false }] });
    check(
      'MCP: PhD application, short name resolved, dates and checklist set',
      addPhd.added[0].university === 'Massachusetts Institute of Technology' && addPhd.added[0].level === 'phd' && addPhd.added[0].university_website === 'mit.edu' && upd.other_dates.length === 1 && upd.checklist.find((c) => c.item === 'Transcripts').done === true && upd.checklist.length === 11,
      { uni: addPhd.added[0].university, dates: upd.other_dates, n: upd.checklist.length }
    );
    const withChance = await tool('add_programs', { programs: [{ university: 'Stanford University', program: 'MS Statistics', chance: 'reach', why: 'Admits few; GRE quant below their median' }] });
    const badChance = await tool('update_program', { id: withChance.added[0].id, chance: 'certain' });
    check('MCP: an AI app can mark reach / target / safer with a reason', withChance.added[0].chance === 'reach' && /below their median/.test(withChance.added[0].why) && /reach, target or safer/.test(badChance.error || ''), withChance.added[0]);
    const lt = await tool('update_program', { id: mitId, letters_needed: 3, letters: [{ recommender: 'dr. priya raman', state: 'asked' }] });
    const ltBad = await tool('update_program', { id: mitId, letters: [{ recommender: 'Prof. Nobody', state: 'asked' }] });
    check('MCP: an AI app can record letter status, and is told who the recommenders are', lt.letters_needed === 3 && lt.letters[0].recommender === 'Dr. Priya Raman' && lt.letters[0].state === 'asked' && !!lt.letters[0].asked_on && /The profile has: Dr\. Priya Raman/.test(ltBad.error || ''), { lt: lt.letters, err: ltBad.error });
    const badLevel = await tool('update_program', { id: mitId, level: 'postdoc' });
    check('MCP: an unknown degree level is rejected', /masters or phd/.test(badLevel.error || ''));

    const opened = await tool('open_application', { practice: true });
    check('MCP: opens the practice application', !!opened.tab_id, opened);
    const pg1 = await tool('read_page');
    const fld = (pg, re) => pg.fields.find((f) => re.test(f.label));
    const btn = (pg, re) => pg.buttons.find((b) => re.test(b.text));
    check('MCP: read_page lists fields, marks SSN off limits', pg1.heading === 'Personal details' && pg1.fields.length >= 15 && /Sensitive/.test(fld(pg1, /Social Security/).off_limits || '') && !!btn(pg1, /Save and continue/), { heading: pg1.heading, n: pg1.fields.length });
    const prof = await tool('get_profile');
    const per = prof.personal;
    const f1 = await tool('fill_fields', {
      fills: [
        { id: fld(pg1, /^First name/).id, value: per.firstName },
        { id: fld(pg1, /^Last name/).id, value: per.lastName },
        { id: fld(pg1, /Date of birth/).id, value: per.dob },
        { id: fld(pg1, /^Gender/).id, value: 'Female' },
        { id: fld(pg1, /citizenship/).id, value: 'United States of America' },
        { id: fld(pg1, /Social Security/).id, value: '123-45-6789' },
        { id: fld(pg1, /^Email/).id, value: per.email },
        { id: fld(pg1, /Mobile phone/).id, value: per.phone },
        { id: fld(pg1, /Street address/).id, value: per.address1 },
        { id: fld(pg1, /^City/).id, value: per.city },
        { id: fld(pg1, /^Country$/).id, value: 'United States of America' },
        { id: '999:t1', value: 'x' },
      ],
    });
    const m1 = await page(`({ fn: fn.value, ssn: ssn.value, cit: cit.value, gender: (document.querySelector('input[name=gender]:checked') || {}).value })`);
    check('MCP: fills the form, refuses the SSN and unknown fields', f1.filled === 10 && f1.not_filled === 2 && m1.fn === 'Jordan' && m1.ssn === '' && m1.cit === 'United States of America' && m1.gender === 'F', { filled: f1.filled, m1 });
    await shot('28-mcp-filled');
    const next1 = await tool('click_button', { button_id: btn(pg1, /Save and continue/).id });
    const pg2 = await tool('read_page');
    check('MCP: presses Next and reads page 2', next1.pressed === 'Save and continue' && pg2.heading === 'Academic background', pg2.heading);
    const att = await tool('attach_document', { field_id: fld(pg2, /CV/).id, document: 'cv' });
    const att2 = await tool('attach_document', { field_id: fld(pg2, /transcript/).id, document: 'transcript' });
    check('MCP: attaches the CV, explains the missing transcript', /Jordan-Avery-CV.pdf$/.test(att.attached) && /no "transcript" on file/.test(att2.error || ''), { att, att2 });
    await tool('fill_fields', {
      fills: [
        { id: fld(pg2, /start term/).id, value: 'Fall 2027' },
        { id: fld(pg2, /Mode of study/).id, value: 'Full-time' },
        { id: fld(pg2, /Institution/).id, value: 'Lakeshore State University' },
        { id: fld(pg2, /Degree awarded/).id, value: 'Bachelor of Science (BSc)' },
        { id: fld(pg2, /Major/).id, value: 'Economics' },
        { id: fld(pg2, /hear about/).id, value: 'Web search' },
        { id: fld(pg2, /disciplinary/).id, value: 'No' },
      ],
    });
    await tool('click_button', { button_id: btn(pg2, /Save and continue/).id });
    const pg3 = await tool('read_page');
    const certField = pg3.fields.find((f) => /certify/i.test(f.label));
    const tick = await tool('fill_fields', { fills: [{ id: certField.id, value: 'true' }] });
    check('MCP: refuses to tick the certification', pg3.heading === 'Statements' && tick.filled === 0 && /legal statement/i.test(tick.results[0].note) && !(await page(`cert.checked`)), tick.results[0]);
    const essay = await tool('save_essay', {
      prompt: fld(pg3, /Statement of purpose/).label,
      word_limit: 500,
      field_id: fld(pg3, /Statement of purpose/).id,
      chosen: 2,
      drafts: [
        { angle: 'The thesis', text: 'MCP draft one.' },
        { angle: 'The question', text: 'MCP draft two, the one the applicant picked.' },
      ],
    });
    check('MCP: essay drafts saved and the chosen one typed in', essay.typed_into_form && (await page(`sop.value`)) === 'MCP draft two, the one the applicant picked.', essay);
    const badEssay = await tool('save_essay', { prompt: 'x', field_id: certField.id, drafts: [{ angle: 'a', text: 'b' }] });
    check('MCP: essay text cannot be aimed at a non-text field', /must be a text field/.test(badEssay.error || ''), badEssay.error);
    // The applicant ticks the box themselves; the AI app may then go to the review page, but never submit.
    await page(`cert.click()`);
    await tool('click_button', { button_id: btn(pg3, /Save and continue/).id });
    const pg4 = await tool('read_page');
    const submit = btn(pg4, /Submit/);
    const pressed = await tool('click_button', { button_id: submit.id });
    const step = await page(`document.querySelector('.steps .on').textContent`);
    check('MCP: will not press Submit', !!submit.off_limits && /does not press/.test(pressed.error || '') && /Review/.test(step), { off: submit.off_limits, err: pressed.error, step });
    await shot('29-mcp-review');

    // The local door: wrong token, or a request coming from a web page, gets nothing.
    const conn = JSON.parse(fs.readFileSync(control.connectionFile(), 'utf8'));
    const knock = (headers) =>
      new Promise((resolve) => {
        const body = JSON.stringify({ tool: 'get_profile', args: {} });
        const req = http.request({ host: '127.0.0.1', port: conn.port, path: '/call', method: 'POST', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body), ...headers } }, (res) => {
          res.resume();
          resolve(res.statusCode);
        });
        req.on('error', () => resolve(0));
        req.end(body);
      });
    const codes = [await knock({ authorization: 'Bearer wrong' }), await knock({}), await knock({ authorization: 'Bearer ' + conn.token, origin: 'https://evil.example' })];
    check('MCP door: refuses a wrong token, no token, and web pages', codes.join(',') === '401,401,403', codes);

    // "Add to Claude Desktop" against a stand-in settings folder (never the real one).
    const fakeRoot = path.join(outDir, 'fake-appdata');
    fs.rmSync(fakeRoot, { recursive: true, force: true });
    fs.mkdirSync(path.join(fakeRoot, 'Roaming', 'Claude'), { recursive: true });
    fs.mkdirSync(path.join(fakeRoot, 'Local'), { recursive: true });
    const fakeCfg = path.join(fakeRoot, 'Roaming', 'Claude', 'claude_desktop_config.json');
    fs.writeFileSync(fakeCfg, JSON.stringify({ theme: 'dark', mcpServers: { other: { command: 'x' } } }));
    const realEnv = { APPDATA: process.env.APPDATA, LOCALAPPDATA: process.env.LOCALAPPDATA };
    if (process.platform === 'win32') {
      // On Windows, go through the real folder lookup (including the Store-install path).
      process.env.APPDATA = path.join(fakeRoot, 'Roaming');
      process.env.LOCALAPPDATA = path.join(fakeRoot, 'Local');
    } else {
      process.env.TASSEL_CLAUDE_DIR = path.join(fakeRoot, 'Roaming', 'Claude');
    }
    try {
      connect.installClaudeDesktop();
      const cfg = JSON.parse(fs.readFileSync(fakeCfg, 'utf8'));
      check(
        'Add to Claude Desktop: adds Tassel, keeps everything else, leaves a backup',
        cfg.theme === 'dark' && cfg.mcpServers.other.command === 'x' && cfg.mcpServers.tassel.env.ELECTRON_RUN_AS_NODE === '1' && /bridge\.js$/.test(cfg.mcpServers.tassel.args[0]) && fs.existsSync(fakeCfg + '.before-tassel') && connect.info().claudeDesktopInstalled,
        cfg.mcpServers.tassel
      );
      connect.removeClaudeDesktop();
      const cfg2 = JSON.parse(fs.readFileSync(fakeCfg, 'utf8'));
      check('Remove from Claude Desktop: takes only Tassel out', !cfg2.mcpServers.tassel && cfg2.mcpServers.other.command === 'x');
    } finally {
      delete process.env.TASSEL_CLAUDE_DIR;
      if (process.platform === 'win32') {
        process.env.APPDATA = realEnv.APPDATA;
        process.env.LOCALAPPDATA = realEnv.LOCALAPPDATA;
      }
    }
    child.kill();
    check('no console errors', results.errors.length === 0, results.errors);
  }

  run()
    .catch((err) => {
      results.errors.push(String((err && err.stack) || err));
      console.log('SMOKE CRASH', err);
    })
    .finally(() => {
      const failed = results.checks.filter((c) => !c.pass).length;
      results.summary = `${results.checks.length - failed}/${results.checks.length} checks passed`;
      fs.writeFileSync(path.join(outDir, 'results.json'), JSON.stringify(results, null, 2));
      console.log(results.summary);
      app.exit(failed || results.errors.length ? 1 : 0);
    });
};
