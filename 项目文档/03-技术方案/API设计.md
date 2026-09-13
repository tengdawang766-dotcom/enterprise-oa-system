# 企业 OA 协同办公系统 V1.0 RESTful API 设计文档

> 文档版本：V1.0
> API 版本：v1
> API Base Path：`/api/v1`

------

# 1. 文档说明

## 1.1 文档目的

本文档将已经确认的企业 OA V1.0 业务规则转化为可直接指导后端 Controller、Service、权限校验、事务设计和数据库访问层开发的 RESTful API 设计。

系统面向约 50 人的单一企业，V1.0 聚焦人员、部门、负责人、通讯录、公告、公告阅读、请假、单级审批和工作概览，不建设通用 OA 平台。fileciteturn1file2L322-L335

------

## 1.2 规则标记

本文档使用三种标记：

- **【原业务规则】**：输入文档已经明确确认。
- **【直接推导】**：根据已确认规则能够直接推出。
- **【设计建议】**：API 技术设计选择，不属于原始产品规则，可在开发前调整。

规则优先级：

```
API 设计输入文档
        ↓
数据库设计
        ↓
RESTful API 技术设计建议
```

数据库不得反向修改已经确认的业务规则。

------

## 1.3 核心模型

【原业务规则】

基础角色只有：

```
ADMIN
EMPLOYEE
```

不存在：

```
DEPARTMENT_MANAGER
```

负责人模型为：

```
EMPLOYEE
+
departments.manager_user_id 指向该员工
=
当前部门负责人
```

因此所有负责人权限必须在服务端根据当前组织关系判断。客户端传递诸如：

```
{
  "isManager": true
}
```

不得成为授权依据。

负责人只能额外获得明确分配给自己的审批能力，而不能查看全公司的请假。fileciteturn1file12L1354-L1381

------

# 2. RESTful 设计原则

## 2.1 资源优先

普通实体使用资源式 URL：

```
/users
/departments
/announcements
/leave-requests
```

当前用户范围使用：

```
/me
/me/leave-requests
/me/approval-tasks
```

------

## 2.2 业务动作不机械 CRUD

以下行为存在明确业务状态机或复杂前置条件：

```
登录
退出
重置密码
停用账号
发布公告
撤回公告
打开公告并记录首次阅读
审批通过
驳回
撤销请假
```

因此允许使用动作型末级路径，例如：

```
POST /announcements/{id}/publish
POST /leave-requests/{id}/approve
```

这样比将所有行为强制转换为字段 PATCH 更清晰。

------

## 2.3 服务端是最终业务规则执行者

前端可以：

- 隐藏按钮；
- 控制入口；
- 预先过滤候选人。

但后端仍必须重新验证：

- 身份；
- 基础角色；
- 当前负责人职责；
- 数据归属；
- 当前状态；
- 当前组织关系；
- 并发版本。

任何 Path 中的 ID 都不得直接视为权限证明。

------

# 3. API 基础规范

## 3.1 API 前缀

统一使用：

```
/api/v1
```

例如：

```
GET /api/v1/me
GET /api/v1/departments
POST /api/v1/leave-requests
```

### 版本策略

【设计建议】

V1.0 采用 URL 主版本号：

```
/api/v1
```

兼容性修改继续保留在 `v1`。

只有产生明显破坏性变更，例如：

- 请求结构完全变化；
- 状态机变化；
- 权限语义变化；

才考虑：

```
/api/v2
```

------

## 3.2 URL 命名

统一规则：

- 使用英文；
- 资源使用名词；
- 集合资源使用复数；
- URL 使用 `kebab-case`；
- JSON 字段使用 `camelCase`；
- 数据库存储字段继续使用 `snake_case`。

例如：

```
/leave-requests
/announcement-reads
/manager-candidates
```

JSON：

```
{
  "departmentId": 10,
  "mustChangePassword": true
}
```

数据库：

```
department_id
must_change_password
```

------

## 3.3 HTTP Method

| Method | 使用原则                         |
| ------ | -------------------------------- |
| GET    | 查询，不改变普通业务状态         |
| POST   | 创建资源或执行明确业务动作       |
| PATCH  | 部分更新资源                     |
| PUT    | 建立或整体替换一个确定子资源关系 |
| DELETE | 删除资源或解除明确关系           |

例如：

```
POST   /departments
PATCH  /departments/{id}
DELETE /departments/{id}

PUT    /departments/{id}/manager
DELETE /departments/{id}/manager
```

负责人关系天然是部门的单值子资源，因此使用 PUT / DELETE 比 `POST /appoint-manager` 更符合资源语义。

------

## 3.4 请求数据位置

### Path

用于资源标识：

```
/users/{userId}
/departments/{departmentId}
```

### Query

用于：

- 搜索；
- 筛选；
- 排序；
- 分页。

例如：

```
?page=1&pageSize=20&status=PENDING
```

### Request Body

用于：

- 创建；
- 修改；
- 业务动作参数。

不得依赖 Body 中的：

```
currentUserId
currentRole
isManager
```

识别当前用户。

当前用户必须来自认证上下文。

------

## 3.5 时间格式

### 日期

请假日期：

```
YYYY-MM-DD
```

例如：

```
2026-09-10
```

【原业务规则】

请假自然日统一按照北京时间 `Asia/Shanghai` 计算：

- 首尾日期都计入；
- 周末计入；
- 法定节假日计入；
- 最大 30 个自然日。fileciteturn0file1L809-L830

### 时间点

【设计建议】

数据库：

```
UTC DATETIME
```

API：

ISO 8601：

```
2026-09-04T10:30:00Z
```

前端按照用户界面要求转换北京时间。

由于原资料尚未确定除请假日期以外的时间统一保存/展示时区，因此这是技术建议而不是产品规则。fileciteturn4file0L30-L38

------

## 3.6 分页

所有列表统一：

```
page
pageSize
```

要求：

```
page >= 1
pageSize >= 1
```

【设计建议】

```
默认 page = 1
默认 pageSize = 20
最大 pageSize = 100
```

产品资料只确认“列表必须分页”，默认数量仍属于待确认项。fileciteturn1file5L645-L651

------

## 3.7 排序

统一：

```
sortBy
sortOrder
```

例如：

```
sortBy=createdAt
sortOrder=desc
```

仅允许每个接口白名单中的排序字段。

不得直接把用户的 `sortBy` 拼接 SQL。

------

# 4. 统一认证与权限规范

## 4.1 公开接口

仅：

```
POST /auth/sessions
```

允许未登录访问。

------

## 4.2 必须认证

除登录外，其他 V1.0 API 均要求有效登录状态。

认证成功后至少取得：

```
{
  "userId": 123,
  "role": "EMPLOYEE",
  "tokenVersion": 2
}
```

但负责人职责需要实时查询组织关系，不能从长期缓存的客户端声明中决定。

------

## 4.3 停用账号

每次受保护请求均必须检查：

```
users.status = ENABLED
```

即使 Token 尚未自然过期，只要账号已经：

```
DISABLED
```

也禁止继续访问。

数据库已经设计 `token_version` 用于密码变化后使旧凭证失效。fileciteturn0file1L83-L113

------

## 4.4 强制修改密码

当：

```
must_change_password = true
```

只允许：

```
GET    /me
PATCH  /me/password
DELETE /auth/session
```

以及维持认证必要的内部流程。

禁止：

```
通讯录
公告
请假
审批
工作概览
管理后台
```

这与业务输入文档的强制改密访问边界一致。fileciteturn2file3L307-L338

------

## 4.5 基础角色

### ADMIN

可以：

- 账号管理；
- 部门管理；
- 负责人管理；
- 公告管理；
- 管理员概览。

不得：

- 提交请假；
- 审批请假；
- 查看员工请假内容。

### EMPLOYEE

可以：

