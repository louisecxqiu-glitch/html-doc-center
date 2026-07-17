# Finder 风格 modal + 拖入可编辑 设计文档

| 字段 | 值 |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-07-17 |
| 作者 | Louis Qiu（与 Claude 协作） |
| 状态 | Draft — 待用户审阅 |
| 关联 commit | 待 plan 阶段确定 |

## 1. 背景与目标

### 1.1 现状

DocCenter 当前有 3 个文件入口限制：

1. **没有"打开文件"按钮**：用户只能通过 ① 拖入预览、② 侧栏扫描根目录点击、③ session restore 三种方式打开文件。缺少一个"点按钮选文件"的入口。
2. **拖入只能预览不能编辑**：拖入文件用 `iframe.srcdoc = 内容` 直接塞，绕开了 server 的 `/api/file` endpoint，导致 saver-runtime.js 没注入，**编辑/批注/自动快照/三选一保存能力全无**。
3. **"选择文件夹" modal 是单栏列表**：视觉简陋，不符合 macOS Finder / Windows Explorer 的双栏体验预期。

### 1.2 目标

本次改造达成 3 件事：

| # | 子功能 | 用户感知 |
|---|---|---|
| 1 | 新增"打开文件"按钮 + Finder 风格 modal | 用户能点按钮选 HTML/MD 文件，选中的文件可编辑真实文件（不是副本），并进入"最近打开"列表 |
| 2 | 改造拖入预览为可编辑 | 拖入文件立即可编辑，编辑保存到 `_dropbox/` 副本；关闭或切换时弹"另存为新版本 / 丢弃"二选一 |
| 3 | 顺便升级现有"添加文件夹"modal | 把现有单栏 modal 升级到 Finder 双栏风格，与新"打开文件"共享一套组件，根据触发入口切换 mode |

### 1.3 非目标（YAGNI）

明确不做的事：

- 不做"打开任意类型文件"（只支持 HTML/MD，DocCenter 的渲染范围）
- 不做"多选文件批量添加"（一次只选一个）
- 不做"文件搜索"功能（modal 内不搜索，靠侧栏已有 search box）
- 不做云端同步（"最近打开"只存 localStorage，不同步）
- 不做"打开文件"按钮的快捷键绑定（首版用鼠标点，快捷键留给后续迭代）

## 2. 整体架构

3 个子功能共享底层 `openFile(node)` 入口，关系图：

```
┌─ 子功能 1：新增"打开文件"按钮 ─────┐
│  sidebar ＋(添加文件夹) → mode=folder │
│  sidebar 📂(打开文件，新增) → mode=file │
│         ↓                            │
│  共享 Finder 风格 modal              │
│         ↓                            │
│  选中 → openFile(node) ─────────┐    │
└─────────────────────────────────│────┘
                                  ↓
┌─ 子功能 2：拖入预览改造 ─┐    ┌─ 子功能 3：最近打开 tab ─┐
│  drop handler            │    │  localStorage 持久化      │
│  → POST /api/drag-upload │    │  侧栏 tab 已存在，填内容  │
│  → server 写 _dropbox/   │    │  显示最近 20 条           │
│  → openFile({abs_path})  │───→│  点击 → openFile(node)    │
│  → 关闭弹"另存为/丢弃"   │    │                           │
└──────────────────────────┘    └───────────────────────────┘
                                  ↑
            所有 openFile 调用统一记到"最近打开"
```

**核心复用原则**：3 个子功能最终都走 `openFile(node)` —— 现有编辑/自动快照/三选一保存逻辑全部复用，**不重写编辑器**。

## 3. 后端 API 变更

### 3.1 API 总览

| Endpoint | 改动 | 用途 |
|---|---|---|
| `GET /api/browse?path=...&mode=file` | **扩展**：现有只返回 `dirs`，加 `mode=file` 时同时返回 `files`（含 name/path/size/mtime） | Finder modal 文件列表 |
| `POST /api/drag-upload` | **新增**：multipart 接收文件 → 写到 `_dropbox/{filename}` → 返回 `{abs_path, name, type}` | 拖入文件可编辑 |
| `POST /api/save-as` | **新增**：接受 `{src_path, dest_path}` → 复制文件 → 返回新路径 | 拖入关闭时"另存为新版本" |
| `GET /api/file?path=...` | 不动 | 已管理文件加载（saver-runtime.js 注入） |
| 现有 `/api/save` 三选一 | 不动 | 已管理文件关闭时三选一 |

