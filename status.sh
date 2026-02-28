#!/bin/bash

# ZCOP (ZeroCode Ontology Platform) Status Check Script

echo "==========================================="
echo "ZCOP Platform Services Status"
echo "==========================================="

if [ -f ".env" ]; then
    echo "Environment file: .env ✓"
else
    echo "Environment file: .env missing - please run cp .env.example .env"
fi

echo ""
echo "Docker Compose Services Status:"
echo "==============================="

if [ -f "deploy/docker-compose.yml" ]; then
    docker-compose -f deploy/docker-compose.yml ps
else
    echo "Error: deploy/docker-compose.yml not found"
fi

echo ""
echo "Access Points:"
echo "=============="
echo "Frontend: http://localhost:5173"
echo "Backend API: http://localhost:3000"
echo "Neo4j Browser: http://localhost:7474"
echo "Adminer: http://localhost:8080"
echo "Casdoor: http://localhost:8000"
echo ""

echo "Quick Commands:"
echo "==============="
echo "Start: ./start.sh"
echo "Stop: ./stop.sh"
echo "Logs: docker-compose -f deploy/docker-compose.yml logs -f"