# 财经大V未来赛道与产品观点征集 H5

一个移动端优先的独立 H5 初版，包含：

- 征集说明页
- 表单填写页
- 提交成功页
- `code` 专属链接识别与透传
- 前后端基础校验
- 本地 JSON 数据持久化接口
- 可切换到 Postgres 数据库存储
- 可切换到飞书多维表格存储

## 技术栈

- Next.js App Router
- React
- Tailwind CSS
- Node `fs` 本地文件存储

## 本地启动

1. 安装 Node.js 20+
2. 安装依赖

```bash
npm install
```

3. 启动开发环境

```bash
npm run dev
```

4. 打开浏览器访问

```bash
http://localhost:3000/?code=KOL001
```

## 数据落地

默认情况下，提交后数据会写入：

`data/submissions.json`

如果部署环境配置了以下变量，则会自动切换存储方式：

- 配置了 `FEISHU_USER_ACCESS_TOKEN`、`FEISHU_BITABLE_APP_TOKEN`、`FEISHU_BITABLE_TABLE_ID`
  则优先使用飞书多维表格的用户授权模式
- 如果同时配置了 `FEISHU_USER_REFRESH_TOKEN`、`FEISHU_APP_ID`、`FEISHU_APP_SECRET`
  则服务端会在用户 token 即将过期或已经过期时自动刷新并重试一次
- 配置了 `FEISHU_APP_ID`、`FEISHU_APP_SECRET`、`FEISHU_BITABLE_APP_TOKEN`、`FEISHU_BITABLE_TABLE_ID`
  则使用飞书多维表格的应用身份模式
- 否则如果配置了 `DATABASE_URL`
  则使用 Postgres
- 都没有时
  则使用本地 `data/submissions.json`

同时也可以直接在本地后台页查看：

`http://localhost:3000/admin`

每条记录会包含：

- `code`
- `submit_time`
- `nickname`
- `expertise`
- `expertise_other`
- `follower_level`
- `tracks`
- `tracks_other`
- `fund_companies`
- `fund_companies_other`
- `product_name_1`
- `product_name_2`
- `product_name_3`
- `product_name_4`
- `product_name_5`
- `product_name_6`
- `reasons`
- `reasons_other`

同时额外生成若干 `*_text` 字段，便于后续直接在表格视图中查看。

## Render 部署说明

项目已经包含 [render.yaml](/Users/xieyujing6/Desktop/vibe%20coding/render.yaml:1)，可以直接用于 Render 的 Web Service 部署。

默认配置：

- Build Command: `npm install && npm run build`
- Start Command: `npm run start -- -H 0.0.0.0 -p $PORT`
- Node 版本: `20`

重要说明：

- 当前项目默认把提交数据写到本地文件。
- Render 官方文档说明，服务默认使用临时文件系统；如果不挂载 persistent disk，服务重启或重新部署后，本地文件会丢失。
- 官方文档同时说明，persistent disk 只能挂到付费 Web Service 上。

参考官方文档：

- [Render Web Services](https://render.com/docs/web-services)
- [Render Persistent Disks](https://render.com/docs/disks)
- [Render Connect GitHub](https://render.com/docs/github)

如果你只是先快速上线测试：

- 可以直接部署当前版本
- 但要知道数据在重新部署后可能丢失

如果你要长期正式收集数据：

- 建议在 Render 环境变量里配置 `DATABASE_URL`
- 最省心的做法是新建一个 Supabase 项目，然后把它提供的 Postgres connection string 填进 Render
- 或者把 Render 服务升级到支持 Persistent Disk 的付费实例，并把 `DATA_DIR` 改成 `/var/data`

### 推荐做法：接 Postgres

项目现在已经内置了 Postgres 适配层，不需要再改代码逻辑。

你只需要在 Render 里新增一个环境变量：

```bash
DATABASE_URL=postgres://...
```

然后重新部署，系统会自动创建 `submissions` 表，并把后续提交写进去。

### 也支持接飞书多维表格

项目已经内置飞书写入和读取逻辑，支持两种接法。

方式一：直接使用用户授权 token，最适合快速验证联调：

```bash
FEISHU_USER_ACCESS_TOKEN=xxx
FEISHU_USER_REFRESH_TOKEN=xxx
FEISHU_APP_ID=cli_xxx
FEISHU_APP_SECRET=xxx
FEISHU_BITABLE_APP_TOKEN=bascnxxx
FEISHU_BITABLE_TABLE_ID=tblxxx
```

方式二：使用应用身份：

```bash
FEISHU_APP_ID=cli_xxx
FEISHU_APP_SECRET=xxx
FEISHU_BITABLE_APP_TOKEN=bascnxxx
FEISHU_BITABLE_TABLE_ID=tblxxx
```

飞书多维表格建议至少创建这些列，字段名保持一致：

- `id`
- `code`
- `submit_time`
- `nickname`
- `follower_level`
- `expertise_text`
- `tracks_text`
- `fund_companies_text`
- `product_names_text`
- `reasons_text`
- `raw_payload`

这些列都可以先用文本类型，最省事。

## 后续扩展建议

- 将 `lib/storage.ts` 替换为 Supabase / PostgreSQL / MySQL 写入逻辑
- 增加导出接口或对接飞书多维表格
- 在部署环境中接入基础风控，例如频次限制和来源校验
