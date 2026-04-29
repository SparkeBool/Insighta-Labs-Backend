# Insighta Labs+ Backend

Profile Intelligence Service with GitHub OAuth, RBAC, and secure API access.

## System Architecture

The backend is built with Express.js and MongoDB Atlas. It handles authentication, authorization, rate limiting, and all profile data operations.

### Components

- **Authentication Service**: GitHub OAuth with PKCE support for CLI
- **Token Service**: JWT access tokens (3min) + refresh tokens (5min)
- **RBAC Middleware**: Role-based access control (admin/analyst)
- **Rate Limiter**: 10/min for auth, 60/min for API endpoints
- **Request Logger**: Logs method, endpoint, status, response time

### Database Collections

| Collection | Purpose |
|------------|---------|
| users | User authentication and roles |
| refreshtokens | Refresh token storage and invalidation |
| profiles | Profile intelligence data |

## Authentication Flow

### Web Portal Flow
1. Frontend calls `GET /auth/github`
2. Backend redirects to GitHub OAuth
3. User authorizes
4. GitHub redirects to `/auth/github/callback`
5. Backend exchanges code for user info
6. Backend creates JWT access token (3min) and refresh token (5min)
7. Tokens stored as HTTP-only cookies
8. User redirected to dashboard

### CLI Flow (PKCE)
1. CLI runs `insighta login`
2. CLI generates `code_verifier` and `code_challenge`
3. CLI starts callback server on port 3001
4. CLI opens browser with `code_challenge`
5. User authorizes
6. GitHub redirects to `http://localhost:3001/callback`
7. CLI exchanges code + code_verifier for tokens
8. CLI sends user info to `/auth/cli/callback`
9. Backend issues JWT tokens
10. CLI stores tokens in `~/.insighta/credentials.json`

## Token Handling

| Token | Expiry | Storage (Web) | Storage (CLI) |
|-------|--------|---------------|---------------|
| Access Token | 3 minutes | HTTP-only cookie | JSON file |
| Refresh Token | 5 minutes | HTTP-only cookie | JSON file |

### Token Rules
- Refresh tokens are single-use only
- Old refresh token invalidated after each refresh
- New token pair issued on each refresh request

## Role Enforcement Logic

| Role | Permissions |
|------|-------------|
| admin | Full access: create, delete, read, search, export |
| analyst | Read-only: read, search, export |

**Default role for new users:** `analyst`

### RBAC Implementation

All protected endpoints use middleware:

```javascript
// Analyst or higher (read access)
app.get("/api/profiles", authenticate, requireAnalyst, handler);

// Admin only (write access)
app.post("/api/profiles", authenticate, requireAdmin, handler);
```

## Natural Language Parsing Approach

The search endpoint (`GET /api/profiles/search`) uses rule-based parsing. No AI or LLM is used.

### Parsing Rules

| Keyword/Pattern | Maps To |
|-----------------|---------|
| male / men / boys | gender=male |
| female / women / girls | gender=female |
| young | min_age=16, max_age=24 |
| child / children / kid | age_group=child |
| teen / teenager | age_group=teenager |
| adult | age_group=adult |
| senior / elder / old | age_group=senior |
| above / over / older than {age} | min_age={age} |
| below / under / younger than {age} | max_age={age} |
| from / in {country} | country_id={code} |

### Country Mapping

Supports country names to ISO codes: Nigeria→NG, Kenya→KE, United States→US, etc.

### Example Transformations

| Query | Result |
|-------|--------|
| "young males from nigeria" | `gender=male, min_age=16, max_age=24, country_id=NG` |
| "females above 30" | `gender=female, min_age=30` |
| "adult males from kenya" | `gender=male, age_group=adult, country_id=KE` |

If query cannot be interpreted, returns: `{"status": "error", "message": "Unable to interpret query"}`

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/auth/github` | Initiate GitHub OAuth |
| GET | `/auth/github/callback` | OAuth callback handler |
| POST | `/auth/cli/callback` | CLI authentication |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/logout` | Logout and invalidate tokens |
| GET | `/auth/me` | Get current user info |

### Profiles (require `X-API-Version: 1` header)

| Method | Endpoint | RBAC Required |
|--------|----------|---------------|
| GET | `/api/profiles` | analyst+ |
| GET | `/api/profiles/search` | analyst+ |
| GET | `/api/profiles/:id` | analyst+ |
| GET | `/api/profiles/export` | analyst+ |
| POST | `/api/profiles` | admin only |
| DELETE | `/api/profiles/:id` | admin only |

### Pagination Response Format

```json
{
  "status": "success",
  "page": 1,
  "limit": 10,
  "total": 2026,
  "total_pages": 203,
  "links": {
    "self": "/api/profiles?page=1&limit=10",
    "next": "/api/profiles?page=2&limit=10",
    "prev": null
  },
  "data": [...]
}
```

### CSV Export Columns

Order: `id, name, gender, gender_probability, age, age_group, country_id, country_name, country_probability, created_at`

## Rate Limiting

| Scope | Limit |
|-------|-------|
| Auth endpoints (`/auth/*`) | 10 requests per minute |
| All other endpoints | 60 requests per minute per user |

When exceeded, returns `429 Too Many Requests`

## Request Logging

Every request logs:
- HTTP method
- Endpoint path
- Status code
- Response time in milliseconds

Example log entry:
```json
{"method":"GET","endpoint":"/api/profiles","status":200,"response_time_ms":45}
```

## Environment Variables

```env
PORT=3000
MONGODB_URI=your_mongodb_connection_string
GITHUB_CLIENT_ID=your_github_oauth_client_id
GITHUB_CLIENT_SECRET=your_github_oauth_client_secret
JWT_SECRET=your_jwt_secret_key
FRONTEND_URL=http://localhost:5173
```

## Setup

```bash
# Install dependencies
npm install

# Create .env file with above variables

# Start development server
npm run dev

# Production start
npm start
```

## Deployment

Deploy to Vercel, Railway, or Heroku (Render not accepted).

### Vercel Deployment

```bash
vercel --prod
```

Add all environment variables in Vercel dashboard.

### Required GitHub OAuth Callback URLs

Add these to your GitHub OAuth App:

```
http://localhost:3000/auth/github/callback
http://localhost:5173/auth/callback
http://localhost:3001/callback
```

## Tech Stack

- Node.js + Express.js
- MongoDB + Mongoose ODM
- JWT for tokens
- GitHub OAuth
- Express Rate Limit
- Cookie Parser
- Helmet for security
