#!/usr/bin/env python3
"""
Script to create the first admin user
Run this once to set up the initial admin account
Usage: python create_admin.py
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.auth.database import SessionLocal
from app.auth.models import User, UserRole
from app.auth.hashing import hash_password

def create_admin():
    db = SessionLocal()
    try:
        # Check if any admin exists
        existing_admin = db.query(User).filter(User.role == UserRole.ADMIN.value).first()
        if existing_admin:
            print(f"❌ Admin user already exists: {existing_admin.email}")
            print("   To create another admin, use the admin dashboard after logging in.")
            return
        
        # Check if any users exist
        existing_users = db.query(User).count()
        if existing_users > 0:
            print(f"⚠️  Warning: {existing_users} user(s) already exist in the database.")
            response = input("Do you want to create an admin anyway? (yes/no): ")
            if response.lower() != 'yes':
                print("❌ Cancelled.")
                return
        
        # Get admin details
        print("\n" + "="*50)
        print("Creating First Admin User")
        print("="*50)
        email = input("Enter admin email: ").strip().lower()
        
        if not email:
            print("❌ Email is required!")
            return
        
        # Check if email already exists
        existing_user = db.query(User).filter(User.email == email).first()
        if existing_user:
            print(f"❌ User with email {email} already exists!")
            response = input("Do you want to update this user to admin? (yes/no): ")
            if response.lower() == 'yes':
                existing_user.role = UserRole.ADMIN.value
                db.commit()
                print(f"✅ User {email} has been updated to admin role!")
                return
            else:
                print("❌ Cancelled.")
                return
        
        username = input("Enter admin username (optional): ").strip()
        password = input("Enter admin password (min 6 characters): ").strip()
        
        if len(password) < 6:
            print("❌ Password must be at least 6 characters!")
            return
        
        confirm_password = input("Confirm password: ").strip()
        
        if password != confirm_password:
            print("❌ Passwords do not match!")
            return
        
        # Create admin user
        admin_user = User(
            email=email,
            username=username or email.split('@')[0],
            password=hash_password(password),
            role=UserRole.ADMIN.value
        )
        
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)
        
        print("\n" + "="*50)
        print("✅ Admin user created successfully!")
        print("="*50)
        print(f"Email: {admin_user.email}")
        print(f"Username: {admin_user.username}")
        print(f"Role: {admin_user.role}")
        print(f"ID: {admin_user.id}")
        print("\nYou can now login with these credentials.")
        print("="*50)
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error creating admin: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    create_admin()
