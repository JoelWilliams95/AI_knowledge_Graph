#!/usr/bin/env python3
"""
Script to initialize the database and create tables
Run this once to set up the database schema
Usage: python init_db.py
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.auth.database import engine, Base
from app.auth.models import User

def init_db():
    """Create all database tables"""
    print("Initializing database...")
    
    # Create all tables defined in Base.metadata
    Base.metadata.create_all(bind=engine)
    
    print("✅ Database initialized successfully!")
    print("✅ 'users' table created!")
    print(f"📁 Database location: users.db")

if __name__ == "__main__":
    init_db()
