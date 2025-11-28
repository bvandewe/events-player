/**
 * Shared Filter Controller
 * Manages event type, source, and subject filters across views
 */

import { appState } from '../state/appState';

class FilterController {
    constructor() {
        this.storageManager = null;

        // Track unique values
        this.types = new Set();
        this.sources = new Set();
        this.subjects = new Set();
    }

    /**
     * Initialize filter controller
     * @param {Object} config - Configuration
     * @param {Object} config.storageManager - Event storage manager instance
     * @param {Object} config.selectors - DOM selectors for filter dropdowns
     * @param {Function} config.onFilterChange - Callback when filters change (deprecated - use state subscription)
     */
    async init(config) {
        this.storageManager = config.storageManager;
        this.typeSelect = document.getElementById(config.selectors.type);
        this.sourceSelect = document.getElementById(config.selectors.source);
        this.subjectSelect = document.getElementById(config.selectors.subject);
        this.clearButton = config.selectors.clear ? document.getElementById(config.selectors.clear) : null;

        // Support legacy callback for backward compatibility
        if (config.onFilterChange) {
            appState.subscribe('filters', filters => {
                config.onFilterChange(filters);
            });
        }

        // Load initial filter options from storage
        await this.loadFilterOptions();

        // Setup event listeners
        this.setupEventListeners();

        console.log('[Filters] Initialized with state management');
    }

    /**
     * Load filter options from storage
     */
    async loadFilterOptions() {
        try {
            if (!this.storageManager || !this.storageManager.initialized) {
                console.warn('[Filters] Storage manager not ready');
                return;
            }

            const types = await this.storageManager.getUniqueValues('type');
            const sources = await this.storageManager.getUniqueValues('source');
            const subjects = await this.storageManager.getUniqueValues('subject');

            // Store for incremental updates
            this.types = new Set(types);
            this.sources = new Set(sources);
            this.subjects = new Set(subjects);

            // Update UI
            this.updateFilterDropdowns();
        } catch (error) {
            console.error('[Filters] Error loading filter options:', error);
        }
    }

    /**
     * Update filter dropdowns with current values
     */
    updateFilterDropdowns() {
        if (this.typeSelect) {
            const currentValue = this.typeSelect.value;
            this.typeSelect.innerHTML = '<option value="">All Types</option>';
            Array.from(this.types)
                .sort()
                .forEach(type => {
                    const option = document.createElement('option');
                    option.value = type;
                    option.textContent = type;
                    if (type === currentValue) option.selected = true;
                    this.typeSelect.appendChild(option);
                });
        }

        if (this.sourceSelect) {
            const currentValue = this.sourceSelect.value;
            this.sourceSelect.innerHTML = '<option value="">All Sources</option>';
            Array.from(this.sources)
                .sort()
                .forEach(source => {
                    const option = document.createElement('option');
                    option.value = source;
                    option.textContent = source;
                    if (source === currentValue) option.selected = true;
                    this.sourceSelect.appendChild(option);
                });
        }

        if (this.subjectSelect) {
            const currentValue = this.subjectSelect.value;
            this.subjectSelect.innerHTML = '<option value="">All Subjects</option>';
            Array.from(this.subjects)
                .sort()
                .forEach(subject => {
                    const option = document.createElement('option');
                    option.value = subject;
                    option.textContent = subject || '(empty)';
                    if (subject === currentValue) option.selected = true;
                    this.subjectSelect.appendChild(option);
                });
        }
    }

    /**
     * Add new values from incoming event
     * @param {Object} event - CloudEvent object
     */
    addEventValues(event) {
        let updated = false;

        if (event.type && !this.types.has(event.type)) {
            this.types.add(event.type);
            updated = true;
        }

        if (event.source && !this.sources.has(event.source)) {
            this.sources.add(event.source);
            updated = true;
        }

        if (!this.subjects.has(event.subject || '')) {
            this.subjects.add(event.subject || '');
            updated = true;
        }

        // Update dropdowns if new values were added
        if (updated) {
            this.updateFilterDropdowns();
        }
    }

    /**
     * Setup event listeners for filter changes
     */
    setupEventListeners() {
        const handleChange = () => {
            const filters = this.getActiveFilters();
            // Update state - this will notify all subscribers
            appState.updateFilters(filters);
        };

        if (this.typeSelect) {
            this.typeSelect.addEventListener('change', handleChange);
        }

        if (this.sourceSelect) {
            this.sourceSelect.addEventListener('change', handleChange);
        }

        if (this.subjectSelect) {
            this.subjectSelect.addEventListener('change', handleChange);
        }

        if (this.clearButton) {
            this.clearButton.addEventListener('click', () => {
                this.clearFilters();
                // State update handled in clearFilters()
            });
        }
    }

    /**
     * Get currently active filters
     * @returns {Object} Active filter values
     */
    getActiveFilters() {
        return {
            type: this.typeSelect ? this.typeSelect.value : '',
            source: this.sourceSelect ? this.sourceSelect.value : '',
            subject: this.subjectSelect ? this.subjectSelect.value || null : null,
            timeRange: appState.get('filters.timeRange') || 'all',
        };
    }

    /**
     * Clear all filters
     */
    clearFilters() {
        if (this.typeSelect) this.typeSelect.value = '';
        if (this.sourceSelect) this.sourceSelect.value = '';
        if (this.subjectSelect) this.subjectSelect.value = '';

        // Update state - this will notify all subscribers
        appState.clearFilters();
    }

    /**
     * Set filter values (e.g., from URL parameters)
     * @param {Object} filters - Filter values to set
     */
    setFilters(filters) {
        if (filters.type && this.typeSelect) {
            this.typeSelect.value = filters.type;
        }
        if (filters.source && this.sourceSelect) {
            this.sourceSelect.value = filters.source;
        }
        if (filters.subject !== undefined && this.subjectSelect) {
            this.subjectSelect.value = filters.subject || '';
        }

        // Update state with new filter values
        appState.updateFilters(filters);
    }

    /**
     * Check if an event matches active filters
     * @param {Object} event - CloudEvent to check
     * @returns {boolean} True if event matches filters
     */
    matchesFilters(event) {
        const filters = appState.get('filters');

        if (filters.type && event.type !== filters.type) {
            return false;
        }

        if (filters.source && event.source !== filters.source) {
            return false;
        }

        if (filters.subject !== null && event.subject !== filters.subject) {
            return false;
        }

        return true;
    }
}

// Export singleton instance
export const filterController = new FilterController();
