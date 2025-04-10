from app import Program, Course, Student, Lecturer, User
from app import db

def populate_db():
    # Create sample users
    user1 = User(username='kelvin')
    user1.set_password('kelvin')
    user1.is_admin = False
    user3 = User(username='admin')
    user3.set_password('admin')
    user3.is_admin = True

    # Create sample courses
    course1 = Course(course_code='CS101', course_name='Introduction to Computer Science', credits=3)
    course2 = Course(course_code='MATH101', course_name='Calculus I', credits=4)

    # Create sample programs
    program1 = Program(program_name='Bachelor of Science in Computer Science', duration_years=4)
    program2 = Program(program_name='Bachelor of Science in Mathematics', duration_years=4)

    # Add relationships
    student1.courses.append(course1)
    student2.courses.append(course2)
    lecturer1.courses.append(course1)

    # Add all instances to the session
    db.session.add_all([user1, user2, user3, student1, student2, lecturer1, course1, course2, program1, program2])

    # Commit the session to save the data to the database
    db.session.commit()
