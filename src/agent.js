// The fill pipeline for one page of an application:
//   1. read every form control in every frame        (code, instant)
//   2. fill what is certain from the profile          (code, instant)
//   3. ask Claude about the rest, in ONE request      (AI)
//   4. type the answers in, attach documents          (code)
// Whatever needs a human decision is handed back to the UI as questions / essay prompts.
const fs = require('fs');
const scripts = require('./pagescripts');
const { instantValue, classify, norm } = require('./heuristics');
const ai = require('./ai');
const store = require('./store');

const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);

function framesOf(wc) {
  try {
    return wc.mainFrame.framesInSubtree.filter(
      (f) => f && !(typeof f.isDestroyed === 'function' && f.isDestroyed()) && !f.detached
    );
  } catch {
    return [wc.mainFrame];
  }
}

const fullRef = (frame, ref) => `${frame.frameTreeNodeId}:${ref}`;
const splitRef = (full) => {
  const i = String(full).indexOf(':');
  return { frameId: Number(String(full).slice(0, i)), ref: String(full).slice(i + 1) };
};
const validRef = (full) => /^\d+:t\d+$/.test(String(full));

async function scan(wc) {
  const page = { url: wc.getURL(), title: wc.getTitle(), heading: '', text: '' };
  const fields = [];
  const buttons = [];
  let hasPassword = false;
  const main = wc.mainFrame;
  for (const frame of framesOf(wc)) {
    let res;
    try {
      res = await withTimeout(frame.executeJavaScript(scripts.EXTRACT, true), 5000);
    } catch {
      continue; // ad frames, frames mid-navigation, etc.
    }
    if (!res) continue;
    if (frame === main) {
      page.heading = res.heading;
      page.text = res.text;
    } else if (!page.heading && res.fields.length) {
      page.heading = res.heading;
    }
    hasPassword = hasPassword || res.hasPassword;
    for (const f of res.fields) fields.push({ ...f, ref: fullRef(frame, f.ref) });
    for (const b of res.buttons) buttons.push({ ...b, ref: fullRef(frame, b.ref) });
  }
  return { page, fields, buttons, hasPassword };
}

async function inFrame(wc, full, makeScript) {
  if (!validRef(full)) return { ok: false, note: 'Unknown field.' };
  const { frameId, ref } = splitRef(full);
  const frame = framesOf(wc).find((f) => f.frameTreeNodeId === frameId);
  if (!frame) return { ok: false, note: 'That part of the page is gone.' };
  try {
    return await withTimeout(frame.executeJavaScript(makeScript(ref), true), 5000);
  } catch (err) {
    return { ok: false, note: 'The page did not respond.' };
  }
}

/** items: [{ ref: 'frameId:tN', value }] -> [{ ref, ok, value?, note? }] */
async function applyFills(wc, items) {
  const byFrame = new Map();
  const results = [];
  for (const it of items) {
    if (!validRef(it.ref)) {
      results.push({ ref: it.ref, ok: false, note: 'Unknown field.' });
      continue;
    }
    const { frameId, ref } = splitRef(it.ref);
    if (!byFrame.has(frameId)) byFrame.set(frameId, []);
    byFrame.get(frameId).push({ ref, value: it.value });
  }
  const frames = framesOf(wc);
  for (const [frameId, list] of byFrame) {
    const frame = frames.find((f) => f.frameTreeNodeId === frameId);
    if (!frame) {
      for (const it of list) results.push({ ref: `${frameId}:${it.ref}`, ok: false, note: 'That part of the page is gone.' });
      continue;
    }
    try {
      const res = await withTimeout(frame.executeJavaScript(scripts.fillScript(list), true), 8000);
      for (const r of res) results.push({ ...r, ref: `${frameId}:${r.ref}` });
    } catch {
      for (const it of list) results.push({ ref: `${frameId}:${it.ref}`, ok: false, note: 'The page did not respond.' });
    }
  }
  return results;
}

const click = (wc, full) => inFrame(wc, full, scripts.clickScript);
const reveal = (wc, full) => inFrame(wc, full, scripts.revealScript);

// Attach a local file to an <input type="file"> through the DevTools protocol.
async function upload(wc, full, filePath) {
  if (!validRef(full)) throw new Error('Unknown field.');
  if (!filePath || !fs.existsSync(filePath)) throw new Error('That file is no longer where it was. Re-add it in your Profile.');
  const { frameId, ref } = splitRef(full);
  if (frameId !== wc.mainFrame.frameTreeNodeId) throw new Error('This upload box is inside an embedded frame. Attach the file yourself.');
  const dbg = wc.debugger;
  let attached = false;
  try {
    if (!dbg.isAttached()) {
      dbg.attach('1.3');
      attached = true;
    }
    const { result } = await dbg.sendCommand('Runtime.evaluate', {
      expression: `document.querySelector('[data-tassel-ref="${ref}"]')`,
    });
    if (!result || !result.objectId) throw new Error('That upload box is no longer on the page.');
    await dbg.sendCommand('DOM.setFileInputFiles', { files: [filePath], objectId: result.objectId });
  } finally {
    if (attached) {
      try {
        dbg.detach();
      } catch {}
    }
  }
}

