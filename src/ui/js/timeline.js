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

authManager.init().then(() => {
    console.log('[Timeline] Authentication initialized');
    authorizationManager.init(authManager);
}).catch(error => {
    console.error('[Timeline] Failed to initialize authentication:', error);
});

// Initialize storage manager (use singleton - shared with main app)
import EventStorageManager from './storage/eventStorage';

// Import shared SSE connection manager
import { sseConnection } from './sse/connection';

// Import shared connection status manager
import { connectionStatus } from './sse/connectionStatus';

// Import shared filter controller
import { filterController } from './ui/filters';

const storageManager = EventStorageManager.getInstance({
    maxRecentEvents: 5000,
    maxRecentAge: 1800000,
    maxMetadataEvents: 100000,
    maxMetadataAge: 86400000
});

// Timeline Controller
const timelineController = (() => {
    let chart = null;
    let autoRefreshInterval = null;
    let isAutoRefresh = false;

    // DOM elements (will be initialized in init())
    let timeRangeSelect;
    let bucketSizeSelect;
    let typeFilterSelect;
    let sourceFilterSelect;
    let subjectFilterSelect;
    let refreshBtn;
    let autoRefreshBtn;

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

        // Initialize DOM element references
        timeRangeSelect = document.getElementById('timeRange');
        bucketSizeSelect = document.getElementById('bucketSize');
        typeFilterSelect = document.getElementById('typeFilter');
        sourceFilterSelect = document.getElementById('sourceFilter');
        subjectFilterSelect = document.getElementById('subjectFilter');
        refreshBtn = document.getElementById('refreshChart');
        autoRefreshBtn = document.getElementById('autoRefreshToggle');
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
            onMessage: (event) => {
                // Event received - parse and update filter dropdowns
                console.log('[Timeline] New event received via SSE');
                connectionStatus.updateStatus("cleartimer");
                connectionStatus.updateStatus("connect");
                connectionStatus.updateStatus("newtimer");
                try {
                    const eventData = JSON.parse(event.data.replace(/'/g, '"'));
                    const cloudEventData = eventData.cloudevent;
                    if (cloudEventData) {
                        filterController.addEventValues(cloudEventData);
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

        // Initialize filter controller
        await filterController.init({
            storageManager: storageManager,
            selectors: {
                type: 'typeFilter',
                source: 'sourceFilter',
                subject: 'subjectFilter'
            },
            onFilterChange: (filters) => {
                console.log('[Timeline] Filters changed:', filters);
                refreshChart();
            }
        });

        // Load filter options (redundant now, but keep for backwards compatibility)
        await loadFilterOptions();

        // Initialize chart
        initChart();

        // Load initial data
        await refreshChart();

        // Setup event listeners
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
    async function loadFilterOptions() {
        try {
            const types = await storageManager.getUniqueValues('type');
            const sources = await storageManager.getUniqueValues('source');
            const subjects = await storageManager.getUniqueValues('subject');

            // Populate type filter
            typeFilterSelect.innerHTML = '<option value="">All Types</option>';
            types.forEach(type => {
                const option = document.createElement('option');
                option.value = type;
                option.textContent = type;
                typeFilterSelect.appendChild(option);
            });

            // Populate source filter
            sourceFilterSelect.innerHTML = '<option value="">All Sources</option>';
            sources.forEach(source => {
                const option = document.createElement('option');
                option.value = source;
                option.textContent = source;
                sourceFilterSelect.appendChild(option);
            });

            // Populate subject filter
            subjectFilterSelect.innerHTML = '<option value="">All Subjects</option>';
            subjects.forEach(subject => {
                const option = document.createElement('option');
                option.value = subject;
                // Display (empty) for empty subjects
                option.textContent = subject || '(empty)';
                subjectFilterSelect.appendChild(option);
            });

        } catch (error) {
            console.error('[Timeline] Error loading filter options:', error);
        }
    }

    /**
     * Refresh the chart with current filters
     */
    async function refreshChart() {
        try {
            console.log('[Timeline] Refreshing chart...');

            // Get filter values
            const bucketSize = parseInt(bucketSizeSelect.value);
            const timeRangeMinutes = timeRangeSelect.value;
            const typeFilter = typeFilterSelect.value;
            const sourceFilter = sourceFilterSelect.value;
            const subjectFilter = subjectFilterSelect.value;

            console.log('[Timeline] Filters:', { bucketSize, timeRangeMinutes, typeFilter, sourceFilter, subjectFilter });

            // Calculate time range
            let startTime = null;
            let endTime = Date.now();

            if (timeRangeMinutes !== 'all') {
                startTime = endTime - (parseInt(timeRangeMinutes) * 60000);
            }

            console.log('[Timeline] Time range:', {
                startTime,
                endTime,
                startTimeDate: startTime ? new Date(startTime).toISOString() : null,
                endTimeDate: new Date(endTime).toISOString(),
                rangeMinutes: timeRangeMinutes
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
                }).filter(bucket => bucket.count > 0);
            } else {
                filteredData = aggregatedData.map(bucket => ({
                    timestamp: bucket.timestamp,
                    count: bucket.count
                }));
            }

            console.log('[Timeline] Filtered data:', filteredData ? filteredData.length : 'null', 'buckets');

            // Update chart
            updateChart(filteredData);

            // Calculate and update statistics
            updateStatistics(filteredData, bucketSize);

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

        // Get current filter values
        const bucketSize = parseInt(bucketSizeSelect.value);
        const typeFilter = typeFilterSelect.value;
        const sourceFilter = sourceFilterSelect.value;
        const subjectFilter = subjectFilterSelect.value;

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
     * Toggle auto-refresh
     */
    function toggleAutoRefresh() {
        isAutoRefresh = !isAutoRefresh;

        if (isAutoRefresh) {
            autoRefreshBtn.innerHTML = '<i class="bi bi-pause-fill"></i> Auto-refresh (On)';
            autoRefreshBtn.classList.remove('btn-outline-secondary');
            autoRefreshBtn.classList.add('btn-success');

            // Refresh every 10 seconds
            autoRefreshInterval = setInterval(refreshChart, 10000);
        } else {
            autoRefreshBtn.innerHTML = '<i class="bi bi-play-fill"></i> Auto-refresh (Off)';
            autoRefreshBtn.classList.remove('btn-success');
            autoRefreshBtn.classList.add('btn-outline-secondary');

            if (autoRefreshInterval) {
                clearInterval(autoRefreshInterval);
                autoRefreshInterval = null;
            }
        }
    }

    /**
     * Setup event listeners
     */
    function setupEventListeners() {
        // Refresh button
        refreshBtn.addEventListener('click', refreshChart);

        // Auto-refresh toggle
        autoRefreshBtn.addEventListener('click', toggleAutoRefresh);

        // Filter changes
        timeRangeSelect.addEventListener('change', refreshChart);
        bucketSizeSelect.addEventListener('change', refreshChart);
        typeFilterSelect.addEventListener('change', refreshChart);
        sourceFilterSelect.addEventListener('change', refreshChart);
        subjectFilterSelect.addEventListener('change', refreshChart);
    }

    /**
     * Cleanup
     */
    function destroy() {
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
        }
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

// Initialize generator form for offcanvas panel
import { generatorForm } from './ui/generatorForm';
generatorForm.init();

// Initialize tooltips
const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
