"""
Database migration script to add face_images column to Student table
Run this script to update your existing database schema
"""
import os
os.environ.setdefault('ENVIRONMENT', 'development')

from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text

# Create a minimal Flask app just for migration
app = Flask(__name__)
app.config.from_pyfile('config.py')
db = SQLAlchemy(app)

def migrate_database():
    with app.app_context():
        try:
            # Add face_images column if it doesn't exist
            with db.engine.connect() as conn:
                # Check if column exists
                result = conn.execute(text("PRAGMA table_info(student)"))
                columns = [row[1] for row in result]
                
                if 'face_images' not in columns:
                    print("Adding face_images column...")
                    conn.execute(text("ALTER TABLE student ADD COLUMN face_images TEXT"))
                    conn.commit()
                    print("✓ face_images column added successfully")
                else:
                    print("✓ face_images column already exists")
            
            print("\nDatabase migration completed successfully!")
            print("\nNote: Existing students will have NULL face_images.")
            print("You may need to re-enroll them to capture face images.")
            
        except Exception as e:
            print(f"Error during migration: {str(e)}")
            import traceback
            traceback.print_exc()

if __name__ == '__main__':
    migrate_database()
