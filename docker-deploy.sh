#!/bin/bash
# TruMark Docker Build and Test Script

set -e  # Exit on error

echo "=================================================="
echo "TruMark Docker Build and Test"
echo "=================================================="

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}[ERROR] Docker is not installed${NC}"
    echo "Please install Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}[ERROR] Docker Compose is not installed${NC}"
    echo "Please install Docker Compose"
    exit 1
fi

echo -e "${GREEN}[OK] Docker and Docker Compose are installed${NC}"

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}[WARN] .env file not found${NC}"
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo -e "${YELLOW}[ACTION REQUIRED] Please edit .env file with your configuration${NC}"
    echo "Press Enter to continue after editing .env..."
    read
fi

echo -e "${GREEN}[OK] .env file exists${NC}"

# Build Docker images
echo ""
echo "=================================================="
echo "Building Docker images..."
echo "=================================================="
docker-compose build

echo -e "${GREEN}[OK] Docker images built successfully${NC}"

# Start services
echo ""
echo "=================================================="
echo "Starting services..."
echo "=================================================="
docker-compose up -d

echo -e "${GREEN}[OK] Services started${NC}"

# Wait for services to be ready
echo ""
echo "Waiting for services to be ready..."
sleep 10

# Check if services are running
if docker-compose ps | grep -q "Up"; then
    echo -e "${GREEN}[OK] Services are running${NC}"
else
    echo -e "${RED}[ERROR] Services failed to start${NC}"
    echo "Checking logs..."
    docker-compose logs
    exit 1
fi

# Show service status
echo ""
echo "=================================================="
echo "Service Status"
echo "=================================================="
docker-compose ps

# Show logs
echo ""
echo "=================================================="
echo "Recent Logs"
echo "=================================================="
docker-compose logs --tail=20

# Instructions
echo ""
echo "=================================================="
echo "Success! TruMark is running"
echo "=================================================="
echo -e "${GREEN}Application URL: http://localhost:5000${NC}"
echo ""
echo "Useful commands:"
echo "  View logs:           docker-compose logs -f"
echo "  Stop services:       docker-compose down"
echo "  Restart services:    docker-compose restart"
echo "  Access shell:        docker-compose exec web bash"
echo "  Initialize DB:       docker-compose exec web python pop.py --reset"
echo ""
echo -e "${YELLOW}First time setup:${NC}"
echo "  1. Initialize database: docker-compose exec web python pop.py --reset"
echo "  2. Open http://localhost:5000"
echo "  3. Login with admin credentials from pop.py"
echo ""
