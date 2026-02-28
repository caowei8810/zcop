# ZCOP (ZeroCode Ontology Platform) 部署指南

## 概述
ZCOP是一个革命性的零代码业务系统开发框架，允许用户通过图形化方式定义本体，自动生成知识图谱，推断业务流程，并通过自然语言界面操作。

## 架构概览
- **后端**: NestJS + GraphQL + 多数据库 (Neo4j, PostgreSQL, Redis, Qdrant)
- **前端**: React + TypeScript + Arco Design
- **企业级功能**: 身份验证(Casdoor)、数据治理、向量搜索(Qdrant)、审计日志

## 部署选项

### 选项1: Docker Compose (推荐)
这是最简单的一键部署方式，适用于生产环境。

#### 1. 克隆仓库
```bash
git clone https://github.com/caowei8810/zcop.git
cd zcop
```

#### 2. 配置环境变量
```bash
cp .env.example .env
# 编辑 .env 文件以配置API密钥和其他设置
```

#### 3. 启动服务
```bash
docker-compose -f deploy/docker-compose.yml up -d
```

#### 4. 访问应用
- 前端: http://localhost:5173
- 后端API: http://localhost:3000
- Neo4j浏览器: http://localhost:7474
- Adminer (数据库管理): http://localhost:8080
- Casdoor (身份管理): http://localhost:8000

### 选项2: 开发模式部署

#### 后端设置
```bash
cd backend
npm install
npm run start:dev
```

#### 前端设置
```bash
cd frontend
npm install
npm run dev
```

## 服务组件详解

### 数据库层
- **Neo4j**: 主存储，用于知识图谱 (端口 7687, 7474)
- **PostgreSQL**: 元数据存储 (端口 5432)
- **Redis**: 缓存层 (端口 6379)
- **Qdrant**: 向量数据库，用于语义搜索 (端口 6333, 6334)

### 应用服务
- **Frontend**: React应用 (端口 5173)
- **Backend**: NestJS API服务器 (端口 3000)
- **Casdoor**: 单点登录和用户管理 (端口 8000)

## 环境变量配置

以下是在 `.env` 文件中需要配置的关键参数：

```bash
# JWT配置
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=24h

# 数据库配置
DB_HOST=postgres
DB_PORT=5432
DB_USERNAME=zcop_user
DB_PASSWORD=zcop_password
DB_NAME=zcop_db

# Neo4j配置
NEO4J_HOST=neo4j
NEO4J_PORT=7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=zcop_neo4j_password

# Redis配置
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=redis_password

# Qdrant配置
QDRANT_HOST=qdrant
QDRANT_PORT=6334
QDRANT_API_KEY=your_qdrant_api_key

# AI模型API密钥
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
QDRANT_API_KEY=your_qdrant_api_key

# Casdoor配置
CASDOOR_ENDPOINT=http://casdoor:8000
CASDOOR_CLIENT_ID=your_client_id
CASDOOR_CLIENT_SECRET=your_client_secret
CASDOOR_JWT_PUBLIC_KEY=your_jwt_public_key
CASDOOR_ORGANIZATION_NAME=your_org_name
CASDOOR_APPLICATION_NAME=your_app_name
```

## 功能模块说明

### 1. 本体驱动开发
- 图形化界面定义实体、属性、关系、动作和规则
- 实时生成可查询的知识图谱
- 支持继承、多态、复合属性等高级概念

### 2. 自然语言业务操作
- 统一ChatUI界面，支持自然语言业务请求
- 自动意图解析和业务流程编排
- 返回结构化结果和自然语言摘要

### 3. 自主规划引擎
- 自动分析本体模型并生成相应业务工作流
- 识别潜在业务场景并创建处理流程
- 支持CRUD操作、关系管理和规则应用

### 4. 企业级安全与认证
- 完整的RBAC权限管理
- JWT基础的认证和刷新令牌机制
- 与Casdoor集成的企业级单点登录

### 5. 数据治理与合规
- 自动数据分类和敏感度分析
- GDPR/CCPA合规工具
- 数据血缘追踪和隐私影响评估

### 6. 向量数据库集成
- Qdrant向量数据库支持语义搜索
- 自动生成实体和关系的语义嵌入
- 使用向量相似性查找相关实体

## API端点

### 健康检查
- `GET /api/health` - 系统健康状态

### 监控指标
- `GET /api/metrics/system-stats` - 系统性能统计
- `GET /api/metrics/audit-logs` - 审计日志

### 数据治理
- `GET /api/governance/compliance-report` - 合规报告
- `GET /api/governance/data-classification` - 数据分类
- `GET /api/governance/data-quality-rules` - 数据质量规则
- `GET /api/governance/data-lineage/{entityId}` - 数据血缘

### 监控
- `GET /api/monitoring/errors` - 错误监控

## 故障排除

### 常见问题

1. **服务无法启动**
   - 检查端口是否已被占用
   - 确认环境变量配置正确
   - 查看日志输出: `docker-compose -f deploy/docker-compose.yml logs -f`

2. **数据库连接失败**
   - 确认所有数据库服务都在运行
   - 检查网络配置和防火墙设置

3. **AI API调用失败**
   - 验证API密钥是否正确配置
   - 确认网络连接和API提供商状态

### 日志查看
```bash
# 查看所有服务日志
docker-compose -f deploy/docker-compose.yml logs

# 查看特定服务日志
docker-compose -f deploy/docker-compose.yml logs backend
docker-compose -f deploy/docker-compose.yml logs frontend
```

## 扩展和定制

### 添加新功能
1. 在后端创建新的服务、控制器和解析器
2. 在前端添加相应的页面和组件
3. 更新路由和导航菜单
4. 集成到现有工作流中

### 性能优化
- 使用Redis缓存频繁访问的数据
- 对Neo4j查询进行索引优化
- 配置负载均衡器以处理高并发

## 安全建议

1. **生产环境**
   - 使用强密码和安全的JWT密钥
   - 配置HTTPS/TLS加密
   - 定期备份数据
   - 实施访问控制和IP白名单

2. **监控和审计**
   - 定期审查审计日志
   - 设置异常活动告警
   - 监控API使用情况

## 升级和维护

### 备份策略
```bash
# 备份数据库
docker exec zcop_postgres_1 pg_dump -U zcop_user zcop_db > backup.sql

# 备份Neo4j数据
docker exec zcop_neo4j_1 cp -r /data /backup/data
```

### 版本升级
1. 备份当前版本
2. 拉取最新代码
3. 更新依赖
4. 执行迁移脚本（如有）
5. 重启服务

## 技术支持

如需技术支持，请：
1. 检查FAQ和文档
2. 提交GitHub Issue
3. 联系开发团队

---
ZCOP平台现已准备就绪，可以支持企业级零代码应用开发！