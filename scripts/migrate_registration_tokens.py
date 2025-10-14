"""
Migration script to add RegistrationToken table for remote student registration
"""
from app import app, db, RegistrationToken

def migrate():
    with app.app_context():
        # Create the new table
        db.create_all()
        print("✅ RegistrationToken table created successfully!")
        print("\nYou can now:")
        print("1. Navigate to /admin/registration-tokens to manage registration links")
        print("2. Generate links for students to self-register")
        print("3. Toggle registration on/off for each class")

if __name__ == '__main__':
    migrate()
