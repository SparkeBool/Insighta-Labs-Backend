# Insighta Labs+ Backend

Profile Intelligence Service with GitHub OAuth, RBAC, and secure API access.

## System Architecture

The backend is built with Express.js and MongoDB Atlas handling authentication, authorization, rate limiting, and profile data operations.

### Components
- Authentication Service: GitHub OAuth with PKCE
- Token Service: JWT access (3min) + refresh tokens (5min)
- RBAC Middleware: admin/analyst roles
- Rate Limiter: 10/min for auth, 60/min for API
- Request Logger: method, endpoint, status, response time

### Database Collections
- users: Authentication and roles
- refreshtokens: Token storage and invalidation
- profiles: Profile intelligence data

## Authentication Flow

### Web Portal
1. GET /auth/github → Returns GitHub OAuth URL
2. User authorizes → GitHub redirects to /auth/github/callback
3. Backend exchanges code for user info
4. Backend issues JWT tokens as HTTP-only cookies
5. Redirects to dashboard

### CLI (PKCE)
1. insighta login generates code_verifier and code_challenge
2. CLI starts callback server on port 3001
3. CLI opens browser with code_challenge
4. After authorization, CLI exchanges code + code_verifier
5. CLI sends user info to /auth/cli/callback
6. Backend issues JWT tokens
7. CLI stores tokens in ~/.insighta/credentials.json

## Token Handling

| Token | Expiry | Storage (Web) | Storage (CLI) |
|-------|--------|---------------|---------------|
| Access Token | 3 minutes | HTTP-only cookie | JSON file |
| Refresh Token | 5 minutes | HTTP-only cookie | JSON file |

Refresh tokens are single-use and invalidated after each refresh.

## Role Enforcement

| Role | Permissions |
|------|-------------|
| admin | Full access: create, delete, read, search, export |
| analyst | Read-only: read, search, export |

Default role for new users: analyst

## Natural Language Parsing

Rule-based parsing (no AI/LLM):

| Keyword | Maps To |
|---------|---------|
| male/men/boys | gender=male |
| female/women/girls | gender=female |
| young | min_age=16, max_age=24 |
| child/children/kid | age_group=child |
| teen/teenager | age_group=teenager |
| adult | age_group=adult |
| senior/elder/old | age_group=senior |
| above/over {age} | min_age={age} |
| below/under {age} | max_age={age} |
| from/in {country} | country_id={code} |

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /auth/github | Initiate GitHub OAuth |
| GET | /auth/github/callback | OAuth callback |
| POST | /auth/cli/callback | CLI authentication |
| POST | /auth/refresh | Refresh token |
| POST | /auth/logout | Logout |
| GET | /auth/me | Current user |

### Users
| Method | Endpoint | RBAC |
|--------|----------|------|
| GET | /api/users/me | authenticated |
| GET | /api/users | admin only |

### Profiles (require X-API-Version: 1)
| Method | Endpoint | RBAC |
|--------|----------|------|
| GET | /api/profiles | analyst+ |
| GET | /api/profiles/search | analyst+ |
| GET | /api/profiles/:id | analyst+ |
| GET | /api/profiles/export | analyst+ |
| POST | /api/profiles | admin only |
| DELETE | /api/profiles/:id | admin only |

## Rate Limiting

| Scope | Limit |
|-------|-------|
| Auth endpoints (/auth/*) | 10 requests per minute |
| All other endpoints | 60 requests per minute per user |

## Environment Variables

```env
PORT=3000
MONGODB_URI=your_mongodb_connection_string
GITHUB_CLIENT_ID=your_github_oauth_client_id
GITHUB_CLIENT_SECRET=your_github_oauth_client_secret
JWT_SECRET=your_jwt_secret_key
FRONTEND_URL=http://localhost:5173