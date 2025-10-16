from flask import Flask, render_template, request, jsonify, redirect, url_for, flash, send_from_directory, send_file, Response
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta
import qrcode
import os
import csv
from werkzeug.utils import secure_filename
import base64
from io import BytesIO
import numpy as np
import json
from numpy.linalg import norm
from flask_wtf.csrf import CSRFProtect, generate_csrf
from flask_login import LoginManager, UserMixin, login_user, logout_user, current_user, login_required
from flask_bcrypt import Bcrypt
from PIL import Image
import secrets
import sys
import uuid
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import String

# Lazy import face_recognition to avoid startup issues
face_recognition = None

def get_face_recognition():
    global face_recognition
    if face_recognition is None:
        import face_recognition as fr
        face_recognition = fr
    return face_recognition

# Initialize Flask app
app = Flask(__name__)
app.config.from_pyfile('config.py')

# Initialize CSRF protection
csrf = CSRFProtect(app)

# Make csrf_token available in all templates
@app.context_processor
def inject_csrf_token():
    return dict(csrf_token=generate_csrf)

# Initialize database
db = SQLAlchemy(app)

# Initialize Flask-Login after Flask app initialization
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# Add bcrypt for password hashing
bcrypt = Bcrypt(app)

# Helper function to calculate session expiration
def calculate_expiration(expiration_type, expiration_value, base_time=None):
    """
    Calculate the expiration datetime based on type and value.
    
    Args:
        expiration_type: Type of expiration (always_open, fixed_duration, specific_time, custom_range)
        expiration_value: JSON string with expiration details
        base_time: Base datetime to calculate from (defaults to now)
    
    Returns:
        datetime object or None for always_open
    """
    if base_time is None:
        base_time = datetime.utcnow()
    
    if expiration_type == 'always_open':
        return None
    
    if expiration_type == 'instant_expire':
        return base_time  # Already expired
    
    try:
        value_data = json.loads(expiration_value) if isinstance(expiration_value, str) else expiration_value
    except:
        return None
    
    if expiration_type == 'fixed_duration':
        # Format: {"amount": 24, "unit": "hours"}
        amount = int(value_data.get('amount', 0))
        unit = value_data.get('unit', 'hours')
        
        if unit == 'minutes':
            return base_time + timedelta(minutes=amount)
        elif unit == 'hours':
            return base_time + timedelta(hours=amount)
        elif unit == 'days':
            return base_time + timedelta(days=amount)
    
    elif expiration_type == 'specific_time':
        # Format: {"time": "14:30"}  (today at 2:30 PM)
        time_str = value_data.get('time', '')
        if time_str:
            hour, minute = map(int, time_str.split(':'))
            target = base_time.replace(hour=hour, minute=minute, second=0, microsecond=0)
            
            # If the time has already passed today, use tomorrow
            if target <= base_time:
                target += timedelta(days=1)
            
            return target
    
    elif expiration_type == 'custom_range':
        # Format: {"start": "09:00", "end": "17:00"}
        end_time = value_data.get('end', '')
        if end_time:
            hour, minute = map(int, end_time.split(':'))
            target = base_time.replace(hour=hour, minute=minute, second=0, microsecond=0)
            
            # If the time has already passed today, use tomorrow
            if target <= base_time:
                target += timedelta(days=1)
            
            return target
    
    return None

# Helper function for UUID generation
def generate_uuid():
    """Generate a new UUID4 as a string"""
    return str(uuid.uuid4())

# Models
class Student(db.Model):
    id = db.Column(String(36), primary_key=True, default=generate_uuid)
    student_id = db.Column(db.String(10), unique=True, nullable=False)
    firstname = db.Column(db.String(100), nullable=False)
    lastname = db.Column(db.String(100), nullable=False)
    othernames = db.Column(db.String(100), nullable=True)
    face_encoding = db.Column(db.Text, nullable=True)  # Stores the averaged face encoding from multiple images
    face_images = db.Column(db.Text, nullable=True)  # Stores paths to the 5 face images as JSON
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    class_id = db.Column(String(36), db.ForeignKey('class.id'), nullable=False)
    current_class = db.relationship('Class', backref='students')


class Session(db.Model):
    id = db.Column(String(36), primary_key=True, default=generate_uuid)
    semester = db.Column(db.String(1), nullable=False)
    week = db.Column(db.String(10), nullable=False)
    date = db.Column(db.DateTime, nullable=False)
    classroom_id = db.Column(String(36), db.ForeignKey('classroom.id'), nullable=False)
    class_id = db.Column(String(36), db.ForeignKey('class.id'), nullable=False)
    lecturer_id = db.Column(String(36), db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    course_id = db.Column(String(36), db.ForeignKey('course.id'), nullable=False)
    classroom = db.relationship('Classroom', backref='sessions')
    lecturer = db.relationship('User', backref='sessions')
    course = db.relationship('Course', backref='sessions')
    current_class = db.relationship('Class', backref='sessions')
    active = db.Column(db.Boolean, default=True)
    
    # Expiration fields
    expiration_type = db.Column(db.String(50), default='always_open')  # always_open, fixed_duration, specific_time, custom_range
    expiration_value = db.Column(db.String(100), nullable=True)  # Stores duration or time details as JSON
    expires_at = db.Column(db.DateTime, nullable=True)  # Calculated expiration timestamp
    
    def is_expired(self):
        """Check if the session has expired"""
        if self.expiration_type == 'always_open':
            return False
        
        if self.expires_at is None:
            return False
        
        return datetime.utcnow() > self.expires_at
    
    def get_expiration_display(self):
        """Get a human-readable expiration description"""
        if self.expiration_type == 'always_open':
            return 'Always Open'
        
        if self.is_expired():
            return 'Expired'
        
        if self.expires_at:
            time_left = self.expires_at - datetime.utcnow()
            if time_left.total_seconds() < 3600:  # Less than 1 hour
                minutes = int(time_left.total_seconds() / 60)
                return f'Expires in {minutes} minutes'
            elif time_left.total_seconds() < 86400:  # Less than 1 day
                hours = int(time_left.total_seconds() / 3600)
                return f'Expires in {hours} hours'
            else:
                days = int(time_left.total_seconds() / 86400)
                return f'Expires in {days} days'
        
        return 'Unknown'

class Attendance(db.Model):
    id = db.Column(String(36), primary_key=True, default=generate_uuid)
    student_id = db.Column(String(36), db.ForeignKey('student.id'), nullable=False)
    session_id = db.Column(String(36), db.ForeignKey('session.id'), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    latitude = db.Column(db.Float, nullable=True)
    longitude = db.Column(db.Float, nullable=True)
    altitude = db.Column(db.Float, nullable=True)

class Program(db.Model):
    id = db.Column(String(36), primary_key=True, default=generate_uuid)
    program_name = db.Column(db.String(100), nullable=False)

    def get_short_name(self):
        # Return a short name for the program, e.g., first 3 letters of each word
        return ' '.join(word[:3] for word in self.program_name.split())

class Course(db.Model):
    id = db.Column(String(36), primary_key=True, default=generate_uuid)
    course_name = db.Column(db.String(100), nullable=False)
    course_code = db.Column(db.String(15), unique=True, nullable=False)
    credits = db.Column(db.Integer, nullable=False)
    program_id = db.Column(String(36), db.ForeignKey('program.id'), nullable=False)
    program = db.relationship('Program', backref='courses')

class Class(db.Model):
    id = db.Column(String(36), primary_key=True, default=generate_uuid)
    program_id = db.Column(String(36), db.ForeignKey('program.id'), nullable=False)
    group = db.Column(db.String(2), nullable=False)
    year_group = db.Column(db.String(10), nullable=False)
    program = db.relationship('Program', backref='classes')
    session = db.Column(db.String(10), nullable=False)  # e.g., "2023/2024"

class RegistrationToken(db.Model):
    id = db.Column(String(36), primary_key=True, default=generate_uuid)
    token = db.Column(db.String(64), unique=True, nullable=False, index=True)
    class_id = db.Column(String(36), db.ForeignKey('class.id'), nullable=False)
    created_by = db.Column(String(36), db.ForeignKey('user.id'), nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    class_ref = db.relationship('Class', backref='registration_tokens')
    creator = db.relationship('User', backref='created_tokens')
    
    @staticmethod
    def generate_token():
        """Generate a secure random token"""
        return secrets.token_urlsafe(32)
    
    def get_registration_url(self):
        """Get the full registration URL"""
        from flask import url_for
        return url_for('remote_registration', token=self.token, _external=True)

class Classroom(db.Model):
    id = db.Column(String(36), primary_key=True, default=generate_uuid)
    name = db.Column(db.String(100), unique=True, nullable=False)
    coordinates = db.Column(db.Text, nullable=False)  # Store coordinates as a JSON string
    altitude = db.Column(db.Float, default=0.0)  # In meters
    altitude_tolerance = db.Column(db.Float, default=3.0)  # Changed from 10.0 to 3.0

# Update User model with password hashing
class User(UserMixin, db.Model):
    id = db.Column(String(36), primary_key=True, default=generate_uuid)
    username = db.Column(db.String(80), unique=True, nullable=False)
    firstname = db.Column(db.String(80), nullable=True)
    lastname = db.Column(db.String(80), nullable=True)
    othernames = db.Column(db.String(80), nullable=True)
    password = db.Column(db.String(120), nullable=False)
    is_admin = db.Column(db.Boolean, default=False)
    is_rep = db.Column(db.Boolean, default=False)
    is_lecturer = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    class_id = db.Column(String(36), db.ForeignKey('class.id'), nullable=True)
    current_class = db.relationship('Class', backref='representatives', foreign_keys=[class_id])
    

    # Add teaching classes relationship for lecturers
    teaching_classes = db.relationship('Class', secondary='lecturer_classes',
                                     backref=db.backref('lecturers', lazy='dynamic'))

    def __init__(self, username, password, is_admin=False, is_lecturer=False, is_rep=False, class_id=None):
        self.username = username
        self.password = bcrypt.generate_password_hash(password).decode('utf-8')
        self.is_admin = is_admin
        self.is_lecturer = is_lecturer
        self.is_rep = is_rep
        if is_rep and class_id:  # Only set class_id if user is a class rep
            self.class_id = class_id
        pass

    def __repr__(self):
        return f'<User {self.username}>'
    def __str__(self):
        return self.username
    def __eq__(self, other):
        if isinstance(other, User):
            return self.username == other.username
        return False
    def __ne__(self, other):
        return not self.__eq__(other)
    def __lt__(self, other):
        if isinstance(other, User):
            return self.username < other.username
        return NotImplemented
    def __le__(self, other):
        if isinstance(other, User):
            return self.username <= other.username

    def set_password(self, password):
        self.password = bcrypt.generate_password_hash(password).decode('utf-8')

    def check_password(self, password):
        return bcrypt.check_password_hash(self.password, password)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(user_id)  # user_id is now a UUID string

# Update login route with password hashing
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        try:
            username = request.form.get('username')
            password = request.form.get('password')
            
            if not username or not password:
                flash('Please provide both username and password')
                return redirect(url_for('login'))
            
            user = User.query.filter_by(username=username).first()
            
            if user and user.check_password(password):
                login_user(user)
                return redirect(url_for('admin_dashboard'))
            else:
                flash('Invalid username or password')
            return redirect(url_for('login'))

        except Exception as e:
            flash('An error occurred. Please try again.')
            print(f"Login error: {str(e)}")
            return redirect(url_for('login'))
            
    return render_template('login.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('index'))

# Routes
@app.route('/')
def index():
    return render_template('index.html')

# Update admin dashboard route
@app.route('/admin/dashboard')
@login_required
def admin_dashboard():
    recent_sessions = Session.query.order_by(Session.created_at.desc()).limit(5).all()
    recent_students = Student.query.order_by(Student.created_at.desc()).limit(5).all()
    
    return render_template('admin/dashboard.html',
        students_count=Student.query.count(),
        sessions_count=Session.query.count(),
        classrooms_count=Classroom.query.count(),
        users_count=User.query.count(),
        programs_count=Program.query.count(),
        courses_count=Course.query.count(),
        recent_sessions=recent_sessions,
        recent_students=recent_students,
    )


@app.route('/admin', methods=['GET', 'POST'])
@csrf.exempt
def admin_rediret():
    return redirect("/admin/dashboard")
@app.route('/admin/students/new', methods=['GET', 'POST'])
@csrf.exempt
def new_student():
    if request.method == 'POST':
        try:
            # Lazy load face_recognition
            fr = get_face_recognition()
            
            # Get form data
            student_id = request.form.get('student_id')
            firstname = request.form.get('firstname')
            lastname = request.form.get('lastname')
            othernames = request.form.get('othernames', '')
            class_id = request.form.get('class_id')
            
            # Validate student ID format
            if not student_id or not student_id.isdigit() or len(student_id) != 10:
                return jsonify({'success': False, 'error': 'Invalid student ID format. Must be 10 digits'}), 400
            
            # Check if the student ID already exists
            existing_student = Student.query.filter_by(student_id=student_id).first()
            if existing_student:
                return jsonify({'success': False, 'error': 'Student ID already exists'}), 400
            
            # Get the uploaded face images (should be 5 images)
            face_images = request.files.getlist('face_images')
            
            if len(face_images) != 5:
                return jsonify({'success': False, 'error': f'Expected 5 face images, got {len(face_images)}'}), 400
            
            # Create directory for this student's images
            student_folder = os.path.join(app.config['UPLOAD_FOLDER'], f'student_{student_id}')
            os.makedirs(student_folder, exist_ok=True)
            
            # Process and save images, extract face encodings
            face_encodings = []
            image_paths = []
            
            for idx, image_file in enumerate(face_images):
                if image_file and image_file.filename:
                    # Save the image
                    filename = secure_filename(f'face_{idx + 1}.jpg')
                    filepath = os.path.join(student_folder, filename)
                    image_file.save(filepath)
                    image_paths.append(filepath)
                    
                    # Load the image and extract face encoding
                    image = fr.load_image_file(filepath)
                    encodings = fr.face_encodings(image)
                    
                    if len(encodings) > 0:
                        face_encodings.append(encodings[0])
                    else:
                        # Clean up and return error
                        import shutil
                        shutil.rmtree(student_folder)
                        return jsonify({'success': False, 'error': f'No face detected in image {idx + 1}'}), 400
            
            if len(face_encodings) == 0:
                # Clean up and return error
                import shutil
                shutil.rmtree(student_folder)
                return jsonify({'success': False, 'error': 'No faces detected in any image'}), 400
            
            # Average the face encodings for better recognition
            avg_encoding = np.mean(face_encodings, axis=0)
            
            # Create the student record
            student = Student(
                student_id=student_id,
                firstname=firstname,
                lastname=lastname,
                othernames=othernames,
                face_encoding=json.dumps(avg_encoding.tolist()),
                face_images=json.dumps(image_paths),
                class_id=class_id
            )
            
            db.session.add(student)
            db.session.commit()
            
            return jsonify({'success': True, 'message': 'Student enrolled successfully!'})
            
        except Exception as e:
            print(f"Error saving student: {str(e)}")
            import traceback
            traceback.print_exc()
            return jsonify({'success': False, 'error': str(e)}), 400
    
    # Handle class list based on user role
    if current_user.is_admin:
        classes = Class.query.all()
    elif current_user.is_lecturer:
        classes = current_user.teaching_classes
    else:  # for class reps
        classes = [current_user.current_class] if current_user.current_class else []
    
    return render_template('admin/students/new.html', 
                         classes=classes,
                         user_role={
                             'is_admin': current_user.is_admin,
                             'is_lecturer': current_user.is_lecturer,
                             'is_rep': current_user.is_rep,
                             'rep_class_id': current_user.class_id
                         })

# Remote Registration Token Management
@app.route('/admin/registration-tokens')
@login_required
def list_registration_tokens():
    """List all registration tokens for the current user's accessible classes"""
    if not (current_user.is_admin or current_user.is_lecturer or current_user.is_rep):
        flash('Access denied')
        return redirect(url_for('admin_dashboard'))
    
    # Get query parameters
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    search = request.args.get('search', '', type=str)
    status_filter = request.args.get('status', '', type=str)
    
    # Get base query based on user role
    if current_user.is_admin:
        query = RegistrationToken.query
    elif current_user.is_lecturer:
        class_ids = [c.id for c in current_user.teaching_classes]
        query = RegistrationToken.query.filter(RegistrationToken.class_id.in_(class_ids))
    else:  # class rep
        query = RegistrationToken.query.filter_by(class_id=current_user.class_id)
    
    # Apply search filter
    if search:
        search_filter = f"%{search}%"
        query = query.join(Class).join(Program).filter(
            db.or_(
                Program.program_name.ilike(search_filter),
                Class.group.ilike(search_filter)
            )
        )
    
    # Apply status filter
    if status_filter == 'active':
        query = query.filter(RegistrationToken.is_active == True)
    elif status_filter == 'inactive':
        query = query.filter(RegistrationToken.is_active == False)
    
    # Order and paginate
    query = query.order_by(RegistrationToken.created_at.desc())
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    
    return render_template('admin/registration_tokens/list.html', 
                         tokens=pagination.items,
                         pagination=pagination,
                         search=search,
                         status_filter=status_filter,
                         per_page=per_page)

@app.route('/admin/registration-tokens/generate', methods=['GET', 'POST'])
@login_required
def generate_registration_token():
    """Generate a new registration token"""
    if not (current_user.is_admin or current_user.is_lecturer or current_user.is_rep):
        flash('Access denied')
        return redirect(url_for('admin_dashboard'))
    
    if request.method == 'POST':
        try:
            class_id = request.form.get('class_id')
            
            # Validate that class_id was provided and not empty
            if not class_id or class_id == '':
                return jsonify({'success': False, 'error': 'Please select a class'}), 400
            
            # class_id is now a UUID string, no conversion needed
            print(f"DEBUG: Using class_id as UUID string: {class_id}")
            
            # Validate class access
            if current_user.is_rep and class_id != current_user.class_id:
                return jsonify({'success': False, 'error': 'Access denied to this class'}), 403
            
            if current_user.is_lecturer:
                class_ids = [c.id for c in current_user.teaching_classes]
                print(f"DEBUG: Lecturer's class IDs: {class_ids}")
                if class_id not in class_ids:
                    return jsonify({'success': False, 'error': 'Access denied to this class'}), 403
            
            # Verify class exists
            target_class = Class.query.get(class_id)
            print(f"DEBUG: Target class: {target_class}")
            if not target_class:
                return jsonify({'success': False, 'error': 'Class not found'}), 404
            
            # Check if active token already exists for this class
            existing_token = RegistrationToken.query.filter_by(class_id=class_id, is_active=True).first()
            print(f"DEBUG: Existing token: {existing_token}")
            if existing_token:
                registration_url = url_for('remote_registration', token=existing_token.token, _external=True)
                print(f"DEBUG: Reusing existing token, URL: {registration_url}")
                return jsonify({
                    'success': True,
                    'token': existing_token.token,
                    'url': registration_url,
                    'message': 'Using existing active token for this class'
                })
            
            # Generate new token
            new_token_string = RegistrationToken.generate_token()
            print(f"DEBUG: Generated new token string: {new_token_string}")
            
            token = RegistrationToken(
                token=new_token_string,
                class_id=class_id,
                created_by=current_user.id,
                is_active=True
            )
            
            db.session.add(token)
            db.session.commit()
            print(f"DEBUG: Token saved to database with ID: {token.id}")
            
            registration_url = url_for('remote_registration', token=token.token, _external=True)
            print(f"DEBUG: Generated URL: {registration_url}")
            return jsonify({
                'success': True,
                'token': token.token,
                'url': registration_url
            })
            
        except Exception as e:
            print(f"Error generating registration token: {str(e)}")
            import traceback
            traceback.print_exc()
            return jsonify({'success': False, 'error': f'Server error: {str(e)}'}), 400
    
    # GET request - show form
    if current_user.is_admin:
        classes = Class.query.all()
    elif current_user.is_lecturer:
        classes = current_user.teaching_classes
    else:  # class rep
        classes = [current_user.current_class] if current_user.current_class else []
    
    return render_template('admin/registration_tokens/generate.html', classes=classes)

@app.route('/admin/registration-tokens/toggle/<token_id>', methods=['POST'])
@csrf.exempt
@login_required
def toggle_registration_token(token_id):
    """Toggle registration token active status"""
    if not (current_user.is_admin or current_user.is_lecturer or current_user.is_rep):
        return jsonify({'success': False, 'error': 'Access denied'}), 403
    
    token = RegistrationToken.query.get_or_404(token_id)
    
    # Verify access
    if current_user.is_rep and token.class_id != current_user.class_id:
        return jsonify({'success': False, 'error': 'Access denied'}), 403
    
    if current_user.is_lecturer:
        class_ids = [c.id for c in current_user.teaching_classes]
        if token.class_id not in class_ids:
            return jsonify({'success': False, 'error': 'Access denied'}), 403
    
    token.is_active = not token.is_active
    db.session.commit()
    
    return jsonify({
        'success': True,
        'is_active': token.is_active,
        'message': f"Registration {'enabled' if token.is_active else 'disabled'}"
    })

@app.route('/admin/registration-tokens/delete/<token_id>', methods=['POST'])
@csrf.exempt
@login_required
def delete_registration_token(token_id):
    """Delete a registration token"""
    if not (current_user.is_admin or current_user.is_lecturer or current_user.is_rep):
        return jsonify({'success': False, 'error': 'Access denied'}), 403
    
    token = RegistrationToken.query.get_or_404(token_id)
    
    # Verify access
    if current_user.is_rep and token.class_id != current_user.class_id:
        return jsonify({'success': False, 'error': 'Access denied'}), 403
    
    if current_user.is_lecturer:
        class_ids = [c.id for c in current_user.teaching_classes]
        if token.class_id not in class_ids:
            return jsonify({'success': False, 'error': 'Access denied'}), 403
    
    db.session.delete(token)
    db.session.commit()
    
    return jsonify({'success': True, 'message': 'Registration link deleted'})

# Remote Registration (Public Access with Token)
@app.route('/register/<token>')
@csrf.exempt
def remote_registration(token):
    """Public registration page accessed via token"""
    reg_token = RegistrationToken.query.filter_by(token=token).first_or_404()
    
    if not reg_token.is_active:
        return render_template('registration_closed.html', 
                             class_info=reg_token.class_ref,
                             creator=reg_token.creator)
    
    return render_template('remote_registration.html', 
                         token=token,
                         class_info=reg_token.class_ref)

@app.route('/api/remote-register/<token>', methods=['POST'])
@csrf.exempt
def api_remote_registration(token):
    """API endpoint for remote student registration"""
    reg_token = RegistrationToken.query.filter_by(token=token).first_or_404()
    
    if not reg_token.is_active:
        return jsonify({'success': False, 'error': 'Registration is currently closed. Please contact your lecturer or class representative.'}), 403
    
    try:
        # Get form data
        student_id = request.form.get('student_id')
        firstname = request.form.get('firstname')
        lastname = request.form.get('lastname')
        othernames = request.form.get('othernames', '')
        
        # Check if student already exists
        existing_student = Student.query.filter_by(student_id=student_id).first()
        if existing_student:
            return jsonify({'success': False, 'error': f'Student with ID {student_id} already exists'}), 400
        
        # Get face images
        face_images = request.files.getlist('face_images')
        if len(face_images) != 5:
            return jsonify({'success': False, 'error': 'Exactly 5 face images are required'}), 400
        
        # Process face images
        fr = get_face_recognition()
        student_folder = os.path.join('uploads', f'student_{student_id}')
        os.makedirs(student_folder, exist_ok=True)
        
        encodings = []
        image_paths = []
        
        for i, img_file in enumerate(face_images):
            filename = secure_filename(f'face_{i+1}.jpg')
            filepath = os.path.join(student_folder, filename)
            img_file.save(filepath)
            image_paths.append(filepath)
            
            # Extract face encoding
            image = fr.load_image_file(filepath)
            face_encodings = fr.face_encodings(image)
            
            if len(face_encodings) == 0:
                return jsonify({'success': False, 'error': f'No face detected in image {i+1}. Please retake the photo.'}), 400
            
            encodings.append(face_encodings[0])
        
        # Average the encodings
        avg_encoding = np.mean(encodings, axis=0)
        
        # Create student record with the token's class
        student = Student(
            student_id=student_id,
            firstname=firstname,
            lastname=lastname,
            othernames=othernames,
            face_encoding=json.dumps(avg_encoding.tolist()),
            face_images=json.dumps(image_paths),
            class_id=reg_token.class_id  # Use the class from the token
        )
        
        db.session.add(student)
        db.session.commit()
        
        return jsonify({'success': True, 'message': 'Registration successful!'})
        
    except Exception as e:
        print(f"Error in remote registration: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 400

@app.route('/admin/sessions/new', methods=['GET', 'POST'])
@login_required
def new_session():

    if not current_user.is_admin and not current_user.is_rep and not current_user.is_lecturer:
        flash('Access denied')
        return redirect(url_for('admin_dashboard'))
    
    if request.method == 'POST':
        # For class reps, use their assigned class
        lecturer = User.query.get(request.form['lecturer_id'])
        class_id = current_user.class_id if current_user.is_rep else request.form['class_id']
        
        # Get expiration settings
        expiration_type = request.form.get('expiration_type', 'always_open')
        expiration_value = None
        expires_at = None
        
        if expiration_type == 'fixed_duration':
            amount = request.form.get('duration_amount', '24')
            unit = request.form.get('duration_unit', 'hours')
            expiration_value = json.dumps({'amount': amount, 'unit': unit})
            expires_at = calculate_expiration(expiration_type, expiration_value)
        
        elif expiration_type == 'specific_time':
            time_value = request.form.get('specific_time', '23:59')
            expiration_value = json.dumps({'time': time_value})
            expires_at = calculate_expiration(expiration_type, expiration_value)
        
        elif expiration_type == 'custom_range':
            start_time = request.form.get('range_start', '00:00')
            end_time = request.form.get('range_end', '23:59')
            expiration_value = json.dumps({'start': start_time, 'end': end_time})
            expires_at = calculate_expiration(expiration_type, expiration_value)
        
        elif expiration_type == 'instant_expire':
            expires_at = datetime.utcnow()  # Already expired
        
        session = Session(
            semester=request.form['semester'],
            week=request.form['week'],
            date=datetime.strptime(request.form['date'], '%Y-%m-%d'),
            classroom_id=request.form['classroom_id'],
            class_id=class_id,
            course_id=request.form['course_id'],
            lecturer_id=request.form['lecturer_id'],
            expiration_type=expiration_type,
            expiration_value=expiration_value,
            expires_at=expires_at
        )
        
        # Verify lecturer teaches this class
        if class_id not in [c.id for c in lecturer.teaching_classes]:
            flash('Selected lecturer does not teach this class', 'error')
            return redirect(url_for('new_session'))
        
        db.session.add(session)
        db.session.commit()
        flash('Session created successfully')
        return redirect(url_for('list_sessions'))
    
    # GET request - show the form
    classrooms = Classroom.query.all()
    courses = Course.query.all()
    
    if current_user.is_admin:
        classes = Class.query.all()
        lecturers = User.query.filter_by(is_lecturer=True).all()

    else:
        # For class reps, only show their class and its assigned lecturers
        classes = [current_user.current_class]
        lecturers = User.query.filter(
            User.is_lecturer == True,
            User.teaching_classes.any(id=current_user.class_id)
        ).all()
    
    return render_template('admin/sessions/new.html',
                         classrooms=classrooms,
                         courses=courses,
                         classes=classes,
                         lecturers=lecturers)

@app.route('/attendance/<session_id>')
def attendance(session_id):
    session = Session.query.get_or_404(session_id)
    
    # Check if session has expired
    if session.is_expired():
        return render_template('session_expired.html', session=session)
    
    return render_template('attendance.html', session=session)

def find_matching_student(face_image_data, tolerance=0.6):
    """
    Find a matching student using face recognition.
    face_image_data: base64 encoded image data
    tolerance: Lower is more strict (default 0.6)
    """
    try:
        # Lazy load face_recognition
        fr = get_face_recognition()
        
        # Decode the base64 image
        image_data = base64.b64decode(face_image_data.split(',')[1] if ',' in face_image_data else face_image_data)
        image = Image.open(BytesIO(image_data))
        
        # Convert PIL image to numpy array
        image_np = np.array(image)
        
        # Get face encoding from the captured image
        face_encodings = fr.face_encodings(image_np)
        
        if len(face_encodings) == 0:
            print("No face detected in the captured image")
            return None
        
        captured_encoding = face_encodings[0]
        
        # Get all students with face encodings
        students = Student.query.filter(Student.face_encoding.isnot(None)).all()
        
        print(f"Comparing against {len(students)} students")
        
        best_match = None
        best_distance = float('inf')
        
        for student in students:
            try:
                # Parse the stored face encoding
                stored_encoding = np.array(json.loads(student.face_encoding), dtype=np.float64)
                
                # Use face_recognition's compare_faces for better accuracy
                matches = fr.compare_faces([stored_encoding], captured_encoding, tolerance=tolerance)
                
                if matches[0]:
                    # Calculate distance for ranking
                    distance = fr.face_distance([stored_encoding], captured_encoding)[0]
                    print(f"Match found: {student.firstname} {student.lastname} with distance: {distance}")
                    
                    if distance < best_distance:
                        best_distance = distance
                        best_match = student
                        
            except Exception as e:
                print(f"Error processing student {student.firstname} {student.lastname}: {str(e)}")
                continue
        
        if best_match:
            print(f"Best match: {best_match.firstname} {best_match.lastname} with distance: {best_distance}")
        else:
            print("No match found")
        
        return best_match
        
    except Exception as e:
        print(f"Error in find_matching_student: {str(e)}")
        import traceback
        traceback.print_exc()
        return None

def point_inside_polygon(point, polygon_coords, altitude, classroom_altitude, tolerance):
    # Check if within vertical tolerance (3 meters by default)
    vertical_ok = abs(altitude - classroom_altitude) <= tolerance
    
    if not vertical_ok:
        return False
    
    # Existing 2D coordinate check
    x, y = point
    n = len(polygon_coords)
    inside = False
    
    p1x, p1y = polygon_coords[0]
    for i in range(n + 1):
        p2x, p2y = polygon_coords[i % n]
        if y > min(p1y, p2y):
            if y <= max(p1y, p2y):
                if x <= max(p1x, p2x):
                    if p1y != p2y:
                        xinters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                    if p1x == p2x or x <= xinters:
                        inside = not inside
        p1x, p1y = p2x, p2y
    
    return inside

@app.route('/api/mark-attendance', methods=['POST'])
@csrf.exempt
def mark_attendance():
    try:
        data = request.json
        face_image_data = data['face_image']  # Base64 encoded image
        session_id = data['session_id']
        latitude = data['latitude']
        longitude = data['longitude']
        
        # Get the session and its classroom
        session = Session.query.get_or_404(session_id)
        
        # Check if session has expired
        if session.is_expired():
            return jsonify({
                'error': 'This session has expired. Please contact your course representative or lecturer.',
                'student_name': 'Session Expired'
            }), 200
        
        classroom = Classroom.query.get_or_404(session.classroom_id)
        
        # Find the matching student using face recognition
        matched_student = find_matching_student(face_image_data)
        
        if not matched_student:
            return jsonify({
                'error': 'User not recognized',
                'student_name': 'Unknown'
            }), 200
        
        # Check if student belongs to the class of this session
        if matched_student.class_id != session.class_id:
            return jsonify({
                'error': f'Access denied: {matched_student.firstname} {matched_student.lastname} is not registered in this class',
                'student_name': f'{matched_student.firstname} {matched_student.lastname}'
            }), 200

        # Check if student has already marked attendance for this session
        existing_attendance = Attendance.query.filter_by(
            student_id=matched_student.id,
            session_id=session_id
        ).first()
        
        if existing_attendance:
            return jsonify({
                'error': f'Attendance already marked for {matched_student.firstname} {matched_student.lastname}',
                'student_name': f'{matched_student.firstname} {matched_student.lastname}'
            }), 200
        
        # Parse classroom coordinates
        classroom_coords = json.loads(classroom.coordinates)
        polygon_coords = []
        for coord in classroom_coords:
            lat, lon = map(float, coord.split(','))
            polygon_coords.append((lat, lon))
        
        # Check altitude
        altitude = data.get('altitude', 0)
        altitude = float(altitude) if altitude else 0.0

        # Check altitude
        altitude_ok = (classroom.altitude - classroom.altitude_tolerance <= altitude <= 
                      classroom.altitude + classroom.altitude_tolerance)
        
        # Update classroom check
        is_in_classroom = point_inside_polygon(
            (float(latitude), float(longitude)), 
            polygon_coords,
            altitude,
            classroom.altitude,
            classroom.altitude_tolerance
        )
        
        # Create attendance record
        attendance = Attendance(
            student_id=matched_student.id,
            session_id=session_id,
            timestamp=datetime.now(),
            latitude=latitude,
            longitude=longitude,
            altitude=altitude
        )
        
        db.session.add(attendance)
        db.session.commit()

        name = f"{matched_student.firstname} {matched_student.othernames} {matched_student.lastname}"

        return jsonify({
            'message': 'Attendance marked successfully',
            'student_name': name,
            'in_classroom': is_in_classroom,
            'altitude_check': altitude_ok
        })
    except Exception as e:
        print(f"Error in mark_attendance: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/attendance/success/<studentname>/')
def attendance_success(studentname):
    in_classroom = request.args.get('in_classroom', 'true').lower() == 'true'
    session_id = request.args.get('sessionid', 0)
    print(f"Session ID: {session_id}")
    return render_template('attendance_success.html', 
                         student_name=studentname, 
                         session_id=session_id, 
                         datetime=datetime,
                         in_classroom=in_classroom)

@app.route('/admin/students/delete/<student_id>', methods=['POST'])
@csrf.exempt
def delete_student(student_id):
    try:
        student = Student.query.get_or_404(student_id)
        db.session.delete(student)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Student deleted successfully'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400


# Add this route to view session attendance
@app.route('/admin/attendance/<session_id>')
@login_required
def session_attendance(session_id):
    session = Session.query.get_or_404(session_id)

    # Query all attendance records for this session with student information
    attendance_records = db.session.query(
        Attendance, Student
    ).join(
        Student, Attendance.student_id == Student.id
    ).filter(
        Attendance.session_id == session_id
    ).all()
    
    # Process attendance records to include location names
    attendance_data = []
    for attendance, student in attendance_records:
        attendance_data.append({
            'student': student,
            'attendance': attendance,
        })
    
    return render_template(
        'admin/session_attendance.html',
        session=session,
        attendance_data=attendance_data
    )

@app.route('/admin/attendance/<session_id>/export')
@login_required
def export_attendance(session_id):
    import csv
    from io import StringIO
    
    session = Session.query.get_or_404(session_id)
    
    # Query all attendance records for this session with student information
    attendance_records = db.session.query(
        Attendance, Student
    ).join(
        Student, Attendance.student_id == Student.id
    ).filter(
        Attendance.session_id == session_id
    ).order_by(Student.lastname).all()
    
    # Create a string buffer to write CSV data
    si = StringIO()
    cw = csv.writer(si)
    
    # Write header row
    cw.writerow(['Student ID', 'First Name', 'Last Name', 'Other Names', 'Time'])
    
    # Write attendance data
    for attendance, student in attendance_records:
        cw.writerow([
            student.student_id,
            student.firstname,
            student.lastname,
            student.othernames,
            attendance.timestamp.strftime('%Y-%m-%d %I:%M %p')
        ])
    
    output = si.getvalue()
    si.close()
    
    # Generate filename
    filename = f"attendance_{session.course.course_name}_week{session.week}_{session.date.strftime('%Y%m%d')}.csv"
    
    return Response(
        output,
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment;filename={filename}"})

@app.route('/admin/sessions/delete/<session_id>', methods=['POST'])
@csrf.exempt
def delete_session(session_id):
    try:
        session = Session.query.get_or_404(session_id)
        
        # Delete all attendance records for this session
        Attendance.query.filter_by(session_id=session_id).delete()
        
        # Delete the session
        db.session.delete(session)
        db.session.commit()
        
        return jsonify({'success': True, 'message': 'Session deleted successfully'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

@app.route('/admin/sessions/expire/<session_id>', methods=['POST'])
@csrf.exempt
@login_required
def expire_session(session_id):
    """Instantly expire a session"""
    try:
        session = Session.query.get_or_404(session_id)
        
        # Set expiration to now
        session.expiration_type = 'instant_expire'
        session.expires_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({'success': True, 'message': 'Session expired successfully'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

@app.route('/admin/sessions/restore/<session_id>', methods=['GET', 'POST'])
@login_required
def restore_session(session_id):
    """Restore an expired session with new expiration settings"""
    if not (current_user.is_admin or current_user.is_lecturer):
        flash('Access denied')
        return redirect(url_for('admin_dashboard'))
    
    session = Session.query.get_or_404(session_id)
    
    # Verify access for lecturers
    if current_user.is_lecturer and session.lecturer_id != current_user.id:
        flash('Access denied')
        return redirect(url_for('admin_dashboard'))
    
    if request.method == 'POST':
        # Get new expiration settings
        expiration_type = request.form.get('expiration_type', 'always_open')
        expiration_value = None
        expires_at = None
        
        if expiration_type == 'fixed_duration':
            amount = request.form.get('duration_amount', '24')
            unit = request.form.get('duration_unit', 'hours')
            expiration_value = json.dumps({'amount': amount, 'unit': unit})
            expires_at = calculate_expiration(expiration_type, expiration_value)
        
        elif expiration_type == 'specific_time':
            time_value = request.form.get('specific_time', '23:59')
            expiration_value = json.dumps({'time': time_value})
            expires_at = calculate_expiration(expiration_type, expiration_value)
        
        elif expiration_type == 'custom_range':
            start_time = request.form.get('range_start', '00:00')
            end_time = request.form.get('range_end', '23:59')
            expiration_value = json.dumps({'start': start_time, 'end': end_time})
            expires_at = calculate_expiration(expiration_type, expiration_value)
        
        # Update session expiration
        session.expiration_type = expiration_type
        session.expiration_value = expiration_value
        session.expires_at = expires_at
        
        db.session.commit()
        flash('Session restored successfully')
        return redirect(url_for('list_sessions'))
    
    # GET request - show restore form
    return render_template('admin/sessions/restore.html', session=session)

@app.route('/admin/users')
@login_required
def list_users():
    if not current_user.is_admin:
        flash('Access denied')
        return redirect(url_for('admin_dashboard'))
    
    # Get query parameters
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    search = request.args.get('search', '', type=str)
    role_filter = request.args.get('role', '', type=str)
    
    # Build query
    query = User.query
    
    # Apply search filter
    if search:
        search_filter = f"%{search}%"
        query = query.filter(User.username.ilike(search_filter))
    
    # Apply role filter
    if role_filter == 'admin':
        query = query.filter(User.is_admin == True)
    elif role_filter == 'lecturer':
        query = query.filter(User.is_lecturer == True)
    elif role_filter == 'rep':
        query = query.filter(User.is_rep == True)
    
    # Order and paginate
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    
    return render_template('admin/users/list.html', 
                         users=pagination.items,
                         pagination=pagination,
                         search=search,
                         role_filter=role_filter,
                         per_page=per_page)

@app.route('/admin/users/new', methods=['GET', 'POST'])
@login_required
def new_user():
    if not current_user.is_admin:
        flash('Access denied')
        return redirect(url_for('admin_dashboard'))
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        is_rep = bool(request.form.get('is_rep'))
        is_lecturer = bool(request.form.get('is_lecturer'))
        class_id = request.form.get('class_id') if is_rep else None
        
        # Check if username already exists
        if User.query.filter_by(username=username).first():
            flash('Username already exists', 'error')
            return redirect(url_for('new_user'))
        
        # If user is a class rep, validate class selection
        if is_rep and not class_id:
            flash('Class selection is required for class representatives', 'error')
            return redirect(url_for('new_user'))
        
        # For lecturers, validate teaching classes selection
        teaching_class_ids = request.form.getlist('teaching_classes') if is_lecturer else []
        if is_lecturer and not teaching_class_ids:
            flash('At least one teaching class must be selected for lecturers', 'error')
            return redirect(url_for('new_user'))
        
        user = User(
            username=username,
            password=password,
            is_admin=bool(request.form.get('is_admin')),
            is_lecturer=is_lecturer,
            is_rep=is_rep,
            class_id=class_id if is_rep else None
        )
        try:
            db.session.add(user)
            
            # If user is a lecturer, add teaching classes
            if is_lecturer and teaching_class_ids:
                teaching_classes = Class.query.filter(Class.id.in_(teaching_class_ids)).all()
                user.teaching_classes.extend(teaching_classes)
            
            db.session.commit()
            flash('User created successfully')
            return redirect(url_for('list_users'))
        except Exception as e:
            db.session.rollback()
            flash('Error creating user: ' + str(e), 'error')
            return redirect(url_for('new_user'))
    
    # GET request - show the form
    classes = Class.query.all()
    return render_template('admin/users/new.html', classes=classes)

@app.route('/admin/classrooms/new', methods=['GET', 'POST'])
@csrf.exempt
def new_classroom():
    if request.method == 'POST':
        name = request.form['name']
        try:
            corner1 = request.form['corner1']
            corner2 = request.form['corner2']
            corner3 = request.form['corner3']
            corner4 = request.form['corner4']
            altitude = float(request.form['altitude'])
            altitude_tolerance = float(request.form['altitude_tolerance'])
            
            # Log the received coordinates for debugging
            print(f"Received coordinates: corner1={corner1}, corner2={corner2}, corner3={corner3}, corner4={corner4}")
            
            # Validate that all corners are provided
            if not all([corner1, corner2, corner3, corner4]):
                return jsonify({'success': False, 'error': 'All corners must be provided.'}), 400
            
            # Create a new classroom
            classroom = Classroom(
                name=name,
                coordinates=json.dumps([corner1, corner2, corner3, corner4]),
                altitude=altitude,
                altitude_tolerance=altitude_tolerance
            )
            
            db.session.add(classroom)
            db.session.commit()
            
            return jsonify({'success': True, 'message': 'Classroom added successfully!'})
        except Exception as e:
            print(f"Error saving classroom: {str(e)}")
            return jsonify({'success': False, 'error': str(e)}), 400
    
    # Render the form for adding a new classroom
    return render_template('admin/classrooms/new.html')

@app.route('/admin/classrooms')
@login_required
def list_classrooms():
    if not current_user.is_admin:
        flash('Access denied')
        return redirect(url_for('admin_dashboard'))
    
    # Get query parameters
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    search = request.args.get('search', '', type=str)
    
    # Build query
    query = Classroom.query
    
    # Apply search filter
    if search:
        search_filter = f"%{search}%"
        query = query.filter(Classroom.name.ilike(search_filter))
    
    # Order and paginate
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    
    return render_template('admin/classrooms/list.html', 
                         classrooms=pagination.items,
                         pagination=pagination,
                         search=search,
                         per_page=per_page)

@app.route('/admin/classrooms/edit/<classroom_id>', methods=['GET', 'POST'])
@csrf.exempt
def edit_classroom(classroom_id):
    classroom = Classroom.query.get_or_404(classroom_id)
    
    if request.method == 'POST':
        try:
            name = request.form['name']
            corner1 = request.form['corner1']
            corner2 = request.form['corner2']
            corner3 = request.form['corner3']
            corner4 = request.form['corner4']
            altitude = float(request.form['altitude'])
            altitude_tolerance = float(request.form['altitude_tolerance'])
            
            # Validate that all corners are provided
            if not all([corner1, corner2, corner3, corner4]):
                return jsonify({'success': False, 'error': 'All corners must be provided.'}), 400
            
            # Update classroom
            classroom.name = name
            classroom.coordinates = json.dumps([corner1, corner2, corner3, corner4])
            classroom.altitude = altitude
            classroom.altitude_tolerance = altitude_tolerance
            
            db.session.commit()
            return jsonify({'success': True, 'message': 'Classroom updated successfully!'})
        except Exception as e:
            print(f"Error updating classroom: {str(e)}")
            return jsonify({'success': False, 'error': str(e)}), 400
    
    coordinates = json.loads(classroom.coordinates)
    return render_template('admin/classrooms/edit.html', classroom=classroom, coordinates=coordinates)

@app.route('/admin/classrooms/delete/<classroom_id>', methods=['POST'])
@csrf.exempt
def delete_classroom(classroom_id):
    try:
        classroom = Classroom.query.get_or_404(classroom_id)
        
        # Check if classroom is being used in any sessions
        sessions = Session.query.filter_by(classroom_id=classroom_id).first()
        if sessions:
            return jsonify({
                'success': False, 
                'error': 'Cannot delete classroom as it is being used in one or more sessions.'
            }), 400
        
        db.session.delete(classroom)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Classroom deleted successfully'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

@app.route('/qrcode/<session_id>')
def generate_qrcode(session_id):
    try:
        # Generate dynamic attendance URL
        attendance_url = url_for('mark_attendance', session_id=session_id, _external=True)
        
        # Create QR code
        img = qrcode.make(attendance_url)
        img_io = BytesIO()
        img.save(img_io, 'PNG')
        img_io.seek(0)
        
        return send_file(img_io, mimetype='image/png')
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/admin/students')
@login_required
def list_students():
    # Get query parameters
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    search = request.args.get('search', '', type=str)
    class_filter = request.args.get('class_id', '', type=str)
    
    # Build query
    query = Student.query
    
    # Apply search filter
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            db.or_(
                Student.student_id.ilike(search_filter),
                Student.firstname.ilike(search_filter),
                Student.lastname.ilike(search_filter),
                Student.othernames.ilike(search_filter)
            )
        )
    
    # Apply class filter
    if class_filter:
        query = query.filter(Student.class_id == class_filter)
    
    # Order and paginate
    query = query.order_by(Student.created_at.desc())
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    
    # Get all classes for filter dropdown
    classes = Class.query.all()
    
    return render_template('admin/students/list.html', 
                         students=pagination.items,
                         pagination=pagination,
                         classes=classes,
                         search=search,
                         class_filter=class_filter,
                         per_page=per_page)

@app.route('/sessions')
@login_required
def list_sessions():
    # Get query parameters
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    search = request.args.get('search', '', type=str)
    classroom_filter = request.args.get('classroom_id', '', type=str)
    course_filter = request.args.get('course_id', '', type=str)
    status_filter = request.args.get('status', '', type=str)
    
    # Build query
    query = Session.query
    
    # Apply search filter
    if search:
        search_filter = f"%{search}%"
        query = query.join(Course).filter(
            db.or_(
                Course.course_name.ilike(search_filter),
                Session.lecturer.ilike(search_filter)
            )
        )
    
    # Apply classroom filter
    if classroom_filter:
        query = query.filter(Session.classroom_id == classroom_filter)
    
    # Apply course filter
    if course_filter:
        query = query.filter(Session.course_id == course_filter)
    
    # Apply status filter
    if status_filter == 'expired':
        query = query.filter(Session.expires_at < datetime.now())
    elif status_filter == 'active':
        query = query.filter(
            db.or_(
                Session.expiration_type == 'always_open',
                Session.expires_at >= datetime.now()
            )
        )
    
    # Order and paginate
    query = query.order_by(Session.date.desc())
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    
    # Get filter options
    classrooms = Classroom.query.all()
    courses = Course.query.all()
    
    return render_template('admin/sessions/list.html', 
                         sessions=pagination.items,
                         pagination=pagination,
                         classrooms=classrooms,
                         courses=courses,
                         search=search,
                         classroom_filter=classroom_filter,
                         course_filter=course_filter,
                         status_filter=status_filter,
                         per_page=per_page)

@app.route('/admin/programs')
@login_required
def list_programs():
    if not current_user.is_admin:
        flash('Access denied')
        return redirect(url_for('admin_dashboard'))
    
    # Get query parameters
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    search = request.args.get('search', '', type=str)
    
    # Build query
    query = Program.query
    
    # Apply search filter
    if search:
        search_filter = f"%{search}%"
        query = query.filter(Program.program_name.ilike(search_filter))
    
    # Order and paginate
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    
    return render_template('admin/programs/list.html', 
                         programs=pagination.items,
                         pagination=pagination,
                         search=search,
                         per_page=per_page)

@app.route('/admin/programs/new', methods=['GET', 'POST'])
@login_required
def new_program():
    if not current_user.is_admin:
        flash('Access denied')
        return redirect(url_for('admin_dashboard'))
    
    if request.method == 'POST':
        program = Program(
            program_name=request.form['program_name'],
        )
        db.session.add(program)
        db.session.commit()
        flash('Program created successfully')
        return redirect(url_for('list_programs'))
    
    return render_template('admin/programs/new.html')

@app.route('/admin/courses')
@login_required
def list_courses():
    if not current_user.is_admin:
        flash('Access denied')
        return redirect(url_for('admin_dashboard'))
    
    # Get query parameters
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    search = request.args.get('search', '', type=str)
    
    # Build query
    query = Course.query
    
    # Apply search filter
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            db.or_(
                Course.course_name.ilike(search_filter),
                Course.course_code.ilike(search_filter)
            )
        )
    
    # Order and paginate
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    
    return render_template('admin/courses/list.html', 
                         courses=pagination.items,
                         pagination=pagination,
                         search=search,
                         per_page=per_page)

@app.route('/admin/courses/new', methods=['GET', 'POST'])
@login_required
def new_course():
    if not current_user.is_admin:
        flash('Access denied')
        return redirect(url_for('admin_dashboard'))
    
    if request.method == 'POST':
        course = Course(
            course_code=request.form['course_code'],
            course_name=request.form['course_name'],
            credits=request.form['credits'],
            program_id=request.form['program_id']
        )
        db.session.add(course)
        db.session.commit()
        flash('Course created successfully')
        return redirect(url_for('list_courses'))
    programs = Program.query.all()
    return render_template('admin/courses/new.html', programs=programs)

@app.route('/admin/programs/edit/<program_id>', methods=['GET', 'POST'])
@login_required
def edit_program(program_id):
    if not current_user.is_admin:
        flash('Access denied')
        return redirect(url_for('admin_dashboard'))
    
    program = Program.query.get_or_404(program_id)
    
    if request.method == 'POST':
        program.program_name = request.form['program_name']
        program.duration_years = request.form['duration_years']
        db.session.commit()
        flash('Program updated successfully')
        return redirect(url_for('list_programs'))
    
    return render_template('admin/programs/edit.html', program=program)

@app.route('/admin/courses/edit/<course_id>', methods=['GET', 'POST'])
@login_required
def edit_course(course_id):
    if not current_user.is_admin:
        flash('Access denied')
        return redirect(url_for('admin_dashboard'))
    
    course = Course.query.get_or_404(course_id)
    
    if request.method == 'POST':
        course.course_code = request.form['course_code']
        course.course_name = request.form['course_name']
        course.credits = request.form['credits']
        course.program_id = request.form['program_id']
        db.session.commit()
        flash('Course updated successfully')
        return redirect(url_for('list_courses'))
    programs = Program.query.all()
    return render_template('admin/courses/edit.html', course=course, programs=programs)
    
@app.route('/admin/courses/delete/<course_id>', methods=['POST'])
@login_required
def delete_course(course_id):
    print(f"Deleting course with ID: {course_id}")
    if not current_user.is_admin:
        flash('Access denied')
        return redirect(url_for('admin_dashboard'))
    try:
        course = Course.query.get_or_404(course_id)
        db.session.delete(course)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Course deleted successfully'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

@app.route('/admin/classes')
@login_required
def list_classes():
    if not current_user.is_admin:
        flash('Access denied')
        return redirect(url_for('admin_dashboard'))
    
    # Get query parameters
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    search = request.args.get('search', '', type=str)
    program_filter = request.args.get('program_id', '', type=str)
    year_filter = request.args.get('year_group', '', type=str)
    
    # Build query
    query = Class.query
    
    # Apply search filter
    if search:
        search_filter = f"%{search}%"
        query = query.join(Program).filter(
            db.or_(
                Program.program_name.ilike(search_filter),
                Class.group.ilike(search_filter),
                Class.session.ilike(search_filter)
            )
        )
    
    # Apply program filter
    if program_filter:
        query = query.filter(Class.program_id == program_filter)
    
    # Apply year filter
    if year_filter:
        query = query.filter(Class.year_group == year_filter)
    
    # Order and paginate
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    
    # Get filter options
    programs = Program.query.all()
    
    return render_template('admin/classes/list.html', 
                         classes=pagination.items,
                         pagination=pagination,
                         programs=programs,
                         search=search,
                         program_filter=program_filter,
                         year_filter=year_filter,
                         per_page=per_page)

@app.route('/admin/classes/new', methods=['GET', 'POST'])
@login_required
def new_class():
    if not current_user.is_admin:
        flash('Access denied')
        return redirect(url_for('admin_dashboard'))
    
    if request.method == 'POST':
        cur_class = Class(
            program_id=request.form['program_id'],
            group=request.form['group'],
            year_group=request.form['year_group'],
            session=request.form['session_name'],
        )
        db.session.add(cur_class)
        db.session.commit()
        flash('Class created successfully')
        return redirect(url_for('list_classes'))
    
    programs = Program.query.all()
    return render_template('admin/classes/new.html', programs=programs)

@app.route('/admin/classes/edit/<class_id>', methods=['GET', 'POST'])
@login_required
def edit_class(class_id):
    if not current_user.is_admin:
        flash('Access denied')
        return redirect(url_for('admin_dashboard'))
    
    cur_class = Class.query.get_or_404(class_id)
    
    if request.method == 'POST':
        cur_class.program_id = request.form['program_id']
        cur_class.group = request.form['group']
        cur_class.year_group = request.form['year_group']
        cur_class.session = request.form['session_name']
        db.session.commit()
        flash('Class updated successfully')
        return redirect(url_for('list_classes'))
    
    programs = Program.query.all()
    sessions = ['morning', 'evening', 'weekend']
    return render_template('admin/classes/edit.html', cur_class=cur_class, programs=programs, sessions=sessions)

@app.route('/admin/classes/delete/<class_id>', methods=['POST'])
@login_required
def delete_class(class_id):
    if not current_user.is_admin:
        flash('Access denied')
        return redirect(url_for('admin_dashboard'))
    
    try:
        class_ = Class.query.get_or_404(class_id)
        # Check if class has any representatives
        if User.query.filter_by(class_id=class_id).first():
            return jsonify({
                'success': False,
                'error': 'Cannot delete class as it has assigned representatives'
            }), 400
        
        db.session.delete(class_)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Class deleted successfully'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 400

@app.route('/admin/sessions/edit/<session_id>', methods=['GET', 'POST'])
@login_required
def edit_session(session_id):
    if not (current_user.is_admin or current_user.is_lecturer):
        flash('Access denied')
        return redirect(url_for('admin_dashboard'))
    
    session = Session.query.get_or_404(session_id)
    
    # Verify access for lecturers
    if current_user.is_lecturer and session.lecturer_id != current_user.id:
        flash('Access denied')
        return redirect(url_for('admin_dashboard'))
    
    if request.method == 'POST':
        # Update basic session info
        session.semester = request.form['semester']
        session.week = request.form['week']
        session.date = datetime.strptime(request.form['date'], '%Y-%m-%d')
        session.classroom_id = request.form['classroom_id']
        session.course_id = request.form['course_id']
        session.lecturer_id = request.form['lecturer_id']
        
        # Update expiration settings
        expiration_type = request.form.get('expiration_type', 'always_open')
        expiration_value = None
        expires_at = None
        
        if expiration_type == 'fixed_duration':
            amount = request.form.get('duration_amount', '24')
            unit = request.form.get('duration_unit', 'hours')
            expiration_value = json.dumps({'amount': amount, 'unit': unit})
            expires_at = calculate_expiration(expiration_type, expiration_value)
        
        elif expiration_type == 'specific_time':
            time_value = request.form.get('specific_time', '23:59')
            expiration_value = json.dumps({'time': time_value})
            expires_at = calculate_expiration(expiration_type, expiration_value)
        
        elif expiration_type == 'custom_range':
            start_time = request.form.get('range_start', '00:00')
            end_time = request.form.get('range_end', '23:59')
            expiration_value = json.dumps({'start': start_time, 'end': end_time})
            expires_at = calculate_expiration(expiration_type, expiration_value)
        
        elif expiration_type == 'instant_expire':
            expires_at = datetime.utcnow()  # Already expired
        
        session.expiration_type = expiration_type
        session.expiration_value = expiration_value
        session.expires_at = expires_at
        
        db.session.commit()
        flash('Session updated successfully')
        return redirect(url_for('list_sessions'))
    
    # GET request - show the form
    classrooms = Classroom.query.all()
    courses = Course.query.all()
    classes = Class.query.all()
    lecturers = User.query.filter_by(is_lecturer=True).all()
    
    return render_template('admin/sessions/edit.html', 
                         session=session,
                         classrooms=classrooms,
                         courses=courses,
                         classes=classes,
                         lecturers=lecturers)

# Add new association table for lecturer-class relationship
lecturer_classes = db.Table('lecturer_classes',
    db.Column('user_id', String(36), db.ForeignKey('user.id'), primary_key=True),
    db.Column('class_id', String(36), db.ForeignKey('class.id'), primary_key=True),
)

@app.route('/admin/profile', methods=['GET', 'POST'])
@login_required
def edit_profile():
    if request.method == 'POST':
        # Update personal information
        current_user.firstname = request.form.get('firstname')
        current_user.lastname = request.form.get('lastname')
        current_user.othernames = request.form.get('othernames')
        
        try:
            db.session.commit()
            flash('Profile updated successfully', 'success')
        except Exception as e:
            db.session.rollback()
            flash('Error updating profile: ' + str(e), 'error')
        
        return redirect(url_for('edit_profile'))
    
    return render_template('admin/users/profile.html')

@app.route('/admin/change-password', methods=['POST'])
@login_required
def change_password():
    current_password = request.form.get('current_password')
    new_password = request.form.get('new_password')
    confirm_password = request.form.get('confirm_password')
    
    if not current_password or not new_password or not confirm_password:
        flash('All password fields are required', 'error')
        return redirect(url_for('edit_profile'))
    
    if not current_user.check_password(current_password):
        flash('Current password is incorrect', 'error')
        return redirect(url_for('edit_profile'))
    
    if new_password != confirm_password:
        flash('New passwords do not match', 'error')
        return redirect(url_for('edit_profile'))
    
    try:
        current_user.set_password(new_password)
        db.session.commit()
        flash('Password changed successfully', 'success')
    except Exception as e:
        db.session.rollback()
        flash('Error changing password: ' + str(e), 'error')
    
    return redirect(url_for('edit_profile'))

@app.route('/admin/users/edit/<user_id>', methods=['GET', 'POST'])
@login_required
def edit_user(user_id):
    if not current_user.is_admin:
        flash('Access denied')
        return redirect(url_for('admin_dashboard'))
    
    user = User.query.get_or_404(user_id)
    
    if request.method == 'POST':
        # Update basic info
        user.firstname = request.form.get('firstname')
        user.lastname = request.form.get('lastname')
        user.othernames = request.form.get('othernames')
        
        # Update roles
        user.is_admin = bool(request.form.get('is_admin'))
        user.is_lecturer = bool(request.form.get('is_lecturer'))
        user.is_rep = bool(request.form.get('is_rep'))
        
        # Update class for class rep
        if user.is_rep:
            class_id = request.form.get('class_id')
            if not class_id:
                flash('Class selection is required for class representatives', 'error')
                return redirect(url_for('edit_user', user_id=user_id))
            user.class_id = class_id
        else:
            user.class_id = None
        
        # Update teaching classes for lecturer
        if user.is_lecturer:
            teaching_class_ids = request.form.getlist('teaching_classes')
            if not teaching_class_ids:
                flash('At least one teaching class must be selected for lecturers', 'error')
                return redirect(url_for('edit_user', user_id=user_id))
            
            # Clear existing teaching classes and add new ones
            user.teaching_classes = []
            teaching_classes = Class.query.filter(Class.id.in_(teaching_class_ids)).all()
            user.teaching_classes.extend(teaching_classes)
        else:
            user.teaching_classes = []
        
        try:
            db.session.commit()
            flash('User updated successfully')
            return redirect(url_for('list_users'))
        except Exception as e:
            db.session.rollback()
            flash('Error updating user: ' + str(e), 'error')
            return redirect(url_for('edit_user', user_id=user_id))
    
    classes = Class.query.all()
    return render_template('admin/users/edit.html', user=user, classes=classes)

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    
    # Get debug mode from environment, default to True for development
    debug_mode = os.getenv('FLASK_DEBUG', 'True').lower() in ('true', '1', 't')
    
    print("WARNING: For camera access on all devices, this app must be served over HTTPS in production.")
    print(f"Running in {'DEBUG' if debug_mode else 'PRODUCTION'} mode")
    
    app.run(host='0.0.0.0', port=5000, debug=debug_mode)
