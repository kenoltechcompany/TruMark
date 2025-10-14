"""Check for any remaining int() conversions that might affect UUIDs"""

import re

with open('app.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

print("[*] Scanning for potential UUID int() conversion issues...")
print("=" * 70)

issues_found = False
safe_patterns = [
    r'int\(.*\.get\(.*amount',  # Duration amounts
    r'int\(.*total_seconds',     # Time calculations
    r'int\(.*\.split',           # String splitting for time
    r"int\(request\.args\.get\('page'",  # Pagination
    r"int\(request\.args\.get\('per_page'",  # Pagination
]

for i, line in enumerate(lines, 1):
    if 'int(' in line:
        # Check if it's a safe pattern
        is_safe = any(re.search(pattern, line) for pattern in safe_patterns)
        
        if not is_safe:
            # Check for potential ID conversions
            if any(keyword in line.lower() for keyword in ['_id', 'class_id', 'user_id', 'student_id', 'session_id', 'course_id', 'program_id', 'classroom_id']):
                print(f"[WARN] Line {i}: {line.strip()}")
                issues_found = True

print("\n" + "=" * 70)

if not issues_found:
    print("[OK] No problematic int() conversions found!")
    print("[OK] All ID fields should work with UUIDs")
else:
    print("[WARN] Found potential issues - review lines above")
    print("       UUIDs are strings and should not be converted to int()")

print("\n[*] Note: The following int() uses are safe:")
print("    - int(amount) for durations")
print("    - int(time_left.total_seconds() / 60) for time display")
print("    - int(request.args.get('page', 1)) for pagination")
