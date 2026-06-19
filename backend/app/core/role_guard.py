from typing import List
from fastapi import Depends, HTTPException, status
from app.models.user import User
from app.core.auth_dependencies import get_current_active_user
import logging

logger = logging.getLogger(__name__)

class RoleGuard:
    """
    Enterprise RBAC Role Guard.
    Checks if the local DB user has the required roles.
    """
    def __init__(self, allowed_roles: List[str]):
        self.allowed_roles = [role.upper() for role in allowed_roles]

    async def __call__(self, current_user: User = Depends(get_current_active_user)) -> User:
        user_role = current_user.role.value.upper()
        
        if user_role not in self.allowed_roles:
            logger.warning(f"User {current_user.email} denied access. Required: {self.allowed_roles}, Found: {user_role}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have the enterprise permissions required for this action."
            )
            
        return current_user