### 3.2 `/api/browse?mode=file` 详细规范

**向后兼容**：不传 `mode` 参数时，**返回结构完全不变**（只有 `dirs` 字段，没有 `files`），保证现有调用方零影响。

**传 `mode=file` 时**，响应增加 `files` 字段：

```json
{
  "ok": true,
  "current": "/Users/.../Documents",
  "parent": "/Users/...",
  "is_root": false,
  "dirs": [
    {"name": "reports", "path": "/Users/.../reports"}
  ],
  "files": [
    {
      "name": "report-2026-07-17.html",
      "path": "/Users/.../report-2026-07-17.html",
      "size": 2156,
      "mtime": 1721200000,
      "type": "html"
    },
    {
      "name": "notes.md",
      "path": "/Users/.../notes.md",
      "size": 1432,
      "mtime": 1721190000,
      "type": "md"
    }
  ]
}
```

**文件过滤**：只返回 `.html` / `.htm` / `.md` 三种扩展名，其他文件不返回。

**`is_root=true` 时**（不传 path）：`files` 字段为空数组 `[]`，`dirs` 字段保留现有快捷入口逻辑。

### 3.3 `/api/drag-upload` 详细规范

**请求**：`multipart/form-data`
- `file`：File 对象（必填）
- `filename`：原始文件名（必填，用于服务端命名）

**响应**：
```json
{
  "ok": true,
  "abs_path": "/Users/.../html-doc-center/_dropbox/report-2026-07-17.html",
  "name": "report-2026-07-17.html",
  "type": "html"
}
```

**服务端处理**：
1. 校验文件大小 ≤ 10MB（否则返回 413）
2. 校验扩展名是 .html/.htm/.md（否则返回 400）
3. 写到 `<server 工作目录>/_dropbox/{filename}`
4. 文件名冲突时加 `-{YYYYMMDD-HHMMSS}` 后缀（如 `report-2026-07-17-20260717-143022.html`）
5. 返回 abs_path（绝对路径）

### 3.4 `/api/save-as` 详细规范

**请求**：`application/json`
```json
{
  "src_path": "/Users/.../_dropbox/report.html",
  "dest_path": "/Users/.../Documents/final-report.html"
}
```

**响应**：
- 成功：`{"ok": true, "dest_path": "..."}`
- 目标已存在：返回 409 `{"ok": false, "error": "target_exists"}`
- 目标无写权限：返回 403 `{"ok": false, "error": "permission_denied"}`
- 源文件不存在：返回 404 `{"ok": false, "error": "source_not_found"}`

**服务端处理**：`shutil.copy2(src, dest)`（保留 mtime）。

### 3.5 `_dropbox/` 目录管理

- 位置：`<server 工作目录>/_dropbox/`
- 启动时清理：删除 7 天前未修改的文件（避免无限增长）
- 清理失败：log 警告，**不阻塞启动**
- 不进入扫描根目录（用户只能通过"最近打开"tab 或 modal 左侧 Recent 访问）

## 4. 前端 UI 改造

### 4.1 Finder 风格 modal 布局

```
┌──────────────────────────────────────────────────────┐
│ 📂 Select a folder / Open a file              [×]   │
├───────────────┬──────────────────────────────────────┤
│ 📍 Shortcuts  │  🏠 home / Documents / reports       │ ← 面包屑（可点）
│  🏠 Home       │  ─────────────────────────────       │
│  🖥 Desktop    │  Today                               │ ← 时间分组（只 2 组）
│  📄 Documents  │  📄 report-2026-07-17.html  2.1KB   │
│  ⬇ Downloads   │  📄 notes-today.md         1.4KB   │
│               │  Earlier                             │
│ 📌 Pinned     │  📄 meeting.md             3.0KB   │
│  📌 openclaw   │  📁 archives                         │
│  📌 outputs    │  📄 old-spec.html          5.2KB   │
│               │  📁 legacy                            │
│ 🕐 Recent     │                                      │
│  📄 xxx.html  │                                      │
├───────────────┴──────────────────────────────────────┤
│ Selected: /path/to/file              [Cancel][Open] │
└──────────────────────────────────────────────────────┘
```