- 本人资料；
- 通讯录；
- 员工公告；
- 本人请假；
- 本人概览。

------

## 4.6 当前负责人权限

负责人仍然满足：

```
role = EMPLOYEE
```

负责人扩展能力必须实时判断：

```
EXISTS departments
WHERE manager_user_id = currentUserId
```

审批某申请还必须继续判断：

```
leave_requests.approver_id = currentUserId
```

不能仅判断“此人是负责人”。

数据库设计同样明确要求审批权限必须检查申请的 `approver_id`。fileciteturn1file1L229-L245

------

## 4.7 IDOR 防护

例如访问：

```
GET /users/100
GET /departments/20
POST /leave-requests/500/approve
```

后端必须同时验证：

```
当前身份
+
资源是否存在
+
资源归属
+
当前状态
+
业务权限
```

不能因为前端正常情况下不会修改 URL，就省略验证。

------

# 5. 统一请求、响应、分页规范

## 5.1 成功响应

单个资源：

```
{
  "success": true,
  "data": {
    "id": 1
  }
}
```

------

## 5.2 分页响应

```
{
  "success": true,
  "data": {
    "items": [],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 53,
      "totalPages": 3
    }
  }
}
```

------

## 5.3 无返回业务动作

例如退出：

```
204 No Content
```

无响应 Body。

------

## 5.4 错误响应

统一：

```
{
  "success": false,
  "error": {
    "code": "LEAVE_STATE_CONFLICT",
    "message": "当前申请状态已经发生变化，请刷新后重试",
    "fieldErrors": []
  }
}
```

字段校验：

```
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求参数不合法",
    "fieldErrors": [
      {
        "field": "reason",
        "message": "请假原因最多 500 字"
      }
    ]
  }
}
```

生产环境不得返回：

- SQL；
- 表结构；
- ORM 查询；
- Stack Trace；
- 密钥；
- 数据库连接；
- 文件系统路径。

业务输入文档明确要求内部错误和敏感信息不得向普通用户暴露。fileciteturn1file5L586-L625

------

# 6. HTTP 状态规范

| 场景          | HTTP      |
| ------------- | --------- |
| 查询成功      | 200       |
| 创建成功      | 201       |
| 更新成功      | 200       |
| 动作成功      | 200 / 204 |
| 删除成功      | 204       |
| 请求字段非法  | 400       |
| 未登录        | 401       |
| Token 失效    | 401       |
| 强制改密限制  | 403       |
| 无业务权限    | 403       |
| 资源不存在    | 404       |
| 状态/并发冲突 | 409       |
| 唯一资源冲突  | 409       |
| 服务异常      | 500       |

HTTP 状态描述协议级结果。

业务错误码描述具体业务原因。

例如：

```
409 + USERNAME_ALREADY_EXISTS
409 + LEAVE_STATE_CONFLICT
```

------

# 7. 统一业务错误设计

格式：

```
模块_原因
```

例如：

```
AUTH_INVALID_CREDENTIALS
USER_PENDING_LEAVE_EXISTS
DEPARTMENT_NOT_EMPTY
LEAVE_STATE_CONFLICT
```

通用错误：

```
VALIDATION_ERROR
UNAUTHENTICATED
AUTH_SESSION_EXPIRED
ACCOUNT_DISABLED
PASSWORD_CHANGE_REQUIRED
FORBIDDEN
RESOURCE_NOT_FOUND
CONFLICT
INTERNAL_ERROR
```

避免为相同语义机械制造大量错误码。

------

# 8. API 资源模型

## 8.1 核心资源

### User

```
/users
```

对应：

```
users
```

包含账号及员工当前资料。

------

### Department

```
/departments
```

部门当前组织实体。

------

### Department Manager

```
/departments/{departmentId}/manager
```

不是 User Role，而是部门的当前负责人关系。

------

### Announcement

```
/announcements
```

核心状态资源。

------

### Announcement Read

```
/announcements/{announcementId}/reads
```

公告与员工之间的首次阅读关系。

------

### Leave Request

```
/leave-requests
```

请假申请及当前状态。

------

### Leave Action Log

数据库属于重要历史资源，但 V1.0 不单独开放通用 CRUD。

通过请假详情和审批详情返回处理历史。

原因：

```
历史日志不可修改
历史日志不可删除
```

数据库明确规定日志只用于记录 `SUBMITTED / APPROVED / REJECTED / CANCELLED` 历史。fileciteturn0file1L921-L999

------

## 8.2 当前用户资源

```
/me
/me/leave-requests
/me/approval-tasks
/me/approval-history
/me/work-overview
```

可以天然表达：

> 当前认证用户的数据。

减少 userId 暴露和 IDOR 风险。

------

# 9. 认证 API

## 9.1 登录

| 项目         | 设计                    |
| ------------ | ----------------------- |
| API 名称     | 登录                    |
| Method       | POST                    |
| Path         | `/api/v1/auth/sessions` |
| 使用角色     | 未登录用户              |
| 权限范围     | 本人                    |
| Request Body | username、password      |
| 事务         | 否                      |
| 并发控制     | 否                      |
| 历史记录     | V1.0 不要求             |

Request：

```
{
  "username": "zhangsan",
  "password": "******"
}
```

后端校验：

1. username 是否存在；
2. 密码是否正确；
3. `status = ENABLED`；
4. 建立认证上下文。

账号不存在或密码错误建议统一：

```
AUTH_INVALID_CREDENTIALS
```

避免通过登录接口枚举账号。

停用：

```
ACCOUNT_DISABLED
```

成功：

```
{
  "success": true,
  "data": {
    "accessToken": "...",
    "mustChangePassword": true
  }
}
```

【设计建议】

若使用 HttpOnly Cookie，则可不在 JSON 返回 Token。

首次登录仍允许成功建立受限认证状态，但后续只能进行改密、查看必要本人信息和退出。

原资料规定首次认证成功后必须修改密码，完成前禁止进入正常业务。fileciteturn1file10L1153-L1173

------

## 9.2 退出

```
DELETE /api/v1/auth/session
```

角色：

```
ADMIN / EMPLOYEE
```

成功：

```
204 No Content
```

【设计建议】

若采用单纯 JWT：

- 当前客户端应删除凭证；
- 服务端至少验证后续 tokenVersion。

是否“注销当前设备”还是“注销所有设备”受多设备登录策略影响，目前产品资料尚未确认。

------

## 9.3 修改本人密码

```
PATCH /api/v1/me/password
```

Body：

```
{
  "currentPassword": "oldPassword",
  "newPassword": "newPassword123"
}
```

规则：

```
>= 8 位
包含字母
包含数字
```

校验：

- 当前密码正确；
- 新密码满足规则；
- 新密码重新安全哈希；
- 更新 `password_hash`；
- `must_change_password = false`；
- `token_version + 1`。

成功后：

> 当前及原有旧登录状态均失效，必须重新登录。

涉及事务：**是**

原因：

密码修改和 `token_version` 更新必须保持一致。

数据库已经明确要求修改或重置密码时递增 `token_version`。fileciteturn0file1L93-L110

------

# 10. 当前用户 API

## 10.1 获取当前用户

```
GET /api/v1/me
```

使用：

```
ADMIN / EMPLOYEE
```

Response：

```
{
  "success": true,
  "data": {
    "id": 10,
    "username": "zhangsan",
    "name": "张三",
    "role": "EMPLOYEE",
    "department": {
      "id": 2,
      "name": "技术部"
    },
    "jobTitle": "后端工程师",
    "workEmail": "zhangsan@example.com",
    "phone": "13800000000",
    "status": "ENABLED",
    "mustChangePassword": false,
    "isDepartmentManager": true
  }
}
```

ADMIN：

```
"department": null
```

`isDepartmentManager` 必须服务端根据当前部门关系计算。