const DOC_LABELS = {
  cv: /\b(cv|resume|résumé|curriculum vitae)\b/i,
  transcript: /\btranscripts?\b|academic record/i,
  statement: /\b(statement of purpose|personal statement|sop|motivation letter|letter of motivation)\b/i,
  testReport: /\b(gre|gmat|toefl|ielts|test (score|report)s?|score report)\b/i,
  passport: /\bpassport\b/i,
  writingSample: /\bwriting sample\b/i,
  proposal: /\bresearch (proposal|statement|plan)\b/i,
};

function guessDocument(field) {
  const text = [field.label, field.name, field.section].join(' ');
  for (const [key, re] of Object.entries(DOC_LABELS)) if (re.test(text)) return key;
  return '';
}

// A stable fingerprint of the page's form, used to notice "we did not actually move on".
const signatureOf = (page, fields) =>
  norm(page.heading) + '|' + fields.map((f) => f.kind + ':' + norm(f.label).slice(0, 40)).join(',');

const NEVER_CLICK = /\b(submit|pay|payment|checkout|purchase|sign|certify|finish|finali[sz]e|complete application|withdraw|delete|remove|cancel|log ?out|sign ?out|log ?in|login|register|create (an |my )?account|i agree|accept)\b/i;
const NEXT_WORDS = /^(next|continue|save (and|&) (continue|next|proceed)|save and go|proceed|next step|next page|continue to next( section| step| page)?)\b/i;

/**
 * Fill the page currently shown in `wc`. `say(text)` reports progress to the UI.
 */
