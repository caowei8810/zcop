#!/bin/bash

# ZCOP (ZeroCode Ontology Platform) Quick Start Script

set -e  # Exit on any error

echo "==========================================="
echo "ZCOP (ZeroCode Ontology Platform) Quick Start"
echo "==========================================="

# Check prerequisites
echo "Checking prerequisites..."

if ! [ -x "$(command -v docker)" ]; then
  echo "Error: Docker is not installed or not in PATH" >&2
  exit 1
fi

if ! [ -x "$(command -v docker-compose)" ]; then
  echo "Error: Docker Compose is not installed or not in PATH" >&2
  exit 1
fi

echo "✓ Docker and Docker Compose are available"

# Check if we're in the correct directory
if [ ! -f "deploy/docker-compose.yml" ] || [ ! -f ".env.example" ]; then
  echo "Error: This script must be run from the ZCOP project root directory" >&2
  echo "Please navigate to the ZCOP project directory and try again." >&2
  exit 1
fi

echo "✓ Running from correct directory"

# Check if .env file exists, if not create from example
if [ ! -f ".env" ]; then
  echo "Creating .env file from example..."
  cp .env.example .env
  echo "Created .env file from example. Please update it with your configuration."
  echo "Pay special attention to API keys and passwords!"
  echo ""
  read -p "Press Enter to continue after updating .env file (or Ctrl+C to cancel)..."
fi

# Validate .env file
if ! [ -s ".env" ]; then
  echo "Warning: .env file is empty. Some services may not work properly."
fi

echo "Starting ZCOP platform services..."

# Start all services in detached mode
docker-compose -f deploy/docker-compose.yml up -d

echo ""
echo "Services are starting. This may take a few minutes..."
echo ""

# Wait for services to be healthy
echo "Waiting for services to be ready..."

# Wait for backend to be ready (it may take some time to initialize)
for i in {1..30}; do
  if docker-compose -f deploy/docker-compose.yml ps | grep -q "Up"; then
    echo -n "."
  fi
  sleep 5
done

echo ""
echo "==========================================="
echo "ZCOP Platform is now running!"
echo "==========================================="

echo ""
echo "Access the platform at:"
echo "  Frontend: http://localhost:5173"
echo "  Backend API: http://localhost:3000"
echo "  Neo4j Browser: http://localhost:7474"
echo "  Adminer: http://localhost:8080"
echo "  Casdoor: http://localhost:8000"
echo ""

echo "Useful commands:"
echo "  View logs: docker-compose -f deploy/docker-compose.yml logs -f"
echo "  Stop services: docker-compose -f deploy/docker-compose.yml down"
echo "  Check status: docker-compose -f deploy/docker-compose.yml ps"
echo ""

echo "For more information, check DEPLOYMENT.md"
echo ""
echo "Happy building with ZCOP! 🚀"