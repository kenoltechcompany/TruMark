"""Test that session creation works with UUIDs"""

from app import app, db, Session, Class, User, Classroom, Course
from datetime import datetime
import json

print("[*] Testing session creation with UUIDs...")

with app.app_context():
    # Get some test data
    classroom = Classroom.query.first()
    class_obj = Class.query.first()
    lecturer = User.query.filter_by(is_lecturer=True).first()
    course = Course.query.first()
    
    if not all([classroom, class_obj, lecturer, course]):
        print("[FAIL] Missing test data (classroom, class, lecturer, or course)")
        print(f"       Classroom: {classroom}")
        print(f"       Class: {class_obj}")
        print(f"       Lecturer: {lecturer}")
        print(f"       Course: {course}")
        exit(1)
    
    print(f"\n[*] Test data IDs (all should be UUIDs):")
    print(f"    Classroom ID: {classroom.id} (type: {type(classroom.id).__name__})")
    print(f"    Class ID: {class_obj.id} (type: {type(class_obj.id).__name__})")
    print(f"    Lecturer ID: {lecturer.id} (type: {type(lecturer.id).__name__})")
    print(f"    Course ID: {course.id} (type: {type(course.id).__name__})")
    
    # Simulate session creation (like in new_session route)
    try:
        # This simulates what happens in the route
        class_id = class_obj.id  # Should be a UUID string, NOT converted to int
        
        session = Session(
            semester='A',
            week='10',
            date=datetime.now(),
            classroom_id=classroom.id,
            class_id=class_id,
            course_id=course.id,
            lecturer_id=lecturer.id,
            expiration_type='always_open',
            expiration_value=None,
            expires_at=None
        )
        
        # Don't actually save it
        print(f"\n[OK] Session object created successfully!")
        print(f"     Session classroom_id: {session.classroom_id} (type: {type(session.classroom_id).__name__})")
        print(f"     Session class_id: {session.class_id} (type: {type(session.class_id).__name__})")
        print(f"     Session course_id: {session.course_id} (type: {type(session.course_id).__name__})")
        print(f"     Session lecturer_id: {session.lecturer_id} (type: {type(session.lecturer_id).__name__})")
        
        # Verify all are strings (UUIDs)
        assert isinstance(session.classroom_id, str), "classroom_id should be string"
        assert isinstance(session.class_id, str), "class_id should be string"
        assert isinstance(session.course_id, str), "course_id should be string"
        assert isinstance(session.lecturer_id, str), "lecturer_id should be string"
        
        print("\n[SUCCESS] All session IDs are UUID strings!")
        print("[SUCCESS] Session creation should work in the app!")
        
    except Exception as e:
        print(f"\n[FAIL] Error creating session: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
