# 企业 OA 协同办公系统 V1.0

## 项目概述

面向约 50 人的小型企业内部 OA 系统，支持人员管理、公告发布、请假审批等核心业务。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React + TypeScript + Vite + Ant Design |
| 后端 | Node.js + Express + TypeScript + Prisma ORM |
| 数据库 | MySQL 5.7 |
| 认证 | JWT + HttpOnly Cookie |
| 测试 | Vitest + Supertest |
| 部署 | Docker Compose + Nginx（待完成） |

## 目录结构

```
从0到1写一个完整的项目/
├── 01-需求分析/           ← 业务需求、功能定义
├── 02-产品设计/           ← 页面需求和API输入
├── 03-技术方案/           ← 技术选型、架构、数据库、API设计
├── 04-开发规范/           ← 前后端模块划分
├── 05-UI设计/             ← 低保真布局草图 (29张)
├── 06-项目日志/           ← 每日开发日志
├── frontend/              ← React + TypeScript + Vite
├── backend/               ← Express + TypeScript + Prisma
├── .gitignore
└── README.md
```

## 开发环境

- Node.js v22.22.3
- npm 10.9.8
- MySQL 5.7.26 (phpstudy_pro)
- Git 2.52.0
- Docker: 未安装（部署阶段处理）

## 快速开始

### 后端

```bash
cd backend
npm install
cp .env.example .env  # 修改数据库连接信息
npx prisma generate
npx prisma migrate dev
npx prisma db seed
npm run dev
```

### 前端

```bash
cd frontend
npm install
npm run dev
```

### 测试

```bash
cd backend
npm test
```

## 默认账号

| 账号 | 密码 | 角色 |
|------|------|------|
| admin | admin123 | 系统管理员 |
| zhangsan | employee123 | 员工（技术部负责人） |
| lisi | employee123 | 员工 |

## 开发进度

### Day 1 ✅ 项目初始化与认证基础

- [x] 项目初始化（Git、.gitignore）
- [x] 后端 Express + TypeScript 项目骨架
- [x] 前端 React + TypeScript + Vite 项目
- [x] Prisma Schema + 首次数据库迁移
- [x] 种子数据（管理员、部门、员工）
- [x] 统一响应格式、异常处理、日志
- [x] JWT + HttpOnly Cookie 认证
- [x] 登录、退出、当前用户、修改密码接口
- [x] 强制改密中间件
- [x] Vitest + Supertest 集成测试（11项全通过）
- [x] 前后端 build 通过

### Day 2 待开发

- [ ] 员工管理（CRUD）
- [ ] 部门管理（CRUD + 负责人任命/更换）

## 文档阅读顺序

1. **01-需求分析** - 了解项目要做什么
2. **02-产品设计** - 了解页面需求和API输入
3. **03-技术方案** - 了解技术实现方案
4. **04-开发规范** - 了解代码组织方式
5. **05-UI设计** - 参考界面布局

## 环境限制

- Docker 未安装，部署阶段需要安装
- MySQL 使用 phpstudy_pro，密码为 root/root（仅限本地开发）
