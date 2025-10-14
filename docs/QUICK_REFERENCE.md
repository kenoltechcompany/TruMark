# Quick Reference - Pagination & Filters

## URL Query Parameters

All list pages now support these query parameters:

| Parameter | Type | Default | Options | Description |
|-----------|------|---------|---------|-------------|
| `page` | int | 1 | 1+ | Current page number |
| `per_page` | int | 10 | 10, 25, 50, 100 | Items per page |
| `search` | string | "" | any text | Search query |
| *filters* | various | "" | varies | Page-specific filters |

## Examples

### Students Page
```
/admin/students?search=john&class_id=5&page=2&per_page=25
```

### Sessions Page
```
/sessions?search=math&classroom_id=2&course_id=3&status=active&page=1
```

### Users Page
```
/admin/users?search=admin&role=lecturer&per_page=50
```

### Registration Tokens Page
```
/admin/registration-tokens?search=computer&status=active
```

### Classes Page
```
/admin/classes?search=IT&program_id=2&year_group=3
```

## Page-Specific Filters

| Page | Search Fields | Filters Available |
|------|--------------|-------------------|
| Students | ID, firstname, lastname, othernames | `class_id` |
| Sessions | Course name, lecturer | `classroom_id`, `course_id`, `status` |
| Users | Username | `role` (admin/lecturer/rep) |
| Tokens | Program, class group | `status` (active/inactive) |
| Classrooms | Name | - |
| Programs | Program name | - |
| Courses | Course name, code | - |
| Classes | Program, group, session | `program_id`, `year_group` |

## JavaScript Functions

All list pages include these functions:

```javascript
applyFilters()     // Submits search and filters
clearFilters()     // Resets to default view
getCsrfToken()     // Returns CSRF token for mutations
delete*()          // Deletes item with confirmation
```

## Macros Usage

### In Templates

```jinja
{% from 'macros/pagination.html' import render_pagination %}
{% from 'macros/filters.html' import render_search_bar %}

<!-- Render search bar -->
{{ render_search_bar(search, 'Search placeholder text...') }}

<!-- Render pagination -->
{{ render_pagination(pagination, 'route_name', 
                   search=search, 
                   filter1=filter1_value,
                   per_page=per_page) }}
```

### In Routes

```python
@app.route('/admin/items')
def list_items():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    search = request.args.get('search', '', type=str)
    
    query = Item.query
    
    if search:
        query = query.filter(Item.name.ilike(f"%{search}%"))
    
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    
    return render_template('list.html', 
                         items=pagination.items,
                         pagination=pagination,
                         search=search,
                         per_page=per_page)
```

## CSRF Protection Pattern

```javascript
function getCsrfToken() {
    return "{{ csrf_token() }}";
}

function deleteItem(id) {
    if (confirm('Are you sure?')) {
        const formData = new FormData();
        formData.append('csrf_token', getCsrfToken());
        
        fetch(`/admin/items/delete/${id}`, {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                location.reload();
            } else {
                alert('Error: ' + data.error);
            }
        });
    }
}
```

## Pagination Object Properties

```python
pagination.items       # List[Model] - Current page items
pagination.page        # int - Current page number
pagination.pages       # int - Total pages
pagination.total       # int - Total items
pagination.has_prev    # bool - Has previous page?
pagination.has_next    # bool - Has next page?
pagination.prev_num    # int - Previous page number
pagination.next_num    # int - Next page number
pagination.per_page    # int - Items per page
pagination.iter_pages()  # Iterator for page numbers
```

## Common Patterns

### Empty State Check
```jinja
{% if items %}
    <!-- Show table -->
{% else %}
    <p>No items found. Try adjusting your filters.</p>
{% endif %}
```

### Conditional Pagination
```jinja
{% if pagination.pages > 1 %}
    {{ render_pagination(...) }}
{% endif %}
```

### Filter Form
```html
<form id="filterForm">
    <input type="text" name="search" value="{{ search }}">
    <select name="category_id">
        <option value="">All</option>
        {% for cat in categories %}
            <option value="{{ cat.id }}" {% if category_filter == cat.id|string %}selected{% endif %}>
                {{ cat.name }}
            </option>
        {% endfor %}
    </select>
    <button type="button" onclick="applyFilters()">Apply</button>
    <button type="button" onclick="clearFilters()">Clear</button>
</form>
```

## Performance Tips

1. **Index frequently searched columns:**
   ```python
   __table_args__ = (Index('idx_student_id', 'student_id'),)
   ```

2. **Limit eager loading:**
   ```python
   query = Student.query.options(joinedload(Student.current_class))
   ```

3. **Use appropriate per_page:**
   - Default: 10 for quick loading
   - Large datasets: 25-50
   - Exports: 100

4. **Optimize search:**
   ```python
   # Use indexed columns first
   query = query.filter(Student.student_id.ilike(f"%{search}%"))
   ```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| No pagination showing | Normal if only 1 page exists |
| Search returns nothing | Check spelling, try partial match |
| Filters not applying | Click "Apply" button |
| URL not updating | Check `applyFilters()` function |
| CSRF errors | Verify `getCsrfToken()` exists |
| Page loads slowly | Reduce `per_page` or optimize query |
