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
        this.customStartTimeInput = document.getElementById('customStartTime');
        this.customEndTimeInput = document.getElementById('customEndTime');
        this.customTimeRangeInputs = document.getElementById('customTimeRangeInputs');
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

        // Initialize Bootstrap tooltips for clear button with quick hide
        if (this.clearButton) {
            new bootstrap.Tooltip(this.clearButton, {
                trigger: 'hover',
                delay: { show: 300, hide: 0 },
                animation: true
            });
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

        // Subscribe to filter state changes to keep UI in sync
        appState.subscribe('filters', () => {
            console.log('[GlobalFilters] Filter state changed, updating UI');
            this.restoreFilterValues();
            this.updateActiveFiltersCount();
            this.updateFilterIndicators();
        });

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

            // Show/hide custom date inputs based on selection
            if (this.customTimeRangeInputs) {
                if (filters.timeRange === 'custom') {
                    this.customTimeRangeInputs.classList.remove('d-none');

                    // Restore custom date values
                    if (filters.customStartTime && this.customStartTimeInput) {
                        const startDate = new Date(filters.customStartTime);
                        this.customStartTimeInput.value = startDate.toISOString().slice(0, 19);
                    }
                    if (filters.customEndTime && this.customEndTimeInput) {
                        const endDate = new Date(filters.customEndTime);
                        this.customEndTimeInput.value = endDate.toISOString().slice(0, 19);
                    }
                } else {
                    this.customTimeRangeInputs.classList.add('d-none');
                }
            }
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

        // Initialize tooltips for all indicators and buttons with quick hide
        Object.values(this.filterIndicators).forEach(indicator => {
            if (indicator) {
                const badge = indicator.querySelector('.badge');
                const button = indicator.querySelector('button');

                if (badge) {
                    this.indicatorTooltips.push(new bootstrap.Tooltip(badge, {
                        trigger: 'hover',
                        delay: { show: 300, hide: 0 },
                        animation: true
                    }));
                }
                if (button) {
                    this.indicatorTooltips.push(new bootstrap.Tooltip(button, {
                        trigger: 'hover',
                        delay: { show: 300, hide: 0 },
                        animation: true
                    }));
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

            // Add custom date range if selected
            if (filters.timeRange === 'custom') {
                if (this.customStartTimeInput && this.customEndTimeInput) {
                    const startValue = this.customStartTimeInput.value;
                    const endValue = this.customEndTimeInput.value;

                    if (startValue) {
                        filters.customStartTime = new Date(startValue).getTime();
                    }
                    if (endValue) {
                        filters.customEndTime = new Date(endValue).getTime();
                    }
                }
            }

            console.log('[GlobalFilters] Filters changed:', filters);

            // Update state - this will notify all subscribers and persist to localStorage
            appState.updateFilters(filters);

            // Update active filter count badge
            this.updateActiveFiltersCount();

            // Update filter indicators on all views
            this.updateFilterIndicators();
        };

        // Toggle custom date inputs visibility
        if (this.timeRangeSelect && this.customTimeRangeInputs) {
            this.timeRangeSelect.addEventListener('change', () => {
                if (this.timeRangeSelect.value === 'custom') {
                    this.customTimeRangeInputs.classList.remove('d-none');
                } else {
                    this.customTimeRangeInputs.classList.add('d-none');
                }
                handleChange();
            });
        }

        // Setup listeners for custom date inputs
        if (this.customStartTimeInput) {
            this.customStartTimeInput.addEventListener('change', handleChange);
        }
        if (this.customEndTimeInput) {
            this.customEndTimeInput.addEventListener('change', handleChange);
        }

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
     * Set a specific filter value programmatically
     * @param {string} filterType - 'type', 'source', or 'subject'
     * @param {string} value - The value to set (or null to clear that filter)
     */
    setFilter(filterType, value) {
        const filters = appState.get('filters');

        // Update the appropriate dropdown
        switch (filterType) {
            case 'type':
                if (this.typeSelect) {
                    this.typeSelect.value = value || '';
                }
                filters.type = value || null;
                break;
            case 'source':
                if (this.sourceSelect) {
                    this.sourceSelect.value = value || '';
                }
                filters.source = value || null;
                break;
            case 'subject':
                if (this.subjectSelect) {
                    this.subjectSelect.value = value || '';
                }
                filters.subject = value || null;
                break;
            default:
                console.warn(`[GlobalFilters] Unknown filter type: ${filterType}`);
                return;
        }

        // Update state - this will notify all subscribers and persist
        appState.updateFilters(filters);

        // Update active filter count badge
        this.updateActiveFiltersCount();

        // Update filter indicators on all views
        this.updateFilterIndicators();

        console.log(`[GlobalFilters] Filter set: ${filterType} = ${value}`);
    }

    /**
     * Clear all filters
     */
    clearFilters() {
        if (this.typeSelect) this.typeSelect.value = '';
        if (this.sourceSelect) this.sourceSelect.value = '';
        if (this.subjectSelect) this.subjectSelect.value = '';
        if (this.timeRangeSelect) this.timeRangeSelect.value = 'all';
        if (this.customStartTimeInput) this.customStartTimeInput.value = '';
        if (this.customEndTimeInput) this.customEndTimeInput.value = '';
        if (this.customTimeRangeInputs) this.customTimeRangeInputs.classList.add('d-none');

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
            const eventTime = new Date(event.time).getTime();

            if (filters.timeRange === 'custom') {
                // Use custom date range
                if (filters.customStartTime && eventTime < filters.customStartTime) {
                    return false;
                }
                if (filters.customEndTime && eventTime > filters.customEndTime) {
                    return false;
                }
            } else {
                // Use predefined ranges
                const now = Date.now();
                let rangeMs = 0;

                switch (filters.timeRange) {
                    case '5m':
                        rangeMs = 5 * 60 * 1000;
                        break;
                    case '15m':
                        rangeMs = 15 * 60 * 1000;
                        break;
                    case '30m':
                        rangeMs = 30 * 60 * 1000;
                        break;
                    case '1h':
                        rangeMs = 60 * 60 * 1000;
                        break;
                    case '3h':
                        rangeMs = 3 * 60 * 60 * 1000;
                        break;
                    case '6h':
                        rangeMs = 6 * 60 * 60 * 1000;
                        break;
                    case '12h':
                        rangeMs = 12 * 60 * 60 * 1000;
                        break;
                    case '24h':
                        rangeMs = 24 * 60 * 60 * 1000;
                        break;
                    case '2d':
                        rangeMs = 2 * 24 * 60 * 60 * 1000;
                        break;
                    case '7d':
                        rangeMs = 7 * 24 * 60 * 60 * 1000;
                        break;
                    case '30d':
                        rangeMs = 30 * 24 * 60 * 60 * 1000;
                        break;
                }

                if (rangeMs > 0 && (now - eventTime) > rangeMs) {
                    return false;
                }
            }
        }

        return true;
    }
}

// Export singleton instance
export const globalFilterController = new GlobalFilterController();
