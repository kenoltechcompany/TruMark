# TruMark - Smart Attendance Management System

TruMark is a Flask-based web application for managing student attendance using face recognition and geolocation verification.

## Features

- **Face Recognition**: Multi-angle face capture (5 photos) for robust student enrollment
- **Geolocation Verification**: Attendance marking restricted to defined classroom boundaries
- **Session Management**: Flexible session expiration (fixed duration, specific time, custom range, always open)
- **Role-Based Access**: Admin, Lecturer, and Class Representative roles with different permissions
- **Remote Registration**: Token-based student self-registration via shareable links
- **Pagination & Search**: All data tables support pagination, search, and filtering
- **UUID-Based**: All database records use UUIDs for better security and scalability

## Quick Start

### Prerequisites

- Python 3.10+
- uv package manager (recommended) or pip
- SQLite (development) or PostgreSQL (production)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd TruMark
```

2. Create a `.env` file in the root directory:
```env
# Environment
ENVIRONMENT=development  # or 'production'

# Security
SECRET_KEY=your-secret-key-here-change-this

# Flask
FLASK_DEBUG=True  # Set to False in production

# Database (for production)
DATABASE_URL=postgresql://user:password@localhost/trumark
```

3. Install dependencies:
```bash
# Using uv (recommended)
uv sync

# Or using pip
pip install -r requirements.txt
```

4. Initialize the database:
```bash
# Using uv
uv run python pop.py

# Or standard python
python pop.py
```

5. Run the application:
```bash
# On Windows
.\run.bat

# On Linux/macOS
./run.sh

# Or using uv
uv run flask run --debug

# Or directly
uv run python app.py
```

The application will be available at `http://localhost:5000`

## Project Structure

```
TruMark/
├── app.py                      # Main Flask application (all routes, models, logic)
├── config.py                   # Configuration settings
├── pop.py                      # Database population script
├── requirements.txt            # Python dependencies
├── pyproject.toml             # Project metadata and dependencies
├── .env                       # Environment variables (create this)
├── .gitignore                 # Git ignore rules
├── instance/
│   └── attendance.db          # SQLite database (development)
├── uploads/                   # Student face images
│   └── student_{uuid}/        # Each student has their own folder
├── static/                    # Static assets (CSS, JS, images)
├── templates/                 # Jinja2 HTML templates
│   ├── base.html             # Base template
│   ├── login.html            # Login page
│   ├── attendance.html       # Student attendance marking
│   └── admin/                # Admin panel templates
├── scripts/                   # Migration and utility scripts
│   ├── migrate_to_uuid.py    # UUID migration script
│   └── ...
└── docs/                      # Documentation
    ├── UUID_MIGRATION.md      # UUID migration guide
    ├── REMOTE_REGISTRATION_FEATURE.md
    └── ...
```

## Architecture

### Database Models (UUIDs)

All models use UUID primary keys (String(36)):

- **Student**: Student information with face encodings and images
- **Session**: Attendance sessions with expiration settings
- **Attendance**: Attendance records linking students and sessions
- **User**: System users (admin, lecturer, class rep)
- **Class**: Academic classes
- **Course**: Course definitions
- **Program**: Academic programs
- **Classroom**: Physical classroom locations with GPS boundaries
- **RegistrationToken**: Shareable registration links

### Face Recognition Workflow

1. **Registration**:
   - Capture 5 face photos from different angles (straight, left, right, up, down)
   - Extract face encodings using `face_recognition` library
   - Average the encodings for better accuracy
   - Store averaged encoding and image paths in database

2. **Attendance Marking**:
   - Student scans QR code to access session
   - Captures single face photo
   - Backend extracts encoding and matches against all students
   - Verifies student belongs to session's class
   - Checks GPS location is within classroom boundaries
   - Records attendance if all checks pass

### Session Expiration Types

