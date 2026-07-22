# 产品审计 · Round 07（首次打开工作区聚焦）

**角色**：从 Finder、浏览器书签或聊天链接直接打开某个项目文档的知识工作者
**日期**：2026-07-22

## 问题

Safari 没有既有本地偏好时，虽然 URL 已经直达 `html-doc-center/articles/macos-dmg-distribution.md`，侧栏仍默认显示 All workspaces（**2 root(s) · 6246 document(s)**）。用户看见的内容量与当前任务不匹配。

## 修复

- 区分「没有任何已保存选择」与「用户主动选择了 All workspaces」。
- 仅在前者且已成功打开文件时，选择包含该文件的最深扫描根，并持久化这个初始选择。
- 已保存的工作区选择不被 URL 或会话恢复覆盖。

## TDD 与真实验证

- 先新增静态回归契约，确认在缺少实现时失败；实现后 `tests/test_workspace_scope_static.py` 通过。
- 在 Safari 清洁的工作区偏好状态下刷新同一文件直达 URL，选择器自动为 `html-doc-center`，文件树变为 **1 root(s) · 91 document(s)**。

## 付费判断

这个修复消除了多项目使用时最容易打断注意力的首次入口问题。核心浏览、写作、公众号预览与复制已获得 Chromium 和 Safari 的真实回归；下一项仍是无用户内容样本的快照恢复演练。
