# Epic 03, Story 05 Complete - Token Refresh & Logout

**Story:** Token Refresh and Session Management  
**Status:** ✅ COMPLETE  
**Date Completed:** October 11, 2025  
**Test Results:** 15 API tests passing  
**Overall Tests:** 175 tests passing, 82.35% coverage

---

## 🎉 EPIC 03 IS NOW COMPLETE! 🎉

This is the **FINAL STORY** of Epic 03 - Authentication & Authorization!

---

## What Was Built

### Enhanced Authentication Service

Added 3 new methods to `app/services/auth_service.py`:

#### `refresh_tokens(refresh_token, ip_address, user_agent) -> TokenResponse`
- Validates refresh token signature and type
- Looks up session in database by token hash
- Checks session expiration
- Verifies user is active
- Creates new access token (60 min)
- Creates new refresh token (30 days)
- **Implements token rotation** - old refresh token is invalidated
- Updates session with new token hash
- Updates session metadata (IP, user agent)
- Returns new TokenResponse

#### `logout(user_id, refresh_token) -> None`
- Hashes refresh token to find session
- Looks up session by user ID and token hash
- Deletes session from database
- Invalidates the refresh token
- Raises 401 if session not found

#### `cleanup_expired_sessions() -> int`
- Finds all sessions with expires_at < now
- Deletes expired sessions from database
- Returns count of deleted sessions
- Can be called periodically for maintenance

---

### New API Endpoints

Added 2 endpoints to `app/routers/auth.py`:

#### POST /api/v1/auth/refresh
- **Request:** `TokenRefresh` (refresh_token)
- **Response:** `TokenResponse` (new tokens, 200 OK)
- **Behavior:**
  - Validates refresh token
  - Checks session exists and not expired
  - Issues new access + refresh tokens
  - Invalidates old refresh token (rotation)
  - Updates session metadata
- **Errors:**
  - 401: Invalid/expired token, session not found

#### POST /api/v1/auth/logout
- **Request:** `TokenRefresh` (refresh_token) + Bearer auth
- **Response:** 204 No Content
- **Behavior:**
  - Requires authentication (Bearer token)
  - Deletes session from database
  - Invalidates refresh token
- **Errors:**
  - 401: Session not found or already logged out
  - 403: No credentials provided

---

## Complete Authentication API (5 Endpoints)

### Epic 03 has delivered a complete auth system:

1. ✅ **POST /api/v1/auth/register** - Create account
2. ✅ **POST /api/v1/auth/login** - Authenticate and get tokens
3. ✅ **GET /api/v1/auth/me** - Get current user info (protected)
4. ✅ **POST /api/v1/auth/refresh** - Refresh access token
5. ✅ **POST /api/v1/auth/logout** - Invalidate session

---

## API Documentation

### Refresh Token Endpoint

**Endpoint:** `POST /api/v1/auth/refresh`

