#!/usr/bin/env python3
"""
Simple database reset script for development
Deletes the existing database and creates a new empty one
WARNING: This will delete all existing user data!
Usage: python reset_db_simple.py
"""

import sys
import os
import shutil
sys.path.insert(0, os.path.dirname(__file__))

from app.auth.database import Base, engine

def reset_database():
    """Reset the database - delete and recreate with new schema"""
    print("⚠️  WARNING: This will delete all existing user data!")
    response = input("Are you sure you want to continue? (yes/no): ")

    if response.lower() != 'yes':
        print("❌ Cancelled.")
        return

    db_path = "./users.db"
    backup_path = "./users.db.backup"

    # Create backup if database exists
    if os.path.exists(db_path):
        print(f"📦 Creating backup: {backup_path}")
        shutil.copy2(db_path, backup_path)
        print("✅ Backup created")

    # Delete existing database
    if os.path.exists(db_path):
        os.remove(db_path)
        print("🗑️  Deleted existing database")

    # Create new database with updated schema
    print("🔄 Creating new database with RBAC schema...")
    Base.metadata.create_all(bind=engine)
    print("✅ New database created successfully!")
    print("📝 All tables now include the 'role' column")
    print("💡 To create your first admin user, run: python create_admin.py")

if __name__ == "__main__":
    reset_database()