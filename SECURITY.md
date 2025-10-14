# Security Review & Improvements

This document outlines the security measures implemented in TruMark and recommendations for production deployment.

## ✅ Implemented Security Measures

### 1. Authentication & Authorization
- **Password Hashing**: Bcrypt with salt for all user passwords
- **Flask-Login**: Secure session management with `@login_required` decorator
- **Role-Based Access Control**: Admin, Lecturer, and Class Rep roles with permission checks
- **Session Security**: HTTP-only cookies, secure session handling

### 2. Data Protection
- **UUID Primary Keys**: All database records use UUIDs instead of sequential integers
  - Prevents enumeration attacks
  - Harder to guess valid IDs
  - Better for distributed systems

- **Environment Variables**: Sensitive configuration in `.env` file
  - `SECRET_KEY` loaded from environment
  - Database credentials externalized
  - `.env` excluded from version control

### 3. Input Validation & Sanitization
- **CSRF Protection**: Flask-WTF CSRF tokens on all forms
- **Secure Filenames**: `werkzeug.secure_filename()` for file uploads
- **SQL Injection Protection**: SQLAlchemy ORM prevents direct SQL injection
- **File Upload Restrictions**: 
  - Images saved with controlled naming: `face_1.jpg`, `face_2.jpg`, etc.
  - Stored in user-specific directories: `uploads/student_{uuid}/`

### 4. Application Security
- **Debug Mode Configuration**: Controlled via environment variable
  - Defaults to True for development
  - Can be disabled for production via `FLASK_DEBUG=False`
  
- **HTTPS Requirement**: Camera access requires HTTPS in production
  - Warning message displayed on startup
  - Modern browsers enforce this restriction

### 5. Location Security
- **GPS Verification**: Attendance marking restricted to classroom boundaries
- **Polygon-based Geofencing**: Classroom coordinates define allowed area
- **Altitude Checking**: Vertical position validation

## ⚠️ Security Considerations for Production

### Critical Actions Before Production Deployment

1. **Change Secret Key**
   ```bash
   # Generate a strong secret key
   python -c "import secrets; print(secrets.token_hex(32))"
   ```
   Add to `.env`:
   ```env
   SECRET_KEY=<your-generated-key>
   ```

2. **Disable Debug Mode**
   ```env
   FLASK_DEBUG=False
   ENVIRONMENT=production
   ```

3. **Use HTTPS**
   - Required for camera access
   - Protects session cookies
   - Encrypts all data in transit
   - Use Nginx/Apache reverse proxy with SSL certificate
   - Or deploy to platform with automatic HTTPS (Heroku, Railway, Render)

4. **Use Production Database**
   - Switch from SQLite to PostgreSQL
   - Set `DATABASE_URL` in `.env`
   - Regular backups
   - Connection pooling

5. **Use Production WSGI Server**
   ```bash
   # Don't use Flask development server in production
   # Use Gunicorn, uWSGI, or similar
   gunicorn -w 4 -b 0.0.0.0:8000 app:app
   ```

### Recommended Security Enhancements

#### 1. Rate Limiting
Add rate limiting to prevent brute force attacks:

```python
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)

@app.route('/login', methods=['POST'])
@limiter.limit("5 per minute")
def login():
    # ... existing code
```

#### 2. Content Security Policy
Add CSP headers to prevent XSS:

```python
@app.after_request
def set_security_headers(response):
    response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self' 'unsafe-inline'"
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    return response
```

#### 3. Password Strength Requirements
Add password validation:

```python
import re

def validate_password(password):
    """Require minimum 8 chars, 1 uppercase, 1 lowercase, 1 number"""
    if len(password) < 8:
        return False
    if not re.search(r'[A-Z]', password):
        return False
    if not re.search(r'[a-z]', password):
        return False
    if not re.search(r'\d', password):
        return False
    return True
```

#### 4. Session Timeout
Add automatic session expiration:

```python
from datetime import timedelta

app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=2)

@app.before_request
def make_session_permanent():
    session.permanent = True
```

#### 5. File Upload Validation
Add file type and size validation:

