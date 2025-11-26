#!/bin/bash
# Keycloak entrypoint wrapper to auto-configure master realm for development

# Start Keycloak in the background
/opt/keycloak/bin/kc.sh "$@" &
KC_PID=$!

# Wait for Keycloak to be ready
echo "Waiting for Keycloak to start..."
MAX_ATTEMPTS=60
ATTEMPT=0

# Use exec to test TCP connection to port 8080
until exec 3<>/dev/tcp/localhost/8080 2>/dev/null && echo -e "GET /realms/master HTTP/1.0\r\nHost: localhost\r\n\r\n" >&3 && grep -q "HTTP/" <&3 2>/dev/null; do
  exec 3<&- 2>/dev/null  # Close connection if open
  ATTEMPT=$((ATTEMPT + 1))
  if [ $ATTEMPT -gt $MAX_ATTEMPTS ]; then
    echo "Keycloak failed to start within expected time"
    break
  fi
  if ! kill -0 $KC_PID 2>/dev/null; then
    echo "Keycloak process died!"
    exit 1
  fi
  sleep 1
done

if [ $ATTEMPT -le $MAX_ATTEMPTS ]; then
  echo "Keycloak is ready. Configuring master realm for HTTP access..."

  # Configure kcadm credentials
  /opt/keycloak/bin/kcadm.sh config credentials \
    --server http://localhost:8080 \
    --realm master \
    --user "${KC_BOOTSTRAP_ADMIN_USERNAME:-admin}" \
    --password "${KC_BOOTSTRAP_ADMIN_PASSWORD:-admin}" \
    > /dev/null 2>&1

  # Update master realm to disable SSL requirement
  /opt/keycloak/bin/kcadm.sh update realms/master -s sslRequired=NONE \
    && echo "✓ Master realm configured to allow HTTP access" \
    || echo "✗ Failed to configure master realm"
fi

# Bring Keycloak to foreground
wait $KC_PID