------

## 10.2 修改本人联系方式

```
PATCH /api/v1/me/contact
```

Body：

```
{
  "workEmail": "new@example.com",
  "phone": "13800000000"
}
```

允许修改：

```
workEmail
phone
```

禁止：

```
name
role
departmentId
jobTitle
status
manager
```

邮箱和手机号的具体格式目前仍属于待产品确认。

【设计建议】

最大长度按照现有数据库承载：

```
workEmail <= 100
phone <= 30
```

操作后影响：

- 当前用户资料；
- 企业通讯录。

------

# 11. 账号与员工管理 API

## 11.1 创建账号

```
POST /api/v1/users
```

角色：

```
ADMIN
```

Body：

```
{
  "username": "lisi",
  "initialPassword": "abc12345",
  "name": "李四",
  "role": "EMPLOYEE",
  "departmentId": 3,
  "jobTitle": "产品经理",
  "workEmail": "lisi@example.com",
  "phone": "13800000001"
}
```

必填：

```
username
initialPassword
name
role
```

规则：

### ADMIN

```
departmentId 必须为空
```

### EMPLOYEE

```
departmentId 必填
目标部门必须存在
```

初始化：

```
status = ENABLED
must_change_password = true
```

禁止：

```
role = DEPARTMENT_MANAGER
```

并发：

数据库 `username UNIQUE` 作为最终一致性兜底。

重复账号：

```
409 USERNAME_ALREADY_EXISTS
```

事务：**建议是**

------

## 11.2 管理员账号列表

```
GET /api/v1/users
```

角色：

```
ADMIN
```

Query：

```
page
pageSize
keyword
role
status
departmentId
managerDuty
sortBy
sortOrder
```

其中以下为【设计建议】：

```
keyword -> username / name
role -> ADMIN / EMPLOYEE
status -> ENABLED / DISABLED
managerDuty -> true / false
```

原产品资料尚未最终确定搜索和筛选字段。fileciteturn4file0L15-L28

默认排序：

【设计建议】

```
createdAt DESC
```

返回：

```
{
  "id": 1,
  "username": "lisi",
  "name": "李四",
  "role": "EMPLOYEE",
  "department": {},
  "jobTitle": "",
  "workEmail": "",
  "phone": "",
  "status": "ENABLED",
  "isDepartmentManager": false
}
```

------

## 11.3 查看账号详情

```
GET /api/v1/users/{userId}
```

角色：

```
ADMIN
```

权限：

全公司账号基础管理数据。

禁止返回：

```
passwordHash
tokenVersion
请假内容
```

管理员无权因为账号管理而读取该员工的请假。

------

## 11.4 修改员工资料

```
PATCH /api/v1/users/{userId}
```

Body 示例：

```
{
  "name": "李四",
  "jobTitle": "高级产品经理",
  "workEmail": "lisi@example.com",
  "phone": "13800000001"
}
```

普通资料更新不要同时隐式执行负责人任命。

部门调动独立使用：

```
PUT /users/{userId}/department
```

避免一个 PATCH 混合普通字段更新与复杂组织事务。

【设计建议】

基础 `role` 调整如确有业务需求，应在 Service 中执行完整角色/部门关系校验；由于现有资料未详细定义 ADMIN↔EMPLOYEE 转换生命周期，建议 V1.0 Controller 暂不通过普通资料 PATCH 随意变更 `role`，将该细节列为待确认事项。

------

## 11.5 调动员工部门

```
PUT /api/v1/users/{userId}/department
```

Body：

```
{
  "departmentId": 5
}
```

角色：

```
ADMIN
```

前置检查：

1. 用户存在；
2. 用户是 `EMPLOYEE`；
3. 目标部门存在；
4. 用户不存在本人 `PENDING` 请假；
5. 如果用户是当前负责人，禁止直接调动；
6. 负责人必须先成功更换/卸任；
7. 若负责人还有审批待办，则更换/卸任本身就应失败。

员工调部门后不得修改：

```
leave_requests.submitted_department_id
department_name_snapshot
approver_id
approver_name_snapshot
```

原业务明确要求历史请假不随调部门变化。fileciteturn2file12L1247-L1263

事务：**是**

并发控制：**是**

重点防止组织关系变化与新的审批任务产生竞态。

------

## 11.6 管理员重置密码

```
POST /api/v1/users/{userId}/password-reset
```

Body：

```
{
  "newPassword": "abc12345"
}
```

规则：

- 管理员操作；
- 新密码符合密码规则；
- 更新 password hash；
- `must_change_password = true`；
- `token_version + 1`。

结果：

```
旧登录状态失效
↓
用户使用新密码登录
↓
进入强制改密状态
↓
用户修改本人密码
↓
重新登录
```

是否允许管理员通过管理接口重置自己：

> 待产品确认。fileciteturn1file11L1183-L1196

在确认前【设计建议】返回：

```
403 ADMIN_SELF_PASSWORD_RESET_NOT_ALLOWED
```

管理员可以使用普通“修改本人密码”接口修改自己密码。

事务：**是**

------

## 11.7 停用账号

```
POST /api/v1/users/{userId}/disable
```

角色：

```
ADMIN
```

### 校验一：管理员不能停用自己

```
currentUser.id != targetUser.id
```

否则：

```
409 ADMIN_CANNOT_DISABLE_SELF
```

### 普通 EMPLOYEE

必须不存在：

```
applicant_id = userId
AND
status = PENDING
```

否则：

```
USER_PENDING_LEAVE_EXISTS
```

### 当前负责人

如果：

```
departments.manager_user_id = userId
```

直接拒绝：

```
MANAGER_MUST_BE_REMOVED_BEFORE_DISABLE
```

不得自动：

```
manager_user_id = NULL
```

因为“停用账号本身不自动解除负责人关系”是已确认规则。fileciteturn1file11L1200-L1241

负责人必须先通过：

```
PUT /departments/{id}/manager
```

更换，或者：

```
DELETE /departments/{id}/manager
```

卸任。

成功停用：

```
status = DISABLED
token_version + 1
```

结果：

- 不能登录；
- 原登录凭证失效；
- 不再出现通讯录；
- 不参与新业务；
- 历史数据保留。

事务：**是**

并发：**是**

------

# 12. 部门管理 API

## 12.1 创建部门

```
POST /api/v1/departments
```

Body：

```
{
  "name": "技术部"
}
```

规则：

- ADMIN；
- name 必填；
- 全公司唯一；
- 单层部门；
- 创建时允许没有负责人。

重复：

```
409 DEPARTMENT_NAME_ALREADY_EXISTS
```

------

## 12.2 部门列表

```
GET /api/v1/departments
```

ADMIN 可访问。

业务需要的 EMPLOYEE 只在明确场景中通过专门候选接口取得必要部门信息，不因此开放完整管理详情。

Query：

```
page
pageSize
keyword
```

【设计建议】

`keyword` 搜索部门名称。

默认：

```
createdAt DESC
```

------

## 12.3 部门详情

```
GET /api/v1/departments/{departmentId}
```

ADMIN。

返回：

```
{
  "id": 1,
  "name": "技术部",
  "manager": {
    "id": 10,
    "name": "张三"
  }
}
```

无负责人：

```
"manager": null
```

------

## 12.4 修改部门名称

```
PATCH /api/v1/departments/{departmentId}
```

Body：

```
{
  "name": "研发部"
}
```

规则：

- ADMIN；
- 名称唯一。

特别注意：

修改：

```
departments.name
```

不得修改历史：

```
leave_requests.department_name_snapshot
```

------

## 12.5 删除部门

```
DELETE /api/v1/departments/{departmentId}
```

必须同时确认：

```
没有 users.department_id = departmentId
没有 departments.manager_user_id
没有 leave_requests.submitted_department_id = departmentId
没有其他历史业务关联
```

