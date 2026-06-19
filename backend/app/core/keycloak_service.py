import os
from keycloak import KeycloakOpenID
from fastapi import HTTPException, status
import logging

logger = logging.getLogger(__name__)

# Config from environment variables
KEYCLOAK_SERVER_URL = os.getenv("KEYCLOAK_SERVER_URL", "http://localhost:8080")
KEYCLOAK_REALM = os.getenv("KEYCLOAK_REALM", "netconfig-realm")
KEYCLOAK_CLIENT_ID = os.getenv("KEYCLOAK_CLIENT_ID", "netconfig-frontend")
KEYCLOAK_CLIENT_SECRET = os.getenv("KEYCLOAK_CLIENT_SECRET", "") # Usually empty for public client

class KeycloakService:
    def __init__(self):
        try:
            self.keycloak_openid = KeycloakOpenID(
                server_url=KEYCLOAK_SERVER_URL,
                client_id=KEYCLOAK_CLIENT_ID,
                realm_name=KEYCLOAK_REALM,
                client_secret_key=KEYCLOAK_CLIENT_SECRET
            )
            # Fetch the realm's public key for signature validation
            self.public_key = (
                "-----BEGIN PUBLIC KEY-----\n"
                + self.keycloak_openid.public_key()
                + "\n-----END PUBLIC KEY-----"
            )
        except Exception as e:
            logger.error(f"Failed to initialize KeycloakOpenID: {e}")
            self.keycloak_openid = None
            self.public_key = None

    def get_public_key(self):
        if not self.public_key:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Keycloak is not properly configured or reachable"
            )
        return self.public_key

    def introspect_token(self, token: str):
        if not self.keycloak_openid:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Keycloak service unavailable"
            )
        return self.keycloak_openid.introspect(token)

keycloak_service = KeycloakService()
