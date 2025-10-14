# UUID Migration Guide

This guide explains the UUID migration for the TruMark attendance system.

## What Changed

All database primary keys have been converted from auto-incrementing integers to UUIDs (Universally Unique Identifiers):

### Before:
```python
class Student(db.Model):
    id = db.Column(db.Integer, primary_key=True)  # 1, 2, 3, 4...
```

### After:
```python
class Student(db.Model):
    id = db.Column(String(36), primary_key=True, default=generate_uuid)  
    # '550e8400-e29b-41d4-a716-446655440000'
```

## Why UUIDs?

✅ **Benefits:**
- **Globally Unique**: No ID collisions when merging data from different sources
- **Security**: Harder to guess/enumerate records (no sequential IDs)
- **Distributed Systems**: Can generate IDs client-side without database coordination
- **Scalability**: Better for distributed databases and microservices
- **No Race Conditions**: IDs can be generated before database insertion

❌ **Trade-offs:**
- Slightly larger storage (36 characters vs ~10 for integers)
- URLs are longer (but more secure)
- Not human-readable (but student_id field remains human-friendly)

## Migration Process

### Step 1: Backup Your Database

**CRITICAL**: Always backup before migration!

```powershell
# Windows
Copy-Item "instance\attendance.db" "instance\attendance.db.manual_backup"

# Linux/Mac
cp instance/attendance.db instance/attendance.db.manual_backup
```

### Step 2: Run the Migration Script

```bash
python migrate_to_uuid.py
```

The script will:
1. ✅ Create an automatic timestamped backup
2. ✅ Create new tables with UUID columns
3. ✅ Migrate all existing data with new UUIDs
4. ✅ Preserve all relationships (foreign keys)
5. ✅ Replace old tables with new tables
6. ✅ Rollback automatically if any errors occur

### Step 3: Verify the Migration

```python
# Test the application
python app.py
```

Visit these pages to verify everything works:
- `/admin/students` - Student list
- `/admin/sessions` - Session list
- `/admin/users` - User list
- `/admin/classrooms` - Classroom list

## What Was Updated

### Models (app.py)
All models now use UUID primary keys:
- ✅ `Student.id`
- ✅ `Session.id`
- ✅ `Attendance.id`
- ✅ `Program.id`
- ✅ `Course.id`
- ✅ `Class.id`
- ✅ `RegistrationToken.id`
- ✅ `Classroom.id`
- ✅ `User.id`

All foreign keys updated:
- ✅ `Student.class_id`
- ✅ `Session.classroom_id`, `class_id`, `lecturer_id`, `course_id`
- ✅ `Attendance.student_id`, `session_id`
- ✅ `Course.program_id`
- ✅ `Class.program_id`
- ✅ `RegistrationToken.class_id`, `created_by`
- ✅ `User.class_id`
- ✅ `lecturer_classes.user_id`, `class_id`

### Routes (app.py)
- ✅ All `.get()` queries now accept UUID strings
- ✅ Flask-Login's `load_user()` no longer casts to int
- ✅ URL parameters automatically converted to UUID strings
- ✅ Form submissions work with UUID strings

### Templates
No changes needed! Templates already use `.id` which now returns UUID strings.

## Troubleshooting

### Issue: Migration fails partway through

**Solution**: The script automatically restores from backup. Check the error message and fix any issues, then run again.

### Issue: "No such table" error after migration

**Solution**: The migration likely failed. Restore from backup:
```powershell
Copy-Item "instance\attendance.db.backup_TIMESTAMP" "instance\attendance.db" -Force
```

### Issue: Foreign key constraint errors

**Solution**: This suggests the migration didn't preserve relationships correctly. Restore from backup and report the issue.

### Issue: Login doesn't work after migration

**Solution**: Clear your browser cookies and try again. Flask-Login session cookies contain the old integer user IDs.

## Reverting the Migration

If you need to revert to integer IDs:

1. **Stop the application**
2. **Restore from backup**:
   ```powershell
   Copy-Item "instance\attendance.db.backup_TIMESTAMP" "instance\attendance.db" -Force
   ```
3. **Revert the code changes** (checkout from git before the UUID commit)
4. **Restart the application**

## Production Deployment

For production PostgreSQL databases:

1. **Backup the production database**:
   ```bash
   pg_dump -U username -d trumark > backup_before_uuid.sql
   ```

2. **Test the migration on a copy first**:
   ```bash
   createdb trumark_test
   psql -U username -d trumark_test < backup_before_uuid.sql
   # Run migration on test database
   ```

3. **Schedule maintenance window** (migration takes a few seconds for small DBs, longer for large ones)

4. **Run migration on production**

5. **Verify all functionality**

## Database Size Comparison

**Before** (Integer IDs):
- `id` column: 4-8 bytes per row
- Foreign keys: 4-8 bytes per reference

**After** (UUID Strings):
- `id` column: 36 bytes per row
- Foreign keys: 36 bytes per reference

**Example** (1000 students, 100 sessions, 5000 attendance records):
- Before: ~50 KB for IDs
- After: ~220 KB for IDs
- **Increase**: ~170 KB (negligible for modern systems)

## Code Examples

### Querying with UUIDs

```python
# Get a student by UUID
student = Student.query.get('550e8400-e29b-41d4-a716-446655440000')

# Filter by UUID
session = Session.query.filter_by(id='7c9e6679-7425-40de-944b-e07fc1f90ae7').first()

# Create with auto-generated UUID
new_student = Student(
    student_id='2024001',
    firstname='John',
    lastname='Doe',
    class_id=some_class_uuid  # Pass UUID string
)
db.session.add(new_student)
db.session.commit()
# new_student.id is now a UUID string!
```

### URL Routes

```python
# Route parameters automatically become UUID strings
@app.route('/student/<student_id>')
def student_detail(student_id):
    # student_id is a string like '550e8400-e29b-41d4-a716-446655440000'
    student = Student.query.get(student_id)
    return render_template('student.html', student=student)
```

### Templates

```html
<!-- No changes needed! -->
<a href="{{ url_for('edit_student', student_id=student.id) }}">
    Edit Student
</a>

<!-- ID is now a UUID string -->
<p>Student ID: {{ student.id }}</p>
<!-- Output: 550e8400-e29b-41d4-a716-446655440000 -->
```

## Maintenance

### After Migration

- Delete old backups after verifying everything works (keep at least one!)
- Update any documentation that references integer IDs
- Clear any cached data that might contain old IDs
- Log out and log back in to refresh sessions

### Future Considerations

- UUIDs are now the standard for all new records
- When integrating with external systems, UUIDs provide better compatibility
- Consider using UUID v7 in the future for time-ordered UUIDs (requires Python 3.11+)

## Support

If you encounter issues:
1. Check this guide's troubleshooting section
2. Verify your backup is intact
3. Check application logs for specific error messages
4. Restore from backup if needed and retry

## Summary

✅ **Completed:**
- All models converted to UUID primary keys
- All foreign keys updated
- Migration script created with automatic backup/rollback
- Flask-Login integration updated
- All routes tested

✅ **Verified:**
- Data integrity preserved
- Relationships maintained
- No breaking changes to templates
- Automatic UUID generation working

✅ **Ready for:**
- Production deployment
- Scaling to distributed systems
- External integrations
- Enhanced security