- **always_open**: Never expires (default)
- **fixed_duration**: Expires after specified duration (30 mins, 1 hour, 24 hours, etc.)
- **specific_time**: Expires at a specific time today (or tomorrow if past)
- **custom_range**: Only available during specific time window
- **instant_expire**: Manual expiration by admin/lecturer

### Remote Registration

1. Admin/lecturer generates registration token for a class
2. Token creates a shareable link: `/register/{token}`
3. Students access link and complete self-registration
4. Token can be toggled on/off by creator
5. Each class can have one active token at a time

## User Roles & Permissions

### Admin
- Full access to all features
- Manage users, programs, courses, classes, classrooms
- Create and manage sessions
- View all attendance records
- Generate registration tokens for any class

### Lecturer
- Create and manage sessions for their classes
- View attendance for their sessions
- Manage students in their classes
- Generate registration tokens for their classes

### Class Representative
- View attendance for their class
- Mark attendance
- Generate registration tokens for their assigned class only

## Security Features

- **Password Hashing**: Bcrypt for secure password storage
- **CSRF Protection**: Flask-WTF CSRF tokens on all forms
- **Secure File Upload**: `secure_filename()` for uploaded images
- **SQL Injection Protection**: SQLAlchemy ORM prevents SQL injection
- **Environment Variables**: Sensitive data in `.env` file
- **Session Management**: Flask-Login for secure user sessions
- **UUID Primary Keys**: UUIDs instead of sequential integers
- **Location Verification**: GPS boundary checking for attendance

## Environment Variables

Create a `.env` file in the root directory:

```env
# Required
SECRET_KEY=your-very-secure-secret-key-change-this

# Optional (defaults shown)
ENVIRONMENT=development         # or 'production'
FLASK_DEBUG=True               # Set to False in production
DATABASE_URL=                  # PostgreSQL URL for production
```

## Development

### Database Schema Changes

After modifying models in `app.py`, the database schema is automatically updated on next run. For complex migrations, see `scripts/migrate_to_uuid.py` as an example.

### Testing

The application includes several test scripts in the `scripts/` folder for testing specific functionality.

### Package Management

Prefer using `uv` for package management:

```bash
# Add a package
uv add package-name

# Or if that fails
uv pip install package-name
```

## Production Deployment

1. Set environment variables:
```env
ENVIRONMENT=production
SECRET_KEY=<strong-random-key>
FLASK_DEBUG=False
DATABASE_URL=postgresql://user:password@host/database
```

2. Use a production WSGI server (e.g., Gunicorn):
```bash
gunicorn -w 4 -b 0.0.0.0:8000 app:app
```

3. Serve over HTTPS (required for camera access):
   - Use Nginx or Apache as reverse proxy with SSL certificate
   - Or use a platform like Heroku, Railway, or Render with automatic HTTPS

4. Configure PostgreSQL database:
   - Create database: `createdb trumark`
   - Update `DATABASE_URL` in `.env`

## Common Issues

### Camera Access Not Working
- **Cause**: Modern browsers require HTTPS for camera access
- **Solution**: Serve the app over HTTPS in production

### Face Recognition Not Matching
- **Cause**: Poor lighting, different angle, or low-quality images
- **Solution**: Retake photos in good lighting from all 5 required angles

### Session Expired
- **Cause**: Session expiration time has passed
- **Solution**: Admin/lecturer can create a new session

### Registration Link Not Working
- **Cause**: Token may be inactive or expired
- **Solution**: Toggle token on in admin panel or generate new token

## Documentation

Additional documentation is available in the `docs/` folder:

- `UUID_MIGRATION.md` - Guide to UUID migration
- `REMOTE_REGISTRATION_FEATURE.md` - Remote registration details
- `IMPLEMENTATION_COMPLETE.md` - Pagination implementation
- And more...

## License

[Add your license here]

## Contributors

[Add contributors here]

## Support

For issues or questions, please [add contact information or issue tracker link].
