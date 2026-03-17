from fastapi import APIRouter, Depends
from ..core.security import get_current_user
from ..schemas.auth import CustomUserDetails
from ..config import get_settings

router = APIRouter(prefix="/auth-test", tags=["auth-test"])

@router.get("/me", response_model=CustomUserDetails)
async def get_my_details(
    user: CustomUserDetails = Depends(get_current_user)
):
    """
    Test endpoint to verify authentication integration.
    Returns the user details fetched from Auth Service.
    """
    return user

@router.get("/debug-settings")
async def debug_settings(settings = Depends(get_settings)):
    return {
        "auth_service_url": settings.auth_service_base_url,
        "client_name": settings.client_name,
        "has_client_secret": bool(settings.client_secret),
        "jwt_secret_configured": bool(settings.jwt_secret_key)
    }
