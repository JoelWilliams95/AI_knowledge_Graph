from sqlalchemy import Column, Integer, String, DateTime, Enum as SQLEnum
from .database import Base
from datetime import datetime
import enum

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    USER = "user"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    username = Column(String, nullable=True, index=True)
    password = Column(String, nullable=False)
    role = Column(String, default=UserRole.USER.value, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    class Config:
        from_attributes = True
