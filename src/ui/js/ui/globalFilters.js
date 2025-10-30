/**
 * Global Filter Controller
 * Manages filters across all views with persistence in localStorage
 */

import * as bootstrap from 'bootstrap';
import { appState } from '../state/appState';

class GlobalFilterController {
    constructor() {
        this.storageManager = null;
        this.initialized = false;

        // Track unique values
        this.types = new Set();
        this.sources = new Set();
        this.subjects = new Set();

        // DOM elements
        this.typeSelect = null;
        this.sourceSelect = null;
        this.subjectSelect = null;
        this.timeRangeSelect = null;
        this.clearButton = null;
        this.activeFiltersCount = null;

        // Filter indicators on each view
        this.filterIndicators = {
            events: null,
            timeline: null,
            dashboard: null
        };
        this.filterClearButtons = {
            events: null,
            timeline: null,
            dashboard: null
        };

        // Bootstrap instances
        this.indicatorTooltips = [];
    }

    /**
     * Initialize global filter controller
     * @param {Object} storageManager - Event storage manager instance
     */
    async init(storageManager) {
        if (this.initialized) {
            console.log('[GlobalFilters] Already initialized');
            return;
        }

        this.storageManager = storageManager;

        // Get DOM elements
        this.typeSelect = document.getElementById('globalEventTypeFilter');
        this.sourceSelect = document.getElementById('globalEventSourceFilter');
        this.subjectSelect = document.getElementById('globalEventSubjectFilter');
        this.timeRangeSelect = document.getElementById('globalEventTimeRange');
        this.clearButton = document.getElementById('globalClearFiltersBtn');
        this.activeFiltersCount = document.getElementById('activeFiltersCount');

        // Get filter indicators and clear buttons for each view
        this.filterIndicators.events = document.getElementById('eventsFilterIndicator');
        this.filterIndicators.timeline = document.getElementById('timelineFilterIndicator');
        this.filterIndicators.dashboard = document.getElementById('dashboardFilterIndicator');

        this.filterClearButtons.events = document.getElementById('eventsFilterClearBtn');
        this.filterClearButtons.timeline = document.getElementById('timelineFilterClearBtn');
        this.filterClearButtons.dashboard = document.getElementById('dashboardFilterClearBtn');

        if (!this.typeSelect || !this.sourceSelect || !this.subjectSelect) {
            console.error('[GlobalFilters] Required DOM elements not found');
            return;
        }

        // Initialize Bootstrap tooltips for clear button
        if (this.clearButton) {
            new bootstrap.Tooltip(this.clearButton);
        }

        // Initialize Bootstrap tooltips for filter indicators
        this.initializeIndicatorTooltips();

        // Setup auto-dismiss on click outside
        // Setup auto dismiss (click outside)
        // Note: Bootstrap's data-bs-backdrop="true" handles click-outside-to-close
        // this.setupAutoDismiss(); // Removed - Bootstrap handles this

        // Setup escape key listener
        // Note: Bootstrap's data-bs-keyboard="true" handles Escape key
        // this.setupEscapeKey(); // Removed - Bootstrap handles this

        // Load initial filter options from storage
        await this.loadFilterOptions();

        // Restore saved filter values from state
        this.restoreFilterValues();

        // Setup event listeners
        this.setupEventListeners();

        // Update active filter count badge
        this.updateActiveFiltersCount();

        // Update filter indicators on all views
        this.updateFilterIndicators();

        this.initialized = true;
        console.log('[GlobalFilters] Initialized');
    }

