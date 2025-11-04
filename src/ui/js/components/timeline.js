/**
 * Timeline Component
 * Manages timeline chart with bucket-based visualization
 */

import * as bootstrap from 'bootstrap';
import {
    Chart,
    CategoryScale,
    LinearScale,
    TimeScale,
    BarController,
    BarElement,
    LineElement,
    PointElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import { format, formatDistanceToNow } from 'date-fns';
import { appState } from '../state/appState';
import { actionsController } from '../ui/actions';

// Register Chart.js components
Chart.register(
    CategoryScale,
    LinearScale,
    TimeScale,
    BarController,
    BarElement,
    LineElement,
    PointElement,
    Title,
    Tooltip,
    Legend
);

class TimelineController {
    constructor(storageManager) {
        this.storageManager = storageManager;
        this.chart = null;

        // Throttling for timeline updates
        this.refreshTimer = null;
        this.pendingRefresh = false;

        // Bucket size levels: values in seconds for sub-minute, minutes for >= 1 min
        // Format: {value: number, unit: 'second'|'minute'}
        this.zoomLevels = [
            { value: 1, unit: 'second' },   // 1 second
            { value: 3, unit: 'second' },   // 3 seconds
            { value: 5, unit: 'second' },   // 5 seconds
            { value: 10, unit: 'second' },  // 10 seconds
            { value: 15, unit: 'second' },  // 15 seconds
            { value: 20, unit: 'second' },  // 20 seconds
            { value: 30, unit: 'second' },  // 30 seconds
            { value: 1, unit: 'minute' },   // 1 minute
            { value: 3, unit: 'minute' },   // 3 minutes
            { value: 5, unit: 'minute' },   // 5 minutes
            { value: 10, unit: 'minute' },  // 10 minutes
            { value: 30, unit: 'minute' },  // 30 minutes
            { value: 60, unit: 'minute' }   // 1 hour
        ];

        // Load saved bucket size from localStorage, default to 1 hour (index 12)
        const savedZoomIndex = localStorage.getItem('timeline_bucket_size');
        this.currentZoomIndex = savedZoomIndex !== null ? parseInt(savedZoomIndex, 10) : 12;

        // Validate loaded index
        if (this.currentZoomIndex < 0 || this.currentZoomIndex >= this.zoomLevels.length) {
            this.currentZoomIndex = 12; // Default to 1 hour
        }

        // Auto-refresh state
        this.autoRefreshEnabled = true; // Default to enabled

        // DOM elements (will be initialized in init())
        this.bucketSizeSelect = null;
        this.autoRefreshToggle = null;
        this.statElements = {};
    }

    /**
     * Initialize the timeline
     */
    async init() {
        console.log('[Timeline] Initializing...');

        // Initialize DOM element references
        this.bucketSizeSelect = document.getElementById('timelineBucketSize');
        this.autoRefreshToggle = document.getElementById('timelineAutoRefresh');
        this.statElements = {
            totalEvents: document.getElementById('statTotalEvents'),
            totalEventsTime: document.getElementById('statTotalEventsTime'),
            peakRate: document.getElementById('statPeakRate'),
            peakRateTime: document.getElementById('statPeakRateTime'),
            avgRate: document.getElementById('statAvgRate'),
            avgRateTime: document.getElementById('statAvgRateTime'),
            quietPeriods: document.getElementById('statQuietPeriods'),
            quietPeriodsSize: document.getElementById('statQuietPeriodsSize')
        };

        // Subscribe to new events via appState
        appState.subscribe('newEvent', () => {
            console.log('[Timeline] New event received via appState');
            // Use throttled refresh to avoid updating on every single event
            this.scheduleRefresh(false);
        });

        // Subscribe to filter changes to refresh chart
        appState.subscribe('filters', (filters) => {
            console.log('[Timeline] Global filters changed:', filters);
            // Immediate refresh on filter changes
            this.scheduleRefresh(true);
        });

        // Initialize chart
        this.initChart();

        // Load initial data
        await this.refreshChart();

        // Setup event listeners
        this.setupEventListeners();

        console.log('[Timeline] Initialized');
    }

    /**
     * Initialize the Chart.js chart
     */
    initChart() {
        const canvasElement = document.getElementById('timelineChart');

        if (!canvasElement) {
            console.warn('[Timeline] Canvas element "timelineChart" not found in DOM');
            return;
        }

        const ctx = canvasElement.getContext('2d');

        // Get bucket size info
        const bucketInfo = this.getBucketSize();
        let timeUnit;

        // Chart.js time units: 'millisecond', 'second', 'minute', 'hour', 'day', 'week', 'month', 'quarter', 'year'
        if (bucketInfo.unit === 'second') {
            if (bucketInfo.value < 60) {
                timeUnit = 'second';
            } else {
                timeUnit = 'minute';
            }
        } else {
            // bucketInfo.unit === 'minute'
            if (bucketInfo.value < 60) {
                timeUnit = 'minute';
            } else {
                timeUnit = 'hour';
            }
        }

        this.chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: 'Events',
                    data: [],
                    backgroundColor: 'rgba(13, 110, 253, 0.7)',
                    borderColor: 'rgba(13, 110, 253, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: timeUnit,
                            displayFormats: {
                                second: 'HH:mm:ss',
                                minute: 'HH:mm',
                                hour: 'HH:mm'
                            }
                        },
                        title: {
                            display: true,
                            text: 'Time'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        },
                        title: {
                            display: true,
                            text: 'Event Count'
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            title: (tooltipItems) => {
                                if (!tooltipItems || tooltipItems.length === 0) return '';
                                const timestamp = tooltipItems[0].parsed.x;
                                return format(new Date(timestamp), 'PPpp');
                            },
                            label: (context) => {
                                const count = context.parsed.y;
                                return `Events: ${count}`;
                            }
                        }
                    },
                    legend: {
                        display: false
                    }
                }
            }
        });
    }

    /**
     * Get bucket size configuration
     */
    getBucketSize() {
        return this.zoomLevels[this.currentZoomIndex];
    }

    /**
     * Get bucket size in milliseconds
     */
    getBucketSizeMs() {
        const bucket = this.getBucketSize();
        if (bucket.unit === 'second') {
            return bucket.value * 1000;
        } else { // minute
            return bucket.value * 60 * 1000;
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

        if (filters.timeRange && filters.timeRange !== 'all') {
            if (filters.timeRange === 'custom') {
                if (filters.customStartTime && filters.customEndTime) {
                    options.startTime = filters.customStartTime;
                    options.endTime = filters.customEndTime;
                }
            } else {
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
     * Schedule refresh (throttled)
     */
    scheduleRefresh(immediate = false) {
        // Don't schedule if auto-refresh is disabled
        if (!this.autoRefreshEnabled && !immediate) {
            console.log('[Timeline] Auto-refresh disabled, skipping scheduled refresh');
            return;
        }

        if (immediate) {
            // Clear any pending refresh and do it now
            if (this.refreshTimer) {
                clearTimeout(this.refreshTimer);
                this.refreshTimer = null;
            }
            this.pendingRefresh = false;
            this.refreshChart();
            return;
        }

        // If a refresh is already scheduled, just mark that we have a pending one
        if (this.refreshTimer) {
            this.pendingRefresh = true;
            return;
        }

        // Schedule a refresh in 2 seconds
        this.refreshTimer = setTimeout(async () => {
            this.refreshTimer = null;
            await this.refreshChart();

            // If another refresh was requested while we were waiting, do one more
            if (this.pendingRefresh) {
                this.pendingRefresh = false;
                this.scheduleRefresh();
            }
        }, 2000);
    }

    /**
     * Refresh chart data
     */
    async refreshChart() {
        if (!this.storageManager || !this.chart) {
            console.warn('[Timeline] Cannot refresh chart - storage or chart not initialized');
            return;
        }

        console.log('[Timeline] Refreshing chart...');

        try {
            // Get filter options
            const filters = appState.get('filters');
            const filterOptions = this.buildFilterOptions(filters);

            // Get events from storage
            const events = await this.storageManager.getRecentEvents({ ...filterOptions, limit: 100000 });

            if (!events || events.length === 0) {
                console.log('[Timeline] No events to display');
                this.chart.data.labels = [];
                this.chart.data.datasets[0].data = [];
                try {
                    this.chart.update();
                } catch (chartError) {
                    console.error('[Timeline] Chart update error (no events):', chartError);
                }
                this.updateStats([]);
                return;
            }

            // Get bucket size
            const bucketSizeMs = this.getBucketSizeMs();

            // Create buckets
            const buckets = {};
            events.forEach(event => {
                const timestamp = new Date(event.time).getTime();
                const bucketTime = Math.floor(timestamp / bucketSizeMs) * bucketSizeMs;
                buckets[bucketTime] = (buckets[bucketTime] || 0) + 1;
            });

            // Sort buckets by time
            const sortedBuckets = Object.entries(buckets)
                .map(([time, count]) => ({ time: parseInt(time), count }))
                .sort((a, b) => a.time - b.time);

            // Update chart
            this.chart.data.labels = sortedBuckets.map(b => b.time);
            this.chart.data.datasets[0].data = sortedBuckets.map(b => b.count);

            try {
                this.chart.update();
            } catch (chartError) {
                console.error('[Timeline] Chart update error:', chartError);

                // Check if this is the time scale error
                if (chartError.message && chartError.message.includes('too far apart with stepSize')) {
                    // Extract timestamps from error message if possible
                    const match = chartError.message.match(/(\d+)\s+and\s+(\d+)\s+are too far apart with stepSize of (\d+)\s+(\w+)/);
                    let errorDetails = chartError.message;

                    if (match) {
                        const [, start, end, stepSize, unit] = match;
                        const startDate = new Date(parseInt(start));
                        const endDate = new Date(parseInt(end));
                        const timeDiff = parseInt(end) - parseInt(start);
                        const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
                        const hoursDiff = Math.floor(timeDiff / (1000 * 60 * 60));

                        errorDetails = `The time range is too large (${daysDiff} days, ${hoursDiff} hours) for the current bucket size (${stepSize} ${unit}).`;
                    }

                    actionsController.showError({
                        title: 'Timeline Display Error',
                        message: 'The selected bucket size is too small for the time range of your events. Please try using a larger bucket size (e.g., minutes or hours instead of seconds).',
                        details: errorDetails
                    });
                } else {
                    // Generic chart error
                    actionsController.showError({
                        title: 'Chart Error',
                        message: 'An error occurred while updating the timeline chart.',
                        error: chartError
                    });
                }

                return; // Don't update stats if chart update failed
            }

            // Update stats
            this.updateStats(sortedBuckets);

            console.log('[Timeline] Chart refreshed with', events.length, 'events in', sortedBuckets.length, 'buckets');
        } catch (error) {
            console.error('[Timeline] Error refreshing chart:', error);

            // Show error modal for unexpected errors
            actionsController.showError({
                title: 'Timeline Error',
                message: 'An unexpected error occurred while refreshing the timeline.',
                error: error
            });
        }
    }

    /**
     * Update statistics
     */
    updateStats(buckets) {
        if (!buckets || buckets.length === 0) {
            // Clear stats
            Object.values(this.statElements).forEach(el => {
                if (el) el.textContent = '0';
            });
            return;
        }

        // Total events
        const totalEvents = buckets.reduce((sum, b) => sum + b.count, 0);
        if (this.statElements.totalEvents) {
            this.statElements.totalEvents.textContent = totalEvents.toLocaleString();
        }

        // Time span
        const firstTime = buckets[0].time;
        const lastTime = buckets[buckets.length - 1].time;
        const timeSpanMs = lastTime - firstTime;

        if (this.statElements.totalEventsTime) {
            this.statElements.totalEventsTime.textContent =
                timeSpanMs > 0 ? formatDistanceToNow(new Date(firstTime), { addSuffix: false }) : 'Now';
        }

        // Peak rate (events per bucket)
        const peakBucket = buckets.reduce((max, b) => b.count > max.count ? b : max, buckets[0]);
        if (this.statElements.peakRate) {
            this.statElements.peakRate.textContent = peakBucket.count.toLocaleString();
        }
        if (this.statElements.peakRateTime) {
            this.statElements.peakRateTime.textContent = format(new Date(peakBucket.time), 'PPpp');
        }

        // Average rate
        const avgRate = (totalEvents / buckets.length).toFixed(1);
        if (this.statElements.avgRate) {
            this.statElements.avgRate.textContent = avgRate;
        }
        if (this.statElements.avgRateTime) {
            const bucketInfo = this.getBucketSize();
            const bucketLabel = `${bucketInfo.value} ${bucketInfo.unit}${bucketInfo.value > 1 ? 's' : ''}`;
            this.statElements.avgRateTime.textContent = `per ${bucketLabel}`;
        }

        // Quiet periods (buckets with 0 events)
        const quietCount = buckets.filter(b => b.count === 0).length;
        if (this.statElements.quietPeriods) {
            this.statElements.quietPeriods.textContent = quietCount.toLocaleString();
        }
        if (this.statElements.quietPeriodsSize) {
            const bucketInfo = this.getBucketSize();
            this.statElements.quietPeriodsSize.textContent =
                `${bucketInfo.value} ${bucketInfo.unit}${bucketInfo.value > 1 ? 's' : ''}`;
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Bucket size selector
        if (this.bucketSizeSelect) {
            // Populate options
            this.zoomLevels.forEach((level, index) => {
                const option = document.createElement('option');
                option.value = index;
                option.textContent = `${level.value} ${level.unit}${level.value > 1 ? 's' : ''}`;
                if (index === this.currentZoomIndex) {
                    option.selected = true;
                }
                this.bucketSizeSelect.appendChild(option);
            });

            // Change handler
            this.bucketSizeSelect.addEventListener('change', async (e) => {
                this.currentZoomIndex = parseInt(e.target.value, 10);
                localStorage.setItem('timeline_bucket_size', this.currentZoomIndex);
                console.log('[Timeline] Bucket size changed to:', this.getBucketSize());

                // Reinitialize chart with new bucket size
                if (this.chart) {
                    this.chart.destroy();
                }
                this.initChart();
                await this.refreshChart();
            });
        }

        // Auto-refresh toggle
        if (this.autoRefreshToggle) {
            this.autoRefreshToggle.checked = this.autoRefreshEnabled;
            this.autoRefreshToggle.addEventListener('change', (e) => {
                this.autoRefreshEnabled = e.target.checked;
                console.log('[Timeline] Auto-refresh:', this.autoRefreshEnabled ? 'enabled' : 'disabled');
            });
        }
    }

    /**
     * Cleanup
     */
    destroy() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
        // Clear any pending refresh timers
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
        }
        this.pendingRefresh = false;
    }
}

export { TimelineController };
