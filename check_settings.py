#!/usr/bin/env python3
"""
Diagnostic script to check authentication settings
"""
import sys

sys.path.insert(0, "src")

from api.settings import settings

print("=" * 80)
print("AUTHENTICATION CONFIGURATION DIAGNOSTIC")
print("=" * 80)

print("\n📋 RAW ENVIRONMENT SETTINGS:")
print(f"  AUTH_REQUIRED:           {settings.auth_required}")
print(
    f"  AUTH_JWKS_URL:           '{settings.auth_jwks_url}' (empty: {not settings.auth_jwks_url})"
)
print(f"  AUTH_ISSUER:             '{settings.auth_issuer}'")
print(f"  AUTH_TRUST_MODE:         {settings.auth_trust_mode}")
print(
    f"  OAUTH_SERVER_URL:        '{settings.oauth_server_url}' (empty: {not settings.oauth_server_url})"
)
print(f"  OAUTH_SERVER_URL_BACKEND: '{settings.oauth_server_url_backend}'")
print(f"  OAUTH_REALM:             '{settings.oauth_realm}'")
print(f"  OAUTH_CLIENT_ID:         '{settings.oauth_client_id}'")

print("\n🔧 DERIVED VALUES (via methods):")
print(f"  get_auth_jwks_url():     '{settings.get_auth_jwks_url()}'")
print(f"  get_auth_issuer():       '{settings.get_auth_issuer()}'")
print(f"  oauth_base_url:          '{settings.oauth_base_url}'")
print(f"  oauth_base_url_backend:  '{settings.oauth_base_url_backend}'")

print("\n🎯 MODE DETECTION LOGIC:")
print(f"  settings.auth_jwks_url:  {bool(settings.auth_jwks_url)}")
print(f"  settings.oauth_server_url: {bool(settings.oauth_server_url)}")

# Simulate the mode detection from routes.py line 138
if settings.auth_jwks_url and not settings.oauth_server_url:
    detected_mode = "istio"
elif settings.oauth_server_url:
    detected_mode = "oauth"
else:
    detected_mode = "unknown"

print(f"\n  Detected Mode (when authenticated): '{detected_mode}'")
print(
    f"  Detected Mode (when NOT authenticated): '{'oauth' if settings.oauth_server_url else 'none'}'"
)

print("\n🔍 CONFIGURATION ANALYSIS:")

if not settings.auth_required:
    print("  ⚠️  AUTH_REQUIRED=False → Authentication is DISABLED")
else:
    print("  ✅ AUTH_REQUIRED=True → Authentication is ENABLED")

    if settings.auth_jwks_url:
        print(f"  ✅ AUTH_JWKS_URL explicitly set: {settings.auth_jwks_url}")
    elif settings.get_auth_jwks_url():
        print(f"  ℹ️  AUTH_JWKS_URL auto-derived: {settings.get_auth_jwks_url()}")
    else:
        print("  ❌ No JWKS URL configured (neither explicit nor auto-derived)")

    if settings.oauth_server_url:
        print(f"  ✅ OAUTH_SERVER_URL set: {settings.oauth_server_url}")
        print(f"     → Frontend will use OAuth flow")
    else:
        print("  ℹ️  No OAUTH_SERVER_URL → Frontend expects Istio/proxy authentication")

print("\n🌐 EXPECTED BEHAVIOR:")
if detected_mode == "istio":
    print("  Mode: ISTIO")
    print("  ✓ Frontend expects user already authenticated by proxy")
    print("  ✓ No login button shown")
    print("  ✓ Token extracted from request headers")
    print("  ✓ Backend validates JWT using JWKS")
elif detected_mode == "oauth":
    print("  Mode: OAUTH")
    print("  ✓ Frontend handles OAuth flow")
    print("  ✓ Login button shown when not authenticated")
    print("  ✓ Token stored in browser sessionStorage")
    print("  ✓ Backend validates JWT using JWKS")
elif detected_mode == "unknown":
    print("  Mode: UNKNOWN")
    print("  ⚠️  This is an edge case - authentication enabled but mode unclear")
    print("  ⚠️  No JWKS URL configured for JWT validation")
else:
    print("  Mode: NONE")
    print("  ✓ No authentication required")

print("\n" + "=" * 80)
