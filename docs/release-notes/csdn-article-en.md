# Open Source Launch: DocCenter — A Cure for HTML Document Sprawl in the AI Era

> **English version** · Suitable for dev.to / Hashnode / Medium / personal blog
> **Recommended length**: 2500-3500 words
> **Tags**: `python` `aiohttp` `opensource` `ai-tools` `frontend` `tooling` `claude` `chatgpt` `productivity`
> **Suggested platforms**: dev.to (best DX) · Hashnode (custom domain) · Medium (broad reach) · X long post

---

## I. The Problem: AI-Era Document Sprawl

For the past year, I've been drowning in AI-generated HTML files.

Claude artifacts: ~20/day. ChatGPT canvas: ~10/day. Cursor and CodeBuddy reports: 5-8/day. They scatter across a dozen folders. **Double-clicking only lets me view; fixing a typo means re-running the original prompt; finding historical versions is impossible.**

I tried several alternatives and none worked:

| Solution | Why it didn't work |
|---|---|
| VSCode | Needs a preview plugin; rich-text editing requires switching to source mode |
| Notion | Doesn't accept HTML uploads; copy-paste loses styles |
| Browser bookmarks | Can't edit, can't annotate |
| Self-hosted static site | Too heavy; every change means build → deploy |

So I built **DocCenter** — a local workbench at `localhost:9901` purpose-built for this disease.

**Repo**: https://github.com/louisecxqiu-glitch/html-doc-center

---

## II. Tech Stack: Why a Single Python File + Vanilla JS

DocCenter's entire backend is **one `server.py`, zero `requirements.txt`, with `aiohttp` as the only external dependency**. The frontend is vanilla JS with no build step.

This isn't showing off — it's intentional. Three key decisions:

### 2.1 aiohttp over FastAPI

| Dimension | aiohttp | FastAPI |
|---|---|---|
| Cold start | 0.3s | 1.5s (pydantic loading) |
| Memory | ~30MB | ~80MB |
| Mental overhead | One `web.RouteTableDef` and you're done | Need to grok Pydantic models |

A workbench is not a product. It's a **daily-use tool I run on my own laptop**. Fast cold start and low memory beat clean OpenAPI docs by 100×. I have dashboard (9900), heartbeat (4011), cockpit (8088) running simultaneously — I won't accept 80MB per service.

### 2.2 Vanilla JS over React

Zero build = zero mental overhead. Fixing a bug doesn't mean `npm install → npm run build → refresh`. It means **edit → Cmd+Shift+R**.

The only embedded dependency is `marked.min.js` (Markdown rendering, MIT) sitting flat in `web/vendor/`. The entire `web/` directory has 8 files — that's the whole frontend.

### 2.3 iframe over SPA Routing

The HTML files being edited are **complete pages** — they have their own CSS animations, JS interactions, external fonts. Extracting `<body>` into an SPA loses all that context.

iframe preserves each document's full runtime. DocCenter only injects a small `saver-runtime.js` before `</body>`, providing the editing toolbar and auto-save capability. **Keeping the source file's runtime uncontaminated** has been a hard rule since v1.0.

---

## III. Core Architecture: Three Tiers

```
┌─────────────────────────────────────────────────────────────┐
│  Browser at localhost:9901                                  │
│                                                             │
│  ┌─────────────────┐   ┌──────────────────────────────────┐ │
│  │  web/app.js     │   │  iframe                          │ │
│  │  (sidebar tree) │   │  ┌────────────────────────────┐  │ │
│  │                 │←─→│  │ user's HTML                │  │ │
│  │                 │   │  │ + injected saver-runtime.js│  │ │
│  └─────────────────┘   │  └────────────────────────────┘  │ │
│         ↕ HTTP JSON    └──────────────────────────────────┘ │
└─────────┼───────────────────────────────────────────────────┘
          ↓
┌─────────────────────────────────────────────────────────────┐
│  server.py (aiohttp, single file)                           │
│  ┌───────────┬──────────────┬──────────────────────────────┐│
│  │ Static    │ Tree/Config  │ HTML Read/Write              ││
│  │ /         │ /api/tree    │ /api/file (inject saver)     ││
│  │ /static/* │ /api/config  │ /api/snapshot                ││
│  │ /changelog│              │ /api/save (overwrite/new/    ││
│  │           │              │            discard)          ││
│  └───────────┴──────────────┴──────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### 3.1 Backend (server.py): Path Safety is the Only Hard Rule

Every I/O handler must go through `_resolve_safe()`: resolve the input path to absolute, then verify it's under one of the `scan_roots`. Otherwise return 403.

```python
def _resolve_safe(raw: str, scan_roots: list[str]) -> Optional[Path]:
    """The single gate for path traversal defense."""
    try:
        target = Path(raw).expanduser().resolve()
    except (OSError, RuntimeError):
        return None
    for root in scan_roots:
        root_path = Path(root).expanduser().resolve()
        if target == root_path or root_path in target.parents:
            return target
    return None  # caller returns 403
