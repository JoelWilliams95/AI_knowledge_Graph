from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .database import SessionLocal, Base, engine
from .models import User
from .hashing import hash_password, verify_password
from .jwt_handler import create_access_token

Base.metadata.create_all(bind=engine)

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()



@router.post("/register")
def register(user: dict, db: Session = Depends(get_db)):

    email = user.get("email", "").strip().lower()
    username = user.get("username", "").strip()
    password = user.get("password", "")

    if not email or not password:
        raise HTTPException(400, "Missing email or password")

  
    existing_user = db.query(User).filter(User.email == email).first()

    if existing_user:
        raise HTTPException(400, "Email already registered")

    new_user = User(
        email=email,
        username=username,
        password=hash_password(password)
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {"message": "User registered successfully!"}



@router.post("/login")
def login(data: dict, db: Session = Depends(get_db)):

    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        raise HTTPException(400, "Email and password are required")

   
    user = db.query(User).filter(User.email == email).first()

    if not user:
        raise HTTPException(400, "User not found")

    if not verify_password(password, user.password):
        raise HTTPException(400, "Incorrect password")
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .database import SessionLocal, Base, engine
from .models import User
from .hashing import hash_password, verify_password
from .jwt_handler import create_access_token

Base.metadata.create_all(bind=engine)

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()



@router.post("/register")
def register(user: dict, db: Session = Depends(get_db)):

    email = user.get("email", "").strip().lower()
    username = user.get("username", "").strip()
    password = user.get("password", "")

    if not email or not password:
        raise HTTPException(400, "Missing email or password")

  
    existing_user = db.query(User).filter(User.email == email).first()

    if existing_user:
        raise HTTPException(400, "Email already registered")

    new_user = User(
        email=email,
        username=username,
        password=hash_password(password)
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {"message": "User registered successfully!"}



@router.post("/login")
def login(data: dict, db: Session = Depends(get_db)):

    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        raise HTTPException(400, "Email and password are required")

   
    user = db.query(User).filter(User.email == email).first()

    if not user:
        raise HTTPException(400, "User not found")

    if not verify_password(password, user.password):
        raise HTTPException(400, "Incorrect password")

    token = create_access_token({"sub": email})

    return {
        "token": token,
        "user": user.email
    }
    token = create_access_token({"sub": email})

    return {
        "token": token,
        "user": user.email
    }