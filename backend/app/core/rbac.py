from functools import wraps
from fastapi import HTTPException, status
from app.models.user import User, Role

def require_role(*allowed_roles: Role):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # The current user should be injected via FastAPI dependency.
            # We'll extract current_user from kwargs or request state.
            current_user: User = kwargs.get('current_user')
            if not current_user:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not authenticated")
            if current_user.role not in allowed_roles and current_user.role != Role.super_admin:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
            return await func(*args, **kwargs)
        return wrapper
    return decorator

# Example of fine-grained permission logic if needed
def require_permission(permission: str):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            current_user: User = kwargs.get('current_user')
            if not current_user:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not authenticated")
            # Implement detailed permission lookup logic here
            # For now, we delegate to roles
            return await func(*args, **kwargs)
        return wrapper
    return decorator