```

**No new I/O handler may bypass this** — it's been a hard rule since v1.0 and remains unbroken at v1.11.11.

`scan_roots` is configured in `~/.codebuddy/html-doc-center/config.json` and editable via the settings panel. Defaults exclude `_auto-save / node_modules / .git / dist / build`.

### 3.2 Injection Layer (saver-runtime.js): Three Guardrails for Dirty Detection

This is the hardest part of the project. Dirty detection must trigger **only when the user actively edits** — not on page JS animations, scroll, or highlight effects.

```javascript
// Guardrail 1: User interaction window
const USER_INTERACT_WINDOW_MS = 800;
let lastInteract = 0;
['keydown', 'mousedown', 'paste', 'cut', 'drop'].forEach(ev =>
  document.addEventListener(ev, () => { lastInteract = Date.now(); }, true)
);

// Guardrail 2: MutationObserver only watches childList + characterData
const mo = new MutationObserver(mutations => {
  if (Date.now() - lastInteract > USER_INTERACT_WINDOW_MS) return;
  if (mutations.some(m =>
      m.target.tagName === 'SCRIPT' ||
      m.target.tagName === 'STYLE')) return;
  setDirty(true);
});

// Guardrail 3: Delay 1s before observe to skip page init
setTimeout(() => {
  mo.observe(document.body, {
    childList: true,
    characterData: true,
    subtree: true
    // NEVER attributes: true — animations/scroll-highlight cause false positives
  });
}, 1000);
```

These three guardrails were established after a v1.2.4 false-positive bug. They have not regressed since. **Read the comments before modifying this section** — it's tempting to "optimize" by enabling `attributes: true`, which immediately regresses.

### 3.3 Frontend (app.js): The Single UX Decision Point

When switching files / closing / refreshing while `isDirty=true`, this dialog appears:

```
┌─────────────────────────────────────────┐
│  You modified this document             │
│                                         │
│  ✅ Overwrite source                    │
│  🆕 Save as review copy                 │
│  🗑 Discard changes                     │
└─────────────────────────────────────────┘
```

**This is the only decision point in the entire UX.** I tried adding a 4th 💾 button ("Save and continue editing") in v1.2.5 and reverted it the same hour — more decision points = more user fatigue. **Less is more** isn't a slogan; it's a gate every "let's add a button" idea must pass.

---

## IV. 5 Hard-Won Anti-Bug Rules

42 iterations from v1.0 to v1.11.11 stepped on plenty of mines. The v1.11 series alone had 11 consecutive hotfixes that beat me into submission and produced 5 hard rules, all written into `ITERATION-SOP.md`:

### Rule 1: Real Browser Drill — `curl 200` ≠ User-Perspective Working

**Cautionary tale (v1.11.10)**: Three-tab switching feature. `curl` returned 200, 0 lint errors, I claimed done. User testing: switching to "Favorites" or "Recent" tab showed blank.

**Root cause**: CSS `.active { display: block }` couldn't override inline `style="display:none"` left over in HTML.

**Rule**: Before commit, you must **hard-refresh in browser (Cmd+Shift+R) and click 3+ core interactions from user perspective**. Acceptance reports cannot consist only of `curl 200`. Write "I clicked X in browser and saw Y."

### Rule 2: Guard Expressions Need Explicit Verification

**Cautionary tale (v1.11.11)**: `if (window.sidebarTabsCtl)` was forever false because `sidebarTabsCtl` is an IIFE-internal `const` and was never attached to `window`.

```javascript
// ❌ Forever false
(function() {
  const sidebarTabsCtl = { activate: ... };
})();
if (window.sidebarTabsCtl) { ... }  // never enters