**Request:**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Success Response (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",  // New token
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",  // New token
  "token_type": "bearer"
}
```

**Error Responses:**
- `401`: Invalid refresh token
- `401`: Expired refresh token
- `401`: Session not found (token was revoked)
- `403`: User account is inactive

---

### Logout Endpoint

**Endpoint:** `POST /api/v1/auth/logout`

**Request Headers:**
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Request Body:**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Success Response:**
- **Status:** 204 No Content
- **Body:** (empty)

**Error Responses:**
- `401`: Session not found or already logged out
- `403`: No authentication provided

---

## Test Coverage - 15 Tests

### Test Breakdown

#### TestTokenRefresh (6 tests)
- ✅ Successful token refresh
- ✅ Old refresh token invalidated after refresh (rotation)
- ✅ Invalid token rejection
- ✅ Access token cannot be used for refresh
- ✅ Refresh with non-existent session fails
- ✅ New access token works on protected endpoints

#### TestLogout (5 tests)
- ✅ Successful logout
- ✅ Logout invalidates refresh token
- ✅ Logout requires authentication
- ✅ Logout with invalid refresh token fails
- ✅ Logging out twice fails (idempotency check)

#### TestMultipleSessions (2 tests)
- ✅ User can have multiple active sessions
- ✅ Logging out one session keeps others active

#### TestCompleteAuthFlow (2 tests)
- ✅ Full lifecycle: register → login → refresh → logout
- ✅ Session metadata updates on refresh

---

## Security Features

### Token Rotation
- **What:** Each token refresh invalidates the old refresh token
- **Why:** Prevents token replay attacks
- **How:** Session's refresh_token_hash is updated with new token
- **Benefit:** Compromised refresh tokens have limited window of use

### Session Tracking
- **IP Address:** Tracks where login occurred
- **User Agent:** Identifies device/browser
- **Expires At:** Automatic cleanup of old sessions
- **Updates:** Session metadata updated on each refresh

### Multiple Sessions
- **Support:** Users can be logged in on multiple devices
- **Independence:** Logging out one device doesn't affect others
- **Security:** Each session has its own refresh token

### Session Cleanup
- **Function:** `cleanup_expired_sessions()`
- **Purpose:** Remove expired sessions from database
- **Usage:** Can be called periodically via Celery task
- **Benefit:** Keeps database clean and performant

---

## Complete Epic 03 Summary

### 📊 Final Statistics

**Tests:**
- 175 total tests - ALL PASSING ✅
- 31 password tests (Story 01)
- 32 JWT tests (Story 02)
- 16 dependency tests (Story 03)
- 17 registration/login tests (Story 04)
- 15 refresh/logout tests (Story 05)
- 60 database model tests (Epic 02)
- 4 main app tests

**Coverage:**
- 82.35% overall coverage
- 95.35% password module
- 97.06% JWT module
- 80.00% dependencies module
- 96.97% auth router
- 100% auth schemas

**Code Created:**
- 5 modules in app/auth/
- 2 API routers
- 9 Pydantic schemas
- 1 authentication service
- 175 comprehensive tests

---

## Files Created in Story 05

1. **`server/tests/integration/test_auth_refresh_logout.py`** (565 lines)
   - 15 comprehensive tests
   - Token refresh testing
   - Logout testing
   - Multi-session testing
   - Complete flow testing

---

## Files Modified in Story 05

1. **`server/app/services/auth_service.py`**
   - Added `refresh_tokens()` method (126 lines)
   - Added `logout()` method (18 lines)
   - Added `cleanup_expired_sessions()` method (18 lines)
   - Fixed timezone-aware datetime handling

2. **`server/app/routers/auth.py`**
   - Added POST /api/v1/auth/refresh endpoint
   - Added POST /api/v1/auth/logout endpoint

---

## Usage Examples

### Token Refresh Flow

```python
import httpx

async with httpx.AsyncClient() as client:
    # User's access token expired, use refresh token
    response = await client.post(
        "http://localhost:8000/api/v1/auth/refresh",
        json={"refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}
    )
    
    new_tokens = response.json()
    # Store new tokens
    access_token = new_tokens["access_token"]
    refresh_token = new_tokens["refresh_token"]  # Old one is now invalid!
```

### Logout Flow

```python
async with httpx.AsyncClient() as client:
    response = await client.post(
        "http://localhost:8000/api/v1/auth/logout",
        json={"refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."},
        headers={"Authorization": f"Bearer {access_token}"}
    )
    
    # 204 No Content = success
    # Clear stored tokens from client
    # User is now logged out
```

### Frontend Integration (React)

```typescript
// Refresh token when access token expires
const refreshAccessToken = async () => {
  const refreshToken = localStorage.getItem('refresh_token');
  
  const response = await fetch('http://localhost:8000/api/v1/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken })
  });
  
  if (!response.ok) {
    // Refresh token expired or invalid - redirect to login
    window.location.href = '/login';
    return;
  }
  
  const tokens = await response.json();
  localStorage.setItem('access_token', tokens.access_token);
  localStorage.setItem('refresh_token', tokens.refresh_token);
};

