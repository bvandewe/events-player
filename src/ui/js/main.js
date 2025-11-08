/**
 * Main Dashboard Orchestrator
 * Coordinates all dashboard components
 */

import * as bootstrap from 'bootstrap';
import { appState } from './state/appState';
import EventStorageManager from './storage/eventStorage';
import { MetricsController } from './components/metrics';
import { StorageController } from './components/storage';
import { AnalyticsController } from './components/analytics';
import { TimelineController } from './components/timeline';

class MainDashboardController {
    constructor() {
        this.activeTab = 'streams';
        this.storageManager = null;

        // Component controllers
        this.components = {
            metrics: null,
            storage: null,
            analytics: null,
            timeline: null
        };

        // Update throttling
        this.lastUpdate = 0;
        this.updateDelay = 2000; // 2 seconds
        this.pendingUpdate = null;
    }

    /**
     * Initialize the dashboard
     */
    async init() {
        console.log('[MainDashboard] Initializing...');

        // Get singleton storage manager instance
        this.storageManager = EventStorageManager.getInstance();

        // Ensure it's initialized
        if (!this.storageManager.initialized) {
            console.log('[MainDashboard] Waiting for storage manager to initialize...');
            await this.storageManager.init();
        }

        // Setup tab switching
        this.setupTabSwitching();

        // Initialize filter indicator
        this.initFilterIndicator();

        // Initialize metrics cards (always visible)
        this.components.metrics = new MetricsController(this.storageManager);
        await this.components.metrics.init();

        // Initialize storage indicators (always visible)
        this.components.storage = new StorageController(this.storageManager);
        await this.components.storage.init();

        // Initialize analytics charts (always visible)
        this.components.analytics = new AnalyticsController(this.storageManager);
        await this.components.analytics.init();

        // Initialize active tab content
        if (this.activeTab === 'streams') {
            this.initStreamsTab();
        } else {
            await this.initTimelineTab();
        }

        // Subscribe to state changes
        appState.subscribe('filters', () => this.onFiltersChanged());
        appState.subscribe('activeTab', (tab) => this.onTabChanged(tab));

        // Subscribe to new events from SSE - throttled updates
        appState.subscribe('newEvent', () => this.onNewEventReceived());

        console.log('[MainDashboard] Initialized');
    }

    /**
     * Setup tab switching behavior
     */
    setupTabSwitching() {
        const tabButtons = document.querySelectorAll('[data-bs-toggle="tab"]');

        tabButtons.forEach(button => {
            button.addEventListener('shown.bs.tab', async (event) => {
                const target = event.target.getAttribute('data-bs-target');
                const tabName = target.replace('#', '').replace('-pane', '');

                console.log(`[MainDashboard] Switched to ${tabName} tab`);
                this.activeTab = tabName;
                appState.set('activeTab', tabName);

                // Initialize the tab content if needed
                if (tabName === 'timeline') {
                    await this.initTimelineTab();
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
        this.updateFilterIndicator();
        appState.subscribe('filters', () => this.updateFilterIndicator());
    }

    /**
     * Update filter indicator
     */
    updateFilterIndicator() {
        const filters = appState.get('filters');
        const indicator = document.getElementById('activeFiltersIndicator');

        if (!indicator) return;

        const activeFilters = [];
        if (filters.type) activeFilters.push(`Type: ${filters.type}`);
        if (filters.source) activeFilters.push(`Source: ${filters.source}`);
        if (filters.subject) activeFilters.push(`Subject: ${filters.subject}`);
        if (filters.timeRange && filters.timeRange !== 'all') {
            if (filters.timeRange === 'custom') {
                activeFilters.push('Custom Time Range');
            } else {
                activeFilters.push(`Time: ${filters.timeRange}`);
            }
        }

        if (activeFilters.length > 0) {
            indicator.textContent = activeFilters.join(' | ');
            indicator.classList.remove('d-none');
        } else {
            indicator.classList.add('d-none');
        }
    }

    /**
     * Initialize Streams tab
     */
    initStreamsTab() {
        console.log('[MainDashboard] Streams tab active, reloading events with current filters');

        // Event stream is already initialized by sseEventsController in app.js
        // Trigger a reload to apply any active filters
        import('./sse/events').then(({ sseEventsController }) => {
            if (sseEventsController && sseEventsController.loadEventsFromStorage) {
                sseEventsController.loadEventsFromStorage();
            }
        }).catch(err => {
            console.error('[MainDashboard] Failed to reload events:', err);
        });
    }

    /**
     * Initialize Timeline tab
     */
    async initTimelineTab() {
        console.log('[MainDashboard] Initializing Timeline tab...');

        // Initialize timeline if not already done
        if (!this.components.timeline) {
            this.components.timeline = new TimelineController(this.storageManager);
            await this.components.timeline.init();
        }
    }

    /**
     * Handle filter changes
     */
    async onFiltersChanged() {
        console.log('[MainDashboard] Filters changed');

        // Update all components
        if (this.components.metrics) {
            await this.components.metrics.update();
        }
        if (this.components.analytics) {
            await this.components.analytics.update();
        }
        if (this.components.timeline && this.activeTab === 'timeline') {
            if (this.components.timeline.autoRefreshEnabled) {
                await this.components.timeline.refreshChart();
            } else {
                console.log('[MainDashboard] Timeline auto-refresh disabled; skipping real-time chart update');
            }
        }

        // Reload streams if on streams tab
        if (this.activeTab === 'streams') {
            this.initStreamsTab();
        }
    }

    /**
     * Handle tab changes
     */
    onTabChanged(tabName) {
        console.log(`[MainDashboard] Tab changed to ${tabName}`);
        this.activeTab = tabName;
    }

    /**
     * Handle new events received via SSE (throttled)
     */
    onNewEventReceived() {
        const now = Date.now();

        // Throttle updates - update at most every 2 seconds
        if (now - this.lastUpdate < this.updateDelay) {
            // Schedule an update after the delay if one isn't already pending
            if (!this.pendingUpdate) {
                const timeUntilNextUpdate = this.updateDelay - (now - this.lastUpdate);
                this.pendingUpdate = setTimeout(() => {
                    this.performRealTimeUpdate();
                    this.pendingUpdate = null;
                }, timeUntilNextUpdate);
            }
            return;
        }

        // Perform immediate update
        this.performRealTimeUpdate();
        this.lastUpdate = now;
    }

    /**
     * Perform real-time update of all components
     */
    async performRealTimeUpdate() {
        console.log('[MainDashboard] Performing real-time update...');

        // Update all components
        if (this.components.metrics) {
            await this.components.metrics.update();
        }
        if (this.components.storage) {
            this.components.storage.update();
        }
        if (this.components.analytics) {
            await this.components.analytics.update();
        }
        if (this.components.timeline && this.activeTab === 'timeline') {
            if (this.components.timeline.autoRefreshEnabled) {
                await this.components.timeline.refreshChart();
            } else {
                console.log('[MainDashboard] Timeline auto-refresh disabled; skipping throttled chart update');
            }
        }
    }

    /**
     * Cleanup
     */
    destroy() {
        // Clear pending update
        if (this.pendingUpdate) {
            clearTimeout(this.pendingUpdate);
            this.pendingUpdate = null;
        }

        // Destroy all components
        Object.values(this.components).forEach(component => {
            if (component && component.destroy) {
                component.destroy();
            }
        });
    }
}

// Create and export singleton instance
export const dashboardController = new MainDashboardController();
