# TruMark AI Coding Assistant Instructions

This document provides guidance for AI coding assistants to effectively contribute to the TruMark project.

## 1. Project Overview & Architecture

TruMark is a Flask-based web application for managing student attendance using face recognition and geolocation.

- **Backend:** The core application is a monolithic Flask server defined in `app.py`. It handles all business logic, database interactions, and API endpoints.
- **Database:** The application uses SQLAlchemy as its ORM. The data models (e.g., `Student`, `Session`, `Attendance`, `User`) are all defined at the top of `app.py`. The application switches between SQLite (development) and PostgreSQL (production) based on the `ENVIRONMENT` variable in `.env`.
- **Frontend:** The frontend is rendered using Jinja2 templates located in the `templates/` directory. It uses standard HTML, CSS, and JavaScript. **No client-side face recognition libraries are used.**
- **Face Recognition:** The backend uses the Python `face_recognition` library for all face detection and matching. During student registration, 5 images are captured from different angles. The frontend only captures images; all face processing happens server-side.
- **Geolocation:** Attendance is location-aware. Classrooms (`Classroom` model) are defined by a set of GPS coordinates forming a polygon and an altitude. The backend validates the student's location against these boundaries.

## 2. Key Workflows & Commands

### Local Development Setup

1.  **Environment:** The project uses Python 3.10+. Dependencies are listed in `pyproject.toml` and `requirements.txt`. Use a virtual environment.
2.  **Database:** 
    - The application uses environment-based database switching configured in `config.py`
    - Development: SQLite database at `instance/attendance.db` (default when `ENVIRONMENT=development`)
    - Production: PostgreSQL database specified by `DATABASE_URL` in `.env` (when `ENVIRONMENT=production`)
    - After schema changes, run `python migrate_db.py` to update the database
3.  **Run the server:**
    -   On Windows: `run.bat` or `python app.py`
    -   On Linux/macOS: `run.sh` or `python app.py`
    This will start the Flask development server.

### Core Application Flow: Student Registration

1.  An admin, lecturer, or class rep navigates to `/admin/students/new`.
2.  The user fills in student details (ID, name, class).
3.  The user clicks "Start Camera" to begin face capture.
4.  The system guides the user to capture 5 photos from different angles:
    - Looking straight
    - Head turned left
    - Head turned right
    - Head tilted up
    - Head tilted down
5.  Users can click on any captured photo to retake it
6.  After all 5 photos are captured, the user clicks "Complete Enrollment".
7.  The frontend sends all 5 images to the backend `/admin/students/new` endpoint.
8.  The backend:
    - Saves the images to `uploads/student_{student_id}/`
    - Uses `face_recognition.face_encodings()` to extract face encodings from each image
    - Averages the encodings for better accuracy across angles
    - Stores the averaged encoding in `Student.face_encoding` as JSON
    - Stores the image paths in `Student.face_images` as JSON

### Core Application Flow: Remote Student Registration

1.  An admin, lecturer, or class rep navigates to `/admin/registration-tokens`
2.  They click "Generate New Link" and select the target class
    - For class reps: class is automatically locked to their assigned class
    - For lecturers/admins: they choose from their accessible classes
3.  The system generates a secure random token and creates a `RegistrationToken` record
4.  The link is displayed with copy and share buttons (e.g., `/register/{token}`)
5.  The creator shares the link with students (WhatsApp, email, etc.)
6.  Students access the link and see the remote registration page
7.  If the token `is_active` is True:
    - Students fill in their details and capture 5 face photos (same as admin registration)
    - The frontend sends data to `/api/remote-register/{token}`
    - The backend validates the token, processes face images, and creates the student record
    - The student is automatically assigned to the class associated with the token
8.  If the token `is_active` is False:
    - Students see a "Registration Closed" page with class info and contact instructions
9.  Admins/lecturers/reps can toggle registration on/off using the switch in the tokens list
10. Each class can have one active registration token at a time (reuses existing if present)

### Core Application Flow: Marking Attendance

