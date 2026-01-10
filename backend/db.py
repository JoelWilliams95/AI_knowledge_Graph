from sqlalchemy import create_engine
from app.database import Base   # adjust import to your project structure
from app.models import User     # this IMPORT is REQUIRED

DATABASE_URL = "sqlite:///users.db"

engine = create_engine(DATABASE_URL, echo=True)
Base.metadata.create_all(bind=engine)

print("Tables created")
