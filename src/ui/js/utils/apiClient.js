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
        console.log(`[API] apiFetch called for ${url}, isRetry=${isRetry}`);
        console.log(`[API] Initial options:`, options);

        // Add authorization header if token is available
        if (authManager.token && !options.headers?.['Authorization']) {
            console.log(`[API] Adding authorization header with token`);
            options.headers = {
                ...options.headers,
                'Authorization': `Bearer ${authManager.token}`
            };
        } else {
            console.log(`[API] No token available or auth header already present`);
        }

        console.log(`[API] Final options before fetch:`, options);
        console.log(`[API] About to call fetch(${url})...`);
        console.log(`[API] Timestamp before fetch: ${Date.now()}`);

        const fetchStartTime = Date.now();
        const response = await fetch(url, options);
        const fetchEndTime = Date.now();

        console.log(`[API] fetch() returned, status: ${response.status}`);
        console.log(`[API] fetch() took ${fetchEndTime - fetchStartTime}ms`);
        console.log(`[API] Timestamp after fetch: ${fetchEndTime}`);

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

        console.log(`[API] Returning response from apiFetch`);
        return response;

    } catch (error) {
        console.error('[API] Request failed in apiFetch:', error);
        throw error;
    }
}

/**
 * POST request with JSON body and automatic token refresh
 * 
 * @param {string} url - The URL to post to
 * @param {object} data - The data to send as JSON
 * @param {number} timeout - Request timeout in milliseconds (default: 30000)
 * @returns {Promise<Response>} The fetch response
 */
export async function apiPost(url, data, timeout = 30000) {
    console.log(`[API] POST ${url} with timeout ${timeout}ms`);
    console.log(`[API] Request data:`, data);
    console.log(`[API] JSON payload:`, JSON.stringify(data));

    // Test without AbortController first
    console.log(`[API] Testing without AbortController to isolate the issue...`);

    try {
        console.log(`[API] About to call apiFetch...`);
        const response = await apiFetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
            // Removed signal: controller.signal temporarily
        });

        console.log(`[API] POST ${url} completed with status ${response.status}`);
        console.log(`[API] Response headers:`, response.headers);
        return response;
    } catch (error) {
        console.error(`[API] Error caught in apiPost:`, error);
        throw error;
    }
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
