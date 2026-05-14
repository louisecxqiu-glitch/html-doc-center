# DocCenter v1.11.11 开源首发三平台文案

> 发布前必读：
> - **红线**（memory 61777624 / 44904325）：所有平台发布**需要 Louis 本人明确说"发"才能真正发送**。
> - 本文档仅是**候选文案**，请先审一遍，改完后再让我用 MCP/CLI 发（或你手动发）。

---

## 🔶 微信公众号「一深思AI」短贴

**类型**：公众号**原创推送**（图文消息，非朋友圈短内容）
**发布时机**：开源当天晚上（20:00-22:00 流量高峰）
**封面建议**：DocCenter 主界面截图 + 红底白字「开源首发」胶囊
**标题候选**：

1. 《我把每天用的本地 HTML 工作台开源了：DocCenter v1.11.11》
2. 《被 AI 生成的 HTML 淹没？我写了个工具治这病（开源）》
3. 《42 版迭代后，我决定把 DocCenter 开源出来》

**副标题**：单 Python 文件 · 零 npm 依赖 · 本地 9901 端口 · MIT

**正文框架**（约 1500 字，配 3-5 张实操截图）：

```
引子：过去一年我每天被 AI 生成的 HTML 淹没

Claude artifacts 一天 20 个、ChatGPT canvas 一天 10 个、养虾系列封面一天 3-5 个……
它们散落在十几个文件夹里，双击只能看、改字得重跑 prompt、找历史版本找不到。

所以我写了 DocCenter。

---

截图 1：主界面（左侧目录树 + 右侧 iframe 编辑）

核心能力四件套：
1. 一站目录 — 扫描你指定的几个根目录，HTML 全聚合成树
2. 所见即所得 — iframe 里直接编辑，自动注入 B/I/U/色板工具条
3. 自动快照 — 改完自动存到 _auto-save/，关闭时三选一
4. 本地 first — 127.0.0.1 only，不上云不联网

---

截图 2：三 Tab 侧栏（目录 / 收藏 / 最近）
截图 3：自动快照管理面板（时光机）
截图 4：暗色模式

---

为什么开源？

（1）这工具我每天用，已经稳定了
（2）身边同事也有这个痛点，与其一对一转发不如开源
（3）MIT License，想怎么改怎么改
（4）想试试开源社区运营是什么感觉

---

Quick Start（3 行命令）：

git clone https://github.com/louisecxqiu-glitch/html-doc-center.git
cd html-doc-center && pip3 install aiohttp && python3 server.py

浏览器访问 http://localhost:9901 就完事了。

---

反 Bug 铁律（项目沉淀）

v1.0 → v1.11.11 连续 10+ 版迭代，踩了一堆坑，总结成 5 条硬规矩：

1. 真实浏览器演练 —— curl 200 ≠ 用户视角能用
2. 守卫表达式必须显式验证 —— IIFE 内 const 不会出现在 window 上
3. CSS 改 .active / display 前 grep inline style 残留
4. DOM 切换后的依赖动作必须用 rAF
5. 自驱模式 ≠ 跳过用户视角

完整铁律在仓库 ITERATION-SOP.md，欢迎参考也欢迎挑战。

---

⭐ 觉得有用就 star 一下：
👉 https://github.com/louisecxqiu-glitch/html-doc-center

Issue / Discussion / PR 都欢迎，慢慢养。

---

路易乔布斯 © 2026
```

---

## 📝 CSDN 技术博客文案

**类型**：技术长文（2000-3000 字，适合 CSDN 算法偏好）
**专栏归属**：「工具开源」或新建「DocCenter」专栏
**标题候选**：

1. 《开源首发：DocCenter — 本地 HTML 工作台，治好 AI 时代的文档散落病》
2. 《单 Python 文件 + 零 npm 依赖，如何做一个能打的本地工作台（附 v1.0→v1.11 迭代复盘）》

**Tags**：`Python` `aiohttp` `开源项目` `AI工具` `前端工程` `全栈` `工具分享`

**正文结构**（比公众号更硬核，带代码段）：

