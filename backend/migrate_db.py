#!/usr/bin/env python3
"""
Database migration script to add the 'role' column to existing users table
Run this once when upgrading from the old schema to the new RBAC schema
Usage: python migrate_db.py
"""

import sys
import os
import shutil
from datetime import datetime
sys.path.insert(0, os.path.dirname(__file__))

from app.auth.database import SessionLocal, Base, engine
from app.auth.models import User, UserRole
from app.auth.hashing import hash_password
from sqlalchemy import text

def migrate_database():
    """Migrate the database to add the role column"""
    print("🔄 Starting database migration...")

    # Create a backup of the existing database
    db_path = "./users.db"
    backup_path = "./users.db.backup"

    if os.path.exists(db_path):
        print(f"📦 Creating backup: {backup_path}")
        shutil.copy2(db_path, backup_path)
        print("✅ Backup created successfully")
    else:
        print("⚠️  No existing database found, creating new one...")
        # Create tables with new schema
        Base.metadata.create_all(bind=engine)
        print("✅ New database created with RBAC schema")
        return

    try:
        # Connect to the database
        db = SessionLocal()

        # Check if role column exists
        result = db.execute(text("PRAGMA table_info(users)"))
        columns = [row[1] for row in result.fetchall()]

        if 'role' in columns:
            print("✅ Role column already exists, no migration needed")
            db.close()
            return

        print("🔄 Role column missing, performing migration...")

        # Get all existing users
        result = db.execute(text("SELECT id, email, username, password, created_at FROM users"))
        existing_users = result.fetchall()

        print(f"📊 Found {len(existing_users)} existing users")

        # Drop the table and recreate with new schema
        print("🔄 Recreating table with new schema...")
        db.execute(text("DROP TABLE users"))
        db.commit()

        # Create tables with new schema
        Base.metadata.create_all(bind=engine)

        # Restore users with default role 'user'
        print("🔄 Restoring users with default role...")
        for user_data in existing_users:
            user_id, email, username, password, created_at = user_data

            # Create new user with role
            new_user = User(
                email=email,
                username=username,
                password=password,  # Password is already hashed
                role=UserRole.USER.value  # Default to user role
            )

            # Preserve original ID and created_at if possible
            new_user.id = user_id
            if created_at:
                # Convert string datetime back to datetime object
                try:
                    if isinstance(created_at, str):
                        new_user.created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                    else:
                        new_user.created_at = created_at
                except:
                    # If conversion fails, use current time
                    new_user.created_at = datetime.utcnow()

            db.add(new_user)

        db.commit()

        print("✅ Migration completed successfully!")
        print(f"📊 Migrated {len(existing_users)} users")
        print("📝 All existing users have been assigned the 'user' role")
        print("💡 To create admin users, use: python create_admin.py")
        print("📦 Backup saved as: users.db.backup")

    except Exception as e:
        print(f"❌ Migration failed: {e}")
        print("🔄 Restoring backup...")

        # Restore backup if migration failed
        if os.path.exists(backup_path):
            shutil.copy2(backup_path, db_path)
            print("✅ Backup restored")

        import traceback
        traceback.print_exc()

    finally:
        db.close()

if __name__ == "__main__":
    migrate_database()