# Markdown 公众号排版模式设计

**日期**：2026-07-22  
**状态**：待用户审阅  
**范围**：在现有 HTML Studio Markdown 编辑器中增加独立的苹果风格公众号排版工作区。

## 目标

让用户打开 `.md` 文件后，可以从 Markdown 编辑器顶部进入“公众号排版”模式：

1. 左侧继续编辑 Markdown 原文；
2. 右侧实时显示苹果风格、适合微信公众号的排版预览；
3. 一键复制带 `text/html` 与 `text/plain` 的富文本；
4. 一键导出完整、自包含的 HTML 文件；
5. 不破坏现有的普通 Markdown 预览、三视图、自动快照和保存流程。

## 非目标

- 不替换现有普通 Markdown 预览；
- 不改动 HTML 文件的编辑逻辑；
- 不引入 npm、网络 Markdown 服务或第三方在线资源；
- 不把公众号排版内容自动发布到微信；
- 不在服务端保存用户的额外草稿或凭据。

## 用户入口与交互

在 `web/md-editor.html` 顶部现有视图切换工具栏增加按钮：

`📰 公众号排版`

点击后将当前 MD 编辑器切换到 `wechat` 工作区。原有 `原文 / 分栏 / 预览` 三个模式保留，点击它们即可退出公众号模式。

公众号工作区顶部显示两个动作：

- `复制 HTML`：写入富文本 HTML 和纯文本两种剪贴板格式，并显示成功/失败状态；
- `导出 HTML`：下载当前生成的自包含 HTML 文件，文件名默认为 `{原文件名}-wechat.html`。

工作区本身仍在当前 Markdown iframe 内，不新开窗口，不改变当前文件和自动保存语义。

## 架构

### 1. 前端模式层

复用现有 Markdown 编辑器的 `textarea#md-input` 和 `marked` 输入监听，新增 `data-view-mode="wechat"` 状态。

公众号模式的 DOM 结构为：

```text
md-header
  视图按钮：原文 / 分栏 / 预览 / 公众号排版
  操作按钮：复制 HTML / 导出 HTML
md-container[data-view-mode="wechat"]
  md-pane-source
    textarea#md-input
  md-splitter
  md-pane-preview
    iframe#wechat-preview-frame
```

普通 Markdown 预览继续由现有 `marked` 渲染；公众号预览使用服务端统一生成的完整 HTML，避免浏览器端再维护一套 Markdown 解析和苹果样式逻辑。

### 2. 本地格式化接口

新增本地只读接口：

`POST /api/wechat/format`

请求体：

```json
{
  "path": "/safe/scan/root/article.md",
  "content": "# 标题\n\n正文"
}
```

处理流程：

1. 使用现有 `_resolve_safe()` 校验路径；
2. 只接受 `.md` 文件；
3. 以源文件所在目录解析相对图片；
4. 调用 `tools.wechat_formatter.render_markdown()` 和文档包装器；
5. 返回完整 HTML、纯文本和文件名建议；
6. 不写入源文件、不创建快照、不联网。

前端以 250ms debounce 请求接口，并使用 `AbortController` 取消过期请求。格式化失败时保留上一次成功预览，并在状态胶囊中显示错误。

### 3. 剪贴板与导出

前端保存最近一次成功生成的 HTML：

- 复制：`ClipboardItem` 写入 `text/html` 与 `text/plain`；不支持富文本 Clipboard API 时退化为纯文本复制并提示用户；
- 导出：使用 Blob URL 下载服务端返回的 HTML，不经过服务端文件写入。

现有 Python formatter 继续作为唯一排版规则来源，图片以 `data:` URI 内嵌，复制和导出均不依赖外部 CSS、脚本或资源。

## 安全与错误处理

- 所有路径必须通过 `_resolve_safe()`，禁止借格式化接口读取扫描根目录之外的文件；
- 接口拒绝 `.html`、目录、缺失文件和非法 JSON；
- 图片解析沿用现有路径越界保护；
- 返回 HTML 使用现有转义和协议白名单；
- 不把 Apple ID、App 专用密码、证书、私钥或公证 ID 放进请求或生成文件；
- 前端请求失败不覆盖现有编辑内容，也不触发保存流程。

## 测试与验收

### 自动化

- formatter 现有单元测试继续通过；
- 新增 `/api/wechat/format` 测试：合法 MD、路径越界、非 MD、图片内嵌、错误请求；
- 新增前端静态检查：公众号按钮、`wechat` 状态、复制/导出动作存在；
- 运行全量 pytest。

### 真实浏览器

1. 打开 `.md` 文件，点击“公众号排版”；
2. 确认左侧原文、右侧苹果风格预览和本地图片均正常；
3. 修改 Markdown，确认预览更新且自动快照仍正常；
4. 点击“复制 HTML”，读取剪贴板确认同时存在 `text/html` 和 `text/plain`；
5. 点击“导出 HTML”，确认下载文件可独立打开；
6. 退出公众号模式，确认原有三视图和普通 Markdown 预览恢复；
7. 打开 HTML 文件回归验证原有编辑、批注、保存流程。

## 取舍

### 方案 A：同一 Markdown iframe 内切换公众号工作区（采用）

复用现有 textarea、自动保存和三视图状态，只增加一个模式和一个本地格式化接口。改动小、状态连续、用户不会丢失正在编辑的内容。

### 方案 B：新开独立窗口

视觉隔离更强，但需要同步窗口间内容、处理窗口关闭和浏览器弹窗限制，复杂度明显更高。

### 方案 C：只在主页面预览，不提供编辑

实现最简单，但用户必须在两个页面间来回切换，无法即时确认当前 Markdown 修改后的公众号效果。

