from typing import List, Optional
from pydantic import BaseModel, ConfigDict

class CustomUserDetails(BaseModel):
    """
    User details model matching Java's CustomUserDetails / UserServiceDTO.
    """
    username: str
    user_id: str
    institute_id: Optional[str] = None
    enabled: bool = True
    roles: List[str] = []
    authorities: List[str] = []
    
    # Allow extra fields to be robust against API changes
    model_config = ConfigDict(extra='ignore')

class AuthError(Exception):
    def __init__(self, message: str, status_code: int = 401):
        self.message = message
        self.status_code = status_code
