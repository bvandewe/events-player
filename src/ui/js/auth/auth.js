/**
 * Authentication Manager for CloudEvents Player
 * 
 * Supports two authentication modes:
 * 1. Istio Mode: JWT pre-injected by Istio (auto-detected)
 * 2. Keycloak Mode: OAuth 2.0 + OIDC flow with Keycloak
 * 
 * Features:
 * - Auto-detection of authentication mode
 * - OAuth PKCE flow for security
 * - Token storage in sessionStorage
 * - Automatic token validation
 * - User info extraction
 */

class AuthManager {
    constructor() {
        this.token = null;
        this.userInfo = null;
        this.keycloakConfig = null;
        this.mode = null; // 'istio' | 'keycloak' | 'none'
    }

    /**
     * Initialize the authentication manager
     * 
     * This method:
     * 1. Checks for existing token in sessionStorage
     * 2. Checks if server already has JWT (Istio mode)
     * 3. Checks if Keycloak is configured
     * 4. Handles OAuth callback if present
     */
    async init() {
        console.log('[Auth] Initializing authentication manager...');

        // 1. Check for existing JWT in sessionStorage
        this.token = sessionStorage.getItem('access_token');

        if (this.token) {
            console.log('[Auth] Found token in sessionStorage, validating...');
            try {
                await this.validateToken(this.token);
                if (this.userInfo) {
                    console.log('[Auth] Token valid, user authenticated:', this.userInfo.username);
                    this.mode = 'authenticated';
                    this.renderAuthUI();
                    return;
                }
            } catch (error) {
                console.warn('[Auth] Stored token invalid, removing:', error);
                sessionStorage.removeItem('access_token');
                this.token = null;
            }
        }

        // 2. Check if we're in Istio mode (JWT already validated by server)
        try {
            const response = await fetch('/api/auth/info');
            if (response.ok) {
                const data = await response.json();
                if (data.authenticated) {
                    console.log('[Auth] Istio mode detected, user pre-authenticated:', data.user.username);
                    this.userInfo = data.user;
                    this.mode = 'istio';
                    this.renderAuthUI();
                    return;
                }

                // Store Keycloak config if available
                if (data.keycloak_config && data.keycloak_config.url) {
                    this.keycloakConfig = data.keycloak_config;
                    this.mode = 'keycloak';
                    console.log('[Auth] Keycloak mode configured');
                } else {
                    this.mode = 'none';
                    console.log('[Auth] No authentication configured');
                }
            }
        } catch (error) {
            console.warn('[Auth] Failed to check auth info:', error);
            this.mode = 'none';
        }

        // 3. Check for OAuth callback
        if (this.mode === 'keycloak') {
            await this.handleOAuthCallback();
        }

        // Render UI
        this.renderAuthUI();
    }

