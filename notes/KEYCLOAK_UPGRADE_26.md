# Keycloak Upgrade to 26.0.0

## Overview

Upgraded Keycloak from 22.0.5 to 26.0.0.

## Changes

### docker-compose.debug.yml

- Updated image to `quay.io/keycloak/keycloak:26.0.0`.
- Updated environment variables for Hostname v2 configuration (Keycloak 25+):
  - `KC_HOSTNAME_URL` -> `KC_HOSTNAME`
  - `KC_HOSTNAME_ADMIN_URL` -> `KC_HOSTNAME_ADMIN`
  - Removed `KC_PROXY` (deprecated).
  - Added `KC_PROXY_HEADERS: "xforwarded"` (replacement for `KC_PROXY=edge/reencrypt/etc`).

## Verification

- The `entrypoint-wrapper.sh` script should still work as it uses standard `kcadm.sh` commands.
- The health check in `docker-compose.debug.yml` uses `/health/ready` which is standard.
- The realm import should be compatible.

## Notes

- Keycloak 26 uses "Hostname v2" configuration by default.
- `KC_HOSTNAME` now accepts a full URL (e.g. `http://localhost:8885`).
- `KC_HOSTNAME_STRICT=false` is important for development to allow access from localhost.
