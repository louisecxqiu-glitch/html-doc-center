/* ==========================================================================
 * HTML Document Center · 前端应用 v1.2
 * 变更：
 *   - F1 聚焦式目录：两层结构 + 默认收起 + 打开时自动滚动到高亮
 *   - F2 一键收起所有文件夹
 *   - F3 上次会话恢复（含缩放）
 *   - F4 文件/文件夹 icon 弹出操作菜单（Finder / 复制路径 / 复制名）
 *   - F5 Bug 修复：首次启动不再 2.5s 自动收起；空态目录保持展开
 * ========================================================================== */

(() => {
  "use strict";

  const API = {
    tree:        (opts = {}) => {
      const params = [];
      if (opts.sort) params.push("sort=" + encodeURIComponent(opts.sort));
      if (opts.force) params.push("refresh=1");
      return "/api/tree" + (params.length ? "?" + params.join("&") : "");
    },
    file:        (p, opts = {}) => "/api/file?path=" + encodeURIComponent(p) + (opts.bust ? "&_t=" + Date.now() : ""),
    save:        "/api/save",
    config:      "/api/config",
    browse:      (p) => "/api/browse" + (p ? "?path=" + encodeURIComponent(p) : ""),
    lastSession: "/api/last_session",
    reveal:      "/api/reveal",
    favorites:   "/api/favorites",
    move:        "/api/move",
  };

  const state = {
    tree: [],
    currentFile: null,   // { absPath, relPath, name }
    isDirty: false,
    lastSnapshotPath: null,
    iframeReady: false,
    /** 用户是否已主动与目录交互（用来判断首次启动后是否允许自动收起） */
    userInteractedSidebar: false,
    /** v1.6: 排序方式 mtime_desc | name_asc，从 localStorage 读取 */
    sortBy: localStorage.getItem("doc_center_sort") || "mtime_desc",
    /** v1.6: 收藏列表 [{path, type, added_at}] */
    favorites: [],
    /** v1.10.0: 目录树自动刷新 */
    autoRefresh: {
      intervalId: null,
      intervalSeconds: 10,         // 当前周期；0 = 关闭
      lastUserActivityTs: 0,       // 用户最近一次与树交互的时间戳，3 秒内不刷新
      isPolling: false,            // 防止上次请求未完成又触发新一次
      lastSig: null,               // v1.10.1: 上次拿到的目录签名，未变化时跳过全树拉取
    },
    /** v1.10.7: 最近打开文件 [{path, name, ts}]，最多 10 条，localStorage 持久化 */
    recent: [],
  };

  // ───────────── v1.10.7 最近打开 Recent Files ─────────────
  const RECENT_KEY = "doc_center_recent_v1";
  const RECENT_MAX = 10;

  function recentGet() {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.filter(x => x && x.path) : [];
    } catch (_) { return []; }
  }
  function recentSave(list) {
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch (_) {}
  }
  function recentAdd(node) {
    if (!node || !node.abs_path) return;
    const now = Date.now();
    let list = recentGet();
    // 去重：把同路径移除后前插
    list = list.filter(it => it.path !== node.abs_path);
    list.unshift({ path: node.abs_path, name: node.name || node.abs_path.split("/").pop(), ts: now });
    if (list.length > RECENT_MAX) list = list.slice(0, RECENT_MAX);
    recentSave(list);
    state.recent = list;
    renderRecentSection();
  }
  function recentRemove(absPath) {
    let list = recentGet().filter(it => it.path !== absPath);
    recentSave(list);
    state.recent = list;
    renderRecentSection();
  }
  function recentClear() {
    recentSave([]);
    state.recent = [];
    renderRecentSection();
  }
  function formatRecentTime(ts) {
    const diff = Date.now() - ts;
    if (diff < 60_000) return "刚刚";
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
    if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} 小时前`;
    if (diff < 7 * 86400_000) return `${Math.floor(diff / 86400_000)} 天前`;
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }
  function renderRecentSection() {
    const container = document.getElementById("recent-section");
    if (!container) return;
    const items = state.recent;
    if (!items.length) {
      container.innerHTML = "";  // 空态不占空间
      return;
    }
    const rows = items.slice(0, RECENT_MAX).map(item => {
      const name = item.name || item.path.split("/").pop();
      const icon = item.path.toLowerCase().endsWith(".md") ? "📝" : "📄";
      const timeLabel = formatRecentTime(item.ts);
      return `<div class="recent-item" data-path="${item.path}" title="${escapeHtml(item.path)}">
        <span class="recent-icon">${icon}</span>
        <span class="recent-name">${escapeHtml(name)}</span>
        <span class="recent-time">${timeLabel}</span>
        <button class="recent-remove" data-path="${item.path}" title="从最近列表移除">×</button>
      </div>`;
    }).join("");
    container.innerHTML =
      `<div class="recent-header">
        <span class="recent-title">🕐 最近打开 <span class="recent-count">(${items.length})</span></span>
        <button class="recent-clear" title="清空最近列表">清空</button>
       </div>` + rows;

    container.querySelectorAll(".recent-item").forEach(row => {
      row.addEventListener("click", (e) => {
        if (e.target.classList.contains("recent-remove")) return;
        const p = row.dataset.path;
        // v1.11.11: 切到目录 Tab 让用户在树里看到当前文件的高亮和位置
        sidebarTabsCtl && sidebarTabsCtl.activate("tree");
        openFile({ abs_path: p, name: p.split("/").pop(), type: p.toLowerCase().endsWith(".md") ? "md" : "html" });
      });
    });
    container.querySelectorAll(".recent-remove").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        recentRemove(btn.dataset.path);
      });
    });
    const clearBtn = container.querySelector(".recent-clear");
    if (clearBtn) {
      clearBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        recentClear();
        toast("已清空最近列表", "info");
      });
    }
  }
  function loadRecent() {
    state.recent = recentGet();
    renderRecentSection();
    sidebarTabsCtl.refreshCounts && sidebarTabsCtl.refreshCounts();
  }

  // ───────────── v1.11.2 侧栏三 Tab 切换（收藏 / 最近 / 目录）─────────────
  const SIDEBAR_TAB_KEY = "doc_center_sidebar_tab_v1";
  const sidebarTabsCtl = {
    init() {
      const tabsBar = document.getElementById("sidebar-tabs");
      if (!tabsBar) return;
      // 恢复持久化的 tab，默认 "tree"
      let cur = localStorage.getItem(SIDEBAR_TAB_KEY) || "tree";
      if (!["tree", "favorites", "recent"].includes(cur)) cur = "tree";
      this.activate(cur);
      tabsBar.addEventListener("click", (e) => {
        const btn = e.target.closest(".sidebar-tab");
        if (!btn) return;
        const t = btn.dataset.tab;
        if (t) this.activate(t);
      });
      this.refreshCounts();
    },
    activate(tab) {
      ["tree", "favorites", "recent"].forEach(t => {
        const tabBtn = document.querySelector(`.sidebar-tab[data-tab="${t}"]`);
        const pane = document.querySelector(`.sidebar-pane[data-pane="${t}"]`);
        if (tabBtn) tabBtn.classList.toggle("active", t === tab);
        if (pane) {
          pane.classList.toggle("active", t === tab);
          // v1.11.10: 清掉早期 inline style="display:none" 兜底（防止旧 HTML 残留）
          if (pane.style.display === "none") pane.style.removeProperty("display");
        }
      });
      // v1.11.10: 把当前 Tab 标到 sidebar 根，CSS 用它隐藏 footer 等只属于 tree 视图的元素
      const sidebar = document.getElementById("sidebar");
      if (sidebar) sidebar.setAttribute("data-active-tab", tab);
      try { localStorage.setItem(SIDEBAR_TAB_KEY, tab); } catch (_) {}
    },
    refreshCounts() {
      const favCount = (state.favorites || []).length;
      const recCount = (state.recent || []).length;
      const f = document.getElementById("tab-count-fav");
      const r = document.getElementById("tab-count-recent");
      if (f) f.textContent = favCount > 0 ? `(${favCount})` : "";
      if (r) r.textContent = recCount > 0 ? `(${recCount})` : "";
    },
  };

  // v1.10.10: 主题切换（auto / light / dark）
  function applyTheme(theme, silent = false) {
    if (theme !== "auto" && theme !== "light" && theme !== "dark") theme = "auto";
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("doc_center_theme", theme); } catch (_) {}
    const btn = document.getElementById("btn-theme");
    if (btn) {
      const labelMap = { auto: "🌓", light: "☀️", dark: "🌙" };
      const titleMap = {
        auto:  "主题：自动跟随系统（点击切换为浅色）",
        light: "主题：浅色（点击切换为深色）",
        dark:  "主题：深色（点击切换为自动）",
      };
      btn.textContent = labelMap[theme];
      btn.title = titleMap[theme];
    }
    if (!silent) {
      const txt = theme === "auto" ? "自动跟随系统" : theme === "light" ? "浅色模式" : "深色模式";
      toast(`主题：${txt}`, "info", null, 1500);
    }
  }

  // v1.10.9: 文件元信息（复用 /api/history，含 current_size / current_mtime / items 数）
  async function fetchFileMeta(absPath) {
    const url = "/api/history?path=" + encodeURIComponent(absPath);
    const r = await fetch(url);
    const d = await r.json();
    if (!d || !d.ok) throw new Error(d && d.error || "fetch meta failed");
    return d;
  }
  function formatBytes(n) {
    if (!n && n !== 0) return "-";
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(2) + " MB";
    return (n / 1024 / 1024 / 1024).toFixed(2) + " GB";
  }

  // ───────────── 工具 ─────────────
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function toast(msg, type = "info", sub = null, duration = 3000) {
    const t = document.createElement("div");
    t.className = "toast " + type;
    t.innerHTML = `<div>${msg}</div>${sub ? `<small>${sub}</small>` : ""}`;
    $("#toast-container").appendChild(t);
    setTimeout(() => {
      t.style.transition = "opacity 0.25s";
      t.style.opacity = "0";
      setTimeout(() => t.remove(), 250);
    }, duration);
  }

  function setStatus(text, cls) {
    $("#status-text").textContent = text;
    const dot = $("#status-dot");
    dot.className = "status-dot" + (cls ? " " + cls : "");
  }

  async function copyText(text, label) {
    try {
      await navigator.clipboard.writeText(text);
      toast(`${label} 已复制`, "success", text);
    } catch (e) {
      // 剪贴板不可用 → 兜底用 textarea + execCommand
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); toast(`${label} 已复制`, "success", text); }
      catch (_) { toast("复制失败", "error", e.message); }
      ta.remove();
    }
  }

  /**
   * 安全地 fetch + 解析 JSON。
   * v1.5.0 引入：解决后端返回 500 纯文本时前端报"Unexpected non-whitespace character after JSON"的问题。
   * - 非 2xx：读 text body，抛出带状态码的 Error
   * - 非 application/json：读 text，抛出带 content-type 提示的 Error
   * - JSON 解析失败：抛出更友好的错误
   */
  async function safeFetchJson(url, opts) {
    const r = await fetch(url, opts);
    const ctype = r.headers.get("content-type") || "";
    if (!r.ok) {
      let body = "";
      try { body = (await r.text()).trim().slice(0, 200); } catch (_) {}
      const hint = r.status === 500 ? "（可能需要重启 server.py 让新代码生效）" : "";
      throw new Error(`HTTP ${r.status}: ${body || r.statusText}${hint}`);
    }
    if (!ctype.includes("application/json")) {
      const body = (await r.text()).trim().slice(0, 200);
      throw new Error(`响应不是 JSON（${ctype}）：${body}`);
    }
    try {
      return await r.json();
    } catch (e) {
      throw new Error(`JSON 解析失败：${e.message}`);
    }
  }

  async function revealInFinder(absPath) {
    try {
      const r = await fetch(API.reveal, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: absPath }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "reveal 失败");
      toast("📂 已在 Finder 打开", "success");
    } catch (e) {
      toast("Finder 打开失败", "error", e.message);
    }
  }

  // ───────────── 缩放控制 ─────────────
  const zoomCtl = {
    current: 75,
    apply(level) {
      const frame = $("#doc-frame");
      if (!frame) return;
      this.current = level;

      const pct = parseInt(level, 10);
      const scale = pct / 100;
      frame.style.transformOrigin = "top left";
      frame.style.transform = `scale(${scale})`;
      frame.style.width = (100 / scale) + "%";
      frame.style.height = (100 / scale) + "%";

      $$(".zoom-btn").forEach(b => {
        const z = b.dataset.zoom;
        b.classList.toggle("active", String(z) === String(level));
      });
    },
  };

  const ZOOM_LEVELS = ["25", "50", "75", "100", "125", "150"];
  function zoomStep(delta) {
    const idx = ZOOM_LEVELS.indexOf(String(zoomCtl.current));
    const nextIdx = Math.max(0, Math.min(ZOOM_LEVELS.length - 1, idx + delta));
    zoomCtl.apply(ZOOM_LEVELS[nextIdx]);
  }

  // ───────────── 侧边栏控制 ─────────────
  const sidebarCtl = {
    hoverTimer: null,
    pinned: false,
    isVisible() { return $("#sidebar").classList.contains("visible"); },
    show(pinned = false) {
      $("#sidebar").classList.add("visible");
      $("#btn-toggle-sidebar").classList.add("active");
      if (pinned) this.pinned = true;
      // 聚焦到当前高亮文件：展开它所在分支 + 滚动到可视区域
      scrollToActiveFile();
    },
    hide() {
      $("#sidebar").classList.remove("visible");
      $("#btn-toggle-sidebar").classList.remove("active");
      this.pinned = false;
    },
    toggle() {
      state.userInteractedSidebar = true;
      this.isVisible() ? this.hide() : this.show(true);
    },
    /** 选文件后自动收起（仅当非 pinned 模式） */
    autoHideAfterSelect() {
      if (!this.pinned && this.isVisible()) {
        setTimeout(() => this.hide(), 180);
      }
    },
  };

  function scrollToActiveFile() {
    if (!state.currentFile) return;
    const active = $(".tree-node-label.active");
    if (!active) return;
    // 先收起所有非根目录（避免残留其他分支的展开状态）
    $$(".tree-node:not(.tree-root)").forEach(n => {
      // 只收起"目录节点"，文件节点本身没有 collapsed 含义
      if (n.querySelector(":scope > .tree-node-children")) {
        n.classList.add("collapsed");
      }
    });
    // 清除旧的 in-active-chain / is-active
    $$(".in-active-chain").forEach(n => n.classList.remove("in-active-chain"));
    $$(".tree-root.is-active").forEach(n => n.classList.remove("is-active"));

    // 再展开当前高亮文件所在的父链，并沿途打上 in-active-chain
    let cur = active.parentElement;
    while (cur && cur.classList && cur.classList.contains("tree-node")) {
      cur.classList.remove("collapsed");
      cur.classList.add("in-active-chain");
      if (cur.classList.contains("tree-root")) cur.classList.add("is-active");
      cur = cur.parentElement && cur.parentElement.closest(".tree-node");
    }
    // 其他扫描根默认折叠（用户记忆位置不变，只是折叠）
    $$(".tree-root:not(.is-active)").forEach(n => n.classList.add("collapsed"));

    // 滚到视野中央
    requestAnimationFrame(() => {
      try { active.scrollIntoView({ block: "center", behavior: "smooth" }); }
      catch (_) { active.scrollIntoView(); }
    });
  }

  // ───────────── 目录树加载/渲染 ─────────────
  async function loadTree(force = false, silent = false) {
    try {
      const r = await fetch(API.tree({ sort: state.sortBy, force }));
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "加载失败");
      const newRoots = d.roots || [];
      if (silent && state.tree && state.tree.length > 0) {
        // v1.10.0: 静默刷新走 diff 路径，保持展开/选中/编辑态
        diffTreeAndPatch(newRoots);
      } else {
        renderTree(newRoots);
      }
      state.tree = newRoots;
    } catch (e) {
      if (silent) {
        // 静默模式失败不打扰用户
        console.warn("[auto-refresh] tree fetch failed:", e.message);
        return;
      }
      $("#tree").innerHTML = `<div class="tree-empty">加载失败：${e.message}</div>`;
      toast("目录树加载失败", "error", e.message);
    }
  }

  // ───────────── v1.6 收藏 ─────────────
  async function loadFavorites() {
    try {
      const d = await safeFetchJson(API.favorites);
      state.favorites = d.items || [];
      renderFavoritesSection();
      sidebarTabsCtl.refreshCounts && sidebarTabsCtl.refreshCounts();
    } catch (e) {
      // 静默失败，不阻塞主流程
      console.warn("[favorites] load failed:", e);
      state.favorites = [];
    }
  }

  function isFavorited(absPath) {
    return state.favorites.some(i => i.path === absPath);
  }

  async function toggleFavorite(absPath, type, displayName) {
    const currentlyFav = isFavorited(absPath);
    const action = currentlyFav ? "remove" : "add";
    try {
      const d = await safeFetchJson(API.favorites, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, path: absPath, type: type || "file" }),
      });
      if (!d.ok) throw new Error(d.error || "收藏操作失败");
      state.favorites = d.items || [];
      renderFavoritesSection();
      sidebarTabsCtl.refreshCounts && sidebarTabsCtl.refreshCounts();
      // 刷新树中对应节点的星标态
      refreshFavStars();
      toast(
        currentlyFav ? "已取消收藏" : "⭐ 已收藏",
        "success",
        displayName || absPath
      );
    } catch (e) {
      toast("收藏失败", "error", e.message);
    }
  }

  /** 更新所有 fav-btn 的激活态（不重渲染整棵树） */
  function refreshFavStars() {
    $$(".fav-btn").forEach(btn => {
      const p = btn.dataset.path;
      if (!p) return;
      const fav = isFavorited(p);
      btn.classList.toggle("is-fav", fav);
      btn.textContent = fav ? "★" : "☆";
      btn.title = fav ? "取消收藏" : "添加到收藏";
    });
  }

  function renderFavoritesSection() {
    const container = $("#favorites-section");
    if (!container) return;
    const items = state.favorites;
    if (!items.length) {
      container.innerHTML =
        `<div class="fav-header"><span class="fav-title">⭐ 收藏 <span class="fav-count">(0)</span></span></div>` +
        `<div class="fav-empty">点文件/目录旁的 ☆ 添加收藏</div>`;
      return;
    }
    const rows = items.map(item => {
      const isDir = item.type === "dir";
      const icon = isDir ? "📁" : (item.path.toLowerCase().endsWith(".md") ? "📝" : "📄");
      const name = item.path.split("/").pop() || item.path;
      return `<div class="fav-item" data-path="${item.path}" data-type="${item.type}" title="${item.path}">
        <span class="fav-icon">${icon}</span>
        <span class="fav-name">${escapeHtml(name)}</span>
        <button class="fav-unfav" data-path="${item.path}" title="取消收藏">★</button>
      </div>`;
    }).join("");
    container.innerHTML =
      `<div class="fav-header"><span class="fav-title">⭐ 收藏 <span class="fav-count">(${items.length})</span></span></div>` +
      rows;

    // 绑定事件
    container.querySelectorAll(".fav-item").forEach(row => {
      row.addEventListener("click", (e) => {
        if (e.target.classList.contains("fav-unfav")) return;  // 由下面单独处理
        const p = row.dataset.path;
        const type = row.dataset.type;
        // v1.11.11: 不论点的是文件还是目录，都切到目录 Tab 让用户落到主战场
        // （保持收藏 Tab 会让目录树高亮/scrollToActiveFile 在隐藏 DOM 内不可见）
        sidebarTabsCtl && sidebarTabsCtl.activate("tree");
        if (type === "file") {
          // 构造类 node 对象传给 openFile（openFile 会调 scrollToActiveFile）
          openFile({ abs_path: p, name: p.split("/").pop(), type: p.toLowerCase().endsWith(".md") ? "md" : "html" });
        } else {
          // 目录 → 等 Tab 切换后下一帧再 scrollToPath
          requestAnimationFrame(() => {
            scrollToPath(p);
          });
        }
      });
    });
    container.querySelectorAll(".fav-unfav").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const p = btn.dataset.path;
        const it = state.favorites.find(i => i.path === p);
        if (it) toggleFavorite(p, it.type, p.split("/").pop());
      });
    });
  }

  /** 工具：转义 HTML */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  /** 尝试在树中定位并展开某路径（用于点击收藏目录） */
  function scrollToPath(absPath) {
    // 简单实现：如果是扫描根之一，滚到它；否则把最近的父链展开
    const el = document.querySelector(`.tree-node-label[title="${absPath}"]`);
    if (el) {
      // 展开所有祖先
      let p = el.parentElement;
      while (p && p !== $("#tree")) {
        p.classList.remove("collapsed");
        p = p.parentElement;
      }
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      el.classList.add("flash-highlight");
      setTimeout(() => el.classList.remove("flash-highlight"), 1200);
    }
  }

  function countFiles(nodes) {
    let n = 0;
    for (const node of nodes) {
      if (node.type === "html" || node.type === "md") n++;
      if (node.children) n += countFiles(node.children);
    }
    return n;
  }

  /**
   * F1 聚焦式渲染（v1.2.1 修正）：
   *   - 扫描根（Lv0）默认展开
   *   - 一级子目录（Lv1）默认收起
   *   - 更深层级保留真实嵌套结构（不再扁平化！）
   *   - 打开文件时：只展开当前文件所在的那一条父链（由 scrollToActiveFile 处理）
   */
  function renderTree(roots) {
    const container = $("#tree");
    container.innerHTML = "";
    if (!roots.length) {
      container.innerHTML =
        `<div class="tree-empty tree-empty-cta">
          <div class="empty-cta-icon">📂</div>
          <div>还没有扫描目录</div>
          <button id="btn-empty-add" class="btn-empty-add">＋ 添加目录</button>
        </div>`;
      $("#tree-stats").textContent = "0 个文件";
      // 绑定空态按钮事件
      const emptyBtn = document.getElementById("btn-empty-add");
      if (emptyBtn) emptyBtn.addEventListener("click", openBrowseDialog);
      return;
    }
    let totalFiles = 0;
    for (const root of roots) {
      totalFiles += countFiles(root.children || []);
      container.appendChild(renderNode(root, /*depth*/ 0));
    }
    $("#tree-stats").textContent = `${roots.length} 个根目录 · ${totalFiles} 个文档`;
    applySearchFilter();
  }

  // ───────────── v1.10.0: 目录树自动刷新（diff + 轮询）─────────────

  /** 把 tree 扁平化成 Map<absPath, {node, parentPath, depth}>。用于 diff 比对。 */
  function flatTree(roots) {
    const m = new Map();
    function walk(node, parentPath, depth) {
      const p = node.abs_path || node.path;
      if (!p) return;
      m.set(p, { node, parentPath, depth });
      if (node.type === "dir" && Array.isArray(node.children)) {
        for (const child of node.children) walk(child, p, depth + 1);
      }
    }
    for (const r of roots) walk(r, null, 0);
    return m;
  }

  /** 静默 diff：对比新旧 tree，只增删变化的 DOM 节点，保持现有展开/选中态。 */
  function diffTreeAndPatch(newRoots) {
    const oldFlat = flatTree(state.tree);
    const newFlat = flatTree(newRoots);
    const added = [];
    const removed = [];
    for (const p of newFlat.keys()) if (!oldFlat.has(p)) added.push(p);
    for (const p of oldFlat.keys()) if (!newFlat.has(p)) removed.push(p);
    if (added.length === 0 && removed.length === 0) {
      // v1.10.0: 没有结构变化，但要保证 stats 数字与 newRoots 一致（mtime 排序时序可能略有差异）
      return;
    }

    // 移除：淡出 200ms 后从 DOM 删除
    for (const p of removed) {
      const el = document.querySelector(`#tree .tree-node[data-path="${cssEscape(p)}"]`);
      if (!el) continue;
      el.classList.add("tree-node-fade-out");
      setTimeout(() => { try { el.remove(); } catch (_) {} }, 220);
    }

    // 新增：找到父节点 DOM，按 newFlat 里的同级排序插入到正确位置（v1.10.4: 修正 mtime_desc 排序失效）
    for (const p of added) {
      const meta = newFlat.get(p);
      if (!meta) continue;
      const parentPath = meta.parentPath;
      let parentChildrenContainer;
      let parentNode = null;
      if (parentPath === null) {
        // 新增的是扫描根
        parentChildrenContainer = $("#tree");
      } else {
        const parentEl = document.querySelector(`#tree .tree-node[data-path="${cssEscape(parentPath)}"]`);
        if (!parentEl) continue; // 父节点也是新增的，等下一轮（实际它会一起出现，所以这里跳过没问题）
        parentChildrenContainer = parentEl.querySelector(":scope > .tree-node-children");
        if (!parentChildrenContainer) continue;
        parentNode = newFlat.get(parentPath) ? newFlat.get(parentPath).node : null;
      }
      const newEl = renderNode(meta.node, meta.depth);
      newEl.classList.add("tree-node-fade-in");
      // v1.10.4: 计算新节点在 newFlat 父级 children 数组里的 index，定位到真实位置
      // 找出 parent.children 数组里 p 之前的兄弟节点（在新树里，已按 sort_by 排好序）
      const siblings = parentNode ? (parentNode.children || []) : (newRoots || []);
      const myIdx = siblings.findIndex(c => (c.abs_path || c.path) === p);
      if (myIdx <= 0) {
        parentChildrenContainer.insertBefore(newEl, parentChildrenContainer.firstChild);
      } else {
        // 找在 myIdx 之前、已经存在于 DOM 的最近邻兄弟
        let inserted = false;
        for (let i = myIdx - 1; i >= 0; i--) {
          const prevPath = siblings[i].abs_path || siblings[i].path;
          const prevEl = parentChildrenContainer.querySelector(`:scope > .tree-node[data-path="${cssEscape(prevPath)}"]`);
          if (prevEl) {
            // 插到 prevEl 之后
            if (prevEl.nextSibling) parentChildrenContainer.insertBefore(newEl, prevEl.nextSibling);
            else parentChildrenContainer.appendChild(newEl);
            inserted = true;
            break;
          }
        }
        if (!inserted) parentChildrenContainer.insertBefore(newEl, parentChildrenContainer.firstChild);
      }
    }

    // 更新统计
    let totalFiles = 0;
    for (const root of newRoots) totalFiles += countFiles(root.children || []);
    $("#tree-stats").textContent = `${newRoots.length} 个根目录 · ${totalFiles} 个文档`;

    // 轻量提示（仅 console，不打扰用户）
    console.info(`[auto-refresh] +${added.length} -${removed.length}`);
  }

  /** CSS 选择器转义（简化版，处理常见的路径字符） */
  function cssEscape(s) {
    if (window.CSS && CSS.escape) return CSS.escape(s);
    return String(s).replace(/(["\\])/g, "\\$1");
  }

  /** 启动自动刷新轮询（seconds=0 关闭） */
  function startAutoRefresh(seconds) {
    stopAutoRefresh();
    seconds = parseInt(seconds, 10);
    if (!seconds || seconds <= 0) {
      state.autoRefresh.intervalSeconds = 0;
      console.info("[auto-refresh] disabled");
      return;
    }
    state.autoRefresh.intervalSeconds = seconds;
    state.autoRefresh.intervalId = setInterval(tickAutoRefresh, seconds * 1000);
    console.info(`[auto-refresh] started, every ${seconds}s`);
  }

  function stopAutoRefresh() {
    if (state.autoRefresh.intervalId) {
      clearInterval(state.autoRefresh.intervalId);
      state.autoRefresh.intervalId = null;
    }
  }

  /** 单次轮询触发：可见 + 用户最近无操作 + 没在轮询中 →
   *  v1.10.1 优化：先拉 ~80 字节的 /api/tree-sig，签名变化时才拉全树。
   *  实测 99.99% 流量节省（4001 节点的扫描根从 1.3MB → 102B/次） */
  async function tickAutoRefresh() {
    if (document.hidden) return;                                  // 标签页隐藏，跳过
    if (state.autoRefresh.isPolling) return;                      // 上次还没结束
    const sinceUserAct = Date.now() - state.autoRefresh.lastUserActivityTs;
    if (sinceUserAct < 3000) return;                              // 用户 3 秒内有树交互，让用户先操作完
    state.autoRefresh.isPolling = true;
    try {
      // Step 1: 极轻量签名比对
      const r = await fetch("/api/tree-sig");
      if (!r.ok) {
        console.warn("[auto-refresh] tree-sig HTTP", r.status);
        return;
      }
      const d = await r.json();
      if (!d.ok) {
        console.warn("[auto-refresh] tree-sig not ok:", d.error);
        return;
      }
      // Step 2: 签名未变 → 跳过全树拉取
      if (state.autoRefresh.lastSig && d.sig === state.autoRefresh.lastSig) {
        return;
      }
      // Step 3: 签名变化（或首次）→ 拉全树走 diff 路径
      state.autoRefresh.lastSig = d.sig;
      await loadTree(/*force*/ true, /*silent*/ true);
    } catch (e) {
      console.warn("[auto-refresh] failed:", e.message);
    } finally {
      state.autoRefresh.isPolling = false;
    }
  }

  function bindAutoRefreshTriggers() {
    // 树交互记录：3 秒守护期
    const tree = document.getElementById("tree");
    if (tree) {
      ["mouseover", "click", "dragstart", "drop"].forEach(evt => {
        tree.addEventListener(evt, () => {
          state.autoRefresh.lastUserActivityTs = Date.now();
        });
      });
    }
    // 标签页可见性变化
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        // 隐藏时停轮询节省电量
        if (state.autoRefresh.intervalId) {
          clearInterval(state.autoRefresh.intervalId);
          state.autoRefresh.intervalId = null;
        }
      } else if (state.autoRefresh.intervalSeconds > 0) {
        // 切回来：立即触发一次 + 重启轮询
        tickAutoRefresh();
        if (!state.autoRefresh.intervalId) {
          state.autoRefresh.intervalId = setInterval(tickAutoRefresh, state.autoRefresh.intervalSeconds * 1000);
        }
      }
    });
  }

  /** 递归渲染：保留真实嵌套；depth=0 是扫描根，depth=1 是一级子目录，>=1 默认收起 */
  function renderNode(node, depth) {
    const el = document.createElement("div");
    el.className = "tree-node";
    if (depth === 0) el.classList.add("tree-root");
    if (depth === 1) el.classList.add("tree-lv1");
    // v1.10.0: 给每个节点打上唯一 path 标识，便于自动刷新 diff
    const nodePath = node.abs_path || node.path;
    if (nodePath) el.dataset.path = nodePath;
    if (node.type) el.dataset.type = node.type;

    if (node.type === "dir") {
      const label = createDirLabel(node, /*isRoot*/ depth === 0);
      const children = document.createElement("div");
      children.className = "tree-node-children";
      for (const child of (node.children || [])) {
        children.appendChild(renderNode(child, depth + 1));
      }
      el.append(label, children);
      // v1.6.1 + v1.7.4: 折叠策略
      // - 有 currentFile 时：扫描根 + 一级子目录全折叠，由 scrollToActiveFile 展开当前文件的父链
      // - 无 currentFile 时：扫描根和一级子目录保持展开（沿用 v1.2 行为）
      // - depth >= 2 的目录始终默认收起
      // v1.7.4 修复：v1.6.1 漏了 depth=1 的默认折叠，导致拖拽后 expandAndFlashPath
      //   展开扫描根时，一级子目录全都展开，视觉爆炸
      if (state.currentFile) {
        if (depth === 0 || depth === 1) el.classList.add("collapsed");
        else if (depth >= 2) el.classList.add("collapsed");
      } else {
        if (depth >= 2) el.classList.add("collapsed");
      }
    } else {
      // 文件
      el.classList.add("tree-file");
      el.appendChild(createFileLabel(node));
    }
    // v1.7: 拖拽（文件/非扫描根目录可拖拽；目录可作为 drop target）
    wireDragAndDrop(el, node, /*isRoot*/ depth === 0);
    return el;
  }

  /** 创建目录 label（含 icon 菜单 + v1.6 收藏星标 + v1.6.1 文件计数） */
  function createDirLabel(node, isRoot) {
    const label = document.createElement("div");
    label.className = "tree-node-label tree-dir-label";
    label.title = node.abs_path || node.path;

    const toggle = document.createElement("span");
    toggle.className = "tree-toggle";
    toggle.textContent = "▾";

    const icon = document.createElement("span");
    icon.className = "tree-icon tree-icon-btn";
    // v1.6.1: active 根用打开图标，其他用 📁
    icon.textContent = isRoot ? "📂" : "📁";
    icon.title = "点击打开操作菜单";
    icon.addEventListener("click", (e) => {
      e.stopPropagation();
      state.userInteractedSidebar = true;
      openIconMenu(icon, /*isDir*/ true, node.abs_path || node.path, node.name);
    });

    const name = document.createElement("span");
    name.className = "tree-name";
    // v1.6.1: 去掉 〔根〕 文字，用字号 + 背景 + 金边暗示层级
    name.textContent = node.name;

    // v1.6.1: 子目录（非扫描根）附加文件数 (N)
    let countEl = null;
    if (!isRoot) {
      const n = countFiles(node.children || []);
      if (n > 0) {
        countEl = document.createElement("span");
        countEl.className = "tree-dir-count";
        countEl.textContent = `(${n})`;
      }
    }

    // v1.6: 收藏星标（扫描根不允许收藏）
    const favBtn = isRoot ? null : createFavBtn(node.abs_path || node.path, "dir");

    label.append(toggle, icon, name);
    if (countEl) label.append(countEl);
    if (favBtn) label.append(favBtn);

    // 点击 label 其他部分 → 展开/收起
    label.addEventListener("click", (e) => {
      if (e.target.classList.contains("fav-btn")) return;  // 星标单独处理
      state.userInteractedSidebar = true;
      const el = label.parentElement;
      el.classList.toggle("collapsed");
    });
    return label;
  }

  /** 创建文件 label（含 icon 菜单 + v1.6 收藏星标 + v1.6.1 tooltip 强化） */
  function createFileLabel(node) {
    const label = document.createElement("div");
    label.className = "tree-node-label";
    // v1.6.1: 强化 tooltip——两行显示文件名和完整路径
    label.title = `${node.name}\n${node.abs_path || node.path}`;
    label.dataset.file = node.abs_path;
    label.dataset.name = node.name;

    // 缩进占位（和 dir label 的 toggle 对齐）
    const pad = document.createElement("span");
    pad.className = "tree-toggle tree-toggle-placeholder";
    pad.textContent = " ";

    const icon = document.createElement("span");
    icon.className = "tree-icon tree-icon-btn";
    icon.textContent = node.type === "md" ? "📝" : "📄";
    icon.title = "点击打开操作菜单";
    icon.addEventListener("click", (e) => {
      e.stopPropagation();
      state.userInteractedSidebar = true;
      openIconMenu(icon, /*isDir*/ false, node.abs_path, node.name);
    });

    const name = document.createElement("span");
    name.className = "tree-name";
    name.textContent = node.name;

    const favBtn = createFavBtn(node.abs_path, "file");

    label.append(pad, icon, name, favBtn);
    // 点击 label 空白处/文件名 → 打开文件（保持原行为，在 iframe 内）
    label.addEventListener("click", (e) => {
      if (e.target.classList.contains("fav-btn")) return;
      openFile(node);
    });
    return label;
  }

  /** v1.6: 创建收藏星标按钮 */
  function createFavBtn(absPath, type) {
    const btn = document.createElement("button");
    const fav = isFavorited(absPath);
    btn.className = "fav-btn" + (fav ? " is-fav" : "");
    btn.dataset.path = absPath;
    btn.dataset.favType = type;
    btn.textContent = fav ? "★" : "☆";
    btn.title = fav ? "取消收藏" : "添加到收藏";
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      toggleFavorite(absPath, type, absPath.split("/").pop());
    });
    return btn;
  }

  // ═════════════════════════════════════════════════════════════
  // v1.7: 拖拽移动文件/目录
  // ═════════════════════════════════════════════════════════════
  const DND_MIME = "application/x-doc-center-move";

  /**
   * 把 tree-node 根元素挂上 draggable 和拖拽事件。
   * - 扫描根：不可拖拽，但**可以作为 drop target**（支持跨根移动）
   * - 子目录：可拖拽 + 可作为 drop target
   * - 文件：可拖拽，不可作为 drop target
   */
  function wireDragAndDrop(nodeEl, node, isRoot) {
    const isDir = node.type === "dir";
    const absPath = node.abs_path;

    // ─── 作为拖拽源（扫描根不可拖） ───
    if (!isRoot) {
      nodeEl.draggable = true;

      nodeEl.addEventListener("dragstart", (e) => {
        // dirty 文件不允许拖走（提前拦截，一行 class 都不碰，避免残留视觉）
        if (state.currentFile && state.currentFile.absPath === absPath && state.isDirty) {
          e.preventDefault();
          toast("⚠️ 请先保存当前修改再移动此文件", "warning", absPath.split("/").pop());
          return;
        }
        e.stopPropagation();
        const payload = { path: absPath, type: isDir ? "dir" : "file", name: node.name };
        try {
          e.dataTransfer.setData(DND_MIME, JSON.stringify(payload));
          e.dataTransfer.setData("text/plain", absPath);
          e.dataTransfer.effectAllowed = "move";
        } catch (_) {}
        nodeEl.classList.add("dnd-dragging");
      });

      nodeEl.addEventListener("dragend", () => {
        nodeEl.classList.remove("dnd-dragging");
        $$(".dnd-target-active").forEach(el => el.classList.remove("dnd-target-active"));
      });
    }

    // ─── 作为 drop target（仅目录，含扫描根） ───
    if (!isDir) return;

    // drop target 用 label 作为命中区
    const labelEl = nodeEl.querySelector(":scope > .tree-node-label");
    if (!labelEl) return;

    labelEl.addEventListener("dragover", (e) => {
      // 有我们的 mime 类型才响应（不区分大小写，某些浏览器会小写化）
      const types = Array.from(e.dataTransfer.types || []).map(t => t.toLowerCase());
      if (!types.includes(DND_MIME.toLowerCase())) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "move";
      labelEl.classList.add("dnd-target-active");
    });

    labelEl.addEventListener("dragleave", (e) => {
      // 仅当真正离开 label 时移除（避免 hover 子元素闪烁）
      if (!labelEl.contains(e.relatedTarget)) {
        labelEl.classList.remove("dnd-target-active");
      }
    });

    labelEl.addEventListener("drop", async (e) => {
      const types = Array.from(e.dataTransfer.types || []).map(t => t.toLowerCase());
      if (!types.includes(DND_MIME.toLowerCase())) return;
      e.preventDefault();
      e.stopPropagation();
      labelEl.classList.remove("dnd-target-active");

      let payload;
      try {
        payload = JSON.parse(e.dataTransfer.getData(DND_MIME));
      } catch (_) { return; }

      await handleDrop(payload, absPath, node.name);
    });
  }

  async function handleDrop(srcPayload, dstDirAbs, dstDirName) {
    // 前端硬拦截：拖到自己 / 自己的子目录 / 同父目录（无效）
    if (srcPayload.path === dstDirAbs) {
      toast("不能拖到自己", "warning");
      return;
    }
    if (srcPayload.type === "dir" && dstDirAbs.startsWith(srcPayload.path + "/")) {
      toast("不能拖到自己的子目录", "warning");
      return;
    }
    // 同父目录检测
    const srcParent = srcPayload.path.split("/").slice(0, -1).join("/");
    if (srcParent === dstDirAbs) {
      toast("已经在该目录下，无需移动", "info");
      return;
    }

    // Confirm
    const label = srcPayload.type === "dir" ? "目录" : "文件";
    if (!confirm(
      `将${label}「${srcPayload.name}」移动到：\n${dstDirAbs}\n\n确认？`
    )) return;

    try {
      const d = await safeFetchJson(API.move, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ src: srcPayload.path, dst_dir: dstDirAbs }),
      });
      if (!d.ok) {
        if (d.error === "conflict") {
          toast("目标已存在同名，移动取消", "warning", d.message || d.conflict_path);
        } else {
          toast("移动失败", "error", d.error || d.message);
        }
        return;
      }
      toast(
        "✅ 已移动",
        "success",
        `${srcPayload.name} → ${dstDirName}${d.moved_snapshots ? `（快照 ${d.moved_snapshots} 个同步）` : ""}`
      );

      // 如果移动的是当前打开文件，更新 currentFile 引用
      const wasCurrent = state.currentFile && state.currentFile.absPath === srcPayload.path;
      if (wasCurrent) {
        state.currentFile.absPath = d.new_abs_path;
      }

      // 刷新树 + 收藏（收藏可能含被移动的路径）
      await Promise.all([loadTree(true), loadFavorites()]);

      // v1.7.4: 合并展开逻辑，避免 scrollToActiveFile 和 expandAndFlashPath 冲突
      // - 如果移动的是当前文件：它的新位置就是 active，只展开新位置即可
      // - 如果移动的不是当前文件：先恢复当前文件的父链，再 flash 新位置
      requestAnimationFrame(() => {
        if (wasCurrent) {
          // 新路径同时承担"当前文件"和"闪烁目标"两个角色
          expandAndFlashPath(d.new_abs_path);
        } else {
          if (state.currentFile) scrollToActiveFile();
          expandAndFlashPath(d.new_abs_path);
        }
      });
    } catch (e) {
      toast("移动失败", "error", e.message);
    }
  }

  /**
   * v1.7.1: 展开路径对应的节点父链并金色闪烁高亮
   * - absPath 可能是文件或目录，都能定位
   * - 父链全部去 collapsed，目标 label 加 .flash-highlight 1.2s
   */
  function expandAndFlashPath(absPath) {
    if (!absPath) return;
    // 匹配 dataset.file（文件）或 title（目录/文件）
    const candidates = [
      document.querySelector(`.tree-node-label[data-file="${cssEscape(absPath)}"]`),
      ...document.querySelectorAll(`.tree-node-label[title^="${cssEscape(absPath)}"]`),
    ].filter(Boolean);
    // 取 title 严格等于 absPath 的（因 tooltip 里可能带换行）
    const targetLabel = candidates.find(el => {
      const t = el.getAttribute("title") || "";
      return t === absPath || t.split("\n").pop() === absPath;
    }) || candidates[0];
    if (!targetLabel) return;

    // 展开所有祖先
    let p = targetLabel.parentElement;
    while (p && p.classList && p.classList.contains("tree-node")) {
      p.classList.remove("collapsed");
      p = p.parentElement && p.parentElement.closest(".tree-node");
    }
    // 滚入可视区 + 闪烁
    try { targetLabel.scrollIntoView({ block: "center", behavior: "smooth" }); }
    catch (_) { targetLabel.scrollIntoView(); }
    targetLabel.classList.add("flash-highlight");
    setTimeout(() => targetLabel.classList.remove("flash-highlight"), 1400);
  }

  /** 简化版 CSS.escape，用于安全拼 attr selector */
  function cssEscape(s) {
    if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(s);
    return String(s).replace(/["\\]/g, "\\$&");
  }

  // ═════════════════════════════════════════════════════════════

  // ───────────── F4 icon 菜单 ─────────────
  const iconMenuCtl = {
    el: null,
    close() {
      if (this.el) { this.el.remove(); this.el = null; }
      document.removeEventListener("click", this._onDocClick, true);
      document.removeEventListener("keydown", this._onKey, true);
    },
    _onDocClick: (e) => {
      if (iconMenuCtl.el && !iconMenuCtl.el.contains(e.target)) iconMenuCtl.close();
    },
    _onKey: (e) => {
      if (e.key === "Escape") iconMenuCtl.close();
    },
  };

  function openIconMenu(anchorEl, isDir, absPath, name) {
    iconMenuCtl.close();
    const menu = document.createElement("div");
    menu.className = "tree-icon-menu";

    const items = [
      { icon: "📂", text: isDir ? "在 Finder 打开此目录" : "在 Finder 打开",
        onClick: () => revealInFinder(absPath) },
      { icon: "📋", text: isDir ? "复制目录路径" : "复制完整路径",
        onClick: () => copyText(absPath, "路径") },
    ];
    if (!isDir) {
      items.push({ icon: "📄", text: "复制文件名",
        onClick: () => copyText(name, "文件名") });
    }

    for (const it of items) {
      const btn = document.createElement("button");
      btn.className = "tree-icon-menu-item";
      btn.innerHTML = `<span class="mi-icon">${it.icon}</span><span>${it.text}</span>`;
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        it.onClick();
        iconMenuCtl.close();
      });
      menu.appendChild(btn);
    }

    document.body.appendChild(menu);
    // 定位到 anchor 右下方
    const rect = anchorEl.getBoundingClientRect();
    const mw = menu.offsetWidth;
    const mh = menu.offsetHeight;
    let left = rect.right + 4;
    let top = rect.top + rect.height / 2 - 8;
    // 右溢出 → 摆到左侧
    if (left + mw > window.innerWidth - 8) left = rect.left - mw - 4;
    // 下溢出 → 上移
    if (top + mh > window.innerHeight - 8) top = window.innerHeight - mh - 8;
    if (top < 8) top = 8;
    menu.style.left = left + "px";
    menu.style.top = top + "px";

    iconMenuCtl.el = menu;
    // 延后一帧绑定，避免当前这次 click 立刻触发关闭
    requestAnimationFrame(() => {
      document.addEventListener("click", iconMenuCtl._onDocClick, true);
      document.addEventListener("keydown", iconMenuCtl._onKey, true);
    });
  }

  // ───────────── 搜索过滤 ─────────────
  function applySearchFilter() {
    const q = ($("#search-box").value || "").trim().toLowerCase();
    const nodes = $$(".tree-node");
    const stat = $("#search-stat");

    // v1.10.8: 清掉上次的高亮 mark
    $$(".tree-name mark.search-hit").forEach(m => {
      const parent = m.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(m.textContent), m);
        parent.normalize();
      }
    });

    if (!q) {
      nodes.forEach(n => n.style.display = "");
      if (stat) stat.textContent = "";
      return;
    }
    nodes.forEach(n => n.style.display = "none");

    const allFileLabels = $$(".tree-node-label[data-file]");
    let matchCount = 0;
    allFileLabels.forEach(lbl => {
      const name = (lbl.dataset.name || "").toLowerCase();
      const fullPath = (lbl.dataset.file || "").toLowerCase();
      // v1.10.8: 文件名命中或路径片段命中都算
      const hitInName = name.includes(q);
      const hitInPath = !hitInName && fullPath.includes(q);
      if (!hitInName && !hitInPath) return;

      matchCount++;
      // v1.10.8: 文件名内命中 → 高亮匹配字符
      if (hitInName) {
        const span = lbl.querySelector(".tree-name");
        if (span) {
          const original = lbl.dataset.name || "";
          const idx = original.toLowerCase().indexOf(q);
          if (idx >= 0) {
            span.innerHTML =
              escapeHtml(original.slice(0, idx)) +
              `<mark class="search-hit">${escapeHtml(original.slice(idx, idx + q.length))}</mark>` +
              escapeHtml(original.slice(idx + q.length));
          }
        }
      }

      // 展开命中节点的所有祖先链
      let cur = lbl.parentElement;
      while (cur && cur.classList.contains("tree-node")) {
        cur.style.display = "";
        cur.classList.remove("collapsed");
        cur = cur.parentElement && cur.parentElement.closest(".tree-node");
      }
    });

    if (stat) {
      stat.textContent = matchCount > 0
        ? `${matchCount} 个匹配`
        : "无匹配";
      stat.className = "search-stat" + (matchCount === 0 ? " no-match" : "");
    }
  }

  // ───────────── F2 折叠所有文件夹 ─────────────
  function collapseAll() {
    state.userInteractedSidebar = true;
    // 收起所有非扫描根的目录节点
    $$(".tree-node:not(.tree-root)").forEach(n => {
      if (n.querySelector(":scope > .tree-node-children")) {
        n.classList.add("collapsed");
      }
    });
    toast("已折叠所有文件夹", "info");
  }

  // v1.10.6: iframe 加载失败兜底 UI（12s 超时未 ready 触发）
  function showIframeFallback(node) {
    let fb = $("#iframe-fallback");
    if (!fb) {
      fb = document.createElement("div");
      fb.id = "iframe-fallback";
      fb.innerHTML = `
        <div class="iframe-fallback-card">
          <div class="iframe-fallback-icon">⚠️</div>
          <div class="iframe-fallback-title">文件加载失败或超时</div>
          <div class="iframe-fallback-msg" id="iframe-fallback-msg"></div>
          <div class="iframe-fallback-actions">
            <button id="iframe-fallback-retry" class="btn-primary">↻ 重试</button>
            <button id="iframe-fallback-close">关闭</button>
          </div>
          <div class="iframe-fallback-hint">
            可能原因：<br>
            · 文件被删除或移动（试试 R 刷新目录）<br>
            · 文件 &gt; 100MB（超出 server 限制）<br>
            · scan_roots 配置变更（去 ⚙️ 设置检查）<br>
            · 服务进程异常（终端重启 python3 server.py）
          </div>
        </div>
      `;
      document.querySelector("main") ? document.querySelector("main").appendChild(fb) : document.body.appendChild(fb);
      $("#iframe-fallback-retry").addEventListener("click", () => {
        if (state.currentFile) {
          fb.style.display = "none";
          refreshCurrentFile();
        }
      });
      $("#iframe-fallback-close").addEventListener("click", () => { fb.style.display = "none"; });
    }
    const msg = $("#iframe-fallback-msg");
    if (msg && node) msg.textContent = node.name || node.path || "";
    fb.style.display = "flex";
    setStatus("加载失败", "error");
  }

  // ───────────── 打开文件 ─────────────
  async function openFile(node, opts = {}) {
    if (state.isDirty && state.currentFile) {
      const ok = await promptSaveBeforeSwitch();
      if (!ok) return;
    }

    state.currentFile = {
      absPath: node.abs_path,
      name: node.name,
      relPath: node.path,
    };
    state.isDirty = false;
    state.iframeReady = false;

    // 高亮
    $$(".tree-node-label.active").forEach(n => n.classList.remove("active"));
    $$(".tree-node-label[data-file]").forEach(n => {
      if (n.dataset.file === node.abs_path) n.classList.add("active");
    });
    // 展开高亮所在分支
    scrollToActiveFile();

    // 面包屑
    const bc = $("#breadcrumb");
    const short = node.abs_path.replace(/^.*\/outputs\//, "outputs/");
    // v1.11.9: 路径变可点击，单击复制相对路径，长按 600ms 复制绝对路径
    bc.innerHTML = `<b>${escapeHtml(node.name)}</b> <span class="bc-path" data-abs="${escapeHtml(node.abs_path)}" data-short="${escapeHtml(short)}" title="单击复制相对路径，按住复制绝对路径">${escapeHtml(short)}</span> <span id="bc-meta" class="bc-meta"></span>`;

    // 绑定复制路径
    const pathEl = bc.querySelector(".bc-path");
    if (pathEl) {
      let pressTimer = null;
      let longPressed = false;
      pathEl.addEventListener("mousedown", () => {
        longPressed = false;
        pressTimer = setTimeout(() => {
          longPressed = true;
          copyText(pathEl.dataset.abs, "绝对路径");
        }, 600);
      });
      pathEl.addEventListener("mouseup", () => {
        clearTimeout(pressTimer);
      });
      pathEl.addEventListener("mouseleave", () => {
        clearTimeout(pressTimer);
      });
      pathEl.addEventListener("click", (e) => {
        if (longPressed) { e.preventDefault(); return; }
        copyText(pathEl.dataset.short, "相对路径");
      });
    }

    // v1.10.9: 异步拉取文件元信息（大小/快照数/修改时间），填到 #bc-meta
    fetchFileMeta(node.abs_path).then(meta => {
      // 路径变了就放弃（用户已切换到下一个文件）
      if (!state.currentFile || state.currentFile.absPath !== node.abs_path) return;
      const el = document.getElementById("bc-meta");
      if (!el) return;
      const sizeStr = formatBytes(meta.current_size);
      const mtimeStr = meta.current_mtime ? formatRecentTime(meta.current_mtime * 1000) : "-";
      const snapCount = (meta.items || []).length;
      const snapBadge = snapCount > 0
        ? `· <a href="javascript:;" id="bc-snap-link" class="bc-snap" title="打开历史版本抽屉">🗂 ${snapCount} 个快照</a>`
        : "";
      el.innerHTML = `· 📦 ${sizeStr} · 🕐 ${mtimeStr} ${snapBadge}`;
      const link = document.getElementById("bc-snap-link");
      if (link) link.addEventListener("click", () => { if (window.HISTORY) HISTORY.open(); });
    }).catch(() => { /* 静默：网络错时面包屑不显示 meta */ });

    // iframe
    $("#empty-state").style.display = "none";
    const frame = $("#doc-frame");
    frame.style.display = "block";
    frame.src = API.file(node.abs_path, { bust: true });

    $("#btn-close-file").disabled = false;
    // v1.10.2: 启用历史按钮
    const bh = $("#btn-history"); if (bh) bh.disabled = false;
    setStatus("加载中…", "");

    // v1.10.6: iframe 加载兜底 — 12 秒超时未拿到 ready 消息就显示重试 UI
    if (state._iframeLoadTimer) clearTimeout(state._iframeLoadTimer);
    state._iframeLoadTimer = setTimeout(() => {
      if (!state.iframeReady) {
        showIframeFallback(node);
      }
    }, 12000);
    // load 事件作为软指示（成功也清掉 fallback）
    frame.onerror = () => showIframeFallback(node);

    // 缩放：会话恢复指定则用恢复值，否则默认 75
    const zoom = opts.zoom || "75";
    zoomCtl.apply(zoom);

    // 记录上次会话（仅用户主动打开时才记，避免会话恢复时的回写竞争覆盖）
    if (!opts.silent) {
      saveLastSession(node.abs_path, zoom);
    }

    // v1.10.7: 记录到最近打开列表（silent=会话恢复时也记，因为用户确实"回到"了这个文件）
    recentAdd(node);

    // 用户主动点击才自动收起（会话恢复/首次启动不收）
    if (!opts.silent) sidebarCtl.autoHideAfterSelect();
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ───────────── F3 上次会话 ─────────────
  async function saveLastSession(absPath, zoom) {
    // 多 tab 防护：后台 tab 不写 last_session，避免覆盖前台 tab 的选择
    if (absPath && document.visibilityState === "hidden") return;
    try {
      await fetch(API.lastSession, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ abs_path: absPath, zoom: String(zoom) }),
      });
    } catch (_) { /* 不阻塞 UI */ }
  }

  async function tryRestoreLastSession() {
    try {
      const r = await fetch(API.lastSession);
      const d = await r.json();
      if (!d.ok || !d.session || !d.session.abs_path) return false;
      const sess = d.session;
      // 构造一个最小 node 传给 openFile
      const node = {
        abs_path: sess.abs_path,
        name: sess.name,
        path: sess.abs_path,
      };
      await openFile(node, { zoom: sess.zoom || "75", silent: true });
      return true;
    } catch (_) {
      return false;
    }
  }

  // ───────────── iframe 通信 ─────────────
  window.addEventListener("message", (e) => {
    const msg = e.data || {};
    if (msg.source !== "doc-center-saver") return;

    switch (msg.type) {
      case "ready":
        state.iframeReady = true;
        // v1.10.6: 清掉加载超时计时器和 fallback UI
        if (state._iframeLoadTimer) { clearTimeout(state._iframeLoadTimer); state._iframeLoadTimer = null; }
        const fb = $("#iframe-fallback"); if (fb) fb.style.display = "none";
        setStatus(msg.payload.hasExistingEditor ? "已就绪（原生编辑器）" : "已就绪（注入编辑器）", "clean");
        if (state.currentFile) toast(`已打开：${state.currentFile.name}`, "success");
        break;
      case "dirty_changed":
        state.isDirty = !!msg.payload.dirty;
        setStatus(state.isDirty ? "编辑中（2 秒后自动快照）" : "已保存", state.isDirty ? "dirty" : "clean");
        break;
      case "snapshot_ok":
        state.lastSnapshotPath = msg.payload.snapshotPath;
        setStatus("草稿已缓存 " + new Date().toLocaleTimeString(), "dirty");
        break;
      case "html_content":
        if (state._htmlResolve) {
          state._htmlResolve(msg.payload.html);
          state._htmlResolve = null;
        }
        break;
    }
  });

  function requestHTMLFromIframe() {
    return new Promise((resolve) => {
      state._htmlResolve = resolve;
      const frame = $("#doc-frame");
      if (!frame.contentWindow) {
        resolve(null); state._htmlResolve = null; return;
      }
      frame.contentWindow.postMessage(
        { source: "doc-center-app", type: "request_html" }, "*"
      );
      setTimeout(() => {
        if (state._htmlResolve) { state._htmlResolve(null); state._htmlResolve = null; }
      }, 2000);
    });
  }

  function markIframeClean() {
    const frame = $("#doc-frame");
    if (frame && frame.contentWindow) {
      frame.contentWindow.postMessage({ source: "doc-center-app", type: "mark_clean" }, "*");
    }
    state.isDirty = false;
  }

  // ───────────── 强制刷新当前文件 ─────────────
  function refreshCurrentFile() {
    if (!state.currentFile) return;
    const frame = $("#doc-frame");
    if (!frame || frame.style.display === "none") return;
    // 带 _t 时间戳破坏缓存
    frame.src = API.file(state.currentFile.absPath, { bust: true });
    setStatus("刷新中…", "");
    toast("🔄 正在重新加载文档", "info");
  }

  // ───────────── 保存对话框 ─────────────
  async function promptSaveBeforeSwitch() {
    if (!state.isDirty) return true;
    const choice = await showSaveDialog();
    if (!choice) return false;
    await handleSaveChoice(choice);
    return true;
  }

  function showSaveDialog() {
    return new Promise((resolve) => {
      const dlg = $("#save-dialog");
      $("#dialog-file-name").textContent = state.currentFile ? state.currentFile.absPath : "";
      dlg.style.display = "flex";

      const done = (val) => {
        dlg.style.display = "none";
        $("#dlg-overwrite").onclick = null;
        $("#dlg-new").onclick = null;
        $("#dlg-discard").onclick = null;
        $("#dlg-cancel").onclick = null;
        resolve(val);
      };
      $("#dlg-overwrite").onclick = () => done("overwrite");
      $("#dlg-new").onclick = () => done("new");
      $("#dlg-discard").onclick = () => done("discard");
      $("#dlg-cancel").onclick = () => done(null);
    });
  }

  async function handleSaveChoice(mode) {
    const file = state.currentFile;
    if (!file) return;

    let content = null;
    if (mode !== "discard") {
      content = await requestHTMLFromIframe();
      if (!content) { toast("读取 iframe 内容失败", "error"); return; }
    }

    try {
      const r = await fetch(API.save, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: file.absPath, mode, content }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "保存失败");

      if (mode === "overwrite") {
        toast("✅ 已覆盖源文件", "success", d.saved_to);
      } else if (mode === "new") {
        try { await navigator.clipboard.writeText(d.saved_to); } catch (_) {}
        toast("🆕 新版本已生成 · 路径已复制到剪贴板", "success", d.saved_to);
        await loadTree(true);
      } else {
        toast("🗑 已丢弃本次修改", "warning");
      }
      markIframeClean();
    } catch (e) {
      toast("保存失败", "error", e.message);
    }
  }

  // ───────────── 关闭文件 ─────────────
  async function closeCurrentFile() {
    if (!state.currentFile) return;
    if (state.isDirty) {
      const ok = await promptSaveBeforeSwitch();
      if (!ok) return;
    }
    state.currentFile = null;
    state.isDirty = false;
    $$(".tree-node-label.active").forEach(n => n.classList.remove("active"));
    $("#empty-state").style.display = "flex";
    $("#doc-frame").style.display = "none";
    $("#doc-frame").src = "about:blank";
    $("#breadcrumb").innerHTML = '<span class="breadcrumb-empty">👈 左侧选择一个 HTML 文档开始</span>';
    setStatus("未打开", "");
    $("#btn-close-file").disabled = true;
    // v1.10.2: 禁用历史按钮
    const bh = $("#btn-history"); if (bh) bh.disabled = true;
    // 清空上次会话
    saveLastSession("", "75");
    // 关闭后空态 → 目录保持展开状态
    sidebarCtl.show(true);
  }

  // ───────────── 设置面板 ─────────────
  async function openSettings() {
    const r = await fetch(API.config);
    const d = await r.json();
    if (!d.ok) { toast("读取配置失败", "error"); return; }
    renderScanRoots(d.config.scan_roots || []);
    // v1.10.0: 自动刷新周期 select 初值
    const sel = $("#setting-auto-refresh");
    if (sel) {
      const cur = (typeof d.config.tree_auto_refresh_seconds === "number")
        ? d.config.tree_auto_refresh_seconds : 10;
      sel.value = String(cur);
    }
    // v1.10.6: 快照保留天数 select 初值
    const retSel = $("#setting-retention");
    if (retSel) {
      const ret = (typeof d.config.snapshot_retention_days === "number")
        ? d.config.snapshot_retention_days : 7;
      retSel.value = String(ret);
    }
    $("#settings-dialog").style.display = "flex";
  }

  function renderScanRoots(roots) {
    const list = $("#scan-roots-list");
    list.innerHTML = "";
    if (!roots.length) {
      list.innerHTML = `<div style="font-size:12px;color:var(--text-3);padding:10px 0">还没有扫描目录</div>`;
      return;
    }

    // v1.6: 按 enabled 分组——enabled 在前，disabled 沉底
    const normalize = item => ({
      path: typeof item === "string" ? item : item.path,
      enabled: typeof item === "string" ? true : item.enabled !== false,
    });
    const all = roots.map(normalize);
    const enabledList = all.filter(r => r.enabled);
    const disabledList = all.filter(r => !r.enabled);

    const appendRow = ({ path: p, enabled }) => {
      const display = middleEllipsis(p, 50);
      const row = document.createElement("div");
      row.className = "root-item" + (enabled ? "" : " root-disabled");
      row.innerHTML =
        `<label class="toggle-switch" title="${enabled ? "点击关闭扫描" : "点击开启扫描"}">` +
          `<input type="checkbox" ${enabled ? "checked" : ""}>` +
          `<span class="toggle-slider"></span>` +
        `</label>` +
        `<span class="root-path" title="${p}">${display}</span>` +
        `<button class="root-remove" data-path="${p}" title="从列表中移除此目录">移除</button>`;
      row.querySelector("input").addEventListener("change", (e) => toggleRoot(p, e.target.checked));
      row.querySelector(".root-remove").addEventListener("click", () => removeRoot(p));
      list.appendChild(row);
    };

    enabledList.forEach(appendRow);

    // 分隔条（只在两组都非空时才显示）
    if (enabledList.length && disabledList.length) {
      const divider = document.createElement("div");
      divider.className = "root-group-divider";
      divider.textContent = `⏸ 已关闭（${disabledList.length}，不扫描）`;
      list.appendChild(divider);
    }

    disabledList.forEach(appendRow);
  }

  /** 路径中间省略：保留前 N 个字符 + … + 后 M 个字符 */
  function middleEllipsis(str, maxLen) {
    if (str.length <= maxLen) return str;
    // 按路径分隔符智能截断：保留前两段 + 最后一段
    const parts = str.split("/").filter(Boolean);
    if (parts.length > 3) {
      const head = "/" + parts.slice(0, 2).join("/");
      const tail = parts.slice(-2).join("/");
      const candidate = head + "/…/" + tail;
      if (candidate.length <= maxLen + 10) return candidate;
    }
    // 兜底：纯字符截断
    const keep = Math.floor((maxLen - 3) / 2);
    return str.slice(0, keep) + "…" + str.slice(-keep);
  }

  async function toggleRoot(path, enabled) {
    try {
      const cur = await safeFetchJson(API.config);
      const roots = cur.config.scan_roots || [];
      const updated = roots.map(item => {
        const p = typeof item === "string" ? item : item.path;
        const en = typeof item === "string" ? true : item.enabled !== false;
        if (p === path) return { path: p, enabled: enabled };
        return { path: p, enabled: en };
      });
      await updateRoots(updated);
    } catch (e) {
      toast("开关切换失败", "error", e.message);
    }
  }

  async function updateRoots(newRoots) {
    const d = await safeFetchJson(API.config, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scan_roots: newRoots }),
    });
    if (!d.ok) { toast("配置更新失败", "error", d.error); throw new Error(d.error || "update failed"); }
    renderScanRoots(d.config.scan_roots || []);
    await loadTree(true);
    toast("扫描目录已更新", "success", "目录树已刷新");
  }

  async function addRoot() {
    const input = $("#new-root-input");
    const btn = $("#btn-add-root");
    const p = input.value.trim();
    if (!p) return;

    // 即时反馈：禁用按钮 + 加载态
    btn.disabled = true;
    btn.textContent = "添加中…";
    toast("正在添加目录…", "info");

    try {
      const cur = await safeFetchJson(API.config);
      const roots = cur.config.scan_roots || [];

      // 去重：规范化路径后对比（去掉尾部斜杠、展开 ~）
      const normalize = s => s.replace(/\/+$/, "").replace(/^~/, "");
      const np = normalize(p);
      const existing = roots.some(item => {
        const ep = typeof item === "string" ? item : item.path;
        return normalize(ep) === np;
      });
      if (existing) { toast("该目录已存在", "warning"); return; }

      roots.push({ path: p, enabled: true });
      await updateRoots(roots);
      input.value = "";
      // 添加成功后确保侧边栏可见，让用户看到刷新后的目录树
      sidebarCtl.show(true);
    } catch (e) {
      toast("添加失败", "error", e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = "添加";
    }
  }

  async function removeRoot(p) {
    if (!confirm("从扫描列表移除：\n" + p + "\n\n（只是移除不显示，不会删除文件）")) return;
    try {
      const cur = await safeFetchJson(API.config);
      const roots = (cur.config.scan_roots || []).filter(item =>
        (typeof item === "string" ? item : item.path) !== p
      );
      await updateRoots(roots);
      // 成功后确保侧边栏可见，让用户看到最新目录树
      sidebarCtl.show(true);
    } catch (e) {
      toast("移除失败", "error", e.message);
    }
  }

  // ───────────── 目录浏览器 ─────────────
  let _browseSelected = "";

  async function openBrowseDialog() {
    _browseSelected = "";
    $("#browse-confirm").disabled = true;
    $("#browse-selected").textContent = "";
    $("#browse-dialog").style.display = "flex";
    await browseTo("");  // 加载起始页（快捷入口）
  }

  function closeBrowseDialog() {
    $("#browse-dialog").style.display = "none";
  }

  async function browseTo(path) {
    const list = $("#browse-list");
    list.innerHTML = '<div class="browse-loading">加载中…</div>';
    try {
      const r = await fetch(API.browse(path));
      const d = await r.json();
      if (!d.ok) { list.innerHTML = `<div class="browse-empty">❌ ${d.error}</div>`; return; }
      renderBrowseBreadcrumb(d.current, d.is_root);
      renderBrowseList(d.dirs, d.current, d.parent, d.is_root);
    } catch (e) {
      list.innerHTML = `<div class="browse-empty">❌ 请求失败: ${e.message}</div>`;
    }
  }

  function renderBrowseBreadcrumb(current, isRoot) {
    const bc = $("#browse-breadcrumb");
    if (isRoot || !current) {
      bc.innerHTML = '<span class="bc-item bc-active">📍 快捷入口</span>';
      return;
    }
    const parts = current.split("/").filter(Boolean);
    let html = '<span class="bc-item bc-link" data-path="">🏠</span>';
    let accumulated = "";
    for (let i = 0; i < parts.length; i++) {
      accumulated += "/" + parts[i];
      const isLast = i === parts.length - 1;
      html += ' <span class="bc-sep">/</span> ';
      if (isLast) {
        html += `<span class="bc-item bc-active">${parts[i]}</span>`;
      } else {
        html += `<span class="bc-item bc-link" data-path="${accumulated}">${parts[i]}</span>`;
      }
    }
    bc.innerHTML = html;
    bc.querySelectorAll(".bc-link").forEach(el => {
      el.addEventListener("click", () => browseTo(el.dataset.path));
    });
  }

  function renderBrowseList(dirs, current, parent, isRoot) {
    const list = $("#browse-list");
    list.innerHTML = "";

    if (!dirs.length) {
      list.innerHTML = '<div class="browse-empty">此目录下没有子文件夹</div>';
      return;
    }

    // 非根页面显示返回上级按钮
    if (!isRoot && parent) {
      const upRow = document.createElement("div");
      upRow.className = "browse-item browse-item-up";
      upRow.innerHTML = '<span class="browse-icon">⬆️</span><span class="browse-name">返回上级</span>';
      upRow.addEventListener("click", () => browseTo(parent));
      list.appendChild(upRow);
    }

    for (const d of dirs) {
      const row = document.createElement("div");
      row.className = "browse-item";
      const icon = isRoot ? d.name.charAt(0) : "📁";
      row.innerHTML =
        `<span class="browse-icon">${icon}</span>` +
        `<span class="browse-name">${isRoot ? d.name : d.name}</span>` +
        `<button class="browse-select-btn" title="选择此目录">✓ 选择</button>`;

      // 点击行进入子目录
      row.addEventListener("click", (e) => {
        if (e.target.closest(".browse-select-btn")) return;
        browseTo(d.path);
      });

      // 点击「选择」按钮选中此目录
      row.querySelector(".browse-select-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        selectBrowsePath(d.path);
      });

      list.appendChild(row);
    }
  }

  function selectBrowsePath(path) {
    _browseSelected = path;
    const sel = $("#browse-selected");
    sel.textContent = "已选：" + path;
    sel.title = path;
    $("#browse-confirm").disabled = false;

    // 高亮选中行
    $$(".browse-item").forEach(el => el.classList.remove("browse-item-selected"));
    $$(".browse-item").forEach(el => {
      const btn = el.querySelector(".browse-select-btn");
      if (btn && el.querySelector(".browse-name")?.textContent) {
        // 用 path 匹配
      }
    });
  }

  async function confirmBrowse() {
    if (!_browseSelected) return;
    closeBrowseDialog();
    // 将选中路径填入输入框并触发添加
    const input = $("#new-root-input");
    input.value = _browseSelected;
    await addRoot();
    // 添加成功后关闭设置面板 + 确保侧边栏可见，让用户看到刷新后的目录树
    $("#settings-dialog").style.display = "none";
    sidebarCtl.show(true);
  }

  // ───────────── v1.10.2: 版本时间线 ─────────────
  const HISTORY = (() => {
    let pending = null; // {snapshot_path, name} 当前预览的快照

    function relTime(mtime) {
      const d = Math.floor(Date.now() / 1000) - mtime;
      if (d < 60) return d + "秒前";
      if (d < 3600) return Math.floor(d / 60) + "分钟前";
      if (d < 86400) return Math.floor(d / 3600) + "小时前";
      if (d < 86400 * 7) return Math.floor(d / 86400) + "天前";
      return new Date(mtime * 1000).toLocaleDateString("zh-CN");
    }

    function fmtTime(mtime) {
      const dt = new Date(mtime * 1000);
      return dt.getFullYear() + "-" +
        String(dt.getMonth() + 1).padStart(2, "0") + "-" +
        String(dt.getDate()).padStart(2, "0") + " " +
        String(dt.getHours()).padStart(2, "0") + ":" +
        String(dt.getMinutes()).padStart(2, "0") + ":" +
        String(dt.getSeconds()).padStart(2, "0");
    }

    function fmtSize(n) {
      if (n < 1024) return n + " B";
      if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
      return (n / 1024 / 1024).toFixed(2) + " MB";
    }

    function kindLabel(kind) {
      if (kind === "auto") return "自动快照";
      if (kind === "pre-overwrite") return "覆盖前备份";
      if (kind === "pre-restore") return "恢复前备份";
      return kind;
    }

    function detectKind(name) {
      // 兼容 server 没标的情况（pre-restore 走自动判断）
      if (name.includes("-pre-restore-")) return "pre-restore";
      if (name.includes("-pre-overwrite-")) return "pre-overwrite";
      return "auto";
    }

    async function open() {
      if (!state.currentFile) {
        toast("请先打开一个文件", "error");
        return;
      }
      $("#history-current-name").textContent = state.currentFile.name;
      $("#history-drawer").style.display = "block";
      $("#history-list").innerHTML = '<div class="history-empty">加载中…</div>';
      try {
        const r = await fetch("/api/history?path=" + encodeURIComponent(state.currentFile.absPath));
        const d = await r.json();
        if (!d.ok) throw new Error(d.error || "加载失败");
        render(d.items || []);
      } catch (e) {
        $("#history-list").innerHTML = '<div class="history-empty">加载失败：' + e.message + '</div>';
      }
    }

    function close() {
      $("#history-drawer").style.display = "none";
    }

    function render(items) {
      const list = $("#history-list");
      if (items.length === 0) {
        list.innerHTML = '<div class="history-empty">还没有历史版本<br>编辑此文件 2 秒后会自动生成快照</div>';
        return;
      }
      // v1.11.7: 顶部时光机快捷条（"回到 N 分钟前"）
      const now = Math.floor(Date.now() / 1000);
      const QUICK_OFFSETS = [
        { label: "5 分钟前", sec: 300 },
        { label: "10 分钟前", sec: 600 },
        { label: "30 分钟前", sec: 1800 },
        { label: "1 小时前", sec: 3600 },
        { label: "1 天前", sec: 86400 },
      ];
      // 找到每个 offset 最接近的快照（time 距离最小）
      const quickButtons = QUICK_OFFSETS.map(off => {
        const target = now - off.sec;
        // 选 mtime <= target 中最大的（即最接近且不超过的）
        const candidates = items.filter(it => it.mtime <= target);
        if (candidates.length === 0) return null;
        const best = candidates.reduce((a, b) => a.mtime > b.mtime ? a : b);
        const diffMin = Math.round((now - best.mtime) / 60);
        return { off, snap: best, diffMin };
      }).filter(Boolean);

      let quickBarHtml = "";
      if (quickButtons.length > 0) {
        quickBarHtml = `<div class="history-quickbar">
          <div class="history-quickbar-title">↩ 时光机：</div>
          <div class="history-quickbar-buttons">
            ${quickButtons.map((q, i) =>
              `<button class="history-quick" data-snap="${q.snap.snapshot_path.replace(/"/g, '&quot;')}" data-name="${q.snap.name.replace(/"/g, '&quot;')}" title="跳转到约 ${q.diffMin} 分钟前的版本">${q.off.label}</button>`
            ).join("")}
          </div>
        </div>`;
      }

      list.innerHTML = quickBarHtml + items.map(it => {
        const kind = it.kind || detectKind(it.name);
        const delta = it.size_delta || 0;
        const deltaCls = delta > 0 ? "delta-pos" : (delta < 0 ? "delta-neg" : "");
        const deltaTxt = delta === 0 ? "无变化"
          : (delta > 0 ? "+" : "") + delta + " B";
        return `<div class="history-item" data-snap="${it.snapshot_path.replace(/"/g, '&quot;')}" data-name="${it.name.replace(/"/g, '&quot;')}">
          <div class="history-item-row1">
            <div>
              <span class="history-item-time">${fmtTime(it.mtime)}</span>
              <span class="history-item-rel">${relTime(it.mtime)}</span>
            </div>
            <span class="history-item-kind kind-${kind}">${kindLabel(kind)}</span>
          </div>
          <div class="history-item-row2">
            ${fmtSize(it.size)} · 与当前 <span class="history-item-delta ${deltaCls}">${deltaTxt}</span>
            <span class="history-item-diff" data-diff-loading="1"> · diff 加载中…</span>
          </div>
          <div class="history-item-actions">
            <button data-action="preview">👁 预览</button>
            <button data-action="restore" class="btn-restore">↩ 恢复</button>
          </div>
        </div>`;
      }).join("");
      // 绑定按钮 + 异步加载 diff
      list.querySelectorAll(".history-item").forEach(el => {
        const snap = el.dataset.snap;
        const name = el.dataset.name;
        el.querySelector('[data-action="preview"]').addEventListener("click", () => preview(snap, name));
        el.querySelector('[data-action="restore"]').addEventListener("click", () => restore(snap, name));
        // v1.10.3: 异步拉行级 diff
        loadDiff(el, snap);
      });
      // v1.11.7: 时光机快捷按钮 → 打开预览（让用户先看再决定 restore）
      list.querySelectorAll(".history-quick").forEach(btn => {
        btn.addEventListener("click", () => {
          const snap = btn.dataset.snap;
          const name = btn.dataset.name;
          preview(snap, name);
        });
      });
    }

    /** v1.10.3: 异步加载某条快照与当前文件的行级 diff */
    async function loadDiff(itemEl, snapPath) {
      if (!state.currentFile) return;
      const diffEl = itemEl.querySelector(".history-item-diff");
      if (!diffEl) return;
      try {
        const url = "/api/history/diff?path=" + encodeURIComponent(snapPath)
                  + "&source=" + encodeURIComponent(state.currentFile.absPath);
        const r = await fetch(url);
        const d = await r.json();
        if (!d.ok) { diffEl.textContent = ""; return; }
        const a = d.lines_added || 0;
        const r_ = d.lines_removed || 0;
        if (a === 0 && r_ === 0) {
          diffEl.innerHTML = ' · <span class="history-diff-eq">行内容相同</span>';
        } else {
          diffEl.innerHTML = ' · '
            + (a > 0 ? `<span class="history-diff-add">+${a} 行</span>` : '')
            + (a > 0 && r_ > 0 ? ' ' : '')
            + (r_ > 0 ? `<span class="history-diff-del">-${r_} 行</span>` : '');
        }
      } catch (e) {
        diffEl.textContent = "";
      }
    }

    async function preview(snapPath, name) {
      pending = { snapshot_path: snapPath, name };
      $("#history-preview-name").textContent = name;
      try {
        const r = await fetch("/api/history/content?path=" + encodeURIComponent(snapPath));
        const d = await r.json();
        if (!d.ok) throw new Error(d.error || "读取失败");
        const iframe = $("#history-preview-iframe");
        // 用 srcdoc 渲染（隔离 + 安全）
        iframe.srcdoc = d.content;
        $("#history-preview-dialog").style.display = "flex";
      } catch (e) {
        toast("预览失败", "error", e.message);
      }
    }

    function closePreview() {
      $("#history-preview-dialog").style.display = "none";
      $("#history-preview-iframe").srcdoc = "";
      pending = null;
    }

    async function restore(snapPath, name) {
      if (!state.currentFile) return;
      const ok = confirm(`确定将「${name}」的内容恢复为当前文件吗？\n\n· 当前文件内容会先被备份为 pre-restore 快照\n· 操作可通过再次恢复 pre-restore 撤销`);
      if (!ok) return;
      try {
        const r = await fetch("/api/restore", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            snapshot_path: snapPath,
            source_path: state.currentFile.absPath,
          }),
        });
        const d = await r.json();
        if (!d.ok) throw new Error(d.error || "恢复失败");
        toast("✓ 已恢复", "success", "原内容已备份为 pre-restore");
        close();
        closePreview();
        // 重新加载 iframe（带 cache-bust）
        refreshCurrentFile();
      } catch (e) {
        toast("恢复失败", "error", e.message);
      }
    }

    async function restoreFromPreview() {
      if (!pending) return;
      await restore(pending.snapshot_path, pending.name);
    }

    return { open, close, closePreview, restoreFromPreview };
  })();

  // ───────────── 事件绑定 ─────────────
  function bindEvents() {
    $("#btn-refresh").addEventListener("click", () => { loadTree(true); refreshCurrentFile(); });
    $("#btn-settings").addEventListener("click", openSettings);

    // v1.10.10: 主题切换按钮（auto → light → dark → auto）
    const btnTheme = $("#btn-theme");
    if (btnTheme) {
      btnTheme.addEventListener("click", () => {
        const cur = document.documentElement.getAttribute("data-theme") || "auto";
        const next = cur === "auto" ? "light" : cur === "light" ? "dark" : "auto";
        applyTheme(next);
      });
      // 初始化按钮显示
      applyTheme(document.documentElement.getAttribute("data-theme") || "auto", /*silent*/ true);
    }
    $("#settings-close").addEventListener("click", () => $("#settings-dialog").style.display = "none");

    // v1.10.2: 历史版本按钮
    $("#btn-history").addEventListener("click", () => HISTORY.open());
    // v1.10.5: 帮助按钮
    const bhelp = $("#btn-help"); if (bhelp) bhelp.addEventListener("click", () => showShortcutHelp());
    $("#history-drawer-close").addEventListener("click", () => HISTORY.close());
    $("#history-drawer-mask").addEventListener("click", () => HISTORY.close());
    $("#history-preview-close").addEventListener("click", () => HISTORY.closePreview());
    $("#history-preview-restore").addEventListener("click", () => HISTORY.restoreFromPreview());
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if ($("#history-preview-dialog").style.display === "flex") HISTORY.closePreview();
        else if ($("#history-drawer").style.display === "block") HISTORY.close();
      }
    });
    $("#btn-add-root").addEventListener("click", addRoot);
    $("#btn-browse-root").addEventListener("click", openBrowseDialog);
    $("#browse-cancel").addEventListener("click", closeBrowseDialog);
    $("#browse-confirm").addEventListener("click", confirmBrowse);
    $("#new-root-input").addEventListener("keydown", (e) => { if (e.key === "Enter") addRoot(); });
    // 侧边栏搜索框旁的 + 按钮 → 直接打开浏览弹窗
    const btnAddDir = document.getElementById("btn-add-dir");
    if (btnAddDir) btnAddDir.addEventListener("click", openBrowseDialog);
    $("#search-box").addEventListener("input", applySearchFilter);
    $("#btn-close-file").addEventListener("click", closeCurrentFile);

    // v1.10.0: 自动刷新周期 select
    const arSel = $("#setting-auto-refresh");
    if (arSel) {
      arSel.addEventListener("change", async (e) => {
        const sec = parseInt(e.target.value, 10) || 0;
        try {
          const r = await fetch(API.config, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tree_auto_refresh_seconds: sec }),
          });
          const d = await r.json();
          if (!d.ok) throw new Error(d.error || "保存失败");
          startAutoRefresh(sec);
          toast(sec === 0 ? "自动刷新已关闭" : `自动刷新：每 ${sec} 秒`, "success");
        } catch (err) {
          toast("保存配置失败", "error", err.message);
        }
      });
    }

    // v1.10.6: 快照保留天数 + 立即清理按钮
    const retSel = $("#setting-retention");
    if (retSel) {
      retSel.addEventListener("change", async (e) => {
        const days = parseInt(e.target.value, 10) || 7;
        try {
          const r = await fetch(API.config, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ snapshot_retention_days: days }),
          });
          const d = await r.json();
          if (!d.ok) throw new Error(d.error || "保存失败");
          toast(`快照保留：${days} 天`, "success", "下次启动 / 手动清理时按此规则");
        } catch (err) {
          toast("保存配置失败", "error", err.message);
        }
      });
    }
    const cleanBtn = $("#btn-cleanup-snapshots");
    if (cleanBtn) {
      cleanBtn.addEventListener("click", async () => {
        const result = $("#cleanup-result");
        if (result) result.textContent = "清理中…";
        cleanBtn.disabled = true;
        try {
          const r = await fetch("/api/cleanup-snapshots", { method: "POST" });
          const d = await r.json();
          if (!d.ok) throw new Error(d.error || "清理失败");
          const msg = `扫描 ${d.scanned_dirs} 目录，移除 ${d.removed} 个 >${d.retention_days} 天快照`;
          if (result) result.textContent = "✓ " + msg;
          toast("✓ 清理完成", "success", msg);
        } catch (err) {
          if (result) result.textContent = "✗ " + err.message;
          toast("清理失败", "error", err.message);
        } finally {
          cleanBtn.disabled = false;
        }
      });
    }

    // v1.11.6: 梯度稀释快照
    const sparsifyBtn = $("#btn-sparsify-snapshots");
    if (sparsifyBtn) {
      sparsifyBtn.addEventListener("click", async () => {
        const result = $("#sparsify-result");
        if (result) result.textContent = "稀释中…";
        sparsifyBtn.disabled = true;
        try {
          const r = await fetch("/api/sparsify-snapshots", { method: "POST" });
          const d = await r.json();
          if (!d.ok) throw new Error(d.error || "稀释失败");
          const msg = `${d.scanned_dirs} 目录 · 移除 ${d.removed}/${d.before} 条 · 保留 ${d.kept} 条`;
          if (result) result.textContent = "✓ " + msg;
          toast("🪶 稀释完成", "success", msg);
        } catch (err) {
          if (result) result.textContent = "✗ " + err.message;
          toast("稀释失败", "error", err.message);
        } finally {
          sparsifyBtn.disabled = false;
        }
      });
    }

    // F2 一键收起
    const btnCollapse = $("#btn-collapse-all");
    if (btnCollapse) btnCollapse.addEventListener("click", collapseAll);

    // v1.11.2: 排序按钮 + 弹出菜单（替代独立一行的 select）
    const btnSort = $("#btn-sort");
    const sortMenu = $("#sort-menu");
    if (btnSort && sortMenu) {
      function refreshSortMenu() {
        sortMenu.querySelectorAll(".sort-menu-item").forEach(it => {
          if (it.dataset.sort === state.sortBy) it.classList.add("is-active");
          else it.classList.remove("is-active");
        });
      }
      refreshSortMenu();
      btnSort.addEventListener("click", (e) => {
        e.stopPropagation();
        const open = sortMenu.style.display !== "none";
        sortMenu.style.display = open ? "none" : "block";
        btnSort.classList.toggle("active", !open);
      });
      sortMenu.addEventListener("click", async (e) => {
        const item = e.target.closest(".sort-menu-item");
        if (!item) return;
        e.stopPropagation();
        const sb = item.dataset.sort;
        if (sb && sb !== state.sortBy) {
          state.sortBy = sb;
          localStorage.setItem("doc_center_sort", state.sortBy);
          refreshSortMenu();
          await loadTree(true);
          toast(state.sortBy === "mtime_desc" ? "按最近修改排序" : "按名称排序", "info");
        }
        sortMenu.style.display = "none";
        btnSort.classList.remove("active");
      });
      // 点外部收起
      document.addEventListener("click", (e) => {
        if (sortMenu.style.display === "none") return;
        if (e.target.closest("#sort-menu") || e.target.closest("#btn-sort")) return;
        sortMenu.style.display = "none";
        btnSort.classList.remove("active");
      });
    }

    // v1.11.2: 三 Tab 切换（收藏 / 最近 / 目录）
    sidebarTabsCtl.init();

    // CHANGELOG 入口（设置面板内）
    const btnChangelog = $("#btn-view-changelog");
    if (btnChangelog) btnChangelog.addEventListener("click", () => {
      window.open("/changelog", "_blank");
    });

    // 目录切换
    $("#btn-toggle-sidebar").addEventListener("click", () => sidebarCtl.toggle());

    // 缩放按钮
    $$(".zoom-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        zoomCtl.apply(btn.dataset.zoom);
        if (state.currentFile) saveLastSession(state.currentFile.absPath, btn.dataset.zoom);
      });
    });

    // 左边缘热区
    const zone = $("#sidebar-hover-zone");
    zone.addEventListener("mouseenter", () => {
      sidebarCtl.hoverTimer = setTimeout(() => sidebarCtl.show(false), 200);
    });
    zone.addEventListener("mouseleave", () => {
      if (sidebarCtl.hoverTimer) {
        clearTimeout(sidebarCtl.hoverTimer);
        sidebarCtl.hoverTimer = null;
      }
    });

    // 侧边栏拖拽调宽
    // 注：用 pointermove + setPointerCapture，并在拖拽期间给 iframe 盖一层透明遮罩。
    // 原因：原来 mousemove 绑在 document 上，鼠标进入 iframe 后事件会被 iframe 文档吃掉，
    // 导致"打开文档后拖拽一顿一顿"。pointer capture + iframe 遮罩双保险解决该问题。
    const resizer = $("#sidebar-resizer");
    if (resizer) {
      let startX = 0, startW = 0;
      const sidebar = $("#sidebar");
      const MIN_W = 200, MAX_W = 600;
      let overlay = null;

      const createOverlay = () => {
        const el = document.createElement("div");
        el.id = "__dc_resize_overlay";
        // 覆盖整个视口，拦截 iframe 之外所有指针事件（iframe 本身被它盖住）
        Object.assign(el.style, {
          position: "fixed",
          inset: "0",
          zIndex: "9999",
          cursor: "col-resize",
          background: "transparent",
          userSelect: "none",
        });
        document.body.appendChild(el);
        return el;
      };

      resizer.addEventListener("pointerdown", (e) => {
        if (!sidebarCtl.isVisible()) return;
        // 只响应鼠标/触控笔主键
        if (e.button !== undefined && e.button !== 0) return;
        e.preventDefault();
        startX = e.clientX;
        startW = sidebar.getBoundingClientRect().width;
        sidebar.classList.add("resizing");
        resizer.classList.add("active");
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";

        // 把指针事件强制绑到 resizer 上，不受 iframe 干扰
        try { resizer.setPointerCapture(e.pointerId); } catch (_) {}

        // 盖透明遮罩，确保移动到 iframe 上时事件仍落在外层
        overlay = createOverlay();

        const onMove = (ev) => {
          const w = Math.min(MAX_W, Math.max(MIN_W, startW + ev.clientX - startX));
          document.documentElement.style.setProperty("--sidebar-w", w + "px");
          sidebar.style.width = w + "px";
        };
        const onUp = (ev) => {
          sidebar.classList.remove("resizing");
          resizer.classList.remove("active");
          document.body.style.cursor = "";
          document.body.style.userSelect = "";
          try { resizer.releasePointerCapture(ev.pointerId); } catch (_) {}
          resizer.removeEventListener("pointermove", onMove);
          resizer.removeEventListener("pointerup", onUp);
          resizer.removeEventListener("pointercancel", onUp);
          if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
          overlay = null;
        };
        resizer.addEventListener("pointermove", onMove);
        resizer.addEventListener("pointerup", onUp);
        resizer.addEventListener("pointercancel", onUp);
      });
    }

    // 快捷键
    document.addEventListener("keydown", (e) => {
      const isMac = navigator.platform.toLowerCase().includes("mac");
      const modOk = isMac ? e.metaKey : e.ctrlKey;
      // v1.10.5: 在输入框/contenteditable 里时不拦截裸字母键
      const isTyping = e.target.matches && e.target.matches('input,textarea,select,[contenteditable="true"]');

      if (modOk && (e.key === "b" || e.key === "B")) {
        e.preventDefault();
        sidebarCtl.toggle();
      } else if (modOk && (e.key === "=" || e.key === "+")) {
        e.preventDefault(); zoomStep(+1);
      } else if (modOk && e.key === "-") {
        e.preventDefault(); zoomStep(-1);
      } else if (modOk && e.key === "0") {
        e.preventDefault(); zoomCtl.apply("75");
      } else if (!isTyping && !modOk && (e.key === "h" || e.key === "H")) {
        // v1.10.5: H = 历史抽屉
        if (state.currentFile) { e.preventDefault(); HISTORY.open(); }
      } else if (!isTyping && !modOk && (e.key === "r" || e.key === "R")) {
        // v1.10.5: R = 刷新（与顶栏 🔄 等价）
        e.preventDefault();
        loadTree(true); refreshCurrentFile();
        toast("已刷新", "info", null, 1500);
      } else if (!isTyping && !modOk && e.key === "/") {
        // v1.10.5: / = 聚焦搜索框
        const sb = $("#search-box");
        if (sb) { e.preventDefault(); sidebarCtl.show(true); sb.focus(); sb.select && sb.select(); }
      } else if (!isTyping && !modOk && (e.key === "?" || (e.shiftKey && e.key === "/"))) {
        // v1.10.5: ? = 显示快捷键帮助
        e.preventDefault();
        showShortcutHelp();
      } else if (!isTyping && !modOk && (e.key === "t" || e.key === "T")) {
        // v1.10.10: T = 循环切换主题（auto/light/dark）
        e.preventDefault();
        const cur = document.documentElement.getAttribute("data-theme") || "auto";
        const next = cur === "auto" ? "light" : cur === "light" ? "dark" : "auto";
        applyTheme(next);
      } else if (e.key === "Escape") {
        // 先处理快捷键帮助
        const help = $("#shortcut-help-overlay");
        if (help && help.style.display !== "none") { help.style.display = "none"; return; }
        // 然后 icon 菜单
        if (iconMenuCtl.el) { iconMenuCtl.close(); return; }
        if (sidebarCtl.isVisible()) {
          const sb = $("#search-box");
          if (document.activeElement === sb && sb.value) {
            sb.value = "";
            applySearchFilter();
          } else {
            sidebarCtl.hide();
          }
        }
      }
    });

    // v1.10.5: 快捷键帮助浮层（懒创建）
    function showShortcutHelp() {
      let el = $("#shortcut-help-overlay");
      if (!el) {
        el = document.createElement("div");
        el.id = "shortcut-help-overlay";
        el.innerHTML = `
          <div class="shortcut-help-mask"></div>
          <div class="shortcut-help-card">
            <div class="shortcut-help-head">
              <h3>⌨️ 键盘快捷键</h3>
              <button id="shortcut-help-close">✕</button>
            </div>
            <div class="shortcut-help-body">
              <div class="shk-section">
                <h4>侧边栏 / 视图</h4>
                <div class="shk-row"><kbd>⌘ B</kbd><span>显示/隐藏侧边栏</span></div>
                <div class="shk-row"><kbd>⌘ +</kbd> / <kbd>⌘ -</kbd><span>放大 / 缩小 iframe</span></div>
                <div class="shk-row"><kbd>⌘ 0</kbd><span>恢复 75% 默认缩放</span></div>
              </div>
              <div class="shk-section">
                <h4>导航 / 操作</h4>
                <div class="shk-row"><kbd>/</kbd><span>聚焦搜索框</span></div>
                <div class="shk-row"><kbd>R</kbd><span>刷新目录树和当前文件</span></div>
                <div class="shk-row"><kbd>H</kbd><span>打开历史版本抽屉（需先打开文件）</span></div>
                <div class="shk-row"><kbd>T</kbd><span>切换主题（自动 / 浅色 / 深色）</span></div>
                <div class="shk-row"><kbd>Esc</kbd><span>关闭弹窗 / 清搜索 / 收侧栏</span></div>
              </div>
              <div class="shk-section">
                <h4>帮助</h4>
                <div class="shk-row"><kbd>?</kbd><span>显示此快捷键帮助</span></div>
              </div>
              <div class="shk-tip">💡 在输入框里输入时，裸字母键（H R / ?）不会触发，正常打字</div>
            </div>
          </div>
        `;
        document.body.appendChild(el);
        el.querySelector(".shortcut-help-mask").addEventListener("click", () => el.style.display = "none");
        el.querySelector("#shortcut-help-close").addEventListener("click", () => el.style.display = "none");
      }
      el.style.display = "block";
    }

    window.addEventListener("beforeunload", (e) => {
      if (state.isDirty) { e.preventDefault(); e.returnValue = ""; return ""; }
    });

    // v1.7.1: 全局兜底清理拖拽残留状态（防浏览器异常退出导致 class 挂着）
    document.addEventListener("mouseup", () => {
      const dragging = $$(".dnd-dragging");
      const targets = $$(".dnd-target-active");
      if (dragging.length || targets.length) {
        // 微延迟让 drop/dragend 先跑
        setTimeout(() => {
          $$(".dnd-dragging").forEach(el => el.classList.remove("dnd-dragging"));
          $$(".dnd-target-active").forEach(el => el.classList.remove("dnd-target-active"));
        }, 50);
      }
    });
  }

  // ───────────── 启动 ─────────────
  async function init() {
    bindEvents();
    // v1.6: 先加载收藏（侧边栏顶部分组要用）
    await loadFavorites();
    // v1.10.7: 加载最近打开列表（localStorage）
    loadRecent();
    await loadTree();
    setStatus("未打开", "");

    // F3 尝试恢复上次会话（如有则自动打开文件）
    await tryRestoreLastSession();

    // 首次刷新：无论是否恢复了文件，目录都默认展开（pinned），
    // 让用户一眼看到自己在哪、还有哪些文件可切。
    // 用户随后可通过 ⌘B / 顶栏按钮 / Esc 主动收起。
    sidebarCtl.show(true);
    // 如果恢复了文件，下一帧滚动到高亮位置
    if (state.currentFile) {
      requestAnimationFrame(() => scrollToActiveFile());
    }

    // v1.10.0: 启动目录树自动刷新（读配置 + 绑定可见性/交互守护）
    bindAutoRefreshTriggers();
    try {
      const r = await fetch(API.config);
      const d = await r.json();
      const sec = (d && d.ok && typeof d.config.tree_auto_refresh_seconds === "number")
        ? d.config.tree_auto_refresh_seconds : 10;
      startAutoRefresh(sec);
    } catch (e) {
      // 静默失败：默认 10 秒
      startAutoRefresh(10);
    }
    // v1.10.1: 初始化时记录一次签名，避免首次 tick 误判"已变"再次拉全树
    fetch("/api/tree-sig")
      .then(r => r.json())
      .then(d => { if (d && d.ok) state.autoRefresh.lastSig = d.sig; })
      .catch(() => { /* 静默 */ });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
