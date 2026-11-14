# Tassel

**Apply once. Everywhere.**

Tassel is a desktop app (Windows and macOS) for applying to many graduate programs at once,
master's and PhD. You fill in your profile one time. Tassel opens each university's application in
its own built-in browser, fills in the form, asks you only what it cannot know, drafts essay options
for you to pick from, and leaves the final submit to you.

## Built for applying in bulk

- **A list, not a pick.** Search finds 8, 12 or 20 programs at a time: a balanced mix, top schools,
  or safer choices.
- **Reach, target, safer.** Each program is placed against your standing (grades, scores,
  experience) with a one-line reason, and the list warns you when it is lopsided. These are
  estimates to plan with, not predictions. Sorting needs an AI; you can also set it by hand.
- **Several programs per university.** One card per university (with its logo), one row per
  program, each with its own deadline, extra dates (funding, recommendations), fee, status and
  checklist.
- **Start all.** Opens every application in a background tab, two at a time, fills each as far as
  it will go, and gives you one board of what each one needs: sign in, a question, an essay, the
  final review.
- **University search.** About 290 well-known universities are built in (type "mich", "LSE",
  "ETH"); anything else can be typed by hand.

## Run it

```bash
npm install
npm start
```

On Windows you can also double-click `run.bat`.

The first launch walks you through three steps: what you want to study (as many fields and places
as you like), how to connect an AI, and your details.

## Two ways to give Tassel an AI

**1. Connect the AI app you already use (no API key).** Tassel is an MCP server. Claude Desktop,
Claude Code, Cursor, or any app that supports local MCP servers can connect to it and work inside
Tassel for you: build your profile from a conversation, find programs, fill in applications, draft
essays. In Tassel go to Settings → Connect your AI app:

- **Add to Claude Desktop** writes the entry for you (your other settings are kept and a backup is
  saved). Quit and reopen Claude Desktop, then say "Use Tassel" in a chat.
- **Copy command for Claude Code** gives you a `claude mcp add ...` line to paste into a terminal.
- **Copy settings for other apps** gives you the JSON block to paste into that app's MCP settings.

Keep Tassel open while your AI app works. Things to say to it:

- "Use Tassel. Interview me to build my profile and save my answers as we go."
- "Use Tassel. Read my attached CV and save it to my profile."
- "Use Tassel. Find master's programs in Economics in Germany and add the best ones to my list."
- "Use Tassel. Fill in my Northfield application and stop at the review page."

**2. Paste an Anthropic API key.** Tassel's built-in AI then does the work itself: one press of
Fill this page, Autopilot, program search and essay drafts inside the app. Keys:
<https://console.anthropic.com/settings/keys>.

With neither, Tassel still fills the basics (name, contact details, address) from your profile.

## How it works

For each page of an application, **Fill this page** does this:

1. Reads every field on the page: its label, type, options, and whether it is required.
2. Fills what is certain straight from your profile, instantly, with no AI call.
3. Sends the remaining fields to Claude in **one** request and types the answers in.
4. Attaches your CV or transcript where the form asks for an upload.
5. Hands you anything that needs a decision:
   - **Questions**: pick an answer; it is remembered and reused on other applications.
   - **Essay prompts**: Tassel drafts three different takes; you pick one and edit it.

**Autopilot** (the switch in the toolbar) presses the form's own "Save and continue" when nothing
on the page needs you, fills the next page, and stops the moment something does.

### What Tassel never does

These limits are enforced in Tassel's own code, for the built-in AI and for any AI app connected
over MCP alike.

- Submit an application, pay a fee, or sign anything.
- Type a password, Social Security number, passport number, or card number.
- Tick "I certify..." or "I agree..." boxes.
- Invent facts. If your profile doesn't have the answer, it asks you.

## Using it on more than one device

Settings → "Use Tassel on more than one device" → choose a folder that already syncs between your
computers (OneDrive, iCloud Drive, Dropbox, Google Drive). Do the same on the other device and pick
"Use the folder's data". Your documents are copied into that folder so they travel too. Your AI key
and university sign-ins stay on each device. Use one device at a time: if both save, Tassel keeps
the newer copy and never overwrites it with an older one.

## Where your data lives

Everything is on your computer, in the app's data folder (Settings → Show my data file):

- `tassel-data.json`: your profile, programs, essays, and settings
- `tassel-key.bin`: your AI key, encrypted by the operating system

Sign-ins to university sites live in Tassel's own browser profile, separate from Chrome.
With an API key, the only thing that leaves your computer is what Tassel sends to Anthropic to
answer a form or draft an essay: your profile and the field labels on the page (never file
contents other than a CV you choose to import, never passwords, never the key itself to anyone but
Anthropic). With a connected AI app, that app reads your profile and the form pages through
Tassel, so its own privacy terms apply to what it sees. The connection itself never leaves your
computer: it is local-only and protected by a random token that changes every time Tassel starts.

## Project layout