存在任一关联：

```
409 DEPARTMENT_NOT_EMPTY
```

只有完全无业务关联时允许：

```
204 No Content
```

V1.0 不存在：

```
PATCH /departments/{id}/disable
POST /departments/{id}/restore
```

数据库也已经删除部门状态模型，并通过 RESTRICT 保护历史引用。fileciteturn4file1L277-L307

事务：**建议是**

------

# 13. 负责人管理 API

## 13.1 查询负责人候选人

```
GET /api/v1/departments/{departmentId}/manager-candidates
```

角色：

```
ADMIN
```

Query：

```
page
pageSize
keyword
```

候选人必须：

```
role = EMPLOYEE
status = ENABLED
department_id = departmentId
没有负责其他部门
```

返回：

```
{
  "id": 10,
  "name": "张三",
  "jobTitle": "研发经理"
}
```

------

## 13.2 任命负责人

如果当前部门：

```
manager_user_id = NULL
```

请求：

```
PUT /api/v1/departments/{departmentId}/manager
```

Body：

```
{
  "userId": 10
}
```

后端重新验证候选人。

成功：

```
departments.manager_user_id = userId
```

不得：

```
users.role = DEPARTMENT_MANAGER
```

事务：**是**

并发：**是**

------

## 13.3 更换负责人

同一资源：

```
PUT /api/v1/departments/{departmentId}/manager
```

当部门已经有负责人且 `userId` 不同，则语义为更换。

旧负责人必须不存在：

```
applicant_id = oldManagerId
AND status = PENDING
```

并且不存在：

```
approver_id = oldManagerId
AND status = PENDING
```

否则分别：

```
MANAGER_HAS_PENDING_LEAVE
MANAGER_HAS_PENDING_APPROVAL_TASKS
```

新负责人继续重新验证：

```
EMPLOYEE
ENABLED
属于目标部门
没有负责其他部门
```

成功后：

```
旧负责人 → 普通 EMPLOYEE
新负责人 → EMPLOYEE + 当前负责人职责
```

双方 `users.role` 不变。

数据库已经要求该操作在事务中锁定组织关系并检查待办，避免组织调整竞态。fileciteturn0file1L443-L494

事务：**必须**

并发：**必须**

------

## 13.4 卸任负责人

```
DELETE /api/v1/departments/{departmentId}/manager
```

前置：

当前部门存在负责人。

检查负责人：

```
无本人 PENDING 请假
无分配给本人的 PENDING 审批
```

成功：

```
manager_user_id = NULL
```

部门允许暂时没有负责人。

事务：**必须**

并发：**必须**

操作后影响：

- 部门详情；
- 原负责人入口；
- 工作概览；
- 该部门普通员工的新请假能力。

------

# 14. 企业通讯录 API

## 14.1 通讯录列表

```
GET /api/v1/directory
```

明确允许：

```
EMPLOYEE
```

包括当前负责人。

ADMIN 是否允许访问企业通讯录：

> 待产品确认。fileciteturn4file0L15-L22

查询：

```
page
pageSize
keyword
departmentId
```

明确支持：

```
keyword -> 姓名
departmentId -> 部门
```

仅返回：

```
role = EMPLOYEE
status = ENABLED
```

禁止出现：

```
DISABLED
ADMIN
```

返回：

```
{
  "id": 10,
  "name": "张三",
  "department": {
    "id": 1,
    "name": "技术部"
  },
  "jobTitle": "研发经理",
  "workEmail": "...",
  "phone": "..."
}
```

是否展示：

```
isDepartmentManager
```

仍属待产品确认。

------

# 15. 公告管理 API

## 15.1 创建草稿

```
POST /api/v1/announcements
```

ADMIN。

Body：

```
{
  "title": "国庆放假通知",
  "content": "..."
}
```

初始：

```
status = DRAFT
```

正文：

```
纯文本
```

【设计建议】

根据数据库字段：

```
title <= 200
```

正文数据库为 TEXT，但具体产品最大长度仍待确认。

------

## 15.2 编辑草稿

```
PATCH /api/v1/announcements/{announcementId}
```

仅：

```
status = DRAFT
```

否则：

```
409 ANNOUNCEMENT_STATE_NOT_EDITABLE
```

------

## 15.3 删除草稿

```
DELETE /api/v1/announcements/{announcementId}
```

仅：

```
DRAFT
```

已发布、已撤回均禁止删除。

------

## 15.4 发布公告

```
POST /api/v1/announcements/{announcementId}/publish
```

前置：

```
status = DRAFT
```

原子条件更新：

```
DRAFT -> PUBLISHED
```

记录：

```
publisher_id
published_at
```

【直接推导】

更新必须带：

```
WHERE status = 'DRAFT'
```

并检查 affected rows。

如果 affected rows = 0：

重新查询区分：

```
不存在 -> 404
已经发布/撤回 -> 409
```

数据库已明确要求发布和撤回使用状态条件更新防止重复操作。fileciteturn0file1L498-L540

------

## 15.5 撤回公告

```
POST /api/v1/announcements/{announcementId}/withdraw
```

合法：

```
PUBLISHED -> WITHDRAWN
```

记录：

```
withdrawn_at
```

成功后：

- 员工列表消失；
- 员工不能再次打开；
- 已读历史保留；
- 管理员仍可查看；
- 不能重新发布。

事务/原子控制：**是**

------

## 15.6 管理员公告列表

```
GET /api/v1/announcements
```

ADMIN。

可查看：

```
DRAFT
PUBLISHED
WITHDRAWN
```

Query：

```
page
pageSize
status
keyword
sortBy
sortOrder
```

明确：

```
status
```

【设计建议】

```
keyword -> title
默认 createdAt DESC
```

原产品默认排序尚待确认。

------

## 15.7 管理员公告详情

```
GET /api/v1/announcements/{announcementId}
```

ADMIN。

允许查询全部三个状态。

不会产生员工阅读记录。

------

# 16. 公告阅读 API

## 16.1 员工公告列表

```
GET /api/v1/me/announcements
```

EMPLOYEE。

只返回：

```
PUBLISHED
```

Query：

```
page
pageSize
keyword
readStatus
```

其中：

```
keyword -> title
readStatus -> READ / UNREAD
```

返回：

```
{
  "id": 100,
  "title": "...",
  "publishedAt": "...",
  "read": false,
  "firstReadAt": null
}
```

------

## 16.2 打开公告详情并记录首次阅读

这里不建议使用普通：

```
GET /announcements/{id}
```

直接产生写操作，因为 GET 理论上应该保持安全语义。

因此设计业务动作：

```
POST /api/v1/me/announcements/{announcementId}/open
```

含义：

> 当前员工打开一篇公告。

该操作同时完成：

1. 重新检查公告存在；
2. 重新检查状态仍为 `PUBLISHED`；
3. 尝试写入首次阅读；
4. 返回公告详情。

如果管理员刚刚撤回：

```
409 ANNOUNCEMENT_NOT_AVAILABLE
```

或者：

```
404
```

【设计建议】

推荐使用 409，表示资源存在但当前业务状态不允许员工打开。

首次打开：

```
INSERT announcement_reads
```

重复打开：

```
不新增
不覆盖 first_read_at
```

并发多次打开：

数据库：

```
UNIQUE(announcement_id, user_id)
```

保证最多一条。

数据库已经明确要求重复打开保持第一次 `first_read_at`。fileciteturn0file1L544-L613

事务/原子控制：**是**

幂等业务结果：**是**

------

## 16.3 公告阅读人员

```
GET /api/v1/announcements/{announcementId}/reads
```

ADMIN。

Query：

```
page
pageSize
```

返回：

```
{
  "user": {
    "id": 10,
    "name": "张三"
  },
  "firstReadAt": "..."
}
```

