/**
 * Shared SSE Connection Manager
 * Handles Server-Sent Events connection and event counter updates
 */

class SSEConnectionManager {
    constructor() {
        this.eventSource = null;
        this.eventsCount = 0;
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
        this.eventCountSpan = document.getElementById('event-count');

        // Set initial count if provided
        if (typeof options.initialCount === 'number') {
            this.eventsCount = options.initialCount;
            this.updateCounter();
        }

        // Setup SSE connection
        try {
            this.eventSource = new EventSource(this.sseEventPath);

            this.eventSource.addEventListener('open', () => {
                console.log('[SSE] Connection opened');
                if (options.onOpen) {
                    options.onOpen();
                }
            });

            this.eventSource.addEventListener('message', (event) => {
                console.log('[SSE] Received event');

                // Increment counter
                this.eventsCount++;
                this.updateCounter();

                // Notify listeners
                if (options.onMessage) {
                    options.onMessage(event);
                }
            });

            this.eventSource.addEventListener('error', (error) => {
                console.error('[SSE] Connection error:', error);
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
        if (this.eventCountSpan) {
            this.eventCountSpan.textContent = this.eventsCount;

            // Update page title with counter
            const baseTitle = document.title.split('(')[0].trim();
            document.title = `${baseTitle} (${this.eventsCount})`;
        }
    }

    /**
     * Set the event count (useful when loading from storage)
     */
    setCount(count) {
        this.eventsCount = count;
        this.updateCounter();
    }

    /**
     * Get current event count
     */
    getCount() {
        return this.eventsCount;
    }

    /**
     * Increment the counter
     */
    incrementCount() {
        this.eventsCount++;
        this.updateCounter();
    }

    /**
     * Reset the counter
     */
    resetCount() {
        this.eventsCount = 0;
        this.updateCounter();
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
