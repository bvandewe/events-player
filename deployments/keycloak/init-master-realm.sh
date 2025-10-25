#!/bin/bash
# Initialize Keycloak master realm to disable SSL requirement for development

echo "Waiting for Keycloak to be ready..."
until curl -s http://localhost:8080/health/ready | grep -q '"status":"UP"'; do
  sleep 2
done

echo "Keycloak is ready. Configuring master realm..."

# Configure kcadm credentials
/opt/keycloak/bin/kcadm.sh config credentials \
  --server http://localhost:8080 \
  --realm master \
  --user "${KEYCLOAK_ADMIN}" \
  --password "${KEYCLOAK_ADMIN_PASSWORD}"

# Update master realm to disable SSL requirement
/opt/keycloak/bin/kcadm.sh update realms/master -s sslRequired=NONE

echo "Master realm configured successfully!"
