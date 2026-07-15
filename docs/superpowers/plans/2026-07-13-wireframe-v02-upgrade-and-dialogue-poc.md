# 暑假计划助手 Wireframe v0.2 升级 + 对话式交互 POC

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Wireframe 01/02 升级到 v0.2（匹配双维度画像+六步流程），并完成对话式交互闭环的技术可行性 POC。

**Architecture:** Wireframe 更新为纯 HTML 静态文件编辑（与 03/04 风格一致）。POC 为独立 Python 脚本，用 OpenAI 兼容 API 验证"给定结构化计划 JSON + 自然语言调整请求 → 局部调整后的计划 JSON + 可解释说明"这一核心逻辑。

**Tech Stack:** HTML/CSS（wireframe）、Python 3 + openai 库（POC）

## Global Constraints

- HTML 正文禁止 Markdown 语法（`**`、`##` 等），加粗用 `<strong>`
- 禁止 `opacity: 0.x`（x < 8）做层级弱化
- 所有 HTML 走 DocCenter 模式 1（纯净文件不内嵌工具栏）
- 文档语言：简体中文
- POC 脚本的 API base/key 从环境变量读取，不硬编码
- POC 输出目录：`outputs/暑假计划助手-产品方案/poc/`

---

## File Structure

| 文件 | 职责 | 操作 |
|------|------|------|
| `outputs/暑假计划助手-产品方案/wireframe-profile.html` | Wireframe 01 用户画像录入页 | 修改 |
| `outputs/暑假计划助手-产品方案/wireframe-plan.html` | Wireframe 02 计划偏好与生成页 | 修改 |
| `outputs/暑假计划助手-产品方案/poc/dialogue_poc.py` | 对话式交互闭环 POC 脚本 | 新建 |
| `outputs/暑假计划助手-产品方案/poc/sample_plan.json` | POC 输入示例数据 | 新建 |
| `outputs/暑假计划助手-产品方案/poc/requirements.txt` | POC 依赖 | 新建 |

---

### Task 1: 更新 Wireframe 01 — 增加家长画像步骤

**Files:**
- Modify: `outputs/暑假计划助手-产品方案/wireframe-profile.html`

**变更说明：**
- 进度指示从 3 步改为 4 步：① 基础信息 → ② 近期成绩 → ③ 学习特点 → ④ 家长偏好（新增）
- 新增"家长偏好"区块：教育风格（激娃/佛系/折中）、暑假核心目标（多选）、每日作业时段、可接受作业量、阅读重视程度、运动/自由时间要求
- 保留原有"基础信息""近期成绩""学习特点"三个区块不变
- 页面标题从"录入孩子的基础画像"改为"录入孩子画像 + 家长偏好"

- [ ] **Step 1: 重写 wireframe-profile.html**

更新进度条为 4 步，在第 3 步"学习特点"后新增第 4 步"家长偏好"区块。关键新增 HTML 结构：

```html
<div class="progress">
  <div class="step active">① 基础信息</div>
  <div class="step">② 近期成绩</div>
  <div class="step">③ 学习特点</div>
  <div class="step">④ 家长偏好</div>
</div>
```

新增家长偏好区块（放在学习特点区块之后、frame-footer 之前）：

