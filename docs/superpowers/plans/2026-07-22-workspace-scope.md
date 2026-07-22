# 工作区范围与发布上下文 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让多根目录用户能明确选择工作区、避免父子根重复结果，并让公众号发布操作只出现在正确模式中。

**Architecture:** 只在前端从 `state.tree` 派生展示根；后端扫描根和 `_resolve_safe()` 白名单保持不变。选择器值持久化在 localStorage，全部范围隐藏被另一个根包含的冗余根，单根范围保留每个根的快捷入口。当前文件的工作区以最长目录边界匹配得出。

**Tech Stack:** Python pytest、原生 JavaScript、原生 CSS、现有 i18n 字典；无新增依赖。

## Global Constraints

- 不写入或自动改变 `scan_roots`；
- 所有路径匹配必须使用目录边界，不能用裸字符串前缀；
- 保留全部现有根在工作区选择器中；
- 代码改动同步 `CHANGELOG.md` 并独立提交；
- UI 改动必须用真实浏览器回归；
- 不覆盖主工作区的未提交改动，所有实现先在 `/tmp/html-studio-workspace-scope` 隔离完成。

---

### Task 1: 先锁定回归契约

**Files:**
- Create: `tests/test_workspace_scope_static.py`
- Modify: `tests/test_wechat_mode_static.py`
- Modify: `README.md`

**Interfaces:**
- Produces: 对工作区选择、去重、当前上下文、重叠提示、公众号操作隐藏和 README 启动命令的红灯测试。

- [x] **Step 1: 写失败的工作区与文档契约测试**

```python
from pathlib import Path

APP = Path("web/app.js").read_text(encoding="utf-8")
INDEX = Path("web/index.html").read_text(encoding="utf-8")
STYLE = Path("web/style.css").read_text(encoding="utf-8")
EN = Path("web/locales/en.js").read_text(encoding="utf-8")
ZH = Path("web/locales/zh.js").read_text(encoding="utf-8")
README = Path("README.md").read_text(encoding="utf-8")


def test_workspace_scope_contract_is_present():
    assert 'id="workspace-scope"' in INDEX
    assert "WORKSPACE_SCOPE_KEY" in APP
    assert "getDisplayRoots" in APP
    assert "findWorkspaceForPath" in APP
    assert 'id="workspace-context"' in INDEX
    assert 'id="scan-overlap-hint"' in INDEX
    assert "workspace.scope.all" in EN and "workspace.scope.all" in ZH
    assert ".workspace-scope" in STYLE


def test_readme_uses_supported_server_command():
    assert "python3 server.py --dev" not in README
    assert "python3 server.py --no-open-browser" in README
```

在 `tests/test_wechat_mode_static.py` 的第二个测试末尾加入：

```python
assert '.md-wechat-actions[hidden] { display: none; }' in MD_EDITOR
```

- [x] **Step 2: 运行测试，确认因功能尚不存在而失败**

Run: `python3 -m pytest tests/test_workspace_scope_static.py tests/test_wechat_mode_static.py -q`
Expected: FAIL，缺少 `workspace-scope`、`WORKSPACE_SCOPE_KEY` 和 `[hidden]` CSS 契约；README 测试失败。

- [x] **Step 3: 只修正 README 的启动示例**

将 `README.md` 开发段落的：

```bash
python3 server.py --dev
```

替换为：

```bash
python3 server.py --no-open-browser
```

并说明浏览器会话可通过访问 `http://127.0.0.1:9901` 打开；不要添加未实现的 `--dev` 参数。

测试与 README 修改会和功能实现一起在 Task 3 绿灯后提交，避免在分支中留下已知失败的中间提交。

### Task 2: 增加工作区可见入口与上下文样式

**Files:**
- Modify: `web/index.html`
- Modify: `web/style.css`
- Modify: `web/locales/en.js`
- Modify: `web/locales/zh.js`
- Modify: `web/md-editor.html`

**Interfaces:**
- Consumes: Task 1 静态契约。
- Produces: `#workspace-scope`、`#workspace-context`、`#scan-overlap-hint`、双语键和公众号动作隐藏规则。

- [x] **Step 1: 增加静态 UI 锚点**

在 `#search-stat` 前插入：

```html
<div class="workspace-scope-row">
  <label for="workspace-scope" data-i18n="workspace.scope.label">Workspace</label>
  <select id="workspace-scope" class="workspace-scope"></select>
</div>
```

在 `#breadcrumb` 后插入：

```html
<span id="workspace-context" class="workspace-context" hidden></span>
```

在 `.settings-section` 的扫描根说明后插入：

```html
<p id="scan-overlap-hint" class="settings-hint scan-overlap-hint" hidden></p>
```

- [x] **Step 2: 添加最小样式和 i18n**

在 `web/style.css` 添加紧凑、不挤压搜索框的 `.workspace-scope-row`、`.workspace-scope`、`.workspace-context`、`.scan-overlap-hint` 样式；在两个 locale 文件新增：

```js
'workspace.scope.label': 'Workspace',
'workspace.scope.all': 'All workspaces',
'workspace.context.prefix': '⌂ Workspace:',
'scan.overlap.hint': 'Nested workspaces detected. All workspaces shows the parent once; choose a workspace above to focus it.',
```

翻译为等义中文。不得硬编码用户路径。

- [x] **Step 3: 修复公众号动作可见性**

