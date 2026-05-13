# HTML Document Center v1.1 UX 优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 v1.0 的三个 UX 顽疾——目录遮挡、缩放设计混乱、三栏垂直空间浪费，让工作台进入真正"爽"的状态。

**Architecture:**
- 目录从 **absolute 浮动** 改为 **flex 推挤** 布局（目录打开时编辑区同步收缩）
- 缩放档位重构为 `25 / 50 / 75 / 100 / 125 / 150`，默认 **75%**，删除 `Fit` 按钮
- **顶栏三合一**：品牌 + 目录按钮 + 面包屑 + 状态 + 缩放 + 保存按钮全部压到 44px 顶栏，删除 48px 的第二工具栏，省出 48px 垂直空间

**Tech Stack:** 纯前端改动（HTML + CSS + JS），零后端变动；手工浏览器验证 + Playwright 回归截图。

---

## File Structure

| 文件 | 改动类型 | 责任 |
|------|---------|------|
| `web/index.html` | Modify | 顶栏三合一 DOM 重组；删除 `.editor-topbar` 独立栏 |
| `web/style.css` | Modify | `.sidebar` 改 flex 布局；缩放样式调整；顶栏响应式布局 |
| `web/app.js` | Modify | 缩放档位数组更新（加 25/50，删 Fit）；默认值 `"75"`；sidebar 收起逻辑简化 |
| `docs/screenshots/take_screenshots.py` | Modify | 加一个新截图「对比布局」，验收布局修复 |
| `docs/screenshots/v1.1-2026-04-18/` | Create | 新版 4 张回归截图 |
| `CHANGELOG.md` | Create | 首次建立，记录 v1.0 → v1.1 改动 |

---

## Task 1: 顶栏三合一 DOM 重组

**Why**：第 2 栏的 `.editor-topbar` 是独立 48px 行，承载面包屑/状态/缩放/保存按钮。实际上这些信息完全可以塞进 44px 顶栏，少占一行。

**Files:**
- Modify: `web/index.html`（删除 `<div class="editor-topbar">` 整块，内容上移到 `<header class="topbar">`）

- [ ] **Step 1.1:** 在 `web/index.html` 的 `<header class="topbar">` 内，按以下顺序重组：
  ```
  [≡ 目录 ⌘B] [▎DocCenter] [|] [📄 面包屑（flex:1）] [● 状态] [缩放控件] [💾 保存] [✕ 关闭] [🔄] [⚙️]
  ```
- [ ] **Step 1.2:** 删除原 `<div class="editor-topbar">` 整块 DOM
- [ ] **Step 1.3:** 面包屑 `#breadcrumb` 放到顶栏中间，`flex: 1` 让它撑开剩余空间
- [ ] **Step 1.4:** 手工验证：刷新浏览器，空态时顶栏只有左右两端元素（面包屑显示空态引导文案）；打开 OPPO v2，面包屑填满中部

---

## Task 2: 目录从浮动改推挤布局

**Why**：用户明确抱怨目录遮挡正文，无法在打开目录时预览选中文档。

**Files:**
- Modify: `web/style.css`（`.sidebar` 从 `position: absolute` 改 flex 布局；删除 `.sidebar-overlay`）
- Modify: `web/app.js`（删除 overlay 相关逻辑）
- Modify: `web/index.html`（删除 `#sidebar-overlay` 元素）

- [ ] **Step 2.1:** `.layout` 保持 `display: flex`，删除 `position: relative`
- [ ] **Step 2.2:** `.sidebar` 重构：
  ```css
  .sidebar {
    width: 0;
    overflow: hidden;
    transition: width 0.22s cubic-bezier(0.16, 1, 0.3, 1);
    /* 保留其他视觉属性 */
  }
  .sidebar.visible { width: var(--sidebar-w); }
  ```
- [ ] **Step 2.3:** `.editor` 保持 `flex: 1`，会自动因 sidebar 变宽而收缩，**无需额外处理**
- [ ] **Step 2.4:** 删除 `.sidebar-overlay` 的 CSS 规则
- [ ] **Step 2.5:** 在 `index.html` 删除 `<div class="sidebar-overlay">` 元素
- [ ] **Step 2.6:** 在 `app.js` 删除 `$("#sidebar-overlay").addEventListener(...)` 事件绑定行
- [ ] **Step 2.7:** 手工验证：打开目录 → 编辑区同步右移收窄；关目录 → 编辑区展开。**无遮挡**

---

## Task 3: 缩放档位与默认值重构

**Why**：用户原话"现在最小也只能缩放到75%，这几个缩放排列不是很好啊，要求默认有25%，50%，75%，100%；默认75%"。Fit 概念模糊应删除。

**Files:**
- Modify: `web/index.html`（zoom-group 按钮重排）
- Modify: `web/app.js`（`ZOOM_LEVELS` 数组、默认值、apply 逻辑）
- Modify: `web/style.css`（如需调整宽度）

