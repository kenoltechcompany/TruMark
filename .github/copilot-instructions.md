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
5.  After all 5 photos are captured, the user clicks "Complete Enrollment".
6.  The frontend sends all 5 images to the backend `/admin/students/new` endpoint.
7.  The backend:
    - Saves the images to `uploads/student_{student_id}/`
    - Uses `face_recognition.face_encodings()` to extract face encodings from each image
    - Averages the encodings for better accuracy across angles
    - Stores the averaged encoding in `Student.face_encoding` as JSON
    - Stores the image paths in `Student.face_images` as JSON

### Core Application Flow: Marking Attendance

1.  An admin or lecturer creates a `Session`.
2.  The system generates a QR code for the session, which links to the attendance page (`/attendance/<session_id>`).
3.  A student scans the QR code, opening the attendance page.
4.  The student clicks "Start Camera" and positions their face in the frame.
5.  The student clicks "Mark Attendance" to capture a photo.
6.  The frontend captures a single image and the device's GPS coordinates, then sends both to `/api/mark-attendance`.
7.  The backend's `mark_attendance` function:
    - Decodes the base64 image
    - Uses `face_recognition.face_encodings()` to extract face encoding from the captured image
    - Calls `find_matching_student()` which uses `face_recognition.compare_faces()` to match against all stored student encodings
    - Verifies the student belongs to the correct class for the session
    - Checks if the student's GPS coordinates fall within the classroom's defined polygon using `point_inside_polygon`
    - Records the attendance in the `Attendance` table

## 3. Code Conventions & Patterns

- **Monolithic Structure:** All core logic, models, and routes are in `app.py`. When adding new features, you will likely be modifying this file.
- **Database Models:** All SQLAlchemy models are defined at the top of `app.py`. Relationships between models are explicitly defined (e.g., `Student.current_class`).
- **User Roles:** The `User` model uses boolean flags (`is_admin`, `is_lecturer`, `is_rep`) to control access. Routes that require authentication use the `@login_required` decorator. Authorization is handled with `if/else` checks on `current_user`.
- **API Endpoints:** API endpoints like `/api/mark-attendance` are designed to be called from JavaScript. They often use `@csrf.exempt` because they are not part of the standard form submission flow.
- **Templates:** The application uses a base template (`templates/admin/base.html`) which is extended by other pages. This provides a consistent layout.
- **Face Encodings:** Face encodings are extracted server-side using the Python `face_recognition` library. During registration, 5 images from different angles are processed, and their encodings are averaged for robustness. The averaged encoding is stored as a JSON string in `Student.face_encoding`. The original images are saved in `uploads/student_{student_id}/` and their paths stored in `Student.face_images`. The `find_matching_student()` function uses `face_recognition.compare_faces()` with a tolerance parameter (default 0.6) to match faces.
- **Configuration:** All configuration is managed in `config.py`. Sensitive data like database credentials should be loaded from a `.env` file and not hardcoded.
