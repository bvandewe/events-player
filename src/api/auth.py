"""
Authentication and Authorization Module

This module provides OAuth/OIDC authentication for the CloudEvents Player.
It supports two deployment modes:
1. Kubernetes with Istio: JWT pre-injected by Istio
2. Local Development: OAuth flow with any OIDC-compliant identity provider

Features:
- JWT validation (RS256 signature verification)
- Optional authentication (doesn't block public endpoints)
- Role-based access control (admin, operator, user)
- OAuth code exchange for OAuth mode
- Auto-detection of authentication mode
"""

import logging
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from functools import lru_cache

import httpx
from jose import jwt, jwk
from jose.exceptions import JWTError, JWKError, ExpiredSignatureError, JWTClaimsError
from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from .settings import settings

logger = logging.getLogger(__name__)

# Security scheme for dependency injection
security = HTTPBearer(auto_error=False)


class JWTValidator:
    """
    JWT validation and user information extraction.

    Validates JWT tokens using JWKS (JSON Web Key Set) from the configured
    identity provider (Keycloak or Istio).
    """

    def __init__(self):
        self._jwks_cache: Optional[Dict[str, Any]] = None
        self._jwks_cache_time: Optional[datetime] = None
        self._jwks_cache_ttl = timedelta(minutes=5)  # Cache JWKS for 5 minutes

    @lru_cache(maxsize=1)
    def _get_jwks_url(self) -> str:
        """Get JWKS URL from settings."""
        return settings.get_auth_jwks_url()

    async def _fetch_jwks(self) -> Dict[str, Any]:
        """
        Fetch JWKS (JSON Web Key Set) from the identity provider.

        Returns:
            Dict containing the JWKS keys

        Raises:
            HTTPException: If JWKS cannot be fetched
        """
        # Check cache first
        if (
            self._jwks_cache is not None
            and self._jwks_cache_time is not None
            and datetime.now() - self._jwks_cache_time < self._jwks_cache_ttl
        ):
            return self._jwks_cache

        jwks_url = self._get_jwks_url()
        if not jwks_url:
            raise HTTPException(
                status_code=500,
                detail="JWKS URL not configured. Set AUTH_JWKS_URL environment variable.",
            )

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(jwks_url, timeout=10.0)
                response.raise_for_status()
                jwks_data = response.json()

                # Cache the JWKS
                self._jwks_cache = jwks_data
                self._jwks_cache_time = datetime.now()

                # Log available key IDs for troubleshooting
                available_kids = [key.get("kid", "unknown") for key in jwks_data.get("keys", [])]
                logger.info(f"Fetched JWKS from {jwks_url}")
                logger.debug(f"Available key IDs (kid): {available_kids}")
                return jwks_data

        except httpx.HTTPError as e:
            logger.error(f"Failed to fetch JWKS from {jwks_url}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to fetch JWKS: {str(e)}")

    def _get_signing_key(self, token: str, jwks: Dict[str, Any]) -> Optional[str]:
        """
        Extract the signing key from JWKS that matches the token's key ID.

        Args:
            token: JWT token string
            jwks: JWKS dictionary containing keys

        Returns:
            Signing key as PEM string, or None if not found
        """
        try:
            # Decode header without verification to get kid (key ID)
            unverified_header = jwt.get_unverified_header(token)
            kid = unverified_header.get("kid")

            if not kid:
                logger.warning("Token does not have 'kid' in header")
                return None

            # Find the matching key in JWKS
            for key in jwks.get("keys", []):
                if key.get("kid") == kid:
                    # Convert JWK to PEM format
                    try:
                        return jwk.construct(key).to_pem().decode("utf-8")
                    except (JWKError, AttributeError) as e:
                        logger.error(f"Failed to construct key: {e}")
                        return None

            # Log available keys for troubleshooting
            available_kids = [key.get("kid", "unknown") for key in jwks.get("keys", [])]
            logger.warning(
                f"No matching key found for kid: {kid}. "
                f"Available kids in JWKS: {available_kids}. "
                f"This may indicate a key rotation or token from a different issuer."
            )
            return None

        except JWTError as e:
            logger.error(f"Failed to decode token header: {e}")
            return None

    async def validate_token(self, token: str) -> Dict[str, Any]:
        """
        Validate JWT token and extract user information.

        Supports two modes:
        1. Full validation (default): Verifies signature, issuer, audience, expiry
        2. Trust mode (AUTH_TRUST_MODE=true): Only decodes token without verification
           (use when Istio/service mesh has already validated the token)

        Args:
            token: JWT token string

        Returns:
            Dict containing user information:
            {
                "sub": "user-id",
                "email": "user@example.com",
                "username": "username",
                "roles": ["admin", "operator"],
                "exp": 1234567890,
                ...
            }

        Raises:
            HTTPException: If token is invalid
        """
        try:
            # Trust mode: Skip verification (for Istio/service mesh scenarios)
            if settings.auth_trust_mode:
                logger.info("Trust mode enabled - decoding token without verification")
                # Decode without verification - skip all validations
                # Note: python-jose requires a key parameter even when not verifying,
                # so we pass an empty string
                options = {
                    "verify_signature": False,
                    "verify_exp": False,
                    "verify_nbf": False,
                    "verify_iat": False,
                    "verify_aud": False,
                    "verify_iss": False,
                    "verify_at_hash": False,  # Skip at_hash validation (OpenID Connect)
                }
                payload = jwt.decode(token, "", options=options)
                logger.info("Trust mode: Token decoded successfully")
                logger.debug(f"Trust mode token payload keys: {list(payload.keys())}")
                return payload

            # Standard mode: Full JWT validation
            # Fetch JWKS
            jwks = await self._fetch_jwks()

            # Get signing key
            signing_key = self._get_signing_key(token, jwks)

            # If key not found, invalidate cache and try one more time
            # This handles key rotation scenarios where the token is signed with a new key
            if not signing_key:
                logger.info("Signing key not found in cached JWKS, refreshing JWKS cache...")
                self._jwks_cache = None  # Invalidate cache
                self._jwks_cache_time = None
                jwks = await self._fetch_jwks()  # Fetch fresh JWKS
                signing_key = self._get_signing_key(token, jwks)

                if not signing_key:
                    raise HTTPException(
                        status_code=401,
                        detail="Unable to find signing key for token. "
                        "This may indicate: 1) Token from a different issuer/realm, "
                        "2) Key rotation occurred and token is outdated, "
                        "3) Token was issued before keys were rotated. "
                        "Please try logging out and logging in again. "
                        "Or set AUTH_TRUST_MODE=true if running behind Istio/service mesh.",
                    )

            # Validate and decode token
            options = {
                "verify_signature": True,
                "verify_exp": True,
                "verify_nbf": True,
                "verify_iat": True,
                "verify_aud": settings.auth_audience != "",
            }

            auth_issuer = settings.get_auth_issuer()
            payload = jwt.decode(
                token,
                signing_key,
                algorithms=[settings.auth_algorithm],
                issuer=auth_issuer if auth_issuer else None,
                audience=settings.auth_audience if settings.auth_audience else None,
                options=options,
            )

            logger.debug(f"Token validated for user: {payload.get('sub', 'unknown')}")
            return payload

        except ExpiredSignatureError:
            logger.warning("Token has expired")
            raise HTTPException(status_code=401, detail="Token has expired")
        except JWTClaimsError as e:
            logger.warning(f"Invalid token claims: {e}")
            raise HTTPException(status_code=401, detail=f"Invalid token claims: {str(e)}")
        except JWTError as e:
            logger.error(f"JWT validation error: {e}")
            raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error validating token: {e}")
            raise HTTPException(status_code=401, detail="Invalid token")

    def extract_user_info(self, token_payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extract standardized user information from JWT payload.

        Supports both OAuth/OIDC and Istio token formats.

        Args:
            token_payload: Decoded JWT payload

        Returns:
            Dict with standardized user info:
            {
                "user_id": "...",
                "email": "...",
                "username": "...",
                "first_name": "...",
                "last_name": "...",
                "roles": ["admin", "operator"],
                "groups": ["admins"],
                "token_expiry": 1234567890
            }
        """
        # Extract roles from various possible claim locations
        roles = []

        # OAuth/OIDC format: realm_roles or realm_access.roles
        if "realm_roles" in token_payload:
            roles = token_payload["realm_roles"]
            logger.debug(f"Roles extracted from 'realm_roles': {len(roles)} role(s)")
        elif "realm_access" in token_payload and "roles" in token_payload["realm_access"]:
            roles = token_payload["realm_access"]["roles"]
            logger.debug(f"Roles extracted from 'realm_access.roles': {len(roles)} role(s)")

        # Istio format: groups
        elif "groups" in token_payload:
            roles = token_payload["groups"]
            logger.debug(f"Roles extracted from 'groups': {len(roles)} role(s)")

        # Generic roles claim
        elif "roles" in token_payload:
            roles = token_payload["roles"]
            logger.debug(f"Roles extracted from 'roles': {len(roles)} role(s)")
        else:
            logger.warning(
                f"No roles found in token. Available claims: {list(token_payload.keys())}"
            )

        # Ensure roles is a list
        if not isinstance(roles, list):
            roles = [roles] if roles else []

        # Extract groups
        groups = token_payload.get("groups", [])
        if not isinstance(groups, list):
            groups = [groups] if groups else []

        # Build standardized user info
        user_info = {
            "user_id": token_payload.get("sub", ""),
            "email": token_payload.get("email", ""),
            "username": token_payload.get("preferred_username", token_payload.get("username", "")),
            "first_name": token_payload.get("given_name", ""),
            "last_name": token_payload.get("family_name", ""),
            "full_name": token_payload.get("name", ""),
            "roles": roles,
            "groups": groups,
            "token_expiry": token_payload.get("exp", 0),
            "issuer": token_payload.get("iss", ""),
        }

        # Generate full name if not present
        if not user_info["full_name"] and (user_info["first_name"] or user_info["last_name"]):
            user_info["full_name"] = f"{user_info['first_name']} {user_info['last_name']}".strip()

        # Use email as username if username not present
        if not user_info["username"] and user_info["email"]:
            user_info["username"] = user_info["email"].split("@")[0]

        logger.debug(
            f"User info extracted: {len(user_info['roles'])} role(s), {len(user_info['groups'])} group(s)"
        )

        return user_info


# Global JWT validator instance
jwt_validator = JWTValidator()


async def auth_middleware(request: Request, call_next):
    """
    Authentication middleware that extracts and validates JWT tokens.

    This middleware:
    1. Extracts Authorization header (if present)
    2. Validates JWT token (if present)
    3. Injects user info into request.state.user
    4. Continues without blocking if no token (optional auth)

    The middleware does not block requests without authentication unless
    a specific endpoint requires it via dependency injection.
    """
    # Initialize user as None (unauthenticated)
    request.state.user = None

    # Skip auth for health checks and public endpoints
    if request.url.path in [
        "/health",
        "/api/health",
        "/api/docs",
        "/api/redoc",
        "/api/v1/oas.json",
    ]:
        return await call_next(request)

    # Extract Authorization header
    auth_header = request.headers.get("authorization", "")

    if auth_header and auth_header.lower().startswith("bearer "):
        token = auth_header[7:]  # Remove "Bearer " prefix

        try:
            # Validate token and extract user info
            token_payload = await jwt_validator.validate_token(token)
            user_info = jwt_validator.extract_user_info(token_payload)

            # Inject user info into request state
            request.state.user = user_info

            logger.debug(f"Request authenticated: {len(user_info['roles'])} role(s)")

        except HTTPException as e:
            # Token validation failed
            logger.warning(f"Token validation failed: {e.detail}")

            # If auth is required globally, raise the exception
            if settings.auth_required:
                return await call_next(request)  # Will be caught by dependency

            # Otherwise, continue without user (optional auth)
            request.state.user = None

        except Exception as e:
            logger.error(f"Unexpected error in auth middleware: {e}")
            request.state.user = None

    # Continue processing request
    response = await call_next(request)
    return response


# Dependency Injection Functions


async def get_current_user_optional(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Optional[Dict[str, Any]]:
    """
    Dependency that returns the current user if authenticated, None otherwise.

    Use this for endpoints that enhance functionality for authenticated users
    but still work without authentication.

    Example:
        @router.get("/api/events")
        async def list_events(user: Optional[Dict] = Depends(get_current_user_optional)):
            if user:
                # Return private events too
                ...
            else:
                # Return only public events
                ...
    """
    # If auth is not required, return a mock admin user
    if not settings.auth_required:
        return {
            "user_id": "anonymous",
            "username": "anonymous",
            "email": "anonymous@localhost",
            "full_name": "Anonymous User",
            "roles": [
                settings.auth_role_admin,
                settings.auth_role_operator,
                settings.auth_role_user,
            ],
            "groups": [],
        }

    # First check if user was set by middleware
    user = getattr(request.state, "user", None)

    # If no user from middleware but credentials provided, try to validate
    if user is None and credentials:
        try:
            token = credentials.credentials
            token_payload = await jwt_validator.validate_token(token)
            user = jwt_validator.extract_user_info(token_payload)
        except Exception as e:
            logger.debug(f"Failed to validate token from Authorization header: {e}")
            user = None

    return user


async def get_current_user_required(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Dict[str, Any]:
    """
    Dependency that requires authentication.

    Raises HTTPException(401) if user is not authenticated.

    Example:
        @router.post("/api/events")
        async def create_event(
            event: Event,
            user: Dict = Depends(get_current_user_required)
        ):
            # Only authenticated users can create events
            ...
    """
    user = await get_current_user_optional(request, credentials)
    if user is None:
        raise HTTPException(
            status_code=401,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


async def require_role(
    required_roles: List[str],
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Dict[str, Any]:
    """
    Dependency that requires specific roles.

    Raises HTTPException(403) if user doesn't have any of the required roles.

    Args:
        required_roles: List of acceptable roles
        request: FastAPI request
        credentials: Authorization credentials

    Returns:
        User info dict
    """
    user = await get_current_user_required(request, credentials)
    user_roles = user.get("roles", [])

    # Check if user has any of the required roles
    if not any(role in user_roles for role in required_roles):
        logger.warning(
            f"Access denied: User has {len(user_roles)} role(s), "
            f"requires one of: {required_roles}"
        )
        raise HTTPException(
            status_code=403,
            detail=f"Insufficient permissions. Required roles: {', '.join(required_roles)}",
        )

    return user


async def require_admin(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Dict[str, Any]:
    """
    Dependency that requires 'admin' role.

    Example:
        @router.delete("/api/events/{id}")
        async def delete_event(id: str, user: Dict = Depends(require_admin)):
            # Only admins can delete
            ...
    """
    return await require_role([settings.auth_role_admin], request, credentials)


async def require_operator(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Dict[str, Any]:
    """
    Dependency that requires 'operator' or 'admin' role.

    Example:
        @router.put("/api/events/{id}")
        async def update_event(
            id: str,
            event: Event,
            user: Dict = Depends(require_operator)
        ):
            # Operators and admins can update
            ...
    """
    return await require_role(
        [settings.auth_role_operator, settings.auth_role_admin], request, credentials
    )


# OAuth Token Exchange


async def exchange_oauth_code(code: str, redirect_uri: str, code_verifier: str) -> Dict[str, Any]:
    """
    Exchange OAuth authorization code for access token.

    This is used in OAuth mode to complete the OAuth flow.

    Args:
        code: Authorization code from OAuth callback
        redirect_uri: Redirect URI used in the authorization request
        code_verifier: PKCE code verifier generated during login

    Returns:
        Dict containing:
        {
            "access_token": "...",
            "refresh_token": "...",
            "expires_in": 300,
            "token_type": "Bearer"
        }

    Raises:
        HTTPException: If token exchange fails
    """
    if not settings.oauth_server_url or not settings.oauth_realm:
        raise HTTPException(status_code=500, detail="OAuth server not configured for OAuth flow")

    token_endpoint = (
        f"{settings.oauth_base_url_backend}/realms/{settings.oauth_realm}"
        f"/protocol/openid-connect/token"
    )

    # Prepare token request
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": redirect_uri,
        "client_id": settings.oauth_client_id,
        "code_verifier": code_verifier,  # PKCE code verifier
    }

    # Add client secret if configured
    if settings.oauth_client_secret:
        data["client_secret"] = settings.oauth_client_secret

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                token_endpoint,
                data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=10.0,
            )

            if response.status_code != 200:
                logger.error(f"Token exchange failed: {response.status_code} - {response.text}")
                raise HTTPException(
                    status_code=400, detail=f"Token exchange failed: {response.text}"
                )

            token_data = response.json()
            logger.info("OAuth code exchange successful")
            return token_data

    except httpx.HTTPError as e:
        logger.error(f"HTTP error during token exchange: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to exchange token: {str(e)}")


async def refresh_access_token(refresh_token: str) -> Dict[str, Any]:
    """
    Refresh the access token using a refresh token.

    This is used to obtain a new access token without requiring the user
    to log in again.

    Args:
        refresh_token: The refresh token obtained from the initial OAuth flow

    Returns:
        Dict containing:
        {
            "access_token": "...",
            "refresh_token": "...",  # Optional, may be a new refresh token
            "expires_in": 300,
            "token_type": "Bearer"
        }

    Raises:
        HTTPException: If token refresh fails
    """
    if not settings.oauth_server_url or not settings.oauth_realm:
        raise HTTPException(status_code=500, detail="OAuth server not configured for token refresh")

    token_endpoint = (
        f"{settings.oauth_base_url_backend}/realms/{settings.oauth_realm}"
        f"/protocol/openid-connect/token"
    )

    # Prepare token refresh request
    data = {
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
        "client_id": settings.oauth_client_id,
    }

    # Add client secret if configured
    if settings.oauth_client_secret:
        data["client_secret"] = settings.oauth_client_secret

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                token_endpoint,
                data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=10.0,
            )

            if response.status_code != 200:
                logger.error(f"Token refresh failed: {response.status_code} - {response.text}")
                raise HTTPException(
                    status_code=401, detail=f"Token refresh failed: {response.text}"
                )

            token_data = response.json()
            logger.info("Token refresh successful")
            return token_data

    except httpx.HTTPError as e:
        logger.error(f"HTTP error during token refresh: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to refresh token: {str(e)}")
