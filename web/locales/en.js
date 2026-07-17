/**
 * DocCenter — English locale.
 * Naming convention: <area>.<sub>.<element>  (flat keys, no nesting).
 *
 * Areas:
 *   header.*      — top bar (title, breadcrumb, zoom, close)
 *   sidebar.*     — sidebar (search, tabs, status, collapse)
 *   dlg.save.*    — 3-way save dialog
 *   settings.*    — settings panel
 *   welcome.*     — empty-state welcome page
 *   btn.*         — generic button tooltips
 *   modal.*       — other modals (folder browser, etc.)
 *   toast.*       — toast notifications
 *   confirm.*     — confirmation prompts
 *   history.*     — history / time-machine panel
 *   help.*        — keyboard shortcuts help
 *   lang.*        — language switcher
 *   meta.*        — document title, etc.
 *
 * Variable interpolation: "{count} files" → t('key', { count: 42 })
 */
window.LOCALE_EN = {
  // ====== meta ======
  'meta.title': 'HTML Document Center · Local Workbench',

  // ====== header ======
  'header.toggle_sidebar': 'Show / hide sidebar (⌘B)',
  'header.label.files': 'Files',
  'header.breadcrumb.empty': 'Pick an HTML / Markdown file from the sidebar to begin',
  'header.status.unopened': 'Not opened',
  'header.zoom.tooltip': 'Document zoom',
  'header.zoom.25': 'Bird-eye 25%',
  'header.zoom.50': 'Compact 50%',
  'header.zoom.75': 'Comfortable 75%',
  'header.zoom.100': 'Actual size 100%',
  'header.zoom.125': 'Large 125%',
  'header.zoom.150': 'Extra large 150%',
  'header.close_file': 'Close current document',

  // ====== generic buttons ======
  'btn.history': 'History (H)',
  'btn.refresh': 'Refresh (R)',
  'btn.theme': 'Toggle theme (auto / light / dark)',
  'btn.help': 'Keyboard shortcuts (?)',
  'btn.settings': 'Settings',
  'btn.cancel': 'Cancel',
  'btn.confirm': 'OK',
  'btn.close': 'Close',
  'btn.add': 'Add',
  'btn.delete': 'Delete',
  'btn.save': 'Save',

  // ====== sidebar ======
  'sidebar.search.placeholder': 'Search file name / path… (Esc to close)',
  'sidebar.sort.tooltip': 'Sort order',
  'sidebar.sort.mtime_desc': '🕒 Recently modified',
  'sidebar.sort.name_asc': '🔤 Name',
  'sidebar.sort.path_asc': '📂 Path',
  'sidebar.tab.tree': '📁 Files',
  'sidebar.tab.favorites': '⭐ Favorites',
  'sidebar.tab.recent': '🕐 Recent',
  'sidebar.stats.loading': 'Loading…',
  'sidebar.stats.summary': '{roots} root(s) · {files} document(s)',
  'sidebar.collapse_all': 'Collapse all folders',
  'sidebar.collapse_all.tooltip': 'Collapse every folder in the tree (sidebar stays open)',
  'sidebar.empty.favorites': 'No favorites yet. Right-click any file in the tree to add.',
  'sidebar.empty.recent': 'No recently opened files yet.',

  // ====== save dialog ======
  'dlg.save.title': 'This document has unsaved changes',
  'dlg.save.overwrite': 'Overwrite source',
  'dlg.save.overwrite.desc': 'Apply changes to the original file, clean up drafts',
  'dlg.save.new': 'Save as new version',
  'dlg.save.new.desc': 'Create a -review-{timestamp} copy (same extension), path copied to clipboard',
  'dlg.save.discard': 'Discard',
  'dlg.save.discard.desc': 'Drop drafts only, source file untouched',

  // ====== settings panel ======
  'settings.title': '⚙️ Settings',
  'settings.scan.title': 'Scan directories',
  'settings.scan.placeholder': 'Absolute path, e.g. /Users/.../reports',
  'settings.scan.browse': 'Browse folders',
  'settings.scan.browse_large': '📂 Browse folders…',
  'sidebar.add_dir.tooltip': 'Add folder',
  'breadcrumb.drag_preview': '📋 Dropped preview (unsaved)',
  'toast.drag.no_html': 'Please drag an HTML or Markdown file',
  'toast.drag.loaded': 'Loaded',
  'toast.drag.failed': 'Failed to read file',
  'welcome.subtitle_new': '👇 Drag HTML/MD files here to preview, or click ＋ in sidebar to add folders',
  'welcome.add_folder': '📂 Add folder',
  'preview.temporary': '📋 Temporary preview · Not managed, edits won\'t be saved',
  'btn.export_pdf': 'Export PDF / Print',
  'toast.export.failed': 'Export failed',
  'settings.scan.hint': 'Defaults to <code>outputs/</code>. Add any directory to scan HTML / Markdown in real time.',
  'settings.refresh.title': '📡 Tree auto-refresh',
  'settings.refresh.label': 'Refresh interval',
  'settings.refresh.off': 'Off',
  'settings.refresh.5s': '5 seconds',
  'settings.refresh.10s': '10 seconds',
  'settings.refresh.30s': '30 seconds',
  'settings.refresh.60s': '60 seconds',
  'settings.refresh.hint_pause': 'Pauses while the page is hidden — never disturbs your edits',
  'settings.refresh.hint_full': 'After adding / removing files, the sidebar updates within the interval. No manual 🔄 needed.',
  'settings.snapshot.title': '🗂 Auto-snapshot management',
  'settings.snapshot.label_retention': 'Retention days',
  'settings.snapshot.3d': '3 days',
  'settings.snapshot.7d': '7 days',
  'settings.snapshot.14d': '14 days',
  'settings.snapshot.30d': '30 days',
  'settings.snapshot.90d': '90 days',
  'settings.snapshot.hint_retention': 'Snapshots older than N days are removed on startup / manual cleanup',
  'settings.snapshot.cleanup': '🧹 Clean expired snapshots now',
  'settings.snapshot.sparsify': '🪶 Sparsify dense snapshots',
  'settings.snapshot.hint_storage': 'Snapshots live at <code>{originalDir}/_auto-save/</code>. Pre-overwrite / pre-restore backups are retained until expiration.<br><strong>Sparsify rule</strong>: keep all from the last 10 minutes / 1 per minute for 10–60 minutes / 1 per hour for 1–24 hours / 1 per day older than 24 hours.',
  'settings.about.title': 'About',
  'settings.about.changelog': '📖 View full changelog',
  'settings.about.changelog_hint': 'A timeline view of every version with features, polish, and fixes',

  // ====== modal: folder browser ======
  'modal.folder.title': '📂 Select a folder',
  'modal.folder.path_label': 'Path',
  'modal.folder.up': '⬆️ Up',

  // ====== welcome / empty state ======
  'welcome.title': 'Local HTML Document Workbench',
  'welcome.subtitle': 'Pick an HTML file from the sidebar — editing / annotation is enabled automatically.',
  'welcome.bullet.autosave': 'Edits and annotations <b>auto-save in 2 seconds</b> to <code>_auto-save/</code>',
  'welcome.bullet.choice': 'On close or switch you can <b>overwrite source</b> or <b>save as new version</b>',
  'welcome.bullet.clipboard': 'After "save as new", the path is copied to your clipboard',

  // ====== language switcher ======
  'lang.label': 'Language',
  'lang.en': 'EN',
  'lang.zh': '中文',

  // ====== toasts ======
  'toast.saved': 'Saved',
  'toast.snapshot.created': 'Snapshot created',
  'toast.snapshot.cleaned': 'Cleaned {count} expired snapshot(s)',
  'toast.snapshot.sparsified': 'Sparsified {removed} snapshot(s), kept {kept}',
  'toast.copied_path': 'Path copied to clipboard',
  'toast.network_error': 'Network error, please retry',
  'toast.file_not_found': 'File not found',
  'toast.file_deleted': 'File deleted',
  'toast.discard_done': 'Drafts discarded',
  'toast.added_favorite': 'Added to favorites',
  'toast.removed_favorite': 'Removed from favorites',
  'toast.no_changes': 'No unsaved changes',

  // ====== confirms ======
  'confirm.delete_snapshot': 'Delete this snapshot?',
  'confirm.delete_file': 'Delete this file? This action cannot be undone.',
  'confirm.cleanup_snapshots': 'Clean all expired snapshots?',
  'confirm.unsaved_close': 'You have unsaved changes. Discard them?',

  // ====== history / time machine ======
  'history.title': '🕐 History versions',
  'history.empty': 'No history snapshots for this file yet.',
  'history.relative.just_now': 'just now',
  'history.relative.minutes_ago': '{n} minute(s) ago',
  'history.relative.hours_ago': '{n} hour(s) ago',
  'history.relative.days_ago': '{n} day(s) ago',
  'history.restore': 'Restore',
  'history.preview': 'Preview',
  'history.delete': 'Delete',
  'history.drawer.close': 'Close (Esc)',
  'history.drawer.current_label': 'Current file',
  'history.drawer.loading': 'Loading…',
  'history.drawer.foot_hint': '⓪ Auto-snapshot = generated 2s after every edit<br>① Pre-overwrite = generated automatically before "Overwrite source"<br>② Pre-restore = generated before restoring an older version',
  'history.preview.title_prefix': '👁 Version preview — ',
  'history.preview.restore_btn': '↩ Restore this version',
  'history.preview.restore_tooltip': 'Restore this version to the source file',

  // ====== folder browser modal ======
  'modal.folder.cancel': 'Cancel',
  'modal.folder.confirm': 'Choose this folder',

  // ====== keyboard help ======
  'help.title': '⌨️ Keyboard shortcuts',
  'help.section.global': 'Global',
  'help.section.editing': 'Editing',
  'help.section.navigation': 'Navigation',
  'help.section.sidebar_view': 'Sidebar / View',
  'help.section.help': 'Help',
  'help.shortcut.toggle_sidebar': 'Show / hide sidebar',
  'help.shortcut.zoom': 'Zoom in / out (iframe)',
  'help.shortcut.zoom_reset': 'Reset to 75%',
  'help.shortcut.search': 'Focus search box',
  'help.shortcut.refresh': 'Refresh tree and current file',
  'help.shortcut.history': 'Open history drawer (file must be open)',
  'help.shortcut.theme': 'Toggle theme (auto / light / dark)',
  'help.shortcut.escape': 'Close modal / clear search / collapse sidebar',
  'help.shortcut.help': 'Show this shortcut panel',
  'help.shortcut.bold': 'Bold',
  'help.shortcut.italic': 'Italic',
  'help.shortcut.underline': 'Underline',
  'help.tip': '💡 When typing in inputs, bare letter keys (H R / ?) are ignored — type normally.',

  // ====== misc ======
  'misc.unknown': 'Unknown',
  'misc.untitled': 'Untitled',
  'misc.loading': 'Loading…',

  // ====== status (top bar / setStatus) ======
  'status.load_failed': 'Load failed',
  'status.loading': 'Loading…',
  'status.ready_native': 'Ready (native editor)',
  'status.ready_injected': 'Ready (injected editor)',
  'status.editing_will_snapshot': 'Editing (auto-snapshot in 2s)',
  'status.saved': 'Saved',
  'status.draft_cached': 'Draft cached at {time}',
  'status.refreshing': 'Refreshing…',

  // ====== toasts (extended) ======
  'toast.recent.cleared': 'Recent list cleared',
  'toast.theme': 'Theme: {name}',
  'toast.copy.done': '{label} copied',
  'toast.copy.failed': 'Copy failed',
  'toast.finder.opened': '📂 Revealed in Finder',
  'toast.finder.failed': 'Failed to open Finder',
  'toast.new_tab.opened': '🔗 Opened in new tab',
  'toast.new_tab.blocked': '🚫 New tab blocked by browser (allow popups for this site)',
  'toast.new_tab.failed': 'Failed to open new tab',
  'toast.tree.load_failed': 'Tree load failed',
  'toast.fav.failed': 'Favorite update failed',
  'toast.move.save_first': '⚠️ Save current changes before moving this file',
  'toast.move.self': 'Cannot move to itself',
  'toast.move.into_self': 'Cannot move into a sub-folder of itself',
  'toast.move.same_dir': 'Already in this folder, no move needed',
  'toast.move.conflict': 'Target already has a same-named entry, move cancelled',
  'toast.move.failed': 'Move failed',
  'toast.tree.collapsed_all': 'All folders collapsed',
  'toast.opened': 'Opened: {name}',
  'toast.refresh.in_progress': '🔄 Reloading document',
  'toast.iframe.read_failed': 'Failed to read iframe content',
  'toast.save.overwrite_done': '✅ Source file overwritten',
  'toast.save.new_done': '🆕 New version saved · path copied to clipboard',
  'toast.save.discard_done': '🗑 Discarded edits',
  'toast.save.failed': 'Save failed',
  'toast.config.read_failed': 'Read config failed',
  'toast.scan.toggle_failed': 'Toggle failed',
  'toast.scan.update_failed': 'Config update failed',
  'toast.scan.updated': 'Scan directories updated',
  'toast.scan.tree_refreshed': 'Tree refreshed',
  'toast.scan.adding': 'Adding directory…',
  'toast.scan.exists': 'This directory is already added',
  'toast.scan.add_failed': 'Add failed',
  'toast.scan.remove_failed': 'Remove failed',
  'toast.history.open_first': 'Open a file first',
  'toast.history.preview_failed': 'Preview failed',
  'toast.history.restored': '✓ Restored',
  'toast.history.restored.detail': 'Previous content backed up as pre-restore',
  'toast.history.restore_failed': 'Restore failed',
  'toast.refresh.off': 'Auto-refresh off',
  'toast.refresh.on': 'Auto-refresh: every {sec}s',
  'toast.config.save_failed': 'Save config failed',
  'toast.snapshot.retention': 'Snapshot retention: {days} days',
  'toast.snapshot.retention.detail': 'Applied on next startup / manual cleanup',
  'toast.cleanup.in_progress': 'Cleaning…',
  'toast.cleanup.done': '✓ Cleanup complete',
  'toast.cleanup.failed': 'Cleanup failed',
  'toast.sparsify.in_progress': 'Sparsifying…',
  'toast.sparsify.done': '🪶 Sparsify complete',
  'toast.sparsify.failed': 'Sparsify failed',
  'toast.sort.mtime': 'Sorted by last modified',
  'toast.sort.name': 'Sorted by name',
  'toast.refreshed': 'Refreshed',

  // ====== confirms (extended) ======
  'confirm.scan.remove': 'Remove from scan list:\n{path}\n\n(Only hides; will not delete files.)',
  'confirm.history.restore': 'Restore the content of "{name}" to current file?\n\n· Current content will be backed up as a pre-restore snapshot\n· You can undo by restoring the pre-restore snapshot',

  // ====== tree stats / breadcrumb ======
  'tree.stats.empty': '0 files',
  'tree.stats.summary': '{roots} root(s) · {files} document(s)',
  'tree.load_failed_html': '<div class="tree-empty">Load failed: {msg}</div>',
  'breadcrumb.empty_html': '<span class="breadcrumb-empty">👈 Pick an HTML document from the sidebar</span>',
  'breadcrumb.path_tooltip': 'Click to copy relative path; hold to copy absolute path',

  // ====== scan list ======
  'scan.empty_html': '<div style="font-size:12px;color:var(--text-3);padding:10px 0">No scan directories yet</div>',
  'scan.disabled_divider': '⏸ Disabled ({count}, not scanned)',
  'scan.btn.adding': 'Adding…',
  'scan.btn.add': 'Add',

  // ====== folder browser (dynamic) ======
  'browse.loading': 'Loading…',
  'browse.loading_html': '<div class="browse-loading">Loading…</div>',
  'browse.request_failed_html': '<div class="browse-empty">❌ Request failed: {msg}</div>',
  'browse.shortcut_label': '📍 Quick access',
  'browse.shortcut_label_html': '<span class="bc-item bc-active">📍 Quick access</span>',
  'browse.empty_dir': 'No sub-folders here',
  'browse.empty_dir_html': '<div class="browse-empty">No sub-folders in this directory</div>',
  'browse.up_html': '<span class="browse-icon">⬆️</span><span class="browse-name">Go up</span>',
  'browse.selected': 'Selected: {path}',

  // ====== history (dynamic) ======
  'history.dyn.loading_html': '<div class="history-empty">Loading…</div>',
  'history.dyn.load_failed_html': '<div class="history-empty">Load failed: {msg}</div>',
  'history.dyn.empty_html': '<div class="history-empty">No history versions yet<br>Edits auto-snapshot 2s after stop</div>',
  'history.dyn.diff_same_html': ' · <span class="history-diff-eq">Lines identical</span>',

  // ====== relative time ======
  'time.just_now': 'just now',
  'time.minutes_ago': '{n} min ago',
  'time.hours_ago': '{n}h ago',
  'time.days_ago': '{n}d ago',
  'time.seconds_ago_short': '{n}s ago',
  'time.minutes_ago_short': '{n}m ago',
  'time.hours_ago_short': '{n}h ago',
  'time.days_ago_short': '{n}d ago',

  // ====== recent list ======
  'recent.title': '🕐 Recently opened',
  'recent.clear': 'Clear',
  'recent.clear_tooltip': 'Clear recent list',
  'recent.remove_tooltip': 'Remove from recent',

  // ====== favorites list ======
  'fav.title': '⭐ Favorites',
  'fav.empty': 'Tap ☆ next to a file/folder to add a favorite',
  'fav.unfav_tooltip': 'Remove from favorites',
  'fav.fav_tooltip': 'Add to favorites',
  'fav.added': '⭐ Added to favorites',
  'fav.removed': 'Removed from favorites',
  'fav.op_failed': 'Favorite operation failed',

  // ====== theme toast variants ======
  'theme.tooltip.auto': 'Theme: auto (system) — click for light',
  'theme.tooltip.light': 'Theme: light — click for dark',
  'theme.tooltip.dark': 'Theme: dark — click for auto',
  'theme.name.auto': 'auto (system)',
  'theme.name.light': 'light',
  'theme.name.dark': 'dark',

  // ====== tree empty / scan empty ======
  'tree.empty.no_scan_dirs': 'No scan directories yet',
  'tree.empty.add_dir_btn': '＋ Add directory',

  // ====== drag & drop / move ======
  'move.confirm': 'Move {label} "{name}" to:\n{dst}\n\nProceed?',
  'move.label.dir': 'directory',
  'move.label.file': 'file',
  'move.success': '✅ Moved',
  'move.success_detail': '{name} → {dir}',
  'move.success_detail_with_snaps': '{name} → {dir} ({n} snapshots synced)',

  // ====== context menu ======
  'menu.reveal_dir': 'Reveal directory in Finder',
  'menu.reveal_file': 'Reveal in Finder',
  'menu.open_new_tab': 'Open in new tab',
  'menu.copy_dir_path': 'Copy directory path',
  'menu.copy_full_path': 'Copy full path',
  'menu.copy_filename': 'Copy file name',
  'menu.label.path': 'Path',
  'menu.label.abs_path': 'Absolute path',
  'menu.label.rel_path': 'Relative path',
  'menu.label.filename': 'File name',
  'menu.tooltip.icon': 'Click to open action menu',

  // ====== search stats ======
  'search.matches': '{n} match(es)',
  'search.no_match': 'No match',

  // ====== iframe fallback ======
  'iframe.fallback.title': 'File failed to load or timed out',
  'iframe.fallback.retry': '↻ Retry',
  'iframe.fallback.close': 'Close',
  'iframe.fallback.reasons_html': 'Possible reasons:<br>· File deleted or moved (try R to refresh)<br>· File &gt; 100MB (server limit)<br>· scan_roots config changed (check ⚙️ Settings)<br>· Server process error (restart python3 server.py)',

  // ====== scan root row ======
  'scan.toggle.disable_tooltip': 'Click to disable scanning',
  'scan.toggle.enable_tooltip': 'Click to enable scanning',
  'scan.row.remove': 'Remove',
  'scan.row.remove_tooltip': 'Remove this directory from list',

  // ====== folder browser (more) ======
  'browse.select_btn': '✓ Select',
  'browse.select_tooltip': 'Choose this directory',

  // ====== history kind labels ======
  'history.kind.auto': 'Auto-snapshot',
  'history.kind.pre_overwrite': 'Pre-overwrite backup',
  'history.kind.pre_restore': 'Pre-restore backup',

  // ====== time machine quickbar ======
  'tm.title': '↩ Time machine:',
  'tm.5min': '5 min ago',
  'tm.10min': '10 min ago',
  'tm.30min': '30 min ago',
  'tm.1hour': '1 hour ago',
  'tm.1day': '1 day ago',
  'tm.tooltip': 'Restore to {label} ({when})',

  // ====== history item ======
  'history.item.no_change': 'no change',
  'history.item.delta_label': 'vs current',
  'history.item.diff_loading': ' · diff loading…',
  'history.item.diff_added': '+{n} lines',
  'history.item.diff_removed': '-{n} lines',
  'history.item.preview': '👁 Preview',
  'history.item.restore': '↩ Restore',
  'history.item.read_failed': 'Read failed',

  // ====== cleanup / sparsify msgs ======
  'cleanup.msg': 'Scanned {dirs} dirs, removed {removed} snapshots older than {days} days',
  'sparsify.msg': '{dirs} dirs · removed {removed}/{before} · kept {kept}',

  // ====== response/JSON errors ======
  'err.response_not_json': 'Response is not JSON ({ctype}): {body}',
  'err.json_parse': 'JSON parse failed: {msg}',
  'err.server_500_hint': '(server.py may need restart for new code)',
  'err.reveal_failed': 'reveal failed',
  'err.read_failed': 'Read failed',

  // ====== breadcrumb snapshot link ======
  'bc.snap_link_tooltip': 'Open history drawer',
  'bc.snap_count': '🗂 {n} snapshot(s)',

  // ====== md three-view (v1.13) ======
  'md.view.source': '📝 Source',
  'md.view.split': '⇔ Split',
  'md.view.preview': '👁 Preview',
  'md.view.source.tip': 'Show source only (hide preview)',
  'md.view.split.tip': 'Show source and preview side by side',
  'md.view.preview.tip': 'Show preview only (hide source)',
  'md.view.hint': 'Edit on the left · Live preview on the right · Auto snapshot every 2s',

  // ====== v1.19: Finder-style modal + drag-editable ======
  'modal.folder.title.file': 'Open a file',
  'modal.folder.title.folder': 'Select a folder',
  'modal.folder.shortcuts': 'Shortcuts',
  'modal.folder.pinned': 'Pinned',
  'modal.folder.recent': 'Recent',
  'modal.folder.group.today': 'Today',
  'modal.folder.group.earlier': 'Earlier',
  'modal.folder.empty_files': 'No HTML/Markdown files in this directory',
  'modal.folder.size_kb': '{n} KB',
  'modal.folder.size_mb': '{n} MB',
  'modal.folder.rel_time.hours': '{n}h ago',
  'modal.folder.rel_time.days': '{n}d ago',
  'modal.folder.rel_time.now': 'just now',
  'modal.folder.confirm.file': 'Open this file',
  'modal.folder.confirm.folder': 'Choose this folder',
  'modal.folder.selected.file': 'Selected: {name}',
  'modal.folder.selected.folder': 'Selected: {path}',
  'modal.folder.recent.empty': 'No recently opened files yet',
  'sidebar.open_file.tooltip': 'Open a file',
  'sidebar.open_file.btn': '📂',
  'welcome.open_file': '📄 Open a file',
  'dlg.dropbox.title': 'This dropbox file has unsaved changes',
  'dlg.dropbox.save_as': 'Save as new version',
  'dlg.dropbox.save_as.desc': 'Choose a location to save your edited copy',
  'dlg.dropbox.discard': 'Discard',
  'dlg.dropbox.discard.desc': 'Drop the dropbox copy, edits lost',
  'breadcrumb.dropbox': 'Dropbox copy',
  'toast.drag.uploaded': 'Loaded to dropbox (editable): {name}',
  'toast.drag.upload_failed': 'Upload failed: {msg}',
  'toast.save_as.success': 'Saved as: {path}',
  'toast.save_as.failed': 'Save as failed: {msg}',
  'toast.recent.file_deleted': 'File no longer exists, removed from recent: {name}',
  'sidebar.recent.opened_ago': 'opened {time}',
  'dlg.dropbox.save_as_prompt': 'Enter full destination path for the saved copy',
};
