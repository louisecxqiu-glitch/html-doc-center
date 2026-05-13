/* ==========================================================================
 * DocCenter · changelog-renderer.js (v1.11.0)
 *
 * 流程：
 *   1. fetch /api/changelog-raw 拿 CHANGELOG.md 原文
 *   2. marked.parse(md) 得到扁平 HTML
 *   3. 把相邻的 h2 + 后续兄弟节点（直到下一个 h2 或文档结束）打包成
 *      <div class="release"><div class="release-card">...</div></div>
 *   4. 解析 h2 文本（格式 "[vX.Y.Z] — 日期 · 标题"）拆成三段 head
 *   5. 首个 release 自动加 .latest 类
 *   6. v1.11.0: body 内第一段 blockquote 抽成 .release-preview（始终可见），
 *      其余塞进 .release-body（可折叠）
 *   7. v1.11.0: 最新版默认展开；其他版本默认折叠；点击 head 切换
 *   8. v1.11.0: 顶部加"全部展开/全部折叠"工具条
 *   9. 组装进 .timeline 容器
 * ========================================================================== */

(async function () {
  "use strict";

  const container = document.getElementById("changelog-body");
  if (!container) return;

  try {
    const resp = await fetch("/api/changelog-raw", { cache: "no-store" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const md = await resp.text();

    if (typeof marked === "undefined") {
      throw new Error("marked 库未加载");
    }

    // 配置 marked：简单模式，保留换行
    marked.setOptions({
      breaks: false,
      gfm: true,
    });

    const rawHtml = marked.parse(md);

    // 用临时容器解析 HTML 到 DOM 节点列表
    const tmp = document.createElement("div");
    tmp.innerHTML = rawHtml;

    const nodes = Array.from(tmp.childNodes);

    // v1.11.0: 顶部工具栏（全部展开/全部折叠）
    const toolbar = buildToolbar();

    const timeline = document.createElement("div");
    timeline.className = "timeline";

    // 预处理：去掉顶部的 h1 和介绍段（"# Changelog" + "本项目采用..."）
    // 找到第一个 h2 的位置，前面的全部跳过
    let firstH2Idx = nodes.findIndex(n => n.nodeType === 1 && n.tagName === "H2");
    if (firstH2Idx < 0) {
      container.innerHTML = `<div class="loading-state">日志还没有版本记录。</div>`;
      return;
    }

    // 从 firstH2Idx 开始切片
    let currentCard = null;
    let currentPreview = null;
    let currentBody = null;
    let previewFilled = false;
    let releaseCount = 0;
    const allReleaseWraps = [];

    for (let i = firstH2Idx; i < nodes.length; i++) {
      const node = nodes[i];
      // 跳过文本节点空白
      if (node.nodeType === 3 && !node.textContent.trim()) continue;

      if (node.nodeType === 1 && node.tagName === "H2") {
        // 开启新 release
        const isLatest = releaseCount === 0;
        currentCard = buildReleaseCard(node, isLatest);
        currentPreview = currentCard.querySelector(".release-preview");
        currentBody = currentCard.querySelector(".release-body");
        previewFilled = false;
        const wrap = currentCard.parentNode;
        if (!isLatest) wrap.classList.add("collapsed");
        timeline.appendChild(wrap);
        allReleaseWraps.push(wrap);
        releaseCount++;
      } else if (node.nodeType === 1 && node.tagName === "HR") {
        // hr 是版本分隔符（MD 里的 ---），跳过（卡片边界已由 h2 切分）
        continue;
      } else if (currentBody) {
        // v1.11.0: 第一段 blockquote 放 preview，其余放 body
        if (!previewFilled && node.nodeType === 1 && node.tagName === "BLOCKQUOTE") {
          currentPreview.appendChild(node.cloneNode(true));
          previewFilled = true;
        } else {
          currentBody.appendChild(node.cloneNode(true));
        }
      }
    }

    container.innerHTML = "";
    container.appendChild(toolbar);
    container.appendChild(timeline);

    // v1.11.0: 绑定全部展开/折叠
    toolbar.querySelector("#cl-expand-all").addEventListener("click", () => {
      allReleaseWraps.forEach(w => w.classList.remove("collapsed"));
    });
    toolbar.querySelector("#cl-collapse-all").addEventListener("click", () => {
      allReleaseWraps.forEach((w, idx) => {
        // 即便是最新版也一起折叠
        w.classList.add("collapsed");
      });
    });

  } catch (e) {
    console.error("[changelog-renderer]", e);
    container.innerHTML = `
      <div class="error-state">
        ❌ 加载更新日志失败
        <pre>${escapeHtml(e.message || String(e))}</pre>
        <p style="margin-top:10px;font-size:12px;">
          请检查 <code>CHANGELOG.md</code> 是否存在，或 <code>/api/changelog-raw</code> 是否正常。
        </p>
      </div>`;
  }

  // ── helpers ──

  /**
   * v1.11.0: 顶部工具栏（全部展开/折叠 + 提示）
   */
  function buildToolbar() {
    const bar = document.createElement("div");
    bar.className = "changelog-toolbar";
    bar.innerHTML = `
      <span class="cl-tip">💡 点击版本卡片头部展开详情</span>
      <div class="cl-toolbar-actions">
        <button id="cl-expand-all" class="cl-btn">⊕ 全部展开</button>
        <button id="cl-collapse-all" class="cl-btn">⊖ 全部折叠</button>
      </div>
    `;
    return bar;
  }

  /**
   * 把一个 h2 构造成 release 头部，返回 .release-card 节点（其父是 .release）。
   * h2 文本格式："[vX.Y.Z] — YYYY-MM-DD · HH:MM · 标题"
   * 其中部分版本可能缺 HH:MM 或标题。
   */
  function buildReleaseCard(h2, isLatest) {
    const wrap = document.createElement("div");
    wrap.className = "release" + (isLatest ? " latest" : "");

    const card = document.createElement("div");
    card.className = "release-card";
    wrap.appendChild(card);

    const head = document.createElement("div");
    head.className = "release-head";

    const { version, date, title } = parseH2(h2.textContent);

    if (version) {
      const vt = document.createElement("span");
      vt.className = "version-tag";
      vt.textContent = version;
      head.appendChild(vt);
    }

    if (title) {
      const badge = document.createElement("span");
      badge.className = "badge" + (isLatest ? " badge-latest" : "");
      badge.textContent = (isLatest ? "Latest · " : "") + title;
      head.appendChild(badge);
    }

    if (date) {
      const dateEl = document.createElement("span");
      dateEl.className = "release-date";
      dateEl.textContent = date;
      head.appendChild(dateEl);
    }

    // v1.11.0: 折叠/展开指示箭头
    const caret = document.createElement("span");
    caret.className = "release-caret";
    caret.textContent = "▼";
    caret.title = "点击展开/折叠";
    head.appendChild(caret);

    // v1.11.0: 整个 head 可点
    head.style.cursor = "pointer";
    head.addEventListener("click", () => {
      wrap.classList.toggle("collapsed");
    });

    card.appendChild(head);

    // v1.11.0: preview 段（始终可见，承载第一段 blockquote 引言）
    const preview = document.createElement("div");
    preview.className = "release-preview";
    card.appendChild(preview);

    // body（可折叠，承载其余内容）
    const body = document.createElement("div");
    body.className = "release-body";
    card.appendChild(body);

    return card;
  }

  /**
   * 解析 h2 文本："[v1.7.3] — 2026-05-02 · 23:45 · 单一数据源"
   * 也兼容："v1.7.3 — 2026-05-02 · 23:45 · 标题"
   * 或者只有 "[v1.0]"。
   */
  function parseH2(text) {
    const t = (text || "").trim();
    // 提取版本号
    const vMatch = t.match(/\[?(v\d+(?:\.\d+){0,3}(?:[a-zA-Z0-9.-]*)?)\]?/);
    const version = vMatch ? vMatch[1] : "";

    // 去掉版本号部分，剩下的按分隔符拆
    let rest = t.replace(/^\[?v[^\]]+\]?\s*[—–-]?\s*/, "").trim();

    // rest 格式："2026-05-02 · 23:45 · 标题" 或 "2026-05-02 · 标题"
    let date = "";
    let title = rest;
    const parts = rest.split(/\s*·\s*/);
    if (parts.length >= 1) {
      const dateMatch = parts[0].match(/^\d{4}-\d{2}-\d{2}/);
      if (dateMatch) {
        // 如果第二段也是时间（HH:MM），合并到 date
        if (parts[1] && /^\d{1,2}:\d{2}$/.test(parts[1])) {
          date = parts[0] + " · " + parts[1];
          title = parts.slice(2).join(" · ");
        } else {
          date = parts[0];
          title = parts.slice(1).join(" · ");
        }
      }
    }
    return { version, date, title };
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }
})();
