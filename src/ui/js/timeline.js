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

// Initialize authentication
import { authManager } from './auth/auth';
import { authorizationManager } from './auth/authorization';

// Initialize storage manager (use singleton - shared with main app)
import EventStorageManager from './storage/eventStorage';

// Import shared SSE connection manager
import { sseConnection } from './sse/connection';

// Import shared connection status manager
import { connectionStatus } from './sse/connectionStatus';

// Import global filter controller
import { globalFilterController } from './ui/globalFilters';

// Import appState for filter subscriptions
import { appState } from './state/appState';

// Get body element for data attributes
const bodyElement = document.body;

// Initialize storage configuration from data attributes
const storageOptions = {
    maxRecentEvents: parseInt(bodyElement.getAttribute("data-storage-max-recent-events") || "5000"),
    maxMetadataEvents: parseInt(bodyElement.getAttribute("data-storage-max-metadata-events") || "100000")
};

console.log('[Timeline] Storage configuration:', storageOptions);

// Get or create singleton storage manager instance (shared across all views)
const storageManager = EventStorageManager.getInstance(storageOptions);

// Timeline Controller
const timelineController = (() => {
    let chart = null;
    let initialized = false;

    // Throttling for timeline updates
    let refreshTimer = null;
    let pendingRefresh = false;

    // Bucket size levels: values in seconds for sub-minute, minutes for >= 1 min
    // Format: {value: number, unit: 'second'|'minute'}
    const zoomLevels = [
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
    let currentZoomIndex = savedZoomIndex !== null ? parseInt(savedZoomIndex, 10) : 12;

    // Validate loaded index
    if (currentZoomIndex < 0 || currentZoomIndex >= zoomLevels.length) {
        currentZoomIndex = 12; // Default to 1 hour
    }

    // DOM elements (will be initialized in init())
    let bucketSizeSelect;
    let autoRefreshToggle;

    // Auto-refresh state
    let autoRefreshEnabled = true; // Default to enabled

    // Stats elements
    let statTotalEvents;

    let statTotalEventsTime;
    let statPeakRate;
    let statPeakRateTime;
    let statAvgRate;
    let statAvgRateTime;
    let statQuietPeriods;
    let statQuietPeriodsSize;

    /**
     * Initialize the timeline view
     */
    async function init() {
        console.log('[Timeline] Initializing...');

        // Prevent double initialization
        if (initialized) {
            console.log('[Timeline] Already initialized, skipping...');
            return;
        }

        // Note: Authentication is initialized by app.js which loads first
        // authManager and authorizationManager are available as shared instances

        // Initialize DOM element references
        bucketSizeSelect = document.getElementById('timelineBucketSize');
        autoRefreshToggle = document.getElementById('timelineAutoRefresh');
        statTotalEvents = document.getElementById('statTotalEvents');
        statTotalEventsTime = document.getElementById('statTotalEventsTime');
        statPeakRate = document.getElementById('statPeakRate');
        statPeakRateTime = document.getElementById('statPeakRateTime');
        statAvgRate = document.getElementById('statAvgRate');
        statAvgRateTime = document.getElementById('statAvgRateTime');
        statQuietPeriods = document.getElementById('statQuietPeriods');
        statQuietPeriodsSize = document.getElementById('statQuietPeriodsSize');

        // Initialize storage manager
        await storageManager.init();

        // Get initial event count from storage
        const stats = await storageManager.getStats();
        const initialCount = stats.metadataCount || 0;

        // Initialize connection status manager
        connectionStatus.init();

        // Subscribe to new events via appState (unified dashboard handles SSE)
        appState.subscribe('newEvent', () => {
            console.log('[Timeline] New event received via appState');
            // Use throttled refresh to avoid updating on every single event
            scheduleRefresh(false);
        });

        // Initialize global filters (already initialized in app.js, just ensure it has storage manager)
        if (!globalFilterController.initialized) {
            await globalFilterController.init(storageManager);
        }

        // Subscribe to filter changes to refresh chart
        appState.subscribe('filters', (filters) => {
            console.log('[Timeline] Global filters changed:', filters);
            // Immediate refresh on filter changes
            scheduleRefresh(true);
        });

        // Initialize chart
        initChart();

        // Load initial data
        await refreshChart();

        // Setup event listeners (only for chart-specific controls)
        setupEventListeners();

        // Mark as initialized
        initialized = true;

        console.log('[Timeline] Ready');
    }

    /**
     * Initialize the Chart.js chart
     */
    function initChart() {
        const canvasElement = document.getElementById('timelineChart');

        if (!canvasElement) {
            console.warn('[Timeline] Canvas element "timelineChart" not found in DOM');
            return;
        }

        const ctx = canvasElement.getContext('2d');

        // Plugin to sync left and right y-axes
        const syncYAxesPlugin = {
            id: 'syncYAxes',
            beforeUpdate: (chart) => {
                // Sync happens before update
            },
            afterUpdate: (chart) => {
                // After chart updates, sync right axis to match left axis
                const leftAxis = chart.scales.y;
                const rightAxis = chart.scales.yRight;

                if (leftAxis && rightAxis) {
                    rightAxis.min = leftAxis.min;
                    rightAxis.max = leftAxis.max;
                    rightAxis.ticks = leftAxis.ticks.map(tick => ({ ...tick }));
                }
            }
        };

        chart = new Chart(ctx, {
            type: 'bar',
            data: {
                datasets: [] // Will be populated dynamically per source
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                scales: {
                    x: {
                        type: 'time',
                        stacked: true,
                        offset: false, // Don't add offset - bars should align with time values
                        time: {
                            unit: 'minute',
                            displayFormats: {
                                minute: 'HH:mm',
                                hour: 'HH:mm',
                                day: 'MMM dd'
                            }
                        },
                        title: {
                            display: true,
                            text: 'Time'
                        },
                        ticks: {
                            source: 'data' // Use data points for tick generation
                        }
                    },
                    y: {
                        beginAtZero: true,
                        stacked: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Event Count'
                        },
                        ticks: {
                            precision: 0
                        }
                    },
                    yRight: {
                        beginAtZero: true,
                        stacked: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Event Count'
                        },
                        ticks: {
                            precision: 0
                        },
                        grid: {
                            drawOnChartArea: false // Don't draw grid lines from right axis
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        callbacks: {
                            title: (context) => {
                                const date = new Date(context[0].parsed.x);
                                return format(date, 'MMM d, HH:mm:ss');
                            },
                            label: (context) => {
                                const total = context.parsed.y;
                                return `${context.dataset.label}: ${total} event${total !== 1 ? 's' : ''}`;
                            },
                            footer: () => {
                                return 'Click to filter this period';
                            }
                        }
                    }
                },
                onClick: (event, elements) => {
                    if (elements.length > 0) {
                        const element = elements[0];
                        const dataIndex = element.index;
                        const dataset = chart.data.datasets[element.datasetIndex];
                        const dataPoint = dataset.data[dataIndex];
                        const timestamp = dataPoint.x;
                        const count = dataPoint.y;

                        // Only handle click if there's data in this bucket
                        if (count > 0) {
                            handleChartClick(timestamp);
                        }
                    }
                }
            },
            plugins: [syncYAxesPlugin]
        });
    }

    /**
     * Get current bucket size in milliseconds
     */
    function getBucketSize() {
        const level = zoomLevels[currentZoomIndex];
        if (level.unit === 'second') {
            return level.value * 1000; // Convert seconds to milliseconds
        } else {
            return level.value * 60000; // Convert minutes to milliseconds
        }
    }

    /**
     * Calculate refresh interval based on bucket size
     * Smaller buckets = more frequent updates
     * Larger buckets = less frequent updates
     */
    function getRefreshInterval() {
        const bucketSize = getBucketSize();

        // Refresh interval is a fraction of the bucket size
        // For smaller buckets (< 5 min), refresh every 1-3 buckets
        // For larger buckets (>= 5 min), refresh every 30-60 seconds
        if (bucketSize < 300000) { // Less than 5 minutes
            // Refresh every 2-3 bucket periods, minimum 2 seconds
            return Math.max(2000, bucketSize * 2);
        } else {
            // For larger buckets, refresh every 30-60 seconds
            return Math.min(60000, bucketSize * 0.1);
        }
    }

    /**
     * Schedule a throttled refresh of the timeline chart
     */
    function scheduleRefresh(immediate = false) {
        // If immediate refresh requested (e.g., filter change), cancel timer and refresh now
        if (immediate) {
            if (refreshTimer) {
                clearTimeout(refreshTimer);
                refreshTimer = null;
            }
            pendingRefresh = false;
            refreshChart().catch(err => console.error('[Timeline] Refresh failed:', err));
            return;
        }

        // Check if auto-refresh is enabled
        if (!autoRefreshEnabled) {
            console.log('[Timeline] Auto-refresh disabled, skipping scheduled refresh');
            return;
        }

        // Mark that we have a pending refresh
        pendingRefresh = true;

        // If timer already running, let it complete
        if (refreshTimer) {
            return;
        }

        // Start new timer
        const interval = getRefreshInterval();
        console.log(`[Timeline] Scheduling refresh in ${interval}ms`);

        refreshTimer = setTimeout(() => {
            refreshTimer = null;
            if (pendingRefresh && autoRefreshEnabled) {
                pendingRefresh = false;
                refreshChart().catch(err => console.error('[Timeline] Refresh failed:', err));
            }
        }, interval);
    }

    /**
     * Refresh the chart with current filters
     */
    async function refreshChart() {
        try {
            console.log('[Timeline] Refreshing chart...');

            // Get filter values from global state
            const filters = appState.get('filters');
            const bucketSize = getBucketSize(); // Use zoom level instead of dropdown
            const typeFilter = filters.type || '';
            const sourceFilter = filters.source || '';
            const subjectFilter = filters.subject !== null ? filters.subject : '';
            const timeRange = filters.timeRange || 'all';

            console.log('[Timeline] Filters:', { bucketSize, timeRange, typeFilter, sourceFilter, subjectFilter });

            // Calculate time range
            let startTime = null;
            const endTime = Date.now(); // Always use current time as end

            if (timeRange !== 'all') {
                // Convert time range from global filter format to milliseconds
                switch (timeRange) {
                    case '1h':
                        startTime = endTime - (60 * 60000);
                        break;
                    case '6h':
                        startTime = endTime - (6 * 60 * 60000);
                        break;
                    case '24h':
                        startTime = endTime - (24 * 60 * 60000);
                        break;
                    case '7d':
                        startTime = endTime - (7 * 24 * 60 * 60000);
                        break;
                }
            }

            console.log('[Timeline] Time range:', {
                startTime,
                endTime,
                startTimeDate: startTime ? new Date(startTime).toISOString() : null,
                endTimeDate: new Date(endTime).toISOString(),
                timeRange: timeRange
            });

            // Build filter object for metadata query
            const filterOptions = { startTime, endTime };
            if (typeFilter) filterOptions.type = typeFilter;
            if (sourceFilter) filterOptions.source = sourceFilter;
            if (subjectFilter) filterOptions.subject = subjectFilter;

            console.log('[Timeline] Query filters:', filterOptions);

            // Query filtered metadata directly
            const metadata = await storageManager.queryMetadata(filterOptions);
            console.log('[Timeline] Filtered metadata:', metadata ? metadata.length : 'null', 'events');

            // Aggregate events into buckets with source tracking
            const buckets = new Map();
            const sources = new Set();

            if (metadata.length > 0) {
                metadata.forEach(m => {
                    const bucketKey = Math.floor(m.timestamp / bucketSize) * bucketSize;
                    const source = m.source || 'unknown';
                    sources.add(source);

                    if (!buckets.has(bucketKey)) {
                        buckets.set(bucketKey, {
                            timestamp: bucketKey,
                            count: 0,
                            sources: new Map()
                        });
                    }

                    const bucket = buckets.get(bucketKey);
                    bucket.count++;
                    bucket.sources.set(source, (bucket.sources.get(source) || 0) + 1);
                });
            }

            // Fill gaps: ensure all buckets from min to current time exist (including empty ones)
            const currentTime = Date.now();
            const currentBucket = Math.floor(currentTime / bucketSize) * bucketSize;

            if (buckets.size > 0) {
                const timestamps = Array.from(buckets.keys()).sort((a, b) => a - b);
                const minTime = timestamps[0];
                // Always extend to current bucket to keep timeline in real-time
                const maxTime = Math.max(timestamps[timestamps.length - 1], currentBucket);

                // Generate all bucket timestamps from min to current time
                for (let time = minTime; time <= maxTime; time += bucketSize) {
                    if (!buckets.has(time)) {
                        buckets.set(time, {
                            timestamp: time,
                            count: 0,
                            sources: new Map()
                        });
                    }
                }

                console.log('[Timeline] Filled gaps: now have', buckets.size, 'total buckets (including empty ones) up to current time');
            } else {
                // No events yet - create empty buckets for recent time based on time range filter
                const minTime = startTime || (currentBucket - (bucketSize * 30)); // Show last 30 buckets if no filter

                for (let time = minTime; time <= currentBucket; time += bucketSize) {
                    buckets.set(time, {
                        timestamp: time,
                        count: 0,
                        sources: new Map()
                    });
                }

                console.log('[Timeline] No events - created', buckets.size, 'empty buckets up to current time');
            }

            // Convert to array and sort by timestamp
            const bucketsArray = Array.from(buckets.values())
                .sort((a, b) => a.timestamp - b.timestamp);

            console.log('[Timeline] Generated buckets:', bucketsArray.length, 'buckets with data from', sources.size, 'sources');

            // Get most recent event for statistics
            const lastEvent = metadata.length > 0 ? metadata[metadata.length - 1] : null;

            // Update statistics and chart
            updateStatistics(bucketsArray, bucketSize, lastEvent);
            updateChart(bucketsArray, Array.from(sources));

            console.log('[Timeline] Chart refresh complete');

        } catch (error) {
            console.error('[Timeline] Error refreshing chart:', error);
        }
    }

    /**
     * Generate a consistent color for a source
     */
    function getSourceColor(source, index) {
        const colors = [
            'rgba(75, 192, 192, 0.8)',   // Teal
            'rgba(255, 99, 132, 0.8)',   // Red
            'rgba(54, 162, 235, 0.8)',   // Blue
            'rgba(255, 206, 86, 0.8)',   // Yellow
            'rgba(153, 102, 255, 0.8)',  // Purple
            'rgba(255, 159, 64, 0.8)',   // Orange
            'rgba(199, 199, 199, 0.8)',  // Gray
            'rgba(83, 102, 255, 0.8)',   // Indigo
            'rgba(255, 99, 255, 0.8)',   // Pink
            'rgba(99, 255, 132, 0.8)'    // Green
        ];

        // Use a simple hash to get consistent color per source
        let hash = 0;
        for (let i = 0; i < source.length; i++) {
            hash = source.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    }

    /**
     * Update the chart with new data
     */
    function updateChart(data, sources = []) {
        console.log('[Timeline] updateChart called with:', data ? data.length : 'null', 'data points and', sources.length, 'sources');

        if (!chart) {
            console.error('[Timeline] Chart not initialized!');
            return;
        }

        const canvas = document.getElementById('timelineChart');
        const container = canvas.parentElement;
        const scrollableContainer = container.parentElement; // The card-body with overflow-x: auto
        const containerWidth = scrollableContainer.offsetWidth; // Visible width

        // Calculate width based on time range rather than fixed bar width
        // This allows bars to scale with bucket size
        const bucketSize = getBucketSize();

        // Target: approximately 40-50px per bucket for good visibility
        const pixelsPerBucket = 45;

        // Number of buckets to show in viewport at once
        const visibleBuckets = 30;

        // Calculate minimum width needed to show visible buckets
        const minVisibleWidth = visibleBuckets * pixelsPerBucket;

        // Calculate total width needed for all buckets
        const totalWidth = Math.max(minVisibleWidth, data.length * pixelsPerBucket);

        // Set canvas container width to allow horizontal scrolling
        container.style.minWidth = `${totalWidth}px`;

        console.log('[Timeline] Canvas sizing:', {
            totalBuckets: data.length,
            pixelsPerBucket: pixelsPerBucket + 'px',
            totalWidth: totalWidth + 'px',
            containerWidth: containerWidth + 'px',
            visibleBuckets: visibleBuckets,
            bucketSize: `${bucketSize / 1000}s`
        });

        // Create dataset per source for stacked bar chart
        const datasets = sources.map((source, index) => ({
            label: source,
            data: data.map(bucket => ({
                x: bucket.timestamp,
                y: bucket.sources.get(source) || 0
            })),
            backgroundColor: getSourceColor(source, index),
            borderWidth: 0,
            barPercentage: 0.95, // Use 95% of available space - small gap for visual separation
            categoryPercentage: 1.0 // Use full category width
        }));

        // Update chart datasets
        chart.data.datasets = datasets;

        // Determine appropriate time unit based on actual data range and zoom level
        if (data.length > 0) {
            const firstTime = data[0].timestamp;
            const lastTime = data[data.length - 1].timestamp;
            const range = lastTime - firstTime;
            const currentLevel = zoomLevels[currentZoomIndex];
            const bucketSize = getBucketSize();

            let timeUnit = 'minute';
            let stepSize = undefined;

            // For second-level zoom, use second unit
            if (currentLevel.unit === 'second') {
                timeUnit = 'second';
                if (currentLevel.value === 1) {
                    stepSize = 10; // Show every 10 seconds at 1-second zoom
                } else {
                    stepSize = 30; // Show every 30 seconds at 30-second zoom
                }
            } else if (range > 7 * 86400000) { // > 7 days
                timeUnit = 'day';
            } else if (range > 86400000) { // > 24 hours
                timeUnit = 'hour';
                stepSize = 6; // Show every 6 hours
            } else if (range > 3600000) { // > 1 hour
                timeUnit = 'minute';
                stepSize = 30; // Show every 30 minutes
            } else {
                timeUnit = 'minute';
                stepSize = 5; // Show every 5 minutes
            }

            chart.options.scales.x.time.unit = timeUnit;
            if (stepSize) {
                chart.options.scales.x.time.stepSize = stepSize;
            } else {
                delete chart.options.scales.x.time.stepSize;
            }

            // Remove x-axis min/max constraints to show all data
            // The horizontal scroll will handle showing the visible portion
            delete chart.options.scales.x.min;
            delete chart.options.scales.x.max;

            console.log('[Timeline] X-axis config:', {
                timeUnit,
                stepSize,
                dataRange: `${(range / 1000).toFixed(0)}s`,
                totalBuckets: data.length
            });
        }

        chart.update();

        // Auto-scroll to the far-right (most recent data) after chart renders
        // Use setTimeout to ensure DOM has updated
        setTimeout(() => {
            scrollableContainer.scrollLeft = scrollableContainer.scrollWidth - scrollableContainer.clientWidth;
            console.log('[Timeline] Auto-scrolled to right:', scrollableContainer.scrollLeft, 'px');
        }, 100);
    }

    /**
     * Calculate and update statistics
     */
    function updateStatistics(data, bucketSizeMs, lastEvent) {
        if (data.length === 0) {
            if (statTotalEvents) statTotalEvents.textContent = '0';
            if (statTotalEventsTime) statTotalEventsTime.textContent = '';
            if (statPeakRate) statPeakRate.textContent = '0/min';
            if (statPeakRateTime) statPeakRateTime.textContent = '';
            if (statAvgRate) statAvgRate.textContent = '0/min';
            if (statAvgRateTime) statAvgRateTime.textContent = '';
            if (statQuietPeriods) statQuietPeriods.textContent = '0';
            if (statQuietPeriodsSize) statQuietPeriodsSize.textContent = '';
            return;
        }

        // Total events
        const total = data.reduce((sum, bucket) => sum + bucket.count, 0);
        if (statTotalEvents) statTotalEvents.textContent = total.toLocaleString();

        // Last event received time
        if (lastEvent && lastEvent.timestamp) {
            const lastEventTime = new Date(lastEvent.timestamp);
            if (statTotalEventsTime) {
                statTotalEventsTime.textContent = `Last event: ${formatDistanceToNow(lastEventTime, { addSuffix: true })}`;
            }
        } else {
            if (statTotalEventsTime) statTotalEventsTime.textContent = '';
        }

        // Peak rate (normalize to events per minute)
        const peak = Math.max(...data.map(b => b.count));
        const peakPerMinute = Math.round((peak / bucketSizeMs) * 60000);
        if (statPeakRate) statPeakRate.textContent = `${peakPerMinute}/min`;

        // Find the timestamp(s) of the peak bucket(s)
        const peakBuckets = data.filter(b => b.count === peak);
        if (peakBuckets.length > 0) {
            if (peakBuckets.length === 1) {
                const peakTime = new Date(peakBuckets[0].timestamp);
                if (statPeakRateTime) statPeakRateTime.textContent = peakTime.toLocaleString();
            } else {
                // Multiple peaks - show count
                if (statPeakRateTime) statPeakRateTime.textContent = `${peakBuckets.length} occurrences`;
            }
        } else {
            if (statPeakRateTime) statPeakRateTime.textContent = '';
        }

        // Average rate
        const avgPerBucket = total / data.length;
        const avgPerMinute = Math.round((avgPerBucket / bucketSizeMs) * 60000);
        if (statAvgRate) statAvgRate.textContent = `${avgPerMinute}/min`;

        // Last updated (current time)
        if (statAvgRateTime) statAvgRateTime.textContent = `Updated: ${formatDistanceToNow(new Date(), { addSuffix: true })}`;

        // Quiet periods (buckets with 0 events)
        const quietPeriods = data.filter(b => b.count === 0).length;
        if (statQuietPeriods) statQuietPeriods.textContent = quietPeriods.toLocaleString();

        // Bucket size description
        const bucketSizeLabels = {
            60000: '1 minute buckets',
            300000: '5 minute buckets',
            900000: '15 minute buckets',
            3600000: '1 hour buckets',
            21600000: '6 hour buckets',
            86400000: '1 day buckets'
        };
        if (statQuietPeriodsSize) {
            statQuietPeriodsSize.textContent = bucketSizeLabels[bucketSizeMs] || `${bucketSizeMs}ms buckets`;
        }
    }

    /**
     * Handle click on a chart bar to filter events by time range
     * Switches to Streams tab and applies time-range filter
     */
    function handleChartClick(timestamp) {
        console.log('[Timeline] Clicked on timestamp:', new Date(timestamp));

        // Get current bucket size from zoom level
        const bucketSize = getBucketSize();

        // Calculate time range for the clicked bucket
        const startTime = timestamp;
        const endTime = timestamp + bucketSize;

        console.log('[Timeline] Filtering events in time range:', {
            startTime: new Date(startTime).toISOString(),
            endTime: new Date(endTime).toISOString(),
            bucketSize: `${bucketSize / 1000}s`
        });

        // Reset all filters first, then apply only the date range filter
        // This ensures a clean filter state focused on the selected time period
        appState.updateFilters({
            type: '',
            source: '',
            subject: null,
            timeRange: 'custom',
            customStartTime: startTime,
            customEndTime: endTime
        });

        // Switch to Streams tab
        appState.set('activeTab', 'streams');

        // Trigger Bootstrap tab switch to streams-pane
        const streamsTab = document.querySelector('#streams-tab');
        if (streamsTab) {
            const tab = new bootstrap.Tab(streamsTab);
            tab.show();
        } else {
            console.warn('[Timeline] Streams tab button not found');
        }
    }    /**
     * Highlight events in the streams list that fall within a time range
     */
    function highlightEventsInTimeRange(startTime, endTime) {
        // Get all event items in the streams list
        const eventItems = document.querySelectorAll('#eventsList .list-group-item');
        let firstMatch = null;

        eventItems.forEach(item => {
            const timestampAttr = item.getAttribute('data-timestamp');
            if (timestampAttr) {
                const eventTime = parseInt(timestampAttr);

                if (eventTime >= startTime && eventTime < endTime) {
                    // Highlight matching events
                    item.classList.add('table-info');
                    if (!firstMatch) firstMatch = item;
                } else {
                    // Remove highlight from non-matching events
                    item.classList.remove('table-info');
                }
            }
        });

        // Scroll to first matching event
        if (firstMatch) {
            firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        // Clear highlights after 3 seconds
        setTimeout(() => {
            eventItems.forEach(item => item.classList.remove('table-info'));
        }, 3000);
    }

    /**
     * Setup event listeners
     */
    function setupEventListeners() {
        // Auto-refresh toggle
        if (autoRefreshToggle) {
            console.log('[Timeline] Setting up auto-refresh toggle');

            // Load saved state from localStorage
            const savedState = localStorage.getItem('timeline_auto_refresh');
            if (savedState !== null) {
                autoRefreshEnabled = savedState === 'true';
                autoRefreshToggle.checked = autoRefreshEnabled;
            }

            autoRefreshToggle.addEventListener('change', (e) => {
                autoRefreshEnabled = e.target.checked;
                console.log('[Timeline] Auto-refresh', autoRefreshEnabled ? 'enabled' : 'disabled');

                // Save to localStorage
                localStorage.setItem('timeline_auto_refresh', autoRefreshEnabled.toString());

                // If auto-refresh was just enabled, trigger an immediate refresh
                if (autoRefreshEnabled) {
                    scheduleRefresh(true);
                }
            });
        } else {
            console.warn('[Timeline] Auto-refresh toggle not found');
        }

        // Bucket size dropdown
        if (bucketSizeSelect) {
            console.log('[Timeline] Setting up bucket size dropdown');

            // Set initial value from loaded state
            bucketSizeSelect.value = currentZoomIndex.toString();

            bucketSizeSelect.addEventListener('change', (e) => {
                const newIndex = parseInt(e.target.value, 10);
                if (newIndex >= 0 && newIndex < zoomLevels.length) {
                    currentZoomIndex = newIndex;
                    const level = zoomLevels[currentZoomIndex];
                    console.log('[Timeline] Bucket size changed to:', e.target.options[e.target.selectedIndex].text, level);

                    // Save to localStorage
                    localStorage.setItem('timeline_bucket_size', currentZoomIndex.toString());

                    // Immediate refresh when zoom level changes
                    scheduleRefresh(true);
                }
            });
        } else {
            console.warn('[Timeline] Bucket size dropdown not found');
        }

        // Setup mouse drag scrolling for timeline
        setupDragScrolling();

        // Setup chart enlarge functionality
        setupChartEnlarge();
    }

    /**
     * Setup drag scrolling for timeline chart
     */
    function setupDragScrolling() {
        const canvas = document.getElementById('timelineChart');
        const scrollContainer = canvas?.parentElement?.parentElement; // The card-body with overflow-x

        if (!scrollContainer) {
            console.warn('[Timeline] Scroll container not found for drag scrolling');
            return;
        }

        let isDown = false;
        let startX;
        let scrollLeft;

        scrollContainer.addEventListener('mousedown', (e) => {
            // Only activate on primary mouse button (left click)
            if (e.button !== 0) return;

            isDown = true;
            scrollContainer.style.cursor = 'grabbing';
            scrollContainer.style.userSelect = 'none';
            startX = e.pageX - scrollContainer.offsetLeft;
            scrollLeft = scrollContainer.scrollLeft;
        });

        scrollContainer.addEventListener('mouseleave', () => {
            isDown = false;
            scrollContainer.style.cursor = 'grab';
            scrollContainer.style.userSelect = '';
        });

        scrollContainer.addEventListener('mouseup', () => {
            isDown = false;
            scrollContainer.style.cursor = 'grab';
            scrollContainer.style.userSelect = '';
        });

        scrollContainer.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - scrollContainer.offsetLeft;
            const walk = (x - startX) * 2; // Scroll speed multiplier
            scrollContainer.scrollLeft = scrollLeft - walk;
        });

        // Set initial cursor
        scrollContainer.style.cursor = 'grab';

        console.log('[Timeline] Drag scrolling enabled');
    }

    /**
     * Setup chart enlarge functionality
     */
    function setupChartEnlarge() {
        const enlargeButton = document.querySelector('[data-chart-enlarge="timelineChart"]');
        const modal = document.getElementById('chartEnlargeModal');
        const modalTitle = document.getElementById('chartEnlargeModalLabel');
        const enlargedCanvas = document.getElementById('enlargedChart');

        let enlargedChart = null;
        let bsModal = null;

        if (!enlargeButton) {
            console.warn('[Timeline] Enlarge button not found');
            return;
        }

        enlargeButton.addEventListener('click', () => {
            const chartTitle = enlargeButton.getAttribute('data-chart-title');

            if (!chart) {
                console.error('[Timeline] Source chart not found');
                return;
            }

            // Set modal title
            modalTitle.textContent = chartTitle;

            // Clone the chart configuration
            const config = {
                type: chart.config.type,
                data: JSON.parse(JSON.stringify(chart.data)), // Deep clone
                options: JSON.parse(JSON.stringify(chart.options)) // Deep clone
            };

            // Adjust options for larger view
            if (config.options.plugins && config.options.plugins.legend) {
                config.options.plugins.legend.display = true;
            }

            // Re-add onClick handler (lost during JSON serialization)
            config.options.onClick = (event, elements) => {
                if (elements.length > 0) {
                    const element = elements[0];
                    const dataIndex = element.index;
                    const timestamp = config.data.datasets[0].data[dataIndex].x;
                    handleChartClick(timestamp);
                }
            };

            // Show modal
            if (!bsModal) {
                bsModal = new bootstrap.Modal(modal);
            }
            bsModal.show();

            // Wait for modal to be shown, then create chart
            modal.addEventListener('shown.bs.modal', () => {
                // Destroy previous enlarged chart if exists
                if (enlargedChart) {
                    enlargedChart.destroy();
                }

                // Create new enlarged chart
                const ctx = enlargedCanvas.getContext('2d');
                enlargedChart = new Chart(ctx, config);
            }, { once: true });

            // Cleanup on modal hide
            modal.addEventListener('hidden.bs.modal', () => {
                if (enlargedChart) {
                    enlargedChart.destroy();
                    enlargedChart = null;
                }
            }, { once: true });
        });
    }

    /**
     * Cleanup
     */
    function destroy() {
        // Close shared SSE connection
        sseConnection.close();
        if (chart) {
            chart.destroy();
            chart = null;
        }
        // Clear any pending refresh timers
        if (refreshTimer) {
            clearTimeout(refreshTimer);
            refreshTimer = null;
        }
        pendingRefresh = false;
        initialized = false;
    }

    return {
        init,
        destroy,
        refresh: refreshChart
    };
})();

// Export for use by unified dashboard
export { timelineController };
