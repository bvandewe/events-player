/**
 * AppState - Centralized state management for the CloudEvents Player
 * 
 * Provides reactive state updates across all views (Events, Timeline, Dashboard)
 * with a pub/sub pattern for component communication.
 */

class AppState {
    constructor() {
        // Application state
        this.state = {
            // Filter state (shared across all views)
            filters: {
                type: '',
                source: '',
                subject: null,
                timeRange: 'all'
            },

            // Event counter state
            eventCount: 0,

            // Connection state
            connectionStatus: 'disconnected', // 'connected', 'disconnected', 'error', 'receiving'

            // Current view
            currentView: 'events', // 'events', 'timeline', 'dashboard'

            // Storage stats
            stats: {
                metadataCount: 0,
                recentCount: 0
            }
        };

        // Subscribers: Map<stateKey, Array<callback>>
        this.listeners = new Map();

        // Enable state debugging
        this.debug = false;
    }

    /**
     * Subscribe to state changes
     * @param {string} key - State key to watch (e.g., 'filters', 'eventCount')
     * @param {Function} callback - Called when state changes with (newValue, oldValue)
     * @returns {Function} Unsubscribe function
     */
    subscribe(key, callback) {
        if (!this.listeners.has(key)) {
            this.listeners.set(key, []);
        }

        this.listeners.get(key).push(callback);

        if (this.debug) {
            console.log(`[AppState] Subscribed to '${key}' (${this.listeners.get(key).length} listeners)`);
        }

        // Return unsubscribe function
        return () => {
            const callbacks = this.listeners.get(key);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        };
    }

    /**
     * Get current state value
     * @param {string} key - State key (supports dot notation: 'filters.type')
     * @returns {*} State value
     */
    get(key) {
        const keys = key.split('.');
        let value = this.state;

        for (const k of keys) {
            value = value?.[k];
            if (value === undefined) break;
        }

        return value;
    }

    /**
     * Update state and notify subscribers
     * @param {string} key - State key (supports dot notation: 'filters.type')
     * @param {*} value - New value
     */
    set(key, value) {
        const keys = key.split('.');
        const topKey = keys[0];
        const oldValue = this.get(key);

        // Update state
        if (keys.length === 1) {
            this.state[key] = value;
        } else {
            // Handle nested keys
            let obj = this.state;
            for (let i = 0; i < keys.length - 1; i++) {
                if (!obj[keys[i]]) obj[keys[i]] = {};
                obj = obj[keys[i]];
            }
            obj[keys[keys.length - 1]] = value;
        }

        if (this.debug) {
            console.log(`[AppState] Set '${key}':`, value, '(was:', oldValue, ')');
        }

        // Notify subscribers of the specific key
        this.notify(key, value, oldValue);

        // Also notify subscribers of parent key if nested
        if (keys.length > 1) {
            this.notify(topKey, this.state[topKey], this.get(topKey));
        }
    }

    /**
     * Update multiple filter properties at once
     * @param {Object} updates - Filter updates { type: 'value', source: 'value' }
     */
    updateFilters(updates) {
        const oldFilters = { ...this.state.filters };
        this.state.filters = { ...this.state.filters, ...updates };

        if (this.debug) {
            console.log('[AppState] Update filters:', this.state.filters);
        }

        this.notify('filters', this.state.filters, oldFilters);
    }

    /**
     * Clear all filters
     */
    clearFilters() {
        const oldFilters = { ...this.state.filters };
        this.state.filters = {
            type: '',
            source: '',
            subject: null,
            timeRange: 'all'
        };

        if (this.debug) {
            console.log('[AppState] Clear filters');
        }

        this.notify('filters', this.state.filters, oldFilters);
    }

    /**
     * Increment event counter
     */
    incrementEventCount() {
        const oldCount = this.state.eventCount;
        this.state.eventCount++;
        this.notify('eventCount', this.state.eventCount, oldCount);
    }

    /**
     * Set event counter
     * @param {number} count - New count
     */
    setEventCount(count) {
        const oldCount = this.state.eventCount;
        this.state.eventCount = count;
        this.notify('eventCount', this.state.eventCount, oldCount);
    }

    /**
     * Reset event counter
     */
    resetEventCount() {
        this.setEventCount(0);
    }

    /**
     * Update storage stats
     * @param {Object} stats - { metadataCount, recentCount }
     */
    updateStats(stats) {
        const oldStats = { ...this.state.stats };
        this.state.stats = { ...this.state.stats, ...stats };
        this.notify('stats', this.state.stats, oldStats);
    }

    /**
     * Set connection status
     * @param {string} status - 'connected', 'disconnected', 'error', 'receiving'
     */
    setConnectionStatus(status) {
        const oldStatus = this.state.connectionStatus;
        this.state.connectionStatus = status;

        if (this.debug) {
            console.log(`[AppState] Connection status: ${oldStatus} -> ${status}`);
        }

        this.notify('connectionStatus', status, oldStatus);
    }

    /**
     * Set current view
     * @param {string} view - 'events', 'timeline', 'dashboard'
     */
    setCurrentView(view) {
        const oldView = this.state.currentView;
        this.state.currentView = view;
        this.notify('currentView', view, oldView);
    }

    /**
     * Notify all subscribers of a state change
     * @private
     */
    notify(key, newValue, oldValue) {
        const callbacks = this.listeners.get(key);
        if (!callbacks || callbacks.length === 0) return;

        if (this.debug) {
            console.log(`[AppState] Notifying ${callbacks.length} listeners for '${key}'`);
        }

        callbacks.forEach(callback => {
            try {
                callback(newValue, oldValue);
            } catch (error) {
                console.error(`[AppState] Error in listener for '${key}':`, error);
            }
        });
    }

    /**
     * Get all state (for debugging)
     */
    getAll() {
        return { ...this.state };
    }

    /**
     * Enable/disable debug mode
     */
    setDebug(enabled) {
        this.debug = enabled;
        console.log(`[AppState] Debug mode: ${enabled}`);
    }
}

// Export singleton instance
export const appState = new AppState();

// Make available globally for debugging
if (typeof window !== 'undefined') {
    window.appState = appState;
}