管理员自己查看公告不进入阅读统计。

------

# 17. 请假申请 API

## 17.1 查询负责人本人请假审批人候选

```
GET /api/v1/me/leave-approver-candidates
```

EMPLOYEE。

但只有当前负责人需要使用。

候选人必须满足：

```
role = EMPLOYEE
status = ENABLED
当前确实是某部门负责人
candidate.department != currentUser.department
candidate.id != currentUser.id
```

服务端实时查询。

没有候选：

```
[]
```

提交时仍要重新校验，不能因为候选接口曾返回就相信客户端。

负责人本人必须选择另一部门当前启用负责人，且不能自己审批自己。fileciteturn0file1L731-L783

------

## 17.2 提交请假

```
POST /api/v1/leave-requests
```

仅：

```
EMPLOYEE
```

ADMIN：

```
403
```

Body：

```
{
  "leaveType": "PERSONAL",
  "startDate": "2026-09-10",
  "endDate": "2026-09-12",
  "reason": "个人事务",
  "approverId": null
}
```

类型：

```
PERSONAL
SICK
ANNUAL
```

### 后端计算

客户端不得提交可信 `days`。

服务端计算：

```
DATEDIFF(endDate, startDate) + 1
```

并检查：

```
1 <= days <= 30
```

------

### 普通员工

如果当前用户不是所在部门负责人：

```
approverId 请求字段必须为空/忽略
```

后端自动取得：

```
current user's department
↓
departments.manager_user_id
```

无负责人：

```
409 DEPARTMENT_MANAGER_NOT_AVAILABLE
```

------

### 当前负责人本人

如果：

```
currentUser.id = ownDepartment.manager_user_id
```

Body：

```
{
  "approverId": 30
}
```

必须提供。

服务端重新验证：

```
不是本人
是 EMPLOYEE
ENABLED
目前真实承担负责人职责
属于另一部门
```

------

### 日期检查

必须：

```
startDate >= 北京时间当天
endDate >= startDate
days <= 30
```

------

### 日期重叠

查询当前用户已有：

```
PENDING
APPROVED
```

且：

```
existing.start_date <= new.end_date
AND
existing.end_date >= new.start_date
```

发现：

```
409 LEAVE_DATE_OVERLAP
```

------

### 历史快照

创建时固定：

```
applicant_id
applicant_name_snapshot
submitted_department_id
department_name_snapshot
approver_id
approver_name_snapshot
```

以后组织变化不得重算。

数据库明确将这些字段设计为历史事实。fileciteturn0file1L640-L687

------

### 创建结果

```
status = PENDING
state_version = 0
```

同时：

```
leave_action_logs
action = SUBMITTED
state_version = 0
```

必须同事务。

数据库明确规定请假创建和 `SUBMITTED` 日志不能出现半完成状态。fileciteturn0file1L1004-L1088

事务：**必须**

并发：**必须考虑**

操作后：

- 本人请假列表；
- 指定审批人的待办；
- 双方概览。

------

## 17.3 本人请假列表

```
GET /api/v1/me/leave-requests
```

EMPLOYEE。

Query：

```
page
pageSize
status
leaveType
startDateFrom
startDateTo
```

支持范围来自业务需求。

默认排序：

【设计建议】

```
createdAt DESC
```

返回：

```
leaveType
startDate
endDate
days
status
createdAt
stateVersion
```

建议返回 `stateVersion`，供撤销操作进行并发控制。

------

## 17.4 本人请假详情

```
GET /api/v1/me/leave-requests/{leaveRequestId}
```

必须：

```
applicant_id = currentUser.id
```

否则：

```
403 / 404
```

【设计建议】

为减少 ID 枚举信息泄露，可统一返回 404。

返回：

```
{
  "id": 10,
  "leaveType": "PERSONAL",
  "startDate": "...",
  "endDate": "...",
  "days": 3,
  "reason": "...",
  "status": "APPROVED",
  "stateVersion": 1,
  "submittedDepartment": {
    "id": 2,
    "name": "技术部"
  },
  "approver": {
    "id": 20,
    "name": "李经理"
  },
  "createdAt": "...",
  "finalAction": {
    "action": "APPROVED",
    "operatorName": "李经理",
    "comment": "同意",
    "createdAt": "..."
  }
}
```

历史名称优先使用快照。

------

## 17.5 撤销申请

```
POST /api/v1/leave-requests/{leaveRequestId}/cancel
```

Body：

```
{
  "expectedStateVersion": 0
}
```

必须：

```
applicant_id = currentUser.id
status = PENDING
state_version = expectedStateVersion
```

成功：

```
PENDING -> CANCELLED
state_version 0 -> 1
```

写日志：

```
action = CANCELLED
operator_id = applicant
state_version = 1
```

状态更新 + 日志同事务。

如果审批刚刚成功：

```
affected rows = 0
```

返回：

```
409 Conflict
```

```
LEAVE_STATE_CONFLICT
```

message：

```
当前申请状态已经发生变化，请刷新后重试
```

------

# 18. 请假审批 API

## 18.1 本人审批待办

```
GET /api/v1/me/approval-tasks
```

要求：

当前用户当前承担负责人职责。

查询：

```
approver_id = currentUser.id
status = PENDING
```

Query：

```
page
pageSize
keyword
```

明确搜索：

```
申请人姓名
```

默认排序：

【设计建议】

```
createdAt ASC
```

让更早提交的任务优先。

------

## 18.2 本人已处理审批

```
GET /api/v1/me/approval-history
```

权限：

曾经是实际指定审批人的 EMPLOYEE。

即使当前已经：

- 卸任；
- 调部门；
- 停用（停用时自然无法登录）；

历史关系本身仍然保留。

若仍处于启用状态但已经不是负责人，应允许查看本人过去已经处理的历史。

查询依据：

```
approver_id = currentUser.id
status IN (APPROVED, REJECTED)
```

以及最终操作日志。

负责人卸任后仍能识别本人历史处理记录是明确业务要求。fileciteturn4file1L219-L240

------

## 18.3 审批申请详情

```
GET /api/v1/me/approvals/{leaveRequestId}
```

授权核心：

```
leave_requests.approver_id = currentUser.id
```

而不是：

```
isCurrentManager = true
```

这样：

- 当前待办可以查看；
- 本人处理过的历史可以查看；
- 不会看到其他负责人的申请。

ADMIN 永远禁止通过该接口访问。

------

## 18.4 审批通过

```
POST /api/v1/leave-requests/{leaveRequestId}/approve
```

Body：

```
{
  "comment": "同意",
  "expectedStateVersion": 0
}
```

comment：

```
可空
<= 500 字
```

必须检查：

1. 当前用户是 EMPLOYEE；
2. 当前用户是该申请 `approver_id`；
3. 当前状态 PENDING；
4. stateVersion 与请求一致。

【业务权限说明】

即使用户后来不是当前负责人，只要存在历史已处理记录可以查看；但新的审批动作是否允许必须遵循当前申请分配关系以及组织调整规则。正常业务设计保证存在 PENDING 待办的人无法被卸任，因此一个合法 PENDING 审批人应该仍承担负责人职责。

成功：

```
PENDING -> APPROVED
state_version + 1
```

日志：

```
APPROVED
```

状态更新建议：

```
WHERE
id = ?
AND approver_id = ?
AND status = 'PENDING'
AND state_version = ?
```

affected rows 必须等于 1。

否则重新获取状态并返回：

```
409 LEAVE_STATE_CONFLICT
```

事务：**必须**

并发：**必须**

------

## 18.5 驳回

```
POST /api/v1/leave-requests/{leaveRequestId}/reject
```

Body：

```
{
  "reason": "当前工作安排无法批准",
  "expectedStateVersion": 0
}
```

reason：

```
必填
1~500 字
```

成功：

```
PENDING -> REJECTED
```

