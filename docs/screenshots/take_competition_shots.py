"""
DocCenter 参赛截图脚本
截取 6 个核心功能的浏览器截图
"""
import asyncio
from playwright.async_api import async_playwright

BASE = "http://localhost:9901"
OUT = "/Users/louiscxqiu/CodeBuddy/openclaw-cb/软件项目探索/html-doc-center/docs/screenshots/competition"


async def ensure_sidebar_open(page):
    """确保侧栏处于展开状态"""
    is_open = await page.evaluate("""
        () => document.querySelector('#sidebar').classList.contains('visible')
    """)
    if not is_open:
        await page.locator("#btn-toggle-sidebar").click()
        await page.wait_for_timeout(600)


async def click_first_visible_file(page):
    """点击第一个可见的文件节点"""
    clicked = await page.evaluate("""
        () => {
            const files = document.querySelectorAll('.tree-file, .tree-node[data-type="html"], .tree-node[data-type="md"]');
            for (const f of files) {
                if (f.offsetParent !== null && f.offsetHeight > 0) {
                    f.click();
                    return f.getAttribute('data-path') || true;
                }
            }
            return false;
        }
    """)
    if clicked:
        await page.wait_for_timeout(2500)
    return clicked


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        
        # ========== 截图 1: 全局概览（侧栏展开 + 文件打开） ==========
        print("1/6 全局概览...")
        page = await browser.new_page(viewport={"width": 1440, "height": 900})
        await page.goto(BASE)
        await page.wait_for_load_state("networkidle")
        await page.wait_for_timeout(1000)
        await ensure_sidebar_open(page)
        result = await click_first_visible_file(page)
        print(f"   打开文件: {result}")
        await page.screenshot(path=f"{OUT}/01-overview.png", full_page=False)
        await page.close()

        # ========== 截图 2: 三 Tab 侧栏（目录/收藏/最近） ==========
        print("2/6 三Tab侧栏...")
        page = await browser.new_page(viewport={"width": 1440, "height": 900})
        await page.goto(BASE)
        await page.wait_for_load_state("networkidle")
        await page.wait_for_timeout(1000)
        await ensure_sidebar_open(page)
        # 截侧栏区域
        await page.screenshot(path=f"{OUT}/02-sidebar-tabs.png", clip={"x": 0, "y": 44, "width": 320, "height": 750})
        await page.close()

        # ========== 截图 3: 搜索功能 ==========
        print("3/6 搜索功能...")
        page = await browser.new_page(viewport={"width": 1440, "height": 900})
        await page.goto(BASE)
        await page.wait_for_load_state("networkidle")
        await page.wait_for_timeout(1000)
        await ensure_sidebar_open(page)
        # 在搜索框输入关键词
        search_box = page.locator("#search-box")
        await search_box.fill("changelog")
        await page.wait_for_timeout(800)
        await page.screenshot(path=f"{OUT}/03-search.png", clip={"x": 0, "y": 44, "width": 320, "height": 750})
        await page.close()

        # ========== 截图 4: 暗色主题 ==========
        print("4/6 暗色主题...")
        page = await browser.new_page(viewport={"width": 1440, "height": 900})
        await page.goto(BASE)
        await page.wait_for_load_state("networkidle")
        await page.wait_for_timeout(500)
        # 通过 JS 直接设置暗色主题
        await page.evaluate("""
            () => {
                document.documentElement.setAttribute('data-theme', 'dark');
                localStorage.setItem('doc_center_theme', 'dark');
            }
        """)
        await page.wait_for_timeout(500)
        await ensure_sidebar_open(page)
        await click_first_visible_file(page)
        await page.screenshot(path=f"{OUT}/04-dark-theme.png", full_page=False)
        await page.close()

        # ========== 截图 5: 历史时间线 (History Drawer) ==========
        print("5/6 历史时间线...")
        page = await browser.new_page(viewport={"width": 1440, "height": 900})
        await page.goto(BASE)
        await page.wait_for_load_state("networkidle")
        await page.wait_for_timeout(1000)
        await ensure_sidebar_open(page)
        await click_first_visible_file(page)
        # 点击历史按钮
        is_enabled = await page.evaluate("() => !document.querySelector('#btn-history').disabled")
        if is_enabled:
            await page.locator("#btn-history").click()
            await page.wait_for_timeout(1000)
        await page.screenshot(path=f"{OUT}/05-history-drawer.png", full_page=False)
        await page.close()

        # ========== 截图 6: CHANGELOG 时间轴 ==========
        print("6/6 CHANGELOG 时间轴...")
        page = await browser.new_page(viewport={"width": 1440, "height": 900})
        await page.goto(f"{BASE}/changelog")
        await page.wait_for_load_state("networkidle")
        await page.wait_for_timeout(2000)
        await page.screenshot(path=f"{OUT}/06-changelog.png", full_page=False)
        await page.close()

        await browser.close()
        print(f"\n✅ 全部 6 张截图已保存到 {OUT}/")


asyncio.run(main())