```html
<div class="block-label">家长教育偏好（v0.2 新增）</div>
<div class="field-group">
  <div class="field-row">
    <div class="field">
      <label>教育风格偏好</label>
      <div class="tag-cloud">
        <span class="tag-chip">激娃型（补差距+赶进度）</span>
        <span class="tag-chip selected">开放佛系型（多阅读+多自由）</span>
        <span class="tag-chip">折中型</span>
      </div>
    </div>
  </div>
  <div class="field-row">
    <div class="field">
      <label>暑假核心目标（多选）</label>
      <div class="tag-cloud">
        <span class="tag-chip selected">补差距</span>
        <span class="tag-chip">赶进度</span>
        <span class="tag-chip selected">增阅读</span>
        <span class="tag-chip">发展兴趣</span>
      </div>
    </div>
  </div>
  <div class="field-row">
    <div class="field">
      <label>每日作业时段</label>
      <div class="input-box select">占位：如 16:00-17:00</div>
    </div>
    <div class="field">
      <label>可接受作业量</label>
      <div class="input-box select">占位：轻 / 中 / 重</div>
    </div>
  </div>
  <div class="field-row">
    <div class="field">
      <label>阅读重视程度</label>
      <div class="input-box select">占位：高 / 中 / 低</div>
    </div>
    <div class="field">
      <label>运动/自由时间要求</label>
      <div class="input-box">占位：如 每天至少1小时户外</div>
    </div>
  </div>
  <div class="note">v0.2 新增：家长画像是计划生成的核心参数，决定作业量、阅读比重和自由时间分配</div>
</div>
```

底部按钮文案更新为"下一步：生成暑假计划 →"。

- [ ] **Step 2: 在浏览器中验证渲染**

用 `preview_url` 通过 DocCenter 打开 wireframe-profile.html，确认 4 步进度条正确显示，家长偏好区块样式与原有区块一致。

- [ ] **Step 3: grep 自检 Markdown 残留**

运行：`grep -r '\*\*[^*]' outputs/暑假计划助手-产品方案/wireframe-profile.html`
预期：无匹配。

---

### Task 2: 更新 Wireframe 02 — 呼应六步流程

**Files:**
- Modify: `outputs/暑假计划助手-产品方案/wireframe-plan.html`

**变更说明：**
- 右侧生成结果区底部增加"进入对话式调整"入口按钮（链接到 wireframe-dialogue.html）
- 右侧增加"教辅推荐预览"区块（简略版，链接到 wireframe-workbook.html）
- 左侧偏好区增加"阅读重视程度"选择项
- 顶部增加步骤指示：当前处于"Step 3-4 生成与调整"

- [ ] **Step 1: 更新 wireframe-plan.html 左侧偏好区**

在教育风格和重点提升方向之间，新增"阅读重视程度"选择：

```html
<div class="block-label">阅读重视程度</div>
<div class="field-group">
  <div class="tag-cloud">
    <span class="tag-chip">低</span>
    <span class="tag-chip selected">中</span>
    <span class="tag-chip">高（每天至少30分钟）</span>
  </div>
</div>
```

- [ ] **Step 2: 更新右侧生成结果区 — 增加教辅推荐预览**

在书单推荐区块之后，新增教辅推荐预览区块：

```html
<div class="block-label">配套教辅推荐（预览）</div>
<div class="booklist" style="margin-bottom:16px;">
  <div class="book-card">
    <div class="cover">教辅占位</div>
    <h4>《YY默写能手》</h4>
    <p>语文 · 生字词夯实 · 题量适中</p>
  </div>
  <div class="book-card">
    <div class="cover">教辅占位</div>
    <h4>《XX思维训练》</h4>
    <p>数学 · 思维训练 · 题量少</p>
  </div>
  <div class="book-card">
    <div class="cover">教辅占位</div>
    <h4>《ZZ英语天天练》</h4>
    <p>英语 · 词汇 · 题量适中</p>
  </div>
</div>
<p style="font-size:11px;color:var(--accent);">
  <a href="wireframe-workbook.html" style="color:var(--accent);text-decoration:none;">查看完整教辅测评对比 →</a>
</p>
```

- [ ] **Step 3: 更新右侧底部 — 增加对话式调整入口**

在书单/教辅推荐之后、页面底部，新增对话式调整入口：

