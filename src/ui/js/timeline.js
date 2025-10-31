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

    // Bucket size levels: values in seconds for sub-minute, minutes for >= 1 min
    // Format: {value: number, unit: 'second'|'minute'}
    const zoomLevels = [
        { value: 1, unit: 'second' },   // 1 second
        { value: 30, unit: 'second' },  // 30 seconds
        { value: 1, unit: 'minute' },   // 1 minute
        { value: 3, unit: 'minute' },   // 3 minutes
        { value: 5, unit: 'minute' },   // 5 minutes
        { value: 10, unit: 'minute' },  // 10 minutes
        { value: 30, unit: 'minute' },  // 30 minutes
        { value: 60, unit: 'minute' }   // 1 hour
    ];

    // Load saved bucket size from localStorage, default to 1 hour (index 7)
    const savedZoomIndex = localStorage.getItem('timeline_bucket_size');
    let currentZoomIndex = savedZoomIndex !== null ? parseInt(savedZoomIndex, 10) : 7;

    // Validate loaded index
    if (currentZoomIndex < 0 || currentZoomIndex >= zoomLevels.length) {
        currentZoomIndex = 7; // Default to 1 hour
    }

    // DOM elements (will be initialized in init())
    let bucketSizeSelect;

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
            // Refresh chart immediately (no setTimeout delay)
            refreshChart().catch(err => console.error('[Timeline] Refresh failed:', err));
        });

        // Initialize global filters (already initialized in app.js, just ensure it has storage manager)
        if (!globalFilterController.initialized) {
            await globalFilterController.init(storageManager);
        }

        // Subscribe to filter changes to refresh chart
        appState.subscribe('filters', (filters) => {
            console.log('[Timeline] Global filters changed:', filters);
            refreshChart();
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
        const ctx = document.getElementById('timelineChart').getContext('2d');

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
                        }
                    },
                    y: {
                        beginAtZero: true,
                        stacked: true,
                        title: {
                            display: true,
                            text: 'Event Count'
                        },
                        ticks: {
                            precision: 0
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
                                return format(date, 'PPpp');
                            },
                            label: (context) => {
                                return `${context.dataset.label}: ${context.parsed.y}`;
                            },
                            afterLabel: () => {
                                return 'Click to view events in this time period';
                            }
                        }
                    }
                },
                onClick: (event, elements) => {
                    if (elements.length > 0) {
                        const element = elements[0];
                        const dataIndex = element.index;
                        const timestamp = chart.data.datasets[0].data[dataIndex].x;
                        handleChartClick(timestamp);
                    }
                }
            }
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

            if (metadata.length === 0) {
                console.log('[Timeline] No events to display');
                updateChart([], []);
                updateStatistics([], bucketSize, null);
                return;
            }

            // Aggregate events into buckets with source tracking
            const buckets = new Map();
            const sources = new Set();

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
        const containerWidth = container.parentElement.offsetWidth; // Parent card-body width

        // Use fixed bar width based on zoom level (more detail = wider bars)
        // This ensures consistent UX across different zoom levels
        // Map zoom index (0-7) to bar width (20px down to 5px)
        const barWidth = Math.max(5, 20 - (currentZoomIndex * 2)); // 20px at level 0, down to 6px at level 7

        // Calculate canvas width to fit all data points with the fixed bar width
        const calculatedWidth = Math.max(containerWidth, data.length * barWidth);

        // Set canvas container width to allow horizontal scrolling
        container.style.minWidth = `${calculatedWidth}px`;

        console.log('[Timeline] Canvas width:', calculatedWidth, 'px for', data.length, 'buckets (', barWidth, 'px per bar, zoom index:', currentZoomIndex, ')');

        // Create dataset per source for stacked bar chart
        const datasets = sources.map((source, index) => ({
            label: source,
            data: data.map(bucket => ({
                x: bucket.timestamp,
                y: bucket.sources.get(source) || 0
            })),
            backgroundColor: getSourceColor(source, index),
            borderWidth: 0,
            barPercentage: 1.0,
            categoryPercentage: 1.0
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

            // Calculate visible window: show approximately container width worth of buckets
            // This makes the x-axis show a fixed number of buckets at a time
            const visibleBuckets = Math.floor(containerWidth / barWidth);
            const visibleTimeRange = visibleBuckets * bucketSize;

            // Set x-axis range to show only the most recent visible window
            // This makes the timeline show buckets properly instead of the entire range
            chart.options.scales.x.min = lastTime - visibleTimeRange;
            chart.options.scales.x.max = lastTime + bucketSize; // Add one bucket padding

            console.log('[Timeline] X-axis window:', {
                visibleBuckets,
                visibleTimeRange: `${visibleTimeRange / 1000}s`,
                min: new Date(chart.options.scales.x.min).toISOString(),
                max: new Date(chart.options.scales.x.max).toISOString()
            });
        }

        chart.update();

        // Auto-scroll to show most recent data (right side)
        // Use requestAnimationFrame to ensure chart has finished rendering
        requestAnimationFrame(() => {
            const scrollContainer = container.parentElement; // The overflow-x container
            if (scrollContainer && scrollContainer.scrollWidth > scrollContainer.clientWidth) {
                scrollContainer.scrollLeft = scrollContainer.scrollWidth - scrollContainer.clientWidth;
                console.log('[Timeline] Auto-scrolled to show most recent data');
            }
        });
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
     * Handle chart click to view events in time range
     * Switches to Streams tab and highlights events in the clicked time bucket
     * Does NOT change any filters - just provides a view into that time period
     */
    function handleChartClick(timestamp) {
        console.log('[Timeline] Clicked on timestamp:', new Date(timestamp));

        // Get current bucket size from zoom level
        const bucketSize = getBucketSize();

        // Calculate time range for the clicked bucket
        const startTime = timestamp;
        const endTime = timestamp + bucketSize; console.log('[Timeline] Viewing events in time range:', {
            startTime: new Date(startTime).toISOString(),
            endTime: new Date(endTime).toISOString()
        });

        // Switch to Streams tab to show the events
        const streamsTab = document.querySelector('[data-bs-target="#streams"]');
        if (streamsTab) {
            const tab = new bootstrap.Tab(streamsTab);
            tab.show();
        }

        // Highlight events in this time range (visual feedback without changing filters)
        highlightEventsInTimeRange(startTime, endTime);
    }

    /**
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

                    refreshChart();
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