日志：

```
REJECTED
comment = reason
```

其余并发机制和 approve 相同。

------

## 18.6 审批和撤销并发语义

例如：

```
审批请求 A
撤销请求 B
```

同时读取：

```
PENDING
version = 0
```

A 先成功：

```
APPROVED
version = 1
```

B：

```
WHERE status=PENDING AND state_version=0
```

affected rows：

```
0
```

B 返回：

```
409 Conflict
```

反之亦然。

因此：

> 一个操作成功后，另一个不是“重复成功”，而是明确业务冲突。

业务输入文档已经明确：先改变状态的操作成为最终结果，其他基于旧状态的请求必须失败并提示重新获取最新数据。fileciteturn2file6L683-L705

数据库使用状态条件、`state_version`、事务及日志版本唯一约束共同保证该规则。fileciteturn1file1L209-L225

------

# 19. 工作概览 API

## 19.1 当前用户工作概览

统一设计：

```
GET /api/v1/me/work-overview
```

后端根据基础角色和负责人职责动态返回不同结构。

------

### EMPLOYEE

```
{
  "role": "EMPLOYEE",
  "isDepartmentManager": false,
  "unreadAnnouncementCount": 3,
  "pendingOwnLeaveCount": 1,
  "recentLeaveResults": []
}
```

最近结果数量：

【设计建议】

```
3 条
```

产品尚未最终确认数量。fileciteturn2file0L18-L28

------

### 当前负责人

在员工数据基础上增加：

```
{
  "pendingApprovalCount": 5
}
```

负责人仍不是第三种 role。

------

### ADMIN

```
{
  "role": "ADMIN",
  "enabledEmployeeCount": 48,
  "departmentCount": 6,
  "draftAnnouncementCount": 2
}
```

管理员概览不包含任何员工请假数据。

工作概览由当前业务表实时查询计算，不需要单独统计表。fileciteturn4file1L443-L542

------

# 20. 账号状态矩阵

| 状态                         | 登录         | 普通业务 | 改密码 | ADMIN 管理 | 历史数据 |
| ---------------------------- | ------------ | -------- | ------ | ---------- | -------- |
| ENABLED                      | 允许         | 按权限   | 允许   | 允许       | 保留     |
| ENABLED + mustChangePassword | 必要认证允许 | 禁止     | 允许   | 可被管理   | 保留     |
| DISABLED                     | 禁止         | 禁止     | 禁止   | 可查询历史 | 必须保留 |

账号启停只属于 User。

部门不存在类似状态。fileciteturn2file9L1009-L1019

------

# 21. 公告状态矩阵

| 当前状态  | 编辑  | 删除  | 发布     | 撤回     | 员工阅读 |
| --------- | ----- | ----- | -------- | -------- | -------- |
| DRAFT     | ADMIN | ADMIN | ADMIN    | 禁止     | 禁止     |
| PUBLISHED | 禁止  | 禁止  | 禁止重复 | ADMIN    | EMPLOYEE |
| WITHDRAWN | 禁止  | 禁止  | 禁止     | 禁止重复 | 禁止     |

状态机：

```
DRAFT
 ↓
PUBLISHED
 ↓
WITHDRAWN
```

不存在反向流转。fileciteturn2file9L1023-L1041

------

# 22. 请假状态矩阵

| 状态      | 申请人查看 | 审批人查看     | 通过 | 驳回 | 撤销   | 编辑/删除 |
| --------- | ---------- | -------------- | ---- | ---- | ------ | --------- |
| PENDING   | 是         | 指定审批人     | 是   | 是   | 申请人 | 禁止      |
| APPROVED  | 是         | 指定审批人历史 | 否   | 否   | 否     | 禁止      |
| REJECTED  | 是         | 指定审批人历史 | 否   | 否   | 否     | 禁止      |
| CANCELLED | 是         | 历史归属可识别 | 否   | 否   | 否     | 禁止      |

合法流转只有：

```
PENDING → APPROVED
PENDING → REJECTED
PENDING → CANCELLED
```

数据库 `state_version` 每次成功状态变化递增。fileciteturn0file1L867-L919

------

# 23. API 权限矩阵

| 模块                 | ADMIN  | 普通 EMPLOYEE | 当前负责人 EMPLOYEE |
| -------------------- | ------ | ------------- | ------------------- |
| 登录                 | ✓      | ✓             | ✓                   |
| 本人资料             | ✓      | ✓             | ✓                   |
| 账号管理             | ✓      | ×             | ×                   |
| 部门管理             | ✓      | ×             | ×                   |
| 负责人管理           | ✓      | ×             | ×                   |
| 通讯录               | 待确认 | ✓             | ✓                   |
| 公告管理             | ✓      | ×             | ×                   |
| 员工公告             | ×      | ✓             | ✓                   |
| 公告阅读记录管理查询 | ✓      | ×             | ×                   |
| 提交本人请假         | ×      | ✓             | ✓                   |
| 本人请假查询         | ×      | ✓             | ✓                   |
| 全公司员工请假       | ×      | ×             | ×                   |
| 审批任务             | ×      | ×             | 仅明确分配本人      |
| 历史审批             | ×      | ×             | 本人处理历史        |
| ADMIN 概览           | ✓      | ×             | ×                   |
| EMPLOYEE 概览        | ×      | ✓             | ✓                   |
| 负责人扩展概览       | ×      | ×             | ✓                   |

关键原则：

```
负责人身份
≠
查看全部请假的授权
```

------

# 24. 事务与并发控制清单

数据库资料已经明确列出需事务或原子控制的核心操作。fileciteturn4file1L383-L399

| API        | 事务 | 条件更新         | affected rows | 防重复          | 历史        |
| ---------- | ---- | ---------------- | ------------- | --------------- | ----------- |
| 创建账号   | 建议 | 唯一约束         | 是            | username UNIQUE | 否          |
| 修改密码   | 是   | tokenVersion     | 是            | 是              | 否          |
| 重置密码   | 是   | tokenVersion     | 是            | 是              | 否          |
| 停用账号   | 是   | status/关系      | 是            | 是              | 历史保留    |
| 调部门     | 是   | 组织条件         | 是            | 是              | 不改历史    |
| 任命负责人 | 是   | 当前关系         | 是            | 是              | 当前组织    |
| 更换负责人 | 必须 | 当前关系+待办    | 必须          | 必须            | 历史不变    |
| 卸任负责人 | 必须 | 当前关系+待办    | 必须          | 必须            | 历史不变    |
| 发布公告   | 原子 | status=DRAFT     | 必须          | 必须            | 发布时间    |
| 撤回公告   | 原子 | status=PUBLISHED | 必须          | 必须            | 阅读保留    |
| 首次阅读   | 原子 | UNIQUE           | 是            | 必须            | firstReadAt |
| 提交请假   | 必须 | 组织/日期        | 必须          | 防并发          | SUBMITTED   |
| 审批通过   | 必须 | status+version   | 必须          | 必须            | APPROVED    |
| 驳回       | 必须 | status+version   | 必须          | 必须            | REJECTED    |
| 撤销       | 必须 | status+version   | 必须          | 必须            | CANCELLED   |

------

# 25. 异常场景与错误码清单

## 25.1 认证

```
AUTH_INVALID_CREDENTIALS
AUTH_SESSION_EXPIRED
ACCOUNT_DISABLED
PASSWORD_CHANGE_REQUIRED
```

------

## 25.2 用户

```
USERNAME_ALREADY_EXISTS
USER_NOT_FOUND
ADMIN_CANNOT_DISABLE_SELF
USER_PENDING_LEAVE_EXISTS
MANAGER_MUST_BE_REMOVED_BEFORE_DISABLE
```

------

## 25.3 负责人

