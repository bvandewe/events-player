/**
 * Unified Dashboard Controller
 * Manages the simplified single-view dashboard with tabs for Streams and Timeline
 */

import * as bootstrap from 'bootstrap';
import { appState } from './state/appState';
import EventStorageManager from './storage/eventStorage';

class UnifiedDashboardController {
    constructor() {
        this.activeTab = 'streams';
        this.storageManager = null;
        this.charts = {};
        this.updateIntervals = {};

        // Throttle settings for real-time updates
        this.lastMetricsUpdate = 0;
        this.metricsUpdateDelay = 2000; // Update metrics at most every 2 seconds
        this.pendingMetricsUpdate = null;
    }

    /**
     * Initialize the unified dashboard
     */
    async init() {
        console.log('[UnifiedDashboard] Initializing...');

        // Get singleton storage manager instance
        this.storageManager = EventStorageManager.getInstance();

        // Ensure it's initialized
        if (!this.storageManager.initialized) {
            console.log('[UnifiedDashboard] Waiting for storage manager to initialize...');
            await this.storageManager.init();
        }

        // Setup tab switching
        this.setupTabSwitching();

        // Initialize filter indicator
        this.initFilterIndicator();

        // Initialize metrics cards (they're always visible)
        this.initMetricsCards();

        // Initialize storage indicators
        this.initStorageIndicators();

        // Initialize analytics charts (Top Sources, Types, Subjects - always visible in rows 5 & 7)
        // Do this on initial load regardless of active tab
        await this.initAnalyticsCharts();

        // Initialize active tab content
        if (this.activeTab === 'streams') {
            this.initStreamsTab();
        } else {
            this.initTimelineTab();
        }

        // Subscribe to state changes
        appState.subscribe('filters', () => this.onFiltersChanged());
        appState.subscribe('activeTab', (tab) => this.onTabChanged(tab));

        // Subscribe to new events from SSE - this is critical for real-time updates
        appState.subscribe('newEvent', () => this.onNewEventReceived());

        console.log('[UnifiedDashboard] Initialized');
    }

    /**
     * Setup tab switching behavior
     */
    setupTabSwitching() {
        const tabButtons = document.querySelectorAll('[data-bs-toggle="tab"]');

        tabButtons.forEach(button => {
            button.addEventListener('shown.bs.tab', (event) => {
                const target = event.target.getAttribute('data-bs-target');
                const tabName = target.replace('#', '').replace('-pane', '');

                console.log(`[UnifiedDashboard] Switched to ${tabName} tab`);
                this.activeTab = tabName;
                appState.set('activeTab', tabName);

                // Initialize the tab content if needed
                if (tabName === 'timeline') {
                    this.initTimelineTab();
                    // Analytics charts already initialized on page load
                } else if (tabName === 'streams') {
                    this.initStreamsTab();
                }
            });
        });
    }

