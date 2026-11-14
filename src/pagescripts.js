// Code that runs INSIDE the application web page (in every frame).
// Written as real functions so they are syntax-checked, then stringified.
// Nothing here talks to the network; it only reads and fills form controls.

/* eslint-disable no-undef */
function tasselLib() {
  const W = window;
  if (!W.__tasselSeq) W.__tasselSeq = 0;

  const clean = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  const cut = (s, n) => {
    s = clean(s);
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  };
  const norm = (s) => clean(s).toLowerCase();

  const visible = (el) => {
    if (!el || !el.isConnected) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.01;
  };

  const refOf = (el) => {
    let r = el.getAttribute('data-tassel-ref');
    if (!r) {
      r = 't' + ++W.__tasselSeq;
      el.setAttribute('data-tassel-ref', r);
    }
    return r;
  };

  // Text of a node without the text of any form controls inside it
  // (a <label> that wraps a <select> would otherwise include every option).
  const ownText = (node) => {
    if (!node) return '';
    const copy = node.cloneNode(true);
    copy.querySelectorAll('input,select,textarea,button,script,style,option').forEach((n) => n.remove());
    return clean(copy.textContent);
  };

  const byIds = (ids) =>
    clean(
      String(ids || '')
        .split(/\s+/)
        .filter(Boolean)
        .map((id) => ownText(document.getElementById(id)))
        .join(' ')
    );

  const hasControl = (node) =>
    node.matches('input,select,textarea') || !!node.querySelector('input,select,textarea');

  // Nearest text that sits before a node: previous siblings, walking up a few levels.
  const precedingText = (start, levels) => {
    let node = start;
    for (let depth = 0; depth < levels && node && node !== document.body; depth++) {
      let p = node.previousElementSibling;
      while (p) {
        if (!hasControl(p)) {
          const t = clean(p.textContent);
          if (t && t.length <= 300) return t;
        }
        p = p.previousElementSibling;
      }
      node = node.parentElement;
    }
    return '';
  };

  // Drop the "*" that forms use to mark required fields.
  const noStar = (s) => clean(String(s || '').replace(/(^|\s)\*+(?=\s|$)/g, ' ')).replace(/\s*:$/, '');

  const labelOf = (el) => noStar(rawLabelOf(el));
  const rawLabelOf = (el) => {
    let t = byIds(el.getAttribute('aria-labelledby'));
    if (t) return t;
    t = clean(el.getAttribute('aria-label'));
    if (t) return t;
    if (el.labels && el.labels.length) {
      t = clean(Array.from(el.labels).map(ownText).join(' '));
      if (t) return t;
    }
    const wrap = el.closest('label');
    if (wrap) {
      t = ownText(wrap);
      if (t) return t;
    }
    const cell = el.closest('td,th');
    if (cell && cell.previousElementSibling && !hasControl(cell.previousElementSibling)) {
      t = clean(cell.previousElementSibling.textContent);
      if (t) return t;
    }
    t = precedingText(el, 3);
    if (t) return t;
    return clean(el.getAttribute('placeholder') || el.getAttribute('title') || '');
  };

  // Label of one radio button / checkbox.
  const toggleLabel = (el) => noStar(rawToggleLabel(el));
  const rawToggleLabel = (el) => {
    let t = '';
    if (el.labels && el.labels.length) t = clean(Array.from(el.labels).map(ownText).join(' '));
    if (!t) t = byIds(el.getAttribute('aria-labelledby'));
    if (!t) t = clean(el.getAttribute('aria-label'));
    if (!t && el.nextSibling && el.nextSibling.nodeType === 3) t = clean(el.nextSibling.textContent);
    if (!t && el.nextElementSibling && !hasControl(el.nextElementSibling)) t = clean(el.nextElementSibling.textContent);
    if (!t) t = clean(el.value);
    return t;
  };

  // The question a group of radios / checkboxes is answering.
  const groupQuestion = (el) => noStar(rawGroupQuestion(el));
  const rawGroupQuestion = (el) => {
    const grp = el.closest('fieldset,[role="radiogroup"],[role="group"]');
    if (grp) {
      const legend = grp.querySelector('legend');
      let t = legend ? clean(legend.textContent) : '';
      if (!t) t = byIds(grp.getAttribute('aria-labelledby'));
      if (!t) t = clean(grp.getAttribute('aria-label'));
      if (t) return t;
      t = precedingText(grp, 2);
      if (t) return t;
    }
    const lab = (el.labels && el.labels[0]) || el.closest('label');
    return precedingText(lab || el, 4);
  };

  const radioGroup = (el) => {
    if (!el.name) return [el];
    return Array.from(document.querySelectorAll('input[type="radio"]')).filter(
      (r) => r.name === el.name && r.form === el.form
    );
  };

  return { clean, cut, norm, visible, refOf, ownText, byIds, labelOf, toggleLabel, groupQuestion, radioGroup, precedingText };
}

