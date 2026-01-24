"""
Router for validation endpoints (checking if entities exist).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text

from ..db import db_dependency
from ..schemas.token_usage import ValidationResponse


router = APIRouter(prefix="/validation", tags=["validation"])


@router.get(
    "/v1/institute/{institute_id}",
    response_model=ValidationResponse,
    summary="Check if institute exists",
)
async def check_institute_exists(
    institute_id: str,
    db: Session = Depends(db_dependency),
) -> ValidationResponse:
    """
    Check if an institute with the given ID exists in the database.
    
    Returns:
        ValidationResponse with exists=True if found, exists=False otherwise
    """
    try:
        # Query the institutes table
        result = db.execute(
            text("SELECT COUNT(*) as count FROM institutes WHERE id = :institute_id"),
            {"institute_id": institute_id}
        ).first()
        
        exists = result.count > 0 if result else False
        
        return ValidationResponse(
            entity_type="institute",
            entity_id=institute_id,
            exists=exists
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error checking institute: {str(e)}")


@router.get(
    "/v1/user/{user_id}",
    response_model=ValidationResponse,
    summary="Check if user exists",
)
async def check_user_exists(
    user_id: str,
    db: Session = Depends(db_dependency),
) -> ValidationResponse:
    """
    Check if a user with the given ID exists.
    
    Note: This checks in the common_service users table if accessible,
    or checks through user_roles table as a proxy.
    
    Returns:
        ValidationResponse with exists=True if found, exists=False otherwise
    """
    try:
        # Try to check if user exists through user_roles table (common pattern)
        # This is a proxy check - if user has roles, they exist
        result = db.execute(
            text("SELECT COUNT(*) as count FROM user_roles WHERE user_id = :user_id LIMIT 1"),
            {"user_id": user_id}
        ).first()
        
        exists = result.count > 0 if result else False
        
        # If not found in user_roles, try checking in student table as fallback
        if not exists:
            result = db.execute(
                text("SELECT COUNT(*) as count FROM student WHERE user_id = :user_id LIMIT 1"),
                {"user_id": user_id}
            ).first()
            exists = result.count > 0 if result else False
        
        return ValidationResponse(
            entity_type="user",
            entity_id=user_id,
            exists=exists
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error checking user: {str(e)}")


@router.get(
    "/v1/institute/{institute_id}/user/{user_id}",
    response_model=dict,
    summary="Check if both institute and user exist",
)
async def check_institute_and_user_exist(
    institute_id: str,
    user_id: str,
    db: Session = Depends(db_dependency),
) -> dict:
    """
    Check if both an institute and a user exist.
    
    Returns:
        Dictionary with exists status for both institute and user
    """
    try:
        # Check institute
        inst_result = db.execute(
            text("SELECT COUNT(*) as count FROM institutes WHERE id = :institute_id"),
            {"institute_id": institute_id}
        ).first()
        institute_exists = inst_result.count > 0 if inst_result else False
        
        # Check user
        user_result = db.execute(
            text("SELECT COUNT(*) as count FROM user_roles WHERE user_id = :user_id LIMIT 1"),
            {"user_id": user_id}
        ).first()
        user_exists = user_result.count > 0 if user_result else False
        
        # Fallback check for user in student table
        if not user_exists:
            user_result = db.execute(
                text("SELECT COUNT(*) as count FROM student WHERE user_id = :user_id LIMIT 1"),
                {"user_id": user_id}
            ).first()
            user_exists = user_result.count > 0 if user_result else False
        
        return {
            "institute": {
                "id": institute_id,
                "exists": institute_exists
            },
            "user": {
                "id": user_id,
                "exists": user_exists
            },
            "both_exist": institute_exists and user_exists
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error checking entities: {str(e)}")


__all__ = ["router"]