```html
<div style="border:2px dashed var(--accent);border-radius:12px;padding:20px;margin-top:20px;text-align:center;">
  <p style="font-size:13px;color:var(--accent);font-weight:700;margin-bottom:6px;">
    💬 对计划不满意？用自然语言告诉 AI 调整
  </p>
  <p style="font-size:11.5px;color:var(--ink-weak);margin-bottom:12px;">
    如"数学题量少一点"、"上午加个英语阅读时间"
  </p>
  <a href="wireframe-dialogue.html" style="display:inline-block;background:var(--accent);color:#fff;border-radius:8px;padding:10px 28px;font-size:13px;font-weight:700;text-decoration:none;">
    进入对话式调整 →
  </a>
</div>
```

- [ ] **Step 4: 在浏览器中验证渲染**

用 `preview_url` 打开 wireframe-plan.html，确认：教辅推荐预览正确显示、对话式调整入口按钮可点击跳转。

- [ ] **Step 5: grep 自检 Markdown 残留**

运行：`grep -r '\*\*[^*]' outputs/暑假计划助手-产品方案/wireframe-plan.html`
预期：无匹配。

---

### Task 3: 对话式交互闭环 POC

**Files:**
- Create: `outputs/暑假计划助手-产品方案/poc/dialogue_poc.py`
- Create: `outputs/暑假计划助手-产品方案/poc/sample_plan.json`
- Create: `outputs/暑假计划助手-产品方案/poc/requirements.txt`

**POC 验证目标：**
给定一个结构化的暑假计划 JSON + 家长的自然语言调整请求，大模型能否：
1. 理解计划结构
2. 理解调整意图
3. 只修改受影响的部分，保留其他部分不变
4. 输出调整后的完整计划 JSON + 人类可读的调整说明

**验收标准：**
- 输入"英语成绩不太好，能不能上午加个英语阅读时间？数学题量可以少一点"
- 输出：新增了英语阅读时段 + 数学题量从 2 页减到 1 页 + 其他部分不变
- 输出的 JSON 格式合法、可解析
- 调整说明清晰列出变更项

- [ ] **Step 1: 创建 requirements.txt**

```
openai>=1.0.0
```

- [ ] **Step 2: 创建 sample_plan.json**

```json
{
  "child": {
    "name": "叮咚",
    "grade": 4,
    "scores": {"语文": 85, "数学": 92, "英语": 78},
    "strengths": ["阅读理解强", "计算快"],
    "weaknesses": ["生字词易错", "英语薄弱"]
  },
  "parent": {
    "style": "开放佛系型",
    "goals": ["增阅读", "补差距"],
    "daily_homework_slot": "16:00-17:00",
    "homework_load": "中"
  },
  "schedule": [
    {"day": "周一", "time": "08:00-09:00", "subject": "运动", "task": "户外活动/跳绳"},
    {"day": "周一", "time": "09:00-09:30", "subject": "阅读", "task": "《夏洛的网》第1-2章"},
    {"day": "周一", "time": "10:30-11:30", "subject": "自由", "task": "自主安排"},
    {"day": "周一", "time": "16:00-17:00", "subject": "数学", "task": "《XX思维训练》每天2页"},
    {"day": "周一", "time": "17:00-17:30", "subject": "语文", "task": "生字词练习15分钟"}
  ],
  "book_list": [
    {"title": "夏洛的网", "level": "3-5年级", "lang": "中文"},
    {"title": "中国神话故事", "level": "3-5年级", "lang": "中文"},
    {"title": "Magic Tree House #1", "level": "3-5年级", "lang": "英文"}
  ],
  "workbook_list": [
    {"title": "XX思维训练", "subject": "数学", "purpose": "思维训练", "daily_pages": 2},
    {"title": "YY默写能手", "subject": "语文", "purpose": "生字词夯实", "daily_pages": 1}
  ]
}
```

- [ ] **Step 3: 创建 dialogue_poc.py**

