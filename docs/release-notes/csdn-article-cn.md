# 开源首发：DocCenter — 治好 AI 时代的 HTML 文档散落病

> **CSDN 中文版** · 适合 CSDN 专栏发布
> **建议字数**：2500-3500 字（CSDN 算法偏好长文）
> **Tags**：`Python` `aiohttp` `开源项目` `AI工具` `前端工程` `工具分享` `Claude` `ChatGPT`
> **专栏**：「工具开源」/「DocCenter」

---

## 一、痛点：AI 时代的文档散落病

过去一年，我每天被 AI 生成的 HTML 文件淹没。

Claude artifacts 一天 20 个、ChatGPT canvas 一天 10 个、Cursor / CodeBuddy 生成的报告一天 5-8 个。它们散落在十几个文件夹里，**双击只能看，改一个错字得翻出原始 prompt 重跑一遍，找历史版本找不到**。

我试过几条路都不通：

| 方案 | 不通在哪 |
|---|---|
| VSCode | 看 HTML 要预览插件，编辑富文本得切到源码模式 |
| Notion | 不接受 HTML 上传，复制粘贴丢失样式 |
| 浏览器收藏夹 | 不能编辑，不能批注 |
| 自建静态站 | 太重，每次都要 build deploy |

所以我写了 **DocCenter**：一个跑在 `localhost:9901` 的本地工作台，专门治这个病。

**仓库地址**：https://github.com/louisecxqiu-glitch/html-doc-center

---

## 二、技术选型：为什么是单 Python 文件 + vanilla JS

DocCenter 整个后端是 **一个 `server.py`，零 `requirements.txt`，唯一外部依赖是 `aiohttp`**。前端是 vanilla JS，没有构建步骤。

这不是炫技，是有意为之。三个关键决定：

### 2.1 选 aiohttp，不选 FastAPI

| 维度 | aiohttp | FastAPI |
|---|---|---|
| 冷启动 | 0.3s | 1.5s（pydantic 加载） |
| 内存 | ~30MB | ~80MB |
| 心智负担 | 一个 `web.RouteTableDef` 完事 | 还要懂 Pydantic models |

工作台不是产品，是**自己每天用的工具**。冷启动快、内存小比规整 OpenAPI 文档重要 100 倍。我自己 Mac 上同时还跑着 dashboard（9900）、心跳（4011）、cockpit（8088）……每个都吃 80MB 我不答应。

### 2.2 选 vanilla JS，不选 React

零构建 = 零心智负担。修一个 bug 不需要：`npm install` → `npm run build` → 刷新，而是：**改 → Cmd+Shift+R**。

唯一嵌入的依赖是 `marked.min.js`（Markdown 渲染，MIT），平铺在 `web/vendor/`。整个 `web/` 目录 8 个文件就是全部前端代码。

### 2.3 选 iframe，不选 SPA 路由

被编辑的 HTML 文件是**完整页面**——它有自己的 CSS 动画、JS 交互、外链字体。如果把它的 body 抠出来塞进 SPA，那些上下文全丢了。

iframe 让每篇文档保留完整运行时，DocCenter 只在它的 `</body>` 前注入一段 `saver-runtime.js`，提供编辑工具栏和自动保存能力。**保持原文件运行时不被污染** 是 v1.0 就立的规矩。

---

## 三、核心架构三段式

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

### 3.1 后端 server.py：路径安全是唯一硬约束

所有 I/O handler 都必须先过 `_resolve_safe()`：把传入路径 resolve 成绝对路径，再校验它在某个 `scan_root` 之下，否则返回 403。

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

**新增任何 I/O handler 都禁止绕过它**——这是 v1.0 就定下的硬规矩，到 v1.11.11 都没破例。

`scan_roots` 配置在 `~/.codebuddy/html-doc-center/config.json`，前端设置面板可增删。默认排除 `_auto-save / node_modules / .git / dist / build` 等。

### 3.2 saver-runtime.js：脏状态监听的三道护栏

这是项目最难的一段。dirty 检测必须**只在用户主动编辑时为 true**，不能被页面 JS 动画 / scroll / 高亮触发。

```javascript
// 护栏 1：用户交互窗口
const USER_INTERACT_WINDOW_MS = 800;
let lastInteract = 0;
['keydown', 'mousedown', 'paste', 'cut', 'drop'].forEach(ev =>
  document.addEventListener(ev, () => { lastInteract = Date.now(); }, true)
);

// 护栏 2：MutationObserver 配置只看 childList + characterData
const mo = new MutationObserver(mutations => {
  if (Date.now() - lastInteract > USER_INTERACT_WINDOW_MS) return;
  if (mutations.some(m =>
      m.target.tagName === 'SCRIPT' ||
      m.target.tagName === 'STYLE')) return;
  setDirty(true);
});

// 护栏 3：延迟 1 秒 observe，避开页面初始化
setTimeout(() => {
  mo.observe(document.body, {
    childList: true,
    characterData: true,
    subtree: true
    // 严禁 attributes: true，会被动画/滚动高亮误报
  });
}, 1000);
```

这三道护栏是 v1.2.4 一次脏状态误报 bug 后立的，至今没退化。**修改这段代码前必读注释**——容易被"看似优化"地打开 `attributes: true`，立刻退化。

### 3.3 前端 app.js：唯一的 UX 决策点是三选一对话框

切换文件 / 关闭 / 刷新时若 `isDirty=true`，弹出：

