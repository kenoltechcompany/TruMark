@echo off
REM TruMark Docker Build and Test Script for Windows

echo ==================================================
echo TruMark Docker Build and Test
echo ==================================================

REM Check if Docker is installed
docker --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not installed
    echo Please install Docker Desktop: https://docs.docker.com/desktop/install/windows-install/
    pause
    exit /b 1
)

REM Check if Docker Compose is installed
docker-compose --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker Compose is not installed
    echo Please install Docker Desktop which includes Docker Compose
    pause
    exit /b 1
)

echo [OK] Docker and Docker Compose are installed

REM Check if .env file exists
if not exist .env (
    echo [WARN] .env file not found
    echo Creating .env from .env.example...
    copy .env.example .env
    echo [ACTION REQUIRED] Please edit .env file with your configuration
    echo Press any key to continue after editing .env...
    pause
)

echo [OK] .env file exists

REM Build Docker images
echo.
echo ==================================================
echo Building Docker images...
echo ==================================================
docker-compose build

if errorlevel 1 (
    echo [ERROR] Failed to build Docker images
    pause
    exit /b 1
)

echo [OK] Docker images built successfully

REM Start services
echo.
echo ==================================================
echo Starting services...
echo ==================================================
docker-compose up -d

if errorlevel 1 (
    echo [ERROR] Failed to start services
    pause
    exit /b 1
)

echo [OK] Services started

REM Wait for services to be ready
echo.
echo Waiting for services to be ready...
timeout /t 10 /nobreak >nul

REM Show service status
echo.
echo ==================================================
echo Service Status
echo ==================================================
docker-compose ps

REM Show logs
echo.
echo ==================================================
echo Recent Logs
echo ==================================================
docker-compose logs --tail=20

REM Instructions
echo.
echo ==================================================
echo Success! TruMark is running
echo ==================================================
echo Application URL: http://localhost:5000
echo.
echo Useful commands:
echo   View logs:           docker-compose logs -f
echo   Stop services:       docker-compose down
echo   Restart services:    docker-compose restart
echo   Access shell:        docker-compose exec web bash
echo   Initialize DB:       docker-compose exec web python pop.py --reset
echo.
echo First time setup:
echo   1. Initialize database: docker-compose exec web python pop.py --reset
echo   2. Open http://localhost:5000
echo   3. Login with admin credentials from pop.py
echo.
pause