- [ ] **Step 3.1:** `index.html` 的 `.zoom-group` 重排为 **6 档**（从小到大）：
  ```
  [25%] [50%] [75%] [100%] [125%] [150%]
  ```
  默认 active 设置在 **75%** 按钮上
- [ ] **Step 3.2:** `app.js` 的 `ZOOM_LEVELS` 数组改为 `["25", "50", "75", "100", "125", "150"]`（删除 "fit"）
- [ ] **Step 3.3:** `zoomCtl.current` 初始值从 `100` 改为 `75`
- [ ] **Step 3.4:** `zoomCtl.apply()` 内删除 `if (level === "fit")` 分支
- [ ] **Step 3.5:** `openFile()` 打开新文件时的默认缩放从 `zoomCtl.apply("100")` 改为 `zoomCtl.apply("75")`
- [ ] **Step 3.6:** 手工验证：打开 OPPO v2，默认 75% 显示全宽舒适；点 25% 整页鸟瞰；点 150% 放大查细节

---

## Task 4: 删除 iframe 上方冗余 saver 工具栏

**Why**：用户第 3 张图里的第 3 栏 `DocCenter B I U ...` 工具栏是 saver-runtime.js 在 iframe 内注入的。但当前大多数 HTML 已有原生编辑工具栏（OPPO v2 就是），造成**双工具栏并存**。应该：检测到原生编辑器就**完全不注入** saver 工具栏。

**Files:**
- Modify: `saver-runtime.js`（嗅探到原生编辑器时完全跳过工具栏注入）

- [ ] **Step 4.1:** 阅读 `saver-runtime.js`，确认当前注入工具栏的条件判断
- [ ] **Step 4.2:** 修改逻辑：如果 `hasExistingEditor === true`（页面有 contenteditable 或自定义编辑按钮），**完全跳过**工具栏注入，只保留 debounce snapshot 监听
- [ ] **Step 4.3:** 手工验证：刷新 OPPO v2，顶部只剩"v2 可编辑审阅版" 一个原生工具栏，DocCenter 工具栏消失
- [ ] **Step 4.4:** 手工验证：打开一个**没有**原生编辑能力的 HTML（比如 `s2-preview-01-cover.html` 小红书封面）→ saver 工具栏应该显示，编辑/批注功能可用

---

## Task 5: 回归截图 + CHANGELOG

**Why**：v1.0 已交付截图，v1.1 需要对比截图证明改动生效；CHANGELOG 作为版本追溯单一来源。

**Files:**
- Modify: `docs/screenshots/take_screenshots.py`（VERSION 改为 "v1.1-2026-04-18"）
- Create: `docs/screenshots/v1.1-2026-04-18/*.png`（4 张）
- Create: `CHANGELOG.md`

- [ ] **Step 5.1:** `take_screenshots.py` 顶部 `VERSION = "v1.1-2026-04-18"`
- [ ] **Step 5.2:** 运行截图脚本：`python3 docs/screenshots/take_screenshots.py`
- [ ] **Step 5.3:** 读取 4 张新截图确认：顶栏合一（只有一条 44px 顶）、目录打开时编辑区推挤收缩、缩放控件 25/50/75/100/125/150、默认 75%
- [ ] **Step 5.4:** 创建 `CHANGELOG.md`：
  ```markdown
  # Changelog

  ## v1.1 — 2026-04-18
  ### UX 优化
  - 顶栏三合一：删除独立第 2 栏工具栏，省出 48px 垂直空间
  - 目录改推挤布局：打开时编辑区同步收窄，无遮挡
  - 缩放重构：6 档 25/50/75/100/125/150，默认 75%（删除 Fit）
  - 删除 iframe 双工具栏：有原生编辑器时跳过 DocCenter 工具栏注入

  ## v1.0 — 2026-04-18
  - 首版发布（44px 顶栏 + 浮动抽屉 + 5 档缩放 + 自动快照）
  ```
- [ ] **Step 5.5:** Git commit "feat(v1.1): UX 优化（三栏合一 + 推挤目录 + 缩放重构）"

---

## Success Criteria

所有必须达成：

1. ✅ 目录打开时编辑区宽度**同步收缩**（`iframe` 宽度跟随 `.editor` 变化），不被遮挡
2. ✅ 缩放按钮依次为 `25% 50% 75% 100% 125% 150%`，**默认高亮 75%**
3. ✅ 顶栏高度仅 **44px**，面包屑+状态+缩放+保存按钮全部集成在里面
4. ✅ 打开 OPPO v2（已有原生编辑器）时，iframe 上方**只有一条**原生工具栏（非 DocCenter 注入工具栏）
5. ✅ 打开养虾封面（无原生编辑器）时，DocCenter 工具栏**正常出现**兜底编辑能力
6. ✅ v1.1 截图与 v1.0 截图并排看得出明显空间优化