function tasselExtract(L) {
  const { clean, cut, visible, refOf, byIds, labelOf, toggleLabel, groupQuestion, radioGroup } = L;

  const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,legend,[role="heading"]')).filter(visible);
  const sectionOf = (el) => {
    const fs = el.closest('fieldset');
    const legend = fs && fs.querySelector('legend');
    if (legend && clean(legend.textContent)) return cut(legend.textContent, 90);
    let best = '';
    for (const h of headings) {
      if (h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) best = h.textContent;
      else break;
    }
    return cut(best, 90);
  };

  const PLACEHOLDER_OPTION = /^(-+\s*)?(select|choose|please|pick|none selected)\b|^-+$|^\.+$/i;
  const SKIP_TYPES = ['hidden', 'submit', 'button', 'image', 'reset', 'search', 'range', 'color'];

  const fields = [];
  const seenRadio = new Set();
  const controls = document.querySelectorAll('input, select, textarea, [contenteditable="true"], [contenteditable=""]');

  for (const el of controls) {
    const tag = el.tagName.toLowerCase();
    let kind;
    if (tag === 'input') kind = (el.getAttribute('type') || 'text').toLowerCase();
    else if (tag === 'select') kind = el.multiple ? 'multiselect' : 'select';
    else if (tag === 'textarea') kind = 'textarea';
    else kind = 'richtext';
    if (SKIP_TYPES.includes(kind)) continue;
    if (el.disabled || el.readOnly) continue;
    if (el.closest('[aria-hidden="true"]')) continue;

    const toggle = kind === 'radio' || kind === 'checkbox';
    const firstLabel = el.labels && el.labels[0];
    const shown =
      visible(el) ||
      ((toggle || kind === 'file') && ((firstLabel && visible(firstLabel)) || visible(el.parentElement)));
    if (!shown) continue;

    if (kind === 'radio') {
      const group = radioGroup(el);
      const key = group[0];
      if (seenRadio.has(key)) continue;
      seenRadio.add(key);
      const checked = group.find((r) => r.checked);
      fields.push({
        ref: refOf(key),
        kind: 'radio',
        label: cut(groupQuestion(el) || toggleLabel(el), 300),
        section: sectionOf(el),
        name: el.name || '',
        required: group.some((r) => r.required || r.getAttribute('aria-required') === 'true'),
        options: group.map((r) => cut(toggleLabel(r), 80)).filter(Boolean),
        value: checked ? toggleLabel(checked) : '',
        filled: !!checked,
      });
      continue;
    }

    const f = {
      ref: refOf(el),
      kind,
      label: cut(kind === 'checkbox' ? toggleLabel(el) : labelOf(el), 300),
      section: sectionOf(el),
      name: el.getAttribute('name') || el.id || '',
      autocomplete: (el.getAttribute('autocomplete') || '').toLowerCase(),
      placeholder: cut(el.getAttribute('placeholder') || '', 80),
      hint: cut(byIds(el.getAttribute('aria-describedby')), 240),
      required: !!el.required || el.getAttribute('aria-required') === 'true',
    };
    if (el.maxLength > 0) f.maxLength = el.maxLength;

    if (kind === 'checkbox') {
      f.group = cut(groupQuestion(el), 200);
      if (f.group === f.label) f.group = '';
      f.value = el.checked ? 'true' : 'false';
      f.filled = el.checked;
    } else if (kind === 'select' || kind === 'multiselect') {
      const opts = Array.from(el.options)
        .map((o) => cut(o.text, 70))
        .filter((t) => t && !PLACEHOLDER_OPTION.test(t));
      f.optionCount = opts.length;
      f.options = opts.slice(0, 400);
      const sel = el.selectedOptions && el.selectedOptions[0];
      const text = sel ? clean(sel.text) : '';
      f.filled = !!sel && el.value !== '' && !PLACEHOLDER_OPTION.test(text);
      f.value = f.filled ? text : '';
    } else if (kind === 'file') {
      f.filled = el.files && el.files.length > 0;
      f.value = f.filled ? el.files[0].name : '';
      f.accept = el.getAttribute('accept') || '';
    } else if (kind === 'richtext') {
      f.value = cut(el.textContent, 200);
      f.filled = clean(el.textContent) !== '';
    } else {
      f.value = cut(el.value, 200);
      f.filled = clean(el.value) !== '';
      if (kind === 'textarea') f.rows = el.rows || 0;
    }
    fields.push(f);
  }

  const buttons = [];
  const seenBtn = new Set();
  const btnSel =
    'button, input[type="submit"], input[type="button"], [role="button"], a[class*="btn"], a[class*="button"], a[class*="Button"]';
  for (const el of document.querySelectorAll(btnSel)) {
    if (buttons.length >= 40) break;
    if (seenBtn.has(el) || el.disabled || el.getAttribute('aria-disabled') === 'true' || !visible(el)) continue;
    seenBtn.add(el);
    const text = cut(el.innerText || el.value || el.getAttribute('aria-label') || '', 60);
    if (!text) continue;
    buttons.push({ ref: refOf(el), text, submit: (el.getAttribute('type') || '').toLowerCase() === 'submit' });
  }

  // The step title: the last h1/h2 that comes before the first field
  // (the very first h1 is usually just the university's name).
  const tops = headings.filter((n) => /^h[12]$/i.test(n.tagName));
  const firstEl = fields.length ? document.querySelector('[data-tassel-ref="' + fields[0].ref + '"]') : null;
  let h = tops[0] || null;
  if (firstEl) {
    for (const n of tops) {
      if (n.compareDocumentPosition(firstEl) & Node.DOCUMENT_POSITION_FOLLOWING) h = n;
      else break;
    }
  } else if (tops.length) {
    h = tops[tops.length - 1];
  }
  const pw =Array.from(document.querySelectorAll('input[type="password"]')).some(visible);
  return {
    url: location.href,
    title: cut(document.title, 120),
    heading: h ? cut(h.textContent, 120) : '',
    text: cut(document.body ? document.body.innerText : '', 900),
    hasPassword: pw,
    fields,
    buttons,
  };
}

