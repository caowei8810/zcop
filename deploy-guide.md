# ZCOP System Deployment Guide

## Prerequisites

- Docker and Docker Compose installed
- Node.js 18+ (if building locally)
- At least 4GB RAM available
- 10GB free disk space
- Ports 80, 443, 3000, 5432, 6379, 7687 available

## Environment Setup

1. Copy the environment template:
   ```bash
   cp env-template.txt .env
   ```

2. Edit `.env` file with your specific configuration values:
   - Database credentials
   - JWT secret
   - External service keys
   - Port mappings

## Quick Start with Docker Compose

1. Build and start all services:
   ```bash
   docker-compose up --build -d
   ```

2. Verify all services are running:
   ```bash
   docker-compose ps
   ```

3. Check application logs:
   ```bash
   docker-compose logs -f
   ```

## Production Deployment

### Using Docker Compose

1. For production deployment, use the production compose file:
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

2. Monitor the deployment:
   ```bash
   docker-compose -f docker-compose.prod.yml ps
   docker-compose -f docker-compose.prod.yml logs -f
   ```

### Using PM2 (Alternative)

1. Build the application:
   ```bash
   cd backend
   npm install
   npm run build
   ```

2. Start with PM2:
   ```bash
   cd backend
   pm2 start ecosystem.config.js
   ```

3. Save the PM2 configuration:
   ```bash
   pm2 save
   ```

## Service Configuration

### Database Setup
- PostgreSQL: Primary database for structured data
- Neo4j: Graph database for relationship data
- Redis: Caching and session storage

### Environment Variables
- `NODE_ENV`: Set to 'production' for production
- `DB_HOST`: Database host (default: localhost)
- `DB_PORT`: Database port (default: 5432)
- `DB_USERNAME`: Database username
- `DB_PASSWORD`: Database password
- `JWT_SECRET`: Secret key for JWT signing
- `REDIS_HOST`: Redis host (default: localhost)
- `NEO4J_HOST`: Neo4j host (default: localhost)

## Health Checks

Monitor the application health at:
- Backend: `http://your-domain/health`
- Frontend: `http://your-domain/` (should return UI)

## SSL Configuration

For production deployment, configure SSL termination:
1. Add SSL certificates to nginx configuration
2. Update nginx.conf to redirect HTTP to HTTPS
3. Update CORS settings in environment variables

## Backup and Recovery

### Database Backup
Regular backups are essential. To backup manually:
```bash
# PostgreSQL backup
docker-compose exec postgres pg_dump -U postgres zcop > backup.sql

# Neo4j backup
docker-compose exec neo4j neo4j-admin dump --to=/backups/neo4j.dump
```

### Restoring from Backup
```bash
# PostgreSQL restore
cat backup.sql | docker-compose exec -T postgres psql -U postgres zcop

# Neo4j restore
docker-compose exec neo4j neo4j-admin load --from=/backups/neo4j.dump --force
```

## Scaling

### Horizontal Scaling
- Backend services can be scaled using Docker Compose:
  ```bash
  docker-compose up --scale backend=3
  ```

### Vertical Scaling
Adjust resource limits in docker-compose.yml:
```yaml
backend:
  deploy:
    resources:
      limits:
        cpus: '2'
        memory: 2G
      reservations:
        cpus: '0.5'
        memory: 512M
```

## Monitoring

### Logs
Access application logs via:
```bash
# View recent logs
docker-compose logs --tail=100

# Follow logs in real-time
docker-compose logs -f
```

### Metrics
Metrics are available at:
- Prometheus: `http://your-domain:9090`
- Application metrics: `http://your-domain/metrics`

## Troubleshooting

### Common Issues

1. **Port Already in Use**
   - Check if ports 3000, 5432, 6379, 7687 are available
   - Adjust port mappings in docker-compose.yml

2. **Database Connection Failed**
   - Verify database credentials in .env
   - Check if database containers are running
   - Ensure network connectivity between containers

3. **Application Not Starting**
   - Check application logs for errors
   - Verify all environment variables are set
   - Ensure sufficient system resources

### Debugging Steps
1. Check container status: `docker-compose ps`
2. Review logs: `docker-compose logs <service-name>`
3. Test connectivity: `docker-compose exec <service> <command>`
4. Check resource usage: `docker stats`

## Maintenance

### Updating the Application
1. Pull latest code changes
2. Recreate containers: `docker-compose up --build -d`
3. Run database migrations if needed
4. Verify application functionality

### Security Updates
- Regularly update base images
- Apply security patches
- Monitor for vulnerabilities
- Rotate secrets periodically

## Uninstalling

To completely remove the application:
```bash
# Stop and remove containers
docker-compose down -v

# Remove associated volumes (this will delete all data)
docker volume prune

# Remove associated networks
docker network prune
```

## Support

For assistance with deployment, contact the technical support team with:
- Environment details
- Error messages
- Steps to reproduce
- Application logs