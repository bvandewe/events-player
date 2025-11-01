/**
 * Shared SSE Connection Manager
 * Handles Server-Sent Events connection and event counter updates
 */

import { appState } from '../state/appState';

class SSEConnectionManager {
    constructor() {
        this.eventSource = null;
        this.eventCountSpan = null;
        this.eventListeners = [];
        this.sseEventPath = '/stream/events';
    }

    /**
     * Initialize the SSE connection
     * @param {Object} options - Configuration options
     * @param {Function} options.onMessage - Callback when event is received
     * @param {Function} options.onOpen - Callback when connection opens
     * @param {Function} options.onError - Callback when error occurs
     * @param {number} options.initialCount - Initial event count from storage
     */
    init(options = {}) {
        // Close existing connection if any to prevent leaks
        if (this.eventSource) {
            console.log('[SSE] Closing existing connection before creating new one');
            this.close();
        }

        this.eventCountSpan = document.getElementById('event-count');

        // Set initial count if provided
        if (typeof options.initialCount === 'number') {
            appState.setEventCount(options.initialCount);
            this.updateCounter();
        }

        // Subscribe to event count changes from state
        appState.subscribe('eventCount', (count) => {
            this.updateCounter();
        });

        // Subscribe to filtered event count changes from state
        appState.subscribe('filteredEventCount', (count) => {
            this.updateCounter();
        });

        // Setup SSE connection
        try {
            this.eventSource = new EventSource(this.sseEventPath);

            this.eventSource.addEventListener('open', () => {
                console.log('[SSE] Connection opened');
                appState.setConnectionStatus('connected');
                if (options.onOpen) {
                    options.onOpen();
                }
            });

            this.eventSource.addEventListener('message', (event) => {
                console.log('[SSE] Received event');

                // Don't increment counter here - let the view handle it after filtering
                // The counter should represent visible events, not all received events

                // Temporarily set status to receiving
                appState.setConnectionStatus('receiving');

                // Notify listeners
                if (options.onMessage) {
                    options.onMessage(event);
                }
            });

            this.eventSource.addEventListener('error', (error) => {
                console.error('[SSE] Connection error:', error);
                appState.setConnectionStatus('error');
                if (options.onError) {
                    options.onError(error);
                }
            });

        } catch (error) {
            console.error('[SSE] Failed to setup connection:', error);
        }
    }

    /**
     * Update the event counter in the UI
     */
    updateCounter() {
        const totalCount = appState.get('eventCount');
        const filteredCount = appState.get('filteredEventCount');

        if (this.eventCountSpan) {
            // Show X/Y format when filters are active, otherwise just Y
            if (filteredCount !== null && filteredCount !== totalCount) {
                this.eventCountSpan.textContent = `${filteredCount}/${totalCount}`;
            } else {
                this.eventCountSpan.textContent = totalCount;
            }

            // Update page title with counter
            const baseTitle = document.title.split('(')[0].trim();
            if (filteredCount !== null && filteredCount !== totalCount) {
                document.title = `${baseTitle} (${filteredCount}/${totalCount})`;
            } else {
                document.title = `${baseTitle} (${totalCount})`;
            }
        }
    }

    /**
     * Set the event count (useful when loading from storage)
     */
    setCount(count) {
        appState.setEventCount(count);
    }

    /**
     * Get current event count
     */
    getCount() {
        return appState.get('eventCount');
    }

    /**
     * Increment the counter
     */
    incrementCount() {
        appState.incrementEventCount();
    }

    /**
     * Reset the counter
     */
    resetCount() {
        appState.resetEventCount();
    }

    /**
     * Close the SSE connection
     */
    close() {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
            console.log('[SSE] Connection closed');
        }
    }

    /**
     * Check if connection is active
     */
    isConnected() {
        return this.eventSource && this.eventSource.readyState === EventSource.OPEN;
    }
}

// Export singleton instance
export const sseConnection = new SSEConnectionManager();
