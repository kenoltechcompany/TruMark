# TruMark Docker Deployment Guide

This guide covers deploying TruMark using Docker, both locally and on Render.

## 🐳 Quick Start with Docker

### Prerequisites

- Docker installed ([Get Docker](https://docs.docker.com/get-docker/))
- Docker Compose installed (comes with Docker Desktop)

### Local Development with Docker Compose

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd TruMark
   ```

2. **Create `.env` file**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and set your values:
   ```env
   ENVIRONMENT=development
   FLASK_DEBUG=True
   SECRET_KEY=your-secret-key-here
   DATABASE_URL=postgresql://trumark:trumark_password@db:5432/trumark
   ```

3. **Build and run with Docker Compose**
   ```bash
   docker-compose up --build
   ```

4. **Access the application**
   - Open http://localhost:5000
   - PostgreSQL is available at localhost:5432

5. **Initialize the database (first time only)**
   ```bash
   # In a new terminal
   docker-compose exec web python pop.py --reset
   ```

6. **Stop the application**
   ```bash
   docker-compose down
   ```

7. **Stop and remove all data**
   ```bash
   docker-compose down -v
   ```

## 🚀 Deploying to Render (Free Tier)

### Option 1: Using Render Dashboard

1. **Push your code to GitHub**
   ```bash
   git add .
   git commit -m "Add Docker support"
   git push origin main
   ```

2. **Create a new Web Service on Render**
   - Go to [Render Dashboard](https://dashboard.render.com/)
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Configure:
     - **Name**: trumark
     - **Environment**: Docker
     - **Region**: Oregon (or nearest to you)
     - **Plan**: Free
     - **Dockerfile Path**: ./Dockerfile

3. **Create PostgreSQL Database**
   - Click "New +" → "PostgreSQL"
   - **Name**: trumark-db
   - **Plan**: Free
   - Copy the **Internal Database URL**

4. **Add Environment Variables to Web Service**
   Go to your web service → Environment tab:
   ```
   ENVIRONMENT=production
   FLASK_DEBUG=False
   SECRET_KEY=<generate-a-random-key>
   DATABASE_URL=<paste-internal-database-url>
   ```

5. **Deploy**
   - Render will automatically build and deploy
   - Wait for build to complete (5-10 minutes first time)

6. **Initialize Database**
   - Go to Shell tab in your web service
   - Run: `python pop.py --reset`

### Option 2: Using render.yaml (Blueprint)

1. **Push code with render.yaml**
   ```bash
   git add .
   git commit -m "Add Render blueprint"
   git push origin main
   ```

2. **Create New Blueprint**
   - Go to Render Dashboard
   - Click "New +" → "Blueprint"
   - Connect repository
   - Render will automatically:
     - Create web service
     - Create PostgreSQL database
     - Link them together
     - Deploy

3. **Update SECRET_KEY**
   - Go to web service → Environment
   - Update `SECRET_KEY` with a strong random value

4. **Initialize Database**
   - Shell tab → `python pop.py --reset`

## 🔧 Docker Commands Reference

### Building

```bash
# Build the image
docker build -t trumark .

# Build without cache (clean build)
docker build --no-cache -t trumark .
```

### Running

```bash
# Run container
docker run -p 5000:5000 --env-file .env trumark

# Run in detached mode (background)
docker run -d -p 5000:5000 --env-file .env trumark

# Run with custom environment variables
docker run -p 5000:5000 \
  -e ENVIRONMENT=production \
  -e SECRET_KEY=your-key \
  -e DATABASE_URL=your-db-url \
  trumark
```

### Docker Compose Commands

```bash
# Start services
docker-compose up

# Start in background
docker-compose up -d

# Rebuild and start
docker-compose up --build

# Stop services
docker-compose down

# View logs
docker-compose logs

# Follow logs
docker-compose logs -f

# Execute command in running container
docker-compose exec web python pop.py

# Access shell
docker-compose exec web bash

# Restart services
docker-compose restart
```

## 📦 What's in the Docker Setup

### Dockerfile
- Base: Python 3.11 slim
- Installs system dependencies (cmake, libopenblas, etc.)
- Installs dlib from prebuilt wheel
- Installs Python packages
- Runs with Gunicorn (production WSGI server)
- Health checks enabled
- Optimized for Render free tier (2 workers, 4 threads)

### docker-compose.yml
- Web service (Flask app)
- PostgreSQL database
- Volume mounts for development
- Hot reload enabled in dev mode

### .dockerignore
- Excludes unnecessary files from Docker image
- Reduces build time and image size

## 🔒 Security Considerations

### Production Environment Variables

Always set these in production:

```env
ENVIRONMENT=production
FLASK_DEBUG=False
SECRET_KEY=<strong-random-key-minimum-32-chars>
DATABASE_URL=<your-postgresql-url>
```

### Generate a strong SECRET_KEY

```python
# Python
python -c "import secrets; print(secrets.token_hex(32))"
```

```bash
# Or using OpenSSL
openssl rand -hex 32
```

## 🐛 Troubleshooting

### Build fails with "dlib installation error"
- The Dockerfile uses a prebuilt dlib wheel for Linux x86_64
- Make sure you're building on Linux or using Docker Desktop

### Container exits immediately
- Check logs: `docker-compose logs web`
- Verify environment variables are set
- Ensure DATABASE_URL is correct

### Database connection error
- Make sure PostgreSQL is running: `docker-compose ps`
- Check DATABASE_URL format: `postgresql://user:password@host:port/database`
- For Docker Compose: use `db` as hostname (service name)

### "Address already in use" error
- Port 5000 is already taken
- Stop other services using port 5000
- Or change port: `docker-compose -p 8000:5000 up`

### Face recognition not working
- Ensure images are being uploaded correctly
- Check uploads directory has write permissions
- Verify face_recognition library installed correctly

### Render deployment takes too long
- First deployment can take 10-15 minutes
- dlib compilation is slow
- Subsequent deployments use cached layers (faster)

### Render "App failed to respond"
- Check environment variables are set
- Verify DATABASE_URL is the **Internal Database URL**
- Check logs in Render dashboard
- Ensure SECRET_KEY is set

## 📊 Resource Usage (Render Free Tier)

- **Web Service**: 512 MB RAM, 0.1 CPU
- **Database**: 256 MB RAM, shared CPU
- **Build**: ~5-10 minutes first time, ~2-3 minutes after
- **Limitations**:
  - Service spins down after 15 min inactivity
  - 750 hours/month free
  - Database limited to 1 GB

## 🎯 Performance Tips

### Reduce Docker Image Size
- Already optimized in Dockerfile
- Uses slim Python image
- Cleans up apt cache
- ~1.2 GB final size

### Faster Builds
- Docker caches layers
- Don't change requirements.txt unnecessarily
- Use `.dockerignore` to exclude files

### Production Performance
- Gunicorn with 2 workers, 4 threads per worker
- Timeout set to 120 seconds (face recognition can be slow)
- Health checks every 30 seconds

## 🔄 Updating the Application

```bash
# Local (Docker Compose)
git pull
docker-compose down
docker-compose up --build

# Render (automatic)
git push origin main
# Render auto-deploys on push
```

## 📝 Next Steps

After deployment:
1. ✅ Access the app at your Render URL
2. ✅ Create admin user: Shell → `python pop.py --reset`
3. ✅ Log in with default credentials (check pop.py)
4. ✅ Create programs, courses, classes
5. ✅ Add students and start taking attendance!

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Render Documentation](https://render.com/docs)
- [Flask Deployment Guide](https://flask.palletsprojects.com/en/latest/deploying/)
- [Gunicorn Configuration](https://docs.gunicorn.org/en/stable/settings.html)

## ⚠️ Important Notes

1. **Uploads Storage**: On Render free tier, uploaded files (student faces) are ephemeral. They'll be lost on restart. For production, use cloud storage (S3, Cloudinary, etc.)

2. **Database Backups**: Render free tier doesn't include automatic backups. Export data regularly.

3. **HTTPS**: Render provides free HTTPS automatically.

4. **Camera Access**: Requires HTTPS in production (Render provides this).

5. **Cold Starts**: Free tier services sleep after inactivity. First request after sleep takes 30-60 seconds.

## 🆘 Getting Help

If you encounter issues:
1. Check logs: `docker-compose logs` or Render dashboard
2. Verify environment variables
3. Review this guide
4. Check main README.md for app-specific issues
