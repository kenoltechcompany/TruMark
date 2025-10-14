# UUID Migration - Quick Start Guide

## Status: READY TO MIGRATE ✓

All systems are configured for UUID migration. Your database currently has:
- 2 students
- 3 sessions  
- 3 users
- 1 attendance record
- 2 courses
- 1 class
- 2 programs
- 1 classroom
- 1 registration token

**Total: 16 records will be migrated**

---

## Option 1: Automated Migration (Recommended)

Run this single command:

```powershell
uv run python run_uuid_migration.py
```

This will:
1. Run pre-migration checks
2. Create backups automatically
3. Migrate all data
4. Test the results
5. Show you next steps

---

## Option 2: Manual Step-by-Step

### Step 1: Create Manual Backup (Extra Safety)
```powershell
Copy-Item "instance\attendance.db" "instance\attendance.db.manual_backup"
```

### Step 2: Run Migration
```powershell
uv run python migrate_to_uuid.py
```

### Step 3: Test Application
```powershell
uv run python app.py
```

Then visit http://localhost:5000 and test:
- Login
- View students list
- View sessions list
- Create new student
- Mark attendance

---

## What the Migration Does

### Before (Integer IDs):
```
Student ID: 1
Session ID: 2
User ID: 3
```

### After (UUID Strings):
```
Student ID: 550e8400-e29b-41d4-a716-446655440000
Session ID: 7c9e6679-7425-40de-944b-e07fc1f90ae7
User ID: f47ac10b-58cc-4372-a567-0e02b2c3d479
```

**Note:** The `student_id` field (like "2024001") remains unchanged - only internal database IDs change.

---

## Safety Features

✓ Automatic timestamped backup before migration
✓ Manual backup option available
✓ Automatic rollback if errors occur
✓ All data and relationships preserved
✓ Transaction-based (all-or-nothing)

---

## After Migration

### Required Actions:
1. **Log out and log back in** - Old session cookies won't work
2. **Clear browser cache** (optional but recommended)

### Expected Changes:
- URLs will have long UUID strings instead of numbers
  - Before: `/admin/students/edit/5`
  - After: `/admin/students/edit/550e8400-e29b-41d4-a716-446655440000`
- Database size increases by ~2 KB (minimal)
- Everything else works exactly the same!

### Verify These Features:
- [ ] Login works
- [ ] Students list shows correctly
- [ ] Can create new student
- [ ] Sessions list shows correctly  
- [ ] Can create new session
- [ ] Attendance marking works
- [ ] Face recognition works
- [ ] Pagination works
- [ ] Search and filters work
- [ ] QR code generation works
- [ ] Registration tokens work

---

## Backups Created

After migration, you'll have:

1. **Automatic backup:** `instance/attendance.db.backup_YYYYMMDD_HHMMSS`
2. **Manual backup:** `instance/attendance.db.manual_backup` (if you created it)

Keep these until you verify everything works!

---

## Troubleshooting

### "Users can't log in after migration"
→ This is normal! Old session cookies contain integer user IDs.
→ Solution: Have all users log out and log back in.

### "Old bookmarked URLs don't work"
→ This is expected! Old integer IDs are no longer valid.
→ Solution: Navigate to the page normally and bookmark the new UUID URL.

### "Migration failed with an error"
→ The script automatically restores from backup.
→ Check the error message, fix the issue, and try again.

### "Need to rollback to integer IDs"
→ Stop the application
→ Restore from backup:
```powershell
Copy-Item "instance\attendance.db.manual_backup" "instance\attendance.db" -Force
```
→ Checkout the code before UUID commit
→ Restart the application

---

## When You're Ready

Run this command to start the migration:

```powershell
uv run python run_uuid_migration.py
```

The script will ask for confirmation before making any changes.

---

## Need Help?

- Full documentation: `UUID_MIGRATION.md`
- Technical details: `UUID_MIGRATION_SUMMARY.md`
- Check readiness: `uv run python check_uuid_ready.py`

---

**Ready? Let's migrate to UUIDs! 🚀**
