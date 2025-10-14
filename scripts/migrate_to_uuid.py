"""
Migration script to convert all integer IDs to UUIDs.

This script:
1. Backs up the current database
2. Creates new tables with UUID primary keys
3. Migrates all data with new UUIDs while preserving relationships
4. Replaces old tables with new tables

IMPORTANT: Make sure you have a backup before running this script!
"""

import sqlite3
import uuid
import json
import shutil
from datetime import datetime
import os

def generate_uuid():
    """Generate a new UUID4 as a string"""
    return str(uuid.uuid4())

def backup_database(db_path):
    """Create a backup of the database"""
    backup_path = f"{db_path}.backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    shutil.copy2(db_path, backup_path)
    print(f"[OK] Database backed up to: {backup_path}")
    return backup_path

def migrate_to_uuid(db_path='instance/attendance.db'):
    """Main migration function"""
    
    if not os.path.exists(db_path):
        print(f"[FAIL] Database not found at {db_path}")
        return False
    
    # Backup first
    backup_path = backup_database(db_path)
    
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        print("\n[*] Starting UUID migration...")
        
        # Dictionary to store old_id -> new_uuid mappings
        id_mappings = {
            'program': {},
            'class': {},
            'user': {},
            'classroom': {},
            'course': {},
            'student': {},
            'session': {},
            'attendance': {},
            'registration_token': {}
        }
        
        # Step 1: Create new tables with UUID primary keys
        print("\n[1]  Creating new tables with UUID columns...")
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS program_new (
                id TEXT PRIMARY KEY,
                program_name TEXT NOT NULL
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS class_new (
                id TEXT PRIMARY KEY,
                program_id TEXT NOT NULL,
                "group" TEXT NOT NULL,
                year_group TEXT NOT NULL,
                session TEXT NOT NULL,
                FOREIGN KEY (program_id) REFERENCES program_new (id)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_new (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                firstname TEXT,
                lastname TEXT,
                othernames TEXT,
                password TEXT NOT NULL,
                is_admin INTEGER DEFAULT 0,
                is_rep INTEGER DEFAULT 0,
                is_lecturer INTEGER DEFAULT 0,
                created_at TIMESTAMP,
                class_id TEXT,
                FOREIGN KEY (class_id) REFERENCES class_new (id)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS classroom_new (
                id TEXT PRIMARY KEY,
                name TEXT UNIQUE NOT NULL,
                coordinates TEXT NOT NULL,
                altitude REAL DEFAULT 0.0,
                altitude_tolerance REAL DEFAULT 3.0
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS course_new (
                id TEXT PRIMARY KEY,
                course_name TEXT NOT NULL,
                course_code TEXT UNIQUE NOT NULL,
                credits INTEGER NOT NULL,
                program_id TEXT NOT NULL,
                FOREIGN KEY (program_id) REFERENCES program_new (id)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS student_new (
                id TEXT PRIMARY KEY,
                student_id TEXT UNIQUE NOT NULL,
                firstname TEXT NOT NULL,
                lastname TEXT NOT NULL,
                othernames TEXT,
                face_encoding TEXT,
                face_images TEXT,
                created_at TIMESTAMP,
                class_id TEXT NOT NULL,
                FOREIGN KEY (class_id) REFERENCES class_new (id)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS session_new (
                id TEXT PRIMARY KEY,
                semester TEXT NOT NULL,
                week TEXT NOT NULL,
                date TIMESTAMP NOT NULL,
                classroom_id TEXT NOT NULL,
                class_id TEXT NOT NULL,
                lecturer_id TEXT NOT NULL,
                created_at TIMESTAMP,
                course_id TEXT NOT NULL,
                active INTEGER DEFAULT 1,
                expiration_type TEXT DEFAULT 'always_open',
                expiration_value TEXT,
                expires_at TIMESTAMP,
                FOREIGN KEY (classroom_id) REFERENCES classroom_new (id),
                FOREIGN KEY (class_id) REFERENCES class_new (id),
                FOREIGN KEY (lecturer_id) REFERENCES user_new (id),
                FOREIGN KEY (course_id) REFERENCES course_new (id)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS attendance_new (
                id TEXT PRIMARY KEY,
                student_id TEXT NOT NULL,
                session_id TEXT NOT NULL,
                timestamp TIMESTAMP,
                latitude REAL,
                longitude REAL,
                altitude REAL,
                FOREIGN KEY (student_id) REFERENCES student_new (id),
                FOREIGN KEY (session_id) REFERENCES session_new (id)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS registration_token_new (
                id TEXT PRIMARY KEY,
                token TEXT UNIQUE NOT NULL,
                class_id TEXT NOT NULL,
                created_by TEXT NOT NULL,
                is_active INTEGER DEFAULT 1,
                created_at TIMESTAMP,
                FOREIGN KEY (class_id) REFERENCES class_new (id),
                FOREIGN KEY (created_by) REFERENCES user_new (id)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS lecturer_classes_new (
                user_id TEXT NOT NULL,
                class_id TEXT NOT NULL,
                PRIMARY KEY (user_id, class_id),
                FOREIGN KEY (user_id) REFERENCES user_new (id),
                FOREIGN KEY (class_id) REFERENCES class_new (id)
            )
        ''')
        
        print("[OK] New tables created")
        
        # Step 2: Migrate data in dependency order
        print("\n[2]  Migrating data...")
        
        # Migrate Program (no dependencies)
        print("   [*] Migrating programs...")
        cursor.execute("SELECT * FROM program")
        for row in cursor.fetchall():
            new_id = generate_uuid()
            id_mappings['program'][row['id']] = new_id
            cursor.execute(
                "INSERT INTO program_new (id, program_name) VALUES (?, ?)",
                (new_id, row['program_name'])
            )
        print(f"   [OK] Migrated {len(id_mappings['program'])} programs")
        
        # Migrate Class (depends on Program)
        print("   [*] Migrating classes...")
        cursor.execute("SELECT * FROM class")
        for row in cursor.fetchall():
            new_id = generate_uuid()
            id_mappings['class'][row['id']] = new_id
            cursor.execute(
                "INSERT INTO class_new (id, program_id, \"group\", year_group, session) VALUES (?, ?, ?, ?, ?)",
                (new_id, id_mappings['program'][row['program_id']], row['group'], 
                 row['year_group'], row['session'])
            )
        print(f"   [OK] Migrated {len(id_mappings['class'])} classes")
        
        # Migrate User (depends on Class for class_id)
        print("   [*] Migrating users...")
        cursor.execute("SELECT * FROM user")
        for row in cursor.fetchall():
            new_id = generate_uuid()
            id_mappings['user'][row['id']] = new_id
            class_id = id_mappings['class'].get(row['class_id']) if row['class_id'] else None
            cursor.execute(
                """INSERT INTO user_new 
                   (id, username, firstname, lastname, othernames, password, is_admin, 
                    is_rep, is_lecturer, created_at, class_id) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (new_id, row['username'], row['firstname'], row['lastname'], row['othernames'],
                 row['password'], row['is_admin'], row['is_rep'], row['is_lecturer'],
                 row['created_at'], class_id)
            )
        print(f"   [OK] Migrated {len(id_mappings['user'])} users")
        
        # Migrate Classroom (no dependencies)
        print("   [*] Migrating classrooms...")
        cursor.execute("SELECT * FROM classroom")
        for row in cursor.fetchall():
            new_id = generate_uuid()
            id_mappings['classroom'][row['id']] = new_id
            cursor.execute(
                """INSERT INTO classroom_new 
                   (id, name, coordinates, altitude, altitude_tolerance) 
                   VALUES (?, ?, ?, ?, ?)""",
                (new_id, row['name'], row['coordinates'], row['altitude'], 
                 row['altitude_tolerance'])
            )
        print(f"   [OK] Migrated {len(id_mappings['classroom'])} classrooms")
        
        # Migrate Course (depends on Program)
        print("   [*] Migrating courses...")
        cursor.execute("SELECT * FROM course")
        for row in cursor.fetchall():
            new_id = generate_uuid()
            id_mappings['course'][row['id']] = new_id
            cursor.execute(
                """INSERT INTO course_new 
                   (id, course_name, course_code, credits, program_id) 
                   VALUES (?, ?, ?, ?, ?)""",
                (new_id, row['course_name'], row['course_code'], row['credits'],
                 id_mappings['program'][row['program_id']])
            )
        print(f"   [OK] Migrated {len(id_mappings['course'])} courses")
        
        # Migrate Student (depends on Class)
        print("   [*] Migrating students...")
        cursor.execute("SELECT * FROM student")
        for row in cursor.fetchall():
            new_id = generate_uuid()
            id_mappings['student'][row['id']] = new_id
            cursor.execute(
                """INSERT INTO student_new 
                   (id, student_id, firstname, lastname, othernames, face_encoding, 
                    face_images, created_at, class_id) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (new_id, row['student_id'], row['firstname'], row['lastname'], 
                 row['othernames'], row['face_encoding'], row['face_images'],
                 row['created_at'], id_mappings['class'][row['class_id']])
            )
        print(f"   [OK] Migrated {len(id_mappings['student'])} students")
        
        # Migrate Session (depends on Classroom, Class, User, Course)
        print("   [*] Migrating sessions...")
        cursor.execute("SELECT * FROM session")
        for row in cursor.fetchall():
            new_id = generate_uuid()
            id_mappings['session'][row['id']] = new_id
            cursor.execute(
                """INSERT INTO session_new 
                   (id, semester, week, date, classroom_id, class_id, lecturer_id, 
                    created_at, course_id, active, expiration_type, expiration_value, expires_at) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (new_id, row['semester'], row['week'], row['date'],
                 id_mappings['classroom'][row['classroom_id']],
                 id_mappings['class'][row['class_id']],
                 id_mappings['user'][row['lecturer_id']],
                 row['created_at'],
                 id_mappings['course'][row['course_id']],
                 row['active'], row['expiration_type'], row['expiration_value'],
                 row['expires_at'])
            )
        print(f"   [OK] Migrated {len(id_mappings['session'])} sessions")
        
        # Migrate Attendance (depends on Student, Session)
        print("   [OK] Migrating attendance records...")
        cursor.execute("SELECT * FROM attendance")
        for row in cursor.fetchall():
            new_id = generate_uuid()
            id_mappings['attendance'][row['id']] = new_id
            cursor.execute(
                """INSERT INTO attendance_new 
                   (id, student_id, session_id, timestamp, latitude, longitude, altitude) 
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (new_id, id_mappings['student'][row['student_id']],
                 id_mappings['session'][row['session_id']],
                 row['timestamp'], row['latitude'], row['longitude'], row['altitude'])
            )
        print(f"   [OK] Migrated {len(id_mappings['attendance'])} attendance records")
        
        # Migrate RegistrationToken (depends on Class, User)
        print("   [*] Migrating registration tokens...")
        cursor.execute("SELECT * FROM registration_token")
        for row in cursor.fetchall():
            new_id = generate_uuid()
            id_mappings['registration_token'][row['id']] = new_id
            cursor.execute(
                """INSERT INTO registration_token_new 
                   (id, token, class_id, created_by, is_active, created_at) 
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (new_id, row['token'], id_mappings['class'][row['class_id']],
                 id_mappings['user'][row['created_by']], row['is_active'], row['created_at'])
            )
        print(f"   [OK] Migrated {len(id_mappings['registration_token'])} registration tokens")
        
        # Migrate lecturer_classes association table
        print("   [*] Migrating lecturer-class associations...")
        cursor.execute("SELECT * FROM lecturer_classes")
        count = 0
        for row in cursor.fetchall():
            cursor.execute(
                "INSERT INTO lecturer_classes_new (user_id, class_id) VALUES (?, ?)",
                (id_mappings['user'][row['user_id']], id_mappings['class'][row['class_id']])
            )
            count += 1
        print(f"   [OK] Migrated {count} lecturer-class associations")
        
        # Step 3: Replace old tables with new tables
        print("\n[3]  Replacing old tables with new tables...")
        
        tables = ['program', 'class', 'user', 'classroom', 'course', 'student', 
                  'session', 'attendance', 'registration_token', 'lecturer_classes']
        
        for table in tables:
            cursor.execute(f"DROP TABLE IF EXISTS {table}")
            cursor.execute(f"ALTER TABLE {table}_new RENAME TO {table}")
        
        print("[OK] Tables replaced")
        
        # Commit all changes
        conn.commit()
        
        print("\n[OK] [OK] [OK] Migration completed successfully!")
        print(f"\n[*] Migration Summary:")
        for table, mappings in id_mappings.items():
            print(f"   {table}: {len(mappings)} records")
        
        print(f"\n[*] Backup saved at: {backup_path}")
        print("   You can delete this backup after verifying everything works correctly.")
        
        return True
        
    except Exception as e:
        print(f"\n[FAIL] Migration failed: {str(e)}")
        print(f"   Restoring from backup: {backup_path}")
        
        # Restore from backup
        conn.close()
        shutil.copy2(backup_path, db_path)
        print("   [OK] Database restored from backup")
        
        return False
    
    finally:
        conn.close()

if __name__ == '__main__':
    print("="*60)
    print("[*] UUID Migration Script")
    print("="*60)
    print("\nThis script will convert all integer IDs to UUIDs.")
    print("A backup will be created automatically.")
    print("\n[WARN]  WARNING: This is a one-way migration!")
    print("   Make sure you have a separate backup before proceeding.")
    
    response = input("\nDo you want to continue? (yes/no): ")
    
    if response.lower() in ['yes', 'y']:
        success = migrate_to_uuid()
        if success:
            print("\n[SUCCESS] Migration successful! You can now run your application with UUIDs.")
        else:
            print("\n[FAIL] Migration failed. Please check the errors above.")
    else:
        print("\n[FAIL] Migration cancelled.")

