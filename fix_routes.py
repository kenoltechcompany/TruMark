"""Fix route parameters to accept UUID strings instead of integers"""

with open('app.py', 'r', encoding='utf-8') as f:
    content = f.read()

replacements = [
    ('<int:session_id>', '<session_id>'),
    ('<int:student_id>', '<student_id>'),
    ('<int:classroom_id>', '<classroom_id>'),
    ('<int:program_id>', '<program_id>'),
    ('<int:course_id>', '<course_id>'),
    ('<int:class_id>', '<class_id>'),
    ('<int:user_id>', '<user_id>'),
]

for old, new in replacements:
    count = content.count(old)
    content = content.replace(old, new)
    if count > 0:
        print(f"Replaced {count} occurrences of '{old}' with '{new}'")

with open('app.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("\n[OK] All route parameters updated to accept UUID strings!")
