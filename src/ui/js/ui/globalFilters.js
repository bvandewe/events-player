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
        this.filtersPanelElement = null;
        this.filtersNavLink = null;

        // Bootstrap instances
        this.offcanvasInstance = null;
        this.tooltipInstance = null;

        // Click outside handler
        this.handleClickOutside = this.handleClickOutside.bind(this);
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
        this.filtersPanelElement = document.getElementById('filtersPanel');
        this.typeSelect = document.getElementById('globalEventTypeFilter');
        this.sourceSelect = document.getElementById('globalEventSourceFilter');
        this.subjectSelect = document.getElementById('globalEventSubjectFilter');
        this.timeRangeSelect = document.getElementById('globalEventTimeRange');
        this.clearButton = document.getElementById('globalClearFiltersBtn');
        this.activeFiltersCount = document.getElementById('activeFiltersCount');
        this.filtersNavLink = document.getElementById('filtersNavLink');

        if (!this.typeSelect || !this.sourceSelect || !this.subjectSelect || !this.filtersPanelElement) {
            console.error('[GlobalFilters] Required DOM elements not found');
            return;
        }

        // Initialize Bootstrap offcanvas instance
        this.offcanvasInstance = new bootstrap.Offcanvas(this.filtersPanelElement);

        // Initialize Bootstrap tooltip for filter nav link
        if (this.filtersNavLink) {
            this.filtersNavLink.setAttribute('data-bs-toggle-tooltip', 'tooltip');
            this.filtersNavLink.setAttribute('data-bs-placement', 'bottom');
            this.filtersNavLink.setAttribute('data-bs-html', 'true');
            this.tooltipInstance = new bootstrap.Tooltip(this.filtersNavLink, {
                trigger: 'hover',
                html: true
            });
        }

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

        console.log('[GlobalFilters] Filters cleared');
    }

    /**
     * Update the active filters count badge and tooltip
     */
    updateActiveFiltersCount() {
        const filters = appState.get('filters');
        let count = 0;
        const filterParts = [];

        if (filters.type) {
            count++;
            filterParts.push(`<strong>Type:</strong> ${filters.type}`);
        }
        if (filters.source) {
            count++;
            filterParts.push(`<strong>Source:</strong> ${filters.source}`);
        }
        if (filters.subject !== null) {
            count++;
            filterParts.push(`<strong>Subject:</strong> ${filters.subject || '(empty)'}`);
        }
        if (filters.timeRange && filters.timeRange !== 'all') {
            count++;
            const timeRangeLabels = {
                '1h': 'Last 1 hour',
                '6h': 'Last 6 hours',
                '24h': 'Last 24 hours',
                '7d': 'Last 7 days'
            };
            filterParts.push(`<strong>Time:</strong> ${timeRangeLabels[filters.timeRange] || filters.timeRange}`);
        }

        // Update badge
        if (this.activeFiltersCount) {
            this.activeFiltersCount.textContent = count;
            if (count > 0) {
                this.activeFiltersCount.classList.remove('d-none');
            } else {
                this.activeFiltersCount.classList.add('d-none');
            }
        }

        // Update tooltip
        if (this.tooltipInstance && this.filtersNavLink) {
            if (count > 0) {
                const tooltipContent = `
                    <div class="text-start">
                        <div class="fw-bold mb-1">Active Filters:</div>
                        ${filterParts.map(part => `<div class="small">${part}</div>`).join('')}
                    </div>
                `;
                this.filtersNavLink.setAttribute('data-bs-title', tooltipContent);
                // Update the tooltip instance
                if (this.tooltipInstance._element) {
                    this.tooltipInstance.dispose();
                    this.tooltipInstance = new bootstrap.Tooltip(this.filtersNavLink, {
                        trigger: 'hover',
                        html: true
                    });
                }
            } else {
                this.filtersNavLink.setAttribute('data-bs-title', 'No active filters');
                // Update the tooltip instance
                if (this.tooltipInstance._element) {
                    this.tooltipInstance.dispose();
                    this.tooltipInstance = new bootstrap.Tooltip(this.filtersNavLink, {
                        trigger: 'hover',
                        html: true
                    });
                }
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

    /**
     * Setup auto-dismiss when clicking outside the panel
     */
    setupAutoDismiss() {
        // Listen for offcanvas show event
        this.filtersPanelElement.addEventListener('shown.bs.offcanvas', () => {
            console.log('[GlobalFilters] Panel opened, adding click listener');
            // Add click listener after a short delay to avoid immediate closing
            setTimeout(() => {
                document.addEventListener('click', this.handleClickOutside);
            }, 100);
        });

        // Listen for offcanvas hide event to clean up
        this.filtersPanelElement.addEventListener('hidden.bs.offcanvas', () => {
            console.log('[GlobalFilters] Panel closed, removing click listener');
            document.removeEventListener('click', this.handleClickOutside);
        });
    }

    /**
     * Setup escape key to close the panel
     */
    setupEscapeKey() {
        const handleEscape = (event) => {
            if (event.key === 'Escape' && this.offcanvasInstance) {
                const isVisible = this.filtersPanelElement.classList.contains('show');
                if (isVisible) {
                    console.log('[GlobalFilters] Escape key pressed, hiding panel');
                    this.offcanvasInstance.hide();
                }
            }
        };

        document.addEventListener('keydown', handleEscape);
    }

    /**
     * Handle clicks outside the filters panel
     * @param {Event} event - Click event
     */
    handleClickOutside(event) {
        // Check if click is outside the offcanvas panel
        const isClickInside = this.filtersPanelElement.contains(event.target);

        // Check if click is on the nav toggle button (to allow opening)
        const isToggleButton = event.target.closest('[data-bs-target="#filtersPanel"]');

        if (!isClickInside && !isToggleButton && this.offcanvasInstance) {
            console.log('[GlobalFilters] Click outside detected, hiding panel');
            this.offcanvasInstance.hide();
        }
    }
}

// Export singleton instance
export const globalFilterController = new GlobalFilterController();