```
┌─────────────────────────────────────────┐
│  你修改了文档                            │
│                                         │
│  ✅ 覆盖源文件                           │
│  🆕 另存为审阅版                         │
│  🗑 丢弃修改                            │
└─────────────────────────────────────────┘
```

**整个 UX 只有这一个决策点**。v1.2.5 我尝试加过第四个 💾 按钮（"保存并继续编辑"），实测后立刻撤了——决策点越多用户越累。**少即是多**不是口号，是每次想加按钮时都得过的关。

---

## 四、5 条反 Bug 铁律（项目沉淀）

v1.0 → v1.11.11 连续 42 版迭代，踩了一堆坑。其中 v1.11 系列连续 11 次 hotfix 把我教育到位，逼出 5 条铁律，全部写进 `ITERATION-SOP.md`：

### 铁律 1：真实浏览器演练 ——「curl 200」≠「用户视角能用」

**反面案例（v1.11.10）**：三 Tab 切换功能，curl 返回 200，lint 0 错误，我宣称完成。用户实测：切到「收藏」「最近」Tab 显示空白。

**根因**：CSS 的 `.active { display: block }` 干不过 inline 的 `style="display:none"`，HTML 里有历史残留。

**铁律**：commit 前必须在浏览器**硬刷新（Cmd+Shift+R）+ 用户视角点 3+ 个核心交互**。验收报告不能只贴 curl 200，要写"我在浏览器点了 X 看到了 Y"。

### 铁律 2：守卫表达式必须显式验证

**反面案例（v1.11.11）**：`if (window.sidebarTabsCtl)` 永远 false，因为 `sidebarTabsCtl` 是 IIFE 内的 `const`，从未挂到 `window` 上。

```javascript
// ❌ 永远进不来
(function() {
  const sidebarTabsCtl = { activate: ... };
})();
if (window.sidebarTabsCtl) { ... }  // false forever

// ✅ 闭包内直接引用
(function() {
  const sidebarTabsCtl = { activate: ... };
  function onClick() {
    sidebarTabsCtl && sidebarTabsCtl.activate('tree');
  }
})();
```

**铁律**：写 `if (X)` 前确认 X 在该 scope 的真实可见性。

### 铁律 3：CSS 改 .active / display 前 grep inline style 残留

**铁律**：CSS 优先级 inline > id > class > tag。改新 class 控制显示前，**先 `grep` 旧 HTML 是否有同名 inline style="display:none" 残留**——它会压住 CSS。`!important` 是最后一招。

### 铁律 4：DOM 切换后的依赖动作必须用 rAF

**反面案例（v1.11.11）**：点击收藏目录 → `activate('tree')` 切 display → 立刻 `scrollToPath()` 算位置 → 在旧布局上算 → 视觉零反馈。

```javascript
// ❌ 在旧布局上算位置
sidebarTabsCtl.activate('tree');
scrollToPath(path);  // getBoundingClientRect returns stale values

// ✅ 等下一帧
sidebarTabsCtl.activate('tree');
requestAnimationFrame(() => {
  scrollToPath(path);
});
```

### 铁律 5：自驱模式 ≠ 跳过用户视角

用户说"自驱不要打断"指的是不要发决策卡片，**不是免除验收**。每 2-3 个版本最少一次"假装我是用户"演练。**CHANGELOG 用户故事段写得越漂亮，越要在浏览器里真实验过**——否则就是文档自我催眠。

---

## 五、Quick Start & v1.12 Roadmap

### Quick Start（3 行）

```bash
git clone https://github.com/louisecxqiu-glitch/html-doc-center.git
cd html-doc-center
pip3 install aiohttp && python3 server.py
# → 打开 http://localhost:9901
```

macOS 开机自启：

```bash
cp launchd.plist.example ~/Library/LaunchAgents/com.louis.html-doc-center.plist
launchctl load ~/Library/LaunchAgents/com.louis.html-doc-center.plist
```

### v1.12 Roadmap（计划中）

- 全文搜索（FTS5 + 防抖）
- HTML 块级编辑增强（拖拽重排、批量样式）
- 多窗口同步（一个文件多 tab 打开时的状态广播）
- 移动端触屏阅读模式（侧栏抽屉化）

详见 [`docs/superpowers/plans/2026-05-14-v1.12-roadmap.md`](https://github.com/louisecxqiu-glitch/html-doc-center/blob/main/docs/superpowers/plans/2026-05-14-v1.12-roadmap.md)。

---

## 六、仓库与联系方式

⭐ **GitHub**: https://github.com/louisecxqiu-glitch/html-doc-center
🐛 Issues / 💡 Discussions / 🔧 PRs 都欢迎 —— 见 [CONTRIBUTING.md](https://github.com/louisecxqiu-glitch/html-doc-center/blob/main/CONTRIBUTING.md)

**Connect**：
- 🔶 微信公众号「一深思AI」—— 配套深度文章（《养虾系列》AI Agent 实战方法论）
- 📝 CSDN：[blog.csdn.net/qcx23](https://blog.csdn.net/qcx23)
- 🐦 X / Twitter：[@louisqiu285052](https://x.com/louisqiu285052)

如果这工具对你有用，**star 一下是对开源最好的支持**。Issue / PR 都欢迎，慢慢养。

---

*Built with ❤️ by Louis Qiu · MIT Licensed · 路易乔布斯 © 2026*
