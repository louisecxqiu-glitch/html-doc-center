# HTML Studio 开源桌面版发布治理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 以 v2.7.0 发布已完成的公众号排版功能，并建立开源桌面版的 PR CI、Tag Release、校验文件与发布运行手册。

**Architecture:** 将检查和正式发布拆成两条 GitHub Actions 工作流。`ci.yml` 无凭据、在 Pull Request 和 `main` 上运行；`release-oss.yml` 仅接受 `v*` Tag，macOS job 在 `desktop-release` 环境中读取 Secrets，构建/签名/公证后与 Windows EXE 一起生成 SHA-256 清单并创建 GitHub Release。

**Tech Stack:** Python 3.12、pytest、PyInstaller、GitHub Actions、Developer ID codesign、Apple notarytool/stapler、Git 标签与 GitHub Release。

## 全局约束

- 正式发布版本必须是 `VERSION` 中的 SemVer 值与 `v${VERSION}` Tag 的严格匹配。
- 严禁提交或打印 Apple API 私钥、`.p12`、密码和 Secrets。
- 不将当前工作区中 `web/*`、本地化或 Dropbox 的未提交改动纳入本次发布。
- 发布主线由用户明确授权在 `main` 上进行；之后新功能默认在 `feat/*` 分支开发。
- 代码、配置或文档改动必须通过自动化检查，并在完成前写入本计划的真实执行结果。

## File Structure

| 文件 | 改动 | 责任 |
| --- | --- | --- |
| `VERSION` | Modify/Create | v2.7.0 唯一构建版本 |
| `scripts/verify_release.py` | Create | 本地/CI 无凭据发布契约检查 |
| `tests/test_release_governance.py` | Create | 验证工作流与版本校验契约 |
| `tests/test_packaging.py` | Modify | 对齐 v2.7.0 打包版本 |
| `.github/workflows/ci.yml` | Create | PR 与 main 自动检查 |
| `.github/workflows/release-oss.yml` | Create | Tag 正式构建与 GitHub Release |
| `.github/workflows/build.yml` | Delete | 移除混合旧工作流，避免双重发布 |
| `docs/macos-release.md` | Modify | GitHub Secrets、安全边界、手动排障与发布流程 |
| `docs/release-runbook.md` | Create | 版本、Tag、回退与新功能分支操作手册 |
| `CHANGELOG.md` | Modify | 记录 v2.7.0 的发布交付方式 |
| `README.md` | Modify | 更新用户下载文件名与安装说明 |
| `docs/superpowers/plans/2026-07-22-oss-release-governance.md` | Modify | 勾选实施与验证结果 |

---

### Task 1: 先建立发布契约测试与版本基线

**Why:** 版本、工作流触发条件和产物名称若没有自动检查，Tag 后才发现错误会浪费 Apple 公证队列和 GitHub runner。

**Files:**
- Create: `tests/test_release_governance.py`
- Modify: `tests/test_packaging.py`
- Create/Modify: `VERSION`

- [x] **Step 1: 写失败测试，描述 v2.7.0、两工作流和 Tag/版本严格匹配。**
- [x] **Step 2: 运行 `python3 -m pytest tests/test_release_governance.py -q`，确认旧工作流结构不满足测试。**
- [x] **Step 3: 将 `VERSION` 统一为 `2.7.0`，实现最小 `scripts/verify_release.py` 并让测试转绿。**
- [x] **Step 4: 运行 `python3 -m pytest tests/test_packaging.py tests/test_release_governance.py -q`。**

### Task 2: 拆分 GitHub CI 与正式 Release 工作流

**Why:** PR 检查不能依赖签名密钥；正式发布必须只在明确 Tag 下运行，避免测试分支意外消耗公证凭据。

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/release-oss.yml`
- Delete: `.github/workflows/build.yml`
- Create/Modify: `scripts/verify_release.py`

- [x] **Step 1: 创建失败测试，要求 CI 监听 PR/main，Release 仅监听 `v*` Tag、绑定 `desktop-release` 环境并包含校验清单。**
- [x] **Step 2: 运行目标测试，确认旧混合工作流不满足要求。**
- [x] **Step 3: 实现两个工作流：CI 执行 pytest、compileall、发布契约检查；Release 执行版本校验、macOS 签名/公证、Windows 构建、SHA256SUMS 和 GitHub Release。**
- [x] **Step 4: 运行发布契约测试与 `python3 scripts/verify_release.py --check`。**

### Task 3: 记录凭据、安全、回退与下一功能分支方式

**Why:** 发布不是一份 YAML；需要让后续开发者知道哪些操作在本地、哪些在 GitHub 环境完成，以及新版本出问题怎样安全回退。

**Files:**
- Modify: `docs/macos-release.md`
- Create: `docs/release-runbook.md`
- Modify: `README.md`
- Modify: `CHANGELOG.md`

- [x] **Step 1: 更新 macOS 文档：Developer ID、App Store Connect team API key、GitHub Environment Secrets、`--wait` 公证和 stapling 验证。**
- [x] **Step 2: 写 Release Runbook：`feat/* -> PR -> main -> Tag -> Release`、Secrets 设置、失败排查、Patch 回退、检查 SHA-256。**
- [x] **Step 3: 更新 README 下载说明和 CHANGELOG 的发布交付内容。**
- [x] **Step 4: 运行链接/文本静态检查并人工审阅不含凭据。**

### Task 4: 本地验证、提交、推送与 Tag 发布

**Why:** 只有从干净、通过验证的提交创建 Tag，GitHub Release 才具备可追溯性。

**Files:**
- Stage only: Task 1–3 的发布治理文件与既有 macOS 打包文件

- [x] **Step 1: 运行 `python3 -m pytest -q`、`python3 -m compileall -q build.py scripts/release_macos.py scripts/verify_release.py` 和 `python3 scripts/verify_release.py --check`。**
- [x] **Step 2: 审查 staged diff，确保未将 `web/*`、locale、Dropbox 等当前无关改动纳入。**
- [ ] **Step 3: 创建发布准备 commit，推送 `main`，检查 GitHub Secrets 的名称（不读取值）。**
- [ ] **Step 4: 只有 Secrets 齐备且 remote/main 成功时，创建并推送 `v2.7.0` Tag；监控 Actions，确认 Release 与附件结果。**

## 验收标准

- [x] `VERSION` 为 `2.7.0`，且发布脚本、测试、Tag 都使用同一版本。
- [x] PR/main CI 与 v* Release 工作流分离；macOS 凭据只在 `desktop-release` job 环境使用。
- [x] Release 含 macOS DMG、Windows EXE 和 `SHA256SUMS.txt`。
- [x] 全量 pytest、Python 编译、发布契约检查在本地通过。
- [ ] GitHub Secrets 若缺失则没有推送正式 Tag；若齐备，v2.7.0 Tag 对应 Actions 与 Release 已验证。
