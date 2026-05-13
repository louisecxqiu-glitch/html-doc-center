# Changelog

本项目采用 [语义化版本](https://semver.org/lang/zh-CN/) 管理。

---

## [v1.11.11] — 2026-05-14 · 00:42 · Hotfix · 收藏/最近点击后切到目录 Tab + 修守卫 bug

> v1.11.10 修了 Tab 切换显示问题后用户实测：点击收藏里的目录条目"啥都没发生"。根因——目录树当前在隐藏 Tab，scrollToPath 在隐藏 DOM 上执行用户视觉零反馈。

### 👤 用户故事

**场景**：用户在收藏 Tab 看到"01-养虾系列"目录条目，点击想去那里浏览。

**之前**：点击收藏目录 → JS 调 scrollToPath 在隐藏的 .tree 上展开/滚动 → 用户当前视图还在收藏 Tab → **完全没看到任何变化**。同时收藏文件点击后虽然 iframe 加载了，但用户在收藏 Tab 看不到树里的高亮和邻近文件。

**现在**：
- 点收藏目录 → 自动切到「📁 目录」Tab → 等下一帧 → scrollToPath 展开高亮目标
- 点收藏文件 / 最近文件 → 自动切到「📁 目录」Tab → openFile 打开 + 树里看到当前文件高亮
- 收藏/最近 = "快速跳转入口"，落地点是目录树主战场

**一句话**：收藏点击有反馈了。

### 🐛 改动

| 问题 | 根因 | 解法 |
|---|---|---|
| 点收藏目录无反应 | scrollToPath 在隐藏树上执行 | 先 `sidebarTabsCtl.activate("tree")` + `requestAnimationFrame` 等 DOM 切换完再 scroll |
| 点收藏/最近文件后用户在收藏 Tab，看不到树高亮 | 没自动切 Tab | 同上，文件点击也切到目录 Tab |
| `if (window.sidebarTabsCtl)` 守卫永远 false | `sidebarTabsCtl` 是 IIFE 内 const 没暴露到 window | 改为 `sidebarTabsCtl && sidebarTabsCtl.activate(...)` 直接用闭包内引用 |

### 📁 改动

| 文件 | 改动 |
|---|---|
| `web/app.js` | renderFavoritesSection 点击事件：先切目录 Tab；renderRecentSection 同步处理；修复 `window.sidebarTabsCtl` 守卫 bug |

### 🤔 设计决策

- **为什么连点文件都自动切 Tab？** 我考虑过保持收藏 Tab（用户可能想继续点收藏），但实战中"打开文件"是终态动作，落到目录主战场看到高亮 + 邻近文件更符合后续工作流（再打开邻近文件）
- **为什么用 requestAnimationFrame？** activate() 切换 DOM display 不是同步立即生效，下一帧才完成布局；scrollToPath 内部用 getBoundingClientRect 必须等布局完成

---

## [v1.11.10] — 2026-05-14 · 00:35 · Hotfix · 三 Tab 切换 Bug + 底部 footer 隔离

> v1.11.2 引入三 Tab 切换后用户实测发现：(1) 切到「收藏」「最近」Tab 显示空白（即便有 2 条收藏 / 1 条最近）；(2) 「3 个根目录 · 3025 个文档 · 折叠所有文件夹」状态栏在所有 Tab 都显示——它只属于目录 Tab。本版本紧急修复。

### 👤 用户故事

**场景**：用户切到 ⭐ 收藏 (2) Tab 后看到空白页——明明 Tab badge 显示有 2 条数据。底部还顽固地写着"折叠所有文件夹"——但当前显示的是收藏，不是树。

**之前**：v1.11.2 的三个潜在 bug 集合爆发：
1. HTML 模板里的 `style="display:none"` inline style 优先级压住了 CSS 的 `.sidebar-pane.active`，导致 active 也无法显示
2. 切到非目录 Tab 时，`.sidebar-footer` 仍然显示给用户错觉"目录还在底下"
3. `.recent-section:empty` 规则在 recent 是 active Tab 但无数据时也会强制隐藏

**现在**：
- 删除 inline style，CSS 单独控制：`.sidebar-pane.active { display: block !important }` 强制压住任何遗留 inline 样式
- activate() 主动 `removeProperty('display')` 兜底清除 inline 残留
- `#sidebar[data-active-tab]` 数据属性同步切换，CSS 用它隔离 footer 和 search-stat 只在 tree Tab 显示
- `:empty` 规则限定为非 active 状态才生效

**一句话**：v1.11.2 立的三 Tab 信息架构现在真的工作了。

### 🐛 改动

| 问题 | 根因 | 解法 |
|---|---|---|
| 收藏/最近 Tab 空白 | `style="display:none"` inline 压住 CSS `.active` | 删 inline + 加 `.active { display:block !important }` |
| footer 在所有 Tab 都显示 | 没区分当前 Tab | `#sidebar[data-active-tab]` + CSS `:not([data-active-tab="tree"])` 隔离 |
| recent 空态时 active 仍隐藏 | `:empty` 规则太强 | 限定 `.recent-section:not(.active):empty` |
| activate 残留 inline style | JS 没清旧 style | activate() 内 `pane.style.removeProperty("display")` 兜底 |

### 📁 改动

| 文件 | 改动 |
|---|---|
| `web/index.html` | 删除 `favorites-section/recent-section` 的 inline `style="display:none"` |
| `web/style.css` | 加 `.sidebar-pane.active { display: block !important }`；`:empty` 规则限定 `:not(.active)`；`#sidebar:not([data-active-tab="tree"]) .sidebar-footer / #search-stat { display: none }` |
| `web/app.js` | sidebarTabsCtl.activate() 同步 `#sidebar` 的 `data-active-tab` 属性；主动清 inline `display` 兜底 |

### 🤔 设计决策

- **为什么用 data-active-tab 而非 class？** 多个状态值（tree/favorites/recent）用属性更语义化；CSS 选择器写 `:not([data-active-tab="tree"])` 比 `:not(.tab-tree-active):not(.tab-fav-active)` 更清晰
- **为什么不彻底删 `:empty` 规则？** 之前 recent-section 是固定显示的容器，空态隐藏避免占位是合理的；现在变成 Tab 后只需限定非 active 时仍生效（防止 favorites Tab 选中时把 recent-section 渲染但 :empty 隐藏带连锁影响）

---

## [v1.11.9] — 2026-05-14 · 01:25 · v1.11 收官（清除样式 Bug 修复 + 面包屑路径复制 + v1.12 Roadmap）

> 连续 10 轮自驱执行 v1.11 系列的最后一版。三件事：修一个 v1.11.5 留下的 bug、加一个细小但日常会用到的功能、把 v1.12 候选清单文档化沉淀。

### 👤 用户故事

**场景**：v1.11 一路冲刺加了 10 个功能，回头看发现 v1.11.5「更多排版菜单」里"清除"按钮其实并没有真的清除——传 null 给 `setProperty` 不报错也不工作。同时日常想分享文件路径给同事时还要去 Finder 复制，很别扭。

**之前**：清除按钮假动作（用户以为清了实际没清，靠 Ctrl+Z 兜底）；面包屑路径只能看不能用。

**现在**：
- **真清除**：选中带行高/字间距的文字 → 「更多」→「✕」→ 选区内**所有该属性 inline style 真删掉** + 空 style 标签整体移除
- **路径秒复制**：单击面包屑路径段 → 复制相对路径；按住 600ms → 复制绝对路径。Toast 反馈复制内容
- **v1.12 Roadmap**：`docs/superpowers/plans/2026-05-14-v1.12-roadmap.md` 沉淀候选清单（5 个 P1 高优先级 + 3 个 P2 + 备选 + 否决项）

**一句话**：v1.11 系列圆满收官，给 v1.12 留好接力棒。

### 🔧 改动

| 内容 | 文件 |
|---|---|
| 新增 `clearInlineStyleOnSelection(propName)` 函数：从选区往上找祖先链 + querySelectorAll 收集所有带该 prop 的元素，removeProperty + 清理空 style attr | `saver-runtime.js` |
| 「更多排版」菜单的清除按钮（`val=""`）现在调用 clearInlineStyleOnSelection 而不是传 null | `saver-runtime.js` |
| 面包屑路径段改为可点击 `.bc-path`，绑定 click（复制相对路径）+ mousedown 600ms 长按（复制绝对路径） | `web/app.js` |
| `.bc-path` 样式：默认半透明虚线下划，hover 变金色实线，active 蓝色 | `web/style.css` |
| 创建 `docs/superpowers/plans/2026-05-14-v1.12-roadmap.md`，含 v1.11 收官回顾 + v1.12 候选清单（P1/P2/P3） | docs |

### 📚 v1.11 系列总览

| # | 版本 | 主题 | 行数变更 |
|---|---|---|---|
| 1 | v1.11.0 | CHANGELOG 默认折叠 | +434 -6 |
| 2 | v1.11.1 | 富文本工具栏（色板+对齐+链接） | +232 -26 |
| 3 | v1.11.2 | 侧栏三 Tab 信息架构 | +276 -23 |
| 4 | v1.11.3 | 图片 Notion 式操纵 | +248 -3 |
| 5 | v1.11.4 | 元素位置微调 transform | +403 |
| 6 | v1.11.5 | 排版增强（行高/字间距） | +159 |
| 7 | v1.11.6 | 快照梯度稀释 | +172 -1 |
| 8 | v1.11.7 | 时光机快捷条 | +121 -1 |
| 9 | v1.11.8 | UI polish 合集 | +76 |
| 10 | v1.11.9 | 收官 | +N |

**累计**：约 2300 行新代码 + 11 个新版本 tag（含 v1.11.0 起所有子版本）

### 🤔 设计决策

- **为什么不直接重做 applyInlineStyleToSelection 支持清除？** 现有逻辑紧密耦合 v1.8 的 selection 保留机制（_savedRange 回写），改它风险大；新加 clearInlineStyleOnSelection 是更安全的"独立扩展"
- **为什么面包屑用单击/长按区分相对/绝对？** 不想加按钮污染视觉；用户 99% 想要相对路径（更短易读），偶尔需要绝对路径用长按是合理的"高级用法"
- **为什么先沉淀 roadmap 而不是直接做 v1.12？** 用户复盘 v1.11 实际使用情况后再决定 v1.12 范围更准确；现在写的 roadmap 是 brainstorming 输入

---

## [v1.11.8] — 2026-05-14 · 01:15 · UI polish 合集（目录数字精简 + 暗色搜索高亮 + 窄屏自适应）

> v1.11.0~7 一路狂奔加大功能后回头做一轮 polish，把视觉噪音和暗色主题下的对比度问题一次抹平。

### 👤 用户故事

**场景**：日常工作流里被这些"小毛刺"反复扎到——目录数字 (512)/(611)/(558) 喧宾夺主、暗色模式下搜索黄底太刺眼、笔记本上窗口拉窄时 Tab 文字挤成一团。每个单独看都不致命，加在一起就是体验粗糙感。

**之前**：（看 v1.11.x 截图就知道）目录树有一堆数字干扰焦点；暗色搜索时金黄 mark 像聚光灯；侧栏拉到 350px 宽时 Tab 数字 (2)(5) 撑出文字溢出。

**现在**：
- 目录数字默认 55% 透明度，hover 时升到 100%，**信息在但不抢戏**
- 折叠状态下数字完全隐藏，hover 才淡出 80% 透明——折叠树更清爽
- 暗色模式下 mark 高亮换成琥珀色低饱和（rgba 0.28 + #FBBF24 字色），不刺眼但仍可读
- 侧栏 < 380px 宽时 Tab 计数（如 "(5)"）自动隐藏 + 字号缩到 11px，避免溢出

**一句话**：把 v1.11 一路加进来的功能"盖上柔软的滤镜"，让日常使用更舒服。

### 🎨 改动

| 维度 | 之前 | 现在 |
|---|---|---|
| 目录数字（折叠时） | 始终可见，opacity 1 | 默认隐藏，hover 0.8 |
| 目录数字（展开时） | 始终可见，opacity 1 | 0.55，hover 1 |
| 暗色 mark.search-hit | rgba(255,215,0,0.45) 黑字 | rgba(255,215,0,0.28) 琥珀字 |
| 窄屏 Tab badge | 始终显示，可能撑爆 | < 380px 隐藏 + 缩字号 |

### 📁 改动

| 文件 | 改动 |
|---|---|
| `web/style.css` | `.tree-node.collapsed > .tree-dir-count` opacity 渐隐；暗色主题 `mark.search-hit` 覆盖；`@media (max-width: 380px)` Tab badge 隐藏 |

### 🤔 设计决策

- **为什么不直接删数字？** 用户截图明显希望"清爽"但数字本身有用——hover 时仍能看到，是"按需显示"的最优解
- **为什么暗色 mark 用琥珀色而非保持金色？** 金黄在暗底太刺眼（高对比反而干扰阅读）；琥珀色饱和度低，既能识别又不灼眼
- **为什么 380px 是窄屏阈值？** 实测侧栏宽度 < 380px 时 Tab 文字（"📁 目录" + "⭐ 收藏" + "🕐 最近"）开始挤；这个值留出微小余量

---

## [v1.11.7] — 2026-05-14 · 01:05 · 时光机快捷条（"回到 N 分钟前"）

> v1.10.2 历史抽屉显示完整快照列表，但用户的真实回滚诉求是"回到大概 5/10/30 分钟前"——不需要找到精确时间点，只要"那个时段的代表版本"。本版本在抽屉顶部加快捷条直达。

### 👤 用户故事

**场景**：写到 deck 第 5 页时手抖删了一段重要图表。意识到时已经又改了几分钟其他地方。Ctrl+Z 按了几次回不去——撤销栈早溢出了。

**之前**：打开历史抽屉，几十条快照按 mtime 倒序——猜哪条是"图表还在的版本"。点开几个预览才能定位，5 分钟过去了，心情已崩。

**现在**：打开历史抽屉 → 顶部蓝色「↩ 时光机」快捷条 → 点「5 分钟前」直接弹预览 → 看到图表回来了 → 点"恢复此版本"完事。**总耗时 10 秒。**

5 个档位覆盖最常用回滚场景：5 分钟前 / 10 分钟前 / 30 分钟前 / 1 小时前 / 1 天前。每个档位智能选择"最接近且不晚于该时间点"的快照（避免选到刚刚的快照）。

**一句话**：从"凭记忆找快照"升级成"按时间感觉直达"。

### 🪄 改动

- 历史抽屉 render() 顶部插入快捷条 `.history-quickbar`
- 5 档预设：5min / 10min / 30min / 1h / 1d
- 智能选择算法：`items.filter(it => it.mtime <= target).reduce(max)`——最接近且不超过目标时间
- 当前快照不足（如刚开始编辑没有 30 分钟前的）的档位**自动隐藏**
- 点击快捷按钮 = 打开预览（不直接 restore，避免误操作；让用户看一眼再决定）
- 蓝色品牌色（区别于 fav 金色 / 绿色成功色），title 提示具体到分钟

### 📁 改动

| 文件 | 改动 |
|---|---|
| `web/app.js` | HISTORY.render() 顶部新增 quickbar 渲染逻辑；按钮点击触发 preview() |
| `web/style.css` | `.history-quickbar / .history-quick` 蓝色胶囊按钮样式 |

### 🤔 设计决策

- **为什么是预览而不是直接 restore？** Restore 是不可逆操作（虽然 pre-restore 备份会兜底），让用户先确认"这是我要的版本"再 restore
- **为什么 5 个档位而不是 10 个？** 5 个覆盖 90% 场景；过多按钮会让快捷条变长稀释焦点
- **为什么按"≤target"选最近？** 用户说"5 分钟前"心理预期是"5 分钟前或更早一点的版本"，不是"5 分钟内最近的快照"
- **为什么自动隐藏不可用的档位？** 比如用户刚编辑 2 分钟，没"30 分钟前"，按钮显示出来点了无响应反而困惑

---

## [v1.11.6] — 2026-05-14 · 00:55 · 快照梯度稀释（避免时间线爆炸）

> v1.10.2 引入版本时间线后，写一小时产生 100+ 条快照（每停手 2 秒一条），抽屉翻不动。"过期清理"是按 N 天硬切，不解决密集问题。本版本引入"梯度稀释"——按时间远近不同密度保留。

### 👤 用户故事

**场景**：早上写了 3 小时 deck，下午想找早上的某一版回滚。打开历史抽屉——300 多条快照，密集得像噪点。

**之前**：滚动 3 屏才到 1 小时前，10 屏才到 3 小时前。每条相隔 5-10 秒，价值低。要找特定时点几乎不可能。

**现在**：在设置面板点「🪶 稀释密集快照」 → 服务端按梯度规则保留：
- 最近 10 分钟：**全保**（精确）
- 10-60 分钟：**每分钟保 1 条**（稀疏化 60×）
- 1-24 小时：**每小时保 1 条**（稀疏化 360×）
- \>24 小时：**每天保 1 条**（稀疏化 8640×）

**实测**：扫描 77 个 _auto-save 目录、98 条快照 → 移除 29 条 → 保留 69 条，时间线清爽且关键节点不丢。

**一句话**：从"快照淹没的时间线"升级成"按时间分辨率分级的版本树"。

### 🔒 安全保留

- pre-overwrite 备份**不参与稀释**（用户主动 overwrite 前的安全副本）
- pre-restore 备份**不参与稀释**（用户主动 restore 前的安全副本）
- 只稀释 auto 自动快照

### 📁 改动

| 文件 | 改动 |
|---|---|
| `server.py` | 新增 `sparsify_snapshots(cfg, return_stats)` 函数 + `handle_sparsify_snapshots` 接口；按源文件 stem 分组、按时间桶（10min/1min/1h/1d）保留每桶最新一条 |
| `web/index.html` | 设置面板加「🪶 稀释密集快照」按钮 + hint 解释规则 |
| `web/app.js` | 绑定按钮调用 `/api/sparsify-snapshots` 显示统计 |

### 🤔 设计决策

- **为什么是手动触发而不是自动？** 自动稀释会让用户感觉"我的版本在偷偷消失"——手动给用户掌控感
- **为什么 4 档梯度？** 对应人类直觉的"近-中-远-古"四级时间认知；更细的档位（如 5min/30min）边际收益低
- **为什么按桶保留"最新一条"而非"中位数"？** 每个桶的"最近修改"通常是该时段的代表性结果，比中位数更符合用户期待
- **为什么用源文件 stem 分组？** 不同源文件互不相关；不分组会导致跨文件互相竞争同一时间桶

---

## [v1.11.5] — 2026-05-14 · 00:42 · 排版增强（行高 + 字间距 + 代码/引用块）

> v1.11.1 富文本工具栏升级后还差三类高频排版：行高、字间距、代码块/引用块。本版本通过工具栏 ⋯「更多」按钮下拉菜单，三类一站式打开。

### 👤 用户故事

**场景**：在写技术文档 HTML，想把一段技术说明转成「代码块」（`<pre>` + 等宽字体）；正文段太挤想加点行高让阅读更舒服；某句金句想转成引用块强调。

**之前**：要么手写 HTML（破坏所见即所得心流）、要么不做。三类操作都没在工具栏。

**现在**：点 ⋯「更多」→ 弹出 3 组操作：
- **行高**：紧凑 1.0 / 舒适 1.5 / 宽松 1.8 / ✕ 清除
- **字间距**：紧凑 / 默认 / 宽松 / ✕
- **块格式**：⌨ 代码块 / ❝ 引用 / ¶ 普通段落

3 秒搞定。

**一句话**：从"基础富文本"升级成"准排版工具"。

### 📝 改动

| 文件 | 改动 |
|---|---|
| `saver-runtime.js` | 工具栏新增 `__dc_more` 按钮（⋯）；新增 `handleMoreMenu` 弹出菜单（3 组按钮）；新增 `applyBlockFormat` 用 `execCommand('formatBlock')` 切换块标签 |

### 🤔 设计决策

- **为什么塞进"更多"菜单而不是工具栏直接放按钮？** 工具栏空间已经吃紧（B/I/U + 字号 + 字色 + 高亮 + 4 对齐 + 链接 + Undo + Redo + 间距 + 批注），再加 7 个按钮会撑爆视觉
- **为什么行高/字间距用预设档位而不是滑块？** 滑块对应数字精度对普通用户没意义，3-4 个档位（紧凑/舒适/宽松）覆盖 90% 场景
- **为什么块格式用 execCommand('formatBlock') 而不是 wrapNode？** formatBlock 是浏览器原生支持，会处理嵌套 + undo/redo 注册，自己实现要踩很多边界 case

---

## [v1.11.4] — 2026-05-14 · 00:30 · 元素位置微调（transform translate 方案）

> 用户给的关键场景：养虾系列封面 HTML 里"路易乔布斯 © 2026"署名想往上移一点。当前编辑器只能改文字、改样式，**没法挪元素位置**。本版本引入"位置微调"模式——选中任意元素后用方向键/数字输入精确调位，0.1s 反馈。

### 👤 用户故事

**场景**：第 9 篇课堂型封面 HTML 已经基本好看了，但底部署名"路易乔布斯 © 2026"和上面的标题留白太大，想把它往上移 30px。

**之前**：要么改 CSS `margin-top`、要么改 `position: absolute` + `top` ——都要打开开发者工具或者保存后手 HTML。AI 生成的封面有 50+ 个嵌套 div，找到要改的那个 selector 都要 5 分钟。最后通常放弃，让封面就那样。

**现在**：Cmd 长按"路易乔布斯"那行 → 右上角弹出蓝色"📐 位置微调"卡片 → 按 ↑ 键 30 次 = 移动 30px（或 Shift+↑ 三次 = 30px）→ 满意松手 → 自动保存。**总耗时 5 秒。**

不爽？按 R 重置；不满意？拽 X/Y 数字微调；要清掉？点"🗑 清除位置偏移"——transform 完全归零。

**一句话**：从"改 AI 封面只能远观"升级成"想挪哪挪哪、像素精度"。

### 📐 改动

- **新增 ElementPositioner 模块**（IIFE 架构对齐 BlockSpacingEditor）
- **触发方式**：Cmd/Ctrl + 长按 300ms 任意 contenteditable 内的元素
  - 避开 v1.9.2 已用的 Alt+click（块间距）
  - 避开 v1.8.0 已用的 click（图片选中）
  - mousemove > 2px 自动取消（防误触）
- **核心策略：用 `transform: translate(X, Y)`**
  - 不改 margin/padding，**不破坏文档流，不挤跑别的元素**
  - 兼容已有 transform：parseTransform 保留 rotate/scale/skew 等其他变换
  - 只改 translate 部分；归零时不留空 `transform: ;`
- **交互三件套**：
  - **方向键盘按钮**：上下左右 + 中心 ⌖ 重置
  - **键盘快捷键**：↑↓←→ 1px / Shift+方向 10px / R 重置 / Esc 退出
  - **X/Y 数字输入**：直接敲数字，change 事件应用
- **元素描述**：popover 顶部显示当前选中的 selector（`div#abc.kicker.tag` 风格），最多 40 字符截断
- **dirty 集成**：每次 nudge / input change / clear 都触发 markDirty
- **保存清理**：serializeContent 中加 `#__dc_pos_popover` / `.__dc_pos_selected` / `style#__dc_pos_styles` 三处清理

### 🎯 交互细节

| 操作 | 行为 |
|---|---|
| Cmd 长按元素 300ms | 进入位置微调模式，蓝色虚线 outline + 右上 popover |
| 方向键 / dpad | ±1px 移动 |
| Shift + 方向键 | ±10px 大档位移动 |
| 输入 X/Y 数字 + Enter | 精确定位 |
| R 键 / 中心按钮 | 归零（保留其他 transform） |
| 🗑 清除按钮 | 同 R |
| Esc / ✕ | 退出微调模式 |

### 📁 改动

| 文件 | 改动 |
|---|---|
| `saver-runtime.js` | 新增 ElementPositioner IIFE 模块（约 300 行）；boot() 中 init；serializeContent 中清理 popover/class/style |

### 🤔 设计决策

- **为什么用 transform 而不是 margin？** transform 是合成层操作，不触发 reflow，**不挤跑兄弟元素**——AI 生成的精致布局最怕 margin 一改全乱
- **为什么 Cmd+长按而不是右键？** 右键被浏览器原生菜单占用，且强行覆盖体验差；长按是 Notion / Figma 通用范式
- **为什么 popover 固定在右上而不是跟随元素？** 元素被移动时 popover 跟着乱跳很烦；固定位置稳定可靠
- **为什么不做拖拽移动？** Cmd+长按已经定位精度足够，拖拽和图片拖拽冲突且实现成本高
- **为什么 mousemove 阈值 2px？** 用户长按时手会微抖；2px 是经验值，过小误触发，过大失灵敏

---

## [v1.11.3] — 2026-05-14 · 00:18 · 图片 Notion 式操纵（4 角 resize + 段内拖拽）

> v1.8.0 引入图片编辑后，能替换、能删除、能粘贴——**就是不能调尺寸、不能挪位置**。改封面时图片大了想缩一点，只能去原图工具处理完重新粘贴。这版补齐"所见即所得"的最后一块。

### 👤 用户故事

**场景**：养虾系列封面 HTML 里的龙虾插图太大，想缩到原来 60%；旁边那张二维码贴在标题下方，想挪到段落底部。

**之前**：右键图片只能"替换/删除"。要缩尺寸只能去图片工具改像素再粘贴回来——3 分钟流程。要换位置就更绝望了，只能保存后手动剪切 `<img>` 标签到新位置——还经常剪错。一次封面调整 5-10 分钟全花在这上面。

**现在**：点击图片 → 4 个金色圆 handle 出现在四角 → 拽右下角，图片随手缩，**保持宽高比**（按 Shift 解锁）；按住图片主体拖拽 → 同段内出现金色脉动 dropzone 提示位置 → 松手就位。**3 秒搞定一次调整。**

**一句话**：从"必须用外部工具"升级成"DocCenter 自己就是图片排版器"。

### 🖼 改动

- **4 角 resize handle**：选中图片时自动注入 4 个 12×12 金色圆点 + 白色描边，分别绑定 nw/ne/sw/se 4 个方向
- **拖拽 resize**：拽 handle → mousemove 实时算 dx/dy 更新 width/height；默认锁定宽高比（用主导轴），按 Shift 拖拽解锁自由变形
- **图片主体拖拽**：mousedown 在 img 主体（不是 handle）上 → mousemove 显示当前段内 sibling 上方/下方的金色脉动 dropzone → mouseup 用 insertBefore 实际移动 DOM
- **段内边界守护**：只在当前 `parentElement` 的 children 范围内移动，不跨段、不浮动
- **滚动同步**：window scroll 时 handles 跟着 popover 一起重定位
- **保存清理**：serializeContent 中加入 `.__dc_img_handle / .__dc_img_dropzone_*` 的剥离，**源文件不会被污染**
- **脏状态集成**：resize 完成（mouseup）和 drop 完成都触发 markDirty，走 USER_INTERACT_WINDOW_MS 机制保证 v1.2.4 三道护栏不退化

### 🎯 交互细节

| 操作 | 行为 |
|---|---|
| 点击图片 | 选中 + 4 角 handle + popover |
| 拽右下 handle | 等比缩放（保持宽高比） |
| Shift + 拽 handle | 自由变形（解锁宽高比） |
| 按图片主体拖拽 | 段内移动，dropzone 实时提示 |
| Esc | 取消选中，handles 全部消失 |
| 点击外部 | 同上 |

### 📁 改动

| 文件 | 改动 |
|---|---|
| `saver-runtime.js` | ImageEditor 模块新增 `renderHandles / clearHandles / startResize / startDrag / clearDropzones`；`selectImage / deselectImage` 集成 handles 和 dragHandler 生命周期；scroll listener 加入 handles 同步；serializeContent 新增 handle/dropzone 清理 |

### 🤔 设计决策

- **为什么默认锁宽高比？** 改封面图最常见诉求是"缩小一点保持比例"，自由变形会变形扭曲——锁定是合理默认，Shift 解锁是高级用法
- **为什么用 mousemove + insertBefore 而非 HTML5 drag API？** drag API 在 contenteditable 内行为诡异（图片本身就是 draggable），自己实现更可控
- **为什么 dropzone 是横线而非框？** 横线表达"插入到这里"语义清晰，比框更轻巧不打扰
- **为什么 handle 要 8×12px 这么小？** 太大遮挡图片本身，太小不易点击；12px + scale(1.3) hover 是平衡点

---

## [v1.11.2] — 2026-05-14 · 00:05 · 侧栏信息架构重构（三 Tab + 排序折叠 + 扫描根升级）

> v1.10.7 加 Recent Files 后侧栏挤兑加剧——⭐收藏 / 🕐最近 / 📁目录 三块挤一屏打架。排序选择器还独占一整行。本版本重构为「三 Tab 切换 + 排序折进按钮 + 扫描根视觉升级」。

### 👤 用户故事

**场景**：早上打开 DocCenter，想找养虾系列里的某个文件。

**之前**：侧栏顶部 ⭐ 收藏占两行，下面 🕐 最近又占四五行，再下面才是目录树——目录被挤到屏幕中下半部，要滚动才能看到 outputs 下面的子目录。`+` 添加目录按钮还在搜索框右边占着视觉权重（一个月用一次）。"排序"两字 + 整行下拉，光这一行就吃掉 44px。

**现在**：
- 顶部三 Tab 一字排开：「📁 目录」「⭐ 收藏 (2)」「🕐 最近 (5)」点击秒切，每块独占整个剩余空间，**目录从此拿到全屏**
- 排序折进搜索框右侧 `⇅` 按钮，点击弹出 2 项菜单（最近修改 / 名称），节省整整 44px
- `+` 添加目录搬到设置面板的"扫描目录"section（低频 → 该藏的就藏）
- 扫描根目录（`outputs` 这种顶级目录）加金色左竖条 + 浅金背景 + 加粗字号，**从子目录中视觉跳出来**

**一句话**：从"三块拥挤的便签"重构成"清晰的工作分区"。

### 📁 改动

| 文件 | 改动 |
|---|---|
| `web/index.html` | 删除 `.sidebar-toolbar` 整行排序；删除 `.btn-add-dir`；新增 `.sort-btn-wrap`(⇅ + 菜单) + `.sidebar-tabs`(三 Tab) + 给 favorites/recent/tree 加 `.sidebar-pane` |
| `web/style.css` | `.btn-sort / .sort-menu / .sort-menu-item / .sidebar-tabs / .sidebar-tab / .tab-count / .sidebar-pane / .tree-root` 新样式 |
| `web/app.js` | 新增 `sidebarTabsCtl` 模块（init/activate/refreshCounts）；排序逻辑重写为弹出菜单；loadFavorites/toggleFavorite/loadRecent 调用 refreshCounts；持久化当前 Tab 到 localStorage |

### 🎯 交互细节

- **Tab 持久化**：localStorage 键 `doc_center_sidebar_tab_v1`，刷新后保留选择
- **Tab 计数**：⭐(2) / 🕐(5) 这种 badge 只在有内容时显示，空集隐藏
- **排序菜单**：点 ⇅ 弹出，再点收起；点外部自动关闭；当前选项带 ✓
- **扫描根识别**：CSS 选择器 `.tree-node.tree-root > .tree-node-label`，与子目录视觉差异：左 3px 金条 + 浅金背景 + 加粗 + 13px 字号

### 🤔 设计决策

- **为什么是 Tab 而不是手风琴/上下分屏？** 用户 brainstorming 阶段拍板选 A（Tab），因为"目录是主战场"，Tab 让目录占满整个剩余空间最干净
- **为什么默认 Tab 是"目录"而非"最近"？** 高频度排序：目录 > 最近 > 收藏；目录是兜底入口（搜不到才翻树），不应让用户每次都点一下
- **为什么扫描根用浅金而不是浅蓝/浅灰？** 与 fav 金色（⭐）形成统一的"重要性指示色系"，整个 UI 中"金色 = 这是个主入口"
- **为什么 `+` 不直接删，要搬到设置面板？** 设置面板的"扫描目录" section 已经有完整的添加流程（路径输入 + 浏览 + 添加），不用重做

---

## [v1.11.1] — 2026-05-13 · 23:50 · 富文本工具栏升级（完整色板 + 对齐 + 链接）

> v1.8 引入字色后只放了 8 个固定预设，**没有白色**——改深色封面（养虾系列那种深蓝底）选不出可见的字色。同时缺对齐和链接，每次想居中或加超链接都得手写 HTML。本版本一次补齐三件套。

### 👤 用户故事

**场景**：改养虾系列第 9 篇课堂型封面，深蓝底。想把右下角"路易乔布斯"署名改成白字 + 加上公众号链接 + 居中对齐。

**之前**：选中文字点字色——8 色里没白。咬牙用"自定义颜色"调出白色，但每次重启都要重调一次（无最近使用记忆）。链接更绝望——只能保存后手动打开 HTML 文件加 `<a href>`。对齐？也要手 CSS。三个动作下来 5 分钟。

**现在**：点字色 → 14 色一行排开，白色第一个，点完搞定。下次再用 → 顶部"最近使用"自动留着白色，一秒命中。链接按钮 🔗 选中文字一点 → prompt 输入 URL → 自动补 https:// → 完成。对齐 4 个按钮一字排开，所见即所得。**3 个动作总耗时 < 30 秒**。

**一句话**：从"saver 是个简易写作器"升级成"能搞封面的轻量编辑器"。

### 🎨 字色完整方案

- **14 色预设**（两行）：
  - 第一行（黑白灰系 + 主色）：白 / 浅灰 / 中灰 / 深灰 / 墨黑 / 纯黑 / 金 / 浅黄
  - 第二行（彩色 6 色）：红 / 橙 / 绿 / 蓝 / 紫 / 粉
- **最近使用 6 色**：localStorage 键 `doc_center_recent_colors_v1`，自动去重前插
- **自定义颜色**：底部触发原生 `<input type="color">`，覆盖任意 RGB
- **白色边框反色**：白色/浅色 swatch 边框自动加深，避免在深底面板里"消失"
- **hover 缩放反馈**：鼠标悬停色板时 1.15× 微缩放，视觉确认

### ⬅⬆➡☰ 对齐 4 按钮

- 左对齐 / 居中 / 右对齐 / 两端对齐
- 用 `document.execCommand('justifyLeft' / 'justifyCenter' / 'justifyRight' / 'justifyFull')`
- 应用前先打开 `styleWithCSS=true`，确保生成 inline style 而非过时的 `align` 属性

### 🔗 链接按钮

- 选中文字 → 点击 🔗 → prompt 输入 URL → 应用
- URL 自动归一化：缺协议自动加 `https://`；保留 `mailto: / tel: / # / /` 前缀
- 编辑现有链接：光标在 `<a>` 内 → 点击 🔗 → prompt 显示当前 URL → 改/留空（清空=取消链接）
- 未选中文字时：alert 提示先选择

### 📁 改动

| 文件 | 改动 |
|---|---|
| `saver-runtime.js` | `showColorPalette` 重写：分行布局 + 最近使用 + 自定义；新增 `getRecentColors / pushRecentColor`；工具栏 DOM 加 4 个对齐按钮和 1 个链接按钮；新增 `handleLinkButton / normalizeUrl`；click handler 路由对齐和链接 |

### 🤔 设计决策

- **为什么是 14 色而不是 24 色？** 工具栏空间有限，14 色覆盖"常见封面 + 文章正文"99% 场景。剩余 1% 用"自定义颜色"兜底
- **为什么 mousedown preventDefault 沿用 v1.8.1 机制？** 选区保留是字色/链接共用基础设施，不重新发明
- **为什么链接用 prompt 而不是浮动弹窗？** prompt 零工程量、跨浏览器一致；浮动弹窗需要更多代码量但收益不大

---

## [v1.11.0] — 2026-05-13 · 23:40 · CHANGELOG 默认折叠（最新展开）

> v1.10.11 写出"👤 用户故事"段后，每个版本卡片的信息密度立刻变大——一个版本就占一屏多。看 11 个版本要滚 12 屏，拿不到版本全貌。本版本改为"默认折叠、按需展开"。

### 👤 用户故事

**场景**：想快速扫一遍 DocCenter 最近 1 个月做了什么，打开 /changelog。

**之前**：滚了 12 屏才到最早的 v1.10.0。每版都被用户故事/改动/设计决策撑得老长。想找某个特定版本要用 Cmd+F，版本全貌看不到。

**现在**：打开 /changelog 一屏能看到 6+ 个版本号 + 每版一句话引言。最新版默认展开可看详情，其他想细看就点击头部。顶部还有"全部展开/全部折叠"快捷按钮，适合"一口气读完所有"的场景。

**一句话**：从"读长文"变成"翻目录"，找版本的效率 ↑10×。

### 📝 改动

| 文件 | 改动 |
|---|---|
| `web/changelog-renderer.js` | 第一段 blockquote 抽为 `.release-preview`；其余放入 `.release-body`（可折叠）；顶部新增 `.changelog-toolbar` 含"全部展开/全部折叠"；`.release-head` 点击切换 `.collapsed` class |
| `web/changelog.css` | `.changelog-toolbar / .cl-btn / .release-caret / .release-preview / .release.collapsed .release-body` 新样式；箭头旋转过渡 |

### 🎯 交互细节

- **默认状态**：最新版本（列表第一条）展开；其他全部折叠
- **折叠时可见**：版本号 + 徽章标题 + 日期 + 引言（`> ...`）
- **折叠时隐藏**：用户故事、改动清单、设计决策、表格
- **展开方式**：点击版本头部任意位置（光标变手指）；或顶部"全部展开"按钮
- **箭头反馈**：▼ 表示展开，▶（rotate -90°）表示折叠，0.2s 平滑旋转

### 🤔 设计决策

- **为什么 preview 里只放第一段 blockquote 而不是前几行？** blockquote 语义明确是"一句话引言"，CHANGELOG 模板已经固化，规则稳定；按"前 N 行"会把下一段标题也带进来
- **为什么最新版默认展开？** 用户打开 /changelog 最常见目的就是"看新版本做了什么"，默认折叠最新版会多一次无意义点击
- **为什么不做 localStorage 持久化用户展开状态？** 每次内容会变（新版本发布），持久化状态会让"旧版展开状态"和"新版"错位；每次打开是一致的初始态更可靠

---

## [v1.10.11] — 2026-05-13 · 23:20 · CHANGELOG 规范升级：新增「👤 用户故事」段

> 之前 CHANGELOG 以"功能列表 + 技术决策"为主，读起来更像代码 diff 的自然语言版。但用户（包括半年后的自己）真正想知道的是："这版在我身上解决了什么场景？之前多别扭，现在多顺畅？"——本版本把这层叙述正式补上。

### 👤 用户故事

**场景**：半年后想复盘 DocCenter 都做了什么、为什么这么做，翻 CHANGELOG。

**之前**：看到一堆"新增 X / 修改 Y / 复用 Z"。知道了做了什么，但没感觉"这事儿解决了我哪个真实痛点"。想写公众号或者汇报都得自己再翻译一遍。

**现在**：每个重要版本开头都有场景化叙事："凌晨 1 点还在改 deck、系统早切暗色了……" 读 30 秒就 get 到这版的产品价值。写文章/汇报直接能抄。

**一句话**：CHANGELOG 从开发日记升级成产品叙事。

### 📝 改动（文档 only，零代码变更）

- 回溯补写 5 个用户感知最强的版本用户故事：
  - `v1.10.2` 版本时间线（误覆盖救急）
  - `v1.10.7` Recent Files（今天的工作桌面）
  - `v1.10.8` 搜索升级（从"知道名字"到"知道片段"）
  - `v1.10.9` 面包屑元信息（打开第一秒的新鲜度判断）
  - `v1.10.10` 暗色主题（深夜不再被手电筒晃眼）
- 新增 `ITERATION-SOP.md` 规则：**重要版本必写「👤 用户故事」四字段模板（场景 / 之前 / 现在 / 一句话）**
- Patch 级小修（如 v1.10.4 纯 bug 修复）可豁免

### 📐 模板规范

放在版本卡片中 `> 一句话引言` 之后、`### 改动` 之前：

```markdown
### 👤 用户故事

**场景**：<什么时候、什么情境下会遇到>
**之前**：<他之前怎么做、别扭在哪>
**现在**：<这一版之后他怎么做、顺在哪>
**一句话**：<一句话总结这版在用户视角的价值>
```

### 🤔 设计决策

- **为什么是四字段而不是自由叙述？** 自由叙述容易写成"版本介绍"，四字段强迫对比"之前 vs 现在"，天然带出价值感
- **为什么不回溯全部 11 个版本？** Patch（v1.10.1 / v1.10.4）是内部优化，用户无感知，硬补会稀释；只回溯"用户能感知的 Feature 级变更"
- **为什么把这条升级成 SOP 铁律？** 文档漂移的根因永远是"不写在规则里"——memory 42791044 已经教训过一次

---

## [v1.10.10] — 2026-05-13 · 07:22 · 暗色主题（auto / light / dark）

> 用户每天用 8h+，深夜也用，光感受影响很大。本版本加暗色主题，三态切换（自动/浅色/深色），默认跟随系统。

### 👤 用户故事

**场景**：凌晨 1 点还在改 deck，系统早切暗色了，但 DocCenter 顶栏和侧栏还是一片亮米色——每次从 VSCode 切过来眼睛都要重新适应一下。

**之前**：只能硬看，或者干脆关掉 DocCenter 用 Finder 找文件。用了半年，每个深夜都膈应一下。

**现在**：系统一暗它跟着暗。白天写作要高对比就按 `T` 切浅色，演示给别人看就按 `T` 切回自动。**不打断心流**——没有弹窗、没有设置页、没有刷新。

**一句话**：深夜开 DocCenter 不再像被打了一束手电筒。

### 🌓 改动

- **三态切换**：`auto`（跟随 `prefers-color-scheme`）→ `light` → `dark` → `auto`
- **顶栏按钮**：🌓 图标，按钮文字随状态切换（🌓→☀️→🌙→🌓），title 提示下一态
- **键盘快捷键**：`T` 一键循环
- **localStorage 持久化**：键 `doc_center_theme`
- **早期恢复**：`<head>` 内 inline script 在 CSS 加载前就设置 `data-theme`，避免页面闪烁（flash-of-unstyled-theme）
- **暗色调色板**：`--bg #14171D` / `--bg-card #1B1F27` / `--text-1 #E5E7EB` / 金色强调 `--gold #D9B97A`
- 暗模式下阴影加深、功能色柔化（red / amber / green 略调亮以保持对比度）

### 📁 改动

| 文件 | 改动 |
|---|---|
| `web/index.html` | `<head>` 加早期主题恢复脚本；顶栏新增 `#btn-theme` 按钮 |
| `web/app.js` | `applyTheme(theme, silent)` 函数；点击按钮 + T 快捷键 + 帮助浮层新增一行 |
| `web/style.css` | `[data-theme="dark"]` 覆盖调色板；`@media (prefers-color-scheme: dark) [data-theme="auto"] {…}` 跟随系统；`#btn-theme` 样式 |

### 🤔 设计决策

- **为什么默认 auto 而不是 light？** 尊重系统设定比强制亮色更友好
- **为什么三态而不是两态？** 两态（亮/暗）要么破坏系统偏好，要么不给手动覆盖能力；三态是最合理的折中
- **为什么不改 iframe 内文档？** 那是用户的内容，不应被强制反色；DocCenter 只管外壳
- **早期恢复脚本为什么不放在 app.js？** `defer` 脚本在 DOM 渲染后才执行，会有一瞬间的"白闪"——必须同步 inline 在 `<head>`

---

## [v1.10.9] — 2026-05-13 · 07:18 · 面包屑文件元信息

> 之前面包屑只显示「文件名 + 路径」，但用户经常想知道：这文件多大？什么时候改的？还有几个历史快照可以恢复？散落在不同入口里。本版本把核心元信息直接打到面包屑上——无须点击，一眼可见。

### 👤 用户故事

**场景**：打开一个叫 `运营汇报deck.html` 的文件，第一反应想知道：这是我昨天改的还是前天改的？还是三个月前的旧版本？

**之前**：要么去 Finder 看修改时间，要么点 🕐 打开历史抽屉翻时间——两次跳转才能确认"哦这是最新的"。而且根本不知道有没有快照可以回滚。

**现在**：面包屑一行解决："📦 25 KB · 🕐 2 小时前 · 🗂 3 个快照"。**判断文件新鲜度和安全感同时到位**。🗂 直接可点，想回滚一键进入时间线。

**一句话**：打开文件的第一秒就知道"我在哪、它新不新、有没有后悔药"。

### 🔍 改动

- 面包屑右侧新增 `· 📦 大小 · 🕐 修改时间 · 🗂 N 个快照`
- 大小格式化：B / KB / MB / GB（保留 1-2 位小数）
- 修改时间用相对时间（复用 v1.10.7 的 `formatRecentTime`）
- 快照数是个**可点链接**——点击直接打开历史版本抽屉（HISTORY.open）
- 数据来源：复用 `/api/history`（已含 `current_size / current_mtime / items[]`），**零后端改动**
- 路径切换守护：异步 fetch 期间用户切换到下一个文件，丢弃过期响应（`state.currentFile.absPath !== node.abs_path` 时直接 return）

### 📁 改动

| 文件 | 改动 |
|---|---|
| `web/app.js` | `openFile` 中加 `fetchFileMeta` 异步填 `#bc-meta`；新增 `formatBytes` 工具函数 |
| `web/style.css` | `.bc-meta` + `.bc-snap`（金色虚线下划链接） |

### 🤔 设计决策

- **为什么不做信息抽屉？** 元信息高频但低密度，开抽屉成本高；面包屑就是它最自然的家
- **为什么复用 history 接口？** 减表面积——只用一个 endpoint 就解决了大小/快照数/修改时间三件事

---

## [v1.10.8] — 2026-05-13 · 07:15 · 搜索体验升级（路径片段 + 命中高亮 + 匹配数）

> 之前的搜索只匹配「文件名」，但用户常常记得"养虾系列"想搜，文件名却叫"08-课堂型.html"——这种"知道分类不知道文件名"的场景搜不出。同时没有"匹配几个"的反馈，输入完不知道有没有用。

### 👤 用户故事

**场景**：要找一个养虾系列第 8 篇的封面 HTML。只记得分类是"养虾系列"，文件名完全记不清——它可能叫 `cover.html`、`08.html`、`第八篇.html`……

**之前**：敲"养虾"搜——空的。敲"cover"——跳出 20 多个 cover.html 分不清哪个。最后放弃搜索，回去一层层点目录。

**现在**：敲"养虾"，路径含"养虾系列"的文件全部亮出来，底下写"14 个匹配"——心里有底。敲"08"，文件名带 08 的字符被金色高亮，**眼睛不用在列表里扫**，直接跳到想要的那行。

**一句话**：从"知道名字才能搜"升级成"知道任意片段就能搜"。

### 🔍 改动

- **匹配范围**：从「文件名」扩到「文件名 + 完整路径」（`dataset.file` 也参与 includes 判断）
- **命中高亮**：文件名中匹配的字符用 `<mark class="search-hit">` 包裹，金色背景 + 加粗（路径命中不高亮，避免 mark 太密）
- **匹配数显示**：搜索框下方实时显示「N 个匹配」或「无匹配」（红字）
- **placeholder 更新**：「搜索文件名…」→「搜索文件名/路径…」

### 📁 改动

| 文件 | 改动 |
|---|---|
| `web/app.js` | `applySearchFilter` 重写：清旧 mark → 双字段匹配 → 文件名高亮 → 写入 `#search-stat` |
| `web/index.html` | 搜索框下方新增 `<div id="search-stat">`，placeholder 更新 |
| `web/style.css` | `.search-stat` + `.search-stat.no-match` + `mark.search-hit`（金色 highlight） |

### 🤔 设计决策

- **为什么路径命中不也高亮？** 路径深、字符多，全高亮反而干扰；只在最显眼的文件名上加 mark
- **为什么不做内容搜索？** 内容搜索要遍历 HTML 内文，性能/工程量大，留给后续版本（DocCenter v1.11 候选）

---

## [v1.10.7] — 2026-05-13 · 07:10 · 最近打开 Recent Files

> 收藏（fav）解决"长期想保留的入口"，但每天工作流里大部分时间是在 3-5 个文件之间快速切换。新增「🕐 最近打开」分组（仅 localStorage，不动后端），最近 10 条按时间倒序，hover 显示 × 移除，header 「清空」一键归零。

### 👤 用户故事

**场景**：今天在写养虾第 8 篇，要在"封面.html"、"正文.html"、"效果图.html"三个文件之间来回切，大概每 30 秒一次。

**之前**：每次都要去深层目录里点——`outputs/01-养虾系列/images/08-cover.html`。三层点击、鼠标移动半屏、注意力被打断。收藏（⭐）又不想用——这只是今天工作流，明天就不管它了。

**现在**：三个文件只要打开过一次，就静静趴在侧栏顶部「🕐 最近打开」里。30 秒切一次 = 30 秒点一下最近分组 = 零思考成本。明天换项目了就按"清空"一键归零，干净如初。

**一句话**：⭐ 是长期书签，🕐 是今天的工作桌面——各司其职。

### 🕐 功能

- 侧边栏顶部新增 `#recent-section`，位于 ⭐ 收藏之下、目录树之上
- **去重 + 前插**：再次打开已在列表的文件，自动移到首位（不重复占位）
- **最多 10 条**：满了自动淘汰最早一条
- **相对时间**：刚刚 / N 分钟前 / N 小时前 / N 天前 / 月/日（近一周内更精确）
- **空态隐藏**：列表为空时整个 section 不显示（CSS `:empty { display: none }`），不抢占视觉空间
- **localStorage 持久化**：键 `doc_center_recent_v1`，刷新/重启后仍在
- **会话恢复时也记录**：F3 自动回到上次打开的文件，也算一次「最近」（用户视角是真的回到了它）

### 📁 改动

| 文件 | 改动 |
|---|---|
| `web/app.js` | 新增 `recentGet/Save/Add/Remove/Clear` + `formatRecentTime` + `renderRecentSection` + `loadRecent`；`openFile` 中调用 `recentAdd`；`init` 中调用 `loadRecent` |
| `web/index.html` | 侧边栏新增 `<div id="recent-section">` |
| `web/style.css` | `.recent-section / .recent-header / .recent-item / .recent-time / .recent-remove` 等样式（蓝调，与金色 fav 区分） |

### 🤔 设计决策

- **为什么走 localStorage 而不是后端？** 个人工作流的"最近"是单机概念，没必要跨设备同步；省一次 round-trip
- **为什么不复用 fav 样式？** 视觉上要区分「⭐ 长期入口」和「🕐 短期入口」，颜色用蓝调（fav 用金）
- **为什么默认显示而不是折叠？** 高频功能不应该藏在二级菜单里，但空态自动隐藏避免干扰首次使用

---

## [v1.10.6] — 2026-05-13 · 01:25 · 快照管理面板 + iframe 加载失败兜底

### 🗂 快照管理（设置面板新 section）

- **快照保留天数**：下拉选 3/7/14/30/90 天（默认 7，同时持久化到 config）
- **🧹 立即清理过期快照**按钮：手动触发 + 返回统计
- 后端新增 `POST /api/cleanup-snapshots` → `{ok, scanned_dirs, removed, retention_days}`
- 实测扫描 67 个 `_auto-save` 目录仅 30ms

### ⚠️ iframe 加载失败兜底

**问题**：如果文件被删除 / >100MB / server 异常，iframe 会一直转圈，用户不知道怎么办

**修复**：
- 打开文件后启动 **12 秒超时计时器**
- 若到期未收到 saver-runtime 的 `ready` 消息 → 显示覆盖层
- 覆盖层内容：⚠️ 大图标 / 文件名 / [↻ 重试] [关闭] / 4 条可能原因提示
- 收到 `ready` 消息时自动清 timer + 隐藏覆盖层
- iframe `onerror` 也直接触发兜底

### 📁 改动

| 文件 | 改动 |
|---|---|
| `server.py` | `cleanup_old_snapshots(return_stats=True)` + `handle_cleanup_snapshots` + 路由 |
| `web/app.js` | 设置面板 retention select + 清理按钮绑定；`showIframeFallback` + 12s 超时 + ready 时清理 |
| `web/index.html` | 设置面板新 section "🗂 自动快照管理" |
| `web/style.css` | `.iframe-fallback-card` 等样式 |

---

## [v1.10.5] — 2026-05-13 · 01:10 · 键盘快捷键体系（H / R / / / ?）

> 之前 ⌘B / ⌘= / ⌘0 等 Mod 键快捷键散落各处，但没有"快捷键发现机制"，且新加的 v1.10.2 历史抽屉也没快捷键。本版本统一整理 + 加帮助浮层。

### ⌨️ 新快捷键（裸字母键，输入框内不触发）

| 键 | 动作 |
|---|---|
| `H` | 打开历史版本抽屉（需先打开文件） |
| `R` | 刷新目录树 + 刷新当前文件 |
| `/` | 聚焦搜索框（自动唤出侧栏） |
| `?` | 显示快捷键帮助浮层 |

### 🛠 新顶栏按钮

- ⌨️ 帮助按钮（hover tooltip "键盘快捷键（?）"）

### 🪟 新弹窗：快捷键帮助

- 居中卡片，分三组：侧边栏/视图、导航/操作、帮助
- 每行 `<kbd>` 样式按键 + 描述
- 底部黄色提示："输入框里输入时裸字母键不会触发，正常打字"
- Esc 关闭

### 🔒 输入保护

所有裸字母键（H/R/?）handler 都先检查 `e.target.matches('input,textarea,select,[contenteditable=true]')`——输入框内不触发，避免影响打字。

---

## [v1.10.4] — 2026-05-13 · 01:00 · 自动刷新插入位置精确化（v1.10.0 已知坑修复）

> v1.10.0 CHANGELOG 写过的坑："diff 新增节点保守追加在父目录末尾，mtime_desc 排序时新文件应在前但显示在末尾，需要手动按 🔄 修正"。本版本修。

### 🔧 改动

`diffTreeAndPatch` 新增节点的插入算法升级：

- **改前**：`appendChild`（永远插到末尾）
- **改后**：在 `newFlat` 父级 `children` 数组里查找新节点的 idx，往前找最近一个**已经在 DOM 里**的兄弟，插入到它之后；如果是 idx=0 直接插到最前
- 这样无论 sort_by 是 `mtime_desc`（最新在前）还是 `name_asc`（按名升序），新节点都精确出现在正确位置

### 📐 算法

```
对每个新增节点 p:
  parentNode.children = [c0, c1, ..., cN]  (服务端已按 sort_by 排好)
  myIdx = children.findIndex(c => c.path === p.path)

  if myIdx == 0: insertBefore(parentContainer.firstChild)
  else:
    for i in [myIdx-1, ..., 0]:
      prevEl = querySelector data-path=children[i].path
      if exists: insertAfter(prevEl); break
    else: insertBefore(firstChild)
```

之前小坑修复，无需手动按 🔄 即可保持正确顺序。

---

## [v1.10.3] — 2026-05-13 · 00:50 · 行级 diff + pre-restore 类型识别

> v1.10.2 留了两个尾巴：(1) server 不返回 `pre-restore` kind，前端只能从 name 推断；(2) 历史卡片只显示 size_delta（"+1 B" 这种粒度太粗）。本版本用 Python 自带 `difflib`（零新依赖）补齐行级 diff，让用户在抽屉里直接看到"+12 行 / -3 行"。

### 🔧 改动

- **server.py**:
  - `handle_history` 现在认 `pre-restore` 前缀，返回三种 kind（auto / pre-overwrite / pre-restore）
  - 新增 `GET /api/history/diff?path=<snap>&source=<src>` — 用 `difflib.unified_diff` 算行级 diff，返回 `{lines_added, lines_removed, lines_total_old, lines_total_new, hunks: [前 5 段头]}`
- **web/app.js**:
  - 新增 `loadDiff(itemEl, snapPath)` — 渲染历史卡片后异步拉每条 diff，回填到 DOM
  - 行内显示 `· +12 行 -3 行`（绿/红着色），无差异时显示"行内容相同"
- **web/style.css**: `.history-diff-add / del / eq` 配色

### 🔍 验证

```bash
curl -s --get http://localhost:9901/api/history/diff \
  --data-urlencode "path=/.../snapshot.html" \
  --data-urlencode "source=/.../current.html"
# → {"ok":true,"lines_added":0,"lines_removed":1,
#    "lines_total_old":1213,"lines_total_new":1212,
#    "hunks":[{"header":"@@ -1211,3 +1211,2 @@","added":0,"removed":1}]}
```

### 📊 性能

`difflib.unified_diff` 对 1200 行的 HTML 文件耗时 < 30 ms，在浏览器异步并发拉取时（每个抽屉条目独立 fetch），用户感知 < 100 ms。

### 🔮 Out of Scope

- 字符级 inline diff（diff-match-patch.js）— 行级足够 80% 场景；inline 加上后视觉更精细但首屏渲染负担更大
- diff 在预览 modal 里 split-view 着色 — v1.11+

---

## [v1.10.2] — 2026-05-13 · 00:30 · 版本时间线 MVP（History Drawer）

> v1.8.2 roadmap 把"版本时间线 + diff"列为最推荐路径但一直没做。当前 `_auto-save/` 目录在跑（每次停手 2s 自动快照 + 覆盖前自动备份 + 7 天保留），但用户**永远看不到**——误覆盖只能去 Finder 翻文件夹。本版本把"快照存在但用不上"的 G2 短板补齐。

### 👤 用户故事

**场景**：在封面 HTML 上调颜色，改了十几版，突然发现 20 分钟前那版最顺眼。

**之前**：只能靠感觉 Ctrl+Z 往回按，但按多了跳过了又回不来。或者打开 Finder 手动去 `_auto-save/` 目录里翻文件名带时间戳的快照——打开、对比、复制、粘贴，像考古。每次误覆盖都在骂自己"早知道手再轻一点"。

**现在**：顶栏点 🕐（或按 H），右侧抽屉滑出一条时间线："3 分钟前 · 12 KB"、"20 分钟前 · 11 KB"、"1 小时前 · 10 KB"。点一条预览，满意就按"恢复此版本"——**恢复前还会再存一份当前状态作保险**。心理负担直接归零。

**一句话**：自动快照从"后台黑盒"变成"所见所得的时光机"。

### 🔧 新功能：历史版本抽屉

- **顶栏 🕐 按钮**：打开当前文件后启用，关闭后禁用
- **右滑抽屉**：列出该文件所有快照（按 mtime 倒序）
  - 每条带：精确时间 + 相对时间（"3 分钟前"）+ 大小 + 与当前的 size 差
  - 类型徽章：🔵 自动快照 · 🟡 覆盖前备份 · 🌸 恢复前备份
  - 双按钮：[👁 预览] [↩ 恢复]
- **预览窗口**：iframe `srcdoc` 隔离渲染历史版本（只读，不污染源文件），1100px 宽，最高 70vh
- **一键恢复**：二次确认 → POST `/api/restore` → 服务端先把当前内容备份成 `pre-restore` 快照再覆盖
  - 关键设计：**恢复操作本身可撤销**——下次打开抽屉，能看到 `pre-restore` 类型的备份，点恢复即回到原状

### 📐 新增 API

| 端点 | 说明 |
|---|---|
| `GET /api/history?path=<src>` | 返回 `{ok, items: [{snapshot_path, name, kind, size, mtime, size_delta}], current_size, current_mtime}` |
| `GET /api/history/content?path=<snap>` | 返回快照的原始 HTML/MD 内容；仅允许 `_auto-save/` 内文件，双重路径校验（scan_roots + parent.name） |
| `POST /api/restore {snapshot_path, source_path}` | 校验 stem/suffix 关联 → pre-restore 备份 → 覆盖源文件 → 清缓存 |

### 🔒 安全闸

- `_resolve_safe()` 校验所有路径在 `scan_roots` 之内
- `/api/history/content` 额外校验 `parent.name == "_auto-save"`，防止"伪造路径偷读任意文件"
- `/api/restore` 校验 snapshot 与 source 同后缀 + snapshot.name 必须以 `source.stem + "-"` 开头，防止跨文件张冠李戴

### 🔍 端到端验证

```bash
# 1. 列表
curl -s --get "http://localhost:9901/api/history" --data-urlencode "path=/path/to/file.html"
# → {"ok":true,"items":[{"kind":"auto","size_delta":+1,...}], "current_size":1284024}

# 2. 内容
curl -s --get "http://localhost:9901/api/history/content" --data-urlencode "path=/path/to/_auto-save/xxx.html"
# → {"ok":true,"name":"...","content":"<!DOCTYPE html>...","size":1284025}

# 3. 安全：拒绝非 _auto-save 路径
# → {"ok":false,"error":"仅允许 _auto-save 内文件"}

# 4. 安全：拒绝 scan_roots 之外（/etc/passwd）
# → {"ok":false,"error":"非法路径"}

# 5. 恢复（mock 验证）：
#    源文件 "VERSION_NEW" + 快照 "VERSION_OLD" → POST /api/restore
#    → 源文件变 "VERSION_OLD"，pre-restore 备份保存了 "VERSION_NEW"
```

### 📁 改动文件

| 文件 | 改动 |
|---|---|
| `server.py` | `handle_history` / `handle_history_content` / `handle_restore` 三个 handler + 路由 |
| `web/index.html` | 顶栏 🕐 按钮 + History Drawer + 预览 modal |
| `web/style.css` | `.history-drawer` / `.history-item` / 类型徽章 / 抽屉滑入动画（约 100 行） |
| `web/app.js` | `HISTORY` IIFE 模块（open/close/render/preview/restore，约 130 行）+ 事件绑定 + 文件打开/关闭时切换按钮启用态 |
| `CHANGELOG.md` | v1.10.2 卡片 |

### 🔮 Out of Scope（v1.11+）

- 字符级 diff（diff-match-patch.js 还没引入；当前只显示 size_delta）
- 时间线 timeline 化（多个文件混合时间轴）
- 跨文件版本对比（不同文件的快照拉到一起做 diff）
- pre-restore 类型还需要 server.py 主动给 kind 字段（当前是前端从 name 推断）

---

## [v1.10.1] — 2026-05-11 · 01:05 · 自动刷新性能 99.99% 提升（紧跟 v1.10.0 patch）

> v1.10.0 上线后做基准测试发现：当前用户的扫描根有 **4001 个节点**（1110 目录 + 1029 HTML + 1862 MD），`/api/tree?refresh=1` 单次返回 **1.3 MB JSON / 150 ms**。10 秒一次轮询 = 每分钟 7.8 MB 流量。98% 的轮询其实"什么都没变"，只是为了发现"是否有变化"——这是典型的"贵的全量替代廉价的增量检查"反模式。本版本用经典的 **ETag/HEAD 模式**修复。

### 🚀 性能（用真实数据说话）

| 指标 | v1.10.0 全树轮询 | v1.10.1 签名先行 | 改善 |
|---|---|---|---|
| 单次响应大小（无变化时） | 1,359,717 B | **102 B** | **99.99%↓** |
| 单次耗时（无变化时） | 146 ms | **1.2 ms** | **120×↓** |
| 每分钟流量（10s 周期） | ~7.8 MB | **~480 B** | **99.99%↓** |
| 浏览器解析压力 | 解析 4001 节点 | 解析 1 个 sig 字符串 | ≈ 4000×↓ |

### 🔧 实现

- **后端**：新增 `_walk_signature()` 轻量扫描函数——只采集 `(path, mtime, size)` 三元组、不构建嵌套对象，比 `_walk_dir` 快 5×+
- **新端点 `GET /api/tree-sig`**：返回 `{ok, sig, file_count, mtime_max, ts}`，~102 字节
- **新缓存 `_sig_cache`**：1 秒 TTL（极短，给极高频调用兜底；正常 10s 周期不会撞上）
- **签名算法**：MD5 of sorted `path|mtime|size` 拼接，前 16 位
- **同步清缓存**：所有原本清 `_tree_cache["data"] = None` 的位置都同步清 `_sig_cache["data"] = None`，保证文件改动后第一次轮询能立即检出
- **前端 `tickAutoRefresh`** 改造：先 GET sig，命中缓存（与上次 sig 相同）→ 直接 return；不命中 → 才走 v1.10.0 的全树拉取 + diff 渲染
- **首次启动记录 sig**：避免初始化后第一次 tick 误判"已变"再拉一次全树

### 🔍 验证

```bash
# 签名端点
curl -s http://localhost:9901/api/tree-sig
# → {"ok":true,"sig":"fb81e6781af9f6ad","file_count":2893,"mtime_max":1778431851,"ts":1778431995}

# 端到端
# 1. 打开 http://localhost:9901
# 2. DevTools Network 过滤 'tree' → 看到主要是 /api/tree-sig，几乎不见 /api/tree
# 3. touch outputs/test.html → 10s 内出现，可见 /api/tree 调用一次
# 4. 不动文件时 → 只有 /api/tree-sig，每次 ~102B
```

### 📐 架构选择

**为什么不用 watchdog/SSE？**
- 文件系统监听需要新依赖（watchdog 库），违反项目"零 npm 依赖、零额外 Python 依赖"原则
- SSE/WebSocket 需要保持长连接，浏览器 tab 数量增加时会累积资源占用
- 当前 ETag 方案已经把 99.99% 的"无变化"流量消除，剩下 0.01% 真有变化时才付全树代价——这种"按需"的代价是合理的

**留给 v2.0 的想法**：超大目录（>10k 文件）时签名计算可能爬升到 50ms+，届时再引入 watchdog 推送方案。

### 📁 改动文件

| 文件 | 改动 |
|---|---|
| `server.py` | 新增 `_walk_signature` / `get_tree_signature` / `handle_tree_sig`；3 处清缓存同步清 `_sig_cache`；路由 `/api/tree-sig` |
| `web/app.js` | `state.autoRefresh.lastSig` 字段；`tickAutoRefresh` 改为先 sig 后 tree；`init()` 末尾首次记录 sig |
| `CHANGELOG.md` | v1.10.1 卡片 |

---

## [v1.10.0] — 2026-05-10 · 23:30 · 目录树自动刷新（不再手动按🔄）

> 路易在创作时常需要在终端用 AI 生成新 HTML 到 `outputs/` 下，切到 DocCenter 想立即点开新文件，但侧边栏看不到——必须手动点 🔄 才能看到，每次都要切换工具，打断创作流。本版本让目录树**定期自动刷新**，新增/删除/重命名文件无需手动刷新即可在 N 秒内自动出现/消失，且**完全不打扰**当前的编辑/批注/选中态。

### 🔧 新功能

- **目录树定期自动刷新**（默认每 10 秒）
  - 新文件自动出现在侧边栏，删除的文件自动消失，无需手动按 🔄
  - 设置面板新增"📡 目录树自动刷新"配置项，可选 5/10/30/60 秒或关闭
  - 后端 `/api/config` 增加 `tree_auto_refresh_seconds` 字段（白名单校验，仅接受 0/5/10/30/60）

- **智能不打扰策略**
  - 标签页隐藏时（`document.hidden=true`）自动暂停轮询，节省电量；切回来立即触发一次
  - 用户与目录树交互后 3 秒内不刷新（避免拖拽/点击中视图突变）
  - 上一次请求未完成不发起新请求（防止请求堆积）
  - 失败静默处理（`console.warn` 而非 toast 弹窗）

- **diff 渲染（不破坏 UI 状态）**
  - 全新 `diffTreeAndPatch()`：对比新旧目录树，**只增删变化的 DOM 节点**，已展开的目录保持展开、当前选中的文件保持选中、收藏星标保持高亮
  - 新增节点带 220ms 淡入动画（左滑 6px 进入），删除节点带淡出动画（max-height 折叠）
  - 完全跳过整树重渲染，零闪烁

### 📐 架构

- 前端轮询而非后端推送（暂不引入 watchdog/SSE/WebSocket，保持项目轻量原则；留作 v2.0 优化方向）
- 每个 `.tree-node` 现在带 `data-path` 属性，便于精确定位 DOM
- 后端 `_scan_tree()` 已有 entry-only 优化，10 秒一次 force refresh 的开销可接受

### 🔍 验证清单

```bash
# 后端配置
curl -s http://localhost:9901/api/config | python3 -m json.tool | grep tree_auto_refresh
# → "tree_auto_refresh_seconds": 10

# 前端验证
# 1. 打开 http://localhost:9901
# 2. DevTools Network → 看到每 10s 一次 /api/tree?force=1
# 3. 终端 touch outputs/test-auto.html → 10 秒内侧边栏出现
# 4. rm 该文件 → 10 秒内消失，已展开的目录保持展开
# 5. 切到别的标签页 → 请求停止；切回 → 立即触发
# 6. 设置面板切到"关闭" → 请求停止
```

### 📁 改动文件

| 文件 | 改动 |
|---|---|
| `server.py` | `DEFAULT_CONFIG` 加 `tree_auto_refresh_seconds`；`/api/config` 白名单 + 范围校验 |
| `web/app.js` | 新增 `flatTree` / `diffTreeAndPatch` / `startAutoRefresh` / `stopAutoRefresh` / `tickAutoRefresh` / `bindAutoRefreshTriggers`；`loadTree(force, silent)` 新增 silent 参数；`renderNode` 加 `data-path` |
| `web/index.html` | 设置面板新增"📡 目录树自动刷新"section |
| `web/style.css` | 新增 `tree-node-fade-in/out` keyframes + `.settings-row` / `.settings-hint` 通用样式 |

### 🔮 Out of Scope（v1.11+ 再做）

- watchdog 文件系统监听 + SSE 实时推送（亚秒级响应，但增加依赖和复杂度）
- 重命名识别（目前视为"删除+新增"，简单可靠）
- 排序受影响：mtime_desc 模式下新文件 ts 较大本应在前，但 diff 路径保守追加在末尾，下次完整刷新（点 🔄 或刷新页面）时会修正顺序

---

## [v1.9.5] — 2026-05-07 · 15:50 · v1.9.4 紧急 Hotfix：SVG 内 Enter 保护 + 数据恢复

> v1.9.4 上线 20 分钟就造成线上事故：川哥在一份含 SVG 流程图的 PPT HTML 里按 Enter，SVG 内部 `<text>` 元素被注入 HTML `<br>`，多处红字（"CPT 退出"/"不再参与交付"/"人工筛选"）直接丢失，整张图示布局塌掉。幸运的是 `_auto-save/*-pre-overwrite-*.html` 机制救了一命，用户数据完整恢复。

### 🚨 事故复盘

- **触发条件**：HTML 里含 `<svg>` + `<text>` 元素；用户光标点进 SVG 文字里按 Enter
- **v1.9.4 bug**：`document.execCommand("insertLineBreak")` 在 SVG `<text>` 里会产出一个 HTML `<br>` 节点，把原文字节点替换掉
- **可见现象**：被编辑的 SVG 文字变成空白（或仅剩 `&nbsp;`），SVG 重排后整张图结构错乱
- **实际破坏**：04 公有云迁移·未来交付模型 V2-04.1 优化版里 3 处红字被破坏
- **已恢复**：通过 `_auto-save/*-pre-overwrite-20260507-154453.html` 覆盖回写，破坏版另存为 `.broken-*` 留档

### 🐛 Bug 修复

- **SVG / MathML 内部 Enter 不再插入 HTML `<br>`**（`saver-runtime.js`）
  - 在 Enter 捕获 handler 里新增前置判断：
    ```js
    const isInSvg = (anchorEl instanceof SVGElement) ||
                    (anchorEl.closest && anchorEl.closest("svg"));
    const isInMath = anchorEl.closest && anchorEl.closest("math");
    if (isInSvg || isInMath) { e.preventDefault(); return; }
    ```
  - 语义正确性：SVG `<text>` 本就不支持 HTML 换行，用户在此处按 Enter 本应无效果
  - 实现鲁棒性：双重判断（`instanceof SVGElement` + `closest("svg")`），兼容嵌套情况

### 📐 教训沉淀

1. **contenteditable + SVG 是雷区**：任何要往可编辑 DOM 注入节点的代码，都必须先判断目标命名空间是 HTML 还是 SVG/MathML
2. **_auto-save/pre-overwrite 机制的价值被实战验证**：下次有"覆盖保存"相关重构，这道护栏**不能拆**
3. **Enter 键修改这种广谱改动，应该先在 SVG/Math/表格/代码块等典型场景各过一遍再发版**，v1.9.4 发得太急

---

## [v1.9.4] — 2026-05-07 · 15:30 · 侧边栏拖拽修复 + 正文 Enter 键行为修正

> 一波两个 UX bug：川哥在同一批里指出，顺手一起修。

### 🐛 Bug 修复

#### 1. 侧边栏拖拽条在打开文档后"一顿一顿"

- **问题**：首页空白状态下拖拽很丝滑；一旦点开任意文档（iframe 承载），拖动宽度变得很迟钝，明显丢帧
- **根因**：原实现用 `document.addEventListener("mousemove", ...)` 监听。鼠标一旦越过 iframe 边界，事件会被 iframe 文档捕获，**外层 document 直接收不到 move**，于是只有指针回到 iframe 之外的那几像素才触发更新 → 肉眼"卡顿"
- **解法**（双保险，`web/app.js` 拖拽逻辑重写）：
  1. 用 `pointerdown/pointermove/pointerup` 替代 mousedown/mousemove，并在 pointerdown 里调用 `resizer.setPointerCapture(e.pointerId)` 把指针事件强制绑到 resizer 上，跨 iframe 依然能收到；
  2. 拖拽期间动态创建一层 `position:fixed; inset:0; z-index:9999` 的透明遮罩 `#__dc_resize_overlay` 盖住 iframe，彻底拦截事件；pointerup/pointercancel 时拆掉
- **效果**：打开文档与未打开文档下拖拽手感完全一致，全程 60fps

#### 2. 在正文里按 Enter 看不到换行

- **问题**：川哥在 PPT 式汇报 HTML（`.slide { min-height:540px; overflow:hidden }` 这种常见结构）里按回车没反应，文字不换行
- **根因**：浏览器默认 Enter 在 contenteditable 里会插入 `<div><br></div>` 或 `<p><br></p>`——但这种**块级**新节点在常见 PPT 样式下会被吃掉：
  - 外层 `overflow:hidden + 固定 min-height` 把超界内容裁掉
  - `display:flex + justify-content:center` 把空块压成高度 0
  - 部分 heading / card 容器没预留段落间距，新块视觉上贴在原文下方无感知
- **解法**（`saver-runtime.js` bindListeners 新增 keydown 捕获）：
  - 主动拦截 **Enter**（不含 Shift/Meta/Ctrl/Alt/IME 候选），调用 `document.execCommand("insertLineBreak")` 在当前块内插入 `<br>`
  - 兜底用手动 Range 插 `<br>`（应对 execCommand 在新浏览器被弃用的情况）
  - 跳过条件：输入框/选择框、DocCenter 自身 UI（`#__dc_toolbar`/`#__dc_img_popover`/`#__dc_block_popover`/`.__dc_anno_pop`）、光标不在 contenteditable 区
  - `Shift+Enter / Cmd+Enter` 保持浏览器默认，为有需求的原生编辑器留出口

### 📐 架构收益

- 跨 iframe 的全局拖拽交互，以后的模板是 "pointer capture + 临时遮罩"，不再踩 mousemove 被吃掉的坑
- Enter 键行内换行模式在 PPT 式、固定高页面结构里表现一致，未来不用针对个别模板单独写 CSS hack

---

## [v1.9.3] — 2026-05-07 · 01:35 · contenteditable 污染根治 + 批量清理脚本

> 用户反馈："为什么有的文件加载不出来编辑栏？"——追查下来是一个**架构级 bug**：DocCenter 在"覆盖源文件"时把自己注入的 `contenteditable="true"` 永久写回磁盘，污染了源文件。下次打开这些文件，`detectExistingEditor` 判定 3 误认为"页面自带编辑器"，直接跳过顶栏注入。**18 份 HTML 文件受害**。本版三层修复 + 一次性清理。

### 🐛 Bug 修复（架构级）

- **顶栏 📐 按钮在某些 HTML 里不出现**
  - **问题**：用户打开某些 HTML 看不到 DocCenter 顶栏（含 📐 间距按钮），但图片浮窗仍正常工作
  - **根因链**：
    1. DocCenter v1.0 起，`injectMinimalToolbar` 会给 body 加 `contenteditable="true"` + `outline: none`
    2. 用户编辑后走"覆盖源文件"→ `serializeContent` **忘记剥离这两项** → **永久写回磁盘**
    3. 下次打开该文件 → `detectExistingEditor` 判定 3：`document.body.isContentEditable === true` → 判为"自带编辑器" → **跳过顶栏注入**
    4. 用户感知：顶栏消失，以为功能坏了
  - **影响面**：全工作区扫描发现 **18 份** 被污染文件，集中在用过多次"覆盖保存"的报告（迁移服务 PPT、岗位分析、养虾系列正文等）

### 🛠 解法（三层防御）

#### 第一层：源头防污染（`serializeContent`）
```js
// 保存时剥离 body 上 DocCenter 自己注入的 contenteditable 和 outline:none
const cloneBody = clone.querySelector("body");
if (cloneBody) {
  if (cloneBody.getAttribute("contenteditable") === "true") {
    cloneBody.removeAttribute("contenteditable");
  }
  // 从 style 属性里剥离 outline: none，保留其他样式
  // ...
}
```
**以后不会再产生新污染**。

#### 第二层：降级判定 3（`detectExistingEditor`）
彻底删除"单独的 body contenteditable 就认定自带编辑器"这条启发式——它太激进，误伤面太大。新逻辑只靠 **明确的工具栏 DOM** 判定（判定 1 + 判定 2），鲁棒性大增。

#### 第三层：存量治理（一次性清理脚本）
新增 `scripts/clean-contenteditable-pollution.py`：
- 扫描所有 enabled scan_root 下的 HTML
- 找出 body 含 `contenteditable` 的文件
- 剥离 `contenteditable="true"` 和 style 里的 `outline: none`
- **每个文件备份为 `*.bak-v1.9.3`**，安全可回退
- 支持 `--dry-run` 模式先预览

**本次运行成果**：共清理 **18 个文件**（11 主扫描 + 7 漏网补修），均备份。清理后全工作区受污染文件 = **0**。

### 🐞 附带修复：清理脚本自身 Bug
第一轮运行后发现 7 个漏网文件。根因：脚本头部预筛选只读 8KB，而有些大文件（如 2.7MB 的 deck）的 `<body>` 标签在 32KB+ 位置才出现。修复：改成读全文判断。

---

## [v1.9.2] — 2026-05-06 · 20:45 · ⌥+click 图片冲突 Hotfix

> 用户反馈："⌥+click 图片后弹出的还是图片浮窗，不是块间距浮窗"。根因是两个模块的 click 监听器抢夺事件。

### 🐛 Bug 修复

- **⌥+click 图片时无法进入块间距模式**
  - **问题**：按住 Alt + 点图片 → 弹出图片浮窗（替换/粘贴/删除）而非块间距浮窗
  - **根因**：ImageEditor 的 `handleGlobalClick` 在捕获阶段（`true`）监听，**先于** BlockSpacingEditor 触发，且没有检查 `altKey` → 任何点 `<img>` 的 click 都被它截住
  - **解法**：ImageEditor 的 `handleGlobalClick` 开头加一行 `if (e.altKey) return;`，把 Alt 修饰的事件让给 BlockSpacingEditor
  - **验证**：
    - 普通 click 图片 → 图片浮窗（不受影响）
    - ⌥+click 图片 → 图片父块的间距浮窗（新行为生效）
    - ⌥+click 非图片块 → 块间距浮窗（本来就能用）

### 📐 快捷键体系（v1.9.2 完整版）

| 操作 | 功能 |
|---|---|
| 普通 click `<img>` | 图片浮窗（替换/粘贴/删除）|
| ⌘V | 粘贴剪贴板图片到光标 |
| 拖入文件 | 插入图片 |
| **⌥ + click 任意块** | **块间距浮窗 📐** |
| ⌥ 浮窗内 `↑↓` | 上边距 ±4px |
| ⌥ 浮窗内 `←→` | 下边距 ±4px |
| ⌥ 浮窗内 `Esc` | 退出块选择 |
| ⌥ 浮窗内 🪄 | 一键 4:8 间距律规范全文 |

---

### 📂 File Structure（v1.9.2 + v1.9.3 合并）

| 文件 | 改动 |
|---|---|
| `saver-runtime.js` | Modify — ImageEditor 让出 Alt 事件；detectExistingEditor 降级；serializeContent 剥 body contenteditable + outline |
| `scripts/clean-contenteditable-pollution.py` | Add — 一次性清理脚本（99 行，BSD 风格注释）|
| `CHANGELOG.md` | Modify — 本两条 |

### ✅ 验证

- `read_lints` → 0 errors
- `curl /` → 200
- `curl /saver-runtime.js | grep v1.9.3` → 2 处匹配
- 受污染文件数从 **18 → 0**
- 备份文件数：**18**（每个清理过的文件都有 `.bak-v1.9.3`）

### 🧠 根本性教训

这次暴露了一个**比 bug 更深的问题**：

> **DocCenter 的自我注入和序列化没有做到"无痕"**。

每次在源文件上"做加法"都要同等强度地"做减法"。检查清单：

| 注入内容 | 是否已剥离 |
|---|---|
| `<div id="__dc_toolbar">` | ✅ |
| `<script src="/saver-runtime.js">` | ✅ |
| `<!-- html-doc-center:saver-injected -->` | ✅ |
| 各类浮窗/模态 | ✅ |
| 动态注入的 `<style>` | ✅ |
| `__dc_` 前缀的 class | ✅ |
| **body contenteditable="true"** | ❌ **v1.9.3 修** |
| **body style="outline:none"** | ❌ **v1.9.3 修** |

后续新增任何 DOM 注入都要走"注入 ↔ 剥离"配对原则，避免再次产生架构级污染。

### ♻️ 回退

```bash
git checkout v1.9.1
# 若已清理源文件，同时恢复备份：
# find . -name "*.bak-v1.9.3" | while read f; do orig="${f%.bak-v1.9.3}"; mv "$f" "$orig"; done
```

---

## [v1.9.1] — 2026-05-06 · 14:10 · 替换图片失效 Hotfix

> 用户反馈：点击图片浮窗的"🔄 替换"→ 选中新图 → **没生效**。根因是文件对话框关闭时的焦点事件链把 `selectedImg` 置空了。

### 🐛 Bug 修复

- **选择新图后图片没替换**
  - **问题**：`img` 弹出浮窗 → 点替换 → 文件选择器 → 选图 → **原图不变**
  - **根因链**：
    1. 系统文件对话框关闭瞬间，浏览器向页面派发 `click` 冒泡事件
    2. 该事件命中 ImageEditor 的 `handleGlobalClick`，判断"点击点不在图片/浮窗上" → 调 `deselectImage()` → **`selectedImg = null`**
    3. 紧接着 FileReader 的 `onload` 回调触发 → 看到 `selectedImg === null` → `return` 退出
    4. 用户感知：图片就像没换
  - **解法（双保险）**：
    - A. **引用锁定**：`pickFileAndReplace` / `pasteFromClipboard` 入口把 `selectedImg` 拷贝到局部 `targetImg`，`replaceImageFromBlob(blob, targetImg)` 参数化——即使全局 selectedImg 被置空，目标图片引用仍在闭包里
    - B. **暂停 deselect**：新增模块级变量 `suspendDeselect`，文件对话框打开时置 true，关闭后延迟 300ms 恢复；`handleGlobalClick` / Esc 都检查该标志位跳过 deselect。用 `window.focus` 事件兜底（取消文件对话框时也能恢复）
    - C. **isConnected 检查**：replaceImageFromBlob 里判断 `img.isConnected`，防止图片已被用户删除时还写入
    - D. **替换后自动重选**：`setTimeout(() => selectImage(img), 100)` 重建浮窗状态

### 🧠 调试收获（复用 v1.8.1 的心得）

这是 **contenteditable 浮动 UI 的经典陷阱再现**——和 v1.8.1 同源：

| 版本 | 场景 | 丢失对象 | 解法 |
|---|---|---|---|
| v1.8.1 | 点工具栏按钮 | selection | mousedown preventDefault |
| v1.8.2 | 第二次点 select | \_savedRange | selectionchange 持续追踪 |
| **v1.9.1** | **文件对话框关闭** | **selectedImg** | **引用锁定 + 暂停 deselect** |

**通用教训**：凡是会触发"焦点离开 → 事件回来"的异步操作（文件对话框 / 剪贴板 / 权限弹窗），**都要在发起前锁定所需引用**，而不是在回调里读全局状态。

### 📂 File Structure

| 文件 | 改动 |
|---|---|
| `saver-runtime.js` | Modify — ImageEditor 新增 `suspendDeselect` 标志位 + `targetImg` 参数化；`pickFileAndReplace` / `pasteFromClipboard` / `replaceImageFromBlob` 三处签名调整 |
| `CHANGELOG.md` | Modify — 本条 |

### ✅ 验证

- `read_lints` → 0 errors
- `curl /` → 200
- `curl /saver-runtime.js | grep suspendDeselect` → 5 处匹配
- 用户侧复现验证路径：浏览器硬刷 → 点图片 → 点"🔄 替换" → 选新图 → 应立即看到图片替换成功 Toast

### ♻️ 回退

```bash
git checkout v1.9.0  # 该 bug 在 v1.8.0 引入后一直存在，但 v1.9.0 也未修
```

---

## [v1.9.0] — 2026-05-06 · 12:30 · 布局能力零到一（块间距 + 节奏修复器）

> 用户反馈："我想把这个页面的下半部分和上半部分挪开一些，距离大一些"——直接戳中路线图里"布局类 0% 覆盖率"的核心短板。本版一次性交付**手动单块调节 + 一键全文规范**两个能力，把布局覆盖率从 **0%** 拉到 **约 40%**。

### 🎯 战略意义

按照 `docs/2026-05-06-roadmap-and-gap.md` 里的能力分类，DocCenter 的短板是：

- 文字类 90% ✅
- 图片类 67% ✅
- 批注 100% ✅
- **布局类 0%** ← 本版攻陷
- 样式类 0%（v1.10）
- 结构类 0%（v2.0）

G3「零 AI 依赖」目标从 50% 推进到约 60%：**调间距不再需要回 AI 重生成**。

### 🔧 新功能 · 手动块间距调整

- **触发方式**：`⌥ + click` 任意块级元素进入编辑（不干扰普通文字编辑）；顶栏新增 `📐 间距` 按钮作为鼠标用户兜底提示
- **浮窗 UI**：锚定选中块右上角
  - 上边距 / 下边距 双滑杆（0-120px，步进 4px，4:8 间距律友好）
  - 4 档预设：紧凑 8/8 · 默认 16/16 · 宽松 40/40 · 极宽 80/80
  - 方向键微调：`↑↓` 改上边距 ±4，`←→` 改下边距 ±4
  - `↺ 恢复原始` 按钮清除 inline margin 回到原 CSS
  - `Esc` 退出
- **视觉反馈**：
  - 选中块金色虚线边框（outline-offset=4px 不挤压内容）
  - 上下间距可视化指示条（半透明金色带 + 像素值标注），肉眼可见 margin 多大
  - 浮窗头部显示选中 selector（如 `section.card-deck`），选错可立即 Esc 重选
- **只用 inline style**，不碰原 CSS 类，不污染选择器特异性

### 🪄 新功能 · 一键规范全文节奏（核心差异化）

这是 DocCenter 独有的能力——**别的编辑器只让你手动调单块，DocCenter 让你"一键规范整篇"**。

- **按 4:8 间距律自动归一化**：
  - H1/H2 → 上 64 / 下 32
  - H3/H4 → 上 32 / 下 16
  - H5/H6 → 上 24 / 下 12
  - section/article → 上 48 / 下 24
  - p → 上 0 / 下 16
  - ul/ol → 上 12 / 下 16
  - table/figure → 上下 24
  - blockquote/pre → 上下 20
  - hr → 上下 32
- **Diff 预览对话框**：
  - 扫描到 N 处可规范的间距 → 展示前 80 条 `fromMt/Mb → toMt/Mb` 的 diff 列表
  - 统计标签分布（多少标题 / 段落 / 章节）
  - 用户确认后批量应用，一次 `markDirty`
  - 如果已经规范 → 显示"✨ 已经很规范了，无需调整"
- **定位**：这是 DocCenter 从"单元素编辑器"向"**批量处理 AI 生成物**"跨越的第一步，对应路线图 G3 里"治本 2"

### 📐 架构

- 新增 `BlockSpacingEditor` IIFE 模块（约 530 行），严格复用 `ImageEditor` 的架构范式
  - `findBlockAncestor(el)` / `readMargin` / `applyMargin` / `updateIndicators`
  - `analyzeRhythm()` + `RHYTHM_RULES` 九条规则
  - 浮窗 / 模态 / 事件处理分层清晰
- 顶栏插入 `📐 间距` 按钮，位于 Undo/Redo 和批注之间
- boot 时调用 `BlockSpacingEditor.init()`
- 滚动 / resize 自动重新定位浮窗 + 间距指示条

### 🔒 序列化保护（serializeContent）

扩展剔除清单：
- `#__dc_block_popover` / `#__dc_rhythm_modal`（浮窗 + 模态）
- `.__dc_spacing_indicator`（间距指示条）
- `.__dc_block_selected` class（选中高亮）
- `style#__dc_block_styles`（动态样式）
- **兜底：全局扫所有 class，彻底清理 `__dc_` 前缀** —— 防止遗漏新增的 class 污染源文件

### 📂 File Structure

| 文件 | 改动 |
|---|---|
| `saver-runtime.js` | Modify — 新增 BlockSpacingEditor 模块（约 530 行）；顶栏加 📐 按钮；serializeContent 兜底清理 `__dc_` class |
| `docs/superpowers/plans/2026-05-06-v1.9.0-block-spacing.md` | Add — 本版 plan |
| `CHANGELOG.md` | Modify — 本条 |

### ✅ 验证

- `read_lints saver-runtime.js` → 0 errors
- `curl /` → 200
- `curl /saver-runtime.js | grep BlockSpacingEditor` → 5 处匹配（定义 + init + 剔除 + 按钮回调 + log）

### 🎯 使用指南

1. 点开任意 HTML
2. **手动模式**：按住 `⌥`/`Alt` + 点击想调整的块 → 浮窗出现 → 拖滑杆或按方向键
3. **自动模式**：在浮窗里点 `🪄 规范全文节奏` → 预览 diff → 确认应用
4. 保存走原有三选项（覆盖 / 另存 / 丢弃）

### ♻️ 已知限制（留给 v1.9.1+）

- margin collapse 在某些场景会让视觉间距 ≠ 设置值（CSS 规则，非 bug）；下版加 collapse 检测提示
- 节奏规则目前固定 9 条，未来可让用户自定义规则集
- 选中块后再次 `⌥+click` 其他块会切换选中（已实现），但不支持多选批量调

### ♻️ 回退

```bash
git checkout v1.8.2
```

纯 saver-runtime.js 改动 + CHANGELOG，无数据影响。

---

## [v1.8.2] — 2026-05-03 · 08:30 · 字号第二次不生效 Hotfix

> 用户反馈：选中文字设 14px 生效，再选 18px / 12px **不再生效**。字色同样偶现。根因是选区追踪的时序漏洞。

### 🐛 Bug 修复

- **字号 / 字色第二次点击不生效**
  - **问题**：第一次选 14 → OK；不重新选文字直接再选 18 → 样式不变
  - **根因链**：
    1. v1.8.1 用 `mousedown` 时机 `saveSelection()`，但 `<select>` 获得焦点时浏览器可能已先把文档 selection 置为 collapsed → `saveSelection` 的 `!isCollapsed` 守卫跳过 → `_savedRange` 仍是**上一次已被 `extractContents` 破坏的旧 range**
    2. `restoreSelection` 把这个"指向已删除节点"的 range 装回 → `window.getSelection().isCollapsed === true`
    3. `applyInlineStyleToSelection` 看到 collapsed → 直接 return false → 样式不变
  - **解法（三件套闭环）**：
    - A. **新增 `installSelectionTracker()`**：监听 `document.selectionchange`，用户任何非空选区都实时写入 `_savedRange`，忽略工具栏内部选区——彻底告别"mousedown 保存时机过晚"的时序竞争
    - B. `applyInlineStyleToSelection` 成功后**回写 `_savedRange`**：新建的 span 选中后立即同步到 `_savedRange`，保证第二次点击仍拿得到有效 range
    - C. `restoreSelection` 加 `try/catch`：如果 range 的 DOM 节点已销毁，清空 `_savedRange` 等下一次 selectionchange 补建，避免异常中断

### 🧠 调试收获

- **contenteditable 浮动工具栏的"时序三层陷阱"**：
  1. 第一层：点按钮会 collapse selection → 用 `mousedown preventDefault` 解决（v1.8.1）
  2. 第二层：`<select>` 不能 preventDefault（会破坏原生下拉）→ 必须保存再恢复（v1.8.1）
  3. 第三层：DOM 操作后旧 range 节点已消失，但 `_savedRange` 还指着旧节点 → 必须"操作后回写" + "selectionchange 持续兜底"（v1.8.2）
- **教训**：不要在"事件回调里临时保存"，而要"在用户意图发生时持续追踪"。selectionchange 是 contenteditable 编辑器的正确信号源

### 📂 File Structure

| 文件 | 改动 |
|---|---|
| `saver-runtime.js` | Modify — `installSelectionTracker` 新增；`restoreSelection` 加 try/catch；`applyInlineStyleToSelection` 两个分支成功后都回写 `_savedRange`；启动时调用一次 tracker 安装 |
| `docs/superpowers/plans/2026-05-03-v1.8.2-fontsize-repeat-fix.md` | Add — plan 文件 |
| `CHANGELOG.md` | Modify — 本条 |

### 🔄 如何回退

```bash
git checkout v1.8.1  # 回退到 v1.8.1（已知只能生效一次）
```

---

## [v1.8.1] — 2026-05-03 · 00:42 · 选区保留 Hotfix（批注按钮 + 字色/字号）

> 用户反馈 v1.8.0 两个 bug：① 选中文字后点"添加批注"按钮无反应 ② 点字色/字号无生效。根因相同：**浮动按钮和工具栏按钮没有 `mousedown preventDefault`，浏览器在 mousedown 时把 selection 清空，后续操作拿不到选区**。

### 🐛 Bug 修复

- **批注按钮点击无反应**
  - **根因链**：用户点击 `#__dc_anno_trigger` 浮动按钮 → mousedown 把焦点给按钮 → selection 立即变 collapsed → `selectionchange` 事件触发 → `onSelectionChange` 看到 `sel.isCollapsed` 同步调 `dismissTrigger()` → **按钮在 mousedown 和 mouseup 之间从 DOM 被移除** → click 事件根本不触发
  - **解法**：给浮动按钮加 `mousedown preventDefault`，阻止浏览器的默认焦点转移，selection 保留，按钮继续存在到 click 触发

- **字色色板点选色后不生效 / 字号下拉选档位不生效**
  - **根因**：同上，点工具栏按钮 → selection 丢失 → `applyInlineStyleToSelection` 里 `sel.isCollapsed = true` → 直接 return
  - **解法**：新增 `saveSelection()` / `restoreSelection()` helper 对。字号 select mousedown 时 `saveSelection`，change 时 `restoreSelection` 再应用。字色按钮 mousedown `preventDefault + saveSelection`，color 选完 `restoreSelection` 再应用

- **顺带修复：工具栏所有按钮**（B/I/U/高亮/Undo/Redo/色板色块/自定义 color picker）**统一加 `mousedown preventDefault`**，避免任何点击工具栏 → 选区丢失的连锁反应

### 🧠 调试收获（技术债避坑）

这其实是 **contenteditable 浮动工具栏的经典陷阱**。解决方案有四种，本次采用的是最通用的：

| 方案 | 适用 | 缺点 |
|---|---|---|
| `mousedown preventDefault`（本次采用） | 所有按钮和浮动 UI | 无明显缺点 |
| CSS `user-select: none` | 只处理文本选择，不处理 selection API | 保护不完整 |
| `tabindex="-1"` | 防焦点但不防 selection 清空 | 效果有限 |
| 使用原生 `<select>` | 必须主动 save/restore range | 复杂 |

### 📂 File Structure

| 文件 | 改动 |
|---|---|
| `saver-runtime.js` | Modify — 新增 saveSelection/restoreSelection；7 处按钮加 mousedown preventDefault；字号 select 改用 save/restore 模式 |
| `web/index.html` | Modify — 版本号 bump v1.8.1 |

### ✅ 验证

- JS 语法通过（node new Function 检查）
- 实际场景验收：浏览器硬刷后测试批注点击 + 字色选择 + 字号切换

### ♻️ 回退

`git revert v1.8.1` 或 `git reset --hard v1.8.0`。

---

## [v1.8.0] — 2026-05-03 · 00:30 · HTML 编辑增强（图片 + 字号 + 字色）

> 解决用户核心痛点——"AI 生成的 HTML 我不满意但改不动，只能依赖 AI 重生成"。本批覆盖**最高频的两类场景**：图片编辑（替换/删除/粘贴新图）+ 文字属性（字号 + 字色）。

### 🔧 新功能 · 图片编辑

- **点击图片弹浮窗**：任意 `<img>` 被点击（在可编辑页面下）→ 图片金边高亮 + 上方浮窗「🔄 替换 / 📋 粘贴 / 🗑 删除 / ✕」
- **🔄 替换**：打开文件选择器选本地图片 → 原图 src 更新为新图 base64，**保留 width/height/class/style**，布局不乱
- **📋 从剪贴板粘贴替换**：读剪贴板图片（支持截图工具 / macOS ⌃⇧⌘4）→ 替换当前选中图片
- **🗑 删除**：confirm 后删除，浏览器原生 ⌘Z 可撤销
- **全局 ⌘V 粘贴新图**：不选图片时，⌘V 粘贴剪贴板图片 → 插入到光标位置
- **拖入本地图片**：把 Finder / 桌面图片文件拖入页面 → 插入到光标位置
- **大图警告**：> 2MB 弹 confirm 提示"base64 膨胀 1.33 倍"，避免无意插大图把 HTML 撑到几十 MB
- **安全守护**：图片编辑仅在可编辑页面（body contenteditable 或祖先 contenteditable='true'）生效——原生只读页面不会被误触

### 🔧 新功能 · 文字属性

- **字号下拉**：顶栏新增 7 档字号（12 / 14 / 16 / 18 / 24 / 32 / 48 px）
  - 选中文字 → 选档位 → 立即应用 inline `font-size`，不污染原 CSS 类
  - 用 `Range.surroundContents` 优先，失败自动回退到 `extractContents + insertNode`
- **字色色板**：顶栏新增 `A` 按钮（显示当前色），点击弹出 8 色预设 + 自定义颜色选择器
  - 8 色预设：墨黑 / 中灰 / 红 / 橙 / 金 / 绿 / 蓝 / 紫
  - 应用方式同字号——`color` inline style
  - 按钮底部有彩条显示当前选中色
- **保留原 B / I / U / 高亮 / Undo / Redo**：不破坏已有工作流

### 🗑 清理

- 顶栏去掉 `🔴 红字` 快捷按钮（被新字色色板取代）

### 📐 架构

- 新增 `ImageEditor` IIFE 模块（约 280 行）：injectStyles / selectImage / deselectImage / renderPopover / pickFileAndReplace / pasteFromClipboard / replaceImageFromBlob / deleteImage / insertImageAtCursor / handleGlobalClick / handleGlobalPaste / handleGlobalDrop / isEditableContext
- 新增 `applyInlineStyleToSelection(styleDict)`：统一处理选区 → inline style 应用，支持跨元素选区回退
- 新增 `showColorPalette(anchor, onPick)`：预设色板 + 自定义取色器
- 顶栏结构重构：B/I/U → 分隔 → 字号下拉 + 字色按钮 + 高亮按钮 → 分隔 → Undo/Redo → 分隔 → 批注 + 状态

### 🔒 序列化保护（serializeContent）

- 新增剔除清单（保存到磁盘前移除所有 DocCenter 注入的 UI）：
  - `#__dc_img_popover`（图片浮窗）
  - `#__dc_color_palette`（色板）
  - `#__dc_toast`（提示条）
  - `img.__dc_img_selected` class（选中高亮）
  - 动态注入的 `<style>` 块（`__dc_img_styles` / `__dc_popIn_kf` / `__dc_anno_styles`）
- 确保源文件**零污染**——磁盘上的 HTML 只含用户真实编辑，不含 DocCenter 痕迹

### 📂 File Structure

| 文件 | 改动 | 说明 |
|---|---|---|
| `saver-runtime.js` | Modify | 工具栏增加字号/字色；新增 ImageEditor 模块；新增 applyInlineStyleToSelection / showColorPalette；serializeContent 扩展剔除清单；boot 里调用 ImageEditor.init() |
| `web/index.html` | Modify | 版本号 bump v1.8.0 |

### ♻️ 已知限制（留给 v1.9+）

- 图片不支持缩放（改 width / height）或拖动位置 → v1.9 做"局部布局调整"
- 图片暂只支持 base64 内嵌，没有"另存为独立文件 + 引用"模式
- 字号字色修改没有独立 undo 栈，仅依赖浏览器原生 contenteditable undo（可能在复杂操作后失灵）
- 跨元素选区的字号/字色应用偶尔会扁平化结构（surroundContents 失败时走 extractContents 回退）

### ✅ 验证

- node -e 语法检查通过，文件 54KB
- 保存时 serializeContent 剔除所有浮窗、色板、选中态 class 和动态样式

### ♻️ 回退

`git revert v1.8.0` 或 `git reset --hard v1.7.4`。纯 saver-runtime 改动，无数据影响。

---

## [v1.7.4] — 2026-05-03 · 00:05 · ETag 根治 + 拖拽展开策略修正

> 用户反馈"浏览器还在看老版本"+"拖拽移动后所有子目录都展开"。追查下来是两个 bug 叠加。

### 🐛 Bug 修复

- **Z · 浏览器缓存真·根治（核心）**
  - **根因**：v1.7.1 加了 `Cache-Control: no-store` 但 aiohttp 的 `FileResponse` 在写响应时**自动注入 ETag + Last-Modified**。浏览器发 `If-None-Match` → server 返回 304 → 用本地旧缓存。**缓存头形同虚设**。
  - **解法**：用 `_serve_file_nocache()` 取代所有 `FileResponse`——手动读文件 + `web.Response(body=...)`，完全不走 aiohttp 静态文件管线，不生成 ETag/Last-Modified。现在响应头里**只有** `Cache-Control: no-store` + `Pragma` + `Expires`，**没有** ETag 可供条件请求命中
  - **影响面**：`/` / `/static/*` / `/saver-runtime.js` / `/changelog` 四个入口全部改造。以后改代码，浏览器软刷 ⌘R 即时生效，不再会看到老版本
  - 顺带新增 `_CTYPE_MAP` 字典支持 html / js / css / json / svg / 图片 / md / 字体共 16 种 MIME 类型

- **A · 拖拽后所有一级子目录展开**
  - **根因**：v1.6.1 写 `renderNode` 折叠策略时**漏了 depth=1**。原意是"有 currentFile 时扫描根折叠，只展开当前文件父链"，但 `depth=1`（一级子目录）没加 collapsed。结果拖拽后 `expandAndFlashPath` 展开了扫描根，一级子目录默认全可见 → 视觉爆炸
  - **解法**：`renderNode` 中 `depth === 0 || depth === 1` 都加 collapsed（有 currentFile 时），让 `scrollToActiveFile` 独立控制要展开的那一条父链

- **B · handleDrop 调 scrollToActiveFile + expandAndFlashPath 冲突**
  - **根因**：两个函数都做"展开父链"但逻辑不同，叠加调用可能导致意外状态
  - **解法**：判断 `wasCurrent`——移动当前文件只需展开新路径；移动非当前文件则先 scrollToActiveFile 恢复当前，再 flash 新位置

### 📐 架构

- 新增 `_no_cache(resp)` helper：统一处理 no-store 三件套 + 剥离 ETag/Last-Modified（对仍来自 Response 的场景做兜底）
- 新增 `_serve_file_nocache(path, default_ctype)` helper：以"读文件 + text/body Response"的方式服务静态文件，绕过 aiohttp FileResponse 的 ETag 注入
- 新增 `_CTYPE_MAP` 字典：16 种文件扩展名的 Content-Type 映射

### 📂 File Structure

| 文件 | 改动 |
|---|---|
| `server.py` | Modify — 新增 `_no_cache` / `_serve_file_nocache` / `_CTYPE_MAP`；4 个静态文件 handler 改用新 helper |
| `web/app.js` | Modify — renderNode depth=1 也默认折叠；handleDrop 合并 scrollToActiveFile 和 expandAndFlashPath |
| `web/index.html` | Modify — 版本号 bump v1.7.4 |

### ✅ 验证

- `curl -I /static/app.js` → 响应头**无 ETag / 无 Last-Modified**，只有 no-store + Pragma + Expires
- `curl -I /` / `/saver-runtime.js` / `/changelog` → 同上
- 拖文件到扫描根 → 扫描根展开 + 目标闪烁，**其他一级子目录保持折叠**
- 拖当前打开文件 → 新位置金色闪烁，侧边栏父链正确展开到新路径

### ♻️ 回退

`git revert v1.7.4` 或 `git reset --hard v1.7.3`。纯服务端 + 前端修复，无数据影响。

---

## [v1.7.3] — 2026-05-02 · 23:45 · CHANGELOG 架构重构（单一数据源）

> 还清一个长期技术债：`CHANGELOG.md` 和 `CHANGELOG.html` 两份冗余手写文件，每次迭代必须双写。用户一句"为什么每次都要写一遍 HTML"直接戳中架构不合理。**从此 CHANGELOG 只有一份真相——MD**。

### 🏗 架构

- **`/changelog` 路由重构**：从返回静态 `CHANGELOG.html` → 返回 `web/changelog-shell.html` 壳子，前端用 `marked.min.js` 异步渲染 `CHANGELOG.md`
- **新增 `/api/changelog-raw`**：返回 `CHANGELOG.md` 原文（text/plain），供前端 fetch
- **新增 `web/changelog-shell.html`**：最小壳子页面，引 CSS + marked + renderer
- **新增 `web/changelog.css`**：从原 `CHANGELOG.html` 的 `<style>` 抽离为独立样式文件，针对 marked 渲染结构微调（`.release-body h3`、`table`、`li + li` 等）
- **新增 `web/changelog-renderer.js`**：核心渲染器——把 marked 输出按 `<h2>` 边界切片成 `<div class="release">` 卡片，解析 "[vX.Y.Z] — 日期 · 标题" 三段头部，第一个自动加 `.latest`
- **删除 `CHANGELOG.html`**：git 历史保留，磁盘移除。未来改日志只需改 MD。

### 📐 流程升级

- `ITERATION-SOP.md` 铁律 1：**"三写铁律" → "二写铁律"**
  - 原：MD + HTML + git commit
  - 新：MD + git commit
- 同步记录"为什么从三写降到二写"的根因，避免未来误加回 HTML

### 🎯 解决的真实痛点

| Before | After |
|---|---|
| 每次迭代要写 2 份文档（MD + HTML） | 只写 1 份 MD |
| v1.2-v1.4.2 曾发生 HTML 漏同步 | 不可能漂移，因为只有 1 份 |
| v1.6.1 时 HTML 里残留 〔根〕 字样 | 不会再有此类 bug |
| SOP 靠"铁律"对抗架构漏洞 | 架构从根本上不允许漂移 |

### 📂 File Structure

| 文件 | 改动 | 说明 |
|---|---|---|
| `server.py` | Modify | handle_changelog 改为返回 shell；新增 handle_changelog_raw；注册 /api/changelog-raw |
| `web/changelog-shell.html` | Create | 壳子页面（顶栏 + 空容器 + 引用脚本） |
| `web/changelog.css` | Create | 从 CHANGELOG.html 抽出的样式（约 340 行） |
| `web/changelog-renderer.js` | Create | MD → marked → 时间轴卡片结构（约 150 行） |
| `CHANGELOG.html` | **Delete** | 冗余文件，MD 成为唯一真相 |
| `ITERATION-SOP.md` | Modify | 铁律 1 从"三写"改"二写"，写清楚根因 |
| `web/index.html` | Modify | 版本号 bump v1.7.3 |

### ✅ 验证

- `curl /changelog` → 200 + 壳子 HTML（不含版本内容）
- `curl /api/changelog-raw` → 200 + MD 原文
- 浏览器打开 /changelog → 视觉和重构前一致（时间轴卡片 + latest 徽章 + 三段式头部 + 金色脉动圆点）
- 修改 CHANGELOG.md → 刷新浏览器立即生效

### ♻️ 回退

`git revert v1.7.3` 或 `git reset --hard v1.7.2`。回退后 `CHANGELOG.html` 会从 git 历史恢复，SOP 也会回到"三写"。

---

## [v1.7.2] — 2026-05-02 · 18:38 · 跨根拖拽修复

> 用户反馈拖不到另一个扫描根上。

### 🐛 Bug 修复

- **跨扫描根拖拽失败**：拖一个文件到另一个扫描根（如 skills → outputs），松手没反应
  - **根因**：`wireDragAndDrop()` 第一行 `if (isRoot) return`——我初版想让扫描根"不参与拖拽"，但这一刀**把它的 drop target 能力也切了**，导致它只能显示、不能接收
  - **解法**：拆成两个独立分支——"不作为拖拽源"（扫描根保留此限制，防止误拖整个扫描根）和"可作为 drop target"（扫描根和子目录都允许接收）
  - 后端 API 本身一直支持跨根移动（`_resolve_safe` 允许任一 scan_root 内路径），bug 纯前端

### 📂 File Structure

| 文件 | 改动 |
|---|---|
| `web/app.js` | Modify — wireDragAndDrop 拆分"拖拽源"和"drop target"两个分支，扫描根重新获得 drop 能力 |
| `web/index.html` | Modify — 版本号 bump v1.7.2 |

### ✅ 验证

- `curl -X POST /api/move` 跨根：`skills/agent-clone → outputs/` → ok=true（后端一直就支持）
- 前端：从 skills 拖文件到 outputs 根 → 金边高亮 → confirm → 成功

### ♻️ 回退

`git revert v1.7.2` 或 `git reset --hard v1.7.1`。

---

## [v1.7.1] — 2026-05-02 · 18:35 · 拖拽 Hotfix + 缓存根治

> v1.7.0 上线即遇 3 个体验问题 + 1 个系统性缓存隐患，一次打包修复。

### 🐛 Bug 修复

- **A · 移动成功后目录全部折叠，用户不知道新文件去哪了**
  - 根因：`loadTree(true)` 重渲染后所有扫描根默认 collapsed（v1.6.1 策略），目标位置没被特别展开
  - 解法：新增 `expandAndFlashPath(new_abs_path)`——移动成功后自动展开目标的父链 + 金色闪烁 1.4s + scrollIntoView 滚入可视区
- **B · Dirty 文件拦截 toast 在右下角不显眼**
  - 根因：toast-container 默认 `bottom: 20px; right: 20px`，用户视线在左侧侧边栏拖拽，角落提示看不见
  - 解法：toast 改为**屏幕顶部中央**（`top: 64px; left: 50%`），加大字号（13px）、加粗边框（4px 左条）、加深背景（warning/error 色底）、改滑入方向（从顶部掉下）
- **C · Dirty 被拦截后节点变灰不恢复**
  - 根因（双层）：① `cursor: grab` 作用于整个 tree-node，导致"看起来像拖拽态"；② dragstart preventDefault 后 dragend 不会触发，如果曾加过 class 就会残留
  - 解法：① cursor 只作用于 `.tree-node-label`（不影响子元素）；② dragstart 早期拦截时**完全不触碰任何 class**；③ 兜底——全局 mouseup 延迟 50ms 清理残留 `.dnd-dragging` 和 `.dnd-target-active`

### 🔒 基建 · 硬禁缓存（根治"代码改了浏览器看老版"）

- `/`、`/static/*`、`/saver-runtime.js` 三个入口统一加响应头：
  ```
  Cache-Control: no-store, no-cache, must-revalidate, max-age=0
  Pragma: no-cache
  Expires: 0
  ```
- 即使浏览器 ⌘R 软刷新也能拿到最新版本（不再依赖 `?v=xxx` querystring bust）
- 背景：v1.6.1 发布后用户反馈看到 `〔根〕` 字样，实际上代码早已去除。深层原因是 IDE 内置 WebView 缓存策略激进。

### 📂 File Structure

| 文件 | 改动 | 说明 |
|---|---|---|
| `web/app.js` | Modify | handleDrop 成功后 expandAndFlashPath；新增 expandAndFlashPath / cssEscape；全局 mouseup 兜底清理 |
| `web/style.css` | Modify | toast-container 顶部中央；cursor:grab 作用域收敛；warning/error toast 加深色底 |
| `server.py` | Modify | handle_index / handle_static / handle_saver_js 三个 handler 都加 Cache-Control no-store |
| `web/index.html` | Modify | 版本号 bump v1.7.1 |

### ✅ 验证

- `curl -I /` / `/static/app.js` / `/saver-runtime.js` → Cache-Control 均为 `no-store, no-cache, must-revalidate, max-age=0`
- 实测：拖拽成功 → 目标目录自动展开 + 金色闪烁
- 实测：拖 dirty 文件 → 屏幕顶部中央警告，节点无变灰残留

### ♻️ 回退

`git revert v1.7.1` 或 `git reset --hard v1.7.0`。纯修复，无数据变化。

---

## [v1.7.0] — 2026-05-02 · 18:05 · 拖拽移动文件 / 目录

> 侧边栏支持拖拽整理文档结构，让"把文件挪到对的目录"变成一秒钟的肌肉记忆。

### 🔧 新功能

- **拖拽移动**：文件或子目录可拖拽到任意扫描目录下的目标文件夹
  - 悬停目标文件夹时虚线金边高亮 + `📥` 图标提示 drop 可行
  - 松手弹 confirm 确认（防误操作）
  - 成功 toast 显示"✅ 已移动 xxx → yyy（快照 N 个同步）"
- **跨扫描根移动**：支持跨 scan_root 拖拽（只要源和目标都在任意 enabled scan_root 内）
- **快照自动跟随**：文件移动时，`_auto-save/` 里匹配 `{stem}-*` 和 `{stem}-pre-overwrite-*` 的快照按 stem+suffix 过滤一起挪到新目录（不会误挪其他文件的快照）
- **冲突拒绝**：目标已存在同名文件/目录 → 409 + toast 拒绝移动，不覆盖
- **Dirty 保护**：正在编辑未保存的文件不能拖走，提示"请先保存当前修改再移动"
- **自拖拽保护**：前端拦截"拖到自己""拖到自己的子目录""拖到原父目录"三种无效操作
- **当前文件跟随**：如果被移动的就是当前打开文件，state.currentFile 自动更新到新路径，侧边栏高亮刷新
- **收藏路径更新**：收藏项涉及被移动路径时，自动重新加载收藏列表（失效的会被后端 cleanup 清掉）

### 🔒 安全

- `/api/move` 的 src 和 dst_dir 都通过 `_resolve_safe()` 白名单校验，非 scan_root 内路径 403
- 目录拖到自己子目录：后端 + 前端双重拦截
- 冲突不覆盖：发现目标同名直接拒绝，返回原 `conflict_path` 供用户决策

### 📂 File Structure

| 文件 | 改动 | 说明 |
|---|---|---|
| `server.py` | Modify | 新增 `_move_matching_snapshots()` 和 `handle_move()`；`/api/move` 路由注册 |
| `web/app.js` | Modify | 新增 `wireDragAndDrop()` 和 `handleDrop()`；`renderNode` 末尾挂载；API.move 端点 |
| `web/style.css` | Modify | 新增 `.tree-node.dnd-dragging` / `.tree-node-label.dnd-target-active` 拖拽视觉 |
| `web/index.html` | Modify | 版本号 bump v1.7.0 |

### ✅ 验证

- `curl -X POST /api/move` 非 scan_root src → 403
- 缺参 → 400
- 冲突（目标同名） → 409 + 明确错误码
- 浏览器实测：文件跨根拖动成功 + 快照跟随

### ♻️ 回退

- 代码：`git revert v1.7.0` 或 `git reset --hard v1.6.1`
- 文件系统：每次 /api/move 都有 `_log("📦 ... 源 → 目标")`，服务日志 `/tmp/html-doc-center.log` 可反查路径手动 `mv` 回退
- 快照没丢：按 stem+suffix 匹配移动，不混淆其他文件

---

## [v1.6.1] — 2026-05-02 · 17:30 · 侧边栏信息层级重构

> 用"路易乔布斯视角 + Nielsen #6 + 格式塔"对 v1.6.0 的目录树做层级重构。核心问题：5 个扫描根横排时，当前打开文件所在的那个根完全没有视觉暗示，用户每次都要扫 5 个根才能找到入口。

### 🎨 UX 优化

- **Active 根自动高亮**：当前打开文件所在的扫描根，**金色左边条 + 淡金色背景 + 📂 打开图标**。其他扫描根半透明（0.72），hover 恢复完全不透明
- **智能折叠策略**：有当前文件时，只展开 active 根，其他根默认折叠；无当前文件时沿用原行为（全展开）
- **父链金色 trail**：从当前文件到扫描根的整条父目录链，label 右侧浮现 2px 金色竖条，你永远能追溯"我在哪"
- **字号分层**（扫描根 14.5px/700 → 子目录 13px/500 → 文件 12.5px/400），用排印建立视觉权重
- **子目录文件计数**：非扫描根的目录名后显示 `(N)`，不展开就知道里面有几个文件。扫描根不展示（可能很大，性能成本高）
- **去除冗余 `〔根〕` 文字**：视觉噪音降低，改用字号 + 背景 + 金边三重暗示传达"这是扫描根"
- **长文件名 tooltip 强化**：hover 显示两行——第一行完整文件名，第二行完整路径

### 📐 架构

- `scrollToActiveFile()` 从"展开父链"升级为"展开父链 + 打 `in-active-chain` 类 + active 根打 `is-active` 类 + 其他根全部折叠"四件套
- `renderNode` depth=0 时折叠策略改为"有 currentFile 则默认 collapsed，无则保持展开"
- CSS 新增 9 组样式：`.tree-root > .tree-node-label` / `.tree-root:not(.is-active)` / `.tree-root.is-active > .tree-node-label` / `.tree-node.tree-lv1 .tree-name` / `.tree-node.tree-file .tree-name` / `.tree-dir-count` / `.in-active-chain` / `.tree-root + .tree-root` 等
- **不动后端、不动数据结构、不动 API**——纯视觉层修复

### 📂 File Structure

| 文件 | 改动 | 说明 |
|---|---|---|
| `web/app.js` | Modify | scrollToActiveFile 扩展三类类；renderNode depth=0 折叠策略条件化；createDirLabel 去〔根〕+ 加 (N)；createFileLabel tooltip 两行 |
| `web/style.css` | Modify | 追加 v1.6.1 信息层级 9 组样式 |
| `web/index.html` | Modify | 版本号 bump v1.6.1 |

### ✅ 知识图谱应用痕迹

- **Nielsen #6「可见性 vs 回忆」** → active 根高亮、父链 trail
- **格式塔「相似性 + 接近性」** → 字号分层、目录/文件颜色分档、扫描根间距
- **八二法则** → 80% 时间看 active 根，其他根压缩到 30% 视觉权重
- **Fitts Law** → tooltip 强化减少 hover 探索成本

### ♻️ 回退

`git revert v1.6.1` 或 `git reset --hard v1.6.0`。纯 UI 改动，无数据迁移风险。

---

## [v1.6.0] — 2026-05-02 · 17:10 · 目录排序 + 文件收藏 + Disabled 沉底

> 3 个目录树体验升级，用户日常最高频的三个痛点一次性解决。

### 🔧 新功能

- **目录排序（每层独立）**：侧边栏顶部新增排序下拉，支持"🕒 最近修改"（默认）和"🔤 名称"两种方式；每层目录独立排序；目录永远在文件之前。偏好存 `localStorage.doc_center_sort`，重启浏览器保持
- **文件/目录收藏**：
  - 鼠标悬停任意文件或子目录 → 右侧浮现 ☆ → 点击即收藏
  - 侧边栏顶部"⭐ 收藏 (N)"分组，点击条目直接打开文件/跳转定位目录
  - 每条收藏项右侧 ★ 按钮可取消收藏
  - 空态引导："点文件/目录旁的 ☆ 添加收藏"
  - 数据单独存 `~/.codebuddy/html-doc-center/favorites.json`，不污染 config
  - 跨目录收藏允许，但必须落在 scan_roots 白名单内
  - 启动时自动清理失效项（路径不存在或不在 scan_roots 内）
- **Disabled scan_roots 沉底**：设置面板的扫描目录列表自动按 enabled 分组——启用的在前、关闭的在后，中间一条虚线分隔"⏸ 已关闭（N，不扫描）"

### 📐 架构

- 后端新增 `/api/favorites` GET/POST；`_walk_dir` / `get_tree` 增加 `sort_by` 参数，缓存 key 扩容包含排序维度
- `_sort_entries()` 独立函数，统一处理 "目录在前 + 按 sort 排" 逻辑；目录的 mtime = 其下文件最大 mtime（递归向上传递），支持目录按"最近内容修改"排序
- 前端 `API.tree` 从字符串升级为函数 `(opts) => url`；新增 5 个收藏相关函数（loadFavorites / toggleFavorite / renderFavoritesSection / refreshFavStars / scrollToPath）
- 扫描根（scan_roots 顶级项）不展示 ☆（收藏扫描根本身无意义）

### 📂 File Structure

| 文件 | 改动 | 说明 |
|---|---|---|
| `server.py` | Modify | 收藏模块（load/save/cleanup_dead/get/post）；_walk_dir+sort；_sort_entries；/api/favorites 路由 |
| `web/app.js` | Modify | state.sortBy/favorites；API.tree 函数化；5 个收藏函数 + 排序切换 + refreshFavStars；createFileLabel/createDirLabel 挂 fav-btn；renderScanRoots 分组沉底 |
| `web/style.css` | Modify | .sidebar-toolbar / .sort-select / .favorites-section / .fav-btn / .root-group-divider / .flash-highlight 共 6 组新样式 |
| `web/index.html` | Modify | sidebar 内新增 sort-select 和 favorites-section 容器；版本号 bump v1.6.0 |

### ✅ 验证

- `curl /api/tree?sort=mtime_desc` / `?sort=name_asc` → ok=True，sort_by 字段正确返回
- `curl -X POST /api/favorites` add 非法路径 → 403；add 合法路径 → 加入；remove → 从列表清除
- CHANGELOG.html 标签闭合校验通过

### ♻️ 回退预案

- 代码层：`git revert <v1.6.0-commit-hash>` 或 `git reset --hard <v1.5.0-commit-hash>`
- 数据层：清空或删除 `~/.codebuddy/html-doc-center/favorites.json` 不影响代码功能

---

## [v1.5.0] — 2026-05-02 · 16:10 · 设置面板修复三连

> 一次性解决用户反馈的设置面板三个问题：屏幕适配、错误提示不友好、操作反馈不明显。

### 🐛 Bug 修复

- **P2 · 添加失败提示晦涩**：点击添加目录时偶发报错 `Unexpected non-whitespace character after JSON at position 4 (line 1 column 5)`，用户完全不知道怎么办。
  - **根因（双层）**：
    1. 直接根因：后端某次异常时 aiohttp 默认返回 500 + 纯文本 body `Server got itself in trouble`，前端 `r.json()` 解析这段非 JSON 文本时报错。"position 4" 正好对应 "Serv" 之后
    2. 触发根因：用户本地跑的是**启动后未重启过的旧服务进程**（从 2026-04-27 周一下午跑到 05-02 周六），碰到 v1.4.0 之后新增的 `[{path, enabled}]` 数据结构爆异常
  - **解法**：
    1. 新增 `safeFetchJson()` helper 统一处理 fetch 错误：非 2xx 时读 text 并抛出带 HTTP 状态码的 Error；非 JSON content-type 时直接报友好提示；500 时自动附带"可能需要重启 server.py"的自救建议
    2. `updateRoots` / `addRoot` / `toggleRoot` / `removeRoot` 全部改用 `safeFetchJson`，所有出错路径 toast 副标题显式展示原始错误信息
- **P1 · 设置面板超出屏幕**：11+ 条扫描目录时面板被撑破，"添加"输入框和"关闭"按钮被挤出可视区
  - **根因**：`.modal` 类只设了 `width` 没设 `max-height + overflow`，子内容无限撑高
  - **解法**：新增 `.modal-scrollable` 辅助类（不破坏现有三选项对话框/browse 弹窗）——`max-height: 88vh` + `display: flex; flex-direction: column`，内部拆成 `.modal-head`（顶栏含关闭）/ `.modal-scroll`（独立滚动区）/ 可选 `.modal-foot`（底栏）三段式。设置面板用这个类重构，扫描目录无论多长，"添加"栏始终可见
- **P3 · 移除/添加后目录树"感觉没刷新"**：`updateRoots` 其实调用了 `loadTree(true)`，但用户看不到变化
  - **根因**：设置面板在前景，侧边栏被挡住；成功 toast 信息太简短
  - **解法**：
    1. toast 副标题从 `undefined` 改为 `"目录树已刷新"` 明示
    2. `removeRoot` 成功后显式 `sidebarCtl.show(true)` 让侧边栏保证可见

### 📐 架构

- 新增 `safeFetchJson(url, opts)` helper 函数（web/app.js），建议后续所有 fetch 调用渐进迁移

### 📂 File Structure

| 文件 | 改动 | 说明 |
|---|---|---|
| `web/app.js` | Modify | 新增 safeFetchJson helper；4 个 root 相关函数改用它；removeRoot 补 sidebarCtl.show(true) |
| `web/style.css` | Modify | 新增 `.modal-scrollable` 三段式布局（modal-head / modal-scroll / modal-foot） |
| `web/index.html` | Modify | 设置面板重构为 `.modal-scrollable` 三段式；版本号 bump 到 ?v=1.5.3 |
| `ITERATION-SOP.md` | Modify | 新增铁律 2：改代码后必须重启 server（防旧进程陷阱） |

### ✅ 验证（verification-before-completion）

- `curl -X POST /api/config` 合法 payload → 返回合法 JSON，HTTP 200
- `curl -X POST /api/config` 不合法 payload → 前端 toast 显示 "HTTP 400/500: ..." 而非 "Unexpected non-whitespace"
- 11 条扫描目录的设置面板 → "添加"输入框和"关闭"按钮始终可见

---

## [v1.4.2] — 2026-04-27 · 15:41 · 批注反馈 + 缓存刷新修复

> 修复两个用户体验问题：批注按钮点击无反馈、文件更新后刷新无效。

### 🐛 Bug 修复

- **批注按钮静默**：点击工具栏「💬 批注」按钮没有任何反馈，用户不知道下一步该做什么。根因：`startAnnotation()` 只初始化监听器，不做任何 UI 响应。修复：点击时检测是否有选中文字——有则正常走流程；无则弹出 toast 提示「请先选中要批注的文字」
- **文件刷新无效（CodeBuddy 预览框场景）**：在 CodeBuddy IDE 的预览框中查看 HTML 文件时，源文件更新后手动刷新仍显示旧内容。根因：浏览器/WebView 对 iframe 内容的缓存策略不完全受 `Cache-Control: no-store` 控制。修复：三管齐下 (1) `API.file()` 加 `_t=时间戳` 参数破缓存 (2) server.py 响应头增加 `Pragma: no-cache` / `Expires: 0` / `Vary: *` 多层防御 (3) 🔄 刷新按钮同时重载当前打开的文件

### 🎨 UX 改进

- 🔄 按钮行为升级：原来只刷新目录树 → 现在同时刷新目录树 + 重载当前文件（如有）

---

## [v1.4.1] — 2026-04-22 · 11:52 · 添加目录去重 + 即时反馈

> 修复添加扫描目录时"无反馈 + 重复添加"两个 Bug。

### 🐛 Bug 修复

- **重复添加**：前端去重用原始路径对比，但服务端 resolve 后路径格式不同，导致同一目录可被重复添加多次。修复：前端规范化路径（去尾部斜杠、展开 `~`）后再对比；服务端 resolve 后也用 `seen_paths` 集合做二次去重
- **无反馈**：点击"添加"按钮后无任何视觉反馈，用户以为没生效会反复点击。修复：点击后立即显示"添加中…"按钮禁用态 + toast 提示，完成后恢复

### 🔧 功能

- 一次性清理配置文件中已有的 3 条重复 scan_roots 条目（9→6）

---

## [v1.4.0] — 2026-04-20 · 12:00 · 扫描目录开关

> 扫描目录从"只能添加/移除"升级为 **toggle 开关 + 移除**。关闭 = 暂停扫描但保留配置，打开 = 恢复扫描。数据结构从 `[str]` 升级为 `[{path, enabled}]`，旧配置自动迁移无感。

### 🔧 功能

- **Toggle 开关**：设置面板每个扫描目录左侧新增绿色开关，打开=扫描，关闭=不扫描但保留在列表中（半透明展示）
- **移除降级**：从醒目的红色按钮降为灰色小链接，仍保留 confirm 确认
- **旧配置自动迁移**：首次启动检测到旧格式 `["path"]` 自动转为 `[{path, enabled: true}]`，用户零感知

### 📐 架构

- **数据结构升级**：`scan_roots` 从 `[string]` → `[{path: string, enabled: boolean}]`
- 新增 `_normalize_scan_roots()` 格式兼容 + `_enabled_root_paths()` / `_all_root_paths()` 两个 helper
- `_scan_tree` / `get_tree` / `cleanup_old_snapshots` 只处理 enabled 的根
- `_resolve_safe` 兼容新旧两种格式，禁用的根下已打开文件仍可保存
- 前端 CSS/JS 加 `?v=1.4` cache-busting，避免浏览器缓存旧文件

### 📂 File Structure

| 文件 | 改动 | 说明 |
|---|---|---|
| `server.py` | Modify | 新增格式迁移/helper 函数；_scan_tree/get_tree/cleanup 用 enabled 过滤；_resolve_safe 兼容对象格式；handle_config_post 支持新格式 |
| `web/app.js` | Modify | renderScanRoots 改为 toggle + 路径 + 移除链接；新增 toggleRoot()；addRoot/removeRoot 兼容对象格式 |
| `web/style.css` | Modify | 新增 .toggle-switch/.toggle-slider 开关样式；.root-disabled 半透明；.root-remove 灰色链接 |
| `web/index.html` | Modify | CSS/JS 引用加 ?v=1.4 cache-busting |

---

## [v1.3.0] — 2026-04-19 · 16:20 · Markdown 支持

> **DocCenter 不再只是 HTML 工作台**。新增 `.md` 文件扫描/打开/编辑/保存全链路，复用现有 iframe + saver-runtime + 三选项保存架构，HTML 能力 0 退化。

### 🔧 功能

- **递归扫描 `.md`**：目录树显示 `.html` 📄 和 `.md` 📝，`/api/tree` 同时返回两种节点
- **MD 编辑器壳子页面**（`web/md-editor.html`）：左 textarea 等宽编辑 + 右侧实时预览（marked 渲染，150ms debounce），头部显示文件名和脏状态胶囊
- **本地 vendor marked v11.2.0**（`web/vendor/marked.min.js`，35KB）：离线可用无外网依赖
- **三选项保存全覆盖**：`.md` 文件的 overwrite / new / discard 流程与 HTML 完全一致；另存文件扩展名跟随源文件（`.md → -审阅版-*.md`，不再硬编码 `.html`）
- **自动快照支持 `.md`**：编辑 2 秒后写入 `_auto-save/{stem}-{ts}.md`；滚动保留 20 个
- **上次会话恢复**：`last_session` 白名单扩到 `(.html, .md)`

### 📐 架构

- **iframe + saver-runtime 架构复用**：MD 不新开视图，后端按文件后缀分流——`.html` 走原 `inject_saver`；`.md` 走新增 `render_md_shell()`（读 `web/md-editor.html` 模板 + 占位符注入 MD 原文 / 文件名 / 路径 / server origin）
- **saver-runtime.js `mode` 分流**：通过 `window.__DOC_CENTER__.mode === "md"` 判定——md 模式监听 `textarea#md-input` 的 input 事件，`serializeContent()` 返回 `textarea.value`；html 模式完全保留原来的 MutationObserver + 用户交互窗口 三道护栏，0 改动
- **postMessage 协议 0 变**：`ready / dirty_changed / snapshot_ok / html_content / request_html / mark_clean` 六个消息名保留，MD 场景下 `html_content` 的 payload 语义为 MD 原文字符串（字段名保留向后兼容）

### 🐛 Bug 防范（新老两处隐式 Bug 一并修掉）

- **快照/备份扩展名跟随源文件**：之前 `handle_snapshot` 硬编码 `.html`，MD 的快照会写成 `.html`（语义错乱）；同理 `handle_save` overwrite 的 pre-overwrite 备份也硬编码 `.html`，备份 MD 会写成 `.html`
- **`_clean_auto_save` 误伤 pre-overwrite 备份**：扩展名改为跟随源 suffix 后，备份和快照前缀相同会被一起清理——新增 `backup_prefix` 白名单保护，`pre-overwrite-*` 文件只由 `cleanup_old_snapshots` 按 mtime 过期清理
- **`DEFAULT_CONFIG['last_session']` KeyError 隐患**：之前 `handle_last_session_get` 回退用 `DEFAULT_CONFIG["last_session"]` 直接访问（但 DEFAULT_CONFIG 根本没这个 key），顺手改成 `.get(..., {})` 兜底

### 📂 File Structure

| 文件 | 改动 | 说明 |
|---|---|---|
| `server.py` | Modify | 6 处改动：`_walk_dir` 扩 md；`handle_file` 按 suffix 分流；新增 `render_md_shell()`；`handle_last_session_get` 白名单扩 md；`handle_save` mode=new/overwrite 备份按源 suffix；`_clean_auto_save` + `handle_snapshot` 滚动保留按源 suffix 过滤 + 保护 pre-overwrite 备份 |
| `web/md-editor.html` | Create | MD 编辑器壳子，4 个占位符：`{{MD_CONTENT}} {{FILE_NAME}} {{FILE_PATH}} {{SERVER_ORIGIN}}` |
| `web/vendor/marked.min.js` | Create | marked v11 UMD 本地 vendor |
| `saver-runtime.js` | Modify | `MODE="md"` 分支：status 胶囊、textarea input 监听、serializeContent 返回 textarea.value |
| `web/app.js` | Modify | `countFiles` 扩 md；`createFileLabel` icon 按 type 区分；空态 / 统计文案扩到"文档" |
| `web/index.html` | Modify | 空态 / 面包屑 / 对话框 / hint 文案扩到 HTML / Markdown |

### ✅ 验证（verification-before-completion）

- `/api/tree` 返回 `md_nodes=251  html_nodes=305`（跨 outputs/ 和"迁移服务产品化"两个根）
- `/api/file?path=<.md>` 返回 6841 字节壳子 HTML，10/10 关键字段校验通过（md-input/md-preview/marked import/saver import/mode=md/文件名/路径/MD 原文注入）
- 快照写入 `.md` 扩展名，overwrite 备份 `.md` 扩展名，清理时保留备份只清快照
- HTML 文件回归：saver-injected marker / __DOC_CENTER__ / /saver-runtime.js 引入全部保留，无 mode=md 残留

---

## [v1.2.1 → v1.2.6] — 2026-04-18 · 13:16 → 14:48（快速迭代合集）

> **v1.2 首发后的 6 轮现场打磨**。根据实测反馈，1 小时 48 分钟内完成"上线 → 反馈 → 修复"×6 的高密度迭代闭环。

### v1.2.6（14:48）🐛 会话恢复被覆盖 Bug 修复

- **问题**：用户打开 A 文件后刷新浏览器，结果恢复成更早打开的 B 文件（而不是刚才看的 A）
- **根因**：每次 `openFile()` 都无条件写 `last_session`。**会话恢复流程** `tryRestoreLastSession → openFile(silent)` 触发时也会回写一次——在多 tab 场景下，后台 tab 的恢复流程会反复把自己的 last_session 写回去，覆盖前台 tab 新选择的文件
- **解法**：
  1. `openFile` 增加 `opts.silent` 判断：会话恢复时**不回写** last_session
  2. `saveLastSession` 加 `document.visibilityState === "hidden"` 守护：后台 tab 的自动写入被阻断
- **顺带清理**：删除 `openFile` 里残留的 `$("#btn-force-save").disabled` 代码（v1.2.5 已移除该按钮）

### v1.2.5（14:05）🎨 删除 💾 冗余按钮

- 原按钮点击行为与"关闭/切换自动弹对话框"完全重合，且 90% 时间处于 disabled 状态占位
- 顶栏右侧精简为 `✕ 关闭`，三选项对话框作为唯一"落地决策点"

### v1.2.4（13:55）🐛 脏状态误报修复

- **问题**：切换文件时频繁弹出"未保存修改"对话框，但用户并未编辑
- **根因**：`saver-runtime.js` 的 MutationObserver 监听了 `attributes: true`，页面动画/CSS 过渡/滚动高亮都被误判为编辑
- **解法**：三道护栏——
  1. **用户交互窗口**：只有 800ms 内发生过 `keydown/mousedown/paste/cut/drop` 的 DOM 变更才算脏
  2. **忽略 attributes**：只监听 `childList + characterData`
  3. **延迟 1 秒绑定**：避开页面 JS 初始化的 DOM 抖动
- 附加：忽略 `<script>/<style>` 自身变化

### v1.2.3（13:40）🎨 放弃扁平化，回归真实嵌套

- **问题**：首版把深层目录扁平化合并到一级，`_common/xxx` / `_common/images/xxx` 前缀冗余占满视野
- **根因**：过度诠释"仅展示一级目录"需求
- **解法**：恢复真实嵌套；扫描根默认展开，其他目录默认收起；打开文件时只展开当前文件的父链
- **反思**：需求有歧义时应该先问"A 还是 B"

### v1.2.2（13:23）🎨 首次刷新默认展开侧边栏

- **问题**：会话恢复后侧边栏默认关闭，用户看不到"自己在哪、还能去哪"
- **解法**：首次刷新一律 `show(true)` pinned 展开；有上次文件则自动滚动到高亮
- **原则**：Nielsen #6「可见性胜于记忆」

### v1.2.1（13:16）🎨 "全部收起"按钮消歧

- **问题**：原按钮文案"⇱ 全部收起"放顶部，容易被误解为"收起整个侧边栏"
- **解法**：
  1. 文案改为 `🗂 折叠所有文件夹`
  2. 位置从顶部挪到底部 footer，与文件数统计并排
  3. 样式降级为次要操作（灰色幽灵按钮）
- **Tooltip 主动消歧**：「折叠目录树中所有文件夹（不会隐藏侧边栏）」

---

## [v1.2] — 2026-04-18 · 13:00（首发）

### 🎨 UX 优化

| # | 改动 | 影响 |
|---|------|------|
| 1 | **聚焦式目录** | 从"全平铺"升级为两层结构（扫描根 + 一级子目录），更深层级 HTML 扁平化合并；默认全收起，打开文件时自动展开当前分支并 scrollIntoView |
| 2 | **高亮强化** | 金色左边条 + 加粗 + 米黄渐变底 + icon drop-shadow，视觉一眼聚焦 |
| 3 | **扁平化路径提示** | 扁平化模式下文件名前附加子目录前缀（小字次要色），保留"我是谁"的信息 |

### 🔧 新功能

| # | 功能 | 说明 |
|---|------|------|
| 1 | **一键收起** | 搜索框旁新增 `⇱ 全部收起` 按钮（按用户要求不提供"一键展开"，强化聚焦原则） |
| 2 | **会话恢复** | 首次进入自动打开上次文件 + 恢复缩放级别；文件被移动/删除时静默回退不报错 |
| 3 | **文件 icon 菜单** | 点击 📄 弹出 3 项：在 Finder 打开 / 复制完整路径 / 复制文件名 |
| 4 | **文件夹 icon 菜单** | 点击 📁 弹出 2 项：在 Finder 打开此目录 / 复制目录路径 |
| 5 | **点文件名行为不变** | 依然是在 DocCenter 内部 iframe 打开（保持工作流） |
| 6 | **CHANGELOG 入口** | 设置面板 ⚙️ 内新增 `📖 查看完整更新日志` 链接 → 打开时间轴风格的 `CHANGELOG.html` |

### 🐛 Bug 修复

| # | 问题 | 根因与解法 |
|---|------|------|
| 1 | 首次启动鼠标划过目录后自动收起 | `init()` 里有 2.5s 定时 `hide()`，配合 `show(false)` 非 pinned 模式会强制收起 → 删除该定时器，改为两种策略：有上次文件则保持关闭、无上次文件则 pinned 展开 |
| 2 | 空态时目录也会自动收起 | 符合用户"空白时保持展开"的原则，空态/关闭文件后强制 `show(true)` |

### 🔒 后端新增

- `POST /api/reveal {path}` — 在系统文件管理器中高亮该文件（macOS `open -R` / Windows `explorer /select` / Linux 兜底 `xdg-open`）
- `GET/POST /api/last_session` — 读写上次会话（absPath + zoom），存入 `~/.codebuddy/html-doc-center/config.json`
- `GET /changelog` — 返回 `CHANGELOG.html` 时间轴页面

### 📐 架构

- 前端 `app.js` 从 536 行 → 约 620 行，新增 `iconMenuCtl` / `scrollToActiveFile` / `tryRestoreLastSession` / `collapseAll` 模块
- 后端 `server.py` 新增 3 个 handler，配置结构向后兼容（新增 `last_session` 字段）

---

## [v1.1] — 2026-04-18

### 🎨 UX 优化（本轮）

| # | 改动 | 影响 |
|---|------|------|
| 1 | **顶栏三合一** | 删除 48px 第二工具栏，面包屑 / 状态 / 缩放 / 保存按钮全部集成到 44px 顶栏 — **省出 48px 垂直空间** |
| 2 | **目录推挤布局** | 从 `position: absolute` 浮动抽屉改为 flex `width: 0 → 300px`，打开时编辑区**同步收缩**，不再遮挡正文 |
| 3 | **缩放档位重构** | 6 档 `25% / 50% / 75% / 100% / 125% / 150%`（删 Fit），**默认 75%**（更贴合桌面 HTML 实际舒适比例） |
| 4 | **双工具栏去重** | `saver-runtime.js` 增强原生编辑器嗅探（识别 `.toolbar` + 「批注」/「编辑」文字），匹配 OPPO v2 等报告，有原生编辑器时完全跳过 DocCenter 工具栏注入 |
| 5 | **快捷键调整** | `⌘0` 还原到默认 75%（从原 100% 改） |

### 🛠 修复

- Playwright 截图脚本禁用 HTTP 缓存（`--disable-cache` + 请求头），确保每次抓到最新 CSS/JS

### 📸 验收

- 4 张 v1.1 截图归档：`docs/screenshots/v1.1-2026-04-18/*.png`
- Success Criteria 全部达成 6/6

---

## [v1.0] — 2026-04-18

### 🎉 首版发布

**核心能力**：
- aiohttp 后端（端口 9901）+ 5 大 API（`/api/tree` `/api/config` `/api/file` `/api/snapshot` `/api/save`）
- 目录树扫描（3s mtime 缓存）+ 白名单安全校验
- 自动快照机制：编辑/批注 2s 后自动保存到 `{原目录}/_auto-save/`
- 关闭时三选项对话框：覆盖源文件（含备份）/ 另存为审阅版（路径自动复制）/ 丢弃草稿
- `saver-runtime.js`（263 行）：嗅探原生编辑器或动态注入工具栏
- 44px 极简顶栏 + 左上 Fitts 黄金位目录按钮（⌘B）
- 5 档缩放 `Fit / 75% / 100% / 125% / 150%`（默认 100%）
- 深色顶栏 `#1A1D23` + 浅米底 `#FAFAF7` + 金色强调 `#C9A961`

**文档**：
- README.md 完整使用说明
- launchd.plist.example 开机自启模板
- 4 张 v1.0 首版截图
