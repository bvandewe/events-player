/**
 * Unified Dashboard Controller
 * Manages the simplified single-view dashboard with tabs for Streams and Timeline
 */

import * as bootstrap from 'bootstrap';
import { appState } from './state/appState';

class UnifiedDashboardController {
    constructor() {
        this.activeTab = 'streams';
        this.storageManager = null;
        this.charts = {};
        this.updateIntervals = {};
    }

    /**
     * Initialize the unified dashboard
     */
    async init() {
        console.log('[UnifiedDashboard] Initializing...');

        // Import storage manager
        const { storageManager } = await import('./app');
        this.storageManager = storageManager;

        // Setup tab switching
        this.setupTabSwitching();

        // Initialize filter indicator
        this.initFilterIndicator();

        // Initialize metrics cards (they're always visible)
        this.initMetricsCards();

        // Initialize storage indicators
        this.initStorageIndicators();

        // Initialize active tab content
        if (this.activeTab === 'streams') {
            this.initStreamsTab();
        } else {
            this.initTimelineTab();
        }

        // Subscribe to state changes
        appState.subscribe('filters', () => this.onFiltersChanged());
        appState.subscribe('activeTab', (tab) => this.onTabChanged(tab));

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
                    this.initAnalyticsCharts();
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
        // Start updating metrics every 5 seconds
        this.updateMetricsCards();
        this.updateIntervals.metrics = setInterval(() => {
            this.updateMetricsCards();
        }, 5000);
    }

    /**
     * Update metrics cards with current data
     */
    async updateMetricsCards() {
        if (!this.storageManager) return;

        const stats = this.storageManager.getStats();
        const filters = appState.get('filters');

        // Get filtered events if filters are active
        let events = [];
        if (filters.type || filters.source || filters.subject || 
            (filters.timeRange && filters.timeRange !== 'all')) {
            const filterOptions = this.buildFilterOptions(filters);
            events = await this.storageManager.getMetadata(filterOptions);
        } else {
            events = await this.storageManager.getMetadata({ limit: 100000 });
        }

        // Total Events
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
        // Update every 10 seconds
        this.updateStorageIndicators();
        this.updateIntervals.storage = setInterval(() => {
            this.updateStorageIndicators();
        }, 10000);
    }

    /**
     * Update storage indicators
     */
    updateStorageIndicators() {
        if (!this.storageManager) return;

        const stats = this.storageManager.getStats();

        // Recent Events
        const recentPercent = Math.round((stats.recentCount / stats.recentMax) * 100);
        document.getElementById('recentCount').textContent = stats.recentCount.toLocaleString();
        document.getElementById('recentMax').textContent = stats.recentMax.toLocaleString();
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
        const metadataPercent = Math.round((stats.metadataCount / stats.metadataMax) * 100);
        document.getElementById('metadataCount').textContent = stats.metadataCount.toLocaleString();
        document.getElementById('metadataMax').textContent = stats.metadataMax.toLocaleString();
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
    initTimelineTab() {
        console.log('[UnifiedDashboard] Initializing Timeline tab...');

        // Import and initialize timeline chart controller
        import('./timeline').then(({ timelineChartController }) => {
            if (!this.charts.timeline) {
                timelineChartController.init(this.storageManager);
                this.charts.timeline = true;
            }
        });

        // Also initialize the analytics charts (row 5 and 7)
        this.initAnalyticsCharts();
    }

    /**
     * Initialize analytics charts (top sources, types, subjects, hourly, etc.)
     */
    initAnalyticsCharts() {
        console.log('[UnifiedDashboard] Initializing analytics charts...');

        // Import and initialize dashboard chart controllers
        import('./dashboard').then(({ dashboardChartsController }) => {
            if (!this.charts.analytics) {
                dashboardChartsController.init(this.storageManager);
                this.charts.analytics = true;
            }
        });
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
     * Cleanup
     */
    destroy() {
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
