# 520 心跳挑战 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在首页交付一个可运行、可展示、可生成结果海报的移动端 520 金融社区小游戏。

**Architecture:** 采用“配置 + 纯逻辑 + 单页 UI”三层结构。配置负责运营可改项，逻辑负责测试与判定，UI 负责状态切换、视觉呈现与交互动画。

**Tech Stack:** Next.js App Router、React 19、TypeScript、Tailwind CSS、Node test

---

### Task 1: 搭建可测试的规则与结果逻辑

**Files:**
- Create: `tests/heartbeat-game.test.ts`
- Create: `lib/heartbeat-game-config.ts`
- Create: `lib/heartbeat-game.ts`

- [ ] 写纯逻辑测试，覆盖命中率、连击奖励、结果类型判定和结果内容生成
- [ ] 运行单测，确认先失败
- [ ] 实现配置与逻辑函数
- [ ] 再次运行单测，确认通过

### Task 2: 重做首页为单页 H5

**Files:**
- Modify: `components/home-page.tsx`
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`

- [ ] 用单页状态机替换现有征集首页
- [ ] 实现开始页、倒计时页、游戏页、结果页
- [ ] 加入移动端视觉、漂浮动画、点击反馈、合规提示
- [ ] 接入逻辑层与集中配置

### Task 3: 完成海报预览与导出

**Files:**
- Modify: `components/home-page.tsx`
- Modify: `lib/heartbeat-game.ts`

- [ ] 结果页内渲染海报预览卡片
- [ ] 用 SVG 字符串生成可下载海报
- [ ] 增加按钮状态与导出后的轻反馈

### Task 4: 验证交付

**Files:**
- Verify only

- [ ] 运行 `npm test`
- [ ] 运行 `npm run build`
- [ ] 检查首页元信息与类型构建输出
