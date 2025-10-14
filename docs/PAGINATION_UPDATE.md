# Pagination, Search, and Filtering System

## Summary
Added comprehensive pagination, search bars, and filters to all major data tables in the TruMark application.

## Backend Updates (app.py)

### Updated Routes with Pagination:
1. **list_students** - Paginated student list with search (ID, name) and class filter
2. **list_sessions** - Paginated sessions with search (course, lecturer), classroom/course/status filters  
3. **list_users** - Paginated users with search (username) and role filter
4. **list_classrooms** - Paginated classrooms with search (name)
5. **list_programs** - Paginated programs with search (program name)
6. **list_courses** - Paginated courses with search (course name, code)
7. **list_classes** - Paginated classes with search and program/year filters
8. **list_registration_tokens** - Paginated tokens with search and status filter

### Query Parameters (all routes):
- `page` (default: 1)
- `per_page` (default: 10, options: 10, 25, 50, 100)
- `search` - Text search across relevant fields
- Route-specific filters (e.g., class_id, status, role)

## Frontend Components

### New Macro Files:
1. **templates/macros/pagination.html** - Reusable pagination component
   - Shows results count
   - Previous/Next buttons
   - Page numbers with ellipsis
   - Per-page selector

2. **templates/macros/filters.html** - Reusable filter components
   - `render_search_bar()` - Search input with icon
   - `render_filter_dropdown()` - Generic dropdown filter
   - `render_status_filter()` - Status-specific filter
   - JavaScript helpers for applying/clearing filters

### Updated Templates:
1. **students/list.html** - Search + Class filter + Pagination
2. **sessions/list.html** - Search + Classroom/Course/Status filters + Pagination
3. **users/list.html** - Search + Role filter + Pagination
4. **registration_tokens/list.html** - Search + Status filter + Pagination

### Templates to Update (simple search + pagination):
5. **classrooms/list.html** - Add search by name + pagination
6. **programs/list.html** - Add search by program name + pagination
7. **courses/list.html** - Add search by name/code + pagination
8. **classes/list.html** - Add search + program/year filters + pagination

## Features
- **Search**: Live search across relevant fields (names, IDs, codes)
- **Filters**: Dropdown filters for categories (class, role, status, etc.)
- **Pagination**: Navigate through pages with configurable items per page
- **URL State**: Filters and pagination preserved in URL for bookmarking/sharing
- **Empty States**: Helpful messages when no results found
- **CSRF Protection**: All delete/update operations use CSRF tokens

## Usage
All list pages now support:
```
/admin/students?search=john&class_id=5&page=2&per_page=25
```

Filter combinations persist across page navigation.
