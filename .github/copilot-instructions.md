# TruMark AI Coding Assistant Instructions

This document provides guidance for AI coding assistants to effectively contribute to the TruMark project.

## 1. Project Overview & Architecture

TruMark is a Flask-based web application for managing student attendance using face recognition and geolocation.

- **Backend:** The core application is a monolithic Flask server defined in `app.py`. It handles all business logic, database interactions, and API endpoints.
- **Database:** The application uses SQLAlchemy as its ORM. The data models (e.g., `Student`, `Session`, `Attendance`, `User`) are all defined at the top of `app.py`. The production database is PostgreSQL, configured in `config.py` using environment variables.
- **Frontend:** The frontend is rendered using Jinja2 templates located in the `templates/` directory. It uses standard HTML, CSS, and JavaScript.
- **Face Recognition:** Client-side JavaScript (`static/js/face-recognition.js` and `face-api.js`) captures images from the user's camera, generates face descriptors, and sends them to the backend for verification. The pre-trained models are in `static/models/`.
- **Geolocation:** Attendance is location-aware. Classrooms (`Classroom` model) are defined by a set of GPS coordinates forming a polygon and an altitude. The backend validates the student's location against these boundaries.

## 2. Key Workflows & Commands

### Local Development Setup

1.  **Environment:** The project uses Python. Dependencies are listed in `pyproject.toml` and a `requirements.txt` is also available. Use a virtual environment.
2.  **Database:** For local development, you can use the SQLite database (`instance/attendance.db`). For production, ensure you have a `.env` file with credentials for the PostgreSQL database as specified in `config.py`.
3.  **Run the server:**
    -   On Windows: `run.bat`
    -   On Linux/macOS: `run.sh`
    This will start the Flask development server.

### Core Application Flow: Marking Attendance

1.  An admin or lecturer creates a `Session`.
2.  The system generates a QR code for the session, which links to the attendance page (`/attendance/<session_id>`).
3.  A student scans the QR code, opening the attendance page.
4.  The page uses the device's camera and `face-api.js` to detect a face and generate a descriptor.
5.  The face descriptor and the device's GPS coordinates are sent to the `/api/mark-attendance` endpoint.
6.  The backend's `mark_attendance` function:
    -   Finds a matching student using `find_matching_student` by comparing face descriptors.
    -   Verifies the student belongs to the correct class for the session.
    -   Checks if the student's GPS coordinates fall within the classroom's defined polygon using `point_inside_polygon`.
    -   Records the attendance in the `Attendance` table.

## 3. Code Conventions & Patterns

- **Monolithic Structure:** All core logic, models, and routes are in `app.py`. When adding new features, you will likely be modifying this file.
- **Database Models:** All SQLAlchemy models are defined at the top of `app.py`. Relationships between models are explicitly defined (e.g., `Student.current_class`).
- **User Roles:** The `User` model uses boolean flags (`is_admin`, `is_lecturer`, `is_rep`) to control access. Routes that require authentication use the `@login_required` decorator. Authorization is handled with `if/else` checks on `current_user`.
- **API Endpoints:** API endpoints like `/api/mark-attendance` are designed to be called from JavaScript. They often use `@csrf.exempt` because they are not part of the standard form submission flow.
- **Templates:** The application uses a base template (`templates/admin/base.html`) which is extended by other pages. This provides a consistent layout.
- **Face Encodings:** Face descriptors are stored as JSON-encoded strings in the `Student.face_encoding` text field. The `find_matching_student` function in `app.py` contains the logic for parsing and comparing these encodings.
- **Configuration:** All configuration is managed in `config.py`. Sensitive data like database credentials should be loaded from a `.env` file and not hardcoded.