### 4.2 mode 行为

| mode | 列表内容 | 双击目录 | 双击文件 | 确定按钮文案 |
|---|---|---|---|---|
| `folder` | 只 📁 目录 | 进入 | 不显示文件 | "Choose this folder" |
| `file` | 📁 目录 + 📄 HTML/MD 文件 | 进入 | 直接打开（=选中+确定） | "Open this file" |

### 4.3 左侧栏 3 个 section

- **📍 Shortcuts**：🏠 主目录 / 🖥 桌面 / 📄 文稿 / ⬇ 下载（复用 server 已有返回）
- **📌 Pinned**：现有 scan_roots 父目录（复用 server 已有返回）
- **🕐 Recent**：localStorage 最近打开 5 条（点击直接 `openFile`，不进右侧列表）

### 4.4 右侧主区

- 顶部面包屑（复用现有 `renderBrowseBreadcrumb` 逻辑）
- 列表按 mtime 分组：**Today / Earlier 2 组**（简化版）
- 每行：图标 + 名称 + 大小（文件才显示，目录不显示）+ mtime 相对时间（"2 hours ago"）
- 默认排序：mtime 倒序

### 4.5 入口按钮

| 位置 | 现有 | 新增 |
|---|---|---|
| sidebar 顶部 | `＋`（添加文件夹） | `📂`（打开文件）—— 放在 ＋ 右边 |
| welcome 页 | `📂 添加文件夹` | `📄 打开文件` —— 放在添加文件夹右边 |

### 4.6 拖入预览改造

```js
// 现有：iframe.srcdoc = text  ❌ 绕过 server，无 saver-runtime.js
// 改为：
const fd = new FormData();
fd.append("file", target);  // File 对象
fd.append("filename", target.name);
const r = await fetch("/api/drag-upload", { method: "POST", body: fd });
const { abs_path, name, type } = await r.json();
// 注意：现有 openFile 接收的 node 字段是 abs_path（下划线），内部 state.currentFile 用 absPath（驼峰）
openFile({ abs_path, name, type });  // ✅ 走完整管理路径
state.currentFile.isDropbox = true;   // 标记，关闭时走二选一（新增字段，不影响现有逻辑）
```

**关闭/切换时弹的对话框**：
- 标题："This dropbox file has unsaved changes"
- 选项：[Save as new version] [Discard] （**没有** Overwrite source，因为浏览器拿不到原路径）
- "Save as new version" → 调 `/api/save-as`，**复用本设计第 4.1 节的 Finder 风格 modal**（mode=folder，让用户选目标目录，文件名用 input 框输入）让用户选目标位置

### 4.7 "最近打开" tab 填充

- localStorage key：`doccenter.recent-files`
- 数据结构：`[{abs_path, name, type, opened_at}]`
- 上限 20 条，新的 push 到头部，按 `abs_path` 去重
- 写入时机：所有 `openFile(node)` 调用后同步写入（包括侧栏点击 / 新"打开文件"按钮 / 拖入 / session restore）
- `openFile` 函数签名**不扩展**——写入逻辑放在 `openFile` 函数内部末尾（一行 `addToRecentFiles(node)` 调用），所有调用方零改动
- 渲染：参考现有 favorites tab 的渲染逻辑，每行显示文件名 + 相对路径 + "opened N hours ago"
- 点击行 → `openFile(node)` 直接打开

## 5. 错误处理 / 边界情况