```
MANAGER_CANDIDATE_INVALID
MANAGER_NOT_IN_DEPARTMENT
MANAGER_ACCOUNT_DISABLED
MANAGER_ALREADY_ASSIGNED
MANAGER_HAS_PENDING_LEAVE
MANAGER_HAS_PENDING_APPROVAL_TASKS
DEPARTMENT_HAS_NO_MANAGER
```

------

## 25.4 部门

```
DEPARTMENT_NOT_FOUND
DEPARTMENT_NAME_ALREADY_EXISTS
DEPARTMENT_NOT_EMPTY
```

------

## 25.5 公告

```
ANNOUNCEMENT_NOT_FOUND
ANNOUNCEMENT_STATE_NOT_EDITABLE
ANNOUNCEMENT_STATE_NOT_PUBLISHABLE
ANNOUNCEMENT_STATE_NOT_WITHDRAWABLE
ANNOUNCEMENT_NOT_AVAILABLE
```

------

## 25.6 请假

```
LEAVE_NOT_FOUND
LEAVE_TYPE_INVALID
LEAVE_DATE_INVALID
LEAVE_DATE_BEFORE_TODAY
LEAVE_DURATION_EXCEEDED
LEAVE_DATE_OVERLAP
LEAVE_APPROVER_REQUIRED
LEAVE_APPROVER_INVALID
LEAVE_SELF_APPROVAL_NOT_ALLOWED
LEAVE_STATE_NOT_ALLOWED
LEAVE_STATE_CONFLICT
```

------

## 25.7 权限

```
FORBIDDEN
RESOURCE_ACCESS_DENIED
APPROVAL_NOT_ASSIGNED_TO_CURRENT_USER
```

------

## 25.8 系统

```
VALIDATION_ERROR
DATA_PERSISTENCE_FAILED
INTERNAL_ERROR
```

原业务资料要求重点覆盖重复账号、重复部门、负责人待办、非法审批人、日期重叠、公告撤回、重复审批及审批/撤销并发等异常。fileciteturn1file4L473-L501

------

# 26. API 与数据库映射检查

## 26.1 认证

涉及：

```
users
```

字段：

```
username
password_hash
status
must_change_password
token_version
```

数据库：可以承载。

------

## 26.2 账号管理

涉及：

```
users
departments
leave_requests
```

关键约束：

```
users.username UNIQUE
users.department_id
departments.manager_user_id
leave_requests.applicant_id/status
leave_requests.approver_id/status
```

数据库：可以承载。

------

## 26.3 部门和负责人

涉及：

```
departments
users
leave_requests
```

关键：

```
departments.name UNIQUE
departments.manager_user_id UNIQUE
```

候选：

```
users.role
users.status
users.department_id
```

数据库：可以承载。

------

## 26.4 公告

涉及：

```
announcements
```

字段：

```
title
content
status
publisher_id
published_at
withdrawn_at
```

数据库：可以承载。

------

## 26.5 公告阅读

涉及：

```
announcement_reads
```

核心：

```
UNIQUE(announcement_id, user_id)
first_read_at
```

数据库：可以承载。

------

## 26.6 请假

涉及：

```
leave_requests
leave_action_logs
departments
users
```

历史：

```
applicant_name_snapshot
department_name_snapshot
approver_name_snapshot
```

并发：

```
status
state_version
UNIQUE(leave_request_id, state_version)
```

数据库：可以承载。

------

## 26.7 工作概览

直接查询：

```
users
departments
announcements
announcement_reads
leave_requests
```

无需新表。

------

## 26.8 索引检查

当前数据库已经设计：

```
users(username)
users(department_id)
users(role,status)

departments(name)
departments(manager_user_id)

announcements(status,published_at)

announcement_reads(announcement_id,user_id)
announcement_reads(user_id,announcement_id)

leave_requests(applicant_id,status)
leave_requests(approver_id,status)
leave_requests(applicant_id,start_date,end_date)

leave_action_logs(leave_request_id,state_version)
leave_action_logs(leave_request_id,created_at)
```

这些索引已经覆盖主要 API 查询和并发校验。fileciteturn4file1L244-L273

------

## 26.9 数据库设计调整建议

### 结论

目前没有发现需要为本 API 设计立即修改核心 Schema 的阻塞性缺口。

但有两点建议：

### 建议一：认证会话策略

目前 `token_version` 能很好支持：

```
修改密码
重置密码
停用账号
```

后立即使旧凭证失效。

但如果未来产品确认：

> 多设备同时登录，并且退出某一设备必须只吊销该单独会话。

则单个 `token_version` 不足以表达“单会话撤销”。

届时可能需要：

```
sessions
```

或 Token blacklist / Redis session 等技术机制。

当前由于“多设备登录策略”本身仍待产品确认，所以不构成 V1.0 核心 API 阻塞。

### 建议二：角色转换

数据库允许：

```
users.role
```

但业务资料没有完整规定已经存在的账号在：

```
ADMIN ↔ EMPLOYEE
```

之间转换时的生命周期和前置条件。

如果 V1.0 实际不需要角色转换，建议账号创建后 role 不通过普通 PATCH 修改。

如果确实需要，则开发前补充对应规则。

------

# 27. API 覆盖检查

原 API 输入文档已经列出认证、当前用户、账号、部门、负责人、通讯录、公告、公告阅读、请假、审批和概览的覆盖项。fileciteturn4file0L165-L200 fileciteturn5file0L9-L20

| 业务操作       | 对应 API                                   | 是否覆盖 | 备注           |
| -------------- | ------------------------------------------ | -------- | -------------- |
| 登录           | POST `/auth/sessions`                      | 是       |                |
| 退出           | DELETE `/auth/session`                     | 是       |                |
| 修改本人密码   | PATCH `/me/password`                       | 是       |                |
| 查看本人信息   | GET `/me`                                  | 是       |                |
| 修改联系方式   | PATCH `/me/contact`                        | 是       |                |
| 创建账号       | POST `/users`                              | 是       |                |
| 查询账号       | GET `/users`                               | 是       |                |
| 账号详情       | GET `/users/{id}`                          | 是       |                |
| 修改资料       | PATCH `/users/{id}`                        | 是       |                |
| 调部门         | PUT `/users/{id}/department`               | 是       |                |
| 重置密码       | POST `/users/{id}/password-reset`          | 是       |                |
| 停用账号       | POST `/users/{id}/disable`                 | 是       |                |
| 创建部门       | POST `/departments`                        | 是       |                |
| 部门列表       | GET `/departments`                         | 是       |                |
| 部门详情       | GET `/departments/{id}`                    | 是       |                |
| 修改部门       | PATCH `/departments/{id}`                  | 是       |                |
| 删除空部门     | DELETE `/departments/{id}`                 | 是       |                |
| 负责人候选     | GET `/departments/{id}/manager-candidates` | 是       |                |
| 任命负责人     | PUT `/departments/{id}/manager`            | 是       | 当前为空       |
| 更换负责人     | PUT `/departments/{id}/manager`            | 是       | 当前已有       |
| 卸任负责人     | DELETE `/departments/{id}/manager`         | 是       |                |
| 通讯录         | GET `/directory`                           | 是       |                |
| 创建公告       | POST `/announcements`                      | 是       |                |
| 编辑草稿       | PATCH `/announcements/{id}`                | 是       |                |
| 删除草稿       | DELETE `/announcements/{id}`               | 是       |                |
| 发布           | POST `/announcements/{id}/publish`         | 是       |                |
| 撤回           | POST `/announcements/{id}/withdraw`        | 是       |                |
| 管理员公告查询 | GET `/announcements`                       | 是       |                |
| 员工公告列表   | GET `/me/announcements`                    | 是       |                |
| 首次阅读       | POST `/me/announcements/{id}/open`         | 是       |                |
| 阅读人员       | GET `/announcements/{id}/reads`            | 是       |                |
| 负责人审批候选 | GET `/me/leave-approver-candidates`        | 是       |                |
| 提交请假       | POST `/leave-requests`                     | 是       |                |
| 本人请假       | GET `/me/leave-requests`                   | 是       |                |
| 本人详情       | GET `/me/leave-requests/{id}`              | 是       |                |
| 撤销           | POST `/leave-requests/{id}/cancel`         | 是       |                |
| 待审批         | GET `/me/approval-tasks`                   | 是       |                |
| 已处理         | GET `/me/approval-history`                 | 是       |                |
| 审批详情       | GET `/me/approvals/{id}`                   | 是       |                |
| 通过           | POST `/leave-requests/{id}/approve`        | 是       |                |
| 驳回           | POST `/leave-requests/{id}/reject`         | 是       |                |
| 工作概览       | GET `/me/work-overview`                    | 是       | 动态按身份返回 |

