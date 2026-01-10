from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import List, Optional

from .database import SessionLocal, Base, engine
from .models import User, UserRole
from .hashing import hash_password, verify_password
from .jwt_handler import create_access_token
from .permissions import get_db, get_current_user, get_current_admin

# Create tables on startup
Base.metadata.create_all(bind=engine)

router = APIRouter(prefix="/auth", tags=["authentication"])

# Pydantic Models
class UserRegister(BaseModel):
    email: str
    username: str
    password: str
    role: Optional[str] = UserRole.USER.value  # Default to user, only admin can create admins

class UserLogin(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: dict

class UserResponse(BaseModel):
    id: int
    email: str
    username: str
    role: str
    created_at: Optional[str] = None

    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = None

# Endpoints
# REMOVED: Public registration endpoint - only admins can create users now

@router.post("/login", response_model=TokenResponse)
def login(login_data: UserLogin, db: Session = Depends(get_db)):
    """Login user and return access token"""
    email = login_data.email.strip().lower()
    password = login_data.password

    # Validation
    if not email or not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email and password are required"
        )

    # Get user
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    # Verify password
    if not verify_password(password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    # Create token with role information
    access_token = create_access_token({
        "sub": user.email,
        "user_id": user.id,
        "role": user.role
    })

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "username": user.username,
            "role": user.role
        }
    }

# Admin-only endpoints
@router.post("/admin/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    user_data: UserRegister,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Create a new user (Admin only)"""
    email = user_data.email.strip().lower()
    username = user_data.username.strip()
    password = user_data.password
    user_role = user_data.role or UserRole.USER.value

    # Validation
    if not email or not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email and password are required"
        )

    if len(password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters"
        )

    # Validate role
    if user_role not in [UserRole.ADMIN.value, UserRole.USER.value]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role. Must be 'admin' or 'user'"
        )

    # Check if user already exists
    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Create new user
    new_user = User(
        email=email,
        username=username or email.split('@')[0],
        password=hash_password(password),
        role=user_role
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return UserResponse(
        id=new_user.id,
        email=new_user.email,
        username=new_user.username,
        role=new_user.role,
        created_at=new_user.created_at.isoformat() if new_user.created_at else None
    )

@router.get("/admin/users", response_model=List[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Get list of all users (Admin only)"""
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [
        UserResponse(
            id=user.id,
            email=user.email,
            username=user.username,
            role=user.role,
            created_at=user.created_at.isoformat() if user.created_at else None
        )
        for user in users
    ]

@router.get("/admin/users/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Get user by ID (Admin only)"""
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    return UserResponse(
        id=user.id,
        email=user.email,
        username=user.username,
        role=user.role,
        created_at=user.created_at.isoformat() if user.created_at else None
    )

@router.put("/admin/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    user_update: UserUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Update user (Admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Update fields if provided
    if user_update.username is not None:
        user.username = user_update.username.strip()

    if user_update.email is not None:
        new_email = user_update.email.strip().lower()
        # Check if email is already taken by another user
        existing_user = db.query(User).filter(User.email == new_email, User.id != user_id).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already in use"
            )
        user.email = new_email

    if user_update.role is not None:
        if user_update.role not in [UserRole.ADMIN.value, UserRole.USER.value]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid role. Must be 'admin' or 'user'"
            )
        # Prevent admin from removing their own admin role
        if admin.id == user_id and user_update.role != UserRole.ADMIN.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove your own admin role"
            )
        user.role = user_update.role

    if user_update.password is not None:
        if len(user_update.password) < 6:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must be at least 6 characters"
            )
        user.password = hash_password(user_update.password)

    db.commit()
    db.refresh(user)

    return UserResponse(
        id=user.id,
        email=user.email,
        username=user.username,
        role=user.role,
        created_at=user.created_at.isoformat() if user.created_at else None
    )

@router.delete("/admin/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    """Delete user (Admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Prevent admin from deleting themselves
    if admin.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )

    db.delete(user)
    db.commit()
    return None

@router.get("/me", response_model=UserResponse)
def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current authenticated user info"""
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        username=current_user.username,
        role=current_user.role,
        created_at=current_user.created_at.isoformat() if current_user.created_at else None
    )
