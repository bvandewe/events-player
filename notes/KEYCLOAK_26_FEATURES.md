# Keycloak 26 Features & Relevance

## Overview

Analysis of Keycloak 26 features and their relevance to the Event Player application.

## Implemented Features

- **Bootstrap Admin**: Updated `docker-compose.debug.yml` and `entrypoint-wrapper.sh` to use `KC_BOOTSTRAP_ADMIN_USERNAME` and `KC_BOOTSTRAP_ADMIN_PASSWORD`.
- **Hostname v2**: Updated `docker-compose.debug.yml` to use `KC_HOSTNAME`, `KC_HOSTNAME_ADMIN`, and `KC_PROXY_HEADERS`.

## Reviewed Features (No Action Needed)

- **Keycloak JS Adapter**: Keycloak 26 introduces breaking changes (async login), but the Event Player uses a custom OIDC implementation in `src/ui/js/auth/auth.js`, so these changes do not affect us.
- **OIDC Endpoints**: The application uses standard `/protocol/openid-connect/auth` and `/protocol/openid-connect/token` endpoints, which remain supported.
- **UTF-8 Encoding**: Internal change, transparent to the application.

## Other Relevant Features

- **Observability**: Keycloak 26 continues to improve metrics and health checks. We are already using `KC_METRICS_ENABLED=true` and `KC_HEALTH_ENABLED=true`.
- **Quarkus Distribution**: Keycloak 26 is based on Quarkus, offering faster startup and lower memory footprint compared to the legacy WildFly distribution.
