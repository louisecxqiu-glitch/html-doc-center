# Markdown Snapshot Origin Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure Markdown auto-snapshots always post to the same host and runtime port that served the editor.

**Architecture:** The Markdown shell receives its API origin from `handle_file()` using the incoming request's scheme and host. `render_md_shell()` keeps the existing port-based fallback for direct callers and unit tests, but serializes an explicit request origin when one is supplied. This prevents a `--port` override or `127.0.0.1` host from being replaced by the stale configured `localhost:9901` address.

**Tech Stack:** Python 3.13, aiohttp, pytest + pytest-aiohttp, browser-based local regression.

## Global Constraints

- Preserve `_resolve_safe()` for all existing file I/O.
- Do not change the on-disk source document during an automatic snapshot.
- Keep the default `render_md_shell(path, port)` behavior for existing callers.
- Ship this as an Unreleased patch on `feature/workspace-scope`; do not create a new release tag before the feature branch is reviewed.

---

### Task 1: Propagate the served origin into Markdown shells

**Files:**
- Modify: `server.py:1108-1147, 1228-1232`
- Test: `tests/test_wechat_format_api.py`

**Interfaces:**
- Consumes: `aiohttp.web.Request.scheme` and `aiohttp.web.Request.host`
- Produces: `render_md_shell(md_path, port=9901, server_origin=None)` with a serialized `window.__DOC_CENTER__.serverOrigin`

- [x] **Step 1: Write the failing integration test**

```python
response = await client.get(
    "/api/file",
    params={"path": str(article)},
    headers={"Host": "127.0.0.1:9904"},
)
shell = await response.text()
assert 'serverOrigin: "http://127.0.0.1:9904"' in shell
```

- [x] **Step 2: Run the test to verify the regression**

Run: `pytest tests/test_wechat_format_api.py -q`

Observed: `1 failed, 4 passed`; the shell contained the configured `localhost:9901`, not the request origin.

- [x] **Step 3: Implement the minimal origin propagation**

```python
def render_md_shell(md_path: Path, port: int = 9901, server_origin: str | None = None) -> str:
    origin = server_origin or f"http://localhost:{port}"
    server_origin_esc = _json_script_string(origin)

# in handle_file() for Markdown
injected = render_md_shell(
    safe,
    server_origin=f"{request.scheme}://{request.host}",
)
```

- [x] **Step 4: Run focused verification**

Run: `pytest tests/test_wechat_format_api.py -q && python3 -m py_compile server.py`

Observed: `5 passed`; Python compilation completed successfully.

### Task 2: Verify history restore safety

**Files:**
- Create: `tests/test_history_restore_api.py`

**Interfaces:**
- Consumes: `POST /api/restore {snapshot_path, source_path}`
- Produces: restored source content and a `{stem}-pre-restore-{timestamp}{suffix}` backup

- [x] **Step 1: Add a temporary-workspace endpoint regression**

```python
response = await client.post(
    "/api/restore",
    json={"snapshot_path": str(snapshot), "source_path": str(source)},
)
assert source.read_text(encoding="utf-8") == "# v2"
assert backup.read_text(encoding="utf-8") == "# v1"
```

- [x] **Step 2: Run the endpoint regression**

Run: `pytest tests/test_history_restore_api.py -q`

Observed: `1 passed`.

### Task 3: Perform browser regression and record release readiness

**Files:**
- Modify: `CHANGELOG.md`
- Create: `docs/product-audit/2026-07-22-round-08-history-recovery.md`

- [x] **Step 1: Run Chrome at a non-default port and edit a temporary Markdown file**

Expected: after two seconds the status changes from editing to draft cached, and the history drawer shows the generated snapshots.

- [x] **Step 2: Run the full test suite and record fresh results**

Run: `pytest -q`

Observed: `58 passed, 24 warnings in 1.06s`.

- [x] **Step 3: Update changelog and audit record, then commit and push the branch**

Observed: temporary source and snapshots were removed before commit; `test_input/sample-architecture.html` was preserved. The commit and push are recorded in the branch history below.
