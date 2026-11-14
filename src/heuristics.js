// The instant pass: fields Tassel can fill with no AI call at all.
// Deliberately conservative - anything ambiguous is left for the AI or the applicant.

const norm = (s) =>
  String(s == null ? '' : s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// Fields Tassel never fills. The applicant types these personally.
const SENSITIVE =
  /\b(ssn|social security|national insurance|national id|tax id|tin|itin|passport (no|number|#)|card number|credit card|debit card|cvv|cvc|security code|routing|account number|iban|sort code|password|passcode|pin)\b/i;
// Legal statements: the applicant must read and tick these personally.
const CONSENT =
  /\b(i (hereby )?(certify|agree|acknowledge|confirm|understand|declare|consent|authori[sz]e|attest|affirm|accept)|terms (and|&) conditions|terms of (use|service)|privacy (policy|notice)|electronic signature|e-?signature|by (checking|signing|typing|submitting))\b/i;
const SIGNATURE = /\b(signature|sign here|type your (full )?name to sign)\b/i;

// A field about someone or somewhere other than the applicant: never guess with their own details.
// (Tested against normalised text: lower case, punctuation removed.)
const OTHER_PARTY_LABEL =
  /\b(recommend\w*|referees?|references?|emergency|parents?|guardians?|mother|father|spouse|partner|next of kin|employers?|supervisors?|managers?|company|organi[sz]ation|school|college|university|institution|counsel\w*|agents?|sponsors?|advis[eo]rs?|contact person|birth)\b/;
// Section headings are noisier ("Northfield University - Personal details"), so use a narrower list.
const OTHER_PARTY_SECTION =
  /\b(recommend\w*|referees?|references?|emergency|parents?|guardians?|family|next of kin|employment|employers?|work experience|education|academic)\b/;

function classify(field) {
  const text = [field.label, field.group, field.name, field.placeholder].filter(Boolean).join(' ');
  if (field.kind === 'password') return 'sensitive';
  if ((field.autocomplete || '').startsWith('cc-')) return 'sensitive';
  if (SENSITIVE.test(text)) return 'sensitive';
  if (field.kind === 'checkbox' && CONSENT.test(text)) return 'consent';
  if (SIGNATURE.test(text) && field.kind !== 'file') return 'consent';
  return null;
}

const AUTOCOMPLETE = {
  'given-name': 'firstName',
  'additional-name': 'middleName',
  'family-name': 'lastName',
  nickname: 'preferredName',
  email: 'email',
  tel: 'phone',
  'tel-national': 'phone',
  'address-line1': 'address1',
  'street-address': 'address1',
  'address-line2': 'address2',
  'address-level2': 'city',
  'address-level1': 'state',
  'postal-code': 'postalCode',
  country: 'country',
  'country-name': 'country',
  bday: 'dob',
  name: '_fullName',
};

// Ordered: first match wins. `not` excludes look-alikes.
const RULES = [
  { key: 'firstName', re: /\b(first|given) name\b|\bforename\b|^first$/ },
  { key: 'middleName', re: /\bmiddle (name|initial)\b|^middle$/ },
  { key: 'lastName', re: /\b(last|family) name\b|\bsurname\b|^last$/ },
  { key: 'preferredName', re: /\b(preferred|chosen) (first )?name\b|\bnickname\b/ },
  { key: '_fullName', re: /^(your )?(full |legal |full legal )?name$|\bfull (legal )?name\b/ },
  { key: 'email', re: /\be ?mail\b/, kinds: ['text', 'email'] },
  { key: 'phone', re: /\b(phone|mobile|telephone|cell)\b/, not: /\b(code|ext|extension|type)\b/, kinds: ['text', 'tel'] },
  { key: 'address1', re: /\b(address|street)( line)? ?1\b|\bstreet address\b|^(mailing |home |permanent |current )?address$/ },
  { key: 'address2', re: /\baddress( line)? ?2\b|\b(apt|apartment|suite|unit)\b/ },
  { key: 'city', re: /\b(city|town)\b/ },
  { key: 'state', re: /\b(state|province|region|county)\b/, not: /\bunited states\b/ },
  { key: 'postalCode', re: /\b(zip|postal|postcode|post code)\b/ },
  { key: 'linkedin', re: /\blinkedin\b/ },
  { key: 'website', re: /\b(personal )?(website|portfolio|homepage)\b/, kinds: ['text', 'url'] },
];

const TEXT_KINDS = ['text', 'email', 'tel', 'url', ''];

function valueFor(key, p) {
  if (key === '_fullName') {
    return [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ').trim();
  }
  return (p[key] || '').toString().trim();
}

// For a <select>: only accept when there is an exact option (or a clear prefix).
function optionFor(field, want) {
  const w = norm(want);
  if (!w) return '';
  const opts = field.options || [];
  return (
    opts.find((o) => norm(o) === w) ||
    opts.find((o) => norm(o).startsWith(w + ' ')) ||
    ''
  );
}

/**
 * Returns the value to put in `field`, or '' when the instant pass should leave it alone.
 */
function instantValue(field, profile) {
  const p = (profile && profile.personal) || {};
  const kind = field.kind;
  const label = norm(field.label);
  const context = norm([field.label, field.name].join(' '));
  const otherParty = OTHER_PARTY_LABEL.test(context) || OTHER_PARTY_SECTION.test(norm(field.section));

  // Saved answers: the applicant already answered this exact question once.
  const answers = (profile && profile.answers) || [];
  if (label) {
    const hit = answers.find((a) => norm(a.q) === label && a.a);
    if (hit) {
      if (kind === 'select' || kind === 'radio') return optionFor(field, hit.a);
      if (kind === 'checkbox' || kind === 'file') return '';
      return hit.a;
    }
  }

  if (otherParty) {
    // One exception: a date-of-birth field is about the applicant.
    if (kind === 'date' && /\b(birth|dob)\b/.test(context) && !/\b(parent|guardian|spouse|partner)\b/.test(context)) {
      return /^\d{4}-\d{2}-\d{2}$/.test(p.dob || '') ? p.dob : '';
    }
    return '';
  }

  if (kind === 'select') {
    const ac = AUTOCOMPLETE[field.autocomplete];
    if (ac === 'country' || /^country( of residence| region)?$|\bcountry of residence\b/.test(label)) {
      return optionFor(field, p.country);
    }
    if (/\b(citizenship|nationality)\b/.test(label)) return optionFor(field, p.citizenship);
    if (ac === 'state' || /^(state|province)( province| or province| region)?$/.test(label)) {
      return optionFor(field, p.state);
    }
    return '';
  }

  if (!TEXT_KINDS.includes(kind)) return '';

  const token = (field.autocomplete || '').split(/\s+/).pop();
  if (AUTOCOMPLETE[token] && AUTOCOMPLETE[token] !== 'dob') {
    const v = valueFor(AUTOCOMPLETE[token], p);
    if (v) return v;
  }

  const hay = label || norm(field.name) || norm(field.placeholder);
  // Long labels are questions ("Please state why..."), not simple fields: leave them for the AI.
  if (!hay || hay.length > 48) return '';
  for (const rule of RULES) {
    if (rule.kinds && !rule.kinds.includes(kind)) continue;
    if (!rule.re.test(hay)) continue;
    if (rule.not && rule.not.test(hay)) return '';
    return valueFor(rule.key, p);
  }
  return '';
}

module.exports = { instantValue, classify, norm };