// ✅ Reference within closure
(function() {
  const sidebarTabsCtl = { activate: ... };
  function onClick() {
    sidebarTabsCtl && sidebarTabsCtl.activate('tree');
  }
})();
```

**Rule**: Before writing `if (X)`, confirm X's actual visibility in the current scope.

### Rule 3: Grep Inline Style Residue Before Changing CSS .active / display

**Rule**: CSS specificity: inline > id > class > tag. Before adding new class-based display control, **`grep` old HTML for same-name `style="display:none"` residue** — it will override your CSS. `!important` is the last resort, not the first.

### Rule 4: DOM-Dependent Actions After Toggle Need rAF

**Cautionary tale (v1.11.11)**: Click favorite folder → `activate('tree')` toggles display → immediately `scrollToPath()` calculates position → calculates on stale layout → zero visual feedback.

```javascript
// ❌ Calculates on stale layout
sidebarTabsCtl.activate('tree');
scrollToPath(path);  // getBoundingClientRect returns stale values

// ✅ Wait for next frame
sidebarTabsCtl.activate('tree');
requestAnimationFrame(() => {
  scrollToPath(path);
});
```

**Rule**: Code that reads `getBoundingClientRect / scroll / highlight` after toggling `display/class` must use **`requestAnimationFrame`** to wait for the next frame.

### Rule 5: Autonomous Mode ≠ Skipping User Perspective

When the user says "don't interrupt me with decision cards in autonomous mode," they mean don't send approval prompts — **not** "skip verification." Every 2-3 versions, run at least one "pretend I'm the user" drill. **The prettier the CHANGELOG user-story section, the more critical to verify in browser** — otherwise it's documentation-driven self-hypnosis.

---

## V. Quick Start & v1.12 Roadmap

### Quick Start (3 lines)

```bash
git clone https://github.com/louisecxqiu-glitch/html-doc-center.git
cd html-doc-center
pip3 install aiohttp && python3 server.py
# → open http://localhost:9901
```

macOS auto-start on boot:

```bash
cp launchd.plist.example ~/Library/LaunchAgents/com.louis.html-doc-center.plist
launchctl load ~/Library/LaunchAgents/com.louis.html-doc-center.plist
```

### v1.12 Roadmap (in progress)

- Full-text search (FTS5 + debounce)
- Block-level HTML editing (drag-reorder, batch styling)
- Multi-window sync (state broadcast when same file is open in multiple tabs)
- Mobile touch reading mode (drawer-style sidebar)

See [`docs/superpowers/plans/2026-05-14-v1.12-roadmap.md`](https://github.com/louisecxqiu-glitch/html-doc-center/blob/main/docs/superpowers/plans/2026-05-14-v1.12-roadmap.md).

---

## VI. Repo & Connect

⭐ **GitHub**: https://github.com/louisecxqiu-glitch/html-doc-center
🐛 Issues / 💡 Discussions / 🔧 PRs all welcome — see [CONTRIBUTING.md](https://github.com/louisecxqiu-glitch/html-doc-center/blob/main/CONTRIBUTING.md)

**Connect**:
- 🐦 X / Twitter: [@louisqiu285052](https://x.com/louisqiu285052) — English build-in-public
- 📝 CSDN: [blog.csdn.net/qcx23](https://blog.csdn.net/qcx23) — Chinese deep-dives
- 🔶 WeChat (Chinese): 一深思AI — companion long-form articles on AI Agent practice

If DocCenter helps you, **a star is the best support for open source**. Issues and PRs welcome — let's grow this slowly.

---

*Built with ❤️ by Louis Qiu · MIT Licensed · 2026*