async function fillPage(wc, opts, say) {
  const { profile, program, field, term, model } = opts;
  say('Reading the page…');
  const { page, fields, buttons, hasPassword } = await scan(wc);
  const result = {
    ok: true,
    pageKind: 'form',
    heading: page.heading || page.title,
    url: page.url,
    signature: signatureOf(page, fields),
    filled: [],
    failed: [],
    questions: [],
    essays: [],
    uploads: [],
    left: [],
    next: null,
    note: '',
    aiUsed: false,
    noKey: false,
    fieldCount: fields.length,
  };

  if (hasPassword) {
    result.pageKind = 'login';
    result.note = 'This is a sign-in page. Sign in or create your account yourself, then press Fill this page on the form.';
    return result;
  }
  if (!fields.length && buttons.some((b) => /\bsubmit\b/i.test(b.text))) {
    result.pageKind = 'review';
    return result;
  }
  if (!fields.length) {
    result.pageKind = 'empty';
    result.note = 'There is nothing to fill in on this page yet. Open the application form, then press Fill this page.';
    return result;
  }

  // Sort the fields.
  const instant = [];
  const forAI = [];
  let alreadyFilled = 0;
  for (const f of fields) {
    const cls = classify(f);
    if (cls) {
      if (!f.filled || cls === 'consent') {
        result.left.push({
          ref: f.ref,
          label: f.label || f.name || 'Field',
          reason: cls === 'sensitive' ? 'Sensitive - type this yourself' : 'Yours to tick - read it first',
          // A legal statement always needs the applicant; a sensitive field only if the form requires it.
          blocking: cls === 'consent' || !!f.required,
        });
      }
      continue;
    }
    if (f.filled && f.kind !== 'checkbox') {
      alreadyFilled++;
      continue;
    }
    if (f.kind === 'checkbox' && f.filled) continue;
    const v = instantValue(f, profile);
    if (v) instant.push({ field: f, value: v });
    else forAI.push(f);
  }

  const record = (list, via, results) => {
    for (const { field: f, value } of list) {
      const r = results.find((x) => x.ref === f.ref);
      if (r && r.ok) result.filled.push({ ref: f.ref, label: f.label || f.name, value: r.value != null ? r.value : value, via });
      else result.failed.push({ ref: f.ref, label: f.label || f.name, value, note: (r && r.note) || 'Could not fill this field.' });
    }
  };

  // Instant pass.
  if (instant.length) {
    const res = await applyFills(wc, instant.map((x) => ({ ref: x.field.ref, value: x.value })));
    record(instant, 'instant', res);
    say(`Filled ${result.filled.length} field${result.filled.length === 1 ? '' : 's'} straight from your profile…`);
  }

  // Fallback "next" guess (used when the AI is not available).
  const guessNext = () => {
    const b = buttons.find((x) => NEXT_WORDS.test(x.text.trim()) && !NEVER_CLICK.test(x.text));
    return b ? { ref: b.ref, text: b.text } : null;
  };

  const fileFields = forAI.filter((f) => f.kind === 'file');
  const attach = async (f, docKey) => {
    const path = docKey && profile.documents && store.resolveDoc(profile.documents[docKey]);
    const entry = { ref: f.ref, label: f.label || 'Upload', document: docKey || '', done: false, note: '', required: !!f.required };
    if (!path) {
      entry.note = docKey ? `Add your ${docKey === 'cv' ? 'CV' : docKey} under Profile → Documents and I'll attach it next time.` : 'Attach this file yourself.';
    } else {
      try {
        await upload(wc, f.ref, path);
        entry.done = true;
        entry.file = path.split(/[\\/]/).pop();
      } catch (err) {
        entry.note = err.message;
      }
    }
    result.uploads.push(entry);
  };

  if (!forAI.length) {
    result.next = guessNext();
    return result;
  }

  if (!store.hasKey()) {
    result.noKey = true;
    for (const f of fileFields) await attach(f, guessDocument(f));
    const rest = forAI.length - fileFields.length;
    if (rest > 0) {
      result.note = `${rest} more field${rest === 1 ? '' : 's'} on this page need the AI. Ask your connected AI app to fill in this application, or add an API key in Settings.`;
    }
    result.next = guessNext();
    return result;
  }

  // AI pass: one request for everything that is left.
  say(`Working out ${forAI.length} more field${forAI.length === 1 ? '' : 's'}…`);
  const idOf = new Map();
  const fieldById = new Map();
  const aiFields = forAI.map((f, i) => {
    const id = 'F' + (i + 1);
    idOf.set(f.ref, id);
    fieldById.set(id, f);
    const o = { id, kind: f.kind, label: f.label };
    for (const k of ['section', 'group', 'hint', 'placeholder', 'name', 'maxLength', 'accept']) if (f[k]) o[k] = f[k];
    if (f.required) o.required = true;
    if (f.options) {
      o.options = f.options;
      if (f.optionCount > f.options.length) o.options_truncated = true;
    }
    return o;
  });
  const buttonById = new Map();
  const aiButtons = buttons.map((b, i) => {
    const id = 'B' + (i + 1);
    buttonById.set(id, b);
    return { id, text: b.text };
  });

  let plan;
  try {
    plan = await ai.mapFields({
      model,
      profile,
      program,
      field,
      term,
      page: { title: page.title, heading: page.heading, url: page.url, text: page.text, fields_already_filled: alreadyFilled },
      fields: aiFields,
      buttons: aiButtons,
    });
  } catch (err) {
    result.note = ai.friendly(err);
    result.aiError = true;
    result.next = guessNext();
    return result;
  }
  result.aiUsed = true;
  result.pageKind = plan.page_kind || 'form';
  result.note = plan.note || '';

  const used = new Set();
  const take = (id) => {
    const f = fieldById.get(id);
    if (!f || used.has(id)) return null;
    used.add(id);
    return f;
  };

  // Essays first, so a long-text field can never also be "filled" with a one-liner.
  for (const e of plan.essays || []) {
    const f = take(e.id);
    if (!f || f.kind === 'file' || f.kind === 'select' || f.kind === 'radio' || f.kind === 'checkbox') continue;
    result.essays.push({
      ref: f.ref,
      prompt: (e.prompt || f.label || '').trim(),
      wordLimit: Math.max(0, Number(e.word_limit) || 0),
    });
  }

  const aiFills = [];
  for (const x of plan.fills || []) {
    const f = take(x.id);
    if (!f || f.kind === 'file' || x.value == null || String(x.value).trim() === '') continue;
    aiFills.push({ field: f, value: String(x.value) });
  }
  if (aiFills.length) {
    say(`Typing ${aiFills.length} answer${aiFills.length === 1 ? '' : 's'}…`);
    const res = await applyFills(wc, aiFills.map((x) => ({ ref: x.field.ref, value: x.value })));
    record(aiFills, 'ai', res);
  }

  for (const q of plan.questions || []) {
    const f = take(q.id);
    if (!f || f.kind === 'file') continue;
    let options = Array.isArray(q.options) ? q.options.filter((o) => typeof o === 'string' && o.trim()) : [];
    // For choice fields, only offer answers the form will actually accept.
    if (f.options && f.options.length) {
      const allowed = new Set(f.options.map(norm));
      options = options.filter((o) => allowed.has(norm(o)));
      if (!options.length) options = f.options.slice(0, 8);
    }
    if (f.kind === 'checkbox' && !options.length) options = ['Yes', 'No'];
    result.questions.push({
      ref: f.ref,
      kind: f.kind,
      label: f.label || '',
      question: (q.question || f.label || 'Answer needed').trim(),
      options: options.slice(0, 8),
      allOptions: f.options && f.options.length > options.length ? f.options : null,
      required: !!f.required,
    });
  }

  const planned = new Map((plan.uploads || []).map((u) => [u.id, u.document]));
  for (const f of fileFields) {
    const id = idOf.get(f.ref);
    let doc = planned.get(id);
    if (!doc || doc === 'none') doc = guessDocument(f);
    used.add(id);
    await attach(f, doc);
  }

  const nb = buttonById.get(plan.next_button);
  if (nb && !NEVER_CLICK.test(nb.text)) result.next = { ref: nb.ref, text: nb.text };
  return result;
}

