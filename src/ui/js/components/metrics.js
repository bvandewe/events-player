/**
 * Metrics Component
 * Manages real-time metrics cards (Total Events, Event Rate, Types, Sources)
 */

import * as bootstrap from 'bootstrap';
import { appState } from '../state/appState';

class MetricsController {
    constructor(storageManager) {
        this.storageManager = storageManager;
        this.updateInterval = null;
        this.topType = null;
        this.topSource = null;
    }

    /**
     * Initialize metrics cards
     */
    init() {
        console.log('[Metrics] Initializing...');

        // Setup click handlers for click-to-filter
        this.setupClickHandlers();

        // Initial update
        this.update();

        // Backup polling every 30 seconds (real-time updates via SSE are primary)
        this.updateInterval = setInterval(() => this.update(), 30000);

        console.log('[Metrics] Initialized');
    }

    /**
     * Setup click handlers for metrics to filter
     */
    setupClickHandlers() {
        const typeMetric = document.getElementById('statUniqueTypes');
        const sourceMetric = document.getElementById('statUniqueSources');

        if (typeMetric) {
            typeMetric.addEventListener('click', () => {
                if (this.topType) {
                    console.log(`[Metrics] Filtering by type: ${this.topType}`);
                    import('../ui/globalFilters').then(({ globalFilterController }) => {
                        globalFilterController.setFilter('type', this.topType);
                    });
                }
            });

            // Keyboard accessibility
            typeMetric.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    typeMetric.click();
                }
            });
        }

        if (sourceMetric) {
            sourceMetric.addEventListener('click', () => {
                if (this.topSource) {
                    console.log(`[Metrics] Filtering by source: ${this.topSource}`);
                    import('../ui/globalFilters').then(({ globalFilterController }) => {
                        globalFilterController.setFilter('source', this.topSource);
                    });
                }
            });

            // Keyboard accessibility
            sourceMetric.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    sourceMetric.click();
                }
            });
        }
    }

    /**
     * Update metrics cards with current data
     */
    async update() {
        if (!this.storageManager) return;

        const filters = appState.get('filters');
        const totalCount = appState.get('eventCount');

        // Check if filters are active
        const hasActiveFilters = filters.type || filters.source || filters.subject || (filters.timeRange && filters.timeRange !== 'all');

        // Get filtered events if filters are active
        let events = [];
        if (hasActiveFilters) {
            const filterOptions = this.buildFilterOptions(filters);
            events = await this.storageManager.getRecentEvents(filterOptions);
            appState.setFilteredEventCount(events.length);
        } else {
            events = await this.storageManager.getRecentEvents({ limit: 100000 });
            appState.setFilteredEventCount(null);
        }

        // Update Total Events card label and value
        const totalEventsLabel = document.querySelector('#statTotalEvents')?.closest('.card')?.querySelector('.card-subtitle');
        if (totalEventsLabel) {
            if (hasActiveFilters) {
                totalEventsLabel.innerHTML = `Total Filtered Events <i class="bi bi-info-circle" data-bs-toggle="tooltip" data-bs-placement="top" title="Full total: ${totalCount.toLocaleString()} events"></i>`;
                const tooltipEl = totalEventsLabel.querySelector('[data-bs-toggle="tooltip"]');
                if (tooltipEl) {
                    new bootstrap.Tooltip(tooltipEl);
                }
            } else {
                totalEventsLabel.textContent = 'Total Events';
            }
        }

        // Total Events count
        const totalEventsEl = document.getElementById('statTotalEvents');
        if (totalEventsEl) {
            totalEventsEl.textContent = events.length.toLocaleString();
        }

        const totalTimeEl = document.getElementById('statTotalEventsTime');
        if (totalTimeEl && events.length > 0) {
            const latestTime = new Date(events[0].timestamp);
            totalTimeEl.textContent = `Latest: ${latestTime.toLocaleTimeString()}`;
        }

        // Calculate Average Rate and Peak Rate using time buckets
        if (events.length > 0) {
            const bucketSizeMs = 60000; // 1 minute
            const oneHourAgo = Date.now() - 3600000; // 1 hour
            const recentEvents = events.filter(e => e.timestamp > oneHourAgo);

            // Create buckets
            const buckets = {};
            recentEvents.forEach(event => {
                const bucketTime = Math.floor(event.timestamp / bucketSizeMs) * bucketSizeMs;
                buckets[bucketTime] = (buckets[bucketTime] || 0) + 1;
            });

            const bucketCounts = Object.values(buckets);

            if (bucketCounts.length > 0) {
                const avgPerMinute = Math.round(recentEvents.length / bucketCounts.length);
                const avgRateEl = document.getElementById('statAvgRate');
                if (avgRateEl) avgRateEl.textContent = avgPerMinute;

                const peakPerMinute = Math.max(...bucketCounts);
                const peakRateEl = document.getElementById('statPeakRate');
                if (peakRateEl) peakRateEl.textContent = peakPerMinute;
            } else {
                const avgRateEl = document.getElementById('statAvgRate');
                const peakRateEl = document.getElementById('statPeakRate');
                if (avgRateEl) avgRateEl.textContent = '0';
                if (peakRateEl) peakRateEl.textContent = '0';
            }
        } else {
            const avgRateEl = document.getElementById('statAvgRate');
            const peakRateEl = document.getElementById('statPeakRate');
            if (avgRateEl) avgRateEl.textContent = '0';
            if (peakRateEl) peakRateEl.textContent = '0';
        }

        // Unique Types
        const uniqueTypes = new Set(events.map(e => e.type)).size;
        const typesEl = document.getElementById('statUniqueTypes');
        if (typesEl) typesEl.textContent = uniqueTypes;

        const typesInfo = document.getElementById('statUniqueTypesInfo');
        if (typesInfo && events.length > 0) {
            const typeCounts = {};
            events.forEach(e => {
                typeCounts[e.type] = (typeCounts[e.type] || 0) + 1;
            });
            const topType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0];
            this.topType = topType[0];
            typesInfo.textContent = `Top: ${topType[0]}`;
        } else {
            this.topType = null;
        }

        // Unique Sources
        const uniqueSources = new Set(events.map(e => e.source)).size;
        const sourcesEl = document.getElementById('statUniqueSources');
        if (sourcesEl) sourcesEl.textContent = uniqueSources;

        const sourcesInfo = document.getElementById('statUniqueSourcesInfo');
        if (sourcesInfo && events.length > 0) {
            const sourceCounts = {};
            events.forEach(e => {
                sourceCounts[e.source] = (sourceCounts[e.source] || 0) + 1;
            });
            const topSource = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1])[0];
            this.topSource = topSource[0];
            sourcesInfo.textContent = `Top: ${topSource[0]}`;
        } else {
            this.topSource = null;
        }
    }

    /**
     * Build filter options for storage queries
     */
    buildFilterOptions(filters) {
        const options = {};

        if (filters.type) options.type = filters.type;
        if (filters.source) options.source = filters.source;
        if (filters.subject) options.subject = filters.subject;

        // Handle time range
        if (filters.timeRange && filters.timeRange !== 'all') {
            if (filters.timeRange === 'custom') {
                if (filters.customStartTime && filters.customEndTime) {
                    options.startTime = filters.customStartTime;
                    options.endTime = filters.customEndTime;
                }
            } else {
                const now = Date.now();
                const ranges = {
                    '5m': 5 * 60 * 1000,
                    '15m': 15 * 60 * 1000,
                    '30m': 30 * 60 * 1000,
                    '1h': 60 * 60 * 1000,
                    '3h': 3 * 60 * 60 * 1000,
                    '6h': 6 * 60 * 60 * 1000,
                    '12h': 12 * 60 * 60 * 1000,
                    '24h': 24 * 60 * 60 * 1000,
                    '2d': 2 * 24 * 60 * 60 * 1000,
                    '7d': 7 * 24 * 60 * 60 * 1000,
                    '30d': 30 * 24 * 60 * 60 * 1000,
                };
                const timeMs = ranges[filters.timeRange];
                if (timeMs) {
                    options.startTime = now - timeMs;
                }
            }
        }

        return options;
    }

    /**
     * Cleanup
     */
    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
    }
}

export { MetricsController };