    /**
     * Load filter options from storage
     */
    async loadFilterOptions() {
        try {
            if (!this.storageManager || !this.storageManager.initialized) {
                console.warn('[GlobalFilters] Storage manager not ready');
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
            console.error('[GlobalFilters] Error loading filter options:', error);
        }
    }

    /**
     * Update filter dropdowns with current values
     */
    updateFilterDropdowns() {
        const currentFilters = appState.get('filters');

        if (this.typeSelect) {
            const currentValue = this.typeSelect.value || currentFilters.type;
            this.typeSelect.innerHTML = '<option value="">All Types</option>';
            Array.from(this.types).sort().forEach(type => {
                const option = document.createElement('option');
                option.value = type;
                option.textContent = type;
                if (type === currentValue) option.selected = true;
                this.typeSelect.appendChild(option);
            });
        }

        if (this.sourceSelect) {
            const currentValue = this.sourceSelect.value || currentFilters.source;
            this.sourceSelect.innerHTML = '<option value="">All Sources</option>';
            Array.from(this.sources).sort().forEach(source => {
                const option = document.createElement('option');
                option.value = source;
                option.textContent = source;
                if (source === currentValue) option.selected = true;
                this.sourceSelect.appendChild(option);
            });
        }

        if (this.subjectSelect) {
            const currentValue = this.subjectSelect.value || currentFilters.subject;
            this.subjectSelect.innerHTML = '<option value="">All Subjects</option>';
            Array.from(this.subjects).sort().forEach(subject => {
                const option = document.createElement('option');
                option.value = subject;
                option.textContent = subject || '(empty)';
                if (subject === currentValue) option.selected = true;
                this.subjectSelect.appendChild(option);
            });
        }
    }

    /**
     * Restore filter values from appState
     */
    restoreFilterValues() {
        const filters = appState.get('filters');

        if (this.typeSelect && filters.type) {
            this.typeSelect.value = filters.type;
        }

        if (this.sourceSelect && filters.source) {
            this.sourceSelect.value = filters.source;
        }

        if (this.subjectSelect && filters.subject !== null) {
            this.subjectSelect.value = filters.subject || '';
        }

        if (this.timeRangeSelect && filters.timeRange) {
            this.timeRangeSelect.value = filters.timeRange;
        }

        console.log('[GlobalFilters] Restored filter values:', filters);
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
     * Initialize Bootstrap tooltips for filter indicators
     */
    initializeIndicatorTooltips() {
        // Clear any existing tooltips
        this.indicatorTooltips.forEach(tooltip => tooltip.dispose());
        this.indicatorTooltips = [];

        // Initialize tooltips for all indicators and buttons
        Object.values(this.filterIndicators).forEach(indicator => {
            if (indicator) {
                const badge = indicator.querySelector('.badge');
                const button = indicator.querySelector('button');

                if (badge) {
                    this.indicatorTooltips.push(new bootstrap.Tooltip(badge));
                }
                if (button) {
                    this.indicatorTooltips.push(new bootstrap.Tooltip(button));
                }
            }
        });
    }

    /**
     * Update filter indicators on all views
     */
    updateFilterIndicators() {
        const hasFilters = this.hasActiveFilters();

        // Show or hide indicators based on whether filters are active
        Object.values(this.filterIndicators).forEach(indicator => {
            if (indicator) {
                if (hasFilters) {
                    indicator.classList.remove('d-none');
                } else {
                    indicator.classList.add('d-none');
                }
            }
        });
    }

    /**
     * Check if there are any active filters
     * @returns {boolean} True if any filters are active
     */
    hasActiveFilters() {
        const filters = appState.get('filters');
        return !!(
            filters.type ||
            filters.source ||
            filters.subject !== null ||
            (filters.timeRange && filters.timeRange !== 'all')
        );
    }

    /**
     * Setup event listeners for filter changes
     */
    setupEventListeners() {
        const handleChange = () => {
            const filters = {
                type: this.typeSelect.value,
                source: this.sourceSelect.value,
                subject: this.subjectSelect.value || null,
                timeRange: this.timeRangeSelect.value
            };

            console.log('[GlobalFilters] Filters changed:', filters);

            // Update state - this will notify all subscribers and persist to localStorage
            appState.updateFilters(filters);

            // Update active filter count badge
            this.updateActiveFiltersCount();

            // Update filter indicators on all views
            this.updateFilterIndicators();
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

        if (this.timeRangeSelect) {
            this.timeRangeSelect.addEventListener('change', handleChange);
        }

        if (this.clearButton) {
            this.clearButton.addEventListener('click', () => {
                this.clearFilters();
            });
        }

        // Setup event listeners for clear buttons on each view
        Object.values(this.filterClearButtons).forEach(btn => {
            if (btn) {
                btn.addEventListener('click', () => {
                    this.clearFilters();
                });
            }
        });
    }

    /**
     * Clear all filters
     */
    clearFilters() {
        if (this.typeSelect) this.typeSelect.value = '';
        if (this.sourceSelect) this.sourceSelect.value = '';
        if (this.subjectSelect) this.subjectSelect.value = '';
        if (this.timeRangeSelect) this.timeRangeSelect.value = 'all';

        // Update state - this will notify all subscribers and persist
        appState.clearFilters();

        // Update active filter count badge
        this.updateActiveFiltersCount();

        // Update filter indicators on all views
        this.updateFilterIndicators();

        console.log('[GlobalFilters] Filters cleared');
    }

    /**
     * Update the active filters count badge
     */
    updateActiveFiltersCount() {
        const filters = appState.get('filters');
        let count = 0;

        if (filters.type) count++;
        if (filters.source) count++;
        if (filters.subject !== null) count++;
        if (filters.timeRange && filters.timeRange !== 'all') count++;

        // Update badge
        if (this.activeFiltersCount) {
            this.activeFiltersCount.textContent = count;
            if (count > 0) {
                this.activeFiltersCount.classList.remove('d-none');
            } else {
                this.activeFiltersCount.classList.add('d-none');
            }
        }
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

        // Time range filtering
        if (filters.timeRange && filters.timeRange !== 'all') {
            const now = Date.now();
            const eventTime = new Date(event.time).getTime();
            let rangeMs = 0;

            switch (filters.timeRange) {
                case '1h':
                    rangeMs = 60 * 60 * 1000;
                    break;
                case '6h':
                    rangeMs = 6 * 60 * 60 * 1000;
                    break;
                case '24h':
                    rangeMs = 24 * 60 * 60 * 1000;
                    break;
                case '7d':
                    rangeMs = 7 * 24 * 60 * 60 * 1000;
                    break;
            }

            if (rangeMs > 0 && (now - eventTime) > rangeMs) {
                return false;
            }
        }

        return true;
    }
}

// Export singleton instance
export const globalFilterController = new GlobalFilterController();