| # | 场景 | 处理 |
|---|---|---|
| 1 | 拖入文件 > 10MB | server 返回 413，前端 toast "文件过大（>10MB）" |
| 2 | 拖入非 HTML/MD 文件 | 前端拦截，toast "请拖入 HTML 或 Markdown 文件"（保留现有逻辑） |
| 3 | 拖入多个文件 | 取第一个 HTML，否则第一个 MD，否则报错（保留现有逻辑） |
| 4 | `_dropbox/` 文件名冲突 | server 自动加 `-{YYYYMMDD-HHMMSS}` 后缀 |
| 5 | `_dropbox/` 写入失败（磁盘满/权限） | server 返回 500，前端 toast "保存失败：{msg}" |
| 6 | `/api/browse?mode=file` 目录不存在 | server 返回 404，前端 modal 显示空状态 "Directory not found" |
| 7 | `/api/browse?mode=file` 权限错误 | server 返回 403，前端 modal 显示 "Permission denied" |
| 8 | "最近打开"列表中文件已被删除 | 点击时 server 返回 404，toast "文件已被删除"，**自动从列表移除** |
| 9 | "最近打开"列表 > 20 条 | 自动 trim 到 20 条（push 头部时去重 + 截断） |
| 10 | localStorage 满（隐私模式） | try/catch 静默失败，**不影响打开文件主流程**，只是"最近打开"不持久化 |
| 11 | 拖入时已有未保存改动 | 触发 `promptSaveBeforeSwitch`，让用户先保存当前文件（复用现有逻辑） |
| 12 | `/api/save-as` 目标已存在 | server 返回 409，前端弹 "覆盖 / 取消" 二级确认 |
| 13 | `/api/save-as` 目标无写权限 | server 返回 403，前端 toast "无权写入此位置" |
| 14 | `_dropbox/` 启动清理失败 | server log 警告，**不阻塞启动** |
| 15 | mode=file 下选了目录点确定 | 确定按钮 disabled，列表里点目录是进入而非选中 |
| 16 | modal 打开时网络断开 | toast "网络错误"，modal 保持打开，用户可重试或取消 |

## 6. 测试策略

按反 Bug 5 条铁律（memory 84066387）+ 完整 PM→Dev→Test→PM 流程（memory 15875548）。

### 6.1 单元测试（pytest，针对 server 后端）

```
test_browse_with_files              # /api/browse?mode=file 返回 files 列表含 mtime/size
test_browse_with_files_filter       # 只返回 .html/.htm/.md，过滤其他
test_browse_without_mode_backward   # 不传 mode 时行为完全不变（兼容性回归）
test_drag_upload_html               # POST HTML → 写 _dropbox/ → 返回 abs_path
test_drag_upload_md                 # 同上 MD
test_drag_upload_oversize           # >10MB 返回 413
test_drag_upload_invalid_type       # 非 HTML/MD 返回 400
test_drag_upload_name_conflict      # 同名加 timestamp 后缀
test_save_as_copy                   # 源 → 目标复制成功
test_save_as_target_exists          # 返回 409
test_save_as_no_permission          # 返回 403
test_dropbox_cleanup_7days          # 7 天前文件被清理，新文件保留
test_dropbox_cleanup_failure_nonfatal  # 清理失败不阻塞启动
```

### 6.2 前端手动演练（真实浏览器，按铁律 1「真实浏览器演练」）

5 个核心场景，每个都必须在浏览器里真点过、写出"我点了 X 看到了 Y"：

1. **打开文件主流程**：sidebar 📂 按钮 → modal 弹出 → 双击进入子目录 → 双击 HTML 文件 → 自动打开可编辑 → 改一行 → 2 秒后检查 `_auto-save/` 有快照 → 关闭弹"覆盖/另存/丢弃"三选一 → 选覆盖 → 原文件被改
2. **拖入编辑流程**：从 Finder 拖 HTML 到 DocCenter → 立即可编辑 → 改一行 → 关闭弹"另存为/丢弃"二选一 → 选另存为 → Finder modal 弹出选位置 → 保存成功 → 检查 `_dropbox/` 副本仍在
3. **添加文件夹回归**：sidebar ＋ 按钮 → modal mode=folder → 选目录 → 加入扫描根 → 侧栏出现新根 → 点击其中的文件能编辑
4. **最近打开 tab**：打开 3 个文件 → 切到侧栏 🕐 Recent tab → 看到 3 条记录 → 点击其中一条 → 直接打开
5. **左侧栏 Recent 入口**：sidebar 📂 按钮 → modal 左侧 🕐 Recent section → 看到最近 5 条 → 点击一条 → **直接关闭 modal 并 `openFile` 该文件**（不渲染右侧文件列表）

### 6.3 跨浏览器 + 跨平台

- 跨浏览器：Chrome / Safari / Firefox 各跑一遍场景 1+2，确认 fallback 一致
- 跨平台：macOS + Windows 各跑一遍场景 1+2，确认路径分隔符、`_dropbox/` 位置都正确

### 6.4 回归测试

