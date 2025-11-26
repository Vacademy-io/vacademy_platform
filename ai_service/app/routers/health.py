from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from ..config import get_settings
from ..db import db_dependency


router = APIRouter()


@router.get("/health")
def health() -> dict:
    return {"status": "ok"}


@router.get("/readiness")
def readiness(db: Session = Depends(db_dependency)) -> dict:
    # Perform a cheap DB check
    db.execute(text("SELECT 1"))
    return {
        "status": "ready",
        "db": "ok",
        "env": get_settings().app_env,
    }


