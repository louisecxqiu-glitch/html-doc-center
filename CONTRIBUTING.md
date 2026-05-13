# Contributing to HTML Doc Center

Thanks for thinking about contributing! Whether you're fixing a typo, reporting a bug, or proposing a major feature — welcome.

## Ways to contribute

1. **🐛 Report bugs** — [Open an issue](../../issues/new?template=bug_report.md)
2. **💡 Suggest features** — [Open a feature request](../../issues/new?template=feature_request.md)
3. **📝 Improve docs** — PRs for typos, clarifications, translations are super welcome
4. **⚡ Submit code** — See "Code contributions" below

## Before you start

Please read [`ITERATION-SOP.md`](ITERATION-SOP.md) — it's the project's iron rules, especially:

- **Ironclad Rule 4 · 5 anti-bug principles** — if you're changing `web/*` or `saver-runtime.js`, you MUST do real browser verification (not just `curl 200`)
- **User story discipline** — every feature-level version's CHANGELOG must include a `👤 User Story` section

These aren't nice-to-haves; they've been hard-earned from ~11 hotfixes across v1.11.

## Setting up locally

```bash
git clone https://github.com/louisecxqiu-glitch/html-doc-center.git
cd html-doc-center
pip install aiohttp

cp config.example.json config.json
# Edit config.json to point scan_roots at some HTML files you have

python3 server.py
# Open http://localhost:9901
```

## Code contributions

### 1. Discuss first (for non-trivial changes)

Open an issue before writing code for:
- Any new feature
- Any architectural change
- Any change to `server.py`'s API surface
- Any change to `saver-runtime.js`'s toolbar UX

Small fixes (typos, obvious bugs) — just open a PR.

### 2. Branch from `main`

```bash
git checkout -b fix/your-bug-name
# or
git checkout -b feat/your-feature-name
```

### 3. Follow the commit convention

```
<type>(<version?>): <short description>

<body if needed>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`

Examples:
- `fix(v1.11.12): sidebar tab state not persisted after Esc`
- `feat(v1.12.0): table editing — insert row / column`
- `docs: fix typo in README`

### 4. Verify before PR

Per Ironclad Rule 4.1 (Reality Check):

- ✅ Hard refresh your browser (Cmd+Shift+R)
- ✅ Click through at least 3 core interactions
- ✅ Describe in your PR: "I opened X, clicked Y, saw Z"

Do NOT just paste `curl 200` and claim it works.

### 5. Update CHANGELOG

If your change is user-facing (new feature / visible fix), add an entry to `CHANGELOG.md` at the top.

Format (see recent entries for examples):

```markdown
## [v1.11.x] — YYYY-MM-DD · HH:MM · <your title>

> One-sentence summary of what's solved.

### 👤 User Story
**Scene**: when / where the user encounters this
**Before**: how it sucked
**After**: how it's better now
**In one line**: memorable takeaway

### 📁 Changes
| File | Change |
...
```

### 6. Open the PR

Target `main`. Include:
- What & why (link to the issue if exists)
- How you verified (screenshots / GIF welcome)
- Any known limitations / follow-ups

### 7. Code review

We'll respond within a few days. Please don't take critique personally — we try to be direct and specific, never personal.

## Philosophy reminders

- **Zero dependencies.** Don't add npm / pip dependencies without discussion.
- **Single file where possible.** `server.py` and `saver-runtime.js` are intentionally self-contained.
- **Local first.** No telemetry, no analytics, no cloud calls.
- **Progressive enhancement.** Respect existing editors that users may have in their HTML (v1.8+ `detectExistingEditor`).

## Questions?

Open a [Discussion](../../discussions) or ping in an issue. No question is too small.

Thank you! 🙏
