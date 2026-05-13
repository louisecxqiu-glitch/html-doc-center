# DocCenter 迭代 SOP

## ⚠️ 绝对铁律 0：所有迭代走 Superpowers

**本项目的任何迭代/新开发一律走 Superpowers Skills，不允许直接动手写代码。** 已有实操落地：`docs/superpowers/plans/2026-04-18-ux-refinement-v1.1.md` 是标准 plan 样本，v1.1 系列 changelog 就是按那份 plan 跑出来的。

**场景 → Skill 对应表：**

| 场景 | 必用 Skill |
|---|---|
| 多步任务/功能开发/架构变更动手前 | `brainstorming` → `writing-plans`（产出 `docs/superpowers/plans/YYYY-MM-DD-xxx.md`） |
| 已有 plan 要执行 | `executing-plans`（逐 Task/Step 勾 checkbox） |
| 实现功能或修 Bug | `test-driven-development` |
| Bug / 测试失败 / 行为异常 | `systematic-debugging`（禁止拍脑袋改） |
| 声称"完成/修好/能跑"之前 | `verification-before-completion`（跑命令贴输出） |
| 完成任务或合并前 | `requesting-code-review` |
| 收到 review 反馈 | `receiving-code-review` |

**4 条硬规矩：**

1. **无 plan 不动手**。多步任务必须先在 `docs/superpowers/plans/` 下建 plan，格式对齐已有文件（`Goal / Architecture / Tech Stack / File Structure 表 / Task N(Why + Files + Steps) / 验收标准`）。Bug 修复/1–2 行改动可走轻量流程，但也要先说清"问题/根因/解法"三段式。
2. **代码改动 = plan 勾选 + CHANGELOG 双写 + git commit（三写）**。缺一不可。
3. **完成声明前先 verify**。至少贴一次真实命令输出（`curl` / HTML 标签闭合校验等）。
4. **Plan 文件顶部约定**：`> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.`，任务用 `- [ ]` checkbox 追踪。

---

## ⚠️ 绝对铁律 1：代码改动必须同步 changelog + git commit（二写铁律）

> **v1.7.3 架构升级**：从"三写铁律"降为"二写铁律"。详见下方"为什么从三写降到二写"。

**本项目每次修改前端/后端代码（`web/*` / `server.py` / `saver-runtime.js`），都必须同时完成两件事：**

1. `CHANGELOG.md` — **唯一数据源**，人类阅读的纯文本版 + 浏览器访问时间轴页面的数据
2. **`git commit`** — 本地 git 历史必须跟上版本号

**不再需要维护 `CHANGELOG.html`**——v1.7.3 重构后，`/changelog` 路由返回壳子 HTML，前端用 `marked.min.js` 实时渲染 `CHANGELOG.md`。改 MD 即改时间轴。

### 为什么从三写降到二写？

**2026-05-02 · v1.7.3 架构重构**：用户问"为什么每次都要写一遍 HTML，可以做成动态加载吗"，一句话戳中架构问题。

原来 `CHANGELOG.md`（给人看）和 `CHANGELOG.html`（浏览器时间轴）是两份手写文件，同步完全靠自律，已发生多次漂移：
- v1.2-v1.4.2 曾发生过 CHANGELOG.html 漏同步
- v1.6.1 改完代码后 CHANGELOG.html 里还残留 `〔根〕` 字样给错误印象

本质是"用纪律对抗架构"，SOP 加铁律只是在加补丁，没解决根本问题。

**v1.7.3 解法**：
- `/changelog` 路由返回 `web/changelog-shell.html`（壳子 HTML + CSS + JS）
- 壳子里的 JS 异步 fetch `/api/changelog-raw` 拿 MD 原文，用 `marked.min.js` 转 HTML，按 `## [vX.Y.Z]` 切分成时间轴卡片
- `CHANGELOG.html` 删除（git 历史保留）
- 样式抽到独立的 `web/changelog.css`

从此 CHANGELOG 只有一份真相——**MD**。

### Pre-commit 自检（发布前必跑）

```bash
# 最新 git commit 的版本号必须 ≥ CHANGELOG 最新条目
git log --oneline -1
grep -E '^## \[v' CHANGELOG.md | head -1
```

两者版本号不一致 = 流程漂移，必须立即补 commit。

### 快速迭代合集的 commit 策略

同一天 3 次以上小修，允许合并为一个 commit（对齐 `v1.2.1 → v1.2.6` 这种 CHANGELOG 合集卡片），但**同一天结束前必须落盘，不过夜**。

---

## ⚠️ 绝对铁律 2：改代码后必须重启服务（2026-05-02 补加）

**修改 `server.py` 的任何一行代码，都必须 kill + nohup 重启服务**——前端改动可以 hard-reload 浏览器生效，但后端 Python 进程不会自动 reload 新代码。

### 为什么新增？

