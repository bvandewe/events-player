/**
 * Metadata SSE Connection Manager
 * Handles unified metadata stream (tasks + clients + stats)
 */

import { authManager } from '../auth/auth.js';

class MetadataSSEManager {
    constructor() {
        this.eventSource = null;
        this.listeners = {
            tasks: [],
            clients: [],
            stats: [],
        };
        this.sseMetaPath = authManager.basePath + 'stream/meta';
        this.isInitialized = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000; // Start with 1 second
    }

    /**
     * Initialize the metadata SSE connection
     */
    init() {
        if (this.isInitialized) {
            console.log('[MetadataSSE] Already initialized');
            return;
        }

        console.log('[MetadataSSE] Initializing unified metadata stream...');
        this.connect();
        this.isInitialized = true;
    }

    /**
     * Connect to the metadata SSE endpoint
     */
    connect() {
        // Close existing connection if any
        if (this.eventSource) {
            console.log('[MetadataSSE] Closing existing connection');
            this.eventSource.close();
            this.eventSource = null;
        }

        try {
            this.eventSource = new EventSource(this.sseMetaPath);

            this.eventSource.addEventListener('open', () => {
                console.log('[MetadataSSE] Connection opened');
                this.reconnectAttempts = 0;
                this.reconnectDelay = 1000;
            });

            // Listen for 'tasks' events
            this.eventSource.addEventListener('tasks', event => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('[MetadataSSE] Tasks update received:', data);
                    this.notifyListeners('tasks', data);
                } catch (error) {
                    console.error('[MetadataSSE] Failed to parse tasks data:', error);
                }
            });

            // Listen for 'clients' events
            this.eventSource.addEventListener('clients', event => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('[MetadataSSE] Clients update received:', data);
                    this.notifyListeners('clients', data);
                } catch (error) {
                    console.error('[MetadataSSE] Failed to parse clients data:', error);
                }
            });

            this.eventSource.addEventListener('error', error => {
                console.error('[MetadataSSE] Connection error:', error);

                // Attempt reconnection with exponential backoff
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.reconnectAttempts++;
                    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
                    console.log(`[MetadataSSE] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

                    setTimeout(() => {
                        this.connect();
                    }, delay);
                } else {
                    console.error('[MetadataSSE] Max reconnection attempts reached');
                }
            });
        } catch (error) {
            console.error('[MetadataSSE] Failed to setup connection:', error);
        }
    }

    /**
     * Subscribe to a specific metadata event type
     * @param {string} eventType - 'tasks', 'clients', or 'stats'
     * @param {Function} callback - Callback function to invoke with data
     * @returns {Function} Unsubscribe function
     */
    subscribe(eventType, callback) {
        if (!this.listeners[eventType]) {
            console.warn(`[MetadataSSE] Unknown event type: ${eventType}`);
            return () => {};
        }

        this.listeners[eventType].push(callback);
        console.log(`[MetadataSSE] Subscribed to ${eventType} (${this.listeners[eventType].length} listeners)`);

        // Return unsubscribe function
        return () => {
            const index = this.listeners[eventType].indexOf(callback);
            if (index > -1) {
                this.listeners[eventType].splice(index, 1);
                console.log(`[MetadataSSE] Unsubscribed from ${eventType}`);
            }
        };
    }

    /**
     * Notify all listeners for a specific event type
     * @param {string} eventType - 'tasks', 'clients', or 'stats'
     * @param {Object} data - Event data
     */
    notifyListeners(eventType, data) {
        if (!this.listeners[eventType]) {
            return;
        }

        this.listeners[eventType].forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`[MetadataSSE] Error in ${eventType} listener:`, error);
            }
        });
    }

    /**
     * Close the metadata SSE connection
     */
    close() {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
            this.isInitialized = false;
            console.log('[MetadataSSE] Connection closed');
        }
    }
}

// Export singleton instance
export const metadataSSE = new MetadataSSEManager();
