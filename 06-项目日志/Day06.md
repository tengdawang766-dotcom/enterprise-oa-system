# Day 6 - 全系统回归与打磨

## 目标

对 Day 1～Day 5 进行全系统联调与回归，修复跨模块问题，完善前端交互和页面一致性，检查权限、安全、错误处理和数据一致性，整理代码质量。

## 发现并修复的问题

### 1. Layout 无限重渲染（CRITICAL）

**现象**：AdminLayout 和 EmployeeLayout 的菜单渲染测试超时 30 秒。

**根因**：`getSelectedKey()` 函数每次渲染返回新数组引用，AntD Menu 的 `selectedKeys` prop 检测到引用变化触发 `useEffect` → `setState` → 重新渲染 → 无限循环。

**修复**：用 `useMemo(() => [...], [location.pathname])` 缓存计算结果。

### 2. 状态标签不一致（MEDIUM）

**现象**：4 个页面各自定义 `STATUS_MAP`/`STATUS_LABEL`/`STATUS_COLOR`，颜色值不统一（`'green'` vs `'success'`）。

**修复**：创建 `frontend/src/utils/status-labels.ts` 单一数据源，所有页面统一引用。

### 3. 日期时区策略缺失（HIGH）

**现象**：
- 请假日期用 `T00:00:00Z` 创建，公告时间用 `new Date()`，阅读记录用 MySQL `NOW()`
- `me.service.ts` 的 `getDashboard()` 返回原始 Date 对象，而 `leave.service.ts` 格式化为 `YYYY-MM-DD`
- 前端混用 `.slice(0,10)`、`dayjs().format()`、`new Date().toLocaleString()` 三种方式

**修复**：
- 后端创建 `common/utils/date-format.ts`（`formatDateOnly` / `formatTimestamp`）
- 业务日期返回 `YYYY-MM-DD`，时间点返回 ISO 8601
- 公告阅读记录改用 JS `new Date()` 替代 MySQL `NOW()`
- 前端创建 `utils/date-format.ts`（`formatDate` / `formatDateTime` / `formatShortDate`）
- 所有页面统一使用

### 4. parseIdParam 重复定义（MEDIUM）

**现象**：6 个控制器中完全相同的 `parseIdParam` 函数复制粘贴。

**修复**：提取到 `common/utils/parse-id.ts`，统一 import。

### 5. 敏感字段查询（MEDIUM）

**现象**：`user.service.ts` 的 `findUnique` 无 `select`，加载 `passwordHash` 和 `tokenVersion` 到内存。

**修复**：添加 `select: { id: true }`。

### 6. JWT Secret 默认值（MEDIUM）

**现象**：生产环境缺少 `JWT_SECRET` 时使用硬编码默认值，可被伪造。

**修复**：生产环境缺少时抛出异常，开发环境允许默认值。`.env.example` 添加文档说明。

### 7. 跨平台构建清理（LOW）

**现象**：`rm -rf dist` 在 Windows CMD/PowerShell 下不工作。

**修复**：改用 `node -e "const fs=require('fs');fs.rmSync('dist',{recursive:true,force:true})"`。

### 8. 死代码（LOW）

**修复**：删除 `leave.service.ts` 中未使用的 `isCurrentManager` 方法，清理 6 个控制器中未使用的 `BusinessException`/`ErrorCode` import。

### 9. 审批页面错误体验（LOW）

**现象**：ApprovalPage 加载失败只用 `message.error()` toast 提示，无重试机制。

**修复**：添加 `pendingError`/`historyError` 状态，失败时显示 `<Result>` + 重试按钮。

## 技术决策

### 时间策略

| 类型 | 存储 | API 返回 | 前端显示 |
|------|------|----------|----------|
| 业务日期（startDate/endDate） | MySQL DATE | `YYYY-MM-DD` | 直接显示 |
| 时间点（createdAt/publishedAt） | MySQL DATETIME | ISO 8601 | `dayjs` 格式化 |

### 懒加载

所有业务页面使用 `React.lazy` + `Suspense`，主入口只包含路由 guard 和 layout。

### 构建体积

- 主入口 `index.js`: 264.98 kB (gzip 85.42 kB)
- 页面级代码已分包（EmployeeDashboardPage 19 kB, ApprovalPage 16 kB 等）

## 测试结果

| 顺序 | 后端 | 前端 |
|------|------|------|
| build → test | 177/177 ✅ | 95/95 ✅ |
| test → build → test | 177/177 ✅ | 95/95 ✅ |

## 浏览器验收

| 角色 | 验证项 | 结果 |
|------|--------|------|
| 管理员 | 登录→改密→部门→员工→公告→通讯录→404→退出 | ✅ |
| 部门负责人 | 登录→工作台（待审批/统计）→审批菜单→退出 | ✅ |
| 普通员工 | 登录→工作台→无审批菜单→无管理入口→退出 | ✅ |
| 异常 | 403 无权限页面、404 页面、未登录跳转 | ✅ |
| 控制台 | 无 JS 错误、无 React 警告 | ✅ |

## 数据清理

- 删除测试部门（ID 21, 22）
- 恢复 admin 密码为 `admin123`，`mustChangePassword=true`
- 种子数据完整保留

## 修改文件清单

**后端（14 文件）**：
- `package.json` - 跨平台构建清理
- `vitest.config.ts` - 显式 exclude dist
- `.env.example` - JWT Secret 文档
- `infrastructure/config/index.ts` - 生产环境 Secret 校验
- `common/utils/parse-id.ts` - 新增共享 ID 解析
- `common/utils/date-format.ts` - 新增日期格式化
- `modules/leave/leave.service.ts` - 日期格式化 + 删除死代码
- `modules/me/me.service.ts` - Dashboard 日期格式化
- `modules/announcement/announcement.service.ts` - 统一时间源
- `modules/user/user.service.ts` - 敏感字段查询优化
- `modules/department/department.service.ts` - P2002 竞态保护
- 6 个 controller - 提取 parseIdParam + 清理 unused import

**前端（16 文件）**：
- `package.json` - 跨平台 clean 脚本
- `vitest.config.ts` - 显式 exclude dist
- `App.tsx` - 懒加载 + ErrorBoundary
- `layouts/AdminLayout.tsx` - useMemo selectedKeys
- `layouts/EmployeeLayout.tsx` - useMemo selectedKeys
- `components/ErrorBoundary.tsx` - 新增
- `utils/status-labels.ts` - 新增统一状态标签
- `utils/date-format.ts` - 新增统一日期格式化
- `pages/NotFoundPage.tsx` - 角色感知跳转
- `pages/ApprovalPage.tsx` - 错误状态 + 重试
- `pages/EmployeeDashboardPage.tsx` - 日期格式化
- `pages/MyLeaveListPage.tsx` - 日期格式化
- `pages/LeaveDetailPage.tsx` - 日期格式化
- `pages/AnnouncementListPage.tsx` - 日期格式化
- `pages/AnnouncementDetailPage.tsx` - 日期格式化
- `pages/admin/AnnouncementManagementPage.tsx` - 统一状态标签 + 日期格式化
- `pages/admin/EmployeePage.tsx` - 统一状态标签
- 3 个测试文件 - 修复超时和断言
