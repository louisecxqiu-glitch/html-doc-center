#!/usr/bin/env python3
"""
HTML Document Center · v1.0 自动截图脚本
==========================================
用 Playwright 访问本地服务，自动截 4 张关键交互截图归档。

前置：
  1. html-doc-center 服务在 9901 运行
  2. pip install playwright && playwright install chromium

用法：
  python3 docs/screenshots/take_screenshots.py
"""
import asyncio
import os
import sys
from pathlib import Path
from playwright.async_api import async_playwright

VERSION = "v1.1-2026-04-18"
BASE_URL = "http://localhost:9901"
OUTPUT_DIR = Path(__file__).parent / VERSION
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# 演示用的 HTML 文件路径（请改为你本地实际存在的文件）
DEMO_FILE = os.path.expanduser(
    "~/Documents/demo-report.html"
)


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--disable-cache", "--disk-cache-size=0"],
        )
        context = await browser.new_context(
            viewport={"width": 1440, "height": 900},
            device_scale_factor=2,  # Retina 清晰截图
            bypass_csp=True,
        )
        # 禁用 HTTP 缓存 —— 每次加载最新 CSS/JS
        await context.route(
            "**/*.{js,css,html}",
            lambda route: route.continue_(
                headers={
                    **route.request.headers,
                    "Cache-Control": "no-cache, no-store, must-revalidate",
                    "Pragma": "no-cache",
                }
            ),
        )
        page = await context.new_page()

        # ==================================================
        # 截图 1：初始空态（顶栏 + 引导页）
        # ==================================================
        print("📸 [1/4] 截图：初始空态…")
        await page.goto(BASE_URL, wait_until="networkidle")
        # 等待首次目录自动展开动画结束再收起
        await page.wait_for_timeout(500)
        # 如果目录是打开的先关掉，保证截的是"干净的首开状态"
        is_visible = await page.evaluate(
            "document.getElementById('sidebar').classList.contains('visible')"
        )
        if is_visible:
            await page.evaluate(
                "document.querySelector('#btn-toggle-sidebar').click()"
            )
            await page.wait_for_timeout(300)
        await page.screenshot(
            path=str(OUTPUT_DIR / "01-empty-state.png"),
            full_page=False,
        )

        # ==================================================
        # 截图 2：目录展开态（浮动抽屉 + 文件树）
        # ==================================================
        print("📸 [2/4] 截图：目录展开态…")
        await page.evaluate("document.querySelector('#btn-toggle-sidebar').click()")
        await page.wait_for_timeout(400)  # 等抽屉滑出动画
        # 展开"01-养虾系列"让目录看起来更丰富
        try:
            await page.evaluate("""() => {
                const labels = document.querySelectorAll('.tree-node-label');
                for (const l of labels) {
                    const name = l.querySelector('.tree-name');
                    if (name && name.textContent.includes('01-养虾系列')) {
                        l.click();
                        break;
                    }
                }
            }""")
            await page.wait_for_timeout(200)
        except Exception:
            pass
        await page.screenshot(
            path=str(OUTPUT_DIR / "02-sidebar-open.png"),
            full_page=False,
        )

        # ==================================================
        # 截图 3：文档打开态（OPPO v2 已加载，带批注工具栏）
        # ==================================================
        print("📸 [3/4] 截图：文档打开态…")
        # 确保目录已打开（截图 2 状态延续）
        is_visible = await page.evaluate(
            "document.getElementById('sidebar').classList.contains('visible')"
        )
        if not is_visible:
            await page.evaluate(
                "document.querySelector('#btn-toggle-sidebar').click()"
            )
            await page.wait_for_timeout(300)

        # 用搜索框过滤到 v2-report
        await page.fill("#search-box", "v2-report")
        await page.wait_for_timeout(400)

        # 找并点击第一个匹配的 HTML 文件
        clicked = await page.evaluate("""() => {
            const labels = document.querySelectorAll('.tree-node-label[data-file]');
            for (const l of labels) {
                // 只点可见的（没被 applySearchFilter 隐藏的）
                let cur = l.parentElement;
                let visible = true;
                while (cur && cur.classList.contains('tree-node')) {
                    if (cur.style.display === 'none') { visible = false; break; }
                    cur = cur.parentElement && cur.parentElement.closest('.tree-node');
                }
                if (visible) { l.click(); return l.dataset.file; }
            }
            return null;
        }""")
        print(f"     → 已打开: {clicked}")
        # 清空搜索以免遮挡
        await page.fill("#search-box", "")
        await page.wait_for_timeout(300)
        # 等 iframe 加载 + 目录自动收起
        await page.wait_for_timeout(3000)
        await page.screenshot(
            path=str(OUTPUT_DIR / "03-doc-loaded.png"),
            full_page=False,
        )

        # ==================================================
        # 截图 4：保存对话框（三选项）
        # ==================================================
        print("📸 [4/4] 截图：保存对话框…")
        # 强制把状态设为 dirty 并触发 save 对话框
        await page.evaluate("""() => {
            // 直接弹对话框（通过点击保存按钮）
            const btn = document.querySelector('#btn-force-save');
            btn.disabled = false;
            // 模拟 dirty 状态
            if (window.__sidebarCtl) {}
            // 直接 show 对话框
            document.getElementById('dialog-file-name').textContent =
                '~/Documents/demo-report.html';
            document.getElementById('save-dialog').style.display = 'flex';
        }""")
        await page.wait_for_timeout(400)
        await page.screenshot(
            path=str(OUTPUT_DIR / "04-save-dialog.png"),
            full_page=False,
        )

        await browser.close()

        # 汇总
        print("\n" + "=" * 50)
        print(f"✅ 4 张截图已保存到：{OUTPUT_DIR}")
        for f in sorted(OUTPUT_DIR.glob("*.png")):
            size_kb = f.stat().st_size / 1024
            print(f"  · {f.name}  ({size_kb:.1f} KB)")
        print("=" * 50)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as e:
        print(f"❌ 截图失败: {e}", file=sys.stderr)
        sys.exit(1)
