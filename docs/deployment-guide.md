# ZCOP 部署指南

本文档详细介绍了如何部署 ZeroCode Ontology Platform (ZCOP) 到生产环境。

## 部署架构

ZCOP 采用微服务架构，包含以下核心组件：

- **Frontend**: React 前端应用，提供用户界面
- **Backend**: NestJS GraphQL API 服务器
- **PostgreSQL**: 关系型数据库，存储元数据
- **Neo4j**: 图数据库，存储知识图谱
- **Redis**: 缓存和会话存储
- **Qdrant**: 向量数据库，用于语义搜索
- **Casdoor**: 认证和授权服务

## 生产环境部署

### 1. 准备服务器

确保服务器满足以下要求：
- 操作系统：Linux (Ubuntu 20.04+ 或 CentOS 7+)
- 内存：至少 8GB RAM (推荐 16GB+)
- CPU：双核以上
- 存储：至少 50GB 可用空间
- 网络：稳定的互联网连接

### 2. 安装 Docker 和 Docker Compose

```bash
# 更新系统包
sudo apt update

# 安装 Docker
sudo apt install -y docker.io
sudo systemctl start docker
sudo systemctl enable docker

# 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 3. 获取 ZCOP 源码

```bash
git clone https://github.com/caowei8810/zcop.git
cd zcop
```

### 4. 配置环境变量

复制环境变量配置文件并修改：

```bash
cp .env.example .env
nano .env  # 修改为您的实际配置
```

### 5. 配置 Docker Compose

在 `deploy/docker-compose.prod.yml` 中配置生产环境设置：

```yaml
version: '3.8'

services:
  # 前端应用 - 使用生产构建
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.prod
    ports:
      - "80:80"  # 生产环境通常使用 80/443 端口
    environment:
      - NODE_ENV=production
      - REACT_APP_API_URL=https://your-domain.com/api
    depends_on:
      - backend
    networks:
      - zcop-network
    restart: unless-stopped

  # 后端 API 服务器
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.prod
    ports:
      - "3000:3000"
    environment:
      # 从 .env 文件加载
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_USERNAME=${DB_USERNAME}
      - DB_PASSWORD=${DB_PASSWORD}
      - DB_NAME=${DB_NAME}
      - NEO4J_HOST=neo4j
      - NEO4J_PORT=7687
      - NEO4J_USERNAME=${NEO4J_USERNAME}
      - NEO4J_PASSWORD=${NEO4J_PASSWORD}
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    depends_on:
      - postgres
      - neo4j
      - redis
      - qdrant
    networks:
      - zcop-network
    restart: unless-stopped
    # 添加健康检查
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # PostgreSQL 数据库
  postgres:
    image: postgres:15
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_DB=${DB_NAME}
      - POSTGRES_USER=${DB_USERNAME}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - /opt/zcop/postgres/data:/var/lib/postgresql/data
      - ./init/postgres-init.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      - zcop-network
    restart: unless-stopped
    # 添加健康检查
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USERNAME} -d ${DB_NAME}"]
      interval: 30s
      timeout: 10s
      retries: 5

  # Neo4j 图数据库
  neo4j:
    image: neo4j:5-enterprise  # 生产环境推荐使用企业版
    ports:
      - "7474:7474"
      - "7687:7687"
    environment:
      - NEO4J_AUTH=neo4j/${NEO4J_PASSWORD}
      - NEO4J_server_memory_heap_max__size=4G
      - NEO4J_server_memory_pagecache_size=2G
      - NEO4J_server_metrics_enabled=false
      - NEO4J_server_metrics_prometheus_enabled=true
    volumes:
      - /opt/zcop/neo4j/data:/data
      - /opt/zcop/neo4j/logs:/logs
      - /opt/zcop/neo4j/import:/var/lib/neo4j/import
      - /opt/zcop/neo4j/plugins:/plugins
    networks:
      - zcop-network
    restart: unless-stopped

  # Redis 缓存
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - /opt/zcop/redis/data:/data
    command: redis-server --appendonly yes --maxmemory 2gb --maxmemory-policy allkeys-lru
    networks:
      - zcop-network
    restart: unless-stopped

  # Qdrant 向量数据库
  qdrant:
    image: qdrant/qdrant:v1.10
    ports:
      - "6333:6333"
      - "6334:6334"
    volumes:
      - /opt/zcop/qdrant/data:/qdrant/storage
    environment:
      - QDRANT_API_KEY=${QDRANT_API_KEY}
    networks:
      - zcop-network
    restart: unless-stopped

  # Nginx 反向代理 (可选，但推荐用于生产)
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl  # SSL 证书目录
    depends_on:
      - frontend
      - backend
    networks:
      - zcop-network
    restart: unless-stopped