function tasselFill(L, items) {
  const { clean, norm, toggleLabel, radioGroup } = L;
  const out = [];

  const setValue = (el, v) => {
    const proto =
      el.tagName === 'TEXTAREA'
        ? HTMLTextAreaElement.prototype
        : el.tagName === 'SELECT'
          ? HTMLSelectElement.prototype
          : HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc && desc.set) desc.set.call(el, v);
    else el.value = v;
  };
  const fire = (el, names) => names.forEach((n) => el.dispatchEvent(new Event(n, { bubbles: true })));
  const flash = (el) => {
    try {
      const target = el.offsetWidth > 24 ? el : (el.labels && el.labels[0]) || el.parentElement || el;
      target.animate(
        [
          { boxShadow: '0 0 0 3px rgba(200,150,43,.9)', backgroundColor: 'rgba(200,150,43,.16)' },
          { boxShadow: '0 0 0 3px rgba(200,150,43,0)', backgroundColor: 'rgba(200,150,43,0)' },
        ],
        { duration: 1700, easing: 'ease-out' }
      );
    } catch {}
  };
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Exact match, then "starts with", then whole-word containment.
  // Never plain substring: "male" must not match "female".
  const pick = (options, want) => {
    const w = norm(want);
    if (!w) return null;
    let o = options.find((x) => norm(x.text) === w) || options.find((x) => norm(x.value) === w);
    if (o) return o;
    o = options.find((x) => norm(x.text).startsWith(w + ' ') || norm(x.text).startsWith(w + ',') || norm(x.text).startsWith(w + ' ('));
    if (o) return o;
    if (w.length >= 4) {
      const re = new RegExp('(^|[^a-z0-9])' + esc(w) + '([^a-z0-9]|$)');
      const hits = options.filter((x) => re.test(norm(x.text)));
      if (hits.length === 1) return hits[0];
    }
    return null;
  };

  for (const it of items) {
    const el = document.querySelector('[data-tassel-ref="' + it.ref + '"]');
    if (!el) {
      out.push({ ref: it.ref, ok: false, note: 'That field is no longer on the page.' });
      continue;
    }
    const tag = el.tagName.toLowerCase();
    const type = (el.getAttribute('type') || '').toLowerCase();
    const value = String(it.value == null ? '' : it.value);
    try {
      if (tag === 'select') {
        const opts = Array.from(el.options).map((o) => ({ text: clean(o.text), value: o.value, node: o }));
        const o = pick(opts, value);
        if (!o) {
          out.push({ ref: it.ref, ok: false, note: 'No option matching "' + value + '".' });
          continue;
        }
        el.focus();
        if (el.multiple) o.node.selected = true;
        else el.selectedIndex = o.node.index;
        fire(el, ['input', 'change']);
        el.blur();
        flash(el);
        out.push({ ref: it.ref, ok: true, value: o.text });
      } else if (type === 'radio') {
        const group = radioGroup(el);
        const opts = group.map((r) => ({ text: toggleLabel(r), value: r.value, node: r }));
        const o = pick(opts, value);
        if (!o) {
          out.push({ ref: it.ref, ok: false, note: 'No choice matching "' + value + '".' });
          continue;
        }
        if (!o.node.checked) o.node.click();
        flash(o.node);
        out.push({ ref: it.ref, ok: true, value: o.text });
      } else if (type === 'checkbox') {
        const want = /^(true|yes|y|1|on|checked)$/i.test(value.trim());
        if (el.checked !== want) el.click();
        flash(el);
        out.push({ ref: it.ref, ok: true, value: want ? 'Checked' : 'Unchecked' });
      } else if (tag === 'input' || tag === 'textarea') {
        let v = value;
        if (type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(v)) {
          out.push({ ref: it.ref, ok: false, note: 'Date was not in YYYY-MM-DD form.' });
          continue;
        }
        if (type === 'month') v = v.slice(0, 7);
        el.focus();
        setValue(el, v);
        fire(el, ['input', 'change']);
        el.blur();
        flash(el);
        out.push({ ref: it.ref, ok: true, value: v });
      } else {
        el.focus();
        el.textContent = value;
        fire(el, ['input']);
        el.blur();
        flash(el);
        out.push({ ref: it.ref, ok: true, value });
      }
    } catch (err) {
      out.push({ ref: it.ref, ok: false, note: String((err && err.message) || err) });
    }
  }
  return out;
}

function tasselClick(L, ref) {
  const el = document.querySelector('[data-tassel-ref="' + ref + '"]');
  if (!el) return { ok: false, note: 'That button is no longer on the page.' };
  el.scrollIntoView({ block: 'center' });
  el.click();
  return { ok: true };
}

function tasselReveal(L, ref) {
  const el = document.querySelector('[data-tassel-ref="' + ref + '"]');
  if (!el) return { ok: false };
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  try {
    el.focus({ preventScroll: true });
  } catch {}
  return { ok: true };
}
/* eslint-enable no-undef */

const wrap = (fn, arg) =>
  `(() => { const L = (${tasselLib.toString()})(); return (${fn.toString()})(L${arg === undefined ? '' : ', ' + JSON.stringify(arg)}); })()`;

module.exports = {
  EXTRACT: wrap(tasselExtract),
  fillScript: (items) => wrap(tasselFill, items),
  clickScript: (ref) => wrap(tasselClick, ref),
  revealScript: (ref) => wrap(tasselReveal, ref),
};
