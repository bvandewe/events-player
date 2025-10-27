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
import { format } from 'date-fns';

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

    // DOM elements (will be initialized in init())
    let bucketSizeSelect;

    // Stats elements
    let statTotalEvents;
    let statPeakRate;
    let statAvgRate;
    let statQuietPeriods;

    /**
     * Initialize the timeline view
     */
    async function init() {
        console.log('[Timeline] Initializing...');

        // Initialize authentication
        try {
            await authManager.init();
            console.log('[Timeline] Authentication initialized');
            authorizationManager.init(authManager);
        } catch (error) {
            console.error('[Timeline] Failed to initialize authentication:', error);
        }

        // Initialize DOM element references
        bucketSizeSelect = document.getElementById('bucketSize');
        statTotalEvents = document.getElementById('statTotalEvents');
        statPeakRate = document.getElementById('statPeakRate');
        statAvgRate = document.getElementById('statAvgRate');
        statQuietPeriods = document.getElementById('statQuietPeriods');

        // Initialize storage manager
        await storageManager.init();

        // Get initial event count from storage
        const stats = await storageManager.getStats();
        const initialCount = stats.metadataCount || 0;

        // Initialize connection status manager
        connectionStatus.init();

        // Initialize SSE connection with shared manager
        sseConnection.init({
            initialCount: initialCount,
            onMessage: async (event) => {
                // Event received - parse and update filter dropdowns
                console.log('[Timeline] New event received via SSE');
                connectionStatus.updateStatus("cleartimer");
                connectionStatus.updateStatus("connect");
                connectionStatus.updateStatus("newtimer");
                try {
                    const eventData = JSON.parse(event.data.replace(/'/g, '"'));
                    const cloudEventData = eventData.cloudevent;
                    if (cloudEventData) {
                        // Store event in storage manager (both tiers)
                        storageManager.addEvent(cloudEventData).catch(err => {
                            console.error('[Timeline] Failed to store event:', err);
                        });

                        // Increment the event counter in the title
                        sseConnection.incrementCount();

                        // Add event values to global filter dropdowns
                        if (globalFilterController.initialized) {
                            globalFilterController.addEventValues(cloudEventData);
                        }

                        // Wait a bit for storage to complete, then refresh chart
                        setTimeout(() => {
                            refreshChart().catch(err => console.error('[Timeline] Refresh failed:', err));
                        }, 500);
                    }
                } catch (error) {
                    console.error('[Timeline] Failed to parse event for filters:', error);
                }
            },
            onOpen: () => {
                console.log('[Timeline] SSE connection established');
                connectionStatus.updateStatus("open");
            },
            onError: (error) => {
                console.error('[Timeline] SSE error:', error);
                connectionStatus.updateStatus("error");
            }
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
                datasets: [{
                    label: 'Events per period',
                    data: [],
                    backgroundColor: 'rgba(75, 192, 192, 0.6)',
                    borderColor: 'rgba(75, 192, 192, 1)',
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
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            title: (context) => {
                                const date = new Date(context[0].parsed.x);
                                return format(date, 'PPpp');
                            },
                            label: (context) => {
                                return `Events: ${context.parsed.y}`;
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
     * Load filter options from storage
     */

    /**
     * Refresh the chart with current filters
     */
    async function refreshChart() {
        try {
            console.log('[Timeline] Refreshing chart...');

            // Get filter values from global state
            const filters = appState.get('filters');
            const bucketSize = parseInt(bucketSizeSelect.value);
            const typeFilter = filters.type || '';
            const sourceFilter = filters.source || '';
            const subjectFilter = filters.subject !== null ? filters.subject : '';
            const timeRange = filters.timeRange || 'all';

            console.log('[Timeline] Filters:', { bucketSize, timeRange, typeFilter, sourceFilter, subjectFilter });

            // Calculate time range
            let startTime = null;
            let endTime = Date.now();

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

            // Query aggregated data
            console.log('[Timeline] Calling getAggregatedStats...');
            const aggregatedData = await storageManager.getAggregatedStats(bucketSize, startTime, endTime);
            console.log('[Timeline] Aggregated data:', aggregatedData ? aggregatedData.length : 'null', 'buckets');

            // Apply type/source/subject filters
            let filteredData = aggregatedData;
            if (typeFilter || sourceFilter || subjectFilter) {
                filteredData = aggregatedData.map(bucket => {
                    let count = 0;

                    if (typeFilter || sourceFilter || subjectFilter) {
                        // Multiple filters: count only events matching all specified filters
                        const filters = [];
                        if (typeFilter) filters.push(bucket.types[typeFilter] || 0);
                        if (sourceFilter) filters.push(bucket.sources[sourceFilter] || 0);
                        if (subjectFilter) filters.push(bucket.subjects[subjectFilter] || 0);

                        // Use minimum count as approximate intersection
                        count = Math.min(...filters);
                    }

                    return {
                        timestamp: bucket.timestamp,
                        count: count
                    };
                });
            } else {
                filteredData = aggregatedData.map(bucket => ({
                    timestamp: bucket.timestamp,
                    count: bucket.count
                }));
            }

            console.log('[Timeline] Filtered data:', filteredData ? filteredData.length : 'null', 'buckets');

            // Calculate and update statistics (using all data including zeros)
            updateStatistics(filteredData, bucketSize);

            // Filter out zero buckets for display only
            const displayData = filteredData.filter(bucket => bucket.count > 0);

            // Update chart (display only non-zero buckets)
            updateChart(displayData);

            console.log('[Timeline] Chart refresh complete');

        } catch (error) {
            console.error('[Timeline] Error refreshing chart:', error);
        }
    }

    /**
     * Update the chart with new data
     */
    function updateChart(data) {
        console.log('[Timeline] updateChart called with:', data ? data.length : 'null', 'data points');

        if (!chart) {
            console.error('[Timeline] Chart not initialized!');
            return;
        }

        // Transform data for Chart.js
        const chartData = data.map(bucket => ({
            x: bucket.timestamp,
            y: bucket.count
        }));

        console.log('[Timeline] Chart data transformed:', chartData.length, 'points');

        // Update chart data
        chart.data.datasets[0].data = chartData;

        // Determine appropriate time unit based on data range
        if (chartData.length > 0) {
            const firstTime = chartData[0].x;
            const lastTime = chartData[chartData.length - 1].x;
            const range = lastTime - firstTime;

            let timeUnit = 'minute';
            if (range > 86400000) { // > 24 hours
                timeUnit = 'day';
            } else if (range > 3600000) { // > 1 hour
                timeUnit = 'hour';
            } else if (range < 600000) { // < 10 minutes
                timeUnit = 'minute';
            }

            chart.options.scales.x.time.unit = timeUnit;
        }

        chart.update();
    }

    /**
     * Calculate and update statistics
     */
    function updateStatistics(data, bucketSizeMs) {
        if (data.length === 0) {
            statTotalEvents.textContent = '0';
            statPeakRate.textContent = '0/min';
            statAvgRate.textContent = '0/min';
            statQuietPeriods.textContent = '0';
            return;
        }

        // Total events
        const total = data.reduce((sum, bucket) => sum + bucket.count, 0);
        statTotalEvents.textContent = total.toLocaleString();

        // Peak rate (normalize to events per minute)
        const peak = Math.max(...data.map(b => b.count));
        const peakPerMinute = Math.round((peak / bucketSizeMs) * 60000);
        statPeakRate.textContent = `${peakPerMinute}/min`;

        // Average rate
        const avgPerBucket = total / data.length;
        const avgPerMinute = Math.round((avgPerBucket / bucketSizeMs) * 60000);
        statAvgRate.textContent = `${avgPerMinute}/min`;

        // Quiet periods (buckets with 0 events)
        const quietPeriods = data.filter(b => b.count === 0).length;
        statQuietPeriods.textContent = quietPeriods.toLocaleString();
    }

    /**
     * Handle chart click to drill down into time period
     * Navigate to Events view with time range and current filters applied
     */
    function handleChartClick(timestamp) {
        console.log('[Timeline] Clicked on timestamp:', new Date(timestamp));

        // Get current filter values from global state
        const bucketSize = parseInt(bucketSizeSelect.value);
        const filters = appState.get('filters');
        const typeFilter = filters.type || '';
        const sourceFilter = filters.source || '';
        const subjectFilter = filters.subject !== null ? filters.subject : '';

        // Calculate time range for the clicked bucket
        const startTime = timestamp;
        const endTime = timestamp + bucketSize;

        // Build URL with filter parameters
        const params = new URLSearchParams();
        params.set('startTime', startTime.toString());
        params.set('endTime', endTime.toString());

        if (typeFilter) {
            params.set('type', typeFilter);
        }
        if (sourceFilter) {
            params.set('source', sourceFilter);
        }
        if (subjectFilter) {
            params.set('subject', subjectFilter);
        }

        // Navigate to Events view with filters
        console.log('[Timeline] Navigating to Events view with filters:', Object.fromEntries(params));
        window.location.href = `/?${params.toString()}`;
    }

    /**
     * Setup event listeners
     */
    function setupEventListeners() {
        // Bucket size changes
        bucketSizeSelect.addEventListener('change', refreshChart);

        // Setup chart enlarge functionality
        setupChartEnlarge();
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
        }
    }

    return {
        init,
        destroy
    };
})();

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => timelineController.init());
} else {
    timelineController.init();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => timelineController.destroy());

// Initialize keyboard shortcuts
import { keyboardController } from './ux/keyb-nav';
keyboardController.init(bootstrap);

// Initialize tasks modal controller
import { tasksModalController } from './ui/tasksModal';
tasksModalController.init();
// Make it globally available for auth dropdown
window.tasksModalController = tasksModalController;

// Initialize clients modal controller
import { clientsModalController } from './ui/clientsModal';
clientsModalController.init();
// Make it globally available for auth dropdown
window.clientsModalController = clientsModalController;

// Initialize generator form for offcanvas panel
import { generatorForm } from './ui/generatorForm';
generatorForm.init();

// Initialize tooltips
const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
