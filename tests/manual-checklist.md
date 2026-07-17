# Manual Test Checklist — v1.19 Finder modal + drag-editable

> 按 DocCenter 反 Bug 5 条铁律（memory 84066387）执行：真实浏览器演练，每个场景写出"我点了 X 看到了 Y"。

## API 层验证（已通过 curl 完成）

- [x] `GET /api/browse?mode=file` 返回 `files` 字段（root 时为空数组）
- [x] `POST /api/drag-upload` 接收 HTML 文件 → 写到 `_dropbox/` → 返回 `{ok, abs_path, name, type}`
- [x] `POST /api/save-as` 复制文件到目标路径 → 返回 `{ok, dest_path}`
- [x] 18 个 pytest 单元测试全部通过

## 前端浏览器演练（需手动执行）

### 场景 1：打开文件主流程

- [ ] 点 sidebar 📂 按钮（＋ 右边的新按钮）
- [ ] modal 弹出，标题"打开文件"，确定按钮"打开此文件"
- [ ] 左侧栏显示 Shortcuts/Pinned/Recent 3 个 section
- [ ] 右侧显示当前目录的子目录 + HTML/MD 文件，按 Today/Earlier 分组
- [ ] 双击子目录 → 进入，列表更新
- [ ] 双击 HTML 文件 → modal 关闭 + 文件打开可编辑
- [ ] 改一行内容 → 2 秒后 `_auto-save/` 有快照
- [ ] 关闭按钮 → 弹"覆盖/另存/丢弃"三选一
- [ ] 选覆盖 → 原文件被改

**结果记录**：我点了 X 看到了 Y...

### 场景 2：拖入编辑流程

- [ ] 从 Finder 拖 HTML 文件到 DocCenter 编辑器
- [ ] 立即可编辑（不是只读预览）
- [ ] 面包屑显示"📥 Dropbox 副本"标记
- [ ] 改一行 → 关闭按钮弹"另存为/丢弃"二选一
- [ ] 选另存为 → 输入目标路径 → 保存成功
- [ ] `_dropbox/` 副本仍在

**结果记录**：...

### 场景 3：添加文件夹回归

- [ ] sidebar ＋ 按钮 → modal mode=folder → 选目录 → 加入扫描根
- [ ] 侧栏出现新根
- [ ] 点击其中的文件能编辑

**结果记录**：...

### 场景 4：最近打开 tab

- [ ] 打开 3 个文件
- [ ] 切到侧栏 🕐 Recent tab
- [ ] 看到 3 条记录，每条含图标 + 文件名 + 时间
- [ ] 点击其中一条 → 直接打开

**结果记录**：...

### 场景 5：左侧栏 Recent 入口

- [ ] sidebar 📂 按钮 → modal 左侧 🕐 Recent section
- [ ] 看到最近 5 条
- [ ] 点击一条 → 直接 openFile，modal 关闭

**结果记录**：...

## 跨浏览器（Chrome / Safari / Firefox）

- [ ] Chrome：场景 1+2 通过
- [ ] Safari：场景 1+2 通过
- [ ] Firefox：场景 1+2 通过

## 回归测试

- [ ] 现有"添加文件夹"功能（mode=folder）100% 不变
- [ ] 现有侧栏文件点击编辑/保存流程不变
- [ ] 现有 session restore 不变
- [ ] `python3 -m pytest tests/ -v` 全部通过

## 反 Bug 5 条铁律自检

- [ ] 真实浏览器演练（不是 curl 200 就算通过）
- [ ] 守卫表达式显式验证
- [ ] CSS 改 .active/display 前 grep inline style 残留
- [ ] DOM 切换后依赖动作用 rAF
- [ ] 自驱模式 ≠ 跳过用户视角