networks:
  zcop-network:
    driver: bridge

volumes:
  postgres_data:
  neo4j_data:
  neo4j_logs:
  neo4j_import:
  neo4j_plugins:
  redis_data:
  qdrant_data:
```

### 6. 初始化数据库

```bash
# 启动数据库服务
docker-compose -f deploy/docker-compose.yml up -d postgres neo4j redis qdrant

# 等待数据库启动
sleep 30

# 初始化 PostgreSQL 数据库
docker-compose -f deploy/docker-compose.yml exec postgres psql -U zcop_user -d zcop_db -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
```

### 7. 启动 ZCOP 服务

```bash
# 构建并启动所有服务
docker-compose -f deploy/docker-compose.yml up -d --build

# 检查服务状态
docker-compose -f deploy/docker-compose.yml ps
```

### 8. 配置反向代理 (Nginx)

创建 Nginx 配置文件 `nginx/nginx.conf`：

```nginx
events {
    worker_connections 1024;
}

http {
    upstream backend {
        server backend:3000;
    }

    upstream frontend {
        server frontend:80;
    }

    server {
        listen 80;
        server_name your-domain.com;

        # 前端静态文件
        location / {
            proxy_pass http://frontend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # API 请求转发到后端
        location /api {
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }

        # GraphQL 请求
        location /graphql {
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # WebSocket 支持
        location /subscriptions {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

### 9. 配置 SSL 证书 (推荐)

使用 Let's Encrypt 获取免费 SSL 证书：

```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d your-domain.com
```

### 10. 系统监控和日志

配置日志收集和监控：

```bash
# 查看容器日志
docker-compose -f deploy/docker-compose.yml logs -f

# 查看特定服务日志
docker-compose -f deploy/docker-compose.yml logs -f backend

# 查看系统资源使用情况
docker stats
```

## 备份策略

定期备份重要数据：

```bash
# 备份 PostgreSQL 数据库
docker-compose -f deploy/docker-compose.yml exec postgres pg_dump -U zcop_user zcop_db > backup/zcop_db_$(date +%Y%m%d_%H%M%S).sql

# 备份 Neo4j 数据
docker-compose -f deploy/docker-compose.yml exec neo4j neo4j-admin dump --database=neo4j --to=/tmp/backup.dump
docker-compose -f deploy/docker-compose.yml cp neo4j:/tmp/backup.dump backup/neo4j_backup_$(date +%Y%m%d_%H%M%S).dump

# 备份 Redis 数据 (RDB 文件)
docker-compose -f deploy/docker-compose.yml exec redis redis-cli BGSAVE
```

## 故障排除

### 常见问题

1. **服务启动失败**
   - 检查日志输出：`docker-compose logs -f <service-name>`
   - 确认端口未被占用
   - 检查环境变量配置

2. **数据库连接问题**
   - 确认数据库服务已启动
   - 检查网络连接和防火墙设置
   - 验证数据库凭证

3. **性能问题**
   - 检查系统资源使用情况
   - 调整 Neo4j 和 PostgreSQL 的内存配置
   - 考虑增加缓存层

### 性能优化

1. **数据库优化**
   - 为常用查询添加索引
   - 调整数据库连接池大小
   - 优化 Neo4j 图遍历查询

2. **缓存策略**
   - 配置 Redis 缓存热点数据
   - 设置合理的过期时间
   - 实现缓存穿透防护

3. **负载均衡**
   - 在多个实例间分配请求
   - 使用 CDN 加速静态资源
   - 实现数据库读写分离

## 升级指南

升级 ZCOP 版本的步骤：

```bash
# 1. 备份数据
# (执行上面的备份命令)

# 2. 停止当前服务
docker-compose -f deploy/docker-compose.yml down

# 3. 拉取最新代码
git pull origin master

# 4. 更新依赖
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# 5. 重新构建并启动
docker-compose -f deploy/docker-compose.yml up -d --build

# 6. 验证服务状态
docker-compose -f deploy/docker-compose.yml ps
```

## 安全最佳实践

1. **访问控制**
   - 使用强密码和密钥
   - 实施最小权限原则
   - 定期轮换密钥

2. **网络安全**
   - 使用防火墙限制访问
   - 启用 HTTPS
   - 实施速率限制

3. **数据保护**
   - 加密敏感数据传输
   - 定期备份并加密存储
   - 实施访问日志记录

通过遵循本指南，您应该能够成功部署和维护 ZCOP 平台。如有问题，请参考文档或联系技术支持。