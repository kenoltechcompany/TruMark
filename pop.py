from app import Program, Course, Student, User, Class, lecturer_classes
from app import app, db
from datetime import datetime

def populate_db():
    # Check if admin user already exists
    if not User.query.filter_by(username='admin').first():
        # Create sample users
        # user1 = User('kelvin','kelvin',False,True,False,None)
        # user2 = User('kk','kelvin',False,False,True,1)
        user3 = User('admin','1111@QWERTY',True,False,False,None)

        # Create sample courses
        # course1 = Course(program_id=1,course_code='CS101', course_name='Introduction to Computer Science', credits=3)
        # course2 = Course(program_id=1,course_code='MATH101', course_name='Calculus I', credits=4)

        # Create sample programs
        # program1 = Program(program_name='Bachelor of Science in Computer Science')
        # program2 = Program(program_name='Bachelor of Science in Mathematics')

        # class1 = Class(program=program1, group="A", year_group="2024/2025")
        # # Add class1 to user1's teaching classes
        # user1.teaching_classes.append(class1)
        

        # Create sample students
        # student1 = Student(class_id=2,firstname="Kelvin",lastname="Lamptey",student_id="2425402472")
        # student2 = Student(class_id=2,firstname="Nii",lastname="Odartey",student_id="2425402473")

        # # Add properties
        # student1.face_encodeing = "sth"
        # student2.face_encoding = "sth2"

        # Add all instances to the session
        # db.session.add_all([user1, user2, user3, student1, student2, course1, course2, program1, program2])
        # Commit the session to save the data to the database
        db.session.add(user3)
        db.session.commit()
    else:
        print("User 'admin' already exists.")


def init_data():
    with app.app_context():
        
        # Add sample data into the tables
        populate_db()
        
        print("Sample data loaded into database!")

if __name__ == '__main__':
    init_data() 

