# Stash

[English](./README.md) | **简体中文** | [日本語](./README.ja.md)

**聊天里的图片和消息，一处收好。** 自托管的单用户收件箱：通过各聊天平台的机器人接收消息并保存，图片和文件都会下载到你自己的存储里。整个项目运行在 Cloudflare Workers + D1 + R2 + Queues 上，个人使用在免费套餐内即可。目前先支持 QQ；平台层按可扩展的方式设计，之后可以接入 Telegram 等平台。

## 功能

- **QQ 机器人**：在 QQ 开放平台创建机器人，把 AppID / AppSecret 填到设置里，再把 Stash 显示的回调地址填到 QQ 后台。Stash 会自动响应回调地址校验（op 13），并校验每个事件的 Ed25519 签名。会保存单聊、群聊 @ 消息和频道消息；平台重复推送的事件只保存一次
- **可靠保存文件**：回调里只把消息写入 D1 并把附件放进队列，所以能很快响应 QQ。队列消费者把每个文件以流的方式写入 R2，不在内存中缓冲，几十甚至几百 MB 的文件也能保存（长度已知：单次流式 PUT；长度未知或超过 5 GB：按 10 MB 分片上传），保存后还会核对大小与 `Content-Length` 是否一致
- **重试**：网络错误、超时、下载不完整以及 408 / 429 / 5xx 会自动重试 9 次，间隔从 30 秒逐步退避到 2 小时（合计约 5 小时，在免费套餐 24 小时的队列保留期内）。链接过期（其他 4xx）会直接标记失败。死信队列兜底消费者崩溃的情况；另有每 10 分钟一次的巡检，会把丢失了队列消息或下载中断的附件重新排队。失败的文件可以在网页上逐个或一次性全部重试
- **网页端**：消息流（带图片缩略图）、原图查看（图片、视频、音频）与下载；可按机器人、「有附件」「下载失败」筛选；显示下载队列统计
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
