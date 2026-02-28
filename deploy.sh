#!/bin/bash

# ZCOP System Deployment Script

set -e  # Exit immediately if a command exits with a non-zero status

echo "Starting ZCOP System deployment..."

# Environment variables
ENVIRONMENT=${1:-"development"}  # Default to development if no environment specified
PROJECT_DIR="/opt/zcop"
BACKUP_DIR="/opt/zcop-backups"

# Create necessary directories
mkdir -p $PROJECT_DIR
mkdir -p $BACKUP_DIR

# Backup current version
if [ -d "$PROJECT_DIR/current" ]; then
    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    echo "Creating backup of current installation..."
    cp -r $PROJECT_DIR/current $BACKUP_DIR/backup_$TIMESTAMP
fi

# Determine branch based on environment
if [ "$ENVIRONMENT" = "production" ]; then
    BRANCH="main"
    CONFIG_FILE="prod.env"
elif [ "$ENVIRONMENT" = "staging" ]; then
    BRANCH="staging"
    CONFIG_FILE="staging.env"
else
    BRANCH="develop"
    CONFIG_FILE="dev.env"
fi

echo "Deploying branch: $BRANCH for $ENVIRONMENT environment"

# Clone or update the repository
if [ -d "$PROJECT_DIR/.git" ]; then
    cd $PROJECT_DIR
    git fetch
    git checkout $BRANCH
    git pull origin $BRANCH
else
    git clone -b $BRANCH https://github.com/zcop/zcop.git $PROJECT_DIR
    cd $PROJECT_DIR
fi

# Install dependencies
echo "Installing backend dependencies..."
cd backend
npm ci --only=production

echo "Installing frontend dependencies..."
cd ../frontend
npm ci --only=production

# Setup environment configuration
echo "Setting up environment configuration..."
cp $CONFIG_FILE ../.env

# Build the application
echo "Building the application..."
cd ../backend
npm run build

# Run database migrations if any
echo "Running database migrations..."
npm run migration:run

# Start the application
echo "Starting the application..."
cd $PROJECT_DIR
pm2 startOrReload ecosystem.config.js --env $ENVIRONMENT

# Wait for the application to start
sleep 10

# Run health check
echo "Performing health check..."
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health)

if [ $HEALTH_STATUS -eq 200 ]; then
    echo "Deployment successful! Application is healthy."
    exit 0
else
    echo "Health check failed with status code: $HEALTH_STATUS"
    echo "Rolling back to previous version..."
    
    # Rollback to previous version if available
    LATEST_BACKUP=$(ls -t $BACKUP_DIR | head -n1)
    if [ ! -z "$LATEST_BACKUP" ]; then
        rm -rf $PROJECT_DIR/current
        cp -r $BACKUP_DIR/$LATEST_BACKUP $PROJECT_DIR/current
        pm2 restart zcop
        echo "Rolled back to previous version: $LATEST_BACKUP"
    fi
    
    exit 1
fi