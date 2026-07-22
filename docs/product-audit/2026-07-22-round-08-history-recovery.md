# Round 08 · Markdown history recovery and non-default-port audit

**Persona:** 自媒体写作者 / 上班族。用 HTML Studio 修改一篇教程，并需要在误改后找回版本。

## What I tested

1. 通过 `http://127.0.0.1:9912`（非默认端口）直接打开临时 Markdown 文件。
2. 编辑为 v2，等待超过两秒。
3. 再编辑为 v3，等待超过两秒。
4. 打开「历史版本」抽屉并检查快照数量、时间、大小差异和恢复入口。
5. 用 aiohttp 临时工作区端到端验证 `POST /api/restore`：恢复内容并创建 `pre-restore` 安全备份。

## Evidence

- 修复前，Chrome 控制台记录 `TypeError: Failed to fetch`，编辑器状态显示“快照失败（离线？）”。
- 根因是 Markdown 壳页注入 `localhost:9901`，而测试服务实际运行在 `127.0.0.1:9904`。
- 修复后，在 `127.0.0.1:9912` 上，v2 和 v3 两次编辑均显示“草稿已缓存”。
- 历史抽屉显示两份自动快照，分别有时间、字节差异、预览、对比和恢复入口。
- `pytest tests/test_history_restore_api.py -q`：`1 passed`。恢复接口把 v2 写回源文件，并将原 v1 留为 `article-pre-restore-*.md`。

## Assessment

### Fixed blocker

非默认端口是桌面版常见运行方式：端口冲突自动切换、手动传 `--port`、测试环境都会触发。自动快照不可用会直接破坏“放心写、随时可回退”的核心承诺，因此这是一项付费前阻断问题。现在已被请求来源回传机制修复并回归覆盖。

### Interaction quality

历史抽屉把“自动快照 / 覆盖前备份 / 恢复前备份”的语义暴露得足够清楚；快照大小差异与对比入口让作者能先判断再恢复。一次恢复需要确认，符合防误操作预期。

### Remaining verification boundary

浏览器自动化环境无法在不超时的情况下完成原生 `confirm()` 弹窗的最后一次点击，因此本轮没有把真实临时文件写回。该限制没有产生写入：临时源文件保持 v1。恢复服务的完整写入与 pre-restore 备份已在隔离 aiohttp 工作区端到端验证。后续桌面人工验收应点一次“恢复”并确认对话框。

## Decision

核心写作路径的信心明显提升：直接打开文件、工作区聚焦、Markdown 公众号排版、富文本复制降级、自动快照和历史恢复 API 都已有自动化或真实浏览器证据。下一轮应做发布前全量回归与最终付费意愿复核。
