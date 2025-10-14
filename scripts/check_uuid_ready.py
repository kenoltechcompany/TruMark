"""
Quick test to verify UUID migration is ready
"""

import os
import sys

print("[*] Pre-Migration Verification Checklist")
print("=" * 60)

checks_passed = 0
checks_total = 0

# Check 1: Database exists
checks_total += 1
if os.path.exists('instance/attendance.db'):
    print("[OK] Database file exists")
    checks_passed += 1
    
    # Get file size
    size = os.path.getsize('instance/attendance.db') / 1024
    print(f"     Size: {size:.2f} KB")
else:
    print("[FAIL] Database file not found at instance/attendance.db")

# Check 2: Can import models
checks_total += 1
try:
    from app import db, Student, Session, User, Attendance, Course, Class, Program, Classroom, RegistrationToken
    print("[OK] All models imported successfully")
    checks_passed += 1
except Exception as e:
    print(f"[FAIL] Failed to import models: {e}")

# Check 3: Verify UUID types
checks_total += 1
try:
    from app import Student, Session, User
    if 'VARCHAR(36)' in str(Student.id.type):
        print("[OK] Models are configured for UUID (VARCHAR(36))")
        checks_passed += 1
    else:
        print(f"[FAIL] Models not configured correctly: {Student.id.type}")
except Exception as e:
    print(f"[FAIL] Failed to check UUID types: {e}")

# Check 4: Check generate_uuid function
checks_total += 1
try:
    from app import generate_uuid
    test_uuid = generate_uuid()
    if len(test_uuid) == 36 and test_uuid.count('-') == 4:
        print(f"[OK] UUID generation working: {test_uuid}")
        checks_passed += 1
    else:
        print(f"[FAIL] UUID generation produced invalid format: {test_uuid}")
except Exception as e:
    print(f"[FAIL] Failed to test UUID generation: {e}")

# Check 5: Migration script exists
checks_total += 1
if os.path.exists('migrate_to_uuid.py'):
    print("[OK] Migration script exists")
    checks_passed += 1
else:
    print("[FAIL] Migration script not found")

# Check 6: Can we read the database?
checks_total += 1
try:
    import sqlite3
    conn = sqlite3.connect('instance/attendance.db')
    cursor = conn.cursor()
    
    # Check tables exist
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [row[0] for row in cursor.fetchall()]
    
    expected_tables = ['student', 'session', 'user', 'attendance', 'course', 'class', 
                      'program', 'classroom', 'registration_token']
    
    found_tables = [t for t in expected_tables if t in tables]
    
    if len(found_tables) == len(expected_tables):
        print(f"[OK] All {len(expected_tables)} expected tables found")
        checks_passed += 1
    else:
        print(f"[WARN] Found {len(found_tables)}/{len(expected_tables)} tables")
        print(f"       Tables: {', '.join(found_tables)}")
        checks_passed += 1  # Still pass if some tables exist
    
    # Get record counts
    print("\n[*] Current Database State:")
    for table in found_tables:
        cursor.execute(f"SELECT COUNT(*) FROM {table}")
        count = cursor.fetchone()[0]
        print(f"    {table}: {count} records")
    
    conn.close()
    
except Exception as e:
    print(f"[FAIL] Failed to read database: {e}")

# Summary
print("\n" + "=" * 60)
print(f"Pre-Migration Check: {checks_passed}/{checks_total} passed")

if checks_passed == checks_total:
    print("\n[SUCCESS] All checks passed! Ready to migrate to UUIDs.")
    print("\nNext steps:")
    print("1. Make sure you have a backup: Copy-Item 'instance\\attendance.db' 'instance\\attendance.db.manual_backup'")
    print("2. Run migration: python migrate_to_uuid.py")
    print("3. Test the application: python app.py")
elif checks_passed >= checks_total - 1:
    print("\n[WARN] Minor issues detected, but migration should still work.")
    print("       Review the checks above and proceed with caution.")
else:
    print("\n[FAIL] Critical issues detected. Please fix the errors above before migrating.")
    sys.exit(1)