// Logout
const logout = async () => {
  const accessToken = localStorage.getItem('access_token');
  const refreshToken = localStorage.getItem('refresh_token');
  
  await fetch('http://localhost:8000/api/v1/auth/logout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({ refresh_token: refreshToken })
  });
  
  // Clear tokens
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  
  // Redirect to login
  window.location.href = '/login';
};
```

---

## Session Management

### Session Lifecycle

```
1. LOGIN → Session created
   - refresh_token_hash stored (SHA-256)
   - expires_at = now + 30 days
   - ip_address and user_agent stored

2. REFRESH → Session updated
   - New refresh_token_hash
   - New expires_at
   - Updated ip_address and user_agent

3. LOGOUT → Session deleted
   - Session removed from database
   - Refresh token invalidated

4. EXPIRATION → Session auto-cleanup
   - cleanup_expired_sessions() removes old sessions
```

### Multi-Device Support

```
User logs in on:
- Desktop → Session 1 (refresh_token_1)
- Mobile → Session 2 (refresh_token_2)
- Tablet → Session 3 (refresh_token_3)

Each device has independent:
- Refresh token
- Session expiration
- IP address
- User agent

Logging out on desktop:
- Deletes Session 1
- Mobile and tablet remain active
```

---

## Acceptance Criteria - All Met ✅

- [x] User can refresh access token using refresh token
- [x] Expired refresh tokens are rejected
- [x] Refresh token is validated against database
- [x] New refresh token is issued on refresh (token rotation)
- [x] User can logout to invalidate session
- [x] Logout removes session from database
- [x] Multiple sessions per user are supported
- [x] Session cleanup utility implemented
- [x] 15 comprehensive tests pass
- [x] API documentation updated

---

## Definition of Done - Complete ✅

- [x] Token refresh endpoint works
- [x] Logout endpoint works
- [x] Expired tokens are rejected
- [x] Invalid tokens are rejected
- [x] Session records are properly managed
- [x] Multiple sessions per user work
- [x] All tests pass (15 new + all previous)
- [x] API documentation is updated
- [x] Token rotation implemented
- [x] Session cleanup utility added

---

## Test Commands

```bash
# Run refresh/logout tests only
docker-compose exec server poetry run pytest tests/integration/test_auth_refresh_logout.py -v

# Run all auth tests
docker-compose exec server poetry run pytest tests/integration/ -v

# Run all tests
docker-compose exec server poetry run pytest tests/ -v

# Test refresh via curl
curl -X POST http://localhost:8000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token":"YOUR_REFRESH_TOKEN"}'

# Test logout via curl
curl -X POST http://localhost:8000/api/v1/auth/logout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{"refresh_token":"YOUR_REFRESH_TOKEN"}'
```

---

## Summary

Epic 03, Story 05 is **COMPLETE** and **PRODUCTION-READY**.

The token refresh and logout system provides:
- ✅ Secure token refresh with rotation
- ✅ Session-based refresh token validation
- ✅ User logout with session deletion
- ✅ Multi-device session support
- ✅ Session expiration checking
- ✅ Expired session cleanup utility
- ✅ Comprehensive test coverage (15 tests)
- ✅ Production-ready implementation

---

## 🎊 EPIC 03 COMPLETE! 🎊

**All 5 stories of Epic 03 are now complete:**

1. ✅ Password Management (31 tests)
2. ✅ JWT Token Management (32 tests)
3. ✅ Authentication Dependencies (16 tests)
4. ✅ User Registration & Login (17 tests)
5. ✅ Token Refresh & Logout (15 tests)

**Total:** 175 tests, 82.35% coverage, 5 API endpoints, complete auth system!

**Ready to proceed to Epic 05: Detection Pipeline Foundation!** 🚀