```python
#!/usr/bin/env python3
"""
暑假计划助手 — 对话式交互闭环 POC

验证核心逻辑：给定结构化计划 JSON + 自然语言调整请求，
大模型能否生成局部调整后的计划 + 可解释说明。

用法：
  export OPENAI_API_KEY="your-key"
  export OPENAI_API_BASE="https://api.openai.com/v1"  # 或兼容API
  python3 dialogue_poc.py
"""

import json
import os
import sys
from openai import OpenAI

PLAN_FILE = os.path.join(os.path.dirname(__file__), "sample_plan.json")

SYSTEM_PROMPT = """你是一个暑假计划调整助手。你会收到一个结构化的暑假计划 JSON 和家长的调整请求。

你的任务是：
1. 理解当前计划的结构和内容
2. 理解家长的调整意图
3. 只修改受影响的部分，保留其他部分不变
4. 输出两个内容：
   a) 调整后的完整计划 JSON（保持原有结构）
   b) 调整说明（列出具体变更了哪些内容）

输出格式要求：
第一部分用 ```json 代码块包裹调整后的完整 JSON
第二部分用"调整说明："开头，逐条列出变更

示例：
家长请求："数学题量少一点"
你应只修改数学相关的 task/daily_pages，其他所有内容保持不变。"""


def load_plan():
    with open(PLAN_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def call_llm(plan_json: str, adjustment: str) -> str:
    client = OpenAI(
        api_key=os.environ.get("OPENAI_API_KEY"),
        base_url=os.environ.get("OPENAI_API_BASE", "https://api.openai.com/v1"),
    )

    user_msg = f"""当前暑假计划：
{plan_json}

家长的调整请求：
{adjustment}

