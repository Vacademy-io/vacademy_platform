from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
import time
import os
from datetime import datetime

from ..config import get_settings
from ..db import db_dependency

router = APIRouter(
    prefix="/ai-service/health",
    tags=["Health"]
)


@router.get("/ping")
def ping() -> dict:
    """
    Ultra-lightweight ping endpoint for client-side latency measurement
    """
    return {
        "status": "OK",
        "service": "ai-service",
        "timestamp": int(time.time() * 1000)
    }


@router.get("/db")
def get_database_latency(db: Session = Depends(db_dependency)) -> dict:
    """
    Database latency measurement
    """
    response = {
        "service": "ai-service",
        "timestamp": datetime.utcnow().isoformat()
    }
    
    start_time = time.time()
    try:
        # Simple query to test connection
        db.execute(text("SELECT 1"))
        latency_ms = (time.time() - start_time) * 1000
        
        response.update({
            "status": "UP",
            "connected": True,
            "connection_time_ms": latency_ms,
            "total_latency_ms": latency_ms
        })
    except Exception as e:
        latency_ms = (time.time() - start_time) * 1000
        response.update({
            "status": "DOWN",
            "connected": False,
            "connection_time_ms": latency_ms,
            "error": str(e)
        })
        
    return response


@router.get("/complete")
def get_complete_health(db: Session = Depends(db_dependency)) -> dict:
    """
    Complete health summary
    """
    # Database health
    db_response = get_database_latency(db)
    
    overall_status = "HEALTHY" if db_response["status"] == "UP" else "UNHEALTHY"
    
    return {
        "service": "ai-service",
        "timestamp": datetime.utcnow().isoformat(),
        "database": db_response,
        "overall_status": overall_status
    }

# Keep original endpoints for backward compatibility if needed by K8s probes
@router.get("", include_in_schema=False)
@router.get("/", include_in_schema=False)
def health_root() -> dict:
    return {"status": "ok"}

# Keep original endpoints for backward compatibility if needed by K8s probes
@router.get("/health", include_in_schema=False)
def health_legacy() -> dict:
    return {"status": "ok"}
