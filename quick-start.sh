#!/bin/bash

# ZCOP System Quick Start Script

set -e

echo "========================================="
echo "ZCOP System - Quick Start"
echo "========================================="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

echo "✅ Docker and Docker Compose found"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚙️  Creating environment configuration..."
    cp env-template.txt .env
    echo "✅ Environment file created from template"
    echo "⚠️  Please edit .env file with your specific configuration before proceeding"
    echo ""
    read -p "Do you want to continue? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Create necessary directories
echo "⚙️  Creating necessary directories..."
mkdir -p logs
mkdir -p backups
mkdir -p data/postgres
mkdir -p data/neo4j
mkdir -p data/redis
echo "✅ Directories created"
echo ""

# Start services
echo "🚀 Starting ZCOP services..."
docker-compose up -d
echo ""

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 30

# Check service health
echo "🔍 Checking service health..."
if docker-compose ps | grep -q "Up"; then
    echo "✅ Services are running"
else
    echo "❌ Some services failed to start. Check logs with: docker-compose logs"
    exit 1
fi

# Display service status
echo ""
echo "📊 Service Status:"
docker-compose ps
echo ""

# Display access information
echo "========================================="
echo "🎉 ZCOP System is now running!"
echo "========================================="
echo ""
echo "📍 Access Points:"
echo "   Frontend: http://localhost:3001"
echo "   Backend API: http://localhost:3000"
echo "   Health Check: http://localhost:3000/health"
echo ""
echo "📝 Useful Commands:"
echo "   View logs: docker-compose logs -f"
echo "   Stop services: docker-compose down"
echo "   Restart services: docker-compose restart"
echo "   Check status: docker-compose ps"
echo ""
echo "📚 Documentation:"
echo "   API Docs: ./api-documentation.md"
echo "   User Manual: ./user-manual.md"
echo "   Deployment Guide: ./deploy-guide.md"
echo "   Commercial Readiness: ./COMMERCIAL_READINESS.md"
echo ""
echo "========================================="