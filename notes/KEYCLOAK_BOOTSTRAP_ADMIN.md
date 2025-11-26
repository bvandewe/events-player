# Keycloak Upgrade to 26.0.0 - Bootstrap Admin

## Overview

Updated Keycloak configuration to use the new bootstrap admin environment variables introduced in Keycloak 26.

## Changes

### docker-compose.debug.yml

- Replaced `KEYCLOAK_ADMIN` with `KC_BOOTSTRAP_ADMIN_USERNAME`.
- Replaced `KEYCLOAK_ADMIN_PASSWORD` with `KC_BOOTSTRAP_ADMIN_PASSWORD`.

### deployments/keycloak/entrypoint-wrapper.sh

- Updated `kcadm.sh` credential configuration to use `KC_BOOTSTRAP_ADMIN_USERNAME` and `KC_BOOTSTRAP_ADMIN_PASSWORD` (with defaults).

## Verification

- The `entrypoint-wrapper.sh` script will now use the new environment variables to authenticate with `kcadm.sh`.
- This ensures compatibility with the new Keycloak 26 bootstrap admin feature.