    /**
     * Validate token with the server
     */
    async validateToken(token) {
        try {
            const response = await fetch('/api/auth/info', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.authenticated) {
                    this.userInfo = data.user;
                    return true;
                }
            }
            return false;
        } catch (error) {
            console.error('[Auth] Token validation error:', error);
            return false;
        }
    }

    /**
     * Generate a random string for OAuth state parameter
     */
    generateRandomState() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Generate PKCE code verifier and challenge
     */
    async generatePKCE() {
        // Generate code verifier
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        const codeVerifier = btoa(String.fromCharCode(...array))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');

        // Generate code challenge from verifier
        const encoder = new TextEncoder();
        const data = encoder.encode(codeVerifier);
        const hash = await crypto.subtle.digest('SHA-256', data);
        const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');

        return { codeVerifier, codeChallenge };
    }

    /**
     * Initiate OAuth login flow
     */
    async login() {
        if (this.mode !== 'keycloak') {
            console.warn('[Auth] Login not available in current mode:', this.mode);
            return;
        }

        console.log('[Auth] Initiating OAuth login flow...');

        // Generate state and PKCE
        const state = this.generateRandomState();
        const { codeVerifier, codeChallenge } = await this.generatePKCE();

        // Store state and code verifier for callback
        sessionStorage.setItem('oauth_state', state);
        sessionStorage.setItem('oauth_code_verifier', codeVerifier);

        // Build authorization URL
        const params = new URLSearchParams({
            client_id: this.keycloakConfig.client_id,
            response_type: 'code',
            redirect_uri: window.location.origin + '/',
            state: state,
            scope: 'openid profile email',
            code_challenge: codeChallenge,
            code_challenge_method: 'S256'
        });

        const authUrl = `${this.keycloakConfig.url}/realms/${this.keycloakConfig.realm}/protocol/openid-connect/auth?${params}`;

        console.log('[Auth] Redirecting to Keycloak login...');
        window.location.href = authUrl;
    }

    /**
     * Handle OAuth callback after redirect from Keycloak
     */
    async handleOAuthCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const error = urlParams.get('error');

        if (error) {
            console.error('[Auth] OAuth error:', error, urlParams.get('error_description'));
            alert(`Login failed: ${error}`);
            // Clean URL
            window.history.replaceState({}, document.title, '/');
            return;
        }

        if (!code) {
            return; // Not a callback
        }

        console.log('[Auth] Processing OAuth callback...');

        // Validate state
        const savedState = sessionStorage.getItem('oauth_state');
        if (state !== savedState) {
            console.error('[Auth] OAuth state mismatch - possible CSRF attack');
            alert('Login failed: security check failed');
            window.history.replaceState({}, document.title, '/');
            return;
        }

        // Get code verifier from storage
        const codeVerifier = sessionStorage.getItem('oauth_code_verifier');
        if (!codeVerifier) {
            console.error('[Auth] Code verifier not found - PKCE flow incomplete');
            alert('Login failed: security check failed');
            window.history.replaceState({}, document.title, '/');
            return;
        }

        try {
            // Exchange code for token
            const response = await fetch('/api/auth/callback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    code: code,
                    redirect_uri: window.location.origin + '/',
                    code_verifier: codeVerifier
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Token exchange failed');
            }

            const data = await response.json();

            // Store token
            this.token = data.access_token;
            sessionStorage.setItem('access_token', this.token);

            // Store user info
            this.userInfo = data.user_info;
            this.mode = 'authenticated';

            console.log('[Auth] OAuth login successful:', this.userInfo.username);

            // Clean up OAuth state
            sessionStorage.removeItem('oauth_state');
            sessionStorage.removeItem('oauth_code_verifier');
            sessionStorage.removeItem('oauth_code_verifier');

            // Clean URL
            window.history.replaceState({}, document.title, '/');

            // Render UI
            this.renderAuthUI();

        } catch (error) {
            console.error('[Auth] OAuth callback failed:', error);
            alert(`Login failed: ${error.message}`);
            window.history.replaceState({}, document.title, '/');
        }
    }

    /**
     * Logout user
     */
    logout() {
        console.log('[Auth] Logging out...');

        // Clear token and user info
        this.token = null;
        this.userInfo = null;
        sessionStorage.removeItem('access_token');

        if (this.mode === 'keycloak' && this.keycloakConfig) {
            // Redirect to Keycloak logout
            const logoutUrl = `${this.keycloakConfig.url}/realms/${this.keycloakConfig.realm}/protocol/openid-connect/logout?redirect_uri=${encodeURIComponent(window.location.origin)}`;
            window.location.href = logoutUrl;
        } else {
            // Just reload the page
            window.location.reload();
        }
    }

    /**
     * Get Authorization headers for API calls
     */
    getAuthHeaders() {
        if (this.token) {
            return {
                'Authorization': `Bearer ${this.token}`
            };
        }
        return {};
    }

    /**
     * Check if user has a specific role
     */
    hasRole(role) {
        if (!this.userInfo || !this.userInfo.roles) {
            return false;
        }
        return this.userInfo.roles.includes(role);
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return this.userInfo !== null;
    }

    /**
     * Render authentication UI
     */
    renderAuthUI() {
        const authContainer = document.getElementById('authContainer');
        if (!authContainer) {
            console.warn('[Auth] authContainer not found in DOM');
            return;
        }

        // Clear existing content
        authContainer.innerHTML = '';

        if (this.isAuthenticated()) {
            // Show user info
            const userDiv = document.createElement('div');
            userDiv.className = 'auth-user-info';

            // Create dropdown
            const dropdown = document.createElement('div');
            dropdown.className = 'dropdown';

            const button = document.createElement('button');
            button.className = 'btn btn-outline-secondary dropdown-toggle';
            button.setAttribute('data-bs-toggle', 'dropdown');
            button.setAttribute('aria-expanded', 'false');

            // User icon
            const icon = document.createElement('i');
            icon.className = 'bi bi-person-circle me-2';
            button.appendChild(icon);

            // Username
            const username = document.createElement('span');
            username.textContent = this.userInfo.username || this.userInfo.email || 'User';
            button.appendChild(username);

            // Role badges
            if (this.userInfo.roles && this.userInfo.roles.length > 0) {
                const rolesSpan = document.createElement('span');
                rolesSpan.className = 'ms-2';

                this.userInfo.roles.forEach(role => {
                    const badge = document.createElement('span');
                    badge.className = `badge rounded-pill ${this.getRoleBadgeClass(role)} ms-1`;
                    badge.textContent = role;
                    rolesSpan.appendChild(badge);
                });

                button.appendChild(rolesSpan);
            }

            dropdown.appendChild(button);

            // Dropdown menu
            const menu = document.createElement('ul');
            menu.className = 'dropdown-menu dropdown-menu-end';

            // User email
            if (this.userInfo.email) {
                const emailItem = document.createElement('li');
                const emailSpan = document.createElement('span');
                emailSpan.className = 'dropdown-item-text small text-muted';
                emailSpan.textContent = this.userInfo.email;
                emailItem.appendChild(emailSpan);
                menu.appendChild(emailItem);

                const divider = document.createElement('li');
                const hr = document.createElement('hr');
                hr.className = 'dropdown-divider';
                divider.appendChild(hr);
                menu.appendChild(divider);
            }

            // Logout button
            const logoutItem = document.createElement('li');
            const logoutLink = document.createElement('a');
            logoutLink.className = 'dropdown-item';
            logoutLink.href = '#';
            logoutLink.onclick = (e) => {
                e.preventDefault();
                this.logout();
            };

            const logoutIcon = document.createElement('i');
            logoutIcon.className = 'bi bi-box-arrow-right me-2';
            logoutLink.appendChild(logoutIcon);
            logoutLink.appendChild(document.createTextNode('Logout'));
            logoutItem.appendChild(logoutLink);
            menu.appendChild(logoutItem);

            dropdown.appendChild(menu);
            userDiv.appendChild(dropdown);
            authContainer.appendChild(userDiv);

        } else if (this.mode === 'keycloak') {
            // Show login button
            const loginButton = document.createElement('button');
            loginButton.className = 'btn btn-primary';
            loginButton.onclick = () => this.login();

            const icon = document.createElement('i');
            icon.className = 'bi bi-box-arrow-in-right me-2';
            loginButton.appendChild(icon);
            loginButton.appendChild(document.createTextNode('Login'));

            authContainer.appendChild(loginButton);
        }

        // Show the container
        authContainer.classList.remove('d-none');
    }

    /**
     * Get Bootstrap badge class for role
     */
    getRoleBadgeClass(role) {
        const roleClasses = {
            'admin': 'bg-danger',
            'operator': 'bg-warning text-dark',
            'user': 'bg-info text-dark'
        };
        return roleClasses[role] || 'bg-secondary';
    }
}

// Create and export global instance
export const authManager = new AuthManager();
