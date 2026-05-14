/**
 * DocCenter — Chinese (Simplified) locale.
 * Keys must be in 1:1 correspondence with en.js.
 */
window.LOCALE_ZH = {
  // ====== meta ======
  'meta.title': 'HTML 文档中心 · 本地工作台',

  // ====== header ======
  'header.toggle_sidebar': '显示 / 隐藏目录（⌘B）',
  'header.label.files': '目录',
  'header.breadcrumb.empty': '从左侧目录选一个 HTML / Markdown 开始',
  'header.status.unopened': '未打开',
  'header.zoom.tooltip': '文档缩放',
  'header.zoom.25': '鸟瞰 25%',
  'header.zoom.50': '紧凑 50%',
  'header.zoom.75': '舒适阅读 75%',
  'header.zoom.100': '实际尺寸 100%',
  'header.zoom.125': '放大 125%',
  'header.zoom.150': '超大 150%',
  'header.close_file': '关闭当前文档',

  // ====== generic buttons ======
  'btn.history': '历史版本（H）',
  'btn.refresh': '刷新（R）',
  'btn.theme': '切换主题（自动 / 浅色 / 深色）',
  'btn.help': '键盘快捷键（?）',
  'btn.settings': '设置',
  'btn.cancel': '取消',
  'btn.confirm': '确定',
  'btn.close': '关闭',
  'btn.add': '添加',
  'btn.delete': '删除',
  'btn.save': '保存',

  // ====== sidebar ======
  'sidebar.search.placeholder': '搜索文件名 / 路径…（Esc 收起）',
  'sidebar.sort.tooltip': '排序方式',
  'sidebar.sort.mtime_desc': '🕒 最近修改',
  'sidebar.sort.name_asc': '🔤 名称',
  'sidebar.sort.path_asc': '📂 路径',
  'sidebar.tab.tree': '📁 目录',
  'sidebar.tab.favorites': '⭐ 收藏',
  'sidebar.tab.recent': '🕐 最近',
  'sidebar.stats.loading': '加载中…',
  'sidebar.stats.summary': '{roots} 个根目录 · {files} 个文档',
  'sidebar.collapse_all': '折叠所有文件夹',
  'sidebar.collapse_all.tooltip': '折叠目录树中所有文件夹（不会隐藏侧边栏）',
  'sidebar.empty.favorites': '还没有收藏。在目录中右键文件可加入收藏。',
  'sidebar.empty.recent': '还没有最近打开的文件。',

  // ====== save dialog ======
  'dlg.save.title': '这份文档有未保存的修改',
  'dlg.save.overwrite': '覆盖源文件',
  'dlg.save.overwrite.desc': '合入修改，清理草稿',
  'dlg.save.new': '另存新版本',
  'dlg.save.new.desc': '生成 -审阅版-时间戳（扩展名跟随源文件），路径复制到剪贴板',
  'dlg.save.discard': '丢弃',
  'dlg.save.discard.desc': '仅清理草稿，源文件不动',

  // ====== settings panel ======
  'settings.title': '⚙️ 设置',
  'settings.scan.title': '扫描目录',
  'settings.scan.placeholder': '绝对路径，例如 /Users/.../reports',
  'settings.scan.browse': '浏览文件夹',
  'settings.scan.hint': '默认扫描 <code>outputs/</code>。可添加任意目录，实时扫描 HTML / Markdown 文件。',
  'settings.refresh.title': '📡 目录树自动刷新',
  'settings.refresh.label': '刷新周期',
  'settings.refresh.off': '关闭',
  'settings.refresh.5s': '5 秒',
  'settings.refresh.10s': '10 秒',
  'settings.refresh.30s': '30 秒',
  'settings.refresh.60s': '60 秒',
  'settings.refresh.hint_pause': '页面隐藏时自动暂停，不打扰当前编辑',
  'settings.refresh.hint_full': '新增 / 删除文件后，侧边栏会在周期内自动出现 / 消失，无需手动按 🔄。',
  'settings.snapshot.title': '🗂 自动快照管理',
  'settings.snapshot.label_retention': '保留天数',
  'settings.snapshot.3d': '3 天',
  'settings.snapshot.7d': '7 天',
  'settings.snapshot.14d': '14 天',
  'settings.snapshot.30d': '30 天',
  'settings.snapshot.90d': '90 天',
  'settings.snapshot.hint_retention': '每次启动 / 手动清理时移除 N 天前的快照',
  'settings.snapshot.cleanup': '🧹 立即清理过期快照',
  'settings.snapshot.sparsify': '🪶 稀释密集快照',
  'settings.snapshot.hint_storage': '自动快照默认存于 <code>{原目录}/_auto-save/</code>，pre-overwrite / pre-restore 备份保留至到期。<br><strong>稀释规则</strong>：最近 10 分钟全保 / 10–60 分钟每分钟 / 1–24 小时每小时 / >24 小时每天。',
  'settings.about.title': '关于',
  'settings.about.changelog': '📖 查看完整更新日志',
  'settings.about.changelog_hint': '时间轴形式展示每个版本的功能、优化和修复',

  // ====== modal: folder browser ======
  'modal.folder.title': '📂 选择文件夹',
  'modal.folder.path_label': '路径',
  'modal.folder.up': '⬆️ 上一级',

  // ====== welcome / empty state ======
  'welcome.title': '本地 HTML 文档工作台',
  'welcome.subtitle': '从左侧目录选择一个 HTML 文件，自动启用编辑 / 批注能力。',
  'welcome.bullet.autosave': '编辑 / 批注后 <b>2 秒自动保存</b>到 <code>_auto-save/</code>',
  'welcome.bullet.choice': '关闭或切换时可选 <b>覆盖源文件</b> 或 <b>另存新版本</b>',
  'welcome.bullet.clipboard': '另存后路径自动复制到剪贴板',

  // ====== language switcher ======
  'lang.label': '语言',
  'lang.en': 'EN',
  'lang.zh': '中文',

  // ====== toasts ======
  'toast.saved': '已保存',
  'toast.snapshot.created': '已创建快照',
  'toast.snapshot.cleaned': '已清理 {count} 份过期快照',
  'toast.snapshot.sparsified': '已稀释 {removed} 份快照，保留 {kept} 份',
  'toast.copied_path': '路径已复制到剪贴板',
  'toast.network_error': '网络错误，请重试',
  'toast.file_not_found': '文件未找到',
  'toast.file_deleted': '文件已删除',
  'toast.discard_done': '已丢弃草稿',
  'toast.added_favorite': '已加入收藏',
  'toast.removed_favorite': '已从收藏移除',
  'toast.no_changes': '没有未保存的修改',

  // ====== confirms ======
  'confirm.delete_snapshot': '确定删除这份快照？',
  'confirm.delete_file': '确定删除该文件？此操作不可撤销。',
  'confirm.cleanup_snapshots': '清理所有过期快照？',
  'confirm.unsaved_close': '有未保存的修改。确定丢弃？',

  // ====== history / time machine ======
  'history.title': '🕐 历史版本',
  'history.empty': '该文件还没有历史快照。',
  'history.relative.just_now': '刚刚',
  'history.relative.minutes_ago': '{n} 分钟前',
  'history.relative.hours_ago': '{n} 小时前',
  'history.relative.days_ago': '{n} 天前',
  'history.restore': '恢复',
  'history.preview': '预览',
  'history.delete': '删除',
  'history.drawer.close': '关闭 (Esc)',
  'history.drawer.current_label': '当前文件',
  'history.drawer.loading': '加载中…',
  'history.drawer.foot_hint': '⓪ 自动快照 = 编辑过程中每次停手 2 秒生成<br>① 覆盖前备份 = 点"覆盖源文件"前自动生成<br>② 恢复时也会先备份当前内容（pre-restore）',
  'history.preview.title_prefix': '👁 历史版本预览 — ',
  'history.preview.restore_btn': '↩ 恢复此版本',
  'history.preview.restore_tooltip': '恢复此版本到源文件',

  // ====== folder browser modal ======
  'modal.folder.cancel': '取消',
  'modal.folder.confirm': '选择此目录',

  // ====== keyboard help ======
  'help.title': '⌨️ 键盘快捷键',
  'help.section.global': '全局',
  'help.section.editing': '编辑',
  'help.section.navigation': '导航 / 操作',
  'help.section.sidebar_view': '侧边栏 / 视图',
  'help.section.help': '帮助',
  'help.shortcut.toggle_sidebar': '显示 / 隐藏侧边栏',
  'help.shortcut.zoom': '放大 / 缩小 iframe',
  'help.shortcut.zoom_reset': '恢复 75% 默认缩放',
  'help.shortcut.search': '聚焦搜索框',
  'help.shortcut.refresh': '刷新目录树和当前文件',
  'help.shortcut.history': '打开历史版本抽屉（需先打开文件）',
  'help.shortcut.theme': '切换主题（自动 / 浅色 / 深色）',
  'help.shortcut.escape': '关闭弹窗 / 清搜索 / 收侧栏',
  'help.shortcut.help': '显示此快捷键帮助',
  'help.shortcut.bold': '加粗',
  'help.shortcut.italic': '斜体',
  'help.shortcut.underline': '下划线',
  'help.tip': '💡 在输入框里输入时，裸字母键（H R / ?）不会触发，正常打字',

  // ====== misc ======
  'misc.unknown': '未知',
  'misc.untitled': '未命名',
  'misc.loading': '加载中…',

  // ====== status (top bar / setStatus) ======
  'status.load_failed': '加载失败',
  'status.loading': '加载中…',
  'status.ready_native': '已就绪（原生编辑器）',
  'status.ready_injected': '已就绪（注入编辑器）',
  'status.editing_will_snapshot': '编辑中（2 秒后自动快照）',
  'status.saved': '已保存',
  'status.draft_cached': '草稿已缓存 {time}',
  'status.refreshing': '刷新中…',

  // ====== toasts (extended) ======
  'toast.recent.cleared': '已清空最近列表',
  'toast.theme': '主题：{name}',
  'toast.copy.done': '{label} 已复制',
  'toast.copy.failed': '复制失败',
  'toast.finder.opened': '📂 已在 Finder 打开',
  'toast.finder.failed': 'Finder 打开失败',
  'toast.tree.load_failed': '目录树加载失败',
  'toast.fav.failed': '收藏失败',
  'toast.move.save_first': '⚠️ 请先保存当前修改再移动此文件',
  'toast.move.self': '不能拖到自己',
  'toast.move.into_self': '不能拖到自己的子目录',
  'toast.move.same_dir': '已经在该目录下，无需移动',
  'toast.move.conflict': '目标已存在同名，移动取消',
  'toast.move.failed': '移动失败',
  'toast.tree.collapsed_all': '已折叠所有文件夹',
  'toast.opened': '已打开：{name}',
  'toast.refresh.in_progress': '🔄 正在重新加载文档',
  'toast.iframe.read_failed': '读取 iframe 内容失败',
  'toast.save.overwrite_done': '✅ 已覆盖源文件',
  'toast.save.new_done': '🆕 新版本已生成 · 路径已复制到剪贴板',
  'toast.save.discard_done': '🗑 已丢弃本次修改',
  'toast.save.failed': '保存失败',
  'toast.config.read_failed': '读取配置失败',
  'toast.scan.toggle_failed': '开关切换失败',
  'toast.scan.update_failed': '配置更新失败',
  'toast.scan.updated': '扫描目录已更新',
  'toast.scan.tree_refreshed': '目录树已刷新',
  'toast.scan.adding': '正在添加目录…',
  'toast.scan.exists': '该目录已存在',
  'toast.scan.add_failed': '添加失败',
  'toast.scan.remove_failed': '移除失败',
  'toast.history.open_first': '请先打开一个文件',
  'toast.history.preview_failed': '预览失败',
  'toast.history.restored': '✓ 已恢复',
  'toast.history.restored.detail': '原内容已备份为 pre-restore',
  'toast.history.restore_failed': '恢复失败',
  'toast.refresh.off': '自动刷新已关闭',
  'toast.refresh.on': '自动刷新：每 {sec} 秒',
  'toast.config.save_failed': '保存配置失败',
  'toast.snapshot.retention': '快照保留：{days} 天',
  'toast.snapshot.retention.detail': '下次启动 / 手动清理时按此规则',
  'toast.cleanup.in_progress': '清理中…',
  'toast.cleanup.done': '✓ 清理完成',
  'toast.cleanup.failed': '清理失败',
  'toast.sparsify.in_progress': '稀释中…',
  'toast.sparsify.done': '🪶 稀释完成',
  'toast.sparsify.failed': '稀释失败',
  'toast.sort.mtime': '按最近修改排序',
  'toast.sort.name': '按名称排序',
  'toast.refreshed': '已刷新',

  // ====== confirms (extended) ======
  'confirm.scan.remove': '从扫描列表移除：\n{path}\n\n（只是移除不显示，不会删除文件）',
  'confirm.history.restore': '确定将「{name}」的内容恢复为当前文件吗？\n\n· 当前文件内容会先被备份为 pre-restore 快照\n· 操作可通过再次恢复 pre-restore 撤销',

  // ====== tree stats / breadcrumb ======
  'tree.stats.empty': '0 个文件',
  'tree.stats.summary': '{roots} 个根目录 · {files} 个文档',
  'tree.load_failed_html': '<div class="tree-empty">加载失败：{msg}</div>',
  'breadcrumb.empty_html': '<span class="breadcrumb-empty">👈 左侧选择一个 HTML 文档开始</span>',
  'breadcrumb.path_tooltip': '单击复制相对路径，按住复制绝对路径',

  // ====== scan list ======
  'scan.empty_html': '<div style="font-size:12px;color:var(--text-3);padding:10px 0">还没有扫描目录</div>',
  'scan.disabled_divider': '⏸ 已关闭（{count}，不扫描）',
  'scan.btn.adding': '添加中…',
  'scan.btn.add': '添加',

  // ====== folder browser (dynamic) ======
  'browse.loading': '加载中…',
  'browse.loading_html': '<div class="browse-loading">加载中…</div>',
  'browse.request_failed_html': '<div class="browse-empty">❌ 请求失败: {msg}</div>',
  'browse.shortcut_label': '📍 快捷入口',
  'browse.shortcut_label_html': '<span class="bc-item bc-active">📍 快捷入口</span>',
  'browse.empty_dir': '此目录下没有子文件夹',
  'browse.empty_dir_html': '<div class="browse-empty">此目录下没有子文件夹</div>',
  'browse.up_html': '<span class="browse-icon">⬆️</span><span class="browse-name">返回上级</span>',
  'browse.selected': '已选：{path}',

  // ====== history (dynamic) ======
  'history.dyn.loading_html': '<div class="history-empty">加载中…</div>',
  'history.dyn.load_failed_html': '<div class="history-empty">加载失败：{msg}</div>',
  'history.dyn.empty_html': '<div class="history-empty">还没有历史版本<br>编辑此文件 2 秒后会自动生成快照</div>',
  'history.dyn.diff_same_html': ' · <span class="history-diff-eq">行内容相同</span>',

  // ====== relative time ======
  'time.just_now': '刚刚',
  'time.minutes_ago': '{n} 分钟前',
  'time.hours_ago': '{n} 小时前',
  'time.days_ago': '{n} 天前',
  'time.seconds_ago_short': '{n} 秒前',
  'time.minutes_ago_short': '{n} 分钟前',
  'time.hours_ago_short': '{n} 小时前',
  'time.days_ago_short': '{n} 天前',

  // ====== recent list ======
  'recent.title': '🕐 最近打开',
  'recent.clear': '清空',
  'recent.clear_tooltip': '清空最近列表',
  'recent.remove_tooltip': '从最近列表移除',

  // ====== favorites list ======
  'fav.title': '⭐ 收藏',
  'fav.empty': '点文件 / 目录旁的 ☆ 添加收藏',
  'fav.unfav_tooltip': '取消收藏',
  'fav.fav_tooltip': '添加到收藏',
  'fav.added': '⭐ 已收藏',
  'fav.removed': '已取消收藏',
  'fav.op_failed': '收藏操作失败',

  // ====== theme toast variants ======
  'theme.tooltip.auto': '主题：自动跟随系统（点击切换为浅色）',
  'theme.tooltip.light': '主题：浅色（点击切换为深色）',
  'theme.tooltip.dark': '主题：深色（点击切换为自动）',
  'theme.name.auto': '自动跟随系统',
  'theme.name.light': '浅色模式',
  'theme.name.dark': '深色模式',

  // ====== tree empty / scan empty ======
  'tree.empty.no_scan_dirs': '还没有扫描目录',
  'tree.empty.add_dir_btn': '＋ 添加目录',

  // ====== drag & drop / move ======
  'move.confirm': '将{label}「{name}」移动到：\n{dst}\n\n确认？',
  'move.label.dir': '目录',
  'move.label.file': '文件',
  'move.success': '✅ 已移动',
  'move.success_detail': '{name} → {dir}',
  'move.success_detail_with_snaps': '{name} → {dir}（快照 {n} 个同步）',

  // ====== context menu ======
  'menu.reveal_dir': '在 Finder 打开此目录',
  'menu.reveal_file': '在 Finder 打开',
  'menu.copy_dir_path': '复制目录路径',
  'menu.copy_full_path': '复制完整路径',
  'menu.copy_filename': '复制文件名',
  'menu.label.path': '路径',
  'menu.label.abs_path': '绝对路径',
  'menu.label.rel_path': '相对路径',
  'menu.label.filename': '文件名',
  'menu.tooltip.icon': '点击打开操作菜单',

  // ====== search stats ======
  'search.matches': '{n} 个匹配',
  'search.no_match': '无匹配',

  // ====== iframe fallback ======
  'iframe.fallback.title': '文件加载失败或超时',
  'iframe.fallback.retry': '↻ 重试',
  'iframe.fallback.close': '关闭',
  'iframe.fallback.reasons_html': '可能原因：<br>· 文件被删除或移动（试试 R 刷新目录）<br>· 文件 &gt; 100MB（超出 server 限制）<br>· scan_roots 配置变更（去 ⚙️ 设置检查）<br>· 服务进程异常（终端重启 python3 server.py）',

  // ====== scan root row ======
  'scan.toggle.disable_tooltip': '点击关闭扫描',
  'scan.toggle.enable_tooltip': '点击开启扫描',
  'scan.row.remove': '移除',
  'scan.row.remove_tooltip': '从列表中移除此目录',

  // ====== folder browser (more) ======
  'browse.select_btn': '✓ 选择',
  'browse.select_tooltip': '选择此目录',

  // ====== history kind labels ======
  'history.kind.auto': '自动快照',
  'history.kind.pre_overwrite': '覆盖前备份',
  'history.kind.pre_restore': '恢复前备份',

  // ====== time machine quickbar ======
  'tm.title': '↩ 时光机：',
  'tm.5min': '5 分钟前',
  'tm.10min': '10 分钟前',
  'tm.30min': '30 分钟前',
  'tm.1hour': '1 小时前',
  'tm.1day': '1 天前',
  'tm.tooltip': '恢复到{label}（{when}）',

  // ====== history item ======
  'history.item.no_change': '无变化',
  'history.item.delta_label': '与当前',
  'history.item.diff_loading': ' · diff 加载中…',
  'history.item.diff_added': '+{n} 行',
  'history.item.diff_removed': '-{n} 行',
  'history.item.preview': '👁 预览',
  'history.item.restore': '↩ 恢复',
  'history.item.read_failed': '读取失败',

  // ====== cleanup / sparsify msgs ======
  'cleanup.msg': '扫描 {dirs} 目录，移除 {removed} 个 >{days} 天快照',
  'sparsify.msg': '{dirs} 目录 · 移除 {removed}/{before} 条 · 保留 {kept} 条',

  // ====== response/JSON errors ======
  'err.response_not_json': '响应不是 JSON（{ctype}）：{body}',
  'err.json_parse': 'JSON 解析失败：{msg}',
  'err.server_500_hint': '（可能需要重启 server.py 让新代码生效）',
  'err.reveal_failed': 'reveal 失败',
  'err.read_failed': '读取失败',

  // ====== breadcrumb snapshot link ======
  'bc.snap_link_tooltip': '打开历史版本抽屉',
  'bc.snap_count': '🗂 {n} 个快照',
};
