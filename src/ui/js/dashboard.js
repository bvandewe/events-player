import * as bootstrap from 'bootstrap';
import {
    Chart,
    CategoryScale,
    LinearScale,
    TimeScale,
    BarController,
    LineController,
    BarElement,
    LineElement,
    PointElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import * as dateFns from 'date-fns';

// Register Chart.js components
Chart.register(
    CategoryScale,
    LinearScale,
    TimeScale,
    BarController,
    LineController,
    BarElement,
    LineElement,
    PointElement,
    Title,
    Tooltip,
    Legend,
    Filler
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

console.log('[Dashboard] Storage configuration:', storageOptions);

// Get or create singleton storage manager instance (shared across all views)
const storageManager = EventStorageManager.getInstance(storageOptions);

// Dashboard Controller
const dashboardController = (() => {
    let initialized = false;

    let charts = {
        eventsPerMinute: null,
        topTypes: null,
        topSources: null,
        topSubjects: null,
        hourlyDistribution: null
    };

    // Stats elements
    let statTotalEvents;
    let statTotalEventsTime;
    let statAvgRate;
    let statAvgRateTime;
    let statUniqueTypes;
    let statUniqueTypesInfo;
    let statUniqueSources;
    let statUniqueSourcesInfo;

    /**
     * Initialize the dashboard view
     */
    async function init() {
        console.log('[Dashboard] Initializing...');

        // Prevent double initialization
        if (initialized) {
            console.log('[Dashboard] Already initialized, skipping...');
            return;
        }

        // Set flag immediately to prevent race conditions
        initialized = true;

        // Note: Authentication is initialized by app.js which loads first
        // authManager and authorizationManager are available as shared instances

        // Initialize DOM element references
        statTotalEvents = document.getElementById('statTotalEvents');
        statTotalEventsTime = document.getElementById('statTotalEventsTime');
        statAvgRate = document.getElementById('statAvgRate');
        statAvgRateTime = document.getElementById('statAvgRateTime');
        statUniqueTypes = document.getElementById('statUniqueTypes');
        statUniqueTypesInfo = document.getElementById('statUniqueTypesInfo');
        statUniqueSources = document.getElementById('statUniqueSources');
        statUniqueSourcesInfo = document.getElementById('statUniqueSourcesInfo');

        // Initialize storage manager
        await storageManager.init();

        // Get initial event count from storage
        const stats = await storageManager.getStats();
        const initialCount = stats.metadataCount || 0;

        // Initialize connection status manager
        connectionStatus.init();

        // Subscribe to new events via appState (unified dashboard handles SSE)
        appState.subscribe('newEvent', () => {
            console.log('[Dashboard] New event received via appState');
            // Refresh dashboard immediately (no setTimeout delay)
            refreshDashboard().catch(err => console.error('[Dashboard] Refresh failed:', err));
        });

        // Initialize global filters (already initialized in app.js, just ensure it has storage manager)
        if (!globalFilterController.initialized) {
            await globalFilterController.init(storageManager);
        }

        // Subscribe to filter changes to refresh dashboard
        appState.subscribe('filters', (filters) => {
            console.log('[Dashboard] Global filters changed:', filters);
            refreshDashboard();
        });

        // Initialize Bootstrap tooltips
        const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
        const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));

        // Initialize charts
        initCharts();

        // Load initial data
        await refreshDashboard();

        // Setup event listeners (only for dashboard-specific controls)
        setupEventListeners();

        console.log('[Dashboard] Ready');
    }

    /**
     * Initialize all Chart.js charts
     */
    function initCharts() {
        // Events Per Minute Chart (Line Chart) - optional, only if element exists
        const eventsPerMinuteCanvas = document.getElementById('eventsPerMinuteChart');
        if (eventsPerMinuteCanvas) {
            const eventsPerMinuteCtx = eventsPerMinuteCanvas.getContext('2d');
            charts.eventsPerMinute = new Chart(eventsPerMinuteCtx, {
                type: 'line',
                data: {
                    datasets: [{
                        label: 'Events per minute',
                        borderColor: 'rgb(75, 192, 192)',
                        backgroundColor: 'rgba(75, 192, 192, 0.1)',
                        fill: true,
                        tension: 0.4,
                        data: []
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    onClick: (event, activeElements) => {
                        if (activeElements.length > 0) {
                            const dataIndex = activeElements[0].index;
                            const timestamp = charts.eventsPerMinute.data.datasets[0].data[dataIndex].x;
                            handleTimeRangeClick(timestamp, 60000); // 1 minute bucket
                        }
                    },
                    scales: {
                        x: {
                            type: 'time',
                            time: {
                                unit: 'minute',
                                displayFormats: {
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
                            title: {
                                display: true,
                                text: 'Events'
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
                                    return dateFns.format(new Date(context[0].parsed.x), 'PPpp');
                                },
                                afterTitle: () => {
                                    return 'Click to filter events';
                                }
                            }
                        }
                    }
                }
            });
        }

        // Top Event Types Chart (Horizontal Bar Chart)
        const topTypesCtx = document.getElementById('topTypesChart').getContext('2d');
        charts.topTypes = new Chart(topTypesCtx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: 'Count',
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.8)',
                        'rgba(54, 162, 235, 0.8)',
                        'rgba(255, 206, 86, 0.8)',
                        'rgba(75, 192, 192, 0.8)',
                        'rgba(153, 102, 255, 0.8)'
                    ],
                    data: []
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                onClick: (event, activeElements) => {
                    if (activeElements.length > 0) {
                        const dataIndex = activeElements[0].index;
                        const eventType = charts.topTypes.data.labels[dataIndex];
                        handleTypeClick(eventType);
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            afterLabel: () => {
                                return 'Click to filter by type';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        }
                    }
                }
            }
        });

        // Top Sources Chart (Horizontal Bar Chart)
        const topSourcesCtx = document.getElementById('topSourcesChart').getContext('2d');
        charts.topSources = new Chart(topSourcesCtx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: 'Count',
                    backgroundColor: [
                        'rgba(255, 159, 64, 0.8)',
                        'rgba(255, 99, 132, 0.8)',
                        'rgba(54, 162, 235, 0.8)',
                        'rgba(75, 192, 192, 0.8)',
                        'rgba(153, 102, 255, 0.8)'
                    ],
                    data: []
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                onClick: (event, activeElements) => {
                    if (activeElements.length > 0) {
                        const dataIndex = activeElements[0].index;
                        const eventSource = charts.topSources.data.labels[dataIndex];
                        handleSourceClick(eventSource);
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            afterLabel: () => {
                                return 'Click to filter by source';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        }
                    }
                }
            }
        });

        // Top Subjects Chart (Horizontal Bar Chart)
        const topSubjectsCtx = document.getElementById('topSubjectsChart').getContext('2d');
        charts.topSubjects = new Chart(topSubjectsCtx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: 'Count',
                    backgroundColor: [
                        'rgba(255, 206, 86, 0.8)',
                        'rgba(75, 192, 192, 0.8)',
                        'rgba(153, 102, 255, 0.8)',
                        'rgba(255, 159, 64, 0.8)',
                        'rgba(54, 162, 235, 0.8)'
                    ],
                    data: []
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                onClick: (event, activeElements) => {
                    if (activeElements.length > 0) {
                        const dataIndex = activeElements[0].index;
                        const eventSubject = charts.topSubjects.data.labels[dataIndex];
                        handleSubjectClick(eventSubject);
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            afterLabel: () => {
                                return 'Click to filter by subject';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        }
                    }
                }
            }
        });

        // Hourly Distribution Chart (Bar Chart) - optional, only if element exists
        const hourlyDistributionCanvas = document.getElementById('hourlyDistributionChart');
        if (hourlyDistributionCanvas) {
            const hourlyDistributionCtx = hourlyDistributionCanvas.getContext('2d');
            charts.hourlyDistribution = new Chart(hourlyDistributionCtx, {
                type: 'bar',
                data: {
                    labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
                    datasets: [{
                        label: 'Events',
                        backgroundColor: 'rgba(153, 102, 255, 0.8)',
                        data: new Array(24).fill(0)
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    onClick: (event, activeElements) => {
                        if (activeElements.length > 0) {
                            const dataIndex = activeElements[0].index;
                            handleHourClick(dataIndex);
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            callbacks: {
                                afterLabel: () => {
                                    return 'Click to filter by hour';
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                precision: 0
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: 'Hour of Day'
                            }
                        }
                    }
                }
            });
        }
    }

    /**
     * Handle click on time-based chart (Events Per Minute)
     * Navigate to Events view with time range filter
     */
    function handleTimeRangeClick(timestamp, bucketSizeMs) {
        console.log('[Dashboard] Clicked on timestamp:', new Date(timestamp));

        // Get current filter values from global state
        const filters = appState.get('filters');
        const typeFilter = filters.type || '';
        const sourceFilter = filters.source || '';
        const subjectFilter = filters.subject !== null ? filters.subject : '';

        // Calculate time range for the clicked bucket
        const startTime = timestamp;
        const endTime = timestamp + bucketSizeMs;

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
        console.log('[Dashboard] Navigating to Events view with time range:', Object.fromEntries(params));
        window.location.href = `/?${params.toString()}`;
    }

    /**
     * Handle click on event type chart
     * Navigate to Events view filtered by type
     */
    function handleTypeClick(eventType) {
        console.log('[Dashboard] Clicked on event type:', eventType);

        // Update filters to include the clicked type
        const filters = {
            type: eventType,
            source: '',
            subject: null,
            timeRange: appState.get('filters').timeRange || 'all'
        };

        appState.updateFilters(filters);

        // Navigate to Events view
        console.log('[Dashboard] Navigating to Events view with type filter');
        window.location.href = '/';
    }

    /**
     * Handle click on event source chart
     * Navigate to Events view filtered by source
     */
    function handleSourceClick(eventSource) {
        console.log('[Dashboard] Clicked on event source:', eventSource);

        // Update filters to include the clicked source
        const filters = {
            type: '',
            source: eventSource,
            subject: null,
            timeRange: appState.get('filters').timeRange || 'all'
        };

        appState.updateFilters(filters);

        // Navigate to Events view
        console.log('[Dashboard] Navigating to Events view with source filter');
        window.location.href = '/';
    }

    /**
     * Handle click on event subject chart
     * Navigate to Events view filtered by subject
     */
    function handleSubjectClick(eventSubject) {
        console.log('[Dashboard] Clicked on event subject:', eventSubject);

        // Update filters to include the clicked subject
        const filters = {
            type: '',
            source: '',
            subject: eventSubject,
            timeRange: appState.get('filters').timeRange || 'all'
        };

        appState.updateFilters(filters);

        // Navigate to Events view
        console.log('[Dashboard] Navigating to Events view with subject filter');
        window.location.href = '/';
    }

    /**
     * Handle click on hourly distribution chart
     * Navigate to Events view filtered by hour of day
     */
    function handleHourClick(hour) {
        console.log('[Dashboard] Clicked on hour:', hour);

        // Get current filter values
        const filters = appState.get('filters');
        const typeFilter = filters.type || '';
        const sourceFilter = filters.source || '';
        const subjectFilter = filters.subject !== null ? filters.subject : '';

        // Calculate time range for today at the clicked hour
        const now = new Date();
        const startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, 0, 0).getTime();
        const endTime = startTime + (60 * 60 * 1000); // 1 hour

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
        console.log('[Dashboard] Navigating to Events view with hour filter:', Object.fromEntries(params));
        window.location.href = `/?${params.toString()}`;
    }

    /**
     * Refresh all dashboard data and charts
     */
    async function refreshDashboard() {
        console.log('[Dashboard] Refreshing...');

        try {
            // Get filter values from global state
            const filters = appState.get('filters');
            const timeRange = filters.timeRange || 'all';
            const typeFilter = filters.type || '';
            const sourceFilter = filters.source || '';
            const subjectFilter = filters.subject !== null ? filters.subject : '';

            // Calculate time range
            let startTime = null;
            if (timeRange !== 'all') {
                const now = new Date();
                switch (timeRange) {
                    case '1h':
                        startTime = dateFns.subHours(now, 1);
                        break;
                    case '6h':
                        startTime = dateFns.subHours(now, 6);
                        break;
                    case '24h':
                        startTime = dateFns.subHours(now, 24);
                        break;
                    case '7d':
                        startTime = dateFns.subDays(now, 7);
                        break;
                }
            }

            // Build filter object for storage query
            const filter = {
                limit: 10000 // Get up to 10k events for analysis
            };
            if (typeFilter) filter.type = typeFilter;
            if (sourceFilter) filter.source = sourceFilter;
            if (subjectFilter) filter.subject = subjectFilter;
            if (startTime) filter.startTime = startTime.getTime();

            // Get events from storage with filters
            const filteredEvents = await storageManager.getRecentEvents(filter);

            // Get storage statistics
            const storageStats = storageManager.getStats();
            updateStorageIndicators(storageStats);

            // Update statistics
            updateStatistics(filteredEvents, startTime);

            // Update charts
            updateEventsPerMinuteChart(filteredEvents);
            updateTopTypesChart(filteredEvents);
            updateTopSourcesChart(filteredEvents);
            updateTopSubjectsChart(filteredEvents);
            updateHourlyDistributionChart(filteredEvents);

            console.log('[Dashboard] Refresh complete');
        } catch (error) {
            console.error('[Dashboard] Failed to refresh:', error);
        }
    }

    /**
     * Update statistics cards
     */
    function updateStatistics(events, startTime) {
        const total = events.length;
        if (statTotalEvents) statTotalEvents.textContent = total.toLocaleString();

        // Last event received time
        if (total > 0) {
            const lastEvent = events[events.length - 1]; // Events are sorted by timestamp
            if (lastEvent && lastEvent.timestamp) {
                const lastEventTime = new Date(lastEvent.timestamp);
                if (statTotalEventsTime) {
                    statTotalEventsTime.textContent = `Last event: ${dateFns.formatDistanceToNow(lastEventTime, { addSuffix: true })}`;
                }
            } else {
                if (statTotalEventsTime) statTotalEventsTime.textContent = '';
            }
        } else {
            if (statTotalEventsTime) statTotalEventsTime.textContent = '';
        }

        // Calculate average rate
        let avgRate = 0;
        if (total > 0 && startTime) {
            const durationMinutes = (new Date() - startTime) / 60000;
            avgRate = durationMinutes > 0 ? (total / durationMinutes).toFixed(1) : 0;
        } else if (total > 0) {
            // All time - calculate from first to last event
            // Use event.timestamp (milliseconds) to avoid timezone issues
            const times = events.map(e => e.timestamp);
            const firstTime = Math.min(...times);
            const lastTime = Math.max(...times);
            const durationMinutes = (lastTime - firstTime) / 60000;
            avgRate = durationMinutes > 0 ? (total / durationMinutes).toFixed(1) : 0;
        }
        if (statAvgRate) statAvgRate.textContent = avgRate;

        // Last updated time
        if (statAvgRateTime) {
            statAvgRateTime.textContent = `Updated: ${dateFns.formatDistanceToNow(new Date(), { addSuffix: true })}`;
        }

        // Count unique types
        const uniqueTypes = new Set(events.map(e => e.type));
        if (statUniqueTypes) statUniqueTypes.textContent = uniqueTypes.size;

        // Most common type info
        if (uniqueTypes.size > 0) {
            const typeCounts = {};
            events.forEach(e => {
                typeCounts[e.type] = (typeCounts[e.type] || 0) + 1;
            });
            const sortedTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
            const topType = sortedTypes[0];
            if (statUniqueTypesInfo) {
                statUniqueTypesInfo.textContent = `Most common: ${topType[0].split('.').pop()}`;
            }
        } else {
            if (statUniqueTypesInfo) statUniqueTypesInfo.textContent = '';
        }

        // Count unique sources
        const uniqueSources = new Set(events.map(e => e.source));
        if (statUniqueSources) statUniqueSources.textContent = uniqueSources.size;

        // Most common source info
        if (uniqueSources.size > 0) {
            const sourceCounts = {};
            events.forEach(e => {
                sourceCounts[e.source] = (sourceCounts[e.source] || 0) + 1;
            });
            const sortedSources = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]);
            const topSource = sortedSources[0];
            // Extract domain or last part of URL
            const sourceLabel = topSource[0].includes('://')
                ? new URL(topSource[0]).hostname
                : topSource[0].split('/').pop();
            if (statUniqueSourcesInfo) {
                statUniqueSourcesInfo.textContent = `Most common: ${sourceLabel}`;
            }
        } else {
            if (statUniqueSourcesInfo) statUniqueSourcesInfo.textContent = '';
        }
    }

    /**
     * Update storage indicators with visual gauges
     */
    function updateStorageIndicators(stats) {
        const recentCount = stats.recentCount || 0;
        const metadataCount = stats.metadataCount || 0;
        const totalReceived = stats.totalReceived || 0;

        // Get max values from storage manager config
        const maxRecentEvents = 5000; // Default from storageManager config
        const maxMetadataEvents = 100000; // Default from storageManager config

        // Update recent events gauge
        const recentPercent = Math.min((recentCount / maxRecentEvents) * 100, 100);
        const recentProgressBar = document.getElementById('recentProgress');
        const recentPercentSpan = document.getElementById('recentPercent');
        const recentCountSpan = document.getElementById('recentCount');

        if (recentProgressBar && recentPercentSpan && recentCountSpan) {
            recentProgressBar.style.width = `${recentPercent}%`;
            recentProgressBar.setAttribute('aria-valuenow', recentPercent);
            recentPercentSpan.textContent = `${recentPercent.toFixed(1)}%`;
            recentCountSpan.textContent = recentCount.toLocaleString();

            // Change color based on utilization
            recentProgressBar.className = 'progress-bar';
            if (recentPercent >= 90) {
                recentProgressBar.classList.add('bg-danger');
            } else if (recentPercent >= 70) {
                recentProgressBar.classList.add('bg-warning');
            } else {
                recentProgressBar.classList.add('bg-success');
            }
        }

        // Update metadata gauge
        const metadataPercent = Math.min((metadataCount / maxMetadataEvents) * 100, 100);
        const metadataProgressBar = document.getElementById('metadataProgress');
        const metadataPercentSpan = document.getElementById('metadataPercent');
        const metadataCountSpan = document.getElementById('metadataCount');

        if (metadataProgressBar && metadataPercentSpan && metadataCountSpan) {
            metadataProgressBar.style.width = `${metadataPercent}%`;
            metadataProgressBar.setAttribute('aria-valuenow', metadataPercent);
            metadataPercentSpan.textContent = `${metadataPercent.toFixed(1)}%`;
            metadataCountSpan.textContent = metadataCount.toLocaleString();

            // Change color based on utilization
            metadataProgressBar.className = 'progress-bar';
            if (metadataPercent >= 90) {
                metadataProgressBar.classList.add('bg-danger');
            } else if (metadataPercent >= 70) {
                metadataProgressBar.classList.add('bg-warning');
            } else {
                metadataProgressBar.classList.add('bg-info');
            }
        }

        // Calculate and show trimmed events (if totalReceived is less than metadataCount, use metadataCount)
        const actualTotalReceived = Math.max(totalReceived, metadataCount);
        const trimmedCount = actualTotalReceived - metadataCount;
        const trimmedCountSpan = document.getElementById('trimmedCount');
        if (trimmedCountSpan) {
            trimmedCountSpan.textContent = trimmedCount.toLocaleString();
        }

        // Show last cleanup time (always visible)
        const lastCleanupTime = document.getElementById('lastCleanupTime');
        if (lastCleanupTime) {
            if (stats.lastCleanup) {
                const cleanupTime = new Date(stats.lastCleanup);
                lastCleanupTime.textContent = dateFns.format(cleanupTime, 'HH:mm:ss');
            } else {
                lastCleanupTime.textContent = 'Never';
            }
        }
    }

    /**
     * Update Events Per Minute chart
     */
    function updateEventsPerMinuteChart(events) {
        if (!charts.eventsPerMinute) return; // Chart doesn't exist in unified dashboard

        if (events.length === 0) {
            charts.eventsPerMinute.data.datasets[0].data = [];
            charts.eventsPerMinute.update();
            return;
        }

        // Group events by minute
        const buckets = new Map();
        events.forEach(event => {
            // Use event.timestamp (milliseconds) instead of parsing event.time string
            // to avoid timezone issues
            const time = new Date(event.timestamp);
            const bucketKey = dateFns.startOfHour(time).getTime() + Math.floor(time.getMinutes()) * 60000;
            buckets.set(bucketKey, (buckets.get(bucketKey) || 0) + 1);
        });

        // Convert to chart data
        const data = Array.from(buckets.entries())
            .map(([time, count]) => ({ x: time, y: count }))
            .sort((a, b) => a.x - b.x);

        charts.eventsPerMinute.data.datasets[0].data = data;
        charts.eventsPerMinute.update();
    }

    /**
     * Update Top Event Types chart
     */
    function updateTopTypesChart(events) {
        if (events.length === 0) {
            charts.topTypes.data.labels = [];
            charts.topTypes.data.datasets[0].data = [];
            charts.topTypes.update();
            return;
        }

        // Count occurrences of each type
        const typeCounts = new Map();
        events.forEach(event => {
            const type = event.type || 'unknown';
            typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
        });

        // Sort by count and take top 5
        const topTypes = Array.from(typeCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        charts.topTypes.data.labels = topTypes.map(([type]) => type);
        charts.topTypes.data.datasets[0].data = topTypes.map(([, count]) => count);
        charts.topTypes.update();
    }

    /**
     * Update Top Sources chart
     */
    function updateTopSourcesChart(events) {
        if (events.length === 0) {
            charts.topSources.data.labels = [];
            charts.topSources.data.datasets[0].data = [];
            charts.topSources.update();
            return;
        }

        // Count occurrences of each source
        const sourceCounts = new Map();
        events.forEach(event => {
            const source = event.source || 'unknown';
            sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
        });

        // Sort by count and take top 5
        const topSources = Array.from(sourceCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        charts.topSources.data.labels = topSources.map(([source]) => source);
        charts.topSources.data.datasets[0].data = topSources.map(([, count]) => count);
        charts.topSources.update();
    }

    /**
     * Update Top Subjects chart
     */
    function updateTopSubjectsChart(events) {
        if (events.length === 0) {
            charts.topSubjects.data.labels = [];
            charts.topSubjects.data.datasets[0].data = [];
            charts.topSubjects.update();
            return;
        }

        // Count occurrences of each subject
        const subjectCounts = new Map();
        events.forEach(event => {
            const subject = event.subject || 'none';
            subjectCounts.set(subject, (subjectCounts.get(subject) || 0) + 1);
        });

        // Sort by count and take top 5
        const topSubjects = Array.from(subjectCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        charts.topSubjects.data.labels = topSubjects.map(([subject]) => subject);
        charts.topSubjects.data.datasets[0].data = topSubjects.map(([, count]) => count);
        charts.topSubjects.update();
    }

    /**
     * Update Hourly Distribution chart
     */
    function updateHourlyDistributionChart(events) {
        if (!charts.hourlyDistribution) return; // Chart doesn't exist in unified dashboard

        // Initialize all hours to 0
        const hourCounts = new Array(24).fill(0);

        // Count events by hour
        events.forEach(event => {
            // Use event.timestamp (milliseconds) instead of parsing event.time string
            // to avoid timezone issues
            const hour = new Date(event.timestamp).getHours();
            hourCounts[hour]++;
        });

        charts.hourlyDistribution.data.datasets[0].data = hourCounts;
        charts.hourlyDistribution.update();
    }

    /**
     * Setup event listeners (empty now as filters are global)
     */
    function setupEventListeners() {
        // No dashboard-specific event listeners needed
        // Filters are handled globally via appState subscription

        // Setup chart enlarge functionality
        setupChartEnlarge();
    }

    /**
     * Setup chart enlarge functionality
     */
    function setupChartEnlarge() {
        const enlargeButtons = document.querySelectorAll('[data-chart-enlarge]');
        const modal = document.getElementById('chartEnlargeModal');
        const modalTitle = document.getElementById('chartEnlargeModalLabel');
        const enlargedCanvas = document.getElementById('enlargedChart');

        let enlargedChart = null;
        let bsModal = null;

        enlargeButtons.forEach(button => {
            button.addEventListener('click', () => {
                const chartId = button.getAttribute('data-chart-enlarge');
                const chartTitle = button.getAttribute('data-chart-title');

                // Find the source chart
                let sourceChart = null;
                switch (chartId) {
                    case 'eventsPerMinuteChart':
                        sourceChart = charts.eventsPerMinute;
                        break;
                    case 'topTypesChart':
                        sourceChart = charts.topTypes;
                        break;
                    case 'hourlyDistributionChart':
                        sourceChart = charts.hourlyDistribution;
                        break;
                    case 'topSourcesChart':
                        sourceChart = charts.topSources;
                        break;
                }

                if (!sourceChart) {
                    console.error('[Dashboard] Source chart not found:', chartId);
                    return;
                }

                // Set modal title
                modalTitle.textContent = chartTitle;

                // Clone the chart configuration
                const config = {
                    type: sourceChart.config.type,
                    data: JSON.parse(JSON.stringify(sourceChart.data)), // Deep clone
                    options: JSON.parse(JSON.stringify(sourceChart.options)) // Deep clone
                };

                // Adjust options for larger view
                if (config.options.plugins && config.options.plugins.legend) {
                    config.options.plugins.legend.display = true;
                }

                // Re-add onClick handlers (lost during JSON serialization)
                switch (chartId) {
                    case 'eventsPerMinuteChart':
                        config.options.onClick = (event, activeElements) => {
                            if (activeElements.length > 0) {
                                const dataIndex = activeElements[0].index;
                                const timestamp = config.data.datasets[0].data[dataIndex].x;
                                handleTimeRangeClick(timestamp, 60000); // 1 minute bucket
                            }
                        };
                        break;
                    case 'topTypesChart':
                        config.options.onClick = (event, activeElements) => {
                            if (activeElements.length > 0) {
                                const dataIndex = activeElements[0].index;
                                const eventType = config.data.labels[dataIndex];
                                handleTypeClick(eventType);
                            }
                        };
                        break;
                    case 'topSourcesChart':
                        config.options.onClick = (event, activeElements) => {
                            if (activeElements.length > 0) {
                                const dataIndex = activeElements[0].index;
                                const eventSource = config.data.labels[dataIndex];
                                handleSourceClick(eventSource);
                            }
                        };
                        break;
                    case 'hourlyDistributionChart':
                        config.options.onClick = (event, activeElements) => {
                            if (activeElements.length > 0) {
                                const dataIndex = activeElements[0].index;
                                handleHourClick(dataIndex);
                            }
                        };
                        break;
                }

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
        });
    }

    /**
     * Cleanup
     */
    function destroy() {
        // Close shared SSE connection
        sseConnection.close();

        // Destroy all charts
        Object.values(charts).forEach(chart => {
            if (chart) {
                chart.destroy();
            }
        });

        // Reset charts object
        charts = {
            eventsPerMinute: null,
            topTypes: null,
            topSources: null,
            topSubjects: null,
            hourlyDistribution: null
        };

        // Reset initialized flag
        initialized = false;
    }

    return {
        init,
        destroy,
        refresh: refreshDashboard
    };
})();

// Export for use by unified dashboard
export { dashboardController };