- 现有"添加文件夹"功能（mode=folder）必须 100% 不变
- 现有侧栏文件点击编辑/保存流程不变
- 现有 session restore 不变
- 现有 `/api/browse` 不传 mode 时行为完全不变（向后兼容）

## 7. 影响范围 / 风险

### 7.1 文件改动清单

**后端**：
- `server.py`：扩展 `handle_browse`，新增 `handle_drag_upload` + `handle_save_as` + `_dropbox/` 清理逻辑

**前端**：
- `web/index.html`：modal HTML 结构重写（双栏），新增 sidebar "打开文件" 按钮，welcome 页新增"打开文件"按钮
- `web/app.js`：modal 渲染逻辑改造（双栏 + mode 切换 + 时间分组），拖入 drop handler 改造，"最近打开" tab 填充，所有 `openFile` 调用增加 localStorage 写入
- `web/style.css`：modal 双栏样式，左侧栏样式，时间分组样式，文件行样式
- `web/locales/en.js` + `web/locales/zh.js`：新增 modal 标题、按钮文案、空状态文案、左侧栏 section 标题等 i18n key

**测试**（建议路径，plan 阶段可调整）：
- `tests/test_browse_with_files.py` 等新增测试文件
- `tests/manual-checklist.md`：5 个核心场景手动演练清单（参考路径，非强制）

### 7.2 风险评估

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| 现有 `/api/browse` 兼容性破坏 | 低 | 高（侧栏添加文件夹挂掉） | 单元测试 `test_browse_without_mode_backward` 守护 |
| 现有拖入预览行为改变 | 中 | 中（用户习惯了"拖入即预览"） | 改造后立即弹 toast "已加载到 dropbox，可编辑"，明确告知行为变化 |
| `_dropbox/` 无限增长 | 低 | 低（磁盘占用） | 7 天清理策略 + 单文件 10MB 限制 |
| localStorage 在隐私模式失效 | 中 | 低（"最近打开"不持久化） | try/catch 静默失败，主流程不受影响 |
| 跨平台路径分隔符问题 | 中 | 中（Windows 路径用 `\`） | server 用 `pathlib.Path` 统一处理，前端用 `path.split(/[/\\]/)` |
| Finder modal 双栏布局在某些窄屏下挤 | 中 | 低（视觉问题） | CSS 媒体查询，<600px 时左侧栏折叠为顶部水平滚动条 |

## 8. 决策记录

| # | 决策 | 备选 | 理由 |
|---|---|---|---|
| 1 | 用 HTML 实现 Finder 风格，不用 `window.showDirectoryPicker` | File System Access API | 用户要求"浏览器无关"，Safari/Firefox 不支持 File System Access API |
| 2 | 拖入编辑副本而非原文件 | 让用户手动输入原文件路径 | 浏览器安全限制拿不到原路径，让用户输入太繁琐；副本 + 另存为更符合用户心智 |
| 3 | "最近打开"上限 20 条 | 50 条 / 无上限 | 20 条够日常使用，过多会让列表臃肿；localStorage 也有大小限制 |
| 4 | 时间分组简化为 Today / Earlier 2 组 | 4 组（Today/Yesterday/Past 7 days/Earlier） | 用户明确选择简化版，2 组够用 |
| 5 | 共享一套 modal 组件，根据 mode 切换 | 新增独立 modal / 改造现有 modal | 复用代码、UX 一致、维护成本低 |
| 6 | `_dropbox/` 命名 | `_drag-tmp/` / `_inbox/` | 用户明确选择 `_dropbox/`，含义清楚（拖入箱） |
| 7 | 7 天清理策略 | 手动清理 / 永不清理 | 用户明确接受 7 天清理，平衡磁盘占用和数据保留 |
| 8 | 文件名冲突加 `-{YYYYMMDD-HHMMSS}` 后缀 | `-{N}` 数字递增 | 时间戳更可读，能一眼看出副本创建时间 |

## 9. 后续迭代候选（不在本次范围）

- "打开文件"按钮快捷键（如 ⌘O）
- modal 内文件搜索
- 多选文件批量打开
- "最近打开"列表云端同步
- `_dropbox/` 管理 UI（查看/清理/导出）
- Finder modal 主题切换（跟随 DocCenter 明暗主题）
