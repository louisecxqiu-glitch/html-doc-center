# 开源桌面版发布治理设计

**日期**：2026-07-22
**状态**：已批准执行
**范围**：HTML Studio 开源桌面版的 GitHub CI、可复现构建、签名公证发布与下一轮功能开发准备。

## 目标

将已经完成的 v2.7.0 公众号排版功能发布为一个可追溯、可验证的 GitHub Release，并建立之后每次功能迭代都可复用的最小发布链路：

1. 所有 Pull Request 与 `main` 推送先运行自动检查；
2. 只有 `vMAJOR.MINOR.PATCH` Tag 才触发正式构建和 GitHub Release；
3. macOS 产物使用 Developer ID、Hardened Runtime、notarytool 和 stapler；
4. Windows 与 macOS 产物都附带 SHA-256 校验文件；
5. 证书、私钥、API Key 只存在 GitHub Secrets 或本地钥匙串，绝不提交到仓库；
6. 工作区中与本次发布无关的未提交变更不进入 v2.7.0。

## 非目标

- 不引入 SaaS、云端用户数据、灰度发布或付费能力；
- 不把 Apple 凭据写入脚本、文档示例或 Git 历史；
- 不自动修改 GitHub 的分支保护或环境审批规则（这些会影响协作者，保留为仓库管理员的一次性设置）；
- 不将未签名、未公证的 macOS DMG 标记为正式发行版。

## 发布模型

```text
feature/fix branch -> Pull Request -> CI（pytest + 编译/元数据检查）
                                      |
                                     main
                                      |
                              git tag v2.7.0
                                      |
                         Release workflow（受保护环境）
                           |                         |
                     macOS arm64 DMG             Windows EXE
                 签名 -> 公证 -> staple            构建
                           \                         /
                            SHA256SUMS + GitHub Release
```

## 版本与回退

- `VERSION` 是构建版本号的唯一来源；Tag 必须严格等于 `v${VERSION}`。
- 本次发布使用 `2.7.0` / `v2.7.0`，与现有 CHANGELOG 功能条目保持一致。
- 任何正式版本均不可覆盖；发现线上问题时，创建修复提交并发布新的 Patch Tag（例如 `v2.7.1`）。GitHub Release 可将有问题的版本标为 pre-release/撤回说明，但不应重写已发布 Tag。
- `main` 始终可构建；新功能在 `feat/*` 分支完成，PR CI 通过后再合并。

## 安全边界

- macOS 正式工作流绑定 `desktop-release` 环境；Secrets 由 GitHub 在 runner 中注入。
- `.p12`、`.p8`、密码、Issuer ID 与 Key ID 不写入源码、工件和日志。
- 临时 keychain 与 `.p8` 位于 GitHub runner 临时目录；工作流结束后由托管 runner 清理。
- 发版前脚本校验版本、必要文件与工作流契约；macOS 脚本在公证返回 `Accepted` 前不产生“发布成功”的结论。

## 验收

1. CI 工作流只做无凭据检查，能在 PR 与 `main` 推送运行；
2. Release 工作流仅由 `v*` Tag 触发，并在 Tag/`VERSION` 不匹配时失败；
3. 本地检查覆盖版本、工作流、打包元数据、pytest 和 Python 编译；
4. `main` 推送后，Tag `v2.7.0` 触发 GitHub Actions；
5. 仅当两个平台构建均成功时才创建 GitHub Release，附件包含 DMG、EXE 与 `SHA256SUMS.txt`；
6. 若 GitHub Secrets 尚未配置，停止在正式 Tag 之前并报告准确缺项，不降级发布未公证 DMG。
