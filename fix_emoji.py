"""Fix emoji characters in migration scripts"""

files = ['migrate_to_uuid.py', 'run_uuid_migration.py']

replacements = [
    ('✅', '[OK]'),
    ('❌', '[FAIL]'),
    ('📊', '[*]'),
    ('📦', '[*]'),
    ('📚', '[*]'),
    ('🎓', '[*]'),
    ('📅', '[*]'),
    ('🔑', '[*]'),
    ('👨‍🏫', '[*]'),
    ('👤', '[*]'),
    ('🏫', '[*]'),
    ('📖', '[*]'),
    ('1️⃣', '[1]'),
    ('2️⃣', '[2]'),
    ('3️⃣', '[3]'),
    ('4️⃣', '[4]'),
    ('⚠️', '[WARN]'),
    ('💾', '[*]'),
    ('🎉', '[SUCCESS]'),
    ('😞', '[FAIL]'),
    ('🔄', '[*]'),
    ('🔍', '[*]'),
    ('🚀', '[*]'),
    ('🤔', '[?]'),
    ('📋', '[*]'),
]

for filename in files:
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            content = f.read()
        
        for old, new in replacements:
            content = content.replace(old, new)
        
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(content)
        
        print(f"[OK] Fixed {filename}")
    except Exception as e:
        print(f"[FAIL] Error fixing {filename}: {e}")

print("\n[SUCCESS] All files fixed!")
