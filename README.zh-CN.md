# Stash

[English](./README.md) | **简体中文** | [日本語](./README.ja.md)

**聊天里的图片和消息，一处收好。** 自托管的单用户收件箱：通过各聊天平台的机器人接收消息并保存，图片和文件都会下载到你自己的存储里。整个项目运行在 Cloudflare Workers + D1 + R2 + Queues 上，个人使用在免费套餐内即可。目前先支持 QQ；平台层按可扩展的方式设计，之后可以接入 Telegram 等平台。

## 功能

- **QQ 机器人**：在 QQ 开放平台创建机器人，把 AppID / AppSecret 填到设置里，再把 Stash 显示的回调地址填到 QQ 后台。Stash 会自动响应回调地址校验（op 13），并校验每个事件的 Ed25519 签名。会保存单聊、群消息（无论是否 @ 机器人）和频道消息；平台重复推送的事件只保存一次。每个机器人可以设置自己的头像（默认显示 QQ 机器人图标）
- **可靠保存文件**：回调里只把消息写入 D1 并把附件放进队列，所以能很快响应 QQ。队列消费者把每个文件以流的方式写入 R2，不在内存中缓冲，几十甚至几百 MB 的文件也能保存（长度已知：单次流式 PUT；长度未知或超过 5 GB：按 10 MB 分片上传），保存后还会核对大小与 `Content-Length` 是否一致
- **重试**：网络错误、超时、下载不完整以及 408 / 429 / 5xx 会自动重试 9 次，间隔从 30 秒逐步退避到 2 小时（合计约 5 小时，在免费套餐 24 小时的队列保留期内）。链接过期（其他 4xx）会直接标记失败。死信队列兜底消费者崩溃的情况；另有每 10 分钟一次的巡检，会把丢失了队列消息或下载中断的附件重新排队。失败的文件可以在网页上逐个或一次性全部重试
- **与平台无关**：每个聊天平台在 API 端是一个适配器，在网页端是平台注册表里的一项；页面、存储和队列都不关心消息来自哪个平台
- **网页端**：消息流（带图片缩略图）、原图查看（图片、视频、音频）与下载；可按机器人、「有附件」「下载失败」筛选
- **任务队列**：列出所有下载任务，顶部有摘要卡片（已保存、占用空间、处理中、失败），可按状态、类型、机器人筛选；每个任务可查看详情（大小、尝试次数、错误、下次重试时间、源地址、R2 路径）并单独重试
- **事件记录**：每次回调都会记录（默认保留 30 天），包括命中（保存为消息或重复推送）和未命中（被忽略的事件、地址校验、签名错误或机器人未知等被拒绝的请求、保存出错），可查看原始数据。QQ 事件名有中文翻译，新出现的事件显示原始名称
- **AI 识别**（可选，基于 [Vercel AI SDK](https://ai-sdk.dev)，设置方式和 PickIt 一样：支持 OpenAI、Anthropic、Gemini 以及兼容 OpenAI 接口的服务，对话模型和向量模型分开配置）：消息的文件保存后，把文字和最多 4 张图片一次性发给对话模型，得到分类（优先从你设定的列表里选，都不合适时新建）、标签、一句话摘要、图中文字和关键信息（金额、日期、电话、邮箱、链接、地址、订单/快递单号、人名）。和下载共用一个队列，有重试和每日上限；历史消息可以在「设置 → AI」里批量识别，分类和标签也可以手动修改。对话模型的**思考强度**（模型默认 / 关闭 / 低 / 中 / 高）作用于所有 AI 调用；「测试对话模型」会报告总耗时、首字延迟、token 用量（含思考 token）、是否进行了思考以及实际响应的模型
- **搜索**：关键词搜索覆盖消息文字、图中文字、摘要、标签和分类（SQLite FTS5 的 trigram 分词，适合中文；1–2 个字的词用 LIKE 匹配）；配置向量模型后还能按意思搜索（向量存在 D1，和 PickIt 一样使用 512 维压缩向量，在免费套餐的 CPU 限制内运行）。两种结果合并排序，并遵循当前的筛选条件；MCP 的 `search_messages` 也使用这套搜索。换了向量模型后，可以在「设置 → AI」里重建向量索引（只补缺失或模型不一致的，或全部重建）
- **打包下载**：在消息页按当前筛选（时间，以及可多选的平台、机器人、会话类型和具体会话）打包，或在「设置 → 数据」导出整个平台。可以选日期范围、文件类型和目录结构（按机器人和月份、按会话、不分目录），可附带 `messages.json`；`report.txt` 会列出未保存和下载失败的文件。ZIP 在浏览器里生成（Worker 的 CPU 限制算不了几个 GB 的校验和）：Chrome 和 Edge 直接写入磁盘、不限大小，其他浏览器按 500 MB 自动分卷下载。文件每次并发 3 个、失败自动重试，结束后还可以单独重新下载失败的文件
- **凭据校验**：每个机器人都有「测试凭据」按钮（编辑表单里也有），直接向平台验证；QQ 用的是官方获取 AppAccessToken 的接口，失败时显示 QQ 返回的原始错误
- **批量操作**：在消息页和回收站进入选择模式后，可以批量改分类、添加或移除标签、重新识别、重试失败的文件、删除，或恢复、彻底删除
- **缩略图**：下载完成后用 Images 绑定生成一份 1280px 的 WebP 预览图，列表显示它，AI 识别也用它代替原图（大截图也能识别）。存进 R2，只生成一次（免费套餐每月 5,000 次转换）。Images 处理不了的图片（例如超大图）改用免费的 wsrv.nl 生成，它通过 15 分钟有效的签名链接读取原图（限制：100 MiB、7100 万像素）。以前的图片由定时任务每次补 20 张；点击查看原图
- **虚拟滚动**：消息列表和回收站只渲染视口附近的卡片，和 PickIt 一样
- **备份与恢复**：和 PickIt 一样，每天把消息记录（含 AI 分类、标签和附件信息；不含原始推送数据和向量）备份到 R2，保留 30 天；也可以手动备份、下载，或以「合并」（只补缺少的）或「替换」（现有消息先进回收站）方式恢复，恢复前会自动存一份快照。文件本身已在 R2，不重复备份，所以已彻底删除的消息恢复后没有文件
- **定时任务**（「设置 → 定时任务」，和 PickIt 一样）：每 10 分钟补救丢失的下载和 AI 识别、补生成缩略图、清理过期记录、生成每日备份；每项任务显示上次和下次运行时间、最近记录和错误，可以手动执行
- **统计**：总数、近 30 天每天和每月的消息数，以及按分类、机器人、会话类型、最活跃会话和文件类型的分布
- **审计日志**：和 PickIt 一样，记录每次接口写操作、准备导出、MCP 工具调用和登录（包括被拒绝的），含操作者、时间、IP、客户端和请求内容（密钥会隐藏）；可以按类别、操作、操作者、结果和关键词筛选，支持实时刷新。默认保留 180 天（「设置 → 数据与导出」）
- **筛选条件保存在网址里**：消息、任务、事件和审计页的筛选条件会写进网址，刷新后保留，也可以收藏
- **回收站**：删除的消息连同附件文件先进回收站（可立即撤销，也可以之后在回收站页面恢复）；在回收站彻底删除、清空回收站，或超过回收站保留时间（默认 30 天）后，才会同时删除 R2 里的文件
- **保留设置**：在「设置 → 数据与导出」里设置事件记录、失败下载记录和回收站保留多久（预设、自定义天数或永久），并显示条数和占用空间
- **API Token**：脚本可以用 `Authorization: Bearer <token>` 调用 API，例如备份消息和文件
- **MCP**：Claude 等 AI 助手可以通过 `/api/mcp`（Streamable HTTP，使用 API Token 鉴权）搜索消息、查看保存的图片、列出机器人，以及检查和重试失败的下载
- **筛选与实时刷新**：列表的筛选方式和 PickIt 一致（单选下拉、可搜索的多选、可移除的筛选标签）；任务队列和事件记录支持每 5 秒实时刷新，也可以手动刷新
- **登录**：通过 [Better Auth](https://better-auth.com) 使用 Google / GitHub 登录，只允许邮箱白名单内的账号，白名单可在设置里编辑（没有密码登录）
- **语言**：中文、英文、日文界面；**主题**：跟随系统 / 浅色 / 深色

## 工作原理

```
QQ ──webhook──▶ Worker ──验签──▶ D1（消息 + 附件行，状态 "pending"）
                          │
                          └──入队──▶ 队列 "stash-media" ──▶ 消费者 ──流式写入──▶ R2
                                         │ 退避重试               │
                                         └──▶ 死信队列（标记失败）  └──▶ D1 状态 "stored"
Cron 每 10 分钟：把丢失或中断的下载重新排队
```

| 路径 | 作用 |
| --- | --- |
| `apps/api/src/platforms/` | 每个平台一个适配器（验签 + 解析），目前是 `qq/` |
| `apps/api/src/ingest.ts` | 保存消息和附件行，然后入队 |
| `apps/api/src/media/` | 下载到 R2、重试策略、队列消费者、巡检 |
| `apps/web` | React 前端（由同一个 Worker 提供） |
| `packages/shared` | 前后端共用的类型和翻译 |

## 技术栈

- **API**：Cloudflare Workers 上的 [Hono](https://hono.dev)，D1（SQLite）、R2、Queues、Cron Triggers
- **前端**：React 19、React Router、TanStack Query、Tailwind CSS 4、[Base UI](https://base-ui.com) 组件（coss ui）
- **国际化**：[Paraglide](https://inlang.com/m/gerre34r/library-inlang-paraglideJs)
- pnpm workspaces monorepo

## 本地开发

环境要求：Node.js 24+、pnpm 11+。

```bash
pnpm install
cp apps/api/.dev.vars.example apps/api/.dev.vars   # 本地密钥（已被 git 忽略）
pnpm db:migrate   # 把迁移应用到本地 D1
pnpm dev          # 前端 http://localhost:5173，API :8787
```

`wrangler dev` 会在本地模拟 D1、R2 和 Queues。`.dev.vars.example` 里设置了 `DEV_AUTH_BYPASS=1`，在 `BETTER_AUTH_URL` 为 localhost 时跳过登录。QQ 访问不到 localhost；要收真实消息，可以直接部署，或者用隧道暴露 8787 端口（例如 `cloudflared tunnel --url http://localhost:8787`），再用隧道地址。

### 翻译

界面文案在 `packages/shared/messages/{zh,en,ja}.json`。修改后运行 `pnpm --filter @stash/shared i18n`。

### 测试

```bash
pnpm typecheck
pnpm test
```

## 部署到 Cloudflare

```bash
cd apps/api
npx wrangler d1 create stash-db              # 把返回的 id 填到 wrangler.jsonc
npx wrangler r2 bucket create stash-media
npx wrangler queues create stash-media
npx wrangler queues create stash-media-dlq
npx wrangler secret put BETTER_AUTH_SECRET   # 任意一段较长的随机字符串
npx wrangler secret put ALLOWED_EMAILS       # you@example.com
cd ../..
pnpm db:migrate:remote
pnpm deploy
```

把 `wrangler.jsonc` 中 `vars` 的 `BETTER_AUTH_URL` 改成你的公网地址（使用自定义域名时，取消 `routes` 的注释）。设置页显示的回调地址以它开头。QQ 要求回调地址使用 443 端口的 HTTPS，Workers 域名或自定义域名都满足。

### 登录（Google / GitHub）

创建 OAuth 应用，回调地址填 `https://<你的域名>/api/auth/callback/google`（或 `/github`），然后用 `wrangler secret put` 设置 `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` 和/或 `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`。

### 接入 QQ 机器人

1. 在 [q.qq.com](https://q.qq.com) 创建机器人，复制 **AppID** 和 **AppSecret**。
2. 在 Stash 打开「设置 → 机器人 → 添加机器人」，粘贴进去，然后复制显示的回调地址。
3. 在 QQ 后台「开发 → 回调配置」里填入回调地址（QQ 会立即校验），并订阅消息事件，例如 `C2C_MESSAGE_CREATE`（单聊）和 `GROUP_AT_MESSAGE_CREATE`。
4. 把机器人加为好友，给它发一张图片。机器人还在沙箱阶段时，要先把自己加为测试成员。

### 免费套餐额度

Workers 每天 10 万次请求，D1 每天写入 10 万行、存储 5 GB，R2 存储 10 GB（超出后约 $0.015/GB/月），Queues 每天 1 万次操作（每个文件约 3 次）。通常最先用完的是存储。

### 持续部署

`.github/workflows/ci.yml` 会在每次推送时做类型检查、测试和构建；推送到 `main` 时还会应用 D1 迁移并部署。需要在仓库中添加 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID` 两个 secret。
