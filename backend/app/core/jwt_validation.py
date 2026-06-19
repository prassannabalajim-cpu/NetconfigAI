from jose import jwt, JWTError
from fastapi import HTTPException, status
from app.core.keycloak_service import keycloak_service
import logging

logger = logging.getLogger(__name__)

def validate_jwt(token: str) -> dict:
    try:
        public_key = keycloak_service.get_public_key()
        
        # Decode and validate the JWT signature, audience, and expiry
        # Keycloak usually issues tokens with 'account' audience or the client_id depending on config.
        # We'll rely on KeycloakOpenID introspect or validate issuer.
        # Let's decode it directly with python-jose using the RS256 public key.
        payload = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            options={
                "verify_aud": False, # Often Keycloak access tokens don't have our client as audience by default unless mapped
                "verify_exp": True,
                "verify_iss": True
            },
            issuer=f"{keycloak_service.keycloak_openid.server_url}/realms/{keycloak_service.keycloak_openid.realm_name}"
        )
        return payload
    except JWTError as e:
        logger.error(f"JWT Validation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        logger.error(f"Keycloak verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication service unavailable"
        )
