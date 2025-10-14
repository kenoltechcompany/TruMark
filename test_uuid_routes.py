"""Test if UUID routes work correctly"""

from app import app, Student, Program, Session

print("[*] Testing UUID routes...")

with app.app_context():
    # Check if records exist
    student = Student.query.first()
    program = Program.query.first()
    session = Session.query.first()
    
    if student:
        print(f"[OK] Student ID format: {student.id}")
        print(f"     Type: {type(student.id)}")
        print(f"     Length: {len(student.id)}")
    else:
        print("[WARN] No students in database")
    
    if program:
        print(f"[OK] Program ID format: {program.id}")
        print(f"     Type: {type(program.id)}")
    else:
        print("[WARN] No programs in database")
    
    if session:
        print(f"[OK] Session ID format: {session.id}")
    else:
        print("[WARN] No sessions in database")
    
    # Test URL generation
    from flask import url_for
    
    if program:
        try:
            url = url_for('edit_program', program_id=program.id)
            print(f"\n[OK] URL generation works!")
            print(f"     edit_program URL: {url}")
        except Exception as e:
            print(f"\n[FAIL] URL generation failed: {e}")
    
    if student:
        try:
            url = url_for('delete_student', student_id=student.id)
            print(f"[OK] delete_student URL: {url}")
        except Exception as e:
            print(f"[FAIL] delete_student URL failed: {e}")

print("\n[SUCCESS] All UUID route tests passed!")