覆盖结果：

> 核心业务操作全部存在对应 API。

------

# 28. V1.0 边界检查

本 API 设计没有增加：

```
多企业
多租户
多层部门
部门停用
部门恢复
DEPARTMENT_MANAGER
自定义权限
权限编辑器
多级审批
会签
审批转交
审批代理
通用审批引擎
考勤
排班
薪资
报销
采购
假期余额
工作日历
半天请假
小时请假
附件
文件上传
通知中心
即时聊天
SSO
第三方登录
AI
知识库
智能审批
数据导入导出
复杂报表
```

这些均属于 V1.0 明确排除范围。fileciteturn2file4L496-L539

------

# 29. 待确认项

## 29.1 不阻塞核心后端开发

当前资料已经明确：

> 不存在阻止核心 API 设计的高优先级待确认问题。fileciteturn4file0L11-L28

仍待确认：

| 项目                   | 当前处理                                |
| ---------------------- | --------------------------------------- |
| ADMIN 是否访问通讯录   | 暂只开放 EMPLOYEE                       |
| 账号列表搜索字段       | 按 username/name 设计建议               |
| 账号筛选               | role/status/department/managerDuty 建议 |
| 通讯录负责人标识       | 可返回但前端是否展示待确认              |
| 公告排序               | 建议 createdAt/publishedAt DESC         |
| 请假排序               | 建议 createdAt DESC                     |
| 审批待办排序           | 建议 createdAt ASC                      |
| 最近申请结果数量       | 建议 3                                  |
| 默认 pageSize          | 建议 20                                 |
| 邮箱电话格式           | 待确认                                  |
| 公告标题最大长度       | 建议按 DB 200                           |
| 公告正文长度           | 待确认                                  |
| 非请假时间统一时区     | 建议 DB UTC/API ISO8601                 |
| ADMIN 管理重置自己密码 | 暂禁止，走本人修改密码                  |
| 多设备登录策略         | 待确认                                  |

原资料同时明确这些剩余项目不会阻塞核心 RESTful 资源划分和主要接口设计。fileciteturn5file0L62-L72

------

## 29.2 建议开发前再明确一个细节

现有业务描述允许管理员在“合法业务场景”维护基础账号身份，但没有完整定义：

```
ADMIN → EMPLOYEE
EMPLOYEE → ADMIN
```

已经存在账号进行角色转换时：

- 是否允许；
- 是否允许管理员修改自己；
- EMPLOYEE 转 ADMIN 时如何处理部门；
- 是否需要检查本人 PENDING；
- 是否需要检查审批待办；
- 是否需要先卸任负责人。

因此建议：

> V1.0 第一版先将已有账号的 `role` 视为不可通过普通资料接口修改；如果产品确实需要角色转换，再单独补充规则。

该问题不影响正常员工 OA 主业务开发。

------

# 30. 最终结论

## 30.1 业务模型

当前设计已经保持以下原则一致：

```
ADMIN / EMPLOYEE
```

是唯一基础角色。

```
departments.manager_user_id
```

是当前负责人唯一事实来源。

负责人不能直接停用。

负责人存在：

```
本人 PENDING
或
本人审批 PENDING
```

时，禁止：

```
更换
卸任
调部门
停用
```

空部门可以删除。

有员工、负责人、历史请假的部门禁止删除。

部门不存在启用/停用状态。

------

## 30.2 请假

普通员工：

```
所在部门当前负责人
↓
固定 approver
```

负责人本人：

```
选择另一部门当前负责人
↓
服务端重新校验
↓
固定 approver
```

提交后：

```
申请人历史
部门历史
审批人历史
```

全部固定。

------

## 30.3 并发

请假最终状态依靠：

```
PENDING 条件
+
state_version
+
事务
+
affected rows
+
leave_action_logs 版本唯一性
```

保证：

```
APPROVED
REJECTED
CANCELLED
```

只能产生其中一个最终结果。

数据库设计已经明确采用这套并发控制模型。fileciteturn2file7L880-L888

------

## 30.4 数据库承载

现有 6 张核心表：

```
users
departments
announcements
announcement_reads
leave_requests
leave_action_logs
```

足以支撑 V1.0 核心 API。数据库本身也明确没有额外引入多级审批、角色权限配置、部门层级、假期余额、附件和通知表等范围外结构。fileciteturn0file1L21-L42

------

# 最终判断

> **当前 API 设计已经足够进入后端接口开发阶段。**

不存在阻止 Controller / Service 主体开发的核心业务问题。

建议开发顺序：

```
认证与统一异常
↓
当前用户
↓
部门
↓
账号与员工
↓
负责人关系
↓
通讯录
↓
公告
↓
公告阅读
↓
请假提交
↓
审批 / 驳回 / 撤销
↓
工作概览
↓
权限与并发专项测试
```

其中开发时最不能简化的四个部分是：

```
1. 负责人不是 role
2. 所有数据归属必须由后端校验
3. 组织调整必须防止和新审批任务产生竞态
4. 请假最终状态必须通过条件更新 + 版本 + 事务保证唯一结果
```

至此，这份 API 文档可以作为企业 OA V1.0 后端 Controller、Service、DTO、Validation、Authorization、Transaction 和 Repository 查询设计的直接输入。

## 内部知识分享 API 设计（已完成）

状态：已完成（Day 8）。Migration: `20260913072642_add_knowledge_sharing`。实际实现 8 个接口，DTO 使用 Zod 校验，后端 35 项集成测试全部通过。

### 状态流转

```text
DRAFT --publish--> PUBLISHED --withdraw--> WITHDRAWN
```

DRAFT 与 PUBLISHED 可由作者修改；WITHDRAWN 为第一版终态。发布使用 `id + authorId + status=DRAFT` 条件更新，撤回使用 `id + authorId + status=PUBLISHED` 条件更新，受影响行数为 0 时区分不存在、归属错误和状态冲突。

### 接口清单

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/knowledge/categories` | 启用分类列表 |
| GET | `/api/v1/knowledge/articles` | 已发布文章列表（keyword, categoryId, page, pageSize） |
| GET | `/api/v1/knowledge/articles/:id` | 文章详情（含可见性校验） |
| POST | `/api/v1/knowledge/articles` | 创建草稿 |
| PATCH | `/api/v1/knowledge/articles/:id` | 修改文章 |
| POST | `/api/v1/knowledge/articles/:id/publish` | 发布草稿 |
| POST | `/api/v1/knowledge/articles/:id/withdraw` | 撤回已发布 |
| GET | `/api/v1/knowledge/me/articles` | 我的文章（额外支持 status 筛选） |

### 错误码

`KNOWLEDGE_ARTICLE_NOT_FOUND`、`KNOWLEDGE_ARTICLE_FORBIDDEN`、`KNOWLEDGE_ARTICLE_STATE_NOT_ALLOWED`、`KNOWLEDGE_CATEGORY_NOT_AVAILABLE`。
