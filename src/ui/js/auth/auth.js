/**
 * Authentication Manager for CloudEvents Player
 *
 * Supports two authentication modes:
 * 1. Istio Mode: JWT pre-injected by Istio (auto-detected)
 * 2. OAuth Mode: OAuth 2.0 + OIDC flow with any OIDC-compliant IDP
 *
 * Features:
 * - Auto-detection of authentication mode
 * - OAuth PKCE flow for security
 * - Token storage in sessionStorage
 * - Automatic token validation
 * - User info extraction
 */

import * as bootstrap from 'bootstrap';
import EventStorageManager from '../storage/eventStorage.js';
import { toastController } from '../ui/toast.js';
import { actionsController } from '../ui/actions.js';

class AuthManager {
    constructor() {
        this.token = null;
        this.userInfo = null;
        this.oauthConfig = null;
        this.mode = null; // 'istio' | 'oauth' | 'none'
        this.tokenCheckInterval = null; // For periodic token validation
        this.authRequired = false; // Track if auth is required from backend
        this.roleMappings = null; // Store role mappings from backend (admin, operator, user)
        this.initialized = false; // Track if already initialized

        // Get base path from body attribute (injected by backend)
        const bodyElement = document.body;
        this.basePath = bodyElement.getAttribute('data-base-path') || '/';
        // Ensure base path ends with /
        if (!this.basePath.endsWith('/')) {
            this.basePath += '/';
        }
        console.log('[Auth] Base path:', this.basePath);
    }