请输出调整后的完整计划 JSON 和调整说明。"""

    resp = client.chat.completions.create(
        model=os.environ.get("MODEL_NAME", "gpt-4o-mini"),
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_msg},
        ],
        temperature=0.3,
    )
    return resp.choices[0].message.content


def parse_output(raw: str):
    """从 LLM 输出中提取 JSON 和说明"""
    json_str = ""
    explanation = ""

    if "```json" in raw:
        start = raw.index("```json") + 7
        end = raw.index("```", start)
        json_str = raw[start:end].strip()
    elif "```" in raw:
        start = raw.index("```") + 3
        end = raw.index("```", start)
        json_str = raw[start:end].strip()

    if "调整说明" in raw:
        idx = raw.index("调整说明")
        explanation = raw[idx:].strip()

    return json_str, explanation


def validate_adjustment(original: dict, adjusted: dict, adjustment: str) -> list:
    """验证调整是否合理：只改变了受影响部分"""
    issues = []

    # 检查 JSON 是否可解析
    if not adjusted:
        issues.append("[FAIL] 调整后的 JSON 解析失败")
        return issues

    # 检查基本结构保留
    for key in ["child", "parent", "schedule", "book_list", "workbook_list"]:
        if key not in adjusted:
            issues.append(f"[FAIL] 调整后缺少字段: {key}")

    # 检查 child 信息未被修改（除非调整请求涉及孩子信息）
    if "child" in original and "child" in adjusted:
        orig_child = original["child"]
        adj_child = adjusted["child"]
        if orig_child.get("name") != adj_child.get("name"):
            issues.append("[WARN] 孩子姓名被修改了（调整请求未涉及）")

    # 检查 schedule 变化
    orig_sched = original.get("schedule", [])
    adj_sched = adjusted.get("schedule", [])
    if len(adj_sched) != len(orig_sched):
        issues.append(f"[INFO] 时间槽数量变化: {len(orig_sched)} → {len(adj_sched)}（可能是新增/删除时段）")

    # 检查数学相关变化
    adjustment_lower = adjustment.lower()
    if "数学" in adjustment or "math" in adjustment_lower:
        math_changed = False
        for item in adj_sched:
            if item.get("subject") == "数学":
                math_changed = True
                break
        if not math_changed:
            issues.append("[WARN] 调整请求涉及数学，但数学任务未被修改")

    if not issues:
        issues.append("[PASS] 所有基本检查通过")

    return issues


def main():
    # 检查环境变量
    if not os.environ.get("OPENAI_API_KEY"):
        print("[ERROR] 请设置 OPENAI_API_KEY 环境变量")
        print("  export OPENAI_API_KEY='your-key'")
        sys.exit(1)

    # 加载计划
    plan = load_plan()
    plan_json = json.dumps(plan, ensure_ascii=False, indent=2)

    # 测试用例
    test_cases = [
        "英语成绩不太好，能不能上午加个英语阅读时间？数学题量可以少一点。",
        "这个计划太应试了，帮我减一点题量，多加点阅读时间。",
        "数学不用赶进度了，把基础夯实就行，换一本题型更丰富的教辅。",
    ]

    print("=" * 60)
    print("暑假计划助手 — 对话式交互闭环 POC")
    print("=" * 60)
    print(f"\n加载计划: {PLAN_FILE}")
    print(f"孩子: {plan['child']['name']} · {plan['child']['grade']}年级")
    print(f"测试用例数: {len(test_cases)}\n")

    for i, adjustment in enumerate(test_cases, 1):
        print(f"\n{'─' * 60}")
        print(f"测试用例 {i}/{len(test_cases)}")
        print(f"家长请求: \"{adjustment}\"")
        print(f"{'─' * 60}")

        try:
            raw_output = call_llm(plan_json, adjustment)
            json_str, explanation = parse_output(raw_output)

            print(f"\n--- LLM 原始输出 ---")
            print(raw_output[:500] + "..." if len(raw_output) > 500 else raw_output)

            # 尝试解析调整后的 JSON
            try:
                adjusted_plan = json.loads(json_str) if json_str else None
            except json.JSONDecodeError as e:
                adjusted_plan = None
                print(f"\n[ERROR] JSON 解析失败: {e}")

            # 验证
            print(f"\n--- 验证结果 ---")
            issues = validate_adjustment(plan, adjusted_plan, adjustment)
            for issue in issues:
                print(f"  {issue}")

            if explanation:
                print(f"\n--- 调整说明 ---")
                print(explanation)

        except Exception as e:
            print(f"\n[ERROR] API 调用失败: {e}")

    print(f"\n{'=' * 60}")
    print("POC 完成")
    print("=" * 60)


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: 安装依赖**

运行：`pip3 install openai`

- [ ] **Step 5: 运行 POC**

运行：`cd outputs/暑假计划助手-产品方案/poc && python3 dialogue_poc.py`

预期：3 个测试用例依次执行，每个用例输出调整后的 JSON + 验证结果 + 调整说明。验证结果应显示 `[PASS]` 或合理的 `[INFO]`/`[WARN]`。

- [ ] **Step 6: 分析 POC 结果并记录结论**

检查 POC 输出：
- 大模型是否正确理解了调整意图？
- 是否只修改了受影响部分（孩子姓名等未涉及信息是否保留）？
- JSON 格式是否合法可解析？
- 调整说明是否清晰？

将结论写入 `poc/poc_result.md`。

---

### Task 4: 验收与预览

- [ ] **Step 1: 确认所有文件已创建/更新**

检查 5 个文件存在：
- `wireframe-profile.html`（更新）
- `wireframe-plan.html`（更新）
- `poc/dialogue_poc.py`（新建）
- `poc/sample_plan.json`（新建）
- `poc/requirements.txt`（新建）

- [ ] **Step 2: DocCenter 预览所有 wireframe**

用 `preview_url` 依次打开 4 个 wireframe，确认全部可正常渲染。

- [ ] **Step 3: 确认 wireframe 间导航链接有效**

从 index.html → wireframe-profile.html → wireframe-plan.html → wireframe-dialogue.html / wireframe-workbook.html 的导航链路通畅。

- [ ] **Step 4: 记录 POC 结论到产品方案**

根据 POC 结果，在 index.html 的"核心假设待验证"部分补充 POC 验证结论。
