from dotenv import load_dotenv
load_dotenv()

import os

# Base directory of the application
basedir = os.path.abspath(os.path.dirname(__file__))

# Secret key for session management - MUST be set in .env for production
SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')

# Get environment, default to development
ENVIRONMENT = os.getenv('ENVIRONMENT', 'development')

# Database configuration
if ENVIRONMENT == 'production':
    # PostgreSQL database URI for production
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL')
else:
    # SQLite database for development
    SQLALCHEMY_DATABASE_URI = 'sqlite:///' + os.path.join(basedir, 'instance', 'attendance.db')

# Disable SQLAlchemy track modifications (improves performance)
SQLALCHEMY_TRACK_MODIFICATIONS = False

# SQLAlchemy engine options for connection pool and reliability
# These settings prevent "SSL connection closed unexpectedly" errors with NeonDB
SQLALCHEMY_ENGINE_OPTIONS = {
    # Test connections before using them from the pool
    'pool_pre_ping': True,
    # Recycle connections after 5 minutes to prevent stale connections
    'pool_recycle': 300,
    # Maximum number of connections to keep in the pool
    'pool_size': 10,
    # Maximum overflow connections beyond pool_size
    'max_overflow': 20,
    # Connection timeout in seconds
    'connect_args': {
        'connect_timeout': 10,
    } if ENVIRONMENT == 'production' else {}
}

# Upload folder for student face images
UPLOAD_FOLDER = os.path.join(basedir, 'uploads')

TEMPLATES_AUTO_RELOAD = True

# Ensure upload directory exists
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

# Ensure instance directory exists
if not os.path.exists(os.path.join(basedir, 'instance')):
    os.makedirs(os.path.join(basedir, 'instance'))