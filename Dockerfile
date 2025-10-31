# Use Python 3.11 slim image as base
FROM python:3.11-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Set work directory
WORKDIR /app

# Install system dependencies required for face_recognition and dlib
RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    libopenblas-dev \
    liblapack-dev \
    libx11-dev \
    libgtk-3-dev \
    libboost-python-dev \
    libboost-thread-dev \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    libwebp-dev \
    libwebp7 \
    wget \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# RUN ldconfig && ls /usr/lib | grep libwebp


# Copy requirements file
COPY requirements.txt .

# Install Python dependencies
# Install dlib from prebuilt wheel first, then other packages
RUN pip install --no-cache-dir https://github.com/alvinregin/dlib-wheels/releases/download/v20.0.0/dlib-20.0.0-cp311-cp311-linux_x86_64.whl && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p instance uploads static/models

# Expose port
EXPOSE 5000

# Set environment variables for production
ENV FLASK_APP=app.py \
    FLASK_ENV=production \
    ENVIRONMENT=production

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:5000/ || exit 1

# Run the application with Gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--threads", "4", "--timeout", "120", "--access-logfile", "-", "--error-logfile", "-", "app:app"]
