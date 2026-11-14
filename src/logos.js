// University logos. Tassel asks the university's own website for its site icon
// (no third-party logo service), and keeps a copy on this computer.
const { app, net } = require('electron');
const fs = require('fs');
const path = require('path');

const DAY = 24 * 60 * 60 * 1000;
const KEEP_FOR = 30 * DAY; // refresh a logo after a month
const RETRY_AFTER = 1 * DAY; // try again tomorrow if a site had none
const MAX_BYTES = 600 * 1024;
const TYPES = { 'image/png': 1, 'image/jpeg': 1, 'image/x-icon': 1, 'image/vnd.microsoft.icon': 1, 'image/svg+xml': 1, 'image/webp': 1, 'image/gif': 1 };

const dir = () => path.join(app.getPath('userData'), 'logos');
const validDomain = (d) => /^(?=.{4,100}$)([a-z0-9-]+\.)+[a-z]{2,}$/i.test(d) && !/^\d+(\.\d+){3}$/.test(d);
const inFlight = new Map();

async function get(url, ms = 8000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    return await net.fetch(url, { signal: ctl.signal, redirect: 'follow', headers: { accept: 'text/html,image/*,*/*;q=0.8' } });
  } finally {
    clearTimeout(timer);
  }
}

// Pull icon candidates out of a page's <link> tags, biggest first.
function iconLinks(html, baseUrl) {
  const out = [];
  for (const tag of html.match(/<link\b[^>]*>/gi) || []) {
    const rel = (/\brel\s*=\s*["']?([^"'>]+)/i.exec(tag) || [])[1] || '';
    const href = (/\bhref\s*=\s*["']([^"']+)["']/i.exec(tag) || /\bhref\s*=\s*([^\s>]+)/i.exec(tag) || [])[1];
    if (!href || !/icon/i.test(rel) || /mask-icon/i.test(rel)) continue;
    const size = parseInt((/\bsizes\s*=\s*["']?(\d+)/i.exec(tag) || [])[1], 10) || 0;
    let score = size || (/apple-touch-icon/i.test(rel) ? 180 : 32);
    if (/\.svg(\?|$)/i.test(href)) score = 400; // crisp at any size
    try {
      const url = new URL(href.replace(/&amp;/g, '&'), baseUrl);
      if (url.protocol === 'https:') out.push({ url: url.href, score });
    } catch {}
  }
  return out.sort((a, b) => b.score - a.score).map((x) => x.url);
}

async function download(url) {
  const res = await get(url);
  if (!res.ok) return null;
  const type = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length || buf.length > MAX_BYTES) return null;
  let mime = TYPES[type] ? type : '';
  if (!mime) {
    // Some servers send icons as octet-stream: recognise them by their first bytes.
    if (buf.subarray(0, 4).toString('hex') === '89504e47') mime = 'image/png';
    else if (buf.subarray(0, 4).toString('hex') === '00000100') mime = 'image/x-icon';
    else if (buf.subarray(0, 3).toString('hex') === 'ffd8ff') mime = 'image/jpeg';
  }
  if (!mime) return null;
  return `data:${mime};base64,${buf.toString('base64')}`;
}

async function fetchLogo(domain) {
  for (const host of [domain, 'www.' + domain]) {
    let page;
    try {
      page = await get(`https://${host}/`);
    } catch {
      continue;
    }
    if (!page.ok) continue;
    const base = page.url || `https://${host}/`;
    const html = (await page.text()).slice(0, 400000);
    const candidates = [...iconLinks(html, base), new URL('/apple-touch-icon.png', base).href, new URL('/favicon.ico', base).href];
    for (const url of candidates.slice(0, 6)) {
      try {
        const data = await download(url);
        if (data) return data;
      } catch {}
    }
    return '';
  }
  return '';
}

/** Returns a data: URL for the site's icon, or '' when there is none (or we are offline). */
async function logoFor(domain) {
  domain = String(domain || '').trim().toLowerCase().replace(/^www\./, '');
  if (!validDomain(domain)) return '';
  const file = path.join(dir(), domain + '.json');
  try {
    const cached = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (Date.now() - cached.at < (cached.data ? KEEP_FOR : RETRY_AFTER)) return cached.data || '';
  } catch {}
  if (inFlight.has(domain)) return inFlight.get(domain);
  const job = (async () => {
    let data = '';
    let reached = true;
    try {
      data = await fetchLogo(domain);
    } catch {
      reached = false;
    }
    try {
      // Only remember a miss when the site answered; being offline is not a miss.
      if (data || reached) {
        fs.mkdirSync(dir(), { recursive: true });
        fs.writeFileSync(file, JSON.stringify({ at: Date.now(), data }));
      }
    } catch {}
    return data;
  })();
  inFlight.set(domain, job);
  try {
    return await job;
  } finally {
    inFlight.delete(domain);
  }
}

module.exports = { logoFor };
