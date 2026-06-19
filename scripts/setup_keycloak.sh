#!/bin/bash
set -e

KCADM="/opt/keycloak/bin/kcadm.sh"
KEYCLOAK_ADMIN_USER="${KEYCLOAK_ADMIN_USER:-admin}"
KEYCLOAK_ADMIN_PASSWORD="${KEYCLOAK_ADMIN_PASSWORD:-change-me}"
GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID:-}"
GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET:-}"

echo "Authenticating with Keycloak admin CLI..."
$KCADM config credentials --server http://localhost:8080 --realm master --user "$KEYCLOAK_ADMIN_USER" --password "$KEYCLOAK_ADMIN_PASSWORD"

echo "Creating netconfig-realm..."
$KCADM create realms -s realm=netconfig-realm -s enabled=true || echo "Realm already exists"

echo "Creating netconfig-frontend client..."
$KCADM create clients -r netconfig-realm \
  -s clientId=netconfig-frontend \
  -s enabled=true \
  -s publicClient=true \
  -s standardFlowEnabled=true \
  -s directAccessGrantsEnabled=true \
  -s 'redirectUris=["http://localhost:3000/*"]' \
  -s 'webOrigins=["http://localhost:3000"]' || echo "Client already exists"

echo "Configuring Google Identity Provider..."
$KCADM create identity-provider/instances -r netconfig-realm \
  -s alias=google \
  -s providerId=google \
  -s enabled=true \
  -s trustEmail=true \
  -s firstBrokerLoginFlowAlias="first broker login" \
  -s config.clientId="$GOOGLE_CLIENT_ID" \
  -s config.clientSecret="$GOOGLE_CLIENT_SECRET" || echo "Google IdP already exists"

echo "Creating Enterprise RBAC Roles..."
ROLES=("NETWORK_ENGINEER" "REVIEWER" "APPROVER" "SECURITY_MANAGER" "AUDITOR" "ADMIN")
for role in "${ROLES[@]}"; do
  $KCADM create roles -r netconfig-realm -s name=$role || echo "Role $role already exists"
done

echo "Keycloak setup completed successfully!"
