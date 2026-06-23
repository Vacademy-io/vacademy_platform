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
    is_root_user: bool = False
    roles: List[str] = []
    authorities: List[str] = []

    # Allow extra fields to be robust against API changes
    model_config = ConfigDict(extra='ignore')


class PinnedPrincipal(BaseModel):
    """
    The verified, institute-pinned identity the Vacademy Assistant trusts.

    Unlike CustomUserDetails (which flattens the JWT authorities to a list of
    institute ids), this carries the roles AND permissions read from the JWT's
    per-institute authorities map *for one fixed institute only* — the institute
    named by the request's `clientId` header. The Assistant authorizes every
    tool call against these fields, so they MUST be derived from the verified
    JWT, never from a request body.

    See app/core/security.py::get_pinned_principal.
    """
    user_id: str
    institute_id: str
    username: Optional[str] = None
    roles: List[str] = []
    permissions: List[str] = []
    is_root_user: bool = False

    model_config = ConfigDict(extra='ignore')

class AuthError(Exception):
    def __init__(self, message: str, status_code: int = 401):
        self.message = message
        self.status_code = status_code