**2026-05-02 踩坑**：用户反馈"添加目录失败: Unexpected non-whitespace character after JSON at position 4"。追查根因——本地服务进程从 2026-04-27 周一下午跑到 05-02 周六，中间磁盘上的 server.py 已经经历 v1.3 / v1.4.0 / v1.4.1 / v1.4.2 四个版本迭代，但内存里跑的还是 v1.1 代码。碰到新格式 `[{path, enabled}]` 直接爆异常，aiohttp 返回 500 + 纯文本 body，前端 `r.json()` 就报了那个晦涩的 JSON 解析错误。

**一次重启值得留 5 天命案**——不重启 = 所有后续调试都在看幻觉。

### 重启标准流程

```bash
# 找到进程并优雅停止
ps aux | grep "server.py" | grep -v grep
kill <PID>

# 后台重启
cd /path/to/html-doc-center
nohup python3 server.py > /tmp/html-doc-center.log 2>&1 &

# 验证
curl -s -o /dev/null -w "status=%{http_code}\n" http://localhost:9901/
```

### 前端防御（v1.5.0 已实施）

即使用户忘了重启服务，前端 `safeFetchJson` 也会把"HTTP 500: Server got itself in trouble（可能需要重启 server.py）"这种可操作提示展示给用户，而不是让用户面对 `position 4` 这种天书。

---

## 版本号约定

| 类型 | 版本号 | 场景 |
|---|---|---|
| Major | v1.3 / v2.0 | 破坏性变更 / 重大能力新增 |
| Minor | v1.2 / v1.3 | 新功能、Feature 集合 |
| Patch | v1.2.1 / v1.2.2 | Bug 修复、UX 微调、精简 |

**高频迭代合并策略**：同一天内 3 次以上小修，可合并为 `v1.2.1 → v1.2.5` 这样的"快速迭代合集"卡片，避免时间轴被稀碎的 patch 淹没。

---

## Changelog 结构要求

每个版本卡片必须包含：
- **版本号 + 徽章 + 精确到分钟的时间**（如 `2026-04-18 · 13:16`）
- **一句话 Summary**：这版解决了什么核心问题
- **👤 用户故事段**（Feature 级变更必写，Patch 级 Bug 修复可豁免）—— 见下节
- **分类分组**：🎨 UX / 🔧 功能 / 🐛 Bug 修复 / 🔒 安全 / 📐 架构
- **重要修复必写三段式**：问题 / 根因 / 解法（方便未来回溯）

---

## ⚠️ 铁律 3：Feature 级变更必写「👤 用户故事」段（2026-05-13 v1.10.11 加）

**CHANGELOG 不能只有"功能+技术"——必须有"用户视角的故事"**。否则半年后翻 CHANGELOG 看到的是代码 diff 的自然语言版，不是产品叙事。

### 触发条件

- **必写**：任何新增功能、体验升级、UX 改造（Minor 版本 + Feature 级 Patch）
- **可豁免**：纯内部优化（性能 / 重构 / 架构调整，用户无感知）、纯 Bug 修复、文档修订

判断标准一问：**"这版用户能直接感知到吗？"** → 能 = 必写；不能 = 可跳过。

### 模板（四字段，放在 `> 引言` 之后、`### 改动` 之前）

```markdown
### 👤 用户故事

**场景**：<什么时候、什么情境下会遇到>
**之前**：<他之前怎么做、别扭在哪>
**现在**：<这一版之后他怎么做、顺在哪>
**一句话**：<一句话总结这版在用户视角的价值>
```

### 写作要点

1. **具体化**：不要写"用户想要更好的体验"，要写"凌晨 1 点还在改 deck"这种能画面化的场景
2. **对比化**：之前和现在要形成清晰落差，让"别扭 → 顺畅"的心理变化被感知到
3. **一句话要能独立发推**：拿出去当朋友圈文案、公众号 teaser、汇报开场白都不违和
4. **不要技术黑话**：`localStorage / debounce / CSS 变量` 这些留给下面的「改动」段；故事段说人话

### 违反后果

用户故事缺失的 Feature 级版本 = 产品叙事断档。发版时被发现要立刻补录。

### 反例（不写故事的样子）

```markdown
## [v1.10.10] — 暗色主题
- 新增 [data-theme="dark"] 调色板
- localStorage 持久化
- T 键切换
```
（纯功能清单，没告诉人"为什么要做这事"）

### 正例（见 v1.10.10 v1.10.9 v1.10.8 v1.10.7 v1.10.2）

都是先一段故事讲场景和价值，再往下列改动和技术决策。

---

## 违反后果

**变更文档漂移 = 信任崩塌**。用户点开 `/changelog` 看到的最新版本必须真实反映代码当前状态，否则这个 UI 就是个摆设。

如果 AI Agent 修改了代码但没同步 changelog，应该：
1. 立刻补录（按时间倒序）
2. 反思根因并加到经验库

---

## ⚠️ 铁律 4：5 条反 Bug 准则（来自 v1.11 复盘 · 2026-05-14 立）

> **背景**：v1.11 系列连续 10 轮自驱完成，但产生了 11 次 hotfix——其中 v1.11.10 / v1.11.11 是用户在浏览器里实测才发现的低级 bug。复盘后发现这不是技术问题，是验证流程问题。

### Bug 类型分布