在 `web/md-editor.html` 的 `.md-wechat-actions` 样式附近添加：

```css
.md-wechat-actions[hidden] { display: none; }
```

- [x] **Step 4: 运行静态测试，确认尚因 JavaScript 契约失败**

Run: `python3 -m pytest tests/test_workspace_scope_static.py tests/test_wechat_mode_static.py -q`
Expected: `test_wechat_mode_*` 通过，工作区测试仍因 `web/app.js` 未实现失败。

### Task 3: 实现工作区范围、去重与当前文档归属

**Files:**
- Modify: `web/app.js`

**Interfaces:**
- Consumes: `state.tree`（完整 API 根数组）、`#workspace-scope`、`#workspace-context`、`#scan-overlap-hint`。
- Produces: `WORKSPACE_SCOPE_KEY`、`getDisplayRoots()`、`findWorkspaceForPath(absPath)`、`renderWorkspaceScope()`、`refreshWorkspaceContext()`。

- [x] **Step 1: 添加路径安全与状态辅助函数**

在 `state` 后添加：

```js
const WORKSPACE_SCOPE_KEY = "doccenter.workspaceScope.v1";
const WORKSPACE_SCOPE_ALL = "__all__";

function normalizeWorkspacePath(path) {
  return String(path || "").replace(/[\\/]+$/, "");
}

function isPathInside(path, root) {
  const p = normalizeWorkspacePath(path);
  const r = normalizeWorkspacePath(root);
  return p === r || p.startsWith(r + "/") || p.startsWith(r + "\\");
}
```

读取持久化值时只接受当前 `state.tree` 中存在的根，否则返回 `WORKSPACE_SCOPE_ALL`。

- [x] **Step 2: 从完整树派生展示根**

实现：

```js
function getDisplayRoots() {
  const selected = getWorkspaceScope();
  if (selected !== WORKSPACE_SCOPE_ALL) {
    return state.tree.filter(root => normalizeWorkspacePath(root.path) === selected);
  }
  return state.tree.filter(root => !state.tree.some(other =>
    other !== root && isPathInside(root.path, other.path) &&
    normalizeWorkspacePath(root.path) !== normalizeWorkspacePath(other.path)
  ));
}
```

让 `renderTree()` 接受或读取 `getDisplayRoots()`；统计数字基于展示根。让 `diffTreeAndPatch()` 在工作区范围不是全部时直接完整 `renderTree()`，避免错误地把隐藏根增量插回 DOM。

- [x] **Step 3: 实现选择器、重叠提示和上下文**

`renderWorkspaceScope()` 重建 select：先加“全部工作区”，再按 `state.tree` 加所有根；保留合法选择。change 时保存 localStorage、清空 `#search-box`、调用 `renderTree()`、`refreshWorkspaceContext()`。

`findWorkspaceForPath(absPath)` 过滤包含该文件的根并按 `path.length` 倒序取第一项。`refreshWorkspaceContext()` 使用它更新 `#workspace-context` 的 text、title、hidden；没有文件时显示当前选择的根或“全部工作区”。

`renderScanRoots()` 计算两个启用根是否严格父子包含，设置 `#scan-overlap-hint.hidden`，不调用 `updateRoots()`。

在 `loadTree()` 更新 `state.tree` 后依次调用 `renderWorkspaceScope()`、`renderTree()`、`refreshWorkspaceContext()`；在 `openFile()` 成功设置 `state.currentFile` 后调用 `refreshWorkspaceContext()`；在关闭文件后调用它。

- [x] **Step 4: 运行定向测试，确认绿灯**

Run: `python3 -m pytest tests/test_workspace_scope_static.py tests/test_wechat_mode_static.py -q`
Expected: PASS。

- [x] **Step 5: 提交功能实现**

```bash
git add tests/test_workspace_scope_static.py tests/test_wechat_mode_static.py README.md \
  web/index.html web/style.css web/locales/en.js web/locales/zh.js web/md-editor.html web/app.js
git commit -m "feat: add workspace scope controls"
```

### Task 4: 发布记录与全量验证

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `docs/superpowers/plans/2026-07-22-workspace-scope.md`

**Interfaces:**
- Consumes: 已实现工作区范围与公众号显示修复。
- Produces: 用户可见版本记录与完成的计划检查项。

- [x] **Step 1: 更新 CHANGELOG**

在 `CHANGELOG.md` 顶部新增未发布条目，说明：工作区范围选择、父子根去重展示、当前文档工作区提示、扫描根重叠说明、公众号动作仅在公众号模式显示、README 开发命令修正。

- [x] **Step 2: 运行全量测试**

Run: `python3 -m pytest -q`
Expected: 所有测试通过。

- [ ] **Step 3: 真实浏览器回归**

用含父子根的本机配置验证：

1. 全部工作区只显示父根，同路径搜索只有一个结果；
2. 选择 `html-doc-center` 后树和搜索只显示该根，刷新后仍保留；
3. 打开其 Markdown 后顶栏显示 `⌂ Workspace: html-doc-center`；
4. 设置页出现父子工作区说明但不改变任何 checkbox；
5. 原文/分栏/预览无公众号操作，点击公众号模式后复制/导出显示；
6. 历史抽屉仍能打开。

- [ ] **Step 4: 提交发布记录**

```bash
git add CHANGELOG.md docs/superpowers/plans/2026-07-22-workspace-scope.md
git commit -m "docs: record workspace scope release"
```