/* ------------------------------------------------------------------ */
/* For an outside AI app (over MCP). Same rules as the built-in AI,     */
/* checked here in code no matter what the AI app asks for.            */
/* ------------------------------------------------------------------ */

const SIGN_IN = 'This is a sign-in page. The applicant signs in themselves in the Tassel window; then read the page again.';

async function describePage(wc) {
  const { page, fields, buttons, hasPassword } = await scan(wc);
  return {
    url: page.url,
    title: page.title,
    heading: page.heading,
    page_text: page.text,
    sign_in_page: hasPassword,
    note: hasPassword ? SIGN_IN : fields.length ? '' : 'No form fields on this page.',
    fields: fields.map((f) => {
      const cls = classify(f);
      const o = { id: f.ref, kind: f.kind, label: f.label };
      for (const k of ['section', 'group', 'hint', 'placeholder', 'maxLength', 'accept']) if (f[k]) o[k] = f[k];
      if (f.required) o.required = true;
      if (f.options) {
        o.options = f.options;
        if (f.optionCount > f.options.length) o.options_truncated = true;
      }
      if (f.filled && f.kind !== 'password') o.value = f.value;
      if (cls === 'sensitive') o.off_limits = 'Sensitive. The applicant types this personally.';
      else if (cls === 'consent') o.off_limits = 'Legal statement. The applicant reads and ticks this personally.';
      return o;
    }),
    buttons: buttons.map((b) => (NEVER_CLICK.test(b.text) ? { id: b.ref, text: b.text, off_limits: 'The applicant presses this personally.' } : { id: b.ref, text: b.text })),
  };
}

/** items: [{ id, value }] -> [{ id, label, ok, value? , note? }] */
async function safeFill(wc, items) {
  const { fields, hasPassword } = await scan(wc);
  if (hasPassword) throw new Error(SIGN_IN);
  const byRef = new Map(fields.map((f) => [f.ref, f]));
  const out = [];
  const allowed = [];
  for (const it of Array.isArray(items) ? items : []) {
    const id = it && it.id;
    const f = byRef.get(id);
    if (!f) {
      out.push({ id, ok: false, note: 'No such field on this page. Call read_page again.' });
      continue;
    }
    const cls = classify(f);
    const entry = { id, label: f.label || f.name || '', ok: false };
    out.push(entry);
    if (cls === 'sensitive') entry.note = 'Refused: sensitive field. The applicant types this personally.';
    else if (cls === 'consent') entry.note = 'Refused: legal statement. The applicant ticks this personally.';
    else if (f.kind === 'file') entry.note = 'Use attach_document for upload fields.';
    else if (it.value == null || String(it.value) === '') entry.note = 'No value given.';
    else allowed.push({ ref: f.ref, value: String(it.value), entry });
  }
  if (allowed.length) {
    const res = await applyFills(wc, allowed.map(({ ref, value }) => ({ ref, value })));
    for (const a of allowed) {
      const r = res.find((x) => x.ref === a.ref);
      if (r && r.ok) {
        a.entry.ok = true;
        a.entry.value = r.value != null ? r.value : a.value;
      } else {
        a.entry.note = (r && r.note) || 'Could not fill this field.';
      }
    }
  }
  return out;
}

async function safeClick(wc, ref) {
  const { buttons } = await scan(wc);
  const b = buttons.find((x) => x.ref === ref);
  if (!b) throw new Error('No such button on this page. Call read_page again.');
  if (NEVER_CLICK.test(b.text)) {
    throw new Error(`Tassel does not press "${b.text}" for anyone. Tell the applicant it is theirs to press in the Tassel window.`);
  }
  const r = await click(wc, ref);
  if (!r || !r.ok) throw new Error((r && r.note) || 'Could not press that button.');
  return { pressed: b.text };
}

async function safeUpload(wc, ref, filePath) {
  const { fields } = await scan(wc);
  const f = fields.find((x) => x.ref === ref);
  if (!f) throw new Error('No such field on this page. Call read_page again.');
  if (f.kind !== 'file') throw new Error('That field is not an upload field.');
  await upload(wc, ref, filePath);
  return { label: f.label || 'Upload' };
}

module.exports = { fillPage, applyFills, click, reveal, upload, scan, describePage, safeFill, safeClick, safeUpload };
