/**
 * saver-runtime.js · HTML Document Center 运行时注入
 * =====================================================
 * 职责：
 *  1. 嗅探 HTML 是否已有编辑/批注能力（避免双工具栏）
 *  2. 若无则动态注入最小编辑工具栏（contenteditable + 划词批注）
 *  3. 监听编辑事件 → debounce 2s 触发 /api/snapshot
 *  4. 与父窗口（app.js）通过 postMessage 通信：dirty 状态、保存请求
 *
 * 注入入口：server.py 在返回 HTML 前于 </body> 前插入 <script src="/saver-runtime.js">
 * 上下文：window.__DOC_CENTER__ = { filePath, serverOrigin, inIframe }
 */

(function () {
  "use strict";

  const CTX = window.__DOC_CENTER__ || {};
  if (!CTX.filePath) {
    console.warn("[saver] 缺少 __DOC_CENTER__ 上下文，不启用");
    return;
  }
  if (window.__SAVER_RUNTIME_LOADED__) return;
  window.__SAVER_RUNTIME_LOADED__ = true;

  const SERVER = CTX.serverOrigin || "http://localhost:9901";
  const FILE_PATH = CTX.filePath;
  const IN_IFRAME = !!CTX.inIframe;
  const MODE = CTX.mode || "html";  // v1.3: "html" | "md"

  // ───────────────────────────────────────────────────────────────────────────
  // 通信：与父窗口（app.js）
  // ───────────────────────────────────────────────────────────────────────────
  function notifyParent(type, payload) {
    if (!IN_IFRAME) return;
    try {
      window.parent.postMessage(
        { source: "doc-center-saver", type, payload: payload || {} },
        "*"
      );
    } catch (e) {
      console.warn("[saver] postMessage 失败", e);
    }
  }

  // 父窗口发来的指令（如「立即保存并返回 HTML」）
  window.addEventListener("message", function (e) {
    const msg = e.data || {};
    if (msg.source !== "doc-center-app") return;
    if (msg.type === "request_html") {
      notifyParent("html_content", { html: serializeContent(), dirty: isDirty });
    } else if (msg.type === "mark_clean") {
      markClean();
    } else if (msg.type === "force_snapshot") {
      doSnapshot(true);
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 嗅探已有能力
  // ───────────────────────────────────────────────────────────────────────────
  function detectExistingEditor() {
    // 判定 1：明确自带的 review/editor 工具栏
    if (document.querySelector(".review-toolbar") ||
        document.querySelector("[data-editor]")) return true;
    // 判定 2：通用的 .toolbar 容器 + 「批注」/「编辑」文字（如 OPPO v2 报告）
    const tbs = document.querySelectorAll(".toolbar, .editor-toolbar, .edit-bar");
    for (const tb of tbs) {
      const txt = (tb.textContent || "").replace(/\s+/g, "");
      if (txt.includes("批注") || txt.includes("编辑") || txt.includes("保存审阅版")) return true;
    }
    // v1.9.3 修复：判定 3 不再单独靠 contenteditable
    //   - 之前逻辑会误杀"DocCenter 自己写回的 contenteditable"（A 类污染）
    //   - 新逻辑：只有当页面同时存在「contenteditable + 明确的编辑工具 UI」才认为自带编辑器
    //   - 单独的 body contenteditable 不算——那多半是 DocCenter 历史遗留
    return false;
  }

  const HAS_EXISTING_EDITOR = detectExistingEditor();

  // ───────────────────────────────────────────────────────────────────────────
  // 注入最小编辑工具栏（若原 HTML 无）
  // ───────────────────────────────────────────────────────────────────────────
  function injectMinimalToolbar() {
    if (HAS_EXISTING_EDITOR) return;

    // 使 body 可编辑
    if (document.body) {
      document.body.setAttribute("contenteditable", "true");
      document.body.style.outline = "none";
    }

    const bar = document.createElement("div");
    bar.id = "__dc_toolbar";
    bar.innerHTML = `
      <style>
        #__dc_toolbar {
          position: fixed; top: 0; left: 0; right: 0;
          z-index: 2147483600;
          display: flex; align-items: center; gap: 6px;
          height: 38px; padding: 0 12px;
          background: linear-gradient(180deg, #1A1D23 0%, #2D3139 100%);
          color: #fff; font: 12px/1 -apple-system,"PingFang SC",sans-serif;
          border-bottom: 1px solid rgba(201,169,97,0.25);
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }
        #__dc_toolbar .dc-title { color:#C9A961; font-weight:600; letter-spacing:.3px; }
        #__dc_toolbar button {
          background: transparent; color: #E5E7EB;
          border: 1px solid rgba(255,255,255,0.14);
          border-radius: 4px; height: 26px; padding: 0 10px;
          cursor: pointer; font-size: 12px; transition: all .15s;
        }
        #__dc_toolbar button:hover { background: rgba(201,169,97,0.15); color:#C9A961; border-color:#C9A961; }
        #__dc_toolbar .sep { width:1px; height:18px; background: rgba(255,255,255,0.14); margin: 0 4px; }
        #__dc_toolbar .dc-status { margin-left:auto; color:#9CA3AF; font-size:11px; }
        #__dc_toolbar .dc-dot { display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:6px; background:#10B981; transition:background .3s; }
        #__dc_toolbar .dc-dot.dirty { background:#F59E0B; animation: dc-pulse 1.2s infinite; }
        @keyframes dc-pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        /* v1.8.0: 字号下拉 */
        #__dc_toolbar select#__dc_fontsize {
          height: 26px; padding: 0 6px;
          background: transparent; color:#E5E7EB;
          border: 1px solid rgba(255,255,255,0.14); border-radius: 4px;
          font-size: 12px; cursor: pointer;
        }
        #__dc_toolbar select#__dc_fontsize:hover { border-color:#C9A961; color:#C9A961; }
        #__dc_toolbar select#__dc_fontsize option { background:#1A1D23; color:#E5E7EB; }
        /* v1.8.0: 字色按钮 */
        #__dc_toolbar #__dc_color_btn {
          position: relative; padding: 0 8px 6px; min-width: 28px;
        }
        #__dc_toolbar #__dc_color_btn b { font-size: 13px; }
        #__dc_toolbar #__dc_color_btn .__dc_color_bar {
          position: absolute; left: 6px; right: 6px; bottom: 3px;
          height: 3px; border-radius: 2px;
        }
        body { padding-top: 46px !important; }
      </style>
      <span class="dc-title">🎨 HTML Studio</span>
      <span class="sep"></span>
      <button data-cmd="bold"><b>B</b></button>
      <button data-cmd="italic"><i>I</i></button>
      <button data-cmd="underline"><u>U</u></button>
      <span class="sep"></span>
      <!-- v1.8.0 新增：字号下拉 -->
      <select id="__dc_fontsize" title="字号（对选中文字生效）">
        <option value="">字号</option>
        <option value="12">12 · 小</option>
        <option value="14">14</option>
        <option value="16">16 · 正文</option>
        <option value="18">18</option>
        <option value="24">24 · 标题</option>
        <option value="32">32</option>
        <option value="48">48 · 巨标</option>
      </select>
      <!-- v1.8.0 新增：字色（预设色板 + 取色器） -->
      <div class="__dc_color_wrap" id="__dc_color_wrap" title="字色">
        <button id="__dc_color_btn" style="color:#DC2626;"><b>A</b><span class="__dc_color_bar" style="background:#DC2626;"></span></button>
      </div>
      <button data-cmd="hiliteColor" data-val="#FDE68A" title="黄色高亮">🟡</button>
      <span class="sep"></span>
      <!-- v1.11.1 新增：对齐 4 按钮 -->
      <button data-cmd="justifyLeft" title="左对齐">⬅</button>
      <button data-cmd="justifyCenter" title="居中">⬆</button>
      <button data-cmd="justifyRight" title="右对齐">➡</button>
      <button data-cmd="justifyFull" title="两端对齐">☰</button>
      <span class="sep"></span>
      <!-- v1.11.1 新增：链接 -->
      <button id="__dc_link" title="插入/编辑链接（选中文字后点击）">🔗</button>
      <button id="__dc_table" title="插入表格">📊</button>
      <!-- v1.11.5: 更多排版（行高/字间距/代码块/引用块） -->
      <button id="__dc_more" title="更多排版（行高/字间距/代码/引用）">⋯</button>
      <span class="sep"></span>
      <button data-cmd="undo" title="撤销 ⌘Z">↶</button>
      <button data-cmd="redo" title="重做 ⇧⌘Z">↷</button>
      <span class="sep"></span>
      <button id="__dc_spacing" title="块间距调整（⌥ + 点击目标块）">📐 间距</button>
      <button id="__dc_annotate">💬 批注</button>
      <span class="sep"></span>
      <button id="__dc_share" title="导出自包含HTML（所有资源内嵌，发给别人双击即看）">📦 分享</button>
      <span class="dc-status"><span class="dc-dot" id="__dc_dot"></span><span id="__dc_status_text">已保存</span></span>
    `;
    document.body.insertBefore(bar, document.body.firstChild);

    // ─── v1.8.0: 字号下拉事件 ─────────────────────────────────────────────────
    // v1.8.1 修复：选区会在 select 打开时丢失 → mousedown 时保存 range，change 时恢复
    const sel = bar.querySelector("#__dc_fontsize");
    if (sel) {
      sel.addEventListener("mousedown", (e) => {
        e.stopPropagation();
        saveSelection();
      });
      sel.addEventListener("change", (e) => {
        const px = e.target.value;
        if (px) {
          restoreSelection();
          applyInlineStyleToSelection({ "font-size": px + "px" });
          markDirty();
        }
        e.target.value = ""; // 复位
      });
    }

    // ─── v1.8.0: 字色色板弹出 ────────────────────────────────────────────────
    // v1.8.1 修复：mousedown preventDefault 保留选区
    const colorBtn = bar.querySelector("#__dc_color_btn");
    if (colorBtn) {
      let currentColor = "#DC2626";
      // 关键：mousedown preventDefault 防止按钮夺取焦点导致选区丢失
      colorBtn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        saveSelection();
      });
      colorBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const existing = document.getElementById("__dc_color_palette");
        if (existing) { existing.remove(); return; }
        showColorPalette(colorBtn, (color) => {
          currentColor = color;
          colorBtn.style.color = color;
          const barEl = colorBtn.querySelector(".__dc_color_bar");
          if (barEl) barEl.style.background = color;
          restoreSelection();
          applyInlineStyleToSelection({ color: color });
          markDirty();
        });
      });
    }

    // ─── 普通按钮也需 mousedown preventDefault（B/I/U/高亮/Undo/Redo/对齐/链接） ───
    bar.querySelectorAll("button").forEach(b => {
      if (b.id === "__dc_color_btn" || b.id === "__dc_annotate" || b.id === "__dc_spacing" || b.id === "__dc_share") return;
      b.addEventListener("mousedown", (e) => e.preventDefault());
    });

    bar.addEventListener("click", function (e) {
      const btn = e.target.closest("button");
      if (!btn) return;
      if (btn.id === "__dc_annotate") { startAnnotation(); return; }
      if (btn.id === "__dc_share") { exportSelfContained(); return; }
      if (btn.id === "__dc_spacing") {
        try { BlockSpacingEditor.enterBlockModeHint(); } catch (_) {}
        return;
      }
      if (btn.id === "__dc_color_btn") return; // 已单独处理
      // v1.11.1: 链接按钮单独处理
      if (btn.id === "__dc_link") {
        handleLinkButton();
        return;
      }
      // v1.18: 表格按钮
      if (btn.id === "__dc_table") {
        handleTableButton();
        return;
      }
      // v1.11.5: 更多排版菜单（行高/字间距/代码/引用）
      if (btn.id === "__dc_more") {
        handleMoreMenu(btn);
        return;
      }
      const cmd = btn.getAttribute("data-cmd");
      const val = btn.getAttribute("data-val") || null;
      if (cmd) {
        // v1.11.1: 对齐命令需要 styleWithCSS = false（让浏览器用 align 属性）
        if (cmd.indexOf("justify") === 0) {
          try { document.execCommand("styleWithCSS", false, true); } catch (_) {}
        }
        try { document.execCommand(cmd, false, val); } catch (_) {}
        markDirty();
      }
    });
  }

  // v1.18: 表格插入
  function handleTableButton() {
    const input = prompt("插入表格（行×列，如 3×4）：", "3×4");
    if (!input) return;
    const m = input.match(/(\d+)\s*[×x*]\s*(\d+)/i);
    if (!m) { alert("格式不正确，请输入如 3×4"); return; }
    const rows = parseInt(m[1]);
    const cols = parseInt(m[2]);
    if (rows < 1 || cols < 1 || rows > 20 || cols > 20) {
      alert("行列数需在 1-20 之间");
      return;
    }
    let html = '<table style="border-collapse:collapse;width:100%;margin:12px 0;">';
    for (let r = 0; r < rows; r++) {
      html += '<tr>';
      for (let c = 0; c < cols; c++) {
        html += '<td style="border:1px solid #ddd;padding:8px;min-width:60px;">&nbsp;</td>';
      }
      html += '</tr>';
    }
    html += '</table>';
    try { document.execCommand("insertHTML", false, html); } catch (_) {}
    markDirty();
  }

  // v1.11.1: 链接按钮处理
  function handleLinkButton() {
    const sel = window.getSelection();
    let selectedText = "";
    let existingLink = null;

    // 检查当前选区或光标所在位置是否已有 a 标签
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      selectedText = sel.toString();
      let node = range.commonAncestorContainer;
      if (node.nodeType === 3) node = node.parentElement;
      existingLink = node.closest && node.closest("a");
    }

    if (existingLink) {
      // 编辑现有链接
      const newUrl = window.prompt("编辑链接（清空则取消链接）：", existingLink.href);
      if (newUrl === null) return;  // 用户取消
      if (newUrl.trim() === "") {
        // 取消链接
        try { document.execCommand("unlink", false, null); } catch (_) {}
        markDirty();
        return;
      }
      existingLink.href = normalizeUrl(newUrl.trim());
      markDirty();
      return;
    }

    if (!selectedText) {
      alert("请先选中要加链接的文字");
      return;
    }

    const url = window.prompt("输入链接 URL：", "https://");
    if (!url || !url.trim()) return;
    const finalUrl = normalizeUrl(url.trim());
    try { document.execCommand("createLink", false, finalUrl); } catch (_) {}
    markDirty();
  }

  function normalizeUrl(u) {
    if (!u) return u;
    // 已带协议或锚点/相对路径就不动
    if (/^(https?:|mailto:|tel:|ftp:|#|\/)/i.test(u)) return u;
    return "https://" + u;
  }

  // v1.11.5: 更多排版菜单（行高/字间距/代码块/引用块）
  function handleMoreMenu(anchor) {
    const existing = document.getElementById("__dc_more_menu");
    if (existing) { existing.remove(); return; }
    const rect = anchor.getBoundingClientRect();
    const menu = document.createElement("div");
    menu.id = "__dc_more_menu";
    menu.style.cssText = `
      position: fixed; z-index: 2147483640;
      top: ${rect.bottom + 6}px; left: ${rect.left - 80}px;
      width: 240px; background: #1A1D23;
      border: 1px solid rgba(201,169,97,0.3);
      border-radius: 10px;
      box-shadow: 0 12px 32px rgba(0,0,0,0.45);
      padding: 8px;
      font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif;
      animation: __dc_popIn .15s ease-out;
    `;
    menu.innerHTML = `
      <div style="padding: 6px 8px 4px; color:#9CA3AF; font-size:10.5px; letter-spacing:0.4px; text-transform:uppercase; font-weight:600;">行高（line-height）</div>
      <div class="__dc_more_row" style="display:flex; gap:4px; margin-bottom:8px; padding:0 6px;">
        <button data-mm="lh" data-val="1" class="__dc_mmbtn">紧凑 1.0</button>
        <button data-mm="lh" data-val="1.5" class="__dc_mmbtn">舒适 1.5</button>
        <button data-mm="lh" data-val="1.8" class="__dc_mmbtn">宽松 1.8</button>
        <button data-mm="lh" data-val="" class="__dc_mmbtn" title="清除">✕</button>
      </div>
      <div style="padding: 6px 8px 4px; color:#9CA3AF; font-size:10.5px; letter-spacing:0.4px; text-transform:uppercase; font-weight:600;">字间距（letter-spacing）</div>
      <div class="__dc_more_row" style="display:flex; gap:4px; margin-bottom:8px; padding:0 6px;">
        <button data-mm="ls" data-val="-0.5px" class="__dc_mmbtn">紧凑</button>
        <button data-mm="ls" data-val="0" class="__dc_mmbtn">默认</button>
        <button data-mm="ls" data-val="1px" class="__dc_mmbtn">宽松</button>
        <button data-mm="ls" data-val="" class="__dc_mmbtn">✕</button>
      </div>
      <div style="padding: 6px 8px 4px; color:#9CA3AF; font-size:10.5px; letter-spacing:0.4px; text-transform:uppercase; font-weight:600;">块格式</div>
      <div class="__dc_more_row" style="display:flex; gap:4px; padding:0 6px;">
        <button data-mm="block" data-val="pre" class="__dc_mmbtn" style="flex:1;">⌨ 代码块</button>
        <button data-mm="block" data-val="blockquote" class="__dc_mmbtn" style="flex:1;">❝ 引用</button>
        <button data-mm="block" data-val="p" class="__dc_mmbtn" style="flex:1;">¶ 普通</button>
      </div>
      <style>
        #__dc_more_menu .__dc_mmbtn {
          flex: 1; padding: 6px 8px;
          background: rgba(255,255,255,0.06);
          color: #E5E7EB;
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 5px;
          font-size: 11.5px;
          cursor: pointer;
          transition: all 0.1s;
          white-space: nowrap;
          font-family: inherit;
        }
        #__dc_more_menu .__dc_mmbtn:hover {
          background: rgba(201,169,97,0.18);
          color: #C9A961;
          border-color: #C9A961;
        }
      </style>
    `;
    // mousedown preventDefault 保留选区
    menu.querySelectorAll(".__dc_mmbtn").forEach(b => {
      b.addEventListener("mousedown", (e) => e.preventDefault());
    });
    document.body.appendChild(menu);

    menu.addEventListener("click", (e) => {
      const btn = e.target.closest(".__dc_mmbtn");
      if (!btn) return;
      e.stopPropagation();
      const kind = btn.dataset.mm;
      const val = btn.dataset.val;
      restoreSelection();
      if (kind === "lh") {
        if (val) applyInlineStyleToSelection({ "line-height": val });
        else clearInlineStyleOnSelection("line-height");
      } else if (kind === "ls") {
        if (val) applyInlineStyleToSelection({ "letter-spacing": val });
        else clearInlineStyleOnSelection("letter-spacing");
      } else if (kind === "block") {
        applyBlockFormat(val);
      }
      try { markDirty && markDirty(); } catch (_) {}
      menu.remove();
    });

    // 点外部关闭
    setTimeout(() => {
      const off = (e) => {
        if (!menu.contains(e.target) && e.target !== anchor) {
          menu.remove();
          document.removeEventListener("click", off, true);
        }
      };
      document.addEventListener("click", off, true);
    }, 0);
  }

  // v1.11.5: 把当前选区的所在块转为指定标签（pre / blockquote / p）
  function applyBlockFormat(tagName) {
    if (!tagName) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    let node = range.commonAncestorContainer;
    if (node.nodeType === 3) node = node.parentElement;
    if (!node) return;
    // 找到最近的块级元素
    const BLOCK_TAGS = new Set(["P", "DIV", "PRE", "BLOCKQUOTE", "H1", "H2", "H3", "H4", "H5", "H6", "LI", "TD", "TH"]);
    let blockEl = node;
    while (blockEl && blockEl !== document.body && !BLOCK_TAGS.has(blockEl.tagName)) {
      blockEl = blockEl.parentElement;
    }
    if (!blockEl || blockEl === document.body) {
      // 兜底：用 execCommand formatBlock
      try { document.execCommand("formatBlock", false, tagName); } catch (_) {}
      return;
    }
    // 用 formatBlock 更稳健（支持 pre / blockquote / p）
    try { document.execCommand("formatBlock", false, tagName); } catch (_) {}
  }

  // ───────────────────────────────────────────────────────────────────────────
  // v1.8.1: 选区保存/恢复——解决"点工具栏按钮时选区丢失"
  // v1.8.2: selectionchange 持续追踪 + 应用样式后回写，解决"第二次字号不生效"
  // ───────────────────────────────────────────────────────────────────────────
  let _savedRange = null;
  let _selectionTrackerInstalled = false;

  /** v1.8.2: 持续追踪用户选区——任何非空选区都及时记下，避免 mousedown 时机过晚 */
  function installSelectionTracker() {
    if (_selectionTrackerInstalled) return;
    _selectionTrackerInstalled = true;
    document.addEventListener("selectionchange", () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      // 忽略工具栏内部选区（避免焦点切入下拉时把选区"吞掉"）
      const r = sel.getRangeAt(0);
      const container = r.commonAncestorContainer;
      const el = container.nodeType === 1 ? container : container.parentElement;
      if (el && el.closest && el.closest("#__dc_toolbar, #__dc_color_palette")) return;
      if (!sel.isCollapsed) {
        _savedRange = r.cloneRange();
      }
    });
  }

  function saveSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      _savedRange = sel.getRangeAt(0).cloneRange();
    }
  }

  function restoreSelection() {
    if (!_savedRange) return false;
    const sel = window.getSelection();
    sel.removeAllRanges();
    try {
      sel.addRange(_savedRange);
    } catch (_) {
      // range 的 DOM 节点已被销毁 → 清掉，等下一次 selectionchange 再建立
      _savedRange = null;
      return false;
    }
    return true;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // v1.8.0: 文字属性应用（选区 → 包 span 或 execCommand）
  // ───────────────────────────────────────────────────────────────────────────
  /**
   * 对当前选区应用 inline style（字号、字色等）。
   * - 空选区：直接忽略
   * - 跨多元素选区：用 Range.surroundContents 或 execCommand 回退
   */
  function applyInlineStyleToSelection(styleDict) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      return false;
    }
    const range = sel.getRangeAt(0);
    const span = document.createElement("span");
    for (const [k, v] of Object.entries(styleDict)) {
      span.style.setProperty(k, v);
    }    // v1.8.2: 成功应用后，把新 range 回写到 _savedRange，保证下次点击字号/字色仍能 restore
    const syncSavedRange = () => {
      const s = window.getSelection();
      if (s && s.rangeCount > 0 && !s.isCollapsed) {
        _savedRange = s.getRangeAt(0).cloneRange();
      }
    };
    try {
      // surroundContents 只支持简单选区，跨多元素时会抛
      range.surroundContents(span);
      // 重新选中 span 内容，让下一次操作仍有完整 range
      sel.removeAllRanges();
      const nr = document.createRange();
      nr.selectNodeContents(span);
      sel.addRange(nr);
      syncSavedRange();
      return true;
    } catch (_) {
      // 回退：提取内容重新插入
      try {
        const frag = range.extractContents();
        span.appendChild(frag);
        range.insertNode(span);
        sel.removeAllRanges();
        const newRange = document.createRange();
        newRange.selectNodeContents(span);
        sel.addRange(newRange);
        syncSavedRange();
        return true;
      } catch (e) {
        // 最后回退：execCommand foreColor（只支持字色）
        if (styleDict.color) {
          try {
            document.execCommand("foreColor", false, styleDict.color);
            syncSavedRange();
            return true;
          } catch (_) {}
        }
        return false;
      }
    }
  }

  // v1.11.9: 清除选区内某属性的 inline style
  function clearInlineStyleOnSelection(propName) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return false;
    const range = sel.getRangeAt(0);
    // 找到所有覆盖范围内带该 propName style 的元素
    const ancestor = range.commonAncestorContainer;
    const root = ancestor.nodeType === 3 ? ancestor.parentElement : ancestor;
    if (!root) return false;
    // 收集候选：祖先链 + 范围内子孙元素
    const candidates = new Set();
    let cur = root;
    while (cur && cur !== document.body) {
      if (cur.nodeType === 1 && cur.style && cur.style.getPropertyValue(propName)) {
        candidates.add(cur);
      }
      cur = cur.parentElement;
    }
    if (root.querySelectorAll) {
      root.querySelectorAll("[style]").forEach(el => {
        if (el.style.getPropertyValue(propName)) candidates.add(el);
      });
    }
    candidates.forEach(el => {
      el.style.removeProperty(propName);
      // 如果 style 完全空了，移除 style 属性
      if (!el.getAttribute("style") || el.getAttribute("style").trim() === "") {
        el.removeAttribute("style");
      }
    });
    return candidates.size > 0;
  }

  /** v1.8.0: 弹出字色色板 */
  // v1.11.1: 完整调色板 + 最近使用 + 吸管
  const _RECENT_COLORS_KEY = "doc_center_recent_colors_v1";
  const _RECENT_COLORS_MAX = 6;

  function getRecentColors() {
    try {
      const raw = localStorage.getItem(_RECENT_COLORS_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.filter(x => typeof x === "string" && /^#[0-9A-Fa-f]{3,8}$/.test(x)) : [];
    } catch (_) { return []; }
  }
  function pushRecentColor(c) {
    if (!c) return;
    let list = getRecentColors().filter(x => x.toLowerCase() !== c.toLowerCase());
    list.unshift(c);
    if (list.length > _RECENT_COLORS_MAX) list = list.slice(0, _RECENT_COLORS_MAX);
    try { localStorage.setItem(_RECENT_COLORS_KEY, JSON.stringify(list)); } catch (_) {}
  }

  function showColorPalette(anchor, onPick) {
    // v1.11.1: 14 色预设（覆盖深底/浅底/品牌色），按行分组
    // 第一行：基础 8 色（黑白灰系 + 主色）
    // 第二行：彩色 6 色
    const PRESETS_ROW1 = [
      "#FFFFFF", "#E5E7EB", "#9CA3AF", "#4B5563",
      "#1A1D23", "#000000", "#C9A961", "#FDE68A",
    ];
    const PRESETS_ROW2 = [
      "#DC2626", "#EA580C", "#10B981", "#3B82F6",
      "#8B5CF6", "#EC4899",
    ];
    const recent = getRecentColors();

    const rect = anchor.getBoundingClientRect();
    const palette = document.createElement("div");
    palette.id = "__dc_color_palette";
    palette.style.cssText = `
      position: fixed; z-index: 2147483640;
      top: ${rect.bottom + 6}px; left: ${rect.left}px;
      padding: 12px; background: #1A1D23;
      border: 1px solid rgba(201,169,97,0.3);
      border-radius: 10px; box-shadow: 0 12px 32px rgba(0,0,0,0.45);
      width: 232px;
      animation: __dc_popIn .15s ease-out;
      font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif;
    `;
    if (!document.getElementById("__dc_popIn_kf")) {
      const s = document.createElement("style");
      s.id = "__dc_popIn_kf";
      s.textContent = `@keyframes __dc_popIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}`;
      document.head.appendChild(s);
    }

    function makeSwatch(c, opts = {}) {
      const sw = document.createElement("button");
      sw.style.cssText = `
        width: 24px; height: 24px; border-radius: 50%;
        border: 2px solid rgba(255,255,255,0.18);
        background: ${c}; cursor: pointer; padding: 0;
        transition: transform 0.1s, border-color 0.1s;
      `;
      sw.title = c + (opts.hint ? "  " + opts.hint : "");
      // 白色/极浅色：加深边框对比
      if (/^#(F|f)[0-9A-Fa-f]{2,5}$/.test(c) || c.toUpperCase() === "#FFFFFF" || c.toUpperCase() === "#FFF") {
        sw.style.border = "2px solid rgba(0,0,0,0.25)";
      }
      sw.addEventListener("mouseenter", () => sw.style.transform = "scale(1.15)");
      sw.addEventListener("mouseleave", () => sw.style.transform = "scale(1)");
      sw.addEventListener("mousedown", (e) => e.preventDefault());
      sw.addEventListener("click", (e) => {
        e.stopPropagation();
        pushRecentColor(c);
        onPick(c);
        palette.remove();
      });
      return sw;
    }

    function makeLabel(text) {
      const l = document.createElement("div");
      l.textContent = text;
      l.style.cssText = `
        color: #9CA3AF; font-size: 10.5px;
        letter-spacing: 0.4px; text-transform: uppercase;
        margin: 0 0 6px 2px; font-weight: 600;
      `;
      return l;
    }
    function makeRow(colors) {
      const row = document.createElement("div");
      row.style.cssText = `display: grid; grid-template-columns: repeat(8, 24px); gap: 6px; margin-bottom: 8px;`;
      colors.forEach(c => row.appendChild(makeSwatch(c)));
      return row;
    }

    palette.appendChild(makeLabel("预设"));
    palette.appendChild(makeRow(PRESETS_ROW1));
    palette.appendChild(makeRow(PRESETS_ROW2));

    // 最近使用
    if (recent.length > 0) {
      palette.appendChild(makeLabel("最近使用"));
      const recRow = document.createElement("div");
      recRow.style.cssText = `display: grid; grid-template-columns: repeat(8, 24px); gap: 6px; margin-bottom: 8px;`;
      recent.forEach(c => recRow.appendChild(makeSwatch(c, { hint: "（最近使用）" })));
      palette.appendChild(recRow);
    }

    // 自定义颜色（吸管 / picker）
    palette.appendChild(makeLabel("自定义"));
    const customWrap = document.createElement("label");
    customWrap.style.cssText = `
      display: flex; align-items: center; gap: 8px;
      padding: 6px 10px; border-radius: 6px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      cursor: pointer; transition: all 0.12s;
    `;
    customWrap.addEventListener("mouseenter", () => customWrap.style.background = "rgba(201,169,97,0.12)");
    customWrap.addEventListener("mouseleave", () => customWrap.style.background = "rgba(255,255,255,0.06)");

    const customInput = document.createElement("input");
    customInput.type = "color";
    customInput.value = "#C9A961";
    customInput.style.cssText = `
      width: 24px; height: 24px;
      border: 0; background: transparent; cursor: pointer; padding: 0;
    `;
    customInput.addEventListener("mousedown", (e) => e.stopPropagation());
    customInput.addEventListener("change", (e) => {
      const c = e.target.value;
      pushRecentColor(c);
      onPick(c);
      palette.remove();
    });
    const customLabel = document.createElement("span");
    customLabel.textContent = "🎨 选择任意颜色…";
    customLabel.style.cssText = `color: #E5E7EB; font-size: 12px; flex: 1;`;

    customWrap.appendChild(customInput);
    customWrap.appendChild(customLabel);
    palette.appendChild(customWrap);

    document.body.appendChild(palette);
    // 点外部关闭
    setTimeout(() => {
      const off = (e) => {
        if (!palette.contains(e.target) && e.target !== anchor) {
          palette.remove();
          document.removeEventListener("click", off, true);
        }
      };
      document.addEventListener("click", off, true);
    }, 0);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 增强批注系统 v2 · 内联浮窗 + 可视化标记 + 管理
  // ───────────────────────────────────────────────────────────────────────────
  const AnnotationSystem = (function () {
    let _idCounter = 0;
    const _annotations = new Map(); // id -> { element, note, text, createdAt }
    let _activePopover = null;
    let _selectionAnchor = null;

    /* ── 样式注入（只做一次）── */
    function injectStyles() {
      if (document.getElementById("__dc_anno_styles")) return;
      const css = document.createElement("style");
      css.id = "__dc_anno_styles";
      css.textContent = `
        /* 批注标记样式 */
        .__dc_annotation {
          background: linear-gradient(120deg, #FEF3C7 0%, #FDE68A 100%);
          border-bottom: 2px dashed #F59E0B;
          padding: 1px 3px;
          border-radius: 2px;
          cursor: pointer;
          transition: background 0.15s, box-shadow 0.15s;
          position: relative;
        }
        .__dc_annotation:hover {
          background: linear-gradient(120deg, #FDE68A 0%, #FCD34D 100%);
          box-shadow: 0 1px 4px rgba(245,158,11,0.35);
        }

        /* 选区旁的浮动触发按钮 */
        #__dc_anno_trigger {
          position: absolute;
          z-index: 2147483640;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 5px 10px;
          background: linear-gradient(135deg,#1E293B,#334155);
          color:#fff;
          font: 12px/1 -apple-system,"PingFang SC",sans-serif;
          border: 1px solid rgba(201,169,97,0.35);
          border-radius: 6px;
          cursor: pointer;
          box-shadow: 0 3px 12px rgba(0,0,0,0.25);
          animation: __dc_anno_popIn 0.18s ease-out;
          white-space: nowrap;
          user-select: none;
        }
        #__dc_anno_trigger:hover { border-color:#C9A961; transform: translateY(-1px); }
        #__dc_anno_trigger .__dc_anno_trigger_icon { font-size:14px; }
        #__dc_anno_trigger .__dc_anno_trigger_text { font-size:11px; color:#9CA3AF; }
        @keyframes __dc_anno_popIn { from{opacity:0;transform:scale(0.8) translateY(4px)} to{opacity:1;transform:scale(1)} }

        /* 批注浮窗表单 */
        #__dc_anno_popover {
          position: absolute;
          z-index: 2147483641;
          width: 300px;
          background: #fff;
          border: 1px solid #E5E7EB;
          border-radius: 10px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.18), 0 0 0 1px rgba(255,255,255,0.5) inset;
          padding: 12px;
          font: 13px/1.4 -apple-system,"PingFang SC",sans-serif;
          animation: __dc_anno_fadeIn 0.15s ease-out;
        }
        @keyframes __dc_anno_fadeIn { from{opacity:0;transform:translateY(-4px)} to{opacity:1} }
        .__dc_anno_pop_header {
          display:flex; align-items:center; justify-content:space-between;
          margin-bottom:8px;
        }
        .__dc_anno_pop_title { font-weight:600; color:#1F2937; font-size:13px; }
        .__dc_anno_pop_title .__dc_anno_pop_badge {
          font-size:10px; background:#FEF3C7; color:#92400E; padding:1px 6px; border-radius:4px; margin-left:6px; font-weight:500;
        }
        .__dc_anno_pop_selected { font-size:11px; color:#6B7280; margin-bottom:8px; max-height:40px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; background:#F9FAFB; padding:4px 8px; border-radius:4px;}
        .__dc_anno_pop_textarea {
          width:100%; height:72px; resize:none; border:1px solid #D1D5DB; border-radius:6px;
          padding:8px; font-size:13px; line-height:1.45; font-family:inherit;
          outline:none; transition:border-color 0.15s; box-sizing:border-box;
        }
        .__dc_anno_pop_textarea:focus { border-color:#C9A961; box-shadow:0 0 0 3px rgba(201,169,97,0.15); }
        .__dc_anno_pop_actions { display:flex; justify-content:space-between; align-items:center; margin-top:8px; }
        .__dc_anno_pop_btn {
          padding:5px 14px; border-radius:6px; border:none; cursor:pointer; font-size:12px; font-weight:500; transition:all 0.12s;
        }
        .__dc_anno_pop_btn_primary { background:linear-gradient(135deg,#C9A961,#D4A85A); color:#111; }
        .__dc_anno_pop_btn_primary:hover { transform:translateY(-1px); box-shadow:0 2px 8px rgba(201,169,97,0.35); }
        .__dc_anno_pop_btn_danger { background:#FEE2E2; color:#DC2626; }
        .__dc_anno_pop_btn_danger:hover { background:#FECACA; }
        .__dc_anno_pop_btn_cancel { background:#F3F4F6; color:#6B7280; }
        .__dc_anno_pop_btn_cancel:hover { background:#E5E7EB; }

        /* 悬停气泡 */
        .__dc_anno_tooltip {
          position:absolute; z-index:2147483639; bottom:calc(100% + 6px); left:50%; transform:translateX(-50%);
          background:#1F2937; color:#F9FAFB; padding:6px 10px; border-radius:6px;
          font-size:11px; line-height:1.4; white-space:nowrap; max-width:260px; pointer-events:none;
          box-shadow:0 4px 16px rgba(0,0,0,0.25); opacity:0; transition:opacity 0.15s;
        }
        .__dc_anno_tooltip::after {
          content:''; position:absolute; top:100%; left:50%; margin-left:-5px;
          border:5px solid transparent; border-top-color:#1F2937;
        }
        .__dc_annotation:hover .__dc_anno_tooltip { opacity:1; }
      `;
      document.head.appendChild(css);
    }

    /* ── 工具函数 ──*/
    function genId() { return "__dc_anno_" + (++_idCounter) + "_" + Date.now().toString(36); }

    function clampPos(rect, w, h) {
      const scrollX = window.scrollX || window.pageXOffset;
      const scrollY = window.scrollY || window.pageYOffset;
      let left = rect.left + scrollX + (rect.width - w) / 2;
      let top = rect.bottom + scrollY + 6;
      if (left < 4) left = 4;
      if (left + w > window.innerWidth - 4) left = window.innerWidth - 4 - w;
      if (top + h > window.innerHeight + scrollY - 4) top = rect.top + scrollY - h - 6;
      return { left, top };
    }

    function dismissTrigger() {
      var el = document.getElementById("__dc_anno_trigger");
      if (el) el.remove();
    }

    function dismissPopover() {
      if (_activePopover) { _activePopover.remove(); _activePopover = null; }
    }

    /* ── 创建选区浮动按钮 ──*/
    function showSelectionTrigger(range) {
      dismissTrigger();
      var rect = range.getBoundingClientRect();
      if (rect.width < 4) return;

      var btn = document.createElement("div");
      btn.id = "__dc_anno_trigger";
      btn.innerHTML = '<span class="__dc_anno_trigger_icon">💬</span><span class="__dc_anno_trigger_text">添加批注</span>';

      var pos = clampPos(rect, 130, 32);
      btn.style.left = pos.left + "px";
      btn.style.top = pos.top + "px";

      document.body.appendChild(btn);

      // v1.8.1: mousedown preventDefault 防止按钮夺焦导致 selection 立即被 selectionchange 清空
      // 这会导致 onSelectionChange → dismissTrigger() 同步移除按钮，click 事件根本不触发
      btn.addEventListener("mousedown", function (e) {
        e.preventDefault();
        e.stopPropagation();
      });

      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        e.preventDefault();
        dismissTrigger();
        openAnnotationPopover(range);
      });
    }

    /* ── 打开批注浮窗 ──*/
    function openAnnotationPopover(range, existingMark) {
      dismissPopover();
      var selectedText = existingMark ? (existingMark.getAttribute("data-original-text") || existingMark.textContent) : range.toString().trim();

      var popover = document.createElement("div");
      popover.id = "__dc_anno_popover";
      var isEdit = !!existingMark;
      popover.innerHTML =
        '<div class="__dc_anno_pop_header">' +
          '<span class="__dc_anno_pop_title">💬 ' + (isEdit ? '编辑批注' : '添加批注') + '<span class="__dc_anno_pop_badge">' + selectedText.slice(0, 20) + (selectedText.length > 20 ? '…' : '') + '</span></span>' +
        '</div>' +
        '<div class="__dc_anno_pop_selected">' + escapeHTML(selectedText.slice(0, 80)) + '</div>' +
        '<textarea class="__dc_anno_pop_textarea" placeholder="写下你的批注…" ' + (isEdit ? '>' : '>') + (isEdit ? escapeHTML(existingMark.getAttribute("data-note") || "") : "") + '</textarea>' +
        '<div class="__dc_anno_pop_actions">' +
          (isEdit
            ? '<button class="__dc_anno_pop_btn __dc_anno_pop_btn_danger" data-action="delete">🗑 删除</button>'
            : ''
          ) +
          '<button class="__dc_anno_pop_btn __dc_anno_pop_btn_cancel" data-action="cancel">取消</button>' +
          '<button class="__dc_anno_pop_btn __dc_anno_pop_btn_primary" data-action="save">' + (isEdit ? '✓ 更新' : '✓ 添加') + '</button>' +
        '</div>';

      var anchorRect = existingMark ? existingMark.getBoundingClientRect() : range.getBoundingClientRect();
      var pos = clampPos(anchorRect, 300, 200);
      popover.style.left = pos.left + "px";
      popover.style.top = pos.top + "px";

      document.body.appendChild(popover);
      _activePopover = popover;
      _selectionAnchor = range;

      var textarea = popover.querySelector(".__dc_anno_pop_textarea");

      // 聚焦文本框并定位光标到末尾
      setTimeout(function () { textarea.focus(); if (!isEdit) textarea.select(); }, 10);

      // 绑定事件
      popover.addEventListener("click", function (e) {
        e.stopPropagation();
        var action = e.target.closest("[data-action]");
        if (!action) return;

        switch (action.dataset.action) {
          case "save":
            var note = textarea.value.trim();
            if (!note) { textarea.focus(); return; }
            if (isEdit) {
              updateAnnotation(existingMark, note);
            } else {
              createAnnotation(range, note);
            }
            dismissPopover();
            break;
          case "delete":
            deleteAnnotation(existingMark);
            dismissPopover();
            break;
          case "cancel":
            dismissPopover();
            break;
        }
      });

      // 点击外部关闭
      setTimeout(function () {
        document.addEventListener("mousedown", onOutsideClick, true);
      }, 0);
    }

    function onOutsideClick(e) {
      if (_activePopover && !_activePopover.contains(e.target)) {
        // 如果点击的是已有的批注标记，切换到编辑模式
        var targetMark = e.target.closest(".__dc_annotation");
        if (targetMark) {
          dismissPopover();
          var range = document.createRange();
          range.selectNodeContents(targetMark);
          openAnnotationPopover(range, targetMark);
        } else {
          dismissPopover();
        }
        document.removeEventListener("mousedown", onOutsideClick, true);
      }
    }

    /* ── CRUD 操作 ──*/
    function createAnnotation(range, note) {
      var mark = document.createElement("mark");
      var id = genId();
      mark.className = "__dc_annotation";
      mark.id = id;
      mark.setAttribute("data-note", note);
      mark.setAttribute("data-created-at", new Date().toISOString());
      mark.setAttribute("data-original-text", range.toString().trim());

      // 内嵌 tooltip
      var tip = document.createElement("span");
      tip.className = "__dc_anno_tooltip";
      tip.textContent = note;
      mark.appendChild(tip);

      // 点击编辑
      mark.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var r = document.createRange();
        r.selectNodeContents(this);
        openAnnotationPopover(r, this);
      });

      try {
        range.surroundContents(mark);
        window.getSelection().removeAllRanges();
      } catch (err) {
        console.warn("[saver] 批注跨节点，尝试逐段处理", err);
        // 跨节点降级：只标注起始部分
        try {
          var startNode = range.startContainer;
          var startOff = range.startOffset;
          var endOff = range.endOffset;
          if (startNode.nodeType === 3) {
            var afterText = startNode.nodeValue.substring(startOff, Math.min(endOff, startNode.nodeValue.length));
            if (afterText.trim()) {
              var partial = document.createTextNode(afterText);
              var parent = startNode.parentNode;
              var afterRest = startNode.nodeValue.substring(Math.min(endOff, startNode.nodeValue.length));
              startNode.nodeValue = startNode.nodeValue.substring(0, startOff);
              parent.insertBefore(partial, startNode.nextSibling);
              if (afterRest) parent.insertBefore(document.createTextNode(afterRest), partial.nextSibling);
              var pr = document.createRange();
              pr.selectNodeContents(partial);
              pr.surroundContents(mark);
              window.getSelection().removeAllRanges();
            }
          }
        } catch (e2) {
          toast("⚠️ 批注失败：选中范围跨域了多个复杂结构，请选择较小的文字范围");
          return;
        }
      }

      _annotations.set(id, { element: mark, note: note, text: mark.getAttribute("data-original-text"), createdAt: new Date() });
      markDirty();
      notifyParent("annotation_changed", { totalAnnotations: _annotations.size, action: "add" });
      toast("✓ 批注已添加");
    }

    function updateAnnotation(mark, newNote) {
      mark.setAttribute("data-note", newNote);
      var tip = mark.querySelector(".__dc_anno_tooltip");
      if (tip) tip.textContent = newNote;
      var entry = _annotations.get(mark.id);
      if (entry) entry.note = newNote;
      markDirty();
      notifyParent("annotation_changed", { totalAnnotations: _annotations.size, action: "update" });
      toast("✓ 批注已更新");
    }

    function deleteAnnotation(mark) {
      var id = mark.id;
      // 将 mark 的子文本节点替换回原位
      var parent = mark.parentNode;
      while (mark.firstChild) {
        parent.insertBefore(mark.firstChild, mark);
      }
      parent.normalize();
      mark.remove();
      _annotations.delete(id);
      markDirty();
      notifyParent("annotation_changed", { totalAnnotations: _annotations.size, action: "delete" });
      toast("🗑 批注已删除");
    }

    /* ── 选区监听 ──*/
    function onSelectionChange() {
      var sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) {
        dismissTrigger();
        return;
      }
      var text = sel.toString().trim();
      if (!text || text.length < 1) { dismissTrigger(); return; }

      // 不在批注浮窗内部操作时不显示 trigger
      if (_activePopover && _activePopover.contains(sel.anchorNode)) return;
      // 不在已有批注标记内的选区才显示
      if (sel.anchorNode && sel.anchorNode.closest && sel.anchorNode.closest(".__dc_annotation")) {
        dismissTrigger(); return;
      }

      // 延迟一点显示，避免每次移动都闪
      clearTimeout(_selTimer);
      _selTimer = setTimeout(function () {
        var sel2 = window.getSelection();
        if (!sel2 || sel2.isCollapsed) return;
        try { showSelectionTrigger(sel2.getRangeAt(0)); } catch (_) {}
      }, 150);
    }
    var _selTimer = null;

    /* ── 小 toast ──*/
    function toast(msg) {
      var t = document.createElement("div");
      t.style.cssText = "position:fixed;z-index:2147483645;top:48px;left:50%;transform:translateX(-50%);" +
        "padding:6px 16px;background:#1F2937;color:#fff;font-size:12px;border-radius:6px;" +
        "box-shadow:0 4px 16px rgba(0,0,0,0.2);animation:__dc_anno_popIn 0.18s;pointer-events:none;";
      t.textContent = msg;
      document.body.appendChild(t);
      setTimeout(function () { t.style.opacity = "0"; t.style.transition = "opacity 0.25s"; setTimeout(function () { t.remove(); }, 250); }, 1800);
    }

    function escapeHTML(s) {
      var d = document.createElement("div"); d.textContent = s; return d.innerHTML;
    }

    /* ── 公共 API ──*/
    function getStats() {
      return { total: _annotations.size, items: Array.from(_annotations.entries()).map(function (e) { return { id: e[0], note: e[1].note, text: e[1].text }; }) };
    }

    function init() {
      injectStyles();
      document.addEventListener("selectionchange", onSelectionChange);
      // 点击空白处关闭所有浮层
      document.addEventListener("mousedown", function (e) {
        if (_activePopover && !_activePopover.contains(e.target) && !e.target.closest(".__dc_annotation")) {
          // 延迟关闭让点击事件先处理
        }
      });
      console.log("[saver] AnnotationSystem v2 ready");
    }

    return { init: init, getStats: getStats };
  })();

  function startAnnotation() {
    // 兼容旧入口：初始化 + 给用户一个明确反馈
    AnnotationSystem.init();
    // 提示用户下一步操作
    var sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount || !sel.toString().trim()) {
      toast("💡 请先选中要批注的文字，然后点击出现的「添加批注」按钮");
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // v1.8.0: 图片编辑系统（ImageEditor）
  //   - 点击任意图片 → 浮窗「🔄 替换 / 📋 粘贴 / 🗑 删除 / ✕」
  //   - 替换：本地选文件 或 从剪贴板
  //   - 全局 ⌘V 粘贴图片到光标位置
  //   - 拖入本地图片文件到页面 → 光标位置插入
  //   - 所有图片统一 base64 内嵌（保持 DocCenter 单文件哲学）
  //   - > 2MB 弹 confirm 警告膨胀
  // ═══════════════════════════════════════════════════════════════════════════
  const ImageEditor = (function () {
    let selectedImg = null;
    let popover = null;
    let suspendDeselect = false; // v1.9.1: 文件对话框打开期间暂停自动取消选中
    const IMG_WARN_BYTES = 2 * 1024 * 1024; // 2MB

    function injectStyles() {
      if (document.getElementById("__dc_img_styles")) return;
      const s = document.createElement("style");
      s.id = "__dc_img_styles";
      s.textContent = `
        img.__dc_img_selected {
          outline: 3px solid #C9A961 !important;
          outline-offset: 2px !important;
          box-shadow: 0 0 0 6px rgba(201,169,97,0.2) !important;
          transition: outline .12s, box-shadow .12s;
        }
        #__dc_img_popover {
          position: absolute;
          z-index: 2147483639;
          display: flex; align-items: center; gap: 4px;
          padding: 6px 8px;
          background: linear-gradient(135deg,#1E293B,#334155);
          color: #fff;
          border: 1px solid rgba(201,169,97,0.35);
          border-radius: 8px;
          box-shadow: 0 6px 20px rgba(0,0,0,0.3);
          font: 12px -apple-system,"PingFang SC",sans-serif;
          animation: __dc_img_popin .15s ease-out;
          user-select: none;
        }
        @keyframes __dc_img_popin { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:none} }
        #__dc_img_popover button {
          background: transparent; color:#E5E7EB;
          border: 1px solid rgba(255,255,255,0.14);
          padding: 5px 10px; font-size: 12px; border-radius: 4px;
          cursor: pointer; transition: all .12s;
          white-space: nowrap;
        }
        #__dc_img_popover button:hover {
          background: rgba(201,169,97,0.15);
          color:#C9A961; border-color:#C9A961;
        }
        #__dc_img_popover button.__dc_danger:hover {
          background: rgba(239,68,68,0.18);
          color:#F87171; border-color:#F87171;
        }
        #__dc_img_popover .__dc_img_sep {
          width: 1px; height: 18px; background: rgba(255,255,255,0.14); margin: 0 2px;
        }
        /* v1.11.3: 图片选中时的 4 角 resize handle */
        .__dc_img_handle {
          position: absolute;
          width: 12px; height: 12px;
          background: #C9A961;
          border: 2px solid #fff;
          border-radius: 50%;
          z-index: 2147483640;
          box-shadow: 0 1px 3px rgba(0,0,0,0.4);
          transition: transform 0.1s, background 0.1s;
        }
        .__dc_img_handle:hover {
          transform: scale(1.3);
          background: #E0BB72;
        }
        .__dc_img_handle.__dc_h_nw { cursor: nwse-resize; }
        .__dc_img_handle.__dc_h_ne { cursor: nesw-resize; }
        .__dc_img_handle.__dc_h_sw { cursor: nesw-resize; }
        .__dc_img_handle.__dc_h_se { cursor: nwse-resize; }
        /* v1.11.3: 选中图片主体的拖拽光标提示 */
        img.__dc_img_selected {
          cursor: move;
        }
        .__dc_img_dropzone_top, .__dc_img_dropzone_bottom {
          position: absolute; left: 0; right: 0; height: 6px;
          background: linear-gradient(90deg, transparent, #C9A961, transparent);
          z-index: 2147483637;
          pointer-events: none;
          border-radius: 3px;
          animation: __dc_dropzone_pulse 0.6s ease-in-out infinite alternate;
        }
        @keyframes __dc_dropzone_pulse {
          from { opacity: 0.4; }
          to { opacity: 1; }
        }
      `;
      document.head.appendChild(s);
    }

    // v1.11.3: 4 角 resize handle 容器
    let handles = [];
    let dropzoneTop = null;
    let dropzoneBottom = null;

    function clearHandles() {
      handles.forEach(h => { try { h.remove(); } catch (_) {} });
      handles = [];
    }
    function clearDropzones() {
      if (dropzoneTop) { try { dropzoneTop.remove(); } catch (_) {} dropzoneTop = null; }
      if (dropzoneBottom) { try { dropzoneBottom.remove(); } catch (_) {} dropzoneBottom = null; }
    }

    function renderHandles(img) {
      clearHandles();
      const rect = img.getBoundingClientRect();
      const positions = [
        { cls: "__dc_h_nw", x: rect.left,  y: rect.top },
        { cls: "__dc_h_ne", x: rect.right, y: rect.top },
        { cls: "__dc_h_sw", x: rect.left,  y: rect.bottom },
        { cls: "__dc_h_se", x: rect.right, y: rect.bottom },
      ];
      positions.forEach(p => {
        const h = document.createElement("div");
        h.className = "__dc_img_handle " + p.cls;
        h.style.left = (window.scrollX + p.x - 6) + "px";
        h.style.top  = (window.scrollY + p.y - 6) + "px";
        h.dataset.corner = p.cls.replace("__dc_h_", "");
        h.addEventListener("mousedown", (e) => startResize(e, img, h.dataset.corner));
        document.body.appendChild(h);
        handles.push(h);
      });
    }

    // v1.11.3: 拖拽 resize 逻辑
    function startResize(e, img, corner) {
      e.preventDefault();
      e.stopPropagation();
      const startRect = img.getBoundingClientRect();
      const startW = startRect.width;
      const startH = startRect.height;
      const ratio = startW / startH;
      const startX = e.clientX;
      const startY = e.clientY;
      // 是否保持宽高比（默认保持，按 Shift 解锁）
      const keepRatioInit = !e.shiftKey;

      function onMove(ev) {
        let dx = ev.clientX - startX;
        let dy = ev.clientY - startY;
        // 不同角的方向反转
        if (corner === "nw" || corner === "sw") dx = -dx;
        if (corner === "nw" || corner === "ne") dy = -dy;

        let newW = Math.max(20, startW + dx);
        let newH = Math.max(20, startH + dy);
        const keepRatio = keepRatioInit && !ev.shiftKey;
        if (keepRatio) {
          // 用更明显的轴决定主导
          if (Math.abs(dx) > Math.abs(dy)) newH = newW / ratio;
          else newW = newH * ratio;
        }
        img.style.width = Math.round(newW) + "px";
        img.style.height = Math.round(newH) + "px";
        // 同步更新 handles 位置
        renderHandles(img);
        // popover 也跟着移动
        if (popover) renderPopover(img);
      }
      function onUp() {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        try { markDirty && markDirty(); } catch (_) {}
      }
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    }

    // v1.11.3: 图片主体拖拽 → 段内上下移动
    function startDrag(e, img) {
      // 仅左键、不是在 handle 上
      if (e.button !== 0) return;
      if (e.target && e.target.classList && e.target.classList.contains("__dc_img_handle")) return;
      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      let moved = false;
      const parent = img.parentElement;
      if (!parent) return;

      // 找出当前段内所有可作为锚点的"块级兄弟"
      const siblings = Array.from(parent.children).filter(c => c !== img);

      function onMove(ev) {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (!moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) moved = true;
        if (!moved) return;
        // 找到鼠标所在 sibling，在其上方/下方显示 dropzone
        const target = siblings.find(s => {
          const r = s.getBoundingClientRect();
          return ev.clientY >= r.top && ev.clientY <= r.bottom;
        });
        clearDropzones();
        if (!target) return;
        const tr = target.getBoundingClientRect();
        const isTopHalf = ev.clientY < tr.top + tr.height / 2;
        const dz = document.createElement("div");
        dz.className = isTopHalf ? "__dc_img_dropzone_top" : "__dc_img_dropzone_bottom";
        dz.style.left = (window.scrollX + tr.left) + "px";
        dz.style.top = (window.scrollY + (isTopHalf ? tr.top - 3 : tr.bottom - 3)) + "px";
        dz.style.width = tr.width + "px";
        document.body.appendChild(dz);
        if (isTopHalf) dropzoneTop = dz; else dropzoneBottom = dz;
      }
      function onUp(ev) {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        clearDropzones();
        if (!moved) return; // 视为点击，不处理移动
        // 找到 drop 目标并实际移动 DOM
        const target = siblings.find(s => {
          const r = s.getBoundingClientRect();
          return ev.clientY >= r.top && ev.clientY <= r.bottom;
        });
        if (!target) return;
        const tr = target.getBoundingClientRect();
        const isTopHalf = ev.clientY < tr.top + tr.height / 2;
        if (isTopHalf) parent.insertBefore(img, target);
        else parent.insertBefore(img, target.nextSibling);
        try { markDirty && markDirty(); } catch (_) {}
        // 重新定位 handles & popover
        renderHandles(img);
        if (popover) renderPopover(img);
      }
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    }

    function selectImage(img) {
      deselectImage();
      selectedImg = img;
      img.classList.add("__dc_img_selected");
      renderPopover(img);
      // v1.11.3: 注入 4 角 resize handles + 监听图片主体拖拽
      renderHandles(img);
      img.__dc_dragHandler = (e) => startDrag(e, img);
      img.addEventListener("mousedown", img.__dc_dragHandler);
    }

    function deselectImage() {
      if (selectedImg) {
        selectedImg.classList.remove("__dc_img_selected");
        // v1.11.3: 清理拖拽监听
        if (selectedImg.__dc_dragHandler) {
          selectedImg.removeEventListener("mousedown", selectedImg.__dc_dragHandler);
          delete selectedImg.__dc_dragHandler;
        }
      }
      selectedImg = null;
      if (popover) { popover.remove(); popover = null; }
      // v1.11.3: 清理 handles + dropzones
      clearHandles();
      clearDropzones();
    }

    function renderPopover(img) {
      if (popover) popover.remove();
      const rect = img.getBoundingClientRect();
      const top = window.scrollY + rect.top - 44;
      const left = window.scrollX + rect.left;

      popover = document.createElement("div");
      popover.id = "__dc_img_popover";
      popover.style.top = Math.max(window.scrollY + 48, top) + "px"; // 不遮顶栏
      popover.style.left = left + "px";
      popover.innerHTML = `
        <button data-act="replace" title="从本地文件选图">🔄 替换</button>
        <button data-act="paste" title="从剪贴板粘贴">📋 粘贴</button>
        <span class="__dc_img_sep"></span>
        <button data-act="delete" class="__dc_danger" title="删除图片">🗑 删除</button>
        <span class="__dc_img_sep"></span>
        <button data-act="close" title="取消选择">✕</button>
      `;
      document.body.appendChild(popover);

      popover.addEventListener("click", (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;
        e.stopPropagation();
        const act = btn.dataset.act;
        if (act === "replace") pickFileAndReplace();
        else if (act === "paste") pasteFromClipboard();
        else if (act === "delete") deleteImage();
        else if (act === "close") deselectImage();
      });
    }

    function pickFileAndReplace() {
      // v1.9.1 修复：锁住当前图片引用，避免文件对话框关闭时触发 deselect 导致 selectedImg 丢失
      const targetImg = selectedImg;
      if (!targetImg) return;
      suspendDeselect = true; // 暂停 deselect，直到文件对话框关闭
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.style.display = "none";
      const restore = () => {
        // 文件对话框关闭后延迟恢复，跳过焦点切换引发的事件
        setTimeout(() => { suspendDeselect = false; }, 300);
      };
      input.addEventListener("change", (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) replaceImageFromFile(file, targetImg);
        input.remove();
        restore();
      });
      // 取消也要恢复（浏览器有 cancel 事件，但兼容性不完美，用 focus 兜底）
      window.addEventListener("focus", restore, { once: true });
      document.body.appendChild(input);
      input.click();
    }

    async function pasteFromClipboard() {
      // v1.9.1 同步锁定引用
      const targetImg = selectedImg;
      if (!targetImg) return;
      if (!navigator.clipboard || !navigator.clipboard.read) {
        toast("⚠️ 浏览器不支持剪贴板读取，请用 ⌘V 直接粘贴到页面");
        return;
      }
      try {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          for (const type of item.types) {
            if (type.startsWith("image/")) {
              const blob = await item.getType(type);
              replaceImageFromBlob(blob, targetImg);
              return;
            }
          }
        }
        toast("⚠️ 剪贴板里没有图片");
      } catch (e) {
        toast("剪贴板读取失败：" + e.message);
      }
    }

    function replaceImageFromFile(file, targetImg) {
      if (!file.type.startsWith("image/")) {
        toast("⚠️ 请选择图片文件");
        return;
      }
      checkSizeAndDo(file, () => replaceImageFromBlob(file, targetImg));
    }

    function replaceImageFromBlob(blob, targetImg) {
      // v1.9.1: targetImg 参数化，不再依赖全局 selectedImg
      const img = targetImg || selectedImg;
      if (!img) {
        toast("⚠️ 目标图片已丢失，请重新选中");
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        // 确认 img 仍在 DOM 中（防止用户已删除）
        if (!img.isConnected) {
          toast("⚠️ 目标图片已从页面移除");
          return;
        }
        img.src = e.target.result;
        markDirty();
        const sizeKB = Math.round(e.target.result.length / 1024);
        const w = img.naturalWidth || "?";
        const h = img.naturalHeight || "?";
        toast(`✅ 已替换图片（${w}×${h}，${sizeKB}KB base64）`);
        // 重新选中并刷新浮窗位置
        setTimeout(() => {
          selectImage(img);
        }, 100);
      };
      reader.readAsDataURL(blob);
    }

    function deleteImage() {
      if (!selectedImg) return;
      if (!confirm("删除这张图片？（可通过 ⌘Z 撤销）")) return;
      const parent = selectedImg.parentElement;
      selectedImg.remove();
      selectedImg = null;
      if (popover) { popover.remove(); popover = null; }
      markDirty();
      toast("🗑 图片已删除");
    }

    function checkSizeAndDo(blobOrFile, doFn) {
      const size = blobOrFile.size || 0;
      if (size > IMG_WARN_BYTES) {
        const mb = (size / 1024 / 1024).toFixed(1);
        if (!confirm(`图片较大（${mb} MB），将以 base64 内嵌到 HTML，文件会膨胀 ~1.33 倍。\n\n确认继续？`)) {
          return;
        }
      }
      doFn();
    }

    // ─── 全局 ⌘V 粘贴插入新图 ────────────────────────────────────────────
    function handleGlobalPaste(e) {
      const items = (e.clipboardData && e.clipboardData.items) || [];
      for (const item of items) {
        if (item.type && item.type.startsWith("image/")) {
          const blob = item.getAsFile();
          if (blob) {
            e.preventDefault();
            checkSizeAndDo(blob, () => insertImageAtCursor(blob));
            return;
          }
        }
      }
    }

    // ─── 拖入本地图片 ────────────────────────────────────────────────────
    function handleGlobalDrop(e) {
      // 忽略 DocCenter 工具栏的拖放
      if (e.target && e.target.closest && e.target.closest("#__dc_toolbar")) return;
      const files = (e.dataTransfer && e.dataTransfer.files) || [];
      for (const f of files) {
        if (f.type && f.type.startsWith("image/")) {
          e.preventDefault();
          checkSizeAndDo(f, () => insertImageAtCursor(f));
          return;
        }
      }
    }

    function handleGlobalDragover(e) {
      // 只在包含文件的拖放时 preventDefault（激活 drop）
      const types = Array.from((e.dataTransfer && e.dataTransfer.types) || []);
      if (types.includes("Files")) {
        e.preventDefault();
      }
    }

    function insertImageAtCursor(blob) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataURL = e.target.result;
        const sel = window.getSelection();
        const img = document.createElement("img");
        img.src = dataURL;
        img.style.maxWidth = "100%";
        img.style.height = "auto";
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          range.deleteContents();
          range.insertNode(img);
          // 光标移到图片后
          range.setStartAfter(img);
          range.setEndAfter(img);
          sel.removeAllRanges();
          sel.addRange(range);
        } else if (document.body) {
          document.body.appendChild(img);
        }
        markDirty();
        const sizeKB = Math.round(dataURL.length / 1024);
        toast(`📷 已插入图片（${sizeKB}KB base64）`);
      };
      reader.readAsDataURL(blob);
    }

    // ─── 全局点击：选中图片 或 取消选中 ───────────────────────────────────
    function handleGlobalClick(e) {
      // v1.9.1: 文件对话框期间暂停所有 deselect 行为
      if (suspendDeselect) return;
      // v1.9.2: ⌥/Alt + click 让给 BlockSpacingEditor（块间距编辑）
      if (e.altKey) return;
      // 点在图片上 → 选中
      if (e.target && e.target.tagName === "IMG") {
        // 跳过 DocCenter 自己的 UI
        if (e.target.closest("#__dc_toolbar") ||
            e.target.closest("#__dc_img_popover") ||
            e.target.closest("#__dc_color_palette")) return;
        // v1.8.0: 仅在可编辑页面生效（body 或父容器 contenteditable）
        if (!isEditableContext(e.target)) return;
        // 不阻止默认行为——允许 contenteditable 的光标进入
        selectImage(e.target);
        return;
      }
      // 点在 popover 上 → 忽略
      if (e.target && e.target.closest && e.target.closest("#__dc_img_popover")) return;
      // 点其他地方 → 取消选中
      if (selectedImg) deselectImage();
    }

    /** 判断目标是否在可编辑上下文中 */
    function isEditableContext(el) {
      if (!el) return false;
      if (document.body && document.body.isContentEditable) return true;
      // 向上找最近的 contenteditable='true'
      let cur = el;
      while (cur && cur !== document) {
        if (cur.isContentEditable) return true;
        cur = cur.parentNode;
      }
      return false;
    }

    function init() {
      injectStyles();
      document.addEventListener("click", handleGlobalClick, true);
      document.addEventListener("paste", handleGlobalPaste, true);
      document.addEventListener("drop", handleGlobalDrop, true);
      document.addEventListener("dragover", handleGlobalDragover, true);
      // Escape 取消选中
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && selectedImg && !suspendDeselect) deselectImage();
      }, true);
      // 滚动时更新浮窗位置
      let scrollT = null;
      window.addEventListener("scroll", () => {
        if (selectedImg && popover) {
          clearTimeout(scrollT);
          scrollT = setTimeout(() => {
            renderPopover(selectedImg);
            // v1.11.3: handles 也跟着滚动
            renderHandles(selectedImg);
          }, 50);
        }
      }, true);
      console.log("[saver] ImageEditor v1.11.3 ready");
    }

    return { init, deselect: deselectImage };
  })();

  // ═══════════════════════════════════════════════════════════════════════════
  // v1.9.0: 块间距编辑器（BlockSpacingEditor）
  //   - ⌥ + click 任意块级元素 → 浮窗「上/下边距滑杆 + 4 预设 + 清除」
  //   - 方向键 ↑↓ 改 margin-top ±4px，←→ 改 margin-bottom ±4px
  //   - Esc / 点空白 退出选择
  //   - 🪄 一键规范节奏（4:8 间距律自动归一化）
  //   - 架构参考 ImageEditor IIFE
  // ═══════════════════════════════════════════════════════════════════════════
  const BlockSpacingEditor = (function () {
    let selectedBlock = null;
    let popover = null;
    let indicatorTop = null;
    let indicatorBottom = null;

    const BLOCK_TAGS = new Set([
      "DIV","SECTION","ARTICLE","ASIDE","HEADER","FOOTER","NAV","MAIN",
      "P","H1","H2","H3","H4","H5","H6",
      "UL","OL","LI","TABLE","FIGURE","BLOCKQUOTE","PRE","HR",
      "TR","TD","TH"
    ]);

    // 4:8 间距律档位
    const SPACING_SCALE = [0, 4, 8, 12, 16, 24, 32, 48, 64, 80, 120];

    function injectStyles() {
      if (document.getElementById("__dc_block_styles")) return;
      const s = document.createElement("style");
      s.id = "__dc_block_styles";
      s.textContent = `
        .__dc_block_selected {
          outline: 2px dashed #C9A961 !important;
          outline-offset: 4px !important;
          transition: outline-color 0.15s;
          position: relative;
        }
        .__dc_spacing_indicator {
          position: absolute;
          left: 0; right: 0;
          background: linear-gradient(90deg, rgba(201,169,97,0.22), rgba(201,169,97,0.06));
          pointer-events: none;
          z-index: 2147483638;
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(201,169,97,0.95);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1px;
          text-shadow: 0 1px 2px rgba(0,0,0,0.3);
          font-family: -apple-system, 'PingFang SC', sans-serif;
        }
        #__dc_block_popover {
          position: fixed;
          z-index: 2147483641;
          background: #1A1D23;
          border: 1px solid rgba(201,169,97,0.35);
          border-radius: 10px;
          padding: 16px 18px 14px;
          box-shadow: 0 12px 40px rgba(0,0,0,0.5);
          font-family: -apple-system, 'PingFang SC', sans-serif;
          color: #E5E7EB;
          min-width: 320px;
          animation: __dc_popIn 0.16s ease-out;
        }
        #__dc_block_popover .__dc_bp_head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          padding-bottom: 10px;
          border-bottom: 1px dashed rgba(201,169,97,0.2);
        }
        #__dc_block_popover .__dc_bp_title {
          font-size: 12px;
          font-weight: 700;
          color: #C9A961;
          letter-spacing: 1px;
        }
        #__dc_block_popover .__dc_bp_selector {
          font-size: 10px;
          color: rgba(255,255,255,0.45);
          font-family: 'SF Mono', Menlo, monospace;
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        #__dc_block_popover .__dc_bp_close {
          background: transparent;
          color: rgba(255,255,255,0.6);
          border: none;
          cursor: pointer;
          font-size: 14px;
          padding: 2px 6px;
          border-radius: 4px;
        }
        #__dc_block_popover .__dc_bp_close:hover {
          background: rgba(255,255,255,0.08);
          color: #fff;
        }
        #__dc_block_popover .__dc_bp_row {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
        }
        #__dc_block_popover .__dc_bp_label {
          font-size: 11px;
          color: rgba(255,255,255,0.7);
          min-width: 52px;
          font-weight: 600;
        }
        #__dc_block_popover .__dc_bp_slider {
          flex: 1;
          -webkit-appearance: none;
          appearance: none;
          height: 4px;
          background: rgba(255,255,255,0.12);
          border-radius: 2px;
          outline: none;
          cursor: pointer;
        }
        #__dc_block_popover .__dc_bp_slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px; height: 14px;
          background: #C9A961;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(201,169,97,0.5);
        }
        #__dc_block_popover .__dc_bp_slider::-moz-range-thumb {
          width: 14px; height: 14px;
          background: #C9A961;
          border-radius: 50%;
          cursor: pointer;
          border: none;
        }
        #__dc_block_popover .__dc_bp_value {
          font-size: 12px;
          color: #C9A961;
          font-weight: 700;
          min-width: 46px;
          text-align: right;
          font-variant-numeric: tabular-nums;
        }
        #__dc_block_popover .__dc_bp_presets {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 6px;
          margin: 10px 0 8px;
        }
        #__dc_block_popover .__dc_bp_preset {
          background: rgba(255,255,255,0.05);
          color: rgba(255,255,255,0.75);
          border: 1px solid rgba(255,255,255,0.1);
          padding: 6px 4px;
          font-size: 11px;
          font-weight: 600;
          border-radius: 5px;
          cursor: pointer;
          transition: all 0.12s;
        }
        #__dc_block_popover .__dc_bp_preset:hover {
          background: rgba(201,169,97,0.15);
          border-color: rgba(201,169,97,0.4);
          color: #C9A961;
        }
        #__dc_block_popover .__dc_bp_preset.active {
          background: rgba(201,169,97,0.2);
          border-color: #C9A961;
          color: #C9A961;
        }
        #__dc_block_popover .__dc_bp_actions {
          display: flex;
          gap: 8px;
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px dashed rgba(255,255,255,0.08);
        }
        #__dc_block_popover .__dc_bp_btn {
          flex: 1;
          background: rgba(255,255,255,0.05);
          color: rgba(255,255,255,0.75);
          border: 1px solid rgba(255,255,255,0.12);
          padding: 7px 8px;
          font-size: 11px;
          font-weight: 600;
          border-radius: 5px;
          cursor: pointer;
          transition: all 0.12s;
        }
        #__dc_block_popover .__dc_bp_btn:hover {
          background: rgba(201,169,97,0.12);
          border-color: rgba(201,169,97,0.35);
          color: #C9A961;
        }
        #__dc_block_popover .__dc_bp_btn.primary {
          background: linear-gradient(135deg, rgba(201,169,97,0.2), rgba(201,169,97,0.08));
          border-color: rgba(201,169,97,0.5);
          color: #C9A961;
        }
        #__dc_block_popover .__dc_bp_tip {
          font-size: 10px;
          color: rgba(255,255,255,0.35);
          margin-top: 8px;
          text-align: center;
          line-height: 1.5;
        }
        #__dc_block_popover .__dc_bp_tip kbd {
          background: rgba(255,255,255,0.1);
          padding: 1px 5px;
          border-radius: 3px;
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 9.5px;
          color: rgba(255,255,255,0.7);
        }
        /* 规范节奏预览对话框 */
        #__dc_rhythm_modal {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          z-index: 2147483646;
          background: rgba(10,15,26,0.75);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          animation: __dc_popIn 0.18s;
          font-family: -apple-system, 'PingFang SC', sans-serif;
        }
        #__dc_rhythm_modal .__dc_rhythm_box {
          background: #1A1D23;
          border: 1px solid rgba(201,169,97,0.4);
          border-radius: 14px;
          padding: 24px 28px;
          width: 560px;
          max-height: 80vh;
          overflow: auto;
          color: #E5E7EB;
          box-shadow: 0 24px 60px rgba(0,0,0,0.6);
        }
        #__dc_rhythm_modal h3 {
          font-size: 18px;
          margin: 0 0 6px;
          color: #C9A961;
          font-weight: 900;
        }
        #__dc_rhythm_modal .__dc_rhythm_sub {
          font-size: 12px;
          color: rgba(255,255,255,0.55);
          margin-bottom: 16px;
          line-height: 1.5;
        }
        #__dc_rhythm_modal .__dc_rhythm_stats {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          padding: 12px 14px;
          margin-bottom: 14px;
          font-size: 12px;
          line-height: 1.8;
        }
        #__dc_rhythm_modal .__dc_rhythm_stats .hl {
          color: #C9A961;
          font-weight: 700;
        }
        #__dc_rhythm_modal .__dc_rhythm_diff {
          background: rgba(0,0,0,0.25);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          padding: 10px 12px;
          font-family: 'SF Mono', Menlo, monospace;
          font-size: 11px;
          line-height: 1.7;
          max-height: 260px;
          overflow: auto;
          margin-bottom: 16px;
        }
        #__dc_rhythm_modal .__dc_rhythm_row {
          display: flex;
          gap: 10px;
          padding: 2px 0;
          color: rgba(255,255,255,0.75);
        }
        #__dc_rhythm_modal .__dc_rhythm_row .tag {
          color: rgba(255,255,255,0.4);
          min-width: 70px;
        }
        #__dc_rhythm_modal .__dc_rhythm_row .from { color: rgba(252,165,165,0.85); min-width: 50px; text-align: right;}
        #__dc_rhythm_modal .__dc_rhythm_row .arrow { color: rgba(255,255,255,0.4); }
        #__dc_rhythm_modal .__dc_rhythm_row .to { color: rgba(110,231,183,0.95); font-weight: 700; min-width: 50px;}
        #__dc_rhythm_modal .__dc_rhythm_actions {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
        }
        #__dc_rhythm_modal .__dc_rhythm_btn {
          background: rgba(255,255,255,0.06);
          color: rgba(255,255,255,0.75);
          border: 1px solid rgba(255,255,255,0.14);
          padding: 8px 18px;
          font-size: 13px;
          font-weight: 600;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.12s;
        }
        #__dc_rhythm_modal .__dc_rhythm_btn:hover { border-color: rgba(201,169,97,0.5); color: #C9A961;}
        #__dc_rhythm_modal .__dc_rhythm_btn.primary {
          background: linear-gradient(135deg, #C9A961, #D4A85A);
          color: #111;
          border-color: #C9A961;
        }
        #__dc_rhythm_modal .__dc_rhythm_btn.primary:hover {
          box-shadow: 0 4px 16px rgba(201,169,97,0.4);
        }
      `;
      document.head.appendChild(s);
    }

    function findBlockAncestor(el) {
      while (el && el !== document.body && el !== document.documentElement) {
        if (el.nodeType === 1 && BLOCK_TAGS.has(el.tagName) && el.offsetHeight > 0) {
          return el;
        }
        el = el.parentElement;
      }
      return null;
    }

    /** 可读的 selector（给用户看，不是真用来查询） */
    function describeElement(el) {
      if (!el) return "";
      let s = el.tagName.toLowerCase();
      if (el.id) s += "#" + el.id;
      if (el.className && typeof el.className === "string") {
        const cls = el.className.split(/\s+/).filter(c => c && !c.startsWith("__dc_")).slice(0, 2);
        if (cls.length) s += "." + cls.join(".");
      }
      return s;
    }

    /** 读取元素当前实际 margin（优先 inline，回退计算样式） */
    function readMargin(el, which) {
      const inline = el.style[which === "top" ? "marginTop" : "marginBottom"];
      if (inline) return parseInt(inline, 10) || 0;
      const computed = getComputedStyle(el)[which === "top" ? "marginTop" : "marginBottom"];
      return parseInt(computed, 10) || 0;
    }

    function applyMargin(el, which, px) {
      if (!el) return;
      const prop = which === "top" ? "marginTop" : "marginBottom";
      if (px === null || px === undefined) {
        el.style[prop] = "";
      } else {
        el.style[prop] = px + "px";
      }
      updateIndicators();
    }

    function updateIndicators() {
      if (!selectedBlock) return;
      const rect = selectedBlock.getBoundingClientRect();
      const mt = readMargin(selectedBlock, "top");
      const mb = readMargin(selectedBlock, "bottom");
      if (!indicatorTop) {
        indicatorTop = document.createElement("div");
        indicatorTop.className = "__dc_spacing_indicator";
        document.body.appendChild(indicatorTop);
      }
      if (!indicatorBottom) {
        indicatorBottom = document.createElement("div");
        indicatorBottom.className = "__dc_spacing_indicator";
        document.body.appendChild(indicatorBottom);
      }
      indicatorTop.style.left = (rect.left + window.scrollX) + "px";
      indicatorTop.style.top = (rect.top + window.scrollY - mt) + "px";
      indicatorTop.style.width = rect.width + "px";
      indicatorTop.style.height = Math.max(mt, 0) + "px";
      indicatorTop.textContent = mt > 14 ? `↑ ${mt}px` : "";
      indicatorTop.style.display = mt > 0 ? "flex" : "none";

      indicatorBottom.style.left = (rect.left + window.scrollX) + "px";
      indicatorBottom.style.top = (rect.bottom + window.scrollY) + "px";
      indicatorBottom.style.width = rect.width + "px";
      indicatorBottom.style.height = Math.max(mb, 0) + "px";
      indicatorBottom.textContent = mb > 14 ? `↓ ${mb}px` : "";
      indicatorBottom.style.display = mb > 0 ? "flex" : "none";
    }

    function removeIndicators() {
      if (indicatorTop) { indicatorTop.remove(); indicatorTop = null; }
      if (indicatorBottom) { indicatorBottom.remove(); indicatorBottom = null; }
    }

    function buildPopover() {
      const pop = document.createElement("div");
      pop.id = "__dc_block_popover";
      pop.innerHTML = `
        <div class="__dc_bp_head">
          <div>
            <div class="__dc_bp_title">📐 块间距</div>
            <div class="__dc_bp_selector" id="__dc_bp_sel"></div>
          </div>
          <button class="__dc_bp_close" id="__dc_bp_close">✕</button>
        </div>
        <div class="__dc_bp_row">
          <span class="__dc_bp_label">上边距</span>
          <input type="range" class="__dc_bp_slider" id="__dc_bp_mt" min="0" max="120" step="4" value="0">
          <span class="__dc_bp_value" id="__dc_bp_mt_val">0px</span>
        </div>
        <div class="__dc_bp_row">
          <span class="__dc_bp_label">下边距</span>
          <input type="range" class="__dc_bp_slider" id="__dc_bp_mb" min="0" max="120" step="4" value="0">
          <span class="__dc_bp_value" id="__dc_bp_mb_val">0px</span>
        </div>
        <div class="__dc_bp_presets">
          <button class="__dc_bp_preset" data-mt="8" data-mb="8">紧凑<br><span style="font-size:9px;opacity:0.6">8/8</span></button>
          <button class="__dc_bp_preset" data-mt="16" data-mb="16">默认<br><span style="font-size:9px;opacity:0.6">16/16</span></button>
          <button class="__dc_bp_preset" data-mt="40" data-mb="40">宽松<br><span style="font-size:9px;opacity:0.6">40/40</span></button>
          <button class="__dc_bp_preset" data-mt="80" data-mb="80">极宽<br><span style="font-size:9px;opacity:0.6">80/80</span></button>
        </div>
        <div class="__dc_bp_actions">
          <button class="__dc_bp_btn" id="__dc_bp_reset">↺ 恢复原始</button>
          <button class="__dc_bp_btn primary" id="__dc_bp_rhythm">🪄 规范全文节奏</button>
        </div>
        <div class="__dc_bp_tip">
          <kbd>↑</kbd> <kbd>↓</kbd> 上边距 ±4 · <kbd>←</kbd> <kbd>→</kbd> 下边距 ±4 · <kbd>Esc</kbd> 退出
        </div>
      `;
      document.body.appendChild(pop);

      // 事件绑定
      const mt = pop.querySelector("#__dc_bp_mt");
      const mb = pop.querySelector("#__dc_bp_mb");
      const mtVal = pop.querySelector("#__dc_bp_mt_val");
      const mbVal = pop.querySelector("#__dc_bp_mb_val");

      mt.addEventListener("input", (e) => {
        const v = parseInt(e.target.value, 10);
        applyMargin(selectedBlock, "top", v);
        mtVal.textContent = v + "px";
        markDirty();
        refreshPresetActive();
      });
      mb.addEventListener("input", (e) => {
        const v = parseInt(e.target.value, 10);
        applyMargin(selectedBlock, "bottom", v);
        mbVal.textContent = v + "px";
        markDirty();
        refreshPresetActive();
      });

      pop.querySelectorAll(".__dc_bp_preset").forEach(btn => {
        btn.addEventListener("mousedown", e => e.preventDefault());
        btn.addEventListener("click", () => {
          const mtv = parseInt(btn.dataset.mt, 10);
          const mbv = parseInt(btn.dataset.mb, 10);
          applyMargin(selectedBlock, "top", mtv);
          applyMargin(selectedBlock, "bottom", mbv);
          syncSlidersFromBlock();
          markDirty();
          refreshPresetActive();
        });
      });

      pop.querySelector("#__dc_bp_close").addEventListener("click", deselectBlock);
      pop.querySelector("#__dc_bp_reset").addEventListener("click", () => {
        if (!selectedBlock) return;
        selectedBlock.style.removeProperty("margin-top");
        selectedBlock.style.removeProperty("margin-bottom");
        syncSlidersFromBlock();
        updateIndicators();
        markDirty();
        toast("已恢复原 CSS 间距");
      });
      pop.querySelector("#__dc_bp_rhythm").addEventListener("click", openRhythmModal);

      return pop;
    }

    function refreshPresetActive() {
      if (!popover || !selectedBlock) return;
      const mt = readMargin(selectedBlock, "top");
      const mb = readMargin(selectedBlock, "bottom");
      popover.querySelectorAll(".__dc_bp_preset").forEach(btn => {
        const matched = parseInt(btn.dataset.mt, 10) === mt && parseInt(btn.dataset.mb, 10) === mb;
        btn.classList.toggle("active", matched);
      });
    }

    function syncSlidersFromBlock() {
      if (!popover || !selectedBlock) return;
      const mt = Math.min(120, readMargin(selectedBlock, "top"));
      const mb = Math.min(120, readMargin(selectedBlock, "bottom"));
      popover.querySelector("#__dc_bp_mt").value = mt;
      popover.querySelector("#__dc_bp_mb").value = mb;
      popover.querySelector("#__dc_bp_mt_val").textContent = mt + "px";
      popover.querySelector("#__dc_bp_mb_val").textContent = mb + "px";
    }

    function positionPopover() {
      if (!popover || !selectedBlock) return;
      const rect = selectedBlock.getBoundingClientRect();
      const popW = popover.offsetWidth;
      const popH = popover.offsetHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      // 优先右上角
      let left = rect.right - popW;
      let top = rect.top - popH - 10;
      // 越界兜底
      if (top < 10) top = rect.bottom + 10;
      if (top + popH > vh - 10) top = vh - popH - 10;
      if (left < 10) left = 10;
      if (left + popW > vw - 10) left = vw - popW - 10;
      popover.style.left = left + "px";
      popover.style.top = top + "px";
    }

    function selectBlock(el) {
      deselectBlock();
      if (!el) return;
      selectedBlock = el;
      el.classList.add("__dc_block_selected");
      if (!popover) popover = buildPopover();
      popover.style.display = "block";
      popover.querySelector("#__dc_bp_sel").textContent = describeElement(el);
      syncSlidersFromBlock();
      refreshPresetActive();
      positionPopover();
      updateIndicators();
    }

    function deselectBlock() {
      if (selectedBlock) {
        selectedBlock.classList.remove("__dc_block_selected");
        selectedBlock = null;
      }
      if (popover) popover.style.display = "none";
      removeIndicators();
    }

    // ─── 🪄 规范节奏引擎 ───────────────────────────────────────────────────
    /**
     * 扫描可见块元素，按标签/角色分档，给出规范化建议。
     * 节奏律（4:8 间距律）：
     *   H1/H2        → 上下各 64/32
     *   H3/H4        → 上下各 32/16
     *   section/article → 上 48, 下 24
     *   p/li         → 上下 0/12（依赖容器间距）
     *   table/figure → 上下 24/24
     *   hr           → 上下 32/32
     */
    const RHYTHM_RULES = [
      { match: el => /^H[12]$/.test(el.tagName), label: "一级标题", mt: 64, mb: 32 },
      { match: el => /^H[34]$/.test(el.tagName), label: "二级标题", mt: 32, mb: 16 },
      { match: el => /^H[56]$/.test(el.tagName), label: "小标题", mt: 24, mb: 12 },
      { match: el => el.tagName === "SECTION" || el.tagName === "ARTICLE",
        label: "章节", mt: 48, mb: 24 },
      { match: el => el.tagName === "HR", label: "分隔线", mt: 32, mb: 32 },
      { match: el => el.tagName === "TABLE" || el.tagName === "FIGURE",
        label: "表格/图表", mt: 24, mb: 24 },
      { match: el => el.tagName === "BLOCKQUOTE" || el.tagName === "PRE",
        label: "引用/代码", mt: 20, mb: 20 },
      { match: el => el.tagName === "P", label: "段落", mt: 0, mb: 16 },
      { match: el => el.tagName === "UL" || el.tagName === "OL",
        label: "列表", mt: 12, mb: 16 },
    ];

    function analyzeRhythm() {
      const all = document.body.querySelectorAll(
        "section, article, header, footer, h1, h2, h3, h4, h5, h6, p, ul, ol, table, figure, blockquote, pre, hr"
      );
      const plan = [];
      all.forEach(el => {
        // 跳过不可见 / 我们自己的注入
        if (!el.offsetHeight && !el.offsetWidth) return;
        if (el.id && el.id.startsWith("__dc_")) return;
        if (el.closest("#__dc_toolbar, #__dc_block_popover, #__dc_rhythm_modal")) return;
        if (el.closest(".__dc_spacing_indicator")) return;
        const rule = RHYTHM_RULES.find(r => r.match(el));
        if (!rule) return;
        const curMt = readMargin(el, "top");
        const curMb = readMargin(el, "bottom");
        if (curMt === rule.mt && curMb === rule.mb) return; // 已规范
        plan.push({
          el,
          label: rule.label,
          selector: describeElement(el),
          fromMt: curMt,
          fromMb: curMb,
          toMt: rule.mt,
          toMb: rule.mb,
        });
      });
      return plan;
    }

    function openRhythmModal() {
      const plan = analyzeRhythm();
      closeRhythmModal();

      const modal = document.createElement("div");
      modal.id = "__dc_rhythm_modal";

      const diffRows = plan.slice(0, 80).map(item => `
        <div class="__dc_rhythm_row">
          <span class="tag">${escapeHtml(item.label)}</span>
          <span style="flex:1;opacity:0.55;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(item.selector)}</span>
          <span class="from">${item.fromMt}/${item.fromMb}</span>
          <span class="arrow">→</span>
          <span class="to">${item.toMt}/${item.toMb}</span>
        </div>
      `).join("") || '<div style="padding:16px;text-align:center;color:rgba(255,255,255,0.5);font-size:12px">✨ 已经很规范了，无需调整</div>';

      const more = plan.length > 80 ? `<div style="padding:6px 0;text-align:center;color:rgba(255,255,255,0.4);font-size:10px">...另有 ${plan.length - 80} 条未列出</div>` : "";

      modal.innerHTML = `
        <div class="__dc_rhythm_box">
          <h3>🪄 规范全文节奏</h3>
          <div class="__dc_rhythm_sub">
            按 4:8 间距律（Design System）自动归一化所有块元素的上下边距。<br>
            规则：H1/H2 = 64/32 · H3/H4 = 32/16 · section = 48/24 · p = 0/16 · table = 24/24
          </div>
          <div class="__dc_rhythm_stats">
            扫描到 <span class="hl">${plan.length}</span> 处需规范的间距
            · 标签分布：<span class="hl">${plan.filter(p => /标题/.test(p.label)).length}</span> 标题
            · <span class="hl">${plan.filter(p => p.label === "段落").length}</span> 段落
            · <span class="hl">${plan.filter(p => p.label === "章节").length}</span> 章节
          </div>
          <div class="__dc_rhythm_diff">${diffRows}${more}</div>
          <div class="__dc_rhythm_actions">
            <button class="__dc_rhythm_btn" id="__dc_rhythm_cancel">取消</button>
            <button class="__dc_rhythm_btn primary" id="__dc_rhythm_apply" ${plan.length === 0 ? "disabled" : ""}>
              ${plan.length === 0 ? "无需应用" : `✓ 应用到 ${plan.length} 处`}
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      modal.querySelector("#__dc_rhythm_cancel").addEventListener("click", closeRhythmModal);
      modal.querySelector("#__dc_rhythm_apply").addEventListener("click", () => {
        plan.forEach(item => {
          item.el.style.marginTop = item.toMt + "px";
          item.el.style.marginBottom = item.toMb + "px";
        });
        markDirty();
        closeRhythmModal();
        toast(`✨ 已规范 ${plan.length} 处间距`);
        if (selectedBlock) {
          syncSlidersFromBlock();
          updateIndicators();
        }
      });
      modal.addEventListener("click", e => {
        if (e.target === modal) closeRhythmModal();
      });
    }

    function closeRhythmModal() {
      const m = document.getElementById("__dc_rhythm_modal");
      if (m) m.remove();
    }

    function escapeHtml(s) {
      return (s || "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
    }

    // ─── 事件处理 ───────────────────────────────────────────────────────────
    function onClick(e) {
      // 仅在 ⌥/Alt + 普通点击时触发
      if (!e.altKey) return;
      // 忽略工具栏/浮窗/弹窗内部点击
      if (e.target.closest(
        "#__dc_toolbar, #__dc_block_popover, #__dc_img_popover, #__dc_color_palette, #__dc_rhythm_modal, .__dc_anno_pop, .__dc_spacing_indicator"
      )) return;
      if (!isEditableContext(e.target)) return;
      const block = findBlockAncestor(e.target);
      if (!block) return;
      e.preventDefault();
      e.stopPropagation();
      selectBlock(block);
    }

    function onKeyDown(e) {
      if (!selectedBlock) return;
      if (e.key === "Escape") {
        e.preventDefault();
        deselectBlock();
        return;
      }
      // 方向键微调（忽略输入框内的按键）
      const tgt = e.target;
      if (tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA")) return;
      let handled = false;
      if (e.key === "ArrowUp") {
        const v = Math.min(120, readMargin(selectedBlock, "top") + 4);
        applyMargin(selectedBlock, "top", v);
        handled = true;
      } else if (e.key === "ArrowDown") {
        const v = Math.max(0, readMargin(selectedBlock, "top") - 4);
        applyMargin(selectedBlock, "top", v);
        handled = true;
      } else if (e.key === "ArrowRight") {
        const v = Math.min(120, readMargin(selectedBlock, "bottom") + 4);
        applyMargin(selectedBlock, "bottom", v);
        handled = true;
      } else if (e.key === "ArrowLeft") {
        const v = Math.max(0, readMargin(selectedBlock, "bottom") - 4);
        applyMargin(selectedBlock, "bottom", v);
        handled = true;
      }
      if (handled) {
        e.preventDefault();
        syncSlidersFromBlock();
        refreshPresetActive();
        markDirty();
      }
    }

    /** 工具栏的 📐 按钮兜底入口（给鼠标用户） */
    function enterBlockModeHint() {
      toast("按住 ⌥ 再点击要调整的块");
    }

    function init() {
      injectStyles();
      document.addEventListener("click", onClick, true);
      document.addEventListener("keydown", onKeyDown, true);
      // 滚动/缩放时重新定位
      document.addEventListener("scroll", () => {
        if (selectedBlock) {
          positionPopover();
          updateIndicators();
        }
      }, true);
      window.addEventListener("resize", () => {
        if (selectedBlock) {
          positionPopover();
          updateIndicators();
        }
      });
      console.log("[saver] BlockSpacingEditor v1.9.0 ready");
    }

    return { init, enterBlockModeHint, deselect: deselectBlock };
  })();

  // ═══════════════════════════════════════════════════════════════════════════
  // v1.11.4: 元素位置微调（ElementPositioner）
  //   - Cmd/Ctrl + 长按 300ms 任意元素 → 浮窗（方向键/按钮/数字输入调 transform）
  //   - 方向键 ±1px，Shift+方向 ±10px
  //   - 用 transform: translate(X, Y) 不改 margin/padding，不破坏布局流
  //   - 兼容已有 transform（保留 rotate/scale 等其他变换）
  //   - 架构参考 BlockSpacingEditor IIFE
  // ═══════════════════════════════════════════════════════════════════════════
  const ElementPositioner = (function () {
    let selectedEl = null;
    let popover = null;
    let pressTimer = null;

    // 解析现有 transform：拿出 translate 部分，保留其他
    function parseTransform(el) {
      const t = (el.style.transform || "").trim();
      let tx = 0, ty = 0;
      let others = [];
      if (!t) return { tx, ty, others: [] };
      // 简单正则匹配各 transform 函数
      const re = /(\w+)\(([^)]+)\)/g;
      let m;
      while ((m = re.exec(t)) !== null) {
        const fn = m[1].toLowerCase();
        const args = m[2].trim();
        if (fn === "translate") {
          // translate(Xpx, Ypx) 或 translate(Xpx)
          const parts = args.split(/[\s,]+/);
          tx = parseFloat(parts[0]) || 0;
          ty = parts.length > 1 ? (parseFloat(parts[1]) || 0) : 0;
        } else if (fn === "translatex") {
          tx = parseFloat(args) || 0;
        } else if (fn === "translatey") {
          ty = parseFloat(args) || 0;
        } else {
          others.push(m[0]);
        }
      }
      return { tx, ty, others };
    }

    function applyTransform(el, tx, ty, others) {
      const parts = others.slice();
      if (tx !== 0 || ty !== 0) {
        parts.unshift(`translate(${Math.round(tx)}px, ${Math.round(ty)}px)`);
      }
      el.style.transform = parts.join(" ").trim();
      if (!el.style.transform) el.removeAttribute("style"); // 完全空的话清掉 style
      else if (el.getAttribute("style") && el.getAttribute("style").trim() === "transform: ;") {
        el.removeAttribute("style");
      }
    }

    function injectStyles() {
      if (document.getElementById("__dc_pos_styles")) return;
      const s = document.createElement("style");
      s.id = "__dc_pos_styles";
      s.textContent = `
        .__dc_pos_selected {
          outline: 2px dashed #3B82F6 !important;
          outline-offset: 3px !important;
          position: relative;
        }
        #__dc_pos_popover {
          position: fixed;
          z-index: 2147483641;
          background: linear-gradient(135deg, #1E3A8A, #1E40AF);
          color: #fff;
          padding: 12px;
          border-radius: 10px;
          border: 1px solid rgba(96,165,250,0.4);
          box-shadow: 0 12px 32px rgba(0,0,0,0.5);
          font: 12px -apple-system, "PingFang SC", sans-serif;
          width: 280px;
          animation: __dc_pos_popin .15s ease-out;
        }
        @keyframes __dc_pos_popin { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:none} }
        #__dc_pos_popover .__dc_pos_head {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 10px; padding-bottom: 8px;
          border-bottom: 1px solid rgba(255,255,255,0.12);
        }
        #__dc_pos_popover .__dc_pos_title {
          font-weight: 600; font-size: 13px;
        }
        #__dc_pos_popover .__dc_pos_target {
          color: #93C5FD; font-family: "SF Mono", Menlo, monospace;
          font-size: 10.5px; margin-top: 2px;
        }
        #__dc_pos_popover .__dc_pos_close {
          background: transparent; border: 0; color: #fff;
          font-size: 16px; cursor: pointer; padding: 2px 6px;
          opacity: 0.7;
        }
        #__dc_pos_popover .__dc_pos_close:hover { opacity: 1; }
        #__dc_pos_popover .__dc_pos_dpad {
          display: grid; grid-template-columns: repeat(3, 1fr);
          gap: 4px; margin-bottom: 10px;
        }
        #__dc_pos_popover .__dc_pos_dpad button {
          background: rgba(255,255,255,0.08);
          color: #E5E7EB; border: 1px solid rgba(255,255,255,0.12);
          border-radius: 6px; padding: 8px; cursor: pointer;
          font-size: 14px; transition: all 0.1s;
        }
        #__dc_pos_popover .__dc_pos_dpad button:hover {
          background: rgba(96,165,250,0.25); border-color: #60A5FA;
        }
        #__dc_pos_popover .__dc_pos_dpad button:disabled {
          opacity: 0.3; cursor: default;
        }
        #__dc_pos_popover .__dc_pos_inputs {
          display: flex; gap: 8px; margin-bottom: 10px;
        }
        #__dc_pos_popover .__dc_pos_inputs label {
          flex: 1; display: flex; align-items: center; gap: 6px;
        }
        #__dc_pos_popover .__dc_pos_inputs span {
          color: #93C5FD; font-weight: 600; font-size: 11px;
        }
        #__dc_pos_popover .__dc_pos_inputs input {
          flex: 1; min-width: 0;
          background: rgba(0,0,0,0.25); color: #fff;
          border: 1px solid rgba(255,255,255,0.14);
          border-radius: 4px; padding: 4px 6px;
          font-size: 12px; font-family: "SF Mono", Menlo, monospace;
        }
        #__dc_pos_popover .__dc_pos_actions {
          display: flex; gap: 8px;
        }
        #__dc_pos_popover .__dc_pos_actions button {
          flex: 1; padding: 6px;
          background: rgba(255,255,255,0.08); color: #E5E7EB;
          border: 1px solid rgba(255,255,255,0.14);
          border-radius: 4px; cursor: pointer; font-size: 11.5px;
          transition: all 0.1s;
        }
        #__dc_pos_popover .__dc_pos_actions button:hover {
          background: rgba(255,255,255,0.18); border-color: #93C5FD;
        }
        #__dc_pos_popover .__dc_pos_hint {
          margin-top: 8px; padding-top: 8px;
          border-top: 1px solid rgba(255,255,255,0.1);
          color: #93C5FD; font-size: 10.5px; line-height: 1.5;
        }
        #__dc_pos_popover .__dc_pos_hint kbd {
          background: rgba(255,255,255,0.12); padding: 1px 5px;
          border-radius: 3px; font-size: 10px;
          font-family: "SF Mono", Menlo, monospace;
        }
      `;
      document.head.appendChild(s);
    }

    function selectElement(el) {
      deselectElement();
      selectedEl = el;
      el.classList.add("__dc_pos_selected");
      renderPopover(el);
    }

    function deselectElement() {
      if (selectedEl) selectedEl.classList.remove("__dc_pos_selected");
      selectedEl = null;
      if (popover) { popover.remove(); popover = null; }
    }

    function describeEl(el) {
      const tag = el.tagName.toLowerCase();
      const id = el.id ? `#${el.id}` : "";
      const cls = el.className && typeof el.className === "string"
        ? "." + el.className.split(/\s+/).filter(c => c && !c.startsWith("__dc_")).slice(0, 2).join(".")
        : "";
      let s = tag + id + cls;
      if (s.length > 40) s = s.slice(0, 38) + "…";
      return s;
    }

    function renderPopover(el) {
      if (popover) popover.remove();
      const { tx, ty, others } = parseTransform(el);

      popover = document.createElement("div");
      popover.id = "__dc_pos_popover";
      // 右上角悬浮（避开元素本体）
      popover.style.top = "70px";
      popover.style.right = "16px";
      popover.innerHTML = `
        <div class="__dc_pos_head">
          <div>
            <div class="__dc_pos_title">📐 位置微调</div>
            <div class="__dc_pos_target">${describeEl(el)}</div>
          </div>
          <button class="__dc_pos_close" title="关闭 (Esc)">✕</button>
        </div>
        <div class="__dc_pos_dpad">
          <button disabled></button>
          <button data-dir="up" title="上移 (↑ / Shift+↑ 大档位)">↑</button>
          <button disabled></button>
          <button data-dir="left" title="左移">←</button>
          <button data-dir="reset" title="重置位置 (R)">⌖</button>
          <button data-dir="right" title="右移">→</button>
          <button disabled></button>
          <button data-dir="down" title="下移">↓</button>
          <button disabled></button>
        </div>
        <div class="__dc_pos_inputs">
          <label><span>X</span><input type="number" id="__dc_pos_x" value="${tx}" step="1"></label>
          <label><span>Y</span><input type="number" id="__dc_pos_y" value="${ty}" step="1"></label>
        </div>
        <div class="__dc_pos_actions">
          <button id="__dc_pos_apply">应用 X/Y</button>
          <button id="__dc_pos_clear">🗑 清除位置偏移</button>
        </div>
        <div class="__dc_pos_hint">
          <kbd>↑↓←→</kbd> 1px · <kbd>Shift+方向</kbd> 10px · <kbd>R</kbd> 重置 · <kbd>Esc</kbd> 退出
        </div>
      `;
      document.body.appendChild(popover);

      // 方向键盘按钮
      popover.querySelector(".__dc_pos_dpad").addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-dir]");
        if (!btn) return;
        e.stopPropagation();
        const dir = btn.dataset.dir;
        nudge(dir, false);
      });

      // X/Y 输入
      const xIn = popover.querySelector("#__dc_pos_x");
      const yIn = popover.querySelector("#__dc_pos_y");
      function applyFromInputs() {
        const x = parseFloat(xIn.value) || 0;
        const y = parseFloat(yIn.value) || 0;
        const cur = parseTransform(el);
        applyTransform(el, x, y, cur.others);
        try { markDirty && markDirty(); } catch (_) {}
      }
      xIn.addEventListener("change", applyFromInputs);
      yIn.addEventListener("change", applyFromInputs);
      popover.querySelector("#__dc_pos_apply").addEventListener("click", applyFromInputs);

      // 清除
      popover.querySelector("#__dc_pos_clear").addEventListener("click", () => {
        const cur = parseTransform(el);
        applyTransform(el, 0, 0, cur.others);
        xIn.value = "0";
        yIn.value = "0";
        try { markDirty && markDirty(); } catch (_) {}
      });

      // 关闭
      popover.querySelector(".__dc_pos_close").addEventListener("click", () => {
        deselectElement();
      });
    }

    function nudge(dir, big) {
      if (!selectedEl) return;
      const step = big ? 10 : 1;
      const cur = parseTransform(selectedEl);
      let { tx, ty, others } = cur;
      if (dir === "up") ty -= step;
      else if (dir === "down") ty += step;
      else if (dir === "left") tx -= step;
      else if (dir === "right") tx += step;
      else if (dir === "reset") { tx = 0; ty = 0; }
      applyTransform(selectedEl, tx, ty, others);
      // 同步刷新 input 值
      const xIn = document.getElementById("__dc_pos_x");
      const yIn = document.getElementById("__dc_pos_y");
      if (xIn) xIn.value = tx;
      if (yIn) yIn.value = ty;
      try { markDirty && markDirty(); } catch (_) {}
    }

    function isInsideEditable(el) {
      if (!el || el.nodeType !== 1) return false;
      // 在工具栏/浮窗内不触发
      if (el.closest && el.closest("#__dc_toolbar, #__dc_pos_popover, #__dc_block_popover, #__dc_img_popover, #__dc_color_palette")) return false;
      let cur = el;
      while (cur && cur !== document) {
        if (cur.isContentEditable) return true;
        cur = cur.parentNode;
      }
      return false;
    }

    function init() {
      injectStyles();
      // Cmd/Ctrl + 长按 300ms 触发选中
      document.addEventListener("mousedown", (e) => {
        if (!e.metaKey && !e.ctrlKey) return;
        if (!isInsideEditable(e.target)) return;
        const target = e.target;
        if (target === selectedEl) return;
        clearTimeout(pressTimer);
        pressTimer = setTimeout(() => {
          selectElement(target);
        }, 300);
      }, true);
      document.addEventListener("mouseup", () => {
        clearTimeout(pressTimer);
        pressTimer = null;
      }, true);
      document.addEventListener("mousemove", (e) => {
        // 拖动期间取消长按
        if (pressTimer && (Math.abs(e.movementX) > 2 || Math.abs(e.movementY) > 2)) {
          clearTimeout(pressTimer);
          pressTimer = null;
        }
      }, true);

      // 键盘控制
      document.addEventListener("keydown", (e) => {
        if (!selectedEl) return;
        // 在 popover input 内打数字时不拦截方向键
        if (e.target && e.target.matches && e.target.matches('input,textarea,[contenteditable="true"]')) return;
        const big = e.shiftKey;
        if (e.key === "ArrowUp")    { e.preventDefault(); nudge("up", big); }
        else if (e.key === "ArrowDown")  { e.preventDefault(); nudge("down", big); }
        else if (e.key === "ArrowLeft")  { e.preventDefault(); nudge("left", big); }
        else if (e.key === "ArrowRight") { e.preventDefault(); nudge("right", big); }
        else if (e.key === "r" || e.key === "R") { e.preventDefault(); nudge("reset"); }
        else if (e.key === "Escape") { deselectElement(); }
      }, true);

      console.log("[saver] ElementPositioner v1.11.4 ready (Cmd+长按300ms 激活)");
    }

    return { init, deselect: deselectElement };
  })();

  // 简化 toast（只用于 ImageEditor 内部提示）
  function toast(msg) {
    let t = document.getElementById("__dc_toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "__dc_toast";
      t.style.cssText = `
        position: fixed; top: 56px; left: 50%; transform: translateX(-50%);
        z-index: 2147483645; padding: 10px 18px;
        background: #1A1D23; color: #fff; font-size: 13px;
        border-radius: 8px; border-left: 3px solid #C9A961;
        box-shadow: 0 6px 20px rgba(0,0,0,0.25);
        max-width: 80vw; text-align: center;
        pointer-events: none; opacity: 0; transition: opacity .2s;
      `;
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = "1";
    clearTimeout(t._hideT);
    t._hideT = setTimeout(() => { t.style.opacity = "0"; }, 2600);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Dirty 状态 & 快照
  // ───────────────────────────────────────────────────────────────────────────
  let isDirty = false;
  let debounceTimer = null;
  let lastSnapshotAt = 0;

  function setStatus(text, cls) {
    // v1.3: 同时更新两套状态元素（html 工具栏的 / md 壳子的），谁存在就更新谁
    const t1 = document.getElementById("__dc_status_text");
    const d1 = document.getElementById("__dc_dot");
    if (t1) t1.textContent = text;
    if (d1) d1.className = "dc-dot" + (cls ? " " + cls : "");
    const t2 = document.getElementById("md-status-text");
    const d2 = document.getElementById("md-dot");
    if (t2) t2.textContent = text;
    if (d2) d2.className = "md-dot" + (cls ? " " + cls : "");
  }

  function markDirty() {
    if (!isDirty) {
      isDirty = true;
      notifyParent("dirty_changed", { dirty: true });
    }
    setStatus("正在编辑…", "dirty");
    scheduleSnapshot();
  }

  function markClean() {
    isDirty = false;
    setStatus("已保存", "");
    notifyParent("dirty_changed", { dirty: false });
  }

  function scheduleSnapshot() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => doSnapshot(false), 2000);
  }

  function serializeContent() {
    // v1.3: 按 MODE 分流
    if (MODE === "md") {
      var input = document.getElementById("md-input");
      return input ? input.value : "";
    }
    // html 模式：克隆当前 document 并移除 DocCenter 自己注入的元素
    const clone = document.documentElement.cloneNode(true);
    clone.querySelectorAll("#__dc_toolbar").forEach(n => n.remove());
    // v1.8.0: 剔除图片编辑器浮窗、色板、toast
    clone.querySelectorAll("#__dc_img_popover, #__dc_color_palette, #__dc_toast").forEach(n => n.remove());
    // v1.11.3: 剔除图片 resize handle 和 dropzone（防止保存到源文件）
    clone.querySelectorAll(".__dc_img_handle, .__dc_img_dropzone_top, .__dc_img_dropzone_bottom").forEach(n => n.remove());
    // v1.11.4: 剔除位置编辑器浮窗 + 清掉 .__dc_pos_selected outline class
    clone.querySelectorAll("#__dc_pos_popover").forEach(n => n.remove());
    clone.querySelectorAll(".__dc_pos_selected").forEach(n => n.classList.remove("__dc_pos_selected"));
    // v1.9.0: 剔除块间距编辑器浮窗、节奏模态、间距指示条
    clone.querySelectorAll("#__dc_block_popover, #__dc_rhythm_modal").forEach(n => n.remove());
    clone.querySelectorAll(".__dc_spacing_indicator").forEach(n => n.remove());
    clone.querySelectorAll(".__dc_block_selected").forEach(n => n.classList.remove("__dc_block_selected"));
    // v1.8.0: 剔除图片选中高亮 class（不污染源文件）
    clone.querySelectorAll("img.__dc_img_selected").forEach(n => n.classList.remove("__dc_img_selected"));
    clone.querySelectorAll("img").forEach(n => {
      if (n.classList && n.classList.length === 0) n.removeAttribute("class");
    });
    // saver script 和上下文也不写回
    clone.querySelectorAll('script[src="/saver-runtime.js"]').forEach(n => n.remove());
    clone.querySelectorAll("script").forEach(n => {
      if ((n.textContent || "").includes("__DOC_CENTER__")) n.remove();
    });
    // v1.8.0: 剔除我们注入的动态 style（__dc_img_styles / __dc_popIn_kf / __dc_anno_styles）
    clone.querySelectorAll("style#__dc_img_styles, style#__dc_popIn_kf, style#__dc_anno_styles").forEach(n => n.remove());
    // v1.9.0: 剔除块间距编辑器动态 style
    clone.querySelectorAll("style#__dc_block_styles").forEach(n => n.remove());
    // v1.11.4: 剔除位置编辑器动态 style
    clone.querySelectorAll("style#__dc_pos_styles").forEach(n => n.remove());
    // v1.9.3 【根治 A 类污染】：保存时剥离 body 上 DocCenter 自己注入的 contenteditable 和 outline 样式
    //   - 防止源文件被永久打上 contenteditable="true"，导致下次打开被 detectExistingEditor 误判
    //   - 只清 body / body 上的 style，不动用户真正的 contenteditable（如果用户故意加的，那是特殊场景，后续用白名单处理）
    const cloneBody = clone.querySelector("body");
    if (cloneBody) {
      // 仅当 contenteditable 是我们注入的"true"值时剥除（保留用户自设的 false/inherit 等）
      if (cloneBody.getAttribute("contenteditable") === "true") {
        cloneBody.removeAttribute("contenteditable");
      }
      // 剥除我们注入的 outline:none（避免污染用户原 body style）
      const bstyle = cloneBody.getAttribute("style") || "";
      if (bstyle) {
        const cleaned = bstyle
          .split(";")
          .map(s => s.trim())
          .filter(s => s && !/^outline\s*:\s*none\b/i.test(s))
          .join("; ");
        if (cleaned) cloneBody.setAttribute("style", cleaned);
        else cloneBody.removeAttribute("style");
      }
    }
    // 兜底：彻底清理所有 __dc_ 开头的 class（防止遗漏）
    clone.querySelectorAll("[class]").forEach(n => {
      const cls = (n.getAttribute("class") || "").split(/\s+/).filter(c => c && !c.startsWith("__dc_"));
      if (cls.length === 0) n.removeAttribute("class");
      else n.setAttribute("class", cls.join(" "));
    });
    // 移除注入标记前后空行
    let html = "<!DOCTYPE html>\n" + clone.outerHTML;
    html = html.replace(/<!-- html-doc-center:saver-injected -->\s*/g, "");
    return html;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // v2.0: 导出自包含 HTML（所有资源内嵌，发给别人双击即看）
  // ───────────────────────────────────────────────────────────────────────────
  async function exportSelfContained() {
    setStatus("正在导出自包含HTML…", "dirty");
    toast("📦 正在打包资源…");

    // 1. clone document 并清理 DocCenter 注入元素（复用 serializeContent 逻辑）
    const clone = document.documentElement.cloneNode(true);
    clone.querySelectorAll(
      "#__dc_toolbar, #__dc_img_popover, #__dc_color_palette, #__dc_toast, #__dc_pos_popover, #__dc_block_popover, #__dc_rhythm_modal"
    ).forEach(n => n.remove());
    clone.querySelectorAll(
      ".__dc_img_handle, .__dc_img_dropzone_top, .__dc_img_dropzone_bottom, .__dc_spacing_indicator"
    ).forEach(n => n.remove());
    clone.querySelectorAll(".__dc_pos_selected").forEach(n => n.classList.remove("__dc_pos_selected"));
    clone.querySelectorAll(".__dc_block_selected").forEach(n => n.classList.remove("__dc_block_selected"));
    clone.querySelectorAll("img.__dc_img_selected").forEach(n => n.classList.remove("__dc_img_selected"));
    clone.querySelectorAll('script[src="/saver-runtime.js"]').forEach(n => n.remove());
    clone.querySelectorAll("script").forEach(n => {
      if ((n.textContent || "").includes("__DOC_CENTER__")) n.remove();
    });
    clone.querySelectorAll(
      "style#__dc_img_styles, style#__dc_popIn_kf, style#__dc_anno_styles, style#__dc_block_styles, style#__dc_pos_styles"
    ).forEach(n => n.remove());
    const cloneBody = clone.querySelector("body");
    if (cloneBody && cloneBody.getAttribute("contenteditable") === "true") {
      cloneBody.removeAttribute("contenteditable");
    }
    clone.querySelectorAll("[class]").forEach(n => {
      const cls = (n.getAttribute("class") || "").split(/\s+/).filter(c => c && !c.startsWith("__dc_"));
      if (cls.length === 0) n.removeAttribute("class");
      else n.setAttribute("class", cls.join(" "));
    });

    // 2. 内联化外部资源
    let inlined = 0, failed = 0;

    // 2a. <link rel="stylesheet"> → <style>
    const links = clone.querySelectorAll('link[rel="stylesheet"][href]');
    for (const link of links) {
      const href = link.getAttribute("href");
      if (/^data:/.test(href)) continue;
      try {
        const resp = await fetch(href);
        if (resp.ok) {
          const cssText = await resp.text();
          const style = document.createElement("style");
          style.textContent = cssText;
          link.replaceWith(style);
          inlined++;
        } else { failed++; }
      } catch (_) { failed++; }
    }

    // 2b. <script[src]> → 内联
    const scripts = clone.querySelectorAll('script[src]');
    for (const script of scripts) {
      const src = script.getAttribute("src");
      if (/^data:/.test(src)) continue;
      try {
        const resp = await fetch(src);
        if (resp.ok) {
          const jsText = await resp.text();
          const inline = document.createElement("script");
          inline.textContent = jsText;
          if (script.type) inline.type = script.type;
          if (script.defer) inline.defer = true;
          script.replaceWith(inline);
          inlined++;
        } else { failed++; }
      } catch (_) { failed++; }
    }

    // 2c. <img[src]> → base64
    const imgs = clone.querySelectorAll('img[src]');
    for (const img of imgs) {
      const src = img.getAttribute("src");
      if (/^data:/.test(src)) continue;
      try {
        const resp = await fetch(src);
        if (resp.ok) {
          const blob = await resp.blob();
          const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          img.setAttribute("src", dataUrl);
          inlined++;
        } else { failed++; }
      } catch (_) { failed++; }
    }

    // 3. 生成 HTML 字符串
    let html = "<!DOCTYPE html>\n" + clone.outerHTML;
    html = html.replace(/<!-- html-doc-center:saver-injected -->\s*/g, "");

    // 4. 下载
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const origName = (CTX.filePath || "document").split(/[\/\\]/).pop().replace(/\.\w+$/, "");
    const ts = new Date().toISOString().slice(0, 10);
    a.download = `${origName}-share-${ts}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setStatus("已保存", "");
    toast(`📦 已导出！内联 ${inlined} 个资源${failed > 0 ? `，${failed} 个跨域资源保留原链接` : ""}`);
  }

  async function doSnapshot(force) {
    const now = Date.now();
    if (!force && !isDirty) return;
    if (!force && now - lastSnapshotAt < 1500) return; // 节流
    lastSnapshotAt = now;

    try {
      const content = serializeContent();
      const resp = await fetch(SERVER + "/api/snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: FILE_PATH, content: content }),
      });
      const data = await resp.json();
      if (data.ok) {
        setStatus("草稿已缓存 " + new Date().toLocaleTimeString(), "dirty");
        notifyParent("snapshot_ok", { snapshotPath: data.snapshot_path });
      } else {
        setStatus("快照失败: " + (data.error || "unknown"), "dirty");
      }
    } catch (e) {
      console.warn("[saver] 快照失败", e);
      setStatus("快照失败（离线？）", "dirty");
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 监听编辑事件
  // ───────────────────────────────────────────────────────────────────────────
  // 用户最近一次真实交互的时间戳（keydown / mousedown / paste / cut）
  // 只有在"用户刚刚交互过"的时间窗内发生的 DOM 变更才算真编辑，
  // 用来排除：页面自带 JS 动画、滚动触发的 class 切换、CSS 过渡引起的属性变化等。
  let lastUserInteractAt = 0;
  const USER_INTERACT_WINDOW_MS = 800;

  function markUserInteract() { lastUserInteractAt = Date.now(); }
  function isWithinUserWindow() {
    return Date.now() - lastUserInteractAt < USER_INTERACT_WINDOW_MS;
  }

  function bindListeners() {
    // v1.3: md 模式只监听 textarea，不挂 MutationObserver（无 DOM 抖动问题）
    if (MODE === "md") {
      const input = document.getElementById("md-input");
      if (input) {
        input.addEventListener("input", function () { markDirty(); });
      }
      // 关闭前兜底一次
      window.addEventListener("beforeunload", function () {
        if (isDirty) doSnapshot(true);
      });
      return;
    }

    // ─── 以下为 html 模式原逻辑（0 改动）─────────────────────────────────────
    // 用户真实交互信号（捕获阶段，先于任何处理）
    const interactOpts = { capture: true, passive: true };
    document.addEventListener("keydown", markUserInteract, interactOpts);
    document.addEventListener("mousedown", markUserInteract, interactOpts);
    document.addEventListener("paste", markUserInteract, interactOpts);
    document.addEventListener("cut", markUserInteract, interactOpts);
    document.addEventListener("drop", markUserInteract, interactOpts);

    // v1.9.5: Enter 键行为修正
    //   背景：PPT 式 HTML 的页面容器常用 overflow:hidden + flex 居中 + 固定 min-height，
    //         浏览器默认 Enter 在这种 DOM 里插入 <div><br></div> 会被父容器样式吞掉或裁掉，
    //         用户感知为"按 Enter 没反应"。
    //   方案：主动拦截 Enter，在当前块内插入 <br>（insertLineBreak），行内换行而非块级新段。
    //   Shift+Enter / Cmd+Enter 保持浏览器默认（给有特殊需求的原生编辑器让路）。
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      if (e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.isComposing) return; // 中文输入法正在候选中

      // 只拦正文编辑。忽略 DocCenter UI 内的输入、表单元素、跳过非可编辑区域。
      const target = e.target;
      if (!target || target.nodeType !== 1) return;
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (target.closest && (
        target.closest("#__dc_toolbar") ||
        target.closest("#__dc_img_popover") ||
        target.closest("#__dc_block_popover") ||
        target.closest(".__dc_anno_pop")
      )) return;

      // 光标所在节点必须位于 contenteditable 区域内
      const sel = window.getSelection && window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const anchor = sel.anchorNode;
      const anchorEl = anchor && (anchor.nodeType === 1 ? anchor : anchor.parentElement);
      if (!anchorEl || !anchorEl.isContentEditable) return;

      // v1.9.5 关键补丁：光标在 SVG / MathML 内部时直接吞掉 Enter，不插任何节点
      //   原因：在 SVG <text> 里 execCommand("insertLineBreak") 会产出 HTML <br>，
      //         污染 SVG DOM，导致 SVG 文字丢失 / 布局崩坏（v1.9.4 造成过实际破坏）
      //   SVG <text> 本就不支持 HTML 换行语义，Enter 在此处语义上就应无效
      const isInSvg = (typeof SVGElement !== "undefined" && anchorEl instanceof SVGElement) ||
                      (anchorEl.closest && anchorEl.closest("svg"));
      const isInMath = anchorEl.closest && anchorEl.closest("math");
      if (isInSvg || isInMath) {
        e.preventDefault();
        return;
      }

      // 用 insertLineBreak 在当前块内插 <br>，不产生新 <div>/<p> 块，不受父 overflow/flex 吞噬
      e.preventDefault();
      try {
        document.execCommand("insertLineBreak");
      } catch (_) {
        // 兜底：手动 Range 插 <br>
        const range = sel.getRangeAt(0);
        range.deleteContents();
        const br = document.createElement("br");
        range.insertNode(br);
        // 把光标移到 br 之后
        range.setStartAfter(br);
        range.setEndAfter(br);
        sel.removeAllRanges();
        sel.addRange(range);
      }
      markUserInteract();
      markDirty();
    }, true);

    // contenteditable 的 input 事件：必须是用户交互窗口内才算脏
    document.addEventListener("input", function () {
      if (!isWithinUserWindow()) return;
      markDirty();
    }, true);

    // MutationObserver：只看内容变化（childList / characterData），不看 attributes。
    // 且必须在用户交互窗口内才算真编辑，用来排除页面自带 JS 引起的 DOM 变化。
    const mo = new MutationObserver(function (muts) {
      if (!isWithinUserWindow()) return;
      for (const m of muts) {
        const t = m.target;
        // 忽略 DocCenter 自己注入的元素
        if (t && t.closest && t.closest("#__dc_toolbar")) continue;
        // 忽略 <script> <style> 自身的变化（页面 JS 动态加载常见）
        const tag = (t && t.nodeType === 1 && t.tagName) ? t.tagName.toLowerCase() : "";
        if (tag === "script" || tag === "style") continue;
        markDirty();
        break;
      }
    });

    // 延迟 1 秒再开始监听，避开页面 JS 初始化引起的 DOM 抖动
    setTimeout(() => {
      if (document.body) {
        mo.observe(document.body, {
          childList: true,
          subtree: true,
          characterData: true,
          // 不再监听 attributes —— 避免页面动画/滚动高亮等误报
          attributes: false,
        });
      }
    }, 1000);

    // 关闭前兜底一次
    window.addEventListener("beforeunload", function () {
      if (isDirty) doSnapshot(true);
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 启动
  // ───────────────────────────────────────────────────────────────────────────
  function boot() {
    if (MODE === "md") {
      // md 模式：壳子页面已自带 header 状态胶囊，不注入 DocCenter 工具栏
      bindListeners();
      notifyParent("ready", {
        filePath: FILE_PATH,
        hasExistingEditor: true,  // md 壳子自带编辑器，告诉 app.js 走"原生编辑器"分支
        mode: "md",
      });
      console.log("[saver] md runtime ready. file=", FILE_PATH);
      return;
    }
    // html 模式（原逻辑）
    injectMinimalToolbar();
    installSelectionTracker(); // v1.8.2
    AnnotationSystem.init();
    // v1.8.0: 图片编辑系统（不论是否有原生编辑器都启用，仅和文字工具栏分离）
    //   - 仅当 body 或父容器可编辑时图片操作才有意义
    //   - 但 init 放在这里无副作用：无可编辑 body 时用户点图无效而已
    try { ImageEditor.init(); } catch (e) { console.warn("[saver] ImageEditor init fail", e); }
    try { BlockSpacingEditor.init(); } catch (e) { console.warn("[saver] BlockSpacingEditor init fail", e); }
    try { ElementPositioner.init(); } catch (e) { console.warn("[saver] ElementPositioner init fail", e); }
    bindListeners();
    notifyParent("ready", {
      filePath: FILE_PATH,
      hasExistingEditor: HAS_EXISTING_EDITOR,
    });
    console.log("[saver] runtime ready. file=", FILE_PATH, "existingEditor=", HAS_EXISTING_EDITOR);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
