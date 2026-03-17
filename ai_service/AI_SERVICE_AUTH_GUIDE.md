# AI Service Authentication Guide

This guide explains how to secure API endpoints in the `ai_service` using the integrated authentication system. This system is designed to be compatible with the core Java `auth-service` and supports both JWT validation and internal user verification.

## 1. Prerequisites

Ensure the following environment variables are set in your `.env` file (for local dev) or Kubernetes/GitHub Secrets (for deployment):

| Variable                | Description                                                                       |
| :---------------------- | :-------------------------------------------------------------------------------- |
| `JWT_SECRET_KEY`        | The shared secret key used to sign JWTs (same as Java services).                  |
| `AUTH_SERVICE_BASE_URL` | Internal URL of the Auth Service (e.g., `http://auth-service:8071`).              |
| `CLIENT_NAME`           | The client name registered in the `client_secret_key` table (e.g., `ai_service`). |
| `CLIENT_SECRET`         | The secret key for this specific service (from `client_secret_key` table).        |

---

## 2. Implementing Authentication

You can secure endpoints in two ways: **Optional Authentication** (soft gate) or **Enforced Authentication** (hard gate).

### A. Optional Authentication via `get_optional_user`

Use this when an endpoint should function for both anonymous and logged-in users. If a valid token is provided, you get the user context; otherwise, you get `None`.

**Usage:**

```python
from fastapi import APIRouter, Depends
from typing import Optional
from app.core.security import get_optional_user
from app.schemas.auth import CustomUserDetails

router = APIRouter()

@router.post("/generate/video")
async def generate_video(
    payload: VideoGenerationRequest,
    user: Optional[CustomUserDetails] = Depends(get_optional_user)
):
    # Default behavior for anonymous users
    user_id = "anonymous"
    institute_id = None

    # Logic if user is authenticated
    if user:
        user_id = user.user_id
        institute_id = user.institute_id
        print(f"Request from user: {user.username} of institute: {institute_id}")

    # Proceed with business logic...
```

### B. Enforced Authentication via `get_current_user`

Use this when an endpoint **must** require a logged-in user. If the token is missing or invalid, the API automatically returns `401 Unauthorized`.

**Usage:**

```python
from fastapi import APIRouter, Depends
from app.core.security import get_current_user
from app.schemas.auth import CustomUserDetails

router = APIRouter()

@router.get("/my-history")
async def get_history(
    user: CustomUserDetails = Depends(get_current_user)
):
    # This code only executes if a valid user is found
    return {
        "user_id": user.user_id,
        "username": user.username,
        "history": [...]
    }
```

---

## 3. The `CustomUserDetails` Object

The injected `user` object contains the following fields, synchronized with `UserServiceDTO` from Java:

- `username` (str): Unique username.
- `user_id` (str): The system-wide unique User ID.
- `institute_id` (Optional[str]): The Institute ID extracted from the `clientId` header.
- `roles` (List[str]): List of assigned roles.
- `authorities` (List[str]): effective permissions/authorities.
- `enabled` (bool): Account status.

---

## 4. How It Works (Internally)

1.  **JWT Decode**: The service first locally validates the JWT signature using `JWT_SECRET_KEY`.
2.  **Auth Service Verification**: It makes a synchronous internal HTTP call to `auth-service` using HMAC authentication (`clientName` + `Signature` headers).
3.  **Context Construction**: It combines the JWT claims, Auth Service response, and request headers (like `clientId`) to build the full `CustomUserDetails` object.

## 5. Troubleshooting

- **401 Unauthorized**: Token is expired, invalid, or the Auth Service rejected the validation.
- **Missing Institute ID**: Ensure the frontend sends the `clientId` header (or `client_id`).
- **Auth Service Connection Error**: Check `AUTH_SERVICE_BASE_URL` and ensure the `ai_service` container can reach the `auth-service` container.
- **Reference Implementation**: See `app/routers/auth_test.py` for a working example.