| 类型 | 频次 | 典型案例 |
|---|---|---|
| **A · 自我验证不足** | 4 次（最严重） | v1.11.10 三 Tab 切换显示空白；v1.11.11 点收藏目录无反应；v1.11.5 清除按钮假动作 |
| **B · 守卫表达式错误** | 2 次 | `if (window.sidebarTabsCtl)` 永远 false（IIFE 内 const 没暴露到 window） |
| **C · CSS 优先级冲突** | 1 次但典型 | CSS `.active { display:block }` 干不过 inline `style="display:none"` |
| **D · 时序耦合** | 1 次 | DOM 切换后立刻 scrollToPath，需要 rAF 等布局完成 |
| **E · 沿用历史不当** | 多次 | 新交互没盘点已有快捷键冲突 |
| **F · 命名/格式假设** | 1 次 | regex 解析半结构化文件名漂移 |

### 5 条铁律（所有 web/* / saver-runtime.js 改动必须遵守）

#### 铁律 4.1 · 真实浏览器演练（Reality Check）

任何修改 `web/*` / `saver-runtime.js` 的版本，commit 前必须在浏览器里以**用户视角实际操作**一遍。

**最低演练标准**：
- 硬刷新（Cmd+Shift+R）
- 至少点 3 个核心交互（不是只看一眼"页面打开了"）
- 验收报告不能只贴 `curl 200`，必须描述"我在浏览器里点了 X，看到了 Y"

**反例**：v1.11.10 之前——curl 200 + read_lints 0 错误 → commit + tag → 用户一开就坏

**为什么 curl 不够**：curl 验证的是"数据可用性"，不是"用户体验"。CSS 优先级冲突、JS 闭包绑定、时序竞态 curl 全都看不到。

#### 铁律 4.2 · 守卫表达式必须显式验证作用域

写 `if (X)` 守卫前，必须确认 X 在该 scope 的**真实可见性**。

**反例**：
```js
// ❌ 错——sidebarTabsCtl 是 IIFE 内 const，window.sidebarTabsCtl 永远 undefined
if (window.sidebarTabsCtl) sidebarTabsCtl.activate("tree");
```

**正例**：
```js
// ✅ 对——直接用闭包内引用
sidebarTabsCtl && sidebarTabsCtl.activate("tree");
```

**规则**：
- IIFE 内的 const/let 不会出现在 window 上
- 跨闭包引用不要用 `window.X` 守卫，除非显式 `window.X = X` 暴露
- 写完守卫后 console.log 一次或读一次代码确认 scope

#### 铁律 4.3 · CSS 改 `.active` / `display` 前 grep inline style 残留

**CSS 优先级**：inline > id > class > tag

改新 class 控制显示前，必须先 grep 旧 HTML 是否有同名 inline style 残留——它会压住 CSS。

**反例**：v1.11.2 改 `.sidebar-pane.active { display: block }`，没注意 HTML 模板里 `style="display:none"` 的 inline 残留 → v1.11.10 才修。

**正例**：
```bash
# 改 CSS 前先 grep
grep -n 'style="display' web/index.html
# 删除 inline 或加 !important 应对
```

`!important` 是最后一招，不是默认招。

#### 铁律 4.4 · DOM 切换后的依赖动作必须用 requestAnimationFrame

任何"切换 display/class 后立刻读取 `getBoundingClientRect` / 滚动 / 高亮"的代码，必须用 rAF 等下一帧。

**反例**：
```js
// ❌ activate 改了 display，但下一行 scrollToPath 在旧布局上读位置
sidebarTabsCtl.activate("tree");
scrollToPath(p);
```

**正例**：
```js
// ✅ 等下一帧布局完成
sidebarTabsCtl.activate("tree");
requestAnimationFrame(() => scrollToPath(p));
```

#### 铁律 4.5 · 自驱模式 ≠ 跳过用户视角验收

用户说"自驱不要打断"指的是**不要发决策卡片**让他确认每个细节，不是免除最终的**用户视角验收**。

**判断**：
- 自驱可省略：开发决策 / 命名 / 实现细节
- 自驱不可省略：用户视角的真实演练（铁律 4.1）

**警告**：CHANGELOG 用户故事段写得越漂亮，越要在浏览器里真实验过——否则就是**文档自我催眠**。

---

## 违反后果（更新）

---

## 验证命令

```bash
# 检查 changelog 页面是否可访问
curl -s -o /dev/null -w "status=%{http_code}\n" http://localhost:9901/changelog

# HTML 结构完整性检查
python3 -c "
from html.parser import HTMLParser
class C(HTMLParser):
    def __init__(self): super().__init__(); self.stack=[]
    def handle_starttag(self,t,a):
        if t not in ('br','img','meta','link','input','hr'): self.stack.append(t)
    def handle_endtag(self,t):
        if t in ('br','img','meta','link','input','hr'): return
        if self.stack and self.stack[-1]==t: self.stack.pop()
        else: print(f'ERROR: {t}')
p=C()
with open('CHANGELOG.html') as f: p.feed(f.read())
print('OK' if not p.stack else f'UNCLOSED: {p.stack}')
"
```