```markdown
## 一、痛点：AI 时代的文档散落病

（对比传统文档管理 vs AI 生成文档的区别，说明为什么 VSCode/Notion 都不合适）

## 二、技术选型：为什么是单 Python 文件 + vanilla JS

- 选 aiohttp 而不是 FastAPI：单进程够用、冷启动快、无 pydantic 开销
- 选 vanilla JS 而不是 React：这是工作台不是产品，零构建 = 零心智负担
- 选 iframe 而不是 SPA 路由：让被编辑 HTML 保持完整上下文（包括它的 JS 动画）

（附 server.py 的三段式结构图）

## 三、核心架构三段式

1. aiohttp 后端：路径安全、目录缓存、快照清理
2. saver-runtime.js 注入层：检测原生编辑器、MutationObserver 脏状态监听
3. 前端 app.js：目录树、iframe 承载、三选一对话框

（每段贴 20-50 行关键代码 + 解释）

## 四、5 条反 Bug 铁律（核心价值）

（把 ITERATION-SOP.md 那 5 条逐条展开，每条配一个真实 Bug 案例）

- 铁律 1 真实浏览器演练 —— 举例：v1.11.10 三 Tab 显示空白
- 铁律 2 守卫表达式 —— 举例：window.sidebarTabsCtl 永远 false
- 铁律 3 CSS vs inline —— 举例：.active 干不过 display:none
- 铁律 4 rAF —— 举例：scrollToPath 在旧布局上算位置
- 铁律 5 用户视角 —— 举例：CHANGELOG 写得漂亮不等于能用

## 五、Quick Start & 下一步

Quick Start 3 行命令
v1.12 Roadmap（列几条计划中功能）

---

### 仓库地址

https://github.com/louisecxqiu-glitch/html-doc-center

⭐ 喜欢就 star，Issue / PR 都欢迎。
配套深度文章在公众号「一深思AI」同步更新。
```

---

## 🐦 X (Twitter) 短贴（英文为主，3 条推文串）

**类型**：Thread（3-5 tweets），第 1 条带图
**发布时机**：UTC 早 8-10 点（= 北京时间下午 4-6 点）覆盖欧美早高峰
**图片**：DocCenter 主界面 + 暗色模式 2 张并排

**Tweet 1**（hook + link，280 字内）：

```
Just open-sourced DocCenter 🚀

A local HTML workbench that saves me hours every day — browse, edit & annotate all those HTML reports Claude / ChatGPT / Cursor keep generating.

✅ Single Python file
✅ Zero npm deps
✅ Runs at localhost:9901
✅ MIT licensed

🔗 github.com/louisecxqiu-glitch/html-doc-center

🧵 1/3
```

**Tweet 2**（core features，280 字内）：

```
Why DocCenter?

Because after 1 year of AI-generated HTML flooding my disk, I got tired of:
• double-clicking to only view
• re-running prompts just to fix typos
• losing track of which version is the "good one"

So I built an IDE-like workbench that treats HTML as first-class editable docs.

2/3
```

**Tweet 3**（call to action + connect，280 字内）：

```
v1.11.11 is the accumulated result of 42 iterations, with 5 hard-won anti-bug rules documented in ITERATION-SOP.md.

Would love feedback, issues & PRs 🙏

⭐ Star if useful
📝 Full writeup: blog.csdn.net/qcx23
🔶 Chinese community: WeChat 一深思AI

3/3
```

**备选单推版本**（如果不想搞 thread）：

```
Open-sourced DocCenter — a local HTML workbench for AI-generated reports 🚀

✅ Single Python file, zero npm deps
✅ Browse/edit/annotate Claude artifacts & ChatGPT canvas HTML
✅ Auto-snapshot, 3-way save dialog, dark mode
✅ MIT

github.com/louisecxqiu-glitch/html-doc-center

[截图]
```

---

## 📋 发布 Checklist

在你说"发"之前，请先逐项确认：

- [ ] 仓库可公开访问（匿名访问 README 能渲染）
- [ ] GitHub About 区填好 Description + Topics + Website
- [ ] Release v1.11.11 已创建（从 v1.11.11 tag 生成）
- [ ] README 顶部三个 badge（WeChat / CSDN / X）都可点击跳转
- [ ] 公众号正文三张截图准备好
- [ ] CSDN 专栏已开好
- [ ] X 账号已登录可发

---

## ⚠️ 红线提醒

**按 memory 61777624：小红书内容绝对禁止未确认发布**
**按 memory 44904325：git push 红线已解除（已完成首推）**

公众号 / CSDN / X 虽不在红线文字内，但**对外发布属于不可逆操作**，仍然遵循 memory 11795829 的原则：
- 准备阶段：AI 做
- 发布阶段：Louis 拍板

请审完文案后，明确说：
- 「公众号这条发」
- 「CSDN 这条发」
- 「X 这条发」

或者你复制文案自己手动发也行。
