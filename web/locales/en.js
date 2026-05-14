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
  'help.shortcut.toggle_sidebar': 'Show / hide sidebar',
  'help.shortcut.search': 'Focus search',
  'help.shortcut.refresh': 'Refresh tree',
  'help.shortcut.history': 'Open history',
  'help.shortcut.help': 'Show this panel',
  'help.shortcut.bold': 'Bold',
  'help.shortcut.italic': 'Italic',
  'help.shortcut.underline': 'Underline',

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
};