| Path | What it is |
|---|---|
| `main.js` | Window, built-in browser plumbing, IPC |
| `src/pagescripts.js` | Code that runs inside the application page: reads fields, types answers |
| `src/heuristics.js` | The instant pass, and the list of fields Tassel never touches |
| `src/agent.js` | The fill pipeline for one page |
| `src/ai.js` | Every call to Claude (field mapping, essays, program search, CV import) |
| `src/store.js` | Saving to disk, key encryption |
| `mcp/tools.js` | The tools an AI app gets over MCP, and the instructions it is given |
| `mcp/bridge.js` | The small program an AI app starts; passes tool calls to the running Tassel |
| `src/control.js` | The local-only, token-protected door the bridge talks to |
| `src/connect.js` | Builds the connection settings; adds Tassel to Claude Desktop on request |
| `scripts/mcp-check.js` | Talks to the bridge like an AI app would, to check the connection |
| `ui/` | The interface (`index.html`, `styles.css`, `app.js`) and the practice application |
| `ui/brand/` | The Tassel mark and app icon |
| `scripts/smoke.js` | Automated walkthrough of every screen with a stand-in AI |

## Test it

```bash
npm run smoke
```

Drives the real app through onboarding, program search, the profile, a three-page practice
application (including Autopilot, uploads, questions and essays), a public HTTPS form, and a full
MCP session through the bridge, using a stand-in for the AI so no key is needed. Screenshots and
`results.json` land in `smoke-out/`.

With Tassel open, `node scripts/mcp-check.js` confirms an AI app can reach it.

## Build installers

```bash
npm run dist:win
```

```bash
npm run dist:mac
```

The Windows installer (`dist/Tassel-win-x64.exe`) can be built on Windows; the macOS `.dmg` has to
be built on a Mac (GitHub builds it, see below). Neither is signed with a paid certificate, so
Windows SmartScreen and macOS Gatekeeper warn the first time. The Mac app is signed "ad hoc", which
Apple silicon requires before it will run an app at all.

After a build, `node scripts/packaged-check.js` opens the packaged app in a throwaway profile and
talks to it through the bundled MCP bridge, to prove the built app really starts.

## Website and releases

- `site/index.html` is the whole website: one file, no images, no build step. Preview it with
  `npm run site` (http://localhost:4173; add `?pricing=1` to see the paid layout). Set `REPO` and
  `BUY_URL` at the top of the file when it goes live.
- `.github/workflows/site.yml` publishes `site/` to GitHub Pages whenever it changes.
- `.github/workflows/release.yml` builds the Mac (universal) and Windows installers when a version
  tag such as `v0.1.0` is pushed, opens each packaged app to check it starts, and attaches both to
  a GitHub Release. The site's download buttons point at the latest release. The same run does the
  full walkthrough (`npm run smoke`) on both systems and keeps the screenshots.
- Pricing shown on the site once `BUY_URL` is set: free for 3 applications, then a one-time $10
  Season Pass. The app does not enforce that limit yet.

## What Common App has that Tassel does not (yet)

Common App itself is undergraduate-only; graduate applicants meet GradCAS and other Liaison systems,
uni-assist, Studielink, Universityadmissions.se, ApplyTexas, and per-university portals (Slate,
ApplyWeb). Tassel recognises the shared ones from the application link and says so on the row.
Covered today by the per-application checklist: form, essays, CV, transcripts, test scores,
recommendation letters, fee. Letters have their own page (below). Not built: test-score send
tracking (institution codes, free recipients), credential-evaluation lead times (WES, uni-assist),
country rules (for example Studielink's application cap), and tracking after you submit.

## Recommendation letters

The **Letters** page has one card per recommender and one row per application: not asked, asked,
or submitted. Each application says how many letters it needs (2 for a master's, 3 for a PhD by
default; change it in the application's checklist). From a recommender's card you can copy a request
email listing every program and its date, mark them all as asked in one go, and later copy a
reminder for the ones still open. A letter asked two weeks ago with its deadline three weeks away or
less is flagged. Tassel never emails anyone itself, and the checklist's "Recommendation letters"
line ticks itself when enough are in.

## Known limits

- Reach / target / safer comes from an AI reading what it can find about each program. Treat it as
  a starting point and check the program's own admitted-student figures.
- Start all stops at every sign-in page: each university portal needs its own account, and Tassel
  does not create accounts or type passwords.
- Logos are the site icon from the university's own website; some sites have none.

- Forms built from custom widgets (non-standard dropdowns, fields inside shadow DOM) may not be
  read; Tassel tells you which fields it could not fill and you finish those by hand.
- Sign-in pop-ups open in the same tab.
- Upload boxes inside embedded frames have to be attached by hand.
- Programs found by search come from the live web. Check deadlines and links on the university's page.
- Some programs restrict AI-written statements. Treat essay drafts as a starting point and check each
  program's policy.

## Turning it into a product

Connecting your own AI app means nobody needs an API key, which removes the billing backend from
the first version. What is left before giving it to other applicants: code signing (so Windows and
macOS stop warning), auto-update, and a Mac build.
