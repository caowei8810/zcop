#!/bin/bash

# ZCOP (ZeroCode Ontology Platform) Stop Script

echo "==========================================="
echo "Stopping ZCOP Platform Services"
echo "==========================================="

# Stop all services
docker-compose -f deploy/docker-compose.yml down

echo "ZCOP platform services have been stopped."
echo ""
echo "To start again, run: ./start.sh"