# macOS DMG 教程公众号排版工具设计

## Goal

为个人开发者准备一套可长期复用的公众号文章工作流：维护一份 Markdown 原稿，运行一个本地 Python 命令，生成可在浏览器中打开、全选复制并粘贴到微信公众号编辑器的单文件 HTML。

首篇文章主题是“macOS DMG 独立分发完整指南”，覆盖 Apple Developer 注册、Developer ID 证书、CSR、公证凭据、App 签名、DMG 打包、`notarytool` 公证、staple、Gatekeeper 验证和常见问题。文章必须明确区分“直接分发 DMG”和“上架 App Store”：前者不要求上架 App Store，但需要 Apple Developer Program、Developer ID 和公证。

## Architecture

```text
articles/*.md
      │
      ▼
tools/wechat_formatter.py
      │  Markdown 解析 + 图片内嵌 + 安全 HTML 转义 + 内联样式渲染
      ▼
articles/*-wechat.html
      │
      ▼
浏览器预览 → 全选复制 → 微信公众号编辑器
```

脚本是纯本地 CLI，不联网、不上传文章、不读取 Apple 密码，也不修改 HTML Studio 应用逻辑。输出 HTML 内含全部样式，避免微信公众号对外链 CSS 的兼容性问题。

## Tech Stack

| 部分 | 方案 |
| --- | --- |
| 运行时 | Python 3 标准库优先 |
| 输入 | Markdown UTF-8 文件 |
| 输出 | UTF-8 单文件 HTML |
| 样式 | Python 模板生成的内联 CSS |
| 预览 | macOS 使用 `open`，其他平台可输出路径 |
| 外部依赖 | 不引入 Node、Pandoc 或网络服务 |

脚本只实现文章所需的 Markdown 子集：标题、段落、粗体、斜体、链接、列表、引用、代码块、表格、分隔线和图片。所有文本和链接属性必须 HTML 转义，避免原稿内容破坏输出结构。

## File Structure

| 文件 | 用途 |
| --- | --- |
| `tools/wechat_formatter.py` | CLI 入口、Markdown 转换、内联样式渲染、输出和可选预览 |
| `articles/macos-dmg-distribution.md` | 首篇完整教程 Markdown 原稿 |
| `articles/assets/` | 文章引用的本地截图和插图，生成时转换为内嵌图片 |
| `articles/macos-dmg-distribution-wechat.html` | 首篇教程的生成示例，可直接预览和复制 |
| `tests/test_wechat_formatter.py` | 转换、转义、代码块、列表和 CLI 行为测试 |

## Content Design

首篇教程使用面向零经验个人开发者的叙事顺序：

1. 先解释为什么 Mac 独立分发需要 Developer ID 和公证。
2. 注册 Apple Developer Program，说明个人开发者年费和审核邮件。
3. 创建 CSR、Developer ID Application 证书并确认私钥配对。
4. 配置 App 专用密码和 `notarytool` 凭据。
5. 以项目现有的签名、DMG、提交、公证、staple、Gatekeeper 命令为主线。
6. 解释“登录钥匙串密码”与 Apple ID、App 专用密码的区别。
7. 用故障分支说明 Invalid、In Progress、签名被改写和重复提交的处理方式。
8. 以最终 DMG 路径、验证命令和自由分发边界收尾。

文章中的账号、Team ID、身份名称、提交 ID 和文件路径使用可替换占位符，不写入真实密码或私钥。

## Visual Design

- 白底、黑色正文、Apple 蓝色链接和强调色。
- 标题使用清晰的层级和较大留白。
- 代码块使用浅灰背景、等宽字体和横向滚动保护。
- 提示、警告和成功结果使用圆角卡片；颜色只承担语义，不依赖图标才能理解。
- 内容区域限制最大宽度，适配手机阅读。
- HTML 样式全部内联，避免外部资源影响公众号粘贴结果。

### Image Design

- Markdown 图片路径相对于原稿所在目录解析，默认读取 `articles/assets/` 下的本地文件。
- 输出时将 PNG、JPEG、WebP、GIF 等支持格式转换为 `data:` URI，保证 HTML 单文件自包含。
- 图片使用 100% 最大宽度、统一圆角和轻微阴影；不添加厚重边框、渐变或装饰性贴纸。
- 截图保持原始比例，不强制裁切；步骤图可在原图中保留蓝色编号和细线标注。
- 图片说明使用小字号、灰色文字和居中对齐；缺少说明时使用 Markdown 的 alt 文本。
- 超过合理大小的图片给出清晰警告，但不静默压缩或替换原图。

## Error Handling

- 输入文件不存在、无法读取或扩展名不适合时，返回非零退出码并给出明确中文错误。
- 输出目录不存在时自动创建；默认不覆盖原 Markdown。
- 输出 HTML 已存在时要求显式 `--force` 才覆盖，避免误删人工修改。
- `--open` 只负责本地预览失败提示，不影响 HTML 生成成功状态。

## CLI Contract

```bash
python3 tools/wechat_formatter.py articles/macos-dmg-distribution.md
python3 tools/wechat_formatter.py articles/macos-dmg-distribution.md --output /tmp/guide.html
python3 tools/wechat_formatter.py articles/macos-dmg-distribution.md --open
```

默认输出文件名为输入文件名加 `-wechat.html`；`--output` 覆盖输出路径；`--open` 在生成成功后打开本地文件；`--force` 允许覆盖已有输出。

## Validation

- 单元测试覆盖标题、段落、强调、链接转义、代码块、列表、引用、表格、图片和危险 HTML 转义。
- CLI 测试覆盖默认输出、显式输出、重复输出保护和 `--force`。
- 真实打开生成的 HTML，检查手机宽度下的排版、代码块和提示卡片。
- 用浏览器复制生成内容，确认粘贴到微信公众号编辑器后保留标题层级、颜色、代码块和链接。

## Scope Boundaries

- 本次不修改 `server.py`、`web/*`、`saver-runtime.js` 或打包流程。
- 本次不接入微信公众号 API，不自动发布文章。
- 本次不自动生成文章事实内容；Markdown 原稿负责事实和叙事，脚本负责稳定排版。
