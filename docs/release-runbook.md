# HTML Studio 开源桌面版发布手册

本手册只覆盖开源桌面版。SaaS 环境、灰度、用户数据和云端部署不在本仓库的发布流程内。

## 日常新功能开发

```text
main -> feat/short-description -> Pull Request -> CI -> main
```

```bash
git switch main
git pull --ff-only origin main
git switch -c feat/short-description
# 开发、测试、提交
git push -u origin feat/short-description
```

在 GitHub 创建 PR 后，`Verify HTML Studio` 会运行 pytest、Python 编译和发布元数据检查。合并前应保持 CI 通过；不要直接在 feature 分支上打正式 Tag。

## 一次性 GitHub 安全设置

1. 在 **Settings → Environments** 创建 `desktop-release`。
2. 可选但推荐：配置 Required reviewers，正式发布前人工批准。
3. 在该环境添加以下 Secrets：
   - `MACOS_CERTIFICATE_P12_BASE64`
   - `MACOS_CERTIFICATE_PASSWORD`
   - `APPLE_API_KEY_P8_BASE64`
   - `APPLE_API_KEY_ID`
   - `APPLE_API_ISSUER_ID`
4. 在 **Settings → Branches** 为 `main` 设置 PR 必需和 CI 必需；个人单人仓库可先只开启“Require a pull request before merging”。
5. 不要把 `.p12`、`.p8`、Apple ID 密码、App 专用密码或任何 Secret 写入 Git、Issue、PR 和构建日志。

Apple 公证使用 App Store Connect **team API key**；个人 API key 不能用于 `notarytool`。密钥只能下载一次，丢失或泄露时应立刻在 App Store Connect 吊销并创建新 key。

## 正式发布

发布前，确认工作区干净或明确只提交计划内文件：

```bash
git status --short
python3 -m pytest -q
python3 -m compileall -q server.py build.py scripts/release_macos.py scripts/verify_release.py
python3 scripts/verify_release.py --check
```

更新 `VERSION`、`CHANGELOG.md` 后，创建并推送发布提交。只有当 `main` 已推送且 GitHub Secrets 齐备时才创建 Tag：

```bash
git push origin main
git tag -a v2.7.0 -m "Release v2.7.0"
git push origin v2.7.0
```

`Release HTML Studio` 将构建 Windows EXE，以及签名、公证、staple 的 macOS arm64 DMG。两个平台均成功后才创建 GitHub Release；下载者可用附件 `SHA256SUMS.txt` 校验：

```bash
shasum -a 256 HTMLStudio-2.7.0-macos-arm64.dmg
```

## 发布失败与回退

- **Tag/版本不一致**：不要修改旧 Tag。修正 `VERSION` 或创建新提交后，再创建正确的新 Tag。
- **CI 失败**：在 PR/`main` 修复，确认 CI 绿后才发布。
- **macOS 签名或公证失败**：查看 Actions 日志和 `notarization-result.json`；修复证书、Team API key 或签名问题后发布新的 Patch 版本，例如 `v2.7.1`。
- **已发布版本有产品问题**：在 GitHub Release 写明撤回说明/标记为 pre-release，立即从 `main` 创建 `hotfix/short-description`，修复后发 `v2.7.1`。不要强推、重写或复用 `v2.7.0` Tag；已下载用户需要可追溯的修复版本。
- **Secret 疑似泄露**：先在 GitHub 删除/轮换 Secret，再在 Apple 吊销对应证书或 API key，然后重新发布新版本。
