from dotenv import load_dotenv
load_dotenv()

import os

# Base directory of the application
basedir = os.path.abspath(os.path.dirname(__file__))

# Secret key for session management
SECRET_KEY = 'your-secret-key-here'

# PostgreSQL database URI
SQLALCHEMY_DATABASE_URI = f"postgresql://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}@dpg-d12p3ch5pdvs73cvvv30-a.oregon-postgres.render.com:5432/{os.getenv('DB_NAME')}"

# Disable SQLAlchemy track modifications (improves performance)
SQLALCHEMY_TRACK_MODIFICATIONS = False

# Upload folder for student face images
UPLOAD_FOLDER = os.path.join(basedir, 'uploads')

TEMPLATES_AUTO_RELOAD = True

# Ensure upload directory exists
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

# Ensure instance directory exists
if not os.path.exists(os.path.join(basedir, 'instance')):
    os.makedirs(os.path.join(basedir, 'instance'))