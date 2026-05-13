> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

# v1.5.x — 设置面板三处修复

## Goal

修复设置面板的 3 个用户体验问题：

1. **P1 · 设置面板屏幕适配**：11+ 条扫描目录时面板撑出视窗，"添加"输入框被挤出可视区
2. **P2 · addRoot 错误提示不友好**：后端返回 500/非 JSON 时前端报 `Unexpected non-whitespace character after JSON at position 4`，用户完全不知道发生了什么
3. **P3 · 移除/添加后目录树"感觉没刷新"**：`updateRoots` 实际调用了 `loadTree(true)`，但用户视觉上无反馈（侧边栏可能被设置面板遮挡）

**真·根因复盘**（重要）：

用户报"添加失败: Unexpected non-whitespace character after JSON at position 4" 的**真实根因是后端服务没重启**（PID 58859 从周一下午一直在跑 v1.1 版本代码），碰到 v1.4 新数据结构 `[{path, enabled}]` 时抛异常，aiohttp 返回默认 500 纯文本 body "Server got itself in trouble"，前端 `r.json()` 解析这个文本就炸了。重启最新服务后测试全部通过。

但这暴露出**前端错误处理不够健壮**——HTTP status 非 2xx 时应该读 text 而不是 json，错误提示应该带 HTTP 状态码便于自救。

## Architecture

- 前端 `web/app.js`: `updateRoots` / `addRoot` 的错误处理路径升级
- 前端 `web/style.css`: `.modal` 增加 max-height + 独立滚动区
- 后端 `server.py`: 无改动
- 文档：ITERATION-SOP.md 新增"**改动代码后必须重启服务**"铁律

## Tech Stack

Python 3 + aiohttp（后端）· 原生 JS + CSS（前端）· 无新增依赖

## File Structure

| 文件 | 改动 | 说明 |
|---|---|---|
| `web/style.css` | Modify | `.modal` 加 `max-height: 88vh` + `display: flex; flex-direction: column`；新增 `.settings-scroll` 独立滚动区 |
| `web/index.html` | Modify | 设置面板包一层 `.settings-scroll`，让头部 / 滚动区 / 底部关闭按钮三段式布局；版本号 bump |
| `web/app.js` | Modify | `updateRoots` / `addRoot` 错误处理：检查 `r.ok` 和 `content-type`，非 JSON 时读 text 提示；toast 带 HTTP 状态码 |
| `CHANGELOG.md` | Modify | 新增 v1.5.0 条目 |
| `CHANGELOG.html` | Modify | 新增 v1.5.0 时间轴卡片 |
| `ITERATION-SOP.md` | Modify | 铁律 2：改代码后必须重启服务 |

## Tasks

### Task 1 — 设置面板 CSS 屏幕适配（P1）

**Why**: 11+ 条扫描目录撑破屏幕，"添加"输入框不可见

**Files**:
- `web/style.css`
- `web/index.html`

**Steps**:
- [x] Step 1.1: `.modal` 加 `max-height: 88vh; display: flex; flex-direction: column; padding: 0;`，移除原 padding
- [x] Step 1.2: 新增 `.modal-head` / `.modal-scroll` / `.modal-foot` 三段式结构
- [x] Step 1.3: 设置面板 HTML 改造：h3 进 modal-head，扫描目录 + 关于进 modal-scroll（可滚动），关闭按钮进 modal-foot
- [x] Step 1.4: 版本号 `?v=1.5.2` → `?v=1.5.3`

### Task 2 — 前端错误处理健壮化（P2）

**Why**: 后端 500 时前端报晦涩的 JSON 解析错误，用户不知道该做什么

**Files**:
- `web/app.js`

**Steps**:
- [x] Step 2.1: 封装 `safeFetchJson(url, opts)` helper——检查 `r.ok` 和 `content-type`，非 JSON 时读 text 并抛出带状态码的错误
- [x] Step 2.2: `updateRoots` / `addRoot` / `toggleRoot` / `removeRoot` 改用 `safeFetchJson`
- [x] Step 2.3: 错误 toast 显示 `HTTP 状态码 + 关键提示`，如"服务端 500，可能需要重启 server.py"

### Task 3 — 刷新反馈强化（P3）

**Why**: 用户看不到移除/添加后的变化

**Files**:
- `web/app.js`

**Steps**:
- [x] Step 3.1: `updateRoots` 成功后 toast 改为带"目录树已刷新"副标题
- [x] Step 3.2: `removeRoot` 成功后触发 `sidebarCtl.show(true)`，让用户看到侧边栏最新状态

### Task 4 — 文档三写（三写铁律实施）

**Why**: 上次踩坑的教训

**Files**:
- `CHANGELOG.md` / `CHANGELOG.html` / `ITERATION-SOP.md`

**Steps**:
- [x] Step 4.1: `CHANGELOG.md` 新增 v1.5.0 卡片，含 3 个问题的三段式
- [x] Step 4.2: `CHANGELOG.html` 新增对应时间轴卡片
- [x] Step 4.3: `ITERATION-SOP.md` 新增铁律 2：改代码后必须 `kill + nohup python3 server.py` 重启，否则前端会见到 500
- [x] Step 4.4: git commit（三写铁律落地）

## 验收标准

- [x] POST `/api/config` 返回合法 JSON，curl 测试通过
- [x] 设置面板在 11+ 条目录下可见"添加"输入框 + "关闭"按钮
- [x] 主动触发后端异常时（如发个非法 payload），前端 toast 显示 "HTTP 500: Server got itself in trouble（请重启 server.py）" 这样的提示
- [x] git commit 后 `git log --oneline -1` 的版本号 ≥ CHANGELOG 最新条目