1.  An admin or lecturer creates a `Session` with expiration settings.
2.  The system generates a QR code for the session, which links to the attendance page (`/attendance/<session_id>`).
3.  A student scans the QR code, opening the attendance page.
4.  The system checks if the session has expired - if so, displays `session_expired.html`.
5.  The student clicks "Start Camera" and positions their face in the frame.
6.  The student clicks "Mark Attendance" to capture a photo.
7.  The frontend captures a single image and the device's GPS coordinates, then sends both to `/api/mark-attendance`.
8.  The backend's `mark_attendance` function:
    - Checks if the session has expired and rejects if so
    - Decodes the base64 image
    - Uses `face_recognition.face_encodings()` to extract face encoding from the captured image
    - Calls `find_matching_student()` which uses `face_recognition.compare_faces()` to match against all stored student encodings
    - Verifies the student belongs to the correct class for the session
    - Checks if the student's GPS coordinates fall within the classroom's defined polygon using `point_inside_polygon`
    - Records the attendance in the `Attendance` table

### Session Expiration System

The application includes a comprehensive session expiration system with multiple time options:

1.  **Expiration Types:**
    - `always_open`: Session never expires (default for legacy sessions)
    - `fixed_duration`: Expires after a specified duration (e.g., next 24 hours, 30 minutes, 7 days)
    - `specific_time`: Expires at a specific time today (or tomorrow if time has passed)
    - `custom_range`: Available only during a specific time window (e.g., 8 AM to 5 PM)
    - `instant_expire`: Admin/lecturer can manually expire a session immediately

2.  **Creating Sessions with Expiration:**
    - When creating a session at `/admin/sessions/new`, users can select expiration type
    - The form provides quick presets (30 mins, 1 hour, 2 hours, 24 hours, 2 days, 1 week, until 5 PM, until 11:59 PM)
    - Dynamic form fields appear based on selected expiration type
    - The `calculate_expiration()` function computes the `expires_at` datetime based on type and value

3.  **Expiration Checking:**
    - `Session.is_expired()` method checks if current time is past `expires_at`
    - `Session.get_expiration_display()` returns human-readable time remaining
    - The `/attendance/<session_id>` route checks expiration before rendering
    - The `/api/mark-attendance` endpoint rejects expired sessions with error message
    - Sessions list shows expiration status badges (Always Open, Time Remaining, or Expired)

4.  **Manual Expiration:**
    - Admins and lecturers can instantly expire a session using the "Expire Now" button
    - The `/admin/sessions/expire/<session_id>` route sets `expires_at` to current time
    - Expired sessions still appear in the list but cannot be used for marking attendance

## 3. Code Conventions & Patterns

- **Monolithic Structure:** All core logic, models, and routes are in `app.py`. When adding new features, you will likely be modifying this file.
- **Database Models:** All SQLAlchemy models are defined at the top of `app.py`. Relationships between models are explicitly defined (e.g., `Student.current_class`).
- **User Roles:** The `User` model uses boolean flags (`is_admin`, `is_lecturer`, `is_rep`) to control access. Routes that require authentication use the `@login_required` decorator. Authorization is handled with `if/else` checks on `current_user`.
- **API Endpoints:** API endpoints like `/api/mark-attendance` are designed to be called from JavaScript. They often use `@csrf.exempt` because they are not part of the standard form submission flow.
- **Templates:** The application uses a base template (`templates/admin/base.html`) which is extended by other pages. This provides a consistent layout.
- **Face Encodings:** Face encodings are extracted server-side using the Python `face_recognition` library. During registration, 5 images from different angles are processed, and their encodings are averaged for robustness. The averaged encoding is stored as a JSON string in `Student.face_encoding`. The original images are saved in `uploads/student_{student_id}/` and their paths stored in `Student.face_images`. The `find_matching_student()` function uses `face_recognition.compare_faces()` with a tolerance parameter (default 0.6) to match faces.
- **Configuration:** All configuration is managed in `config.py`. Sensitive data like database credentials should be loaded from a `.env` file and not hardcoded.

- **Environment** Always us uv as the package manager and python runner. eg. instead of `python main.py`, you could `uv run main.py` or `uv run python main.py`. This is flask app so to test it use `uv run flask run --debug` instead running the `app.py` file directly like `uv run python app.py` which is better. Install packages with `uv`like this `uv add [package]` or `uv pip install [package]`, with `uv add` being the preferable option and falling to the latter when `uv add` fails