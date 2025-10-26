/**
 * API Client with automatic token refresh on 401 errors
 * 
 * This module provides a wrapper around fetch() that automatically
 * handles token expiration by refreshing tokens and retrying requests.
 */

import { authManager } from '../auth/auth.js';

/**
 * Fetch wrapper with automatic token refresh on 401 errors
 * 
 * @param {string} url - The URL to fetch
 * @param {RequestInit} options - Fetch options
 * @param {boolean} isRetry - Internal flag to prevent infinite retry loops
 * @returns {Promise<Response>} The fetch response
 */
export async function apiFetch(url, options = {}, isRetry = false) {
    try {
        // Add authorization header if token is available
        if (authManager.token && !options.headers?.['Authorization']) {
            options.headers = {
                ...options.headers,
                'Authorization': `Bearer ${authManager.token}`
            };
        }

        const response = await fetch(url, options);

        // If we get a 401 and this isn't already a retry, attempt token refresh
        if (response.status === 401 && !isRetry) {
            console.log('[API] Received 401, attempting token refresh...');

            const refreshSuccess = await authManager.refreshAccessToken();

            if (refreshSuccess) {
                console.log('[API] Token refreshed, retrying request...');

                // Update authorization header with new token
                options.headers = {
                    ...options.headers,
                    'Authorization': `Bearer ${authManager.token}`
                };

                // Retry the request (with isRetry=true to prevent infinite loops)
                return await apiFetch(url, options, true);
            } else {
                console.error('[API] Token refresh failed, showing login prompt');
                // Trigger the token expiry handler to show login UI
                await authManager.handleTokenExpiry();
            }
        }

        return response;

    } catch (error) {
        console.error('[API] Request failed:', error);
        throw error;
    }
}

/**
 * POST request with JSON body and automatic token refresh
 * 
 * @param {string} url - The URL to post to
 * @param {object} data - The data to send as JSON
 * @returns {Promise<Response>} The fetch response
 */
export async function apiPost(url, data) {
    return apiFetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    });
}

/**
 * GET request with automatic token refresh
 * 
 * @param {string} url - The URL to get
 * @returns {Promise<Response>} The fetch response
 */
export async function apiGet(url) {
    return apiFetch(url, {
        method: 'GET'
    });
}
