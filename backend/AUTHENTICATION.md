# Authentication Integration Guide

## Overview
The authentication system has been successfully integrated into the AI Knowledge Graph project. It provides secure user registration and login functionality with JWT token-based authentication.

## Files Created/Modified

### Backend (Python/FastAPI)

#### New Authentication Module (`backend/app/auth/`)
- **`__init__.py`** - Package initializer
- **`database.py`** - SQLAlchemy database configuration (SQLite)
- **`models.py`** - User database model with email, username, password, created_at
- **`hashing.py`** - Password hashing using bcrypt
- **`jwt_handler.py`** - JWT token creation and validation
- **`router.py`** - Authentication endpoints (register, login)

#### Modified Files
- **`backend/app/main.py`** - Integrated auth router and added security dependencies
- **`backend/requirements.txt`** - Added required packages:
  - `sqlalchemy==2.0.0` - ORM for database operations
  - `passlib==1.7.4` - Password hashing library
  - `python-jose==3.3.0` - JWT handling
  - `PyJWT==2.8.1` - JWT encoding/decoding
  - `bcrypt==4.0.1` - Bcrypt hashing algorithm
  - `email-validator==2.0.0` - Email validation

- **`backend/.env`** - Added authentication configuration:
  - `SECRET_KEY` - Secret key for JWT signing (change in production!)
  - `ACCESS_TOKEN_EXPIRE_HOURS` - Token expiration time (default: 24 hours)
  - `DATABASE_URL` - SQLite database location

### Frontend (React)

#### Modified Files
- **`frontend/src/pages/Login.js`**
  - Connected to backend `/auth/login` endpoint
  - Added real API calls instead of mock login
  - Added error handling and loading states
  - Improved UX with error messages

- **`frontend/src/pages/Register.js`**
  - Connected to backend `/auth/register` endpoint
  - Added validation (email, username, passwords match, min 6 chars)
  - Added error handling and loading states
  - Username field was missing, now included

- **`frontend/src/styles/auth.css`**
  - Added `.error-message` styling
  - Added `:disabled` state styling for inputs and buttons

## API Endpoints

### Authentication Endpoints (Prefix: `/auth`)

#### 1. Register User
- **URL**: `POST /auth/register`
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "username": "username",
    "password": "password123"
  }
  ```
- **Response** (201):
  ```json
  {
    "message": "User registered successfully!",
    "user": {
      "id": 1,
      "email": "user@example.com",
      "username": "username"
    }
  }
  ```
- **Errors**:
  - 400: Email already registered
  - 400: Missing email or password
  - 400: Password too short

#### 2. Login User
- **URL**: `POST /auth/login`
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "password123"
  }
  ```
- **Response** (200):
  ```json
  {
    "access_token": "eyJhbGc...",
    "token_type": "bearer",
    "user": {
      "id": 1,
      "email": "user@example.com",
      "username": "username"
    }
  }
  ```
- **Errors**:
  - 401: Invalid email or password
  - 400: Missing email or password

## Environment Setup

### Backend

1. **Install Dependencies**:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. **Configure Environment** (update `.env`):
   ```env
   SECRET_KEY=choose-a-strong-secret-key-for-production
   ACCESS_TOKEN_EXPIRE_HOURS=24
   DATABASE_URL=sqlite:///./users.db
   ```

3. **Run Server**:
   ```bash
   uvicorn app.main:app --reload
   ```
   The server will be available at `http://localhost:8000`

### Frontend

1. **Create `.env` file** in `frontend/`:
   ```env
   REACT_APP_API_URL=http://localhost:8000
   ```

2. **Install Dependencies**:
   ```bash
   cd frontend
   npm install
   ```

3. **Start Development Server**:
   ```bash
   npm start
   ```

## Security Notes

⚠️ **Important for Production**:

1. **Change the SECRET_KEY**:
   - Current default is for development only
   - Generate a strong random key in production
   - Example: `openssl rand -hex 32`

2. **Use HTTPS**:
   - Always use HTTPS in production
   - Update CORS settings appropriately

3. **Database**:
   - SQLite is suitable for development/small projects
   - Consider PostgreSQL for production

4. **Environment Variables**:
   - Never commit `.env` files to version control
   - Use `.env.example` template for documentation

5. **Token Management**:
   - Tokens are stored in `localStorage` on the frontend
   - Consider using secure HTTP-only cookies for better security
   - Implement token refresh mechanism for longer sessions

## Database

### User Table Schema
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  email VARCHAR UNIQUE NOT NULL,
  username VARCHAR,
  password VARCHAR NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

The database file (`users.db`) will be created automatically on first run.

## Usage Flow

### User Registration
1. User navigates to `/register`
2. Enters email, username, and password
3. Frontend validates inputs
4. POST request to `/auth/register`
5. Backend creates user (if email doesn't exist)
6. User is redirected to login page

### User Login
1. User navigates to `/login`
2. Enters email and password
3. POST request to `/auth/login`
4. Backend validates credentials
5. Returns JWT token
6. Token stored in localStorage
7. User is redirected to home page

### Protected Routes
To protect API endpoints, use the `get_current_user` dependency in `main.py`:

```python
@app.get("/protected-endpoint")
def protected(current_user: dict = Depends(get_current_user)):
    return {"message": f"Hello {current_user['sub']}"}
```

## Troubleshooting

### Database Issues
- Delete `users.db` to reset database
- Ensure `DATABASE_URL` in `.env` is correct

### CORS Issues
- Check frontend `REACT_APP_API_URL` matches backend server address
- Verify CORS middleware in `main.py`

### Login Fails
- Ensure correct email and password
- Check backend logs for errors
- Verify database connection

### Token Errors
- Check `SECRET_KEY` is consistent between requests
- Verify token hasn't expired
- Clear localStorage and try re-logging

## Next Steps

1. **Implement Logout**: Already integrated in `AuthContext.js`
2. **Add Profile Route**: Create endpoint to get current user details
3. **Email Verification**: Implement email confirmation
4. **Password Reset**: Add forgot password functionality
5. **Rate Limiting**: Prevent brute force attacks
6. **2FA**: Add two-factor authentication for enhanced security
7. **OAuth Integration**: Add Google/GitHub login options

## Testing

### Test Registration
```bash
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","username":"testuser","password":"password123"}'
```

### Test Login
```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### Test Protected Endpoint
```bash
curl -X GET http://localhost:8000/protected-endpoint \
  -H "Authorization: Bearer <your-token-here>"
```

## Support

For issues or questions, refer to:
- FastAPI Documentation: https://fastapi.tiangolo.com/
- SQLAlchemy Documentation: https://docs.sqlalchemy.org/
- JWT Documentation: https://pyjwt.readthedocs.io/