    /**
     * Initialize filter indicator
     */
    initFilterIndicator() {
        const indicator = document.getElementById('dashboardFilterIndicator');
        const clearBtn = document.getElementById('dashboardFilterClearBtn');

        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                appState.set('filters', {
                    type: null,
                    source: null,
                    subject: null,
                    timeRange: 'all'
                });
            });
        }

        // Update indicator based on current filters
        this.updateFilterIndicator();
    }

    /**
     * Update filter indicator visibility
     */
    updateFilterIndicator() {
        const indicator = document.getElementById('dashboardFilterIndicator');
        const filters = appState.get('filters');

        if (!indicator) return;

        const hasFilters = filters.type || filters.source || filters.subject ||
            (filters.timeRange && filters.timeRange !== 'all');

        if (hasFilters) {
            indicator.classList.remove('d-none');
        } else {
            indicator.classList.add('d-none');
        }
    }

    /**
     * Initialize metrics cards with real-time updates
     */
    initMetricsCards() {
        // Initial update
        this.updateMetricsCards();

        // Backup polling every 30 seconds (real-time updates via SSE are primary)
        this.updateIntervals.metrics = setInterval(() => {
            this.updateMetricsCards();
        }, 30000);
    }

    /**
     * Update metrics cards with current data
     */
    async updateMetricsCards() {
        if (!this.storageManager) return;

        const stats = this.storageManager.getStats();
        const filters = appState.get('filters');
        const totalCount = appState.get('eventCount');

        // Check if filters are active
        const hasActiveFilters = filters.type || filters.source || filters.subject ||
            (filters.timeRange && filters.timeRange !== 'all');

        // Get filtered events if filters are active
        let events = [];
        if (hasActiveFilters) {
            const filterOptions = this.buildFilterOptions(filters);
            events = await this.storageManager.getRecentEvents(filterOptions);
            // Update filtered count in state
            appState.setFilteredEventCount(events.length);
        } else {
            events = await this.storageManager.getRecentEvents({ limit: 100000 });
            // No filters active
            appState.setFilteredEventCount(null);
        }

        // Update Total Events card label and value
        const totalEventsLabel = document.querySelector('#statTotalEvents').closest('.card').querySelector('.card-subtitle');
        if (totalEventsLabel) {
            if (hasActiveFilters) {
                totalEventsLabel.innerHTML = `Total Filtered Events <i class="bi bi-info-circle" data-bs-toggle="tooltip" data-bs-placement="top" title="Full total: ${totalCount.toLocaleString()} events"></i>`;
                // Initialize Bootstrap tooltip
                const tooltipEl = totalEventsLabel.querySelector('[data-bs-toggle="tooltip"]');
                if (tooltipEl) {
                    new bootstrap.Tooltip(tooltipEl);
                }
            } else {
                totalEventsLabel.textContent = 'Total Events';
            }
        }

        // Total Events count
        document.getElementById('statTotalEvents').textContent = events.length.toLocaleString();
        const totalTimeEl = document.getElementById('statTotalEventsTime');
        if (totalTimeEl && events.length > 0) {
            const latestTime = new Date(events[0].timestamp);
            totalTimeEl.textContent = `Latest: ${latestTime.toLocaleTimeString()}`;
        }

        // Average Rate (events per minute over last hour)
        const oneHourAgo = Date.now() - 3600000;
        const recentEvents = events.filter(e => e.timestamp > oneHourAgo);
        const avgRate = (recentEvents.length / 60).toFixed(1);
        document.getElementById('statAvgRate').textContent = avgRate;

        // Unique Types
        const uniqueTypes = new Set(events.map(e => e.type)).size;
        document.getElementById('statUniqueTypes').textContent = uniqueTypes;
        const typesInfo = document.getElementById('statUniqueTypesInfo');
        if (typesInfo && events.length > 0) {
            // Find most common type
            const typeCounts = {};
            events.forEach(e => {
                typeCounts[e.type] = (typeCounts[e.type] || 0) + 1;
            });
            const topType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0];
            typesInfo.textContent = `Top: ${topType[0].split('.').pop()}`;
        }

        // Unique Sources
        const uniqueSources = new Set(events.map(e => e.source)).size;
        document.getElementById('statUniqueSources').textContent = uniqueSources;
        const sourcesInfo = document.getElementById('statUniqueSourcesInfo');
        if (sourcesInfo && events.length > 0) {
            // Find most common source
            const sourceCounts = {};
            events.forEach(e => {
                sourceCounts[e.source] = (sourceCounts[e.source] || 0) + 1;
            });
            const topSource = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1])[0];
            const sourceShort = topSource[0].split('/').pop() || topSource[0];
            sourcesInfo.textContent = `Top: ${sourceShort}`;
        }
    }

    /**
     * Initialize storage utilization indicators
     */
    initStorageIndicators() {
        // Initial update
        this.updateStorageIndicators();

        // Backup polling every 30 seconds (real-time updates via SSE are primary)
        this.updateIntervals.storage = setInterval(() => {
            this.updateStorageIndicators();
        }, 30000);
    }

    /**
     * Update storage indicators
     */
    updateStorageIndicators() {
        if (!this.storageManager) return;

        const stats = this.storageManager.getStats();

        // Recent Events
        const recentMax = this.storageManager.maxRecentEvents;
        const recentPercent = Math.round((stats.recentCount / recentMax) * 100);
        document.getElementById('recentCount').textContent = stats.recentCount.toLocaleString();
        document.getElementById('recentMax').textContent = recentMax.toLocaleString();
        document.getElementById('recentProgress').style.width = `${recentPercent}%`;
        document.getElementById('recentPercent').textContent = `${recentPercent}%`;

        // Update progress bar color based on usage
        const recentProgress = document.getElementById('recentProgress');
        recentProgress.className = 'progress-bar';
        if (recentPercent >= 90) {
            recentProgress.classList.add('bg-danger');
        } else if (recentPercent >= 70) {
            recentProgress.classList.add('bg-warning');
        } else {
            recentProgress.classList.add('bg-primary');
        }

        // Metadata
        const metadataMax = this.storageManager.maxMetadataEvents;
        const metadataPercent = Math.round((stats.metadataCount / metadataMax) * 100);
        document.getElementById('metadataCount').textContent = stats.metadataCount.toLocaleString();
        document.getElementById('metadataMax').textContent = metadataMax.toLocaleString();
        document.getElementById('metadataProgress').style.width = `${metadataPercent}%`;
        document.getElementById('metadataPercent').textContent = `${metadataPercent}%`;

        // Update progress bar color
        const metadataProgress = document.getElementById('metadataProgress');
        metadataProgress.className = 'progress-bar';
        if (metadataPercent >= 90) {
            metadataProgress.classList.add('bg-danger');
        } else if (metadataPercent >= 70) {
            metadataProgress.classList.add('bg-warning');
        } else {
            metadataProgress.classList.add('bg-info');
        }
    }

    /**
     * Initialize Streams tab (event list already handled by existing SSE controller)
     */
    initStreamsTab() {
        // Event stream is already initialized by sseEventsController in app.js
        // Nothing else needed here
        console.log('[UnifiedDashboard] Streams tab active');
    }

    /**
     * Initialize Timeline tab
     */
    async initTimelineTab() {
        console.log('[UnifiedDashboard] Initializing Timeline tab...');

        // Import and initialize timeline chart controller
        if (!this.charts.timeline) {
            const { timelineController } = await import('./timeline');
            await timelineController.init();
            this.charts.timeline = timelineController;
        }

        // Also initialize the analytics charts (row 5 and 7)
        await this.initAnalyticsCharts();
    }

    /**
     * Initialize analytics charts (top sources, types, subjects, hourly, etc.)
     */
    async initAnalyticsCharts() {
        console.log('[UnifiedDashboard] Initializing analytics charts...');

        // Import and initialize dashboard chart controllers
        if (!this.charts.analytics) {
            const { dashboardController } = await import('./dashboard');
            await dashboardController.init();
            this.charts.analytics = dashboardController;
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
                // Use custom time range from timeline click
                if (filters.customStartTime && filters.customEndTime) {
                    options.startTime = filters.customStartTime;
                    options.endTime = filters.customEndTime;
                }
            } else {
                // Use predefined time range
                const now = Date.now();
                const ranges = {
                    '1h': 3600000,
                    '6h': 21600000,
                    '24h': 86400000,
                    '7d': 604800000
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
     * Handle filter changes
     */
    onFiltersChanged() {
        console.log('[UnifiedDashboard] Filters changed');
        this.updateFilterIndicator();
        this.updateMetricsCards();

        // Refresh charts if they're visible
        if (this.activeTab === 'timeline' && this.charts.timeline) {
            // Timeline and analytics charts will auto-refresh via their own controllers
        }
    }

    /**
     * Handle tab changes
     */
    onTabChanged(tabName) {
        console.log(`[UnifiedDashboard] Tab changed to ${tabName}`);
        this.activeTab = tabName;
    }

    /**
     * Handle new events received via SSE
     * This is called every time an event arrives, but we throttle updates
     * to avoid performance issues during high-volume event streams
     */
    onNewEventReceived() {
        const now = Date.now();

        // Throttle metrics updates - update at most every 2 seconds
        if (now - this.lastMetricsUpdate < this.metricsUpdateDelay) {
            // Schedule an update after the delay if one isn't already pending
            if (!this.pendingMetricsUpdate) {
                const timeUntilNextUpdate = this.metricsUpdateDelay - (now - this.lastMetricsUpdate);
                this.pendingMetricsUpdate = setTimeout(() => {
                    this.performRealTimeUpdate();
                    this.pendingMetricsUpdate = null;
                }, timeUntilNextUpdate);
            }
            return;
        }

        // Perform immediate update
        this.performRealTimeUpdate();
        this.lastMetricsUpdate = now;
    }

    /**
     * Perform the actual real-time update of metrics and charts
     * This respects the current filter state but updates based on all stored data
     */
    async performRealTimeUpdate() {
        console.log('[UnifiedDashboard] Performing real-time update...');

        // Update metrics cards (these respect filters)
        await this.updateMetricsCards();

        // Update storage indicators (these show total counts, no filters)
        this.updateStorageIndicators();

        // Update timeline chart if it's initialized and the timeline tab is active
        if (this.activeTab === 'timeline' && this.charts.timeline && this.charts.timeline.refresh) {
            await this.charts.timeline.refresh();
        }

        // ALWAYS update analytics charts (they're always visible, just might be collapsed)
        // These include Top Sources, Top Types, Top Subjects, etc.
        if (this.charts.analytics && this.charts.analytics.refresh) {
            await this.charts.analytics.refresh();
        }
    }

    /**
     * Cleanup
     */
    destroy() {
        // Clear pending metrics update
        if (this.pendingMetricsUpdate) {
            clearTimeout(this.pendingMetricsUpdate);
            this.pendingMetricsUpdate = null;
        }

        // Clear all update intervals
        Object.values(this.updateIntervals).forEach(interval => clearInterval(interval));

        // Destroy charts
        Object.values(this.charts).forEach(chart => {
            if (chart && chart.destroy) {
                chart.destroy();
            }
        });
    }
}

// Create and export singleton instance
export const unifiedDashboardController = new UnifiedDashboardController();