    /**
     * Initialize the authentication manager
     *
     * This method:
     * 1. Checks for existing token in sessionStorage
     * 2. Checks if server already has JWT (Istio mode)
     * 3. Checks if OAuth is configured
     * 4. Handles OAuth callback if present
     */
    async init() {
        // Make init() idempotent - safe to call multiple times
        if (this.initialized) {
            console.log('[Auth] Already initialized, skipping...');
            return;
        }

        console.log('[Auth] Initializing authentication manager...');

        // 1. Check for existing JWT in sessionStorage
        this.token = sessionStorage.getItem('access_token');

        if (this.token) {
            console.log('[Auth] Found token in sessionStorage, validating...');
            const isValid = await this.validateToken(this.token);
            if (isValid && this.userInfo) {
                console.log('[Auth] ✓ Token valid, user authenticated:', this.userInfo.username);
                this.mode = 'authenticated';
                console.log('[Auth] Calling renderAuthUI() after token validation...');
                this.renderAuthUI();
                console.log('[Auth] init() returning early (authenticated via token)');
                return;
            } else {
                // Token invalid or expired, try to refresh it
                console.log('[Auth] Token validation failed, attempting refresh...');
                const refreshSuccess = await this.refreshAccessToken();
                if (refreshSuccess) {
                    console.log('[Auth] ✓ Token refreshed successfully');
                    this.mode = 'authenticated';
                    console.log('[Auth] Calling renderAuthUI() after token refresh...');
                    this.renderAuthUI();
                    console.log('[Auth] init() returning early (authenticated via refresh)');
                    return;
                } else {
                    console.warn('[Auth] Token refresh failed, clearing stored tokens');
                    sessionStorage.removeItem('access_token');
                    sessionStorage.removeItem('refresh_token');
                    this.token = null;
                }
            }
        }

        // 2. Check if we're in Istio mode (JWT already validated by server)
        // Also send any token we have in sessionStorage to check if still valid
        try {
            const headers = {};
            if (this.token) {
                headers['Authorization'] = `Bearer ${this.token}`;
            }
            const response = await fetch(this.basePath + 'api/auth/info', {
                headers: headers,
            });
            if (response.ok) {
                const data = await response.json();

                // Store auth_required status from backend
                this.authRequired = data.auth_required !== undefined ? data.auth_required : false;

                // Store role mappings from backend
                if (data.role_mappings) {
                    this.roleMappings = data.role_mappings;
                }

                if (data.authenticated) {
                    console.log('[Auth] Istio mode detected, user pre-authenticated:', data.user.username);
                    this.userInfo = data.user;
                    this.mode = 'istio';
                    this.renderAuthUI();
                    return;
                }

                // Store OAuth config if available
                if (data.oauth_config && data.oauth_config.url) {
                    this.oauthConfig = data.oauth_config;
                    this.mode = 'oauth';
                    console.log('[Auth] OAuth mode configured');
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
        if (this.mode === 'oauth') {
            await this.handleOAuthCallback();
        }

        // Render UI
        this.renderAuthUI();

        // Start periodic token validation (every 60 seconds)
        this.startTokenValidation();

        // Mark as initialized
        this.initialized = true;
        console.log('[Auth] Initialization complete');
    }

    /**
     * Start periodic token validation and proactive refresh
     */
    startTokenValidation() {
        // Clear any existing interval
        if (this.tokenCheckInterval) {
            clearInterval(this.tokenCheckInterval);
        }

        // Check token every 60 seconds
        this.tokenCheckInterval = setInterval(async () => {
            if (this.token && this.userInfo) {
                console.log('[Auth] Checking token validity...');

                // Check if token expires soon (within 5 minutes)
                const expiresAt = sessionStorage.getItem('token_expires_at');
                if (expiresAt) {
                    const timeUntilExpiry = parseInt(expiresAt) - Date.now();
                    const fiveMinutes = 5 * 60 * 1000;

                    // Proactively refresh if expiring within 5 minutes
                    if (timeUntilExpiry < fiveMinutes && timeUntilExpiry > 0) {
                        console.log('[Auth] Token expires soon, proactively refreshing...');
                        await this.refreshAccessToken();
                        return;
                    }
                }

                // Check if token is already expired
                this.isAuthenticated(); // This will trigger handleTokenExpiry if expired
            }
        }, 60000); // 60 seconds
    }

    /**
     * Stop token validation
     */
    stopTokenValidation() {
        if (this.tokenCheckInterval) {
            clearInterval(this.tokenCheckInterval);
            this.tokenCheckInterval = null;
        }
    }

    /**
     * Validate token with the server
     */
    async validateToken(token) {
        try {
            const response = await fetch(this.basePath + 'api/auth/info', {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (response.ok) {
                const data = await response.json();

                // Store auth_required status from backend
                this.authRequired = data.auth_required !== undefined ? data.auth_required : false;

                // Store role mappings from backend
                if (data.role_mappings) {
                    this.roleMappings = data.role_mappings;
                }

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
     * Refresh the access token using the refresh token
     * @returns {boolean} True if refresh successful, false otherwise
     */
    async refreshAccessToken() {
        const refreshToken = sessionStorage.getItem('refresh_token');

        if (!refreshToken) {
            console.warn('[Auth] No refresh token available');
            return false;
        }

        console.log('[Auth] Attempting to refresh access token...');

        try {
            const response = await fetch(this.basePath + 'api/auth/refresh', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    refresh_token: refreshToken,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('[Auth] Token refresh failed:', errorData);
                return false;
            }

            const data = await response.json();

            // Store new access token
            this.token = data.access_token;
            sessionStorage.setItem('access_token', this.token);

            // Update refresh token if a new one is provided
            if (data.refresh_token) {
                sessionStorage.setItem('refresh_token', data.refresh_token);
            }

            // Update token expiry time
            if (data.expires_in) {
                const expiryTime = Date.now() + data.expires_in * 1000;
                sessionStorage.setItem('token_expires_at', expiryTime.toString());
                console.log('[Auth] Token refreshed, expires at:', new Date(expiryTime).toISOString());
            }

            // Update user info if provided
            if (data.user_info) {
                this.userInfo = data.user_info;
            }

            // Re-fetch auth info to get updated role mappings
            try {
                const authInfoResponse = await fetch(this.basePath + 'api/auth/info', {
                    headers: {
                        Authorization: `Bearer ${this.token}`,
                    },
                });
                if (authInfoResponse.ok) {
                    const authInfo = await authInfoResponse.json();
                    if (authInfo.role_mappings) {
                        this.roleMappings = authInfo.role_mappings;
                    }
                    if (authInfo.user) {
                        this.userInfo = authInfo.user;
                    }
                }
            } catch (error) {
                console.warn('[Auth] Failed to fetch updated auth info after refresh:', error);
            }

            console.log('[Auth] Access token refreshed successfully');
            return true;
        } catch (error) {
            console.error('[Auth] Token refresh error:', error);
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
        if (this.mode !== 'oauth') {
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
        // Note: Regular refresh tokens are returned automatically
        const params = new URLSearchParams({
            client_id: this.oauthConfig.client_id,
            response_type: 'code',
            redirect_uri: window.location.origin + this.basePath,
            state: state,
            scope: 'openid profile email',
            code_challenge: codeChallenge,
            code_challenge_method: 'S256',
        });

        const authUrl = `${this.oauthConfig.url}/realms/${this.oauthConfig.realm}/protocol/openid-connect/auth?${params}`;

        console.log('[Auth] Redirecting to OAuth login...');
        window.location.href = authUrl;
    }

    /**
     * Handle OAuth callback after redirect from OAuth
     */
    async handleOAuthCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const error = urlParams.get('error');

        if (error) {
            console.error('[Auth] OAuth error:', error, urlParams.get('error_description'));
            actionsController.showError({
                title: 'Login Failed',
                message: `Login failed: ${error}`,
                details: urlParams.get('error_description'),
            });
            // Clean URL
            window.history.replaceState({}, document.title, this.basePath);
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
            actionsController.showError({
                title: 'Login Failed',
                message: 'Login failed: security check failed',
                details: 'OAuth state mismatch - possible CSRF attack',
            });
            window.history.replaceState({}, document.title, this.basePath);
            return;
        }

        // Get code verifier from storage
        const codeVerifier = sessionStorage.getItem('oauth_code_verifier');
        if (!codeVerifier) {
            console.error('[Auth] Code verifier not found - PKCE flow incomplete');
            actionsController.showError({
                title: 'Login Failed',
                message: 'Login failed: security check failed',
                details: 'Code verifier not found - PKCE flow incomplete',
            });
            window.history.replaceState({}, document.title, this.basePath);
            return;
        }

        try {
            // Exchange code for token
            const response = await fetch(this.basePath + 'api/auth/callback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    code: code,
                    redirect_uri: window.location.origin + this.basePath,
                    code_verifier: codeVerifier,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Token exchange failed');
            }

            const data = await response.json();

            // Store tokens
            this.token = data.access_token;
            sessionStorage.setItem('access_token', this.token);

            // Store refresh token if provided
            if (data.refresh_token) {
                sessionStorage.setItem('refresh_token', data.refresh_token);
                console.log('[Auth] Refresh token stored');
            }

            // Store token expiry time for proactive refresh
            if (data.expires_in) {
                const expiryTime = Date.now() + data.expires_in * 1000;
                sessionStorage.setItem('token_expires_at', expiryTime.toString());
                console.log('[Auth] Token expires at:', new Date(expiryTime).toISOString());
            }

            // Store user info
            this.userInfo = data.user_info;
            this.mode = 'authenticated';

            console.log('[Auth] OAuth login successful:', this.userInfo.username);

            // Clean up OAuth state
            sessionStorage.removeItem('oauth_state');
            sessionStorage.removeItem('oauth_code_verifier');
            sessionStorage.removeItem('oauth_code_verifier');

            // Clean URL
            window.history.replaceState({}, document.title, this.basePath);

            // Render UI
            this.renderAuthUI();
        } catch (error) {
            console.error('[Auth] OAuth callback failed:', error);
            actionsController.showError({
                title: 'Login Failed',
                message: `Login failed: ${error.message}`,
                error: error,
            });
            window.history.replaceState({}, document.title, this.basePath);
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
        sessionStorage.removeItem('refresh_token');
        sessionStorage.removeItem('token_expires_at');

        if (this.mode === 'oauth' && this.oauthConfig) {
            // Redirect to OAuth logout
            const logoutUrl = `${this.oauthConfig.url}/realms/${this.oauthConfig.realm}/protocol/openid-connect/logout?redirect_uri=${encodeURIComponent(window.location.origin + this.basePath)}`;
            window.location.href = logoutUrl;
        } else {
            // Just reload the page
            window.location.reload();
        }
    }

    /**
     * Clear all local storage (events and metadata)
     * Available to all users, regardless of authentication
     */
    clearStorage() {
        console.log('[Auth] Showing clear storage confirmation modal...');

        // Show the modal
        const modalElement = document.getElementById('clearStorageModal');
        if (!modalElement) {
            console.error('[Auth] Clear storage modal not found');
            actionsController.showError({
                title: 'Error',
                message: 'Modal not found. Please refresh the page.',
            });
            return;
        }

        const modal = new bootstrap.Modal(modalElement);
        modal.show();

        // Set up the confirmation button handler
        const confirmButton = document.getElementById('confirmClearStorageBtn');
        if (!confirmButton) {
            console.error('[Auth] Confirm button not found');
            return;
        }

        // Remove any existing event listeners to prevent duplicates
        const newConfirmButton = confirmButton.cloneNode(true);
        confirmButton.parentNode.replaceChild(newConfirmButton, confirmButton);

        // Add click handler
        newConfirmButton.addEventListener('click', async () => {
            console.log('[Auth] Clearing all storage...');

            try {
                // Hide the modal
                modal.hide();

                const storageManager = EventStorageManager.getInstance();
                await storageManager.clearAll();

                // Clear the UI
                const eventsStack = document.getElementById('events-stack');
                if (eventsStack) {
                    eventsStack.innerHTML = '';
                }

                // Update event count
                document.title = 'CloudEvents Player (0)';
                const eventCountElement = document.getElementById('event-count');
                if (eventCountElement) {
                    eventCountElement.textContent = '0';
                }

                // Show success toast
                const toastEl = document.getElementById('liveToast');
                if (toastEl) {
                    toastEl.classList.remove('text-bg-warning', 'text-bg-danger', 'text-bg-primary');
                    toastEl.classList.add('text-bg-success');
                    const toastBody = toastEl.querySelector('.toast-body');
                    toastBody.textContent = 'Storage cleared successfully!';
                    const toast = bootstrap.Toast.getOrCreateInstance(toastEl);
                    toast.show();
                }

                // Reload after a short delay to allow user to see the toast
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
            } catch (error) {
                console.error('[Auth] Error clearing storage:', error);

                // Show error toast
                const toastEl = document.getElementById('liveToast');
                if (toastEl) {
                    toastEl.classList.remove('text-bg-success', 'text-bg-primary');
                    toastEl.classList.add('text-bg-danger');
                    const toastBody = toastEl.querySelector('.toast-body');
                    toastBody.textContent = 'Failed to clear storage. Check console for details.';
                    const toast = bootstrap.Toast.getOrCreateInstance(toastEl);
                    toast.show();
                }
            }
        });
    }

    /**
     * Get Authorization headers for API calls
     */
    getAuthHeaders() {
        if (this.token) {
            return {
                Authorization: `Bearer ${this.token}`,
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
        // In Istio mode, we don't have a token in the browser (managed server-side)
        // Check if we have userInfo from the backend
        if (this.mode === 'istio') {
            return this.userInfo !== null;
        }

        // In OAuth mode, check if token exists and is not expired
        if (!this.token || !this.userInfo) {
            return false;
        }

        // Check token expiration if exp claim exists
        if (this.userInfo.exp) {
            const now = Math.floor(Date.now() / 1000);
            if (now >= this.userInfo.exp) {
                console.warn('[Auth] Token expired');
                this.handleTokenExpiry();
                return false;
            }
        }

        return true;
    }

    /**
     * Handle token expiration
     */
    async handleTokenExpiry() {
        // If auth is not required, don't show expiry warnings
        if (!this.authRequired) {
            console.log('[Auth] Auth not required, skipping token expiry handling');
            return;
        }

        console.log('[Auth] Token expired, attempting to refresh...');

        // Try to refresh the token first
        const refreshSuccess = await this.refreshAccessToken();

        if (refreshSuccess) {
            console.log('[Auth] Token refreshed successfully, continuing session');
            this.renderAuthUI();
            return;
        }

        // If refresh failed, switch to read-only mode
        console.log('[Auth] Token refresh failed, switching to read-only mode');

        // Show expiry warning in UI
        this.showExpiryWarning();

        // Clear tokens but keep userInfo for display
        sessionStorage.removeItem('access_token');
        sessionStorage.removeItem('refresh_token');
        sessionStorage.removeItem('token_expires_at');
        this.token = null;

        // Update UI to show login button
        this.renderAuthUI();
    }

    /**
     * Show token expiry warning
     */
    showExpiryWarning() {
        const authContainer = document.getElementById('authContainer');
        if (!authContainer) return;

        // Create warning badge
        const warning = document.createElement('div');
        warning.className = 'alert alert-warning alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3';
        warning.style.zIndex = '9999';
        warning.style.maxWidth = '500px';
        warning.innerHTML = `
            <i class="bi bi-exclamation-triangle-fill me-2"></i>
            <strong>Session Expired</strong><br>
            Your session has expired. You can still view events, but you need to log in again to send new events.
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;

        document.body.appendChild(warning);

        // Auto-dismiss after 10 seconds
        setTimeout(() => {
            warning.remove();
        }, 10000);
    }

    /**
     * Render authentication UI
     */
    renderAuthUI() {
        console.log('[Auth] ========== renderAuthUI DEBUG ==========');
        console.log('[Auth] mode:', this.mode);
        console.log('[Auth] token exists:', !!this.token);
        console.log('[Auth] userInfo:', this.userInfo);
        console.log('[Auth] authRequired:', this.authRequired);
        console.log('[Auth] isAuthenticated():', this.isAuthenticated());

        const authContainer = document.getElementById('authContainer');
        console.log('[Auth] authContainer element:', authContainer);

        if (!authContainer) {
            console.error('[Auth] ❌ authContainer NOT FOUND in DOM!');
            console.log(
                '[Auth] Available elements with id:',
                Array.from(document.querySelectorAll('[id]')).map(el => el.id)
            );
            return;
        }

        console.log('[Auth] ✓ authContainer found, current content:', authContainer.innerHTML.substring(0, 100));

        // Clear existing content
        authContainer.innerHTML = '';
        console.log('[Auth] Cleared authContainer');

        // When auth is not required, show admin features without login/logout
        if (!this.authRequired) {
            console.log('[Auth] Auth not required - showing admin features without authentication UI');
            this.renderAdminFeaturesOnly();
            return;
        }

        // Show UI if OAuth is configured OR if user is authenticated
        const shouldShowUI = this.isAuthenticated() || this.mode === 'oauth';
        console.log('[Auth] shouldShowUI:', shouldShowUI, '(authenticated:', this.isAuthenticated(), 'OR mode === oauth:', this.mode === 'oauth', ')');

        if (!shouldShowUI) {
            console.log('[Auth] ❌ Not showing auth UI - exiting');
            return;
        }

        console.log('[Auth] ✓ Should show UI, checking if authenticated...');

        if (this.isAuthenticated()) {
            console.log('[Auth] ✓ User IS authenticated, rendering user dropdown...');
            console.log('[Auth] Username:', this.userInfo?.username || this.userInfo?.email);
            console.log('[Auth] Roles:', this.userInfo?.roles);

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

            // Role badge - show only highest relevant role
            const highestRole = this.getHighestRelevantRole();
            if (highestRole) {
                const rolesSpan = document.createElement('span');
                rolesSpan.className = 'ms-2';

                const badge = document.createElement('span');
                badge.className = `badge rounded-pill ${this.getRoleBadgeClass(highestRole)} ms-1`;
                badge.textContent = highestRole;
                rolesSpan.appendChild(badge);

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

            // Current Clients button (available to admin and operator users)
            if (this.userInfo.roles && (this.userInfo.roles.includes('admin') || this.userInfo.roles.includes('operator'))) {
                const clientsItem = document.createElement('li');
                const clientsLink = document.createElement('a');
                clientsLink.className = 'dropdown-item';
                clientsLink.href = '#';
                clientsLink.setAttribute('data-clients-menu', 'true');
                clientsLink.onclick = e => {
                    e.preventDefault();
                    // Show clients modal
                    if (window.clientsModalController) {
                        window.clientsModalController.show();
                    }
                };

                const clientsIcon = document.createElement('i');
                clientsIcon.className = 'bi bi-people-fill me-2';
                clientsLink.appendChild(clientsIcon);
                clientsLink.appendChild(document.createTextNode('Current Clients'));

                // Badge will be added dynamically by clientsModalController

                clientsItem.appendChild(clientsLink);
                menu.appendChild(clientsItem);
            }

            // Manage Tasks button (available only to admin users)
            if (this.userInfo.roles && this.userInfo.roles.includes('admin')) {
                const tasksItem = document.createElement('li');
                const tasksLink = document.createElement('a');
                tasksLink.className = 'dropdown-item';
                tasksLink.href = '#';
                tasksLink.setAttribute('data-tasks-menu', 'true');
                tasksLink.onclick = e => {
                    e.preventDefault();
                    // Show tasks modal (will be defined in tasksModal.js)
                    if (window.tasksModalController) {
                        window.tasksModalController.show();
                    }
                };

                const tasksIcon = document.createElement('i');
                tasksIcon.className = 'bi bi-list-task me-2';
                tasksLink.appendChild(tasksIcon);
                tasksLink.appendChild(document.createTextNode('Manage Tasks'));

                // Badge will be added dynamically by tasksModalController

                tasksItem.appendChild(tasksLink);
                menu.appendChild(tasksItem);
            }

            // Divider before logout
            const logoutDivider = document.createElement('li');
            const logoutHr = document.createElement('hr');
            logoutHr.className = 'dropdown-divider';
            logoutDivider.appendChild(logoutHr);
            menu.appendChild(logoutDivider);

            // Logout button
            const logoutItem = document.createElement('li');
            const logoutLink = document.createElement('a');
            logoutLink.className = 'dropdown-item';
            logoutLink.href = '#';
            logoutLink.onclick = e => {
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
        } else if (this.mode === 'oauth') {
            // Show user icon dropdown with Clear Storage option
            const userDiv = document.createElement('div');
            userDiv.className = 'auth-user-info';

            // Create dropdown
            const dropdown = document.createElement('div');
            dropdown.className = 'dropdown';

            const button = document.createElement('button');
            button.className = 'btn btn-outline-secondary dropdown-toggle';
            button.setAttribute('data-bs-toggle', 'dropdown');
            button.setAttribute('aria-expanded', 'false');
            button.setAttribute('aria-label', 'User menu');

            // User icon
            const icon = document.createElement('i');
            icon.className = 'bi bi-person-circle';
            button.appendChild(icon);

            dropdown.appendChild(button);

            // Dropdown menu
            const menu = document.createElement('ul');
            menu.className = 'dropdown-menu dropdown-menu-end';

            // Login button
            const loginItem = document.createElement('li');
            const loginLink = document.createElement('a');
            loginLink.className = 'dropdown-item';
            loginLink.href = '#';
            loginLink.onclick = e => {
                e.preventDefault();
                this.login();
            };

            const loginIcon = document.createElement('i');
            loginIcon.className = 'bi bi-box-arrow-in-right me-2';
            loginLink.appendChild(loginIcon);
            loginLink.appendChild(document.createTextNode('Login'));
            loginItem.appendChild(loginLink);
            menu.appendChild(loginItem);

            dropdown.appendChild(menu);
            userDiv.appendChild(dropdown);
            authContainer.appendChild(userDiv);

            console.log('[Auth] ✓ User dropdown added to authContainer');
        } else {
            console.log('[Auth] User NOT authenticated, showing login button instead');
        }

        // Show the container
        authContainer.classList.remove('d-none');
        console.log('[Auth] ✓ authContainer made visible');
        console.log('[Auth] ========== renderAuthUI COMPLETE ==========');
    }

    /**
     * Render admin features only (when auth is not required)
     * Shows Clear Storage, Current Clients, and Manage Tasks without login/logout
     */
    renderAdminFeaturesOnly() {
        const authContainer = document.getElementById('authContainer');
        if (!authContainer) {
            console.error('[Auth] authContainer not found in renderAdminFeaturesOnly');
            return;
        }

        // Create admin icon dropdown
        const userDiv = document.createElement('div');
        userDiv.className = 'auth-user-info';

        const dropdown = document.createElement('div');
        dropdown.className = 'dropdown';

        const button = document.createElement('button');
        button.className = 'btn btn-outline-secondary dropdown-toggle';
        button.setAttribute('type', 'button');
        button.setAttribute('data-bs-toggle', 'dropdown');
        button.setAttribute('aria-expanded', 'false');

        // Admin icon
        const icon = document.createElement('i');
        icon.className = 'bi bi-gear-fill';
        button.appendChild(icon);

        dropdown.appendChild(button);

        // Create dropdown menu
        const menu = document.createElement('ul');
        menu.className = 'dropdown-menu dropdown-menu-end';

        // Clear Storage button
        const clearStorageItem = document.createElement('li');
        const clearStorageLink = document.createElement('a');
        clearStorageLink.className = 'dropdown-item';
        clearStorageLink.href = '#';
        clearStorageLink.onclick = e => {
            e.preventDefault();
            this.clearStorage();
        };

        const clearIcon = document.createElement('i');
        clearIcon.className = 'bi bi-trash3 me-2';
        clearStorageLink.appendChild(clearIcon);
        clearStorageLink.appendChild(document.createTextNode('Clear Storage'));
        clearStorageItem.appendChild(clearStorageLink);
        menu.appendChild(clearStorageItem);

        // Current Clients button
        const clientsItem = document.createElement('li');
        const clientsLink = document.createElement('a');
        clientsLink.className = 'dropdown-item';
        clientsLink.href = '#';
        clientsLink.setAttribute('data-clients-menu', 'true');
        clientsLink.onclick = e => {
            e.preventDefault();
            if (window.clientsModalController) {
                window.clientsModalController.show();
            }
        };

        const clientsIcon = document.createElement('i');
        clientsIcon.className = 'bi bi-people-fill me-2';
        clientsLink.appendChild(clientsIcon);
        clientsLink.appendChild(document.createTextNode('Current Clients'));
        clientsItem.appendChild(clientsLink);
        menu.appendChild(clientsItem);

        // Manage Tasks button
        const tasksItem = document.createElement('li');
        const tasksLink = document.createElement('a');
        tasksLink.className = 'dropdown-item';
        tasksLink.href = '#';
        tasksLink.setAttribute('data-tasks-menu', 'true');
        tasksLink.onclick = e => {
            e.preventDefault();
            if (window.tasksModalController) {
                window.tasksModalController.show();
            }
        };

        const tasksIcon = document.createElement('i');
        tasksIcon.className = 'bi bi-list-task me-2';
        tasksLink.appendChild(tasksIcon);
        tasksLink.appendChild(document.createTextNode('Manage Tasks'));

        // Badge will be added dynamically by tasksModalController

        tasksItem.appendChild(tasksLink);
        menu.appendChild(tasksItem);

        dropdown.appendChild(menu);
        userDiv.appendChild(dropdown);
        authContainer.appendChild(userDiv);
        authContainer.classList.remove('d-none');
    }

    /**
     * Get Bootstrap badge class for role
     */
    getRoleBadgeClass(role) {
        const roleClasses = {
            admin: 'bg-danger',
            operator: 'bg-warning text-dark',
            user: 'bg-info text-dark',
        };
        return roleClasses[role] || 'bg-secondary';
    }

    /**
     * Get the highest relevant role for display purposes
     * Returns the application role (admin/operator/user) based on configured role mappings
     * Priority: admin > operator > user
     */
    getHighestRelevantRole() {
        if (!this.userInfo || !this.userInfo.roles || !this.roleMappings) {
            return null;
        }

        const userRoles = this.userInfo.roles;

        // Check in priority order: admin > operator > user
        if (userRoles.includes(this.roleMappings.admin)) {
            return 'admin';
        }
        if (userRoles.includes(this.roleMappings.operator)) {
            return 'operator';
        }
        if (userRoles.includes(this.roleMappings.user)) {
            return 'user';
        }

        return null;
    }

    /**
     * Debug helper - print current auth state
     */
    debugState() {
        console.log('=== AUTH STATE DEBUG ===');
        console.log('initialized:', this.initialized);
        console.log('mode:', this.mode);
        console.log('token exists:', !!this.token);
        console.log('token value (first 20 chars):', this.token?.substring(0, 20));
        console.log('userInfo:', this.userInfo);
        console.log('authRequired:', this.authRequired);
        console.log('oauthConfig:', this.oauthConfig);
        console.log('isAuthenticated():', this.isAuthenticated());
        console.log('sessionStorage access_token:', !!sessionStorage.getItem('access_token'));
        console.log('sessionStorage refresh_token:', !!sessionStorage.getItem('refresh_token'));
        console.log('authContainer in DOM:', !!document.getElementById('authContainer'));
        console.log('========================');
    }
}

// Create and export global instance
export const authManager = new AuthManager();

// Make debugState available globally for easy console access
window.debugAuth = () => authManager.debugState();
