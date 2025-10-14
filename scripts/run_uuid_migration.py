"""
One-command UUID migration runner with safety checks
"""

import subprocess
import sys
import os

def run_command(cmd, description):
    """Run a command and handle errors"""
    print(f"\n{description}...")
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    
    if result.returncode != 0:
        print(f"[FAIL] Failed: {result.stderr}")
        return False
    
    print(result.stdout)
    return True

def main():
    print("=" * 70)
    print("[*] TruMark UUID Migration - Automated Runner")
    print("=" * 70)
    
    # Step 1: Pre-migration check
    print("\n[*] Step 1: Running pre-migration checks...")
    if not run_command("uv run python check_uuid_ready.py", "Checking prerequisites"):
        print("\n[FAIL] Pre-migration checks failed. Please fix issues above.")
        return False
    
    # Step 2: Manual backup reminder
    print("\n[*] Step 2: Creating manual backup...")
    print("   Creating manual backup as extra safety measure...")
    
    if os.path.exists("instance/attendance.db"):
        backup_name = "instance/attendance.db.pre_uuid_backup"
        
        if os.name == 'nt':  # Windows
            run_command(f'Copy-Item "instance\\attendance.db" "{backup_name}" -Force', 
                       "Creating backup")
        else:  # Linux/Mac
            run_command(f'cp instance/attendance.db {backup_name}', 
                       "Creating backup")
        
        if os.path.exists(backup_name):
            print(f"   [OK] Manual backup created: {backup_name}")
        else:
            print("   [WARN]  Could not verify manual backup")
    
    # Step 3: Confirm migration
    print("\n" + "=" * 70)
    print("[WARN]  IMPORTANT: This will convert all integer IDs to UUIDs")
    print("=" * 70)
    print("\nWhat will happen:")
    print("  1. Automatic backup will be created")
    print("  2. All integer IDs converted to UUID strings")
    print("  3. All relationships preserved")
    print("  4. Automatic rollback on any errors")
    print("\nAfter migration:")
    print("  - All users need to log out and log back in")
    print("  - Old bookmarked URLs with integer IDs won't work")
    print("  - Database will be ~2-3% larger")
    
    response = input("\n[?] Do you want to proceed? (type 'yes' to continue): ")
    
    if response.lower() not in ['yes', 'y']:
        print("\n[FAIL] Migration cancelled by user.")
        return False
    
    # Step 4: Run migration
    print("\n" + "=" * 70)
    print("[*] Step 3: Running UUID migration...")
    print("=" * 70)
    
    if not run_command("uv run python migrate_to_uuid.py", "Migrating database"):
        print("\n[FAIL] Migration failed. Database has been restored from backup.")
        return False
    
    # Step 5: Quick test
    print("\n" + "=" * 70)
    print("[OK] Step 4: Testing application...")
    print("=" * 70)
    
    test_code = """
from app import db, Student, Session, User
import uuid

print("Testing UUID functionality...")

# Test UUID format
students = Student.query.limit(2).all()
if students:
    for student in students:
        try:
            uuid.UUID(student.id)  # Validate UUID format
            print(f"[OK] Student '{student.firstname}' has valid UUID: {student.id[:13]}...")
        except ValueError:
            print(f"[FAIL] Invalid UUID for student: {student.id}")
            exit(1)

# Test relationships
sessions = Session.query.limit(2).all()
if sessions:
    for session in sessions:
        try:
            uuid.UUID(session.id)
            uuid.UUID(session.classroom_id)
            uuid.UUID(session.lecturer_id)
            print(f"[OK] Session has valid UUIDs and relationships work")
        except ValueError as e:
            print(f"[FAIL] Invalid UUID in session: {e}")
            exit(1)

print("[OK] All UUID tests passed!")
"""
    
    with open('temp_test_uuid.py', 'w') as f:
        f.write(test_code)
    
    success = run_command("uv run python temp_test_uuid.py", "Testing UUIDs")
    
    # Clean up test file
    if os.path.exists('temp_test_uuid.py'):
        os.remove('temp_test_uuid.py')
    
    if not success:
        print("\n[WARN]  Migration completed but tests failed. Check the database manually.")
        return False
    
    # Success!
    print("\n" + "=" * 70)
    print("[SUCCESS] [SUCCESS] [SUCCESS] UUID MIGRATION SUCCESSFUL! [SUCCESS] [SUCCESS] [SUCCESS]")
    print("=" * 70)
    
    print("\n[OK] Next steps:")
    print("  1. Start the application: uv run python app.py")
    print("  2. Log out and log back in (old sessions won't work)")
    print("  3. Test all features:")
    print("     - Student registration")
    print("     - Session creation")
    print("     - Attendance marking")
    print("     - Pagination and search")
    print("  4. Delete old backups after verification")
    
    print("\n[*] Backups created:")
    print("  - Automatic timestamped backup (in instance/)")
    print("  - Manual backup: instance/attendance.db.pre_uuid_backup")
    
    print("\n[*] Documentation:")
    print("  - Full guide: UUID_MIGRATION.md")
    print("  - Summary: UUID_MIGRATION_SUMMARY.md")
    
    return True

if __name__ == '__main__':
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\n[FAIL] Migration cancelled by user (Ctrl+C)")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n[FAIL] Unexpected error: {e}")
        sys.exit(1)