```python
ALLOWED_EXTENSIONS = {'jpg', 'jpeg', 'png'}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def validate_image_size(file):
    file.seek(0, os.SEEK_END)
    size = file.tell()
    file.seek(0)
    return size <= MAX_FILE_SIZE
```

#### 6. Logging and Monitoring
Add security event logging:

```python
import logging

logging.basicConfig(
    filename='security.log',
    level=logging.WARNING,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Log failed login attempts
if not user or not user.check_password(password):
    logging.warning(f"Failed login attempt for username: {username} from IP: {request.remote_addr}")
```

#### 7. API Authentication
For CSRF-exempt routes, consider adding API key authentication:

```python
def require_api_key(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        api_key = request.headers.get('X-API-Key')
        if not api_key or api_key != app.config.get('API_KEY'):
            return jsonify({'error': 'Invalid API key'}), 401
        return f(*args, **kwargs)
    return decorated_function

@app.route('/api/mark-attendance', methods=['POST'])
@csrf.exempt
@require_api_key  # Add this
def mark_attendance():
    # ... existing code
```

## 🔒 Data Privacy

### Student Data Protection
- Face images stored securely in `uploads/` directory (excluded from git)
- Face encodings stored as JSON in database
- Access restricted to authenticated users
- Consider adding data retention policy
- Implement GDPR-compliant data deletion

### Database Security
- Regular backups
- Encrypted connections to PostgreSQL in production
- Minimal permissions for database user
- No sensitive data in logs

## 🔍 Security Checklist for Production

- [ ] Change `SECRET_KEY` to strong random value
- [ ] Set `FLASK_DEBUG=False`
- [ ] Set `ENVIRONMENT=production`
- [ ] Enable HTTPS with valid SSL certificate
- [ ] Use PostgreSQL instead of SQLite
- [ ] Use production WSGI server (Gunicorn, uWSGI)
- [ ] Set up regular database backups
- [ ] Configure firewall rules
- [ ] Set up monitoring and alerting
- [ ] Implement rate limiting
- [ ] Add security headers (CSP, HSTS, etc.)
- [ ] Set up logging and log rotation
- [ ] Review and minimize CSRF exemptions
- [ ] Implement session timeout
- [ ] Add password strength requirements
- [ ] Perform security audit and penetration testing
- [ ] Document incident response procedures
- [ ] Set up SSL certificate auto-renewal

## 📋 Known CSRF Exempt Routes

The following routes have CSRF protection disabled (review each for necessity):

1. `/attendance/<session_id>` - GET only, safe
2. `/admin/sessions/<session_id>/attendance` - GET only, safe  
3. `/admin/students/new` - Needed for face image upload
4. `/api/remote-register/<token>` - Public API endpoint
5. `/api/mark-attendance` - Camera capture endpoint
6. `/admin/classes/<class_id>/attendance-summary` - GET only, safe
7. `/admin/programs/<program_id>/attendance-summary` - GET only, safe
8. `/admin/dashboard/stats` - GET only, safe
9. `/admin/registration-tokens` - GET only, safe
10. `/admin/registration-tokens/generate` - Consider adding CSRF
11. `/admin/registration-tokens/<token_id>/toggle` - Consider adding CSRF

**Recommendation**: Review endpoints 10-11 and add CSRF protection if possible by using AJAX with CSRF token headers.

## 🛡️ Regular Security Maintenance

1. **Dependency Updates**: Regularly update Python packages
   ```bash
   uv sync --upgrade
   ```

2. **Security Audits**: Run security scanners
   ```bash
   pip install safety
   safety check
   ```

3. **Code Review**: Regular security-focused code reviews

4. **Penetration Testing**: Annual penetration tests

5. **Backup Testing**: Regular backup restoration tests

6. **Log Review**: Regular security log analysis

## 📚 Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Flask Security Best Practices](https://flask.palletsprojects.com/en/latest/security/)
- [Python Security Best Practices](https://python.readthedocs.io/en/stable/library/security_warnings.html)
- [SQLAlchemy Security](https://docs.sqlalchemy.org/en/latest/faq/security.html)

## ✅ Security Review Completed

**Date**: January 2025  
**Reviewer**: AI Assistant  
**Status**: Development environment secure, production hardening required  
**Priority Actions**: Change SECRET_KEY, disable debug mode, enable HTTPS for production
