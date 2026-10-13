# LAZY NERDS FIXOPS CLIENT MANAGER — API CONTRACT REFERENCE

Base URL: `/api/v1`

All responses are serialized as standard JSON (`application/json`).
All protected endpoints require either a valid `Authorization: Bearer <token>` header or an authenticated `fixops_access_token` HttpOnly session cookie.

---

## 1. System Health

### `GET /health`
Returns system status and PostgreSQL database connection state.
- **Authentication:** Public
- **Response `200 OK`:**
```json
{
  "status": "ok",
  "service": "Lazy Nerds FixOps Client Manager",
  "version": "1.0.0",
  "database": "connected",
  "timestamp": "2026-10-14T00:00:00.000000+00:00"
}
```

---

## 2. Authentication

### `POST /auth/login`
Authenticates authorized personnel and returns an access token.
- **Authentication:** Public
- **Request Body:**
```json
{
  "email": "founder@lazynerds.com",
  "password": "YourPassword123!"
}
```
- **Response `200 OK`:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsIn...",
  "token_type": "bearer",
  "user": {
    "id": "f9533e1f-236b-4079-9677-33f624d87fd0",
    "email": "founder@lazynerds.com",
    "full_name": "Lazy Nerds Founder",
    "role": "founder",
    "is_active": true,
    "created_at": "2026-10-14T00:00:00.000000+00:00"
  }
}
```
- **Cookie Set:** `fixops_access_token=<jwt>; HttpOnly; SameSite=Lax; Path=/`
- **Response `401 Unauthorized`:**
```json
{
  "detail": "Invalid email or password. Please verify your credentials."
}
```

### `GET /auth/me`
Retrieves identity profile for the current authenticated user.
- **Authentication:** Required (`401` if unauthenticated)
- **Response `200 OK`:** Returns `User` object.

### `POST /auth/logout`
Terminates session and clears HttpOnly session cookie.
- **Authentication:** Public
- **Response `200 OK`:**
```json
{
  "message": "Successfully signed out."
}
```

---

## 3. Client Management

### `GET /clients`
Retrieves a paginated list of client records with debounced search, filtering, and strict sorting.
- **Authentication:** Required
- **Query Parameters:**
  - `page` (`integer`, default `1`, min `1`): Page number (1-based).
  - `page_size` (`integer`, default `10`, min `1`, max `100`): Records per page.
  - `search` (`string`, optional): Case-insensitive search on company name, contact name, or contact email.
  - `status` (`string`, default `"active"`): Filter by `"active"`, `"archived"`, or `"all"`.
  - `sort_by` (`string`, default `"created_at"`): Allowed fields: `company_name`, `created_at`, `updated_at`, `primary_contact_name`. Unsupported fields return `400 Bad Request`.
  - `sort_order` (`string`, default `"desc"`): `"asc"` or `"desc"`.
- **Response `200 OK`:**
```json
{
  "items": [
    {
      "id": "e4b3c2a1-0000-0000-0000-000000000000",
      "company_name": "Apex Global Security",
      "primary_contact_name": "Elena Rostova",
      "primary_contact_email": "elena.rostova@apex-sec.demo",
      "website": "https://apex-sec.demo",
      "phone": "+1-555-0199",
      "industry": "Fintech & Banking",
      "notes": "External assessment scope.",
      "status": "active",
      "created_at": "2026-10-14T00:00:00.000000+00:00",
      "updated_at": "2026-10-14T00:00:00.000000+00:00"
    }
  ],
  "total": 1,
  "page": 1,
  "page_size": 10,
  "total_pages": 1
}
```

### `POST /clients`
Creates a new client record transactionally.
- **Authentication:** Required
- **Request Body:**
```json
{
  "company_name": "Apex Global Security",
  "primary_contact_name": "Elena Rostova",
  "primary_contact_email": "elena@apex.com",
  "website": "https://apex.com",
  "phone": "+1-555-0199",
  "industry": "Fintech & Banking",
  "notes": "Preliminary assessment scope."
}
```
- **Validation Rules:**
  - `company_name`: Required, 1-255 characters, non-whitespace.
  - `primary_contact_name`: Required, 1-255 characters, non-whitespace.
  - `primary_contact_email`: Required, valid RFC 5322 email format.
  - `website`: Optional, HTTP/HTTPS schemes only.
  - `notes`: Optional, maximum 5,000 characters.
- **Response `201 Created`:** Returns created `Client` object with UUID and timestamps.
- **Response `422 Unprocessable Entity`:**
```json
{
  "detail": "Validation failed for the submitted data.",
  "errors": [
    {
      "field": "company_name",
      "message": "Field must not be empty or whitespace only."
    }
  ]
}
```

### `GET /clients/{client_id}`
Retrieves a specific client profile by UUID.
- **Authentication:** Required
- **Response `200 OK`:** Returns `Client` object.
- **Response `404 Not Found`:**
```json
{
  "detail": "This client could not be found."
}
```

### `PATCH /clients/{client_id}`
Performs a partial update on supported fields. Automatically updates `updated_at`.
- **Authentication:** Required
- **Request Body:** Any subset of `ClientUpdateInput` fields.
- **Response `200 OK`:** Returns updated `Client` object.
- **Response `404 Not Found`:** Returned if client ID does not exist.

### `POST /clients/{client_id}/archive`
Archives an active client record.
- **Authentication:** Required
- **Effect:** Sets `status = "archived"`. Client remains in database and searchable via `status=archived`.
- **Response `200 OK`:** Returns updated `Client` object with `status: "archived"`.

### `POST /clients/{client_id}/restore`
Restores an archived client to active status.
- **Authentication:** Required
- **Effect:** Sets `status = "active"`. Client returns to default directory listings.
- **Response `200 OK`:** Returns updated `Client` object with `status: "active"`.
