# 企业 OA 系统 — 部署指南

## 目录

1. [环境准备](#1-环境准备)
2. [本地生产部署](#2-本地生产部署)
3. [Docker Compose 部署](#3-docker-compose-部署)
4. [环境变量配置](#4-环境变量配置)
5. [数据库初始化](#5-数据库初始化)
6. [服务启停与日志](#6-服务启停与日志)
7. [数据持久化](#7-数据持久化)
8. [常见问题排查](#8-常见问题排查)

---

## 1. 环境准备

### 最低要求

| 依赖 | 版本 |
|------|------|
| Node.js | v18+（推荐 v22） |
| npm | v9+ |
| MySQL | 5.7 |
| Nginx | 1.24+（本地部署需要） |
| Docker | 20+（Docker 部署需要） |
| Docker Compose | 2.x（Docker 部署需要） |

### MySQL 数据库创建

```sql
-- 连接 MySQL
mysql -u root -p

-- 创建数据库
CREATE DATABASE oa_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 验证
SHOW DATABASES;
```

---

## 2. 本地生产部署

### 2.1 构建后端

```bash
cd backend

# 安装依赖
npm install

# 配置环境变量（参考第 4 节）
cp .env.example .env
# 编辑 .env，重点修改 DATABASE_URL、JWT_SECRET、COOKIE_SECRET

# 生成 Prisma Client
npx prisma generate

# 执行数据库迁移
npx prisma migrate deploy

# 导入种子数据（仅首次）
npx prisma db seed

# 构建
npm run build

# 启动生产服务
NODE_ENV=production node dist/index.js
```

### 2.2 构建前端

```bash
cd frontend

# 安装依赖
npm install

# 构建
npm run build

# 产物在 frontend/dist/ 目录
```

### 2.3 配置 Nginx

创建 Nginx 配置文件（例 `/etc/nginx/conf.d/oa-system.conf` 或 `nginx/conf.d/oa-system.conf`）：

```nginx
server {
    listen 80;
    server_name localhost;

    # 前端静态资源
    root /path/to/企业管理系统/frontend/dist;
    index index.html;

    # SPA 路由支持
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 反向代理
    location /api/ {
        proxy_pass http://127.0.0.1:3000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 2.4 启动服务

```bash
# 检查 Nginx 配置
nginx -t

# 启动/重载 Nginx
nginx -s reload

# 验证
curl http://localhost        # 前端页面
curl http://localhost/api/auth/me  # API 接口
```

---

## 3. Docker Compose 部署

> ⚠️ **状态说明：** Docker Compose 配置已完成编写，但开发机器未安装 Docker，未实际构建运行。以下为配置说明和预期操作步骤。

### 3.1 项目结构

部署时需要在项目根目录创建以下文件：

```
企业管理系统/
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── .env
│   └── ...
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf
│   └── ...
└── nginx/
    └── conf.d/
        └── default.conf
```

### 3.2 docker-compose.yml 示例

```yaml
version: '3.8'

services:
  mysql:
    image: mysql:5.7
    container_name: oa-mysql
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD:-root}
      MYSQL_DATABASE: oa_system
      MYSQL_CHARACTER_SET_SERVER: utf8mb4
      MYSQL_COLLATION_SERVER: utf8mb4_unicode_ci
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: oa-backend
    restart: unless-stopped
    depends_on:
      mysql:
        condition: service_healthy
    environment:
      DATABASE_URL: mysql://root:${MYSQL_ROOT_PASSWORD:-root}@mysql:3306/oa_system
      JWT_SECRET: ${JWT_SECRET}
      JWT_EXPIRES_IN: 24h
      COOKIE_SECRET: ${COOKIE_SECRET}
      PORT: 3000
      NODE_ENV: production
      FRONTEND_URL: http://localhost
    ports:
      - "3000:3000"

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: oa-frontend
    restart: unless-stopped
    ports:
      - "80:80"
    depends_on:
      - backend

volumes:
  mysql_data:
```

### 3.3 .env 文件（Docker 根目录）

```env
MYSQL_ROOT_PASSWORD=your_strong_password_here
JWT_SECRET=your_production_jwt_secret_at_least_32_chars
COOKIE_SECRET=your_production_cookie_secret_at_least_32_chars
```

### 3.4 后端 Dockerfile 示例

```dockerfile
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production=false

COPY prisma ./prisma/
RUN npx prisma generate

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
```

### 3.5 前端 Dockerfile 示例

```dockerfile
FROM node:22-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### 3.6 操作命令

```bash
# 首次启动（构建镜像 + 启动）
docker-compose up -d --build

# 执行数据库迁移（首次部署后）
docker-compose exec backend npx prisma migrate deploy

# 导入种子数据
docker-compose exec backend npx prisma db seed

# 查看运行状态
docker-compose ps

# 查看日志
docker-compose logs -f
docker-compose logs -f backend    # 仅后端
docker-compose logs -f frontend   # 仅前端
docker-compose logs -f mysql      # 仅数据库

# 停止服务
docker-compose down

# 停止并清除数据卷（⚠️ 会删除数据库数据）
docker-compose down -v

# 重启单个服务
docker-compose restart backend
```

---

## 4. 环境变量配置

### 后端 .env 完整说明

```env
# ============================================================
# 数据库连接
# 格式：mysql://用户名:密码@主机:端口/数据库名
# ⚠️ 注意：.env.example 中默认值是 PostgreSQL 格式，必须手动改为 MySQL 格式
# ============================================================
DATABASE_URL="mysql://root:***@localhost:3306/oa_system"

# ============================================================
# JWT 配置
# 生产环境 JWT_SECRET 必须设置为 32 位以上随机字符串
# 生成方法：node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# ============================================================
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_EXPIRES_IN="24h"

# ============================================================
# Cookie 配置
# 生产环境 COOKIE_SECRET 必须设置
# ============================================================
COOKIE_SECRET="your-super-secret-cookie-key-change-in-production"

# ============================================================
# 服务器配置
# ============================================================
PORT=3000
NODE_ENV=production

# ============================================================
# 前端地址（CORS 允许的来源）
# 生产环境通常不需要修改，Nginx 同域代理
# ============================================================
FRONTEND_URL="http://localhost"
```

### ⚠️ .env.example 已知问题

当前 `.env.example` 中的 `DATABASE_URL` 默认值为：

```
DATABASE_URL="postgresql://user:***@localhost:5432/enterprise_mgmt"
```

这是**错误的**。本项目使用 MySQL，正确格式为：

```
DATABASE_URL="mysql://root:***@localhost:3306/oa_system"
```

---

## 5. 数据库初始化

### 5.1 迁移命令说明

| 命令 | 用途 | 使用场景 |
|------|------|---------|
| `npx prisma migrate dev` | 开发环境迁移（创建迁移文件 + 应用） | 本地开发 |
| `npx prisma migrate deploy` | 生产环境迁移（仅应用已有迁移） | 部署上线 |
| `npx prisma db seed` | 导入种子数据 | 首次部署 |
| `npx prisma generate` | 生成 Prisma Client | 每次 schema 变更后 |
| `npx prisma studio` | 可视化数据库管理 | 开发调试 |

### 5.2 迁移文件

项目包含两个迁移：

1. `20260905032734_init` — 初始 schema（用户、部门、公告、阅读记录）
2. `20260909010827_add_leave_edit_resubmit_actions` — 请假模块（请假单、操作日志）

### 5.3 种子数据

种子脚本会创建：
- 管理员账号：`admin` / `admin123`
- 示例部门：技术部、市场部、人事部
- 示例员工：`zhangsan`（技术部负责人）、`lisi`（普通员工）

> ⚠️ 种子数据使用 `upsert`，重复执行不会产生重复数据。

---

## 6. 服务启停与日志

### 本地部署

```bash
# 启动后端（前台运行）
cd backend && NODE_ENV=production node dist/index.js

# 启动后端（后台运行，使用 nohup）
cd backend && nohup NODE_ENV=production node dist/index.js > backend.log 2>&1 &

# 查看后端日志
tail -f backend/backend.log

# 停止后端
kill $(lsof -t -i:3000)

# 重载 Nginx
nginx -s reload

# 查看 Nginx 错误日志
tail -f /var/log/nginx/error.log
```

### Docker 部署

```bash
# 启动
docker-compose up -d

# 停止
docker-compose down

# 重启
docker-compose restart

# 查看日志
docker-compose logs -f --tail=100
```

---

## 7. 数据持久化

### Docker 部署

MySQL 数据通过 Docker Volume `mysql_data` 持久化，`docker-compose down` 不会删除数据。

```bash
# 仅停止（保留数据）
docker-compose down

# 停止并删除数据卷（⚠️ 数据丢失）
docker-compose down -v

# 备份数据库
docker-compose exec mysql mysqldump -u root -p oa_system > backup.sql

# 恢复数据库
docker-compose exec -T mysql mysql -u root -p oa_system < backup.sql
```

### 本地部署

MySQL 数据存储在 MySQL 数据目录中（phpstudy_pro 默认路径），备份方法：

```bash
mysqldump -u root -p oa_system > backup_$(date +%Y%m%d).sql
```

---

## 8. 常见问题排查

### 8.1 端口冲突

**现象：** `EADDRINUSE: address already in use :::3000`

**解决：**
```bash
# 查找占用端口的进程
netstat -ano | findstr :3000    # Windows
lsof -i :3000                   # Linux/Mac

# 终止进程或修改 .env 中的 PORT
```

### 8.2 MySQL 连接失败

**现象：** `Can't connect to MySQL server` 或 `Unknown database 'oa_system'`

**排查：**
```bash
# 1. 检查 MySQL 是否运行
mysql -u root -p -e "SELECT 1"

# 2. 检查数据库是否存在
mysql -u root -p -e "SHOW DATABASES LIKE 'oa_system'"

# 3. 检查连接字符串格式（必须是 mysql:// 不是 postgresql://）
echo $DATABASE_URL

# 4. 检查用户权限
mysql -u root -p -e "SHOW GRANTS FOR 'root'@'localhost'"
```

### 8.3 Prisma 迁移失败

**现象：** `Migration ... failed to apply`

**解决：**
```bash
# 重置数据库（⚠️ 会清空数据）
npx prisma migrate reset

# 重新迁移
npx prisma migrate dev

# 如果是生产环境，手动修复后标记为已应用
npx prisma migrate resolve --applied <migration_name>
```

### 8.4 Nginx 502 Bad Gateway

**现象：** 访问页面返回 502

**排查：**
```bash
# 1. 检查后端是否在运行
curl http://localhost:3000/api/auth/me

# 2. 检查 Nginx 配置
nginx -t

# 3. 查看 Nginx 错误日志
tail -f /var/log/nginx/error.log

# 4. 检查 proxy_pass 地址是否正确
grep proxy_pass /etc/nginx/conf.d/oa-system.conf
```

### 8.5 SPA 404（刷新页面白屏）

**现象：** 首页正常，刷新非根路径返回 404

**原因：** Nginx 未配置 SPA 路由回退

**解决：** 确保 Nginx 配置中包含：
```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

### 8.6 JWT_SECRET 未设置导致启动失败

**现象：** 生产环境启动报错 `JWT_SECRET is required in production`

**解决：** 在 `.env` 中设置 JWT_SECRET：
```bash
# 生成随机密钥
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# 将输出粘贴到 .env 的 JWT_SECRET=
```

### 8.7 CORS 错误

**现象：** 前端请求被拦截，控制台显示 CORS 错误

**排查：**
```bash
# 1. 检查 .env 中 FRONTEND_URL 是否与实际前端地址一致
grep FRONTEND_URL backend/.env

# 2. 开发环境应为 http://localhost:5173
# 3. 生产环境（Nginx 同域）应为 http://localhost 或实际域名
```


## 9. 内部知识分享部署影响（已完成）

状态：已完成（Day 8）。部署拓扑、端口和环境变量不变；发布新版本前需应用 Migration `20260913072642_add_knowledge_sharing`，并执行 seed 幂等写入预置分类（操作指南、技术经验、工作复盘、其他）。正文按纯文本返回，前端使用 `white-space: pre-wrap` 渲染，未使用 `dangerouslySetInnerHTML`。

## 10. 知识社区增强部署（已完成）

状态：已完成（Day 9）。新增 Migration `20260913111447_add_knowledge_community_enhancement`，部署前需应用。

### 10.1 Migration 说明

新增 4 张表：`knowledge_comments`（评论，含软删除字段 `deleted_at`、`deleted_by_id`、`delete_type`、`delete_reason`）、`knowledge_article_likes`（点赞，`article_id + user_id` 复合唯一约束）、`knowledge_article_favorites`（收藏，同样复合唯一约束）、`knowledge_moderation_logs`（审核日志，记录 `TAKE_DOWN`、`REVIEW_SUBMITTED`、`RESTORE_APPROVED`、`RESTORE_REJECTED`、`COMMENT_REMOVED` 操作）。`knowledge_articles.status` 新增 `TAKEN_DOWN` 和 `PENDING_REVIEW` 枚举值。

### 10.2 AI 环境变量

AI 功能需要在 `.env` 中配置以下变量：

```env
# ============================================================
# AI 配置（知识社区 AI 助手）
# 缺少 AI_API_KEY 时，AI 接口返回 503，普通知识业务不受影响
# ============================================================
AI_API_KEY=sk-xxxx          # 必填，AI 服务 API Key
AI_BASE_URL=https://api.deepseek.com   # 可选，默认空字符串（需配置实际地址）
AI_MODEL=deepseek-chat       # 可选，默认 deepseek-chat
AI_TIMEOUT_MS=30000         # 可选，默认 30000ms
AI_MAX_PER_MINUTE=10        # 可选，每分钟请求限制，默认 10
AI_MAX_CONCURRENT=3         # 可选，最大并发数，默认 3
AI_DAILY_QUOTA=50           # 可选，每日配额，默认 50
```

### 10.3 速率限制说明

AI 速率限制为 **内存实现**，具有以下特征：

- 服务重启后计数器重置
- 多实例部署时各实例独立计数，不共享
- 仅适用于单进程部署场景
- 生产环境如需跨实例共享限制，需替换为 Redis 等外部存储

### 10.4 密钥安全

- `AI_API_KEY` 不得写入 Docker 镜像、Git 仓库或应用日志
- 缺少 `AI_API_KEY` 时，AI 接口返回 `503 AI_SERVICE_UNAVAILABLE`，普通知识操作（浏览、评论、点赞等）不受影响
- 真实模型和容器部署验证尚未执行

### 10.5 种子数据

知识分类已在 Day 8 seed 中预置（操作指南、技术经验、工作复盘、其他），本次无新增种子数据。
