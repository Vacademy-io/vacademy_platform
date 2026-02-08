import base64
import logging
from typing import Optional, Annotated

from fastapi import Depends, HTTPException, status, Request, Header
from jose import jwt, JWTError
import httpx

from ..config import get_settings, Settings
from ..schemas.auth import CustomUserDetails, AuthError

logger = logging.getLogger(__name__)

async def get_optional_user(
    request: Request,
    authorization: Optional[str] = Header(None),
    settings: Settings = Depends(get_settings)
) -> Optional[CustomUserDetails]:
    """
    Extract and verify user from JWT token if present.
    Returns None if token is missing or invalid (no exception raised).
    This allows the endpoint to work for both authenticated and unauthenticated users.
    """
    if not authorization:
        return None
        
    try:
        return await _verify_and_fetch_user(authorization, request, settings)
    except Exception as e:
        logger.warning(f"Optional auth failed: {e}")
        return None


async def get_current_user(
    request: Request,
    authorization: Optional[str] = Header(None),
    settings: Settings = Depends(get_settings)
) -> CustomUserDetails:
    """
    Enforce authentication. Raises HTTPException if token is invalid or missing.
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header"
        )
        
    try:
        user = await _verify_and_fetch_user(authorization, request, settings)
        if not user:
             raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User verification failed"
            )
        return user
    except AuthError as ae:
        raise HTTPException(status_code=ae.status_code, detail=ae.message)
    except Exception as e:
        logger.error(f"Authentication error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )


async def _verify_and_fetch_user(auth_header: str, request: Request, settings: Settings) -> Optional[CustomUserDetails]:
    """
    Internal logic to decode JWT and call Auth Service.
    """
    if not auth_header.startswith("Bearer "):
        # Log to debug
        # logger.debug(f"Invalid auth header format: {auth_header[:10]}...")
        return None # Do not raise immediately to allow optional auth to fail gracefully if header is just wrong
        
    token = auth_header.replace("Bearer ", "")
    
    # 1. Decode and Validate JWT locally first
    try:
        # Java: Decoders.BASE64.decode(secretKey)
        # Note: The secret key string looks like Hex, but Java treats it as Base64.
        # We must align with Java. 
        # If decode fails, it might be due to padding, but standard library usually handles it or we add padding.
        
        # Ensure padding for Base64 (len % 4 == 0)
        missing_padding = len(settings.jwt_secret_key) % 4
        if missing_padding:
            settings.jwt_secret_key += '=' * (4 - missing_padding)
            
        secret_bytes = base64.b64decode(settings.jwt_secret_key)
        
        payload = jwt.decode(
            token, 
            secret_bytes,  # Pass bytes!
            algorithms=[settings.jwt_algorithm],
            options={"verify_aud": False, "verify_iss": False} 
        )
        
        username = payload.get("sub")
        if not username:
             logger.warning("JWT decoded but missing 'sub' claim")
             return None
             
    except Exception as e:
        logger.error(f"JWT Validation failed: {e}")
        # Invalid token -> Return None (so optional auth sees None, enforced auth raises 401)
        return None
        
    # 2. Call Auth Service (Internal API)
    if not settings.client_secret:
        logger.warning("CLIENT_SECRET not configured. Skipping Auth Service call. Returning JWT claims.")
        return _create_user_from_jwt_payload(payload)
        
    # Extract 'clientId' (Institute ID) from headers, as required by Auth Service
    # Java: final String instituteId = request.getHeader("clientId");
    # Java: final String usernameWithInstituteId = instituteId + "@" + jwtService.extractUsername(jwt);
    client_id = request.headers.get("clientId") or request.headers.get("client_id")
    
    if not client_id:
         # Fallback: if no institute ID header, we can't construct the full username expected by Auth Service
         # But maybe Auth Service accepts just username if institute is implicit? 
         # Based on Java code, it strictly concatenates.
         # We'll try with just username if client_id is missing, or return JWT user.
         logger.warning("Missing 'clientId' header. Auth Service might reject user lookup.")
         full_username = username
    else:
         full_username = f"{client_id}@{username}"

    try:
        async with httpx.AsyncClient() as client:
            headers = {
                "clientName": settings.client_name,
                "Signature": settings.client_secret, # Pass secret directly as Signature
                "Content-Type": "application/json"
            }
            
            # Auth Service internal route
            url = f"{settings.auth_service_base_url}/auth-service/v1/internal/user"
            params = {
                "userName": full_username,
                "serviceName": settings.client_name
            }
            
            response = await client.get(url, headers=headers, params=params, timeout=5.0)
            
            if response.status_code == 200:
                data = response.json()
                return CustomUserDetails(
                    username=data.get("username", username),
                    user_id=data.get("userId"),
                    institute_id=client_id,
                    enabled=data.get("enabled", True),
                    roles=data.get("roles", []),
                    authorities=data.get("authorities", [])
                )
            else:
                 logger.warning(f"Auth Service returned {response.status_code} for user {full_username}: {response.text}")
                 # Fallback to JWT if Auth Service fails? 
                 # User said "verify via auth service". If verification fails, we should fail.
                 return None
                 
    except httpx.RequestError as e:
        logger.error(f"Failed to connect to Auth Service: {e}")
        return None

def _create_user_from_jwt_payload(payload: dict) -> CustomUserDetails:
    # Use 'user' claim for ID if present (from Java generateToken)
    user_id = payload.get("user") 
    if not user_id:
        # Generate or use sub?
        user_id = "unknown"
        
    return CustomUserDetails(
        username=payload.get("sub"),
        user_id=str(user_id),
        roles=[], 
        authorities=list(payload.get("authorities", {}).keys()) if isinstance(payload.get("authorities"), dict) else []
    )
