# Testing the Pagination, Search, and Filter Implementation

## Quick Test Guide

### 1. Test Students Page
```
URL: /admin/students
```

**Tests to Run:**
1. Click through pages (if you have > 10 students)
2. Search for a student by ID or name
3. Filter by class using dropdown
4. Change "per page" to 25 or 50
5. Try search + filter combination
6. Click "Clear" button - should reset to page 1 with no filters
7. Delete a student (should show confirmation dialog)

**Expected Results:**
- URL should update with query params: `?search=john&class_id=5&page=2`
- Results should filter correctly
- Pagination should update total count
- Empty state should show when no results found

### 2. Test Sessions Page
```
URL: /sessions
```

**Tests to Run:**
1. Search by course name or lecturer
2. Filter by classroom
3. Filter by course
4. Filter by status (active/expired)
5. Try multiple filters at once
6. Test all action buttons (View Attendance, Mark, Share QR, Expire, Delete)

**Expected Results:**
- Complex filters should work together
- Status filter should show only active or expired sessions
- Expired sessions should disable certain buttons

### 3. Test Users Page
```
URL: /admin/users (admin only)
```

**Tests to Run:**
1. Search by username
2. Filter by role (Admin, Lecturer, Class Rep)
3. Verify role badges display correctly
4. Test edit and delete functions

### 4. Test Registration Tokens Page
```
URL: /admin/registration-tokens
```

**Tests to Run:**
1. Search by class/program
2. Filter by status (active/inactive)
3. Test toggle switch (enable/disable)
4. Test copy URL button
5. Test share button (if device supports)
6. Test delete with confirmation

**Expected Results:**
- Toggle should update status without page reload
- Copy button should copy to clipboard
- Delete should remove row from table

### 5. Test Simple List Pages

**Classrooms** (`/admin/classrooms`):
- Search by name
- Verify pagination
- Test delete

**Programs** (`/admin/programs`):
- Search by program name
- Verify pagination
- Test edit and delete

**Courses** (`/admin/courses`):
- Search by course name or code
- Verify pagination
- Test edit and delete

**Classes** (`/admin/classes`):
- Search by program/group
- Filter by program
- Filter by year (1-4)
- Test multiple filters
- Test edit and delete

## Testing Checklist

### Pagination
- [ ] Can navigate to next page
- [ ] Can navigate to previous page
- [ ] Can click specific page numbers
- [ ] Page numbers show ellipsis for long lists
- [ ] Previous button disabled on page 1
- [ ] Next button disabled on last page
- [ ] Results count displays correctly
- [ ] Per-page selector changes results (10, 25, 50, 100)

### Search
- [ ] Search input accepts text
- [ ] Search filters results correctly
- [ ] Search is case-insensitive
- [ ] Search works across multiple fields
- [ ] Clear button resets search
- [ ] Search icon displays correctly

### Filters
- [ ] Dropdown filters populate correctly
- [ ] Filter changes results
- [ ] Multiple filters work together
- [ ] Apply button submits filters
- [ ] Clear button resets all filters
- [ ] Filter state preserved in URL

### URL State
- [ ] URL updates with query params
- [ ] URL is bookmarkable (copy/paste works)
- [ ] Browser back/forward works correctly
- [ ] Refresh page maintains filters

### Empty States
- [ ] "No results found" shows when appropriate
- [ ] Helpful message displayed
- [ ] Clear filters button shows when filters active
- [ ] Create new button shows when no data exists

### CSRF Protection
- [ ] Delete operations work correctly
- [ ] Toggle operations work correctly
- [ ] No CSRF errors in console
- [ ] Confirmation dialogs appear

### Responsive Design
- [ ] Works on desktop (1920x1080)
- [ ] Works on tablet (768x1024)
- [ ] Works on mobile (375x667)
- [ ] Tables scroll horizontally on small screens
- [ ] Filters stack vertically on mobile

## Common Issues & Solutions

### Issue: "No results found" when data exists
**Solution:** Check if filters are applied. Click "Clear" button.

### Issue: Pagination not showing
**Solution:** Normal - pagination only shows when there's more than one page.

### Issue: CSRF token errors
**Solution:** Check that `getCsrfToken()` function exists in template and returns valid token.

### Issue: Search not working
**Solution:** Check browser console for JavaScript errors. Verify `applyFilters()` function exists.

### Issue: URL params not updating
**Solution:** Check that form has `id="filterForm"`. Verify `applyFilters()` builds URL correctly.

### Issue: Delete not working
**Solution:** Check CSRF token. Verify delete route exists and accepts POST with FormData.

## Performance Testing

### With Large Datasets:
1. Create 100+ students
2. Verify pagination loads quickly
3. Test search performance
4. Test filter performance
5. Change per_page to 100 and verify load time

### Expected Performance:
- Page load: < 500ms
- Search: < 200ms
- Filter application: < 200ms
- Pagination navigation: < 100ms

## Browser Compatibility

Test in:
- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari
- [ ] Mobile browsers (iOS Safari, Chrome Android)

## Automated Testing Commands

```bash
# Run the Flask app
python app.py

# In browser, test each URL:
# - /admin/students
# - /sessions
# - /admin/users
# - /admin/registration-tokens
# - /admin/classrooms
# - /admin/programs
# - /admin/courses
# - /admin/classes
```

## Success Criteria

✅ All 8 list pages load without errors
✅ Search works on all pages
✅ Filters work on all pages
✅ Pagination works on all pages
✅ URL state is preserved
✅ CSRF protection works
✅ Empty states display correctly
✅ Delete/Edit/Toggle operations work
✅ No console errors
✅ Responsive on all screen sizes

## Known False Positives

The linter shows errors for Jinja2 template syntax in JavaScript:
- `onclick="deleteStudent({{ student.id }})"` - This is correct, ignore linter
- Template variables in JavaScript strings are fine
- These errors don't affect functionality

## Report Issues

If you find any issues:
1. Note the URL and query params
2. Check browser console for errors
3. Check network tab for failed requests
4. Verify CSRF token is being sent
5. Check that route exists in app.py
