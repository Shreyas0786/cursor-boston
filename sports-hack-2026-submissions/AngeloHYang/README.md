# PulseLens Live (Mock Demo)

Track: **01 Fan and Audience Experience**

## Project One-Liner

PulseLens Live 把直播中的实时字幕转换为可互动的信息层：自动识别场景、生成 Breaking News 风格摘要、高亮术语解释，并支持基于字幕与视频时间锚点的问答。

## One User · One Problem · One Product

- User: 独自在线看比赛的普通观众（尤其是新球迷）。
- Problem: 直播信息密度高，关键术语和战术不易理解，观看体验偏被动。
- Product: 一个实时“理解辅助层”，让用户在观看中快速知道“现在发生了什么、为什么重要”。

## Mock Demo Includes

1. **Live Subtitle Stream**
- 模拟 ASR/官方实时字幕逐条更新。
- 每条字幕自动附带场景标签（表演、解说分析、比赛进程、伤病更新）。

2. **AI Breaking News**
- 根据当前字幕和场景，自动输出一个标题和三条摘要。
- 风格接近体育新闻快讯，方便快速理解。

3. **Explainable Terms**
- 术语高亮并可点击。
- 点击后展示定义与上下文解释（例如高位挡拆、转换进攻、底角三分）。

4. **Ask Anything (Mock RAG + Video Anchor)**
- 用户提问后，系统先做字幕片段匹配。
- 返回答案时附带“证据字幕 + 视频时间锚点”，模拟 vLLM 视觉检索链路。

## Why It Matters

- 提升沉浸感：观众从被动看球转为主动理解与互动。
- 降低门槛：新用户也能快速理解专业表达。
- 强可解释性：每个答案都能追溯到字幕与时间轴证据。

## Quick Start

这是纯前端 mock，无需安装依赖。

1. 直接在浏览器打开 `index.html`。
2. 点击 **Next Subtitle** 切换直播片段。
3. 点击术语查看解释。
4. 在输入框提问并点击 **Ask**，观察答案和证据时间轴。

## 90-second Demo Script

1. 开场说明问题：线上看球信息太多、看不懂战术术语。
2. 点击 Next Subtitle，展示场景自动识别与标签。
3. 指向 Breaking News 模块，说明“系统自动总结当下重点”。
4. 点击一个术语，展示解释如何帮助新手理解。
5. 输入问题（例如“为什么说这是高位挡拆？”），展示答案 + 证据时间轴。
6. 收尾：这是官方直播可集成的新功能，不只是插件。

## Files

- `index.html`: 页面结构与模块布局
- `styles.css`: 视觉风格、响应式、动效
- `app.js`: mock 数据、交互逻辑、问答与证据链模拟
- `meta.json`: 黑客松提交信息
