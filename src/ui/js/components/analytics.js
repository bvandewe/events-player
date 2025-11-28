/**
 * Analytics Component
 * Manages analytics charts (Top Sources, Types, Subjects)
 */

import * as bootstrap from 'bootstrap';
import { appState } from '../state/appState';

class AnalyticsController {
    constructor(storageManager) {
        this.storageManager = storageManager;
        this.charts = {};
    }

    /**
     * Initialize analytics charts
     */
    async init() {
        console.log('[Analytics] Initializing...');

        // Import Chart.js dynamically
        const { Chart, registerables } = await import('chart.js');

        // Register components if not already registered
        if (!Chart.getChart('topSourcesChart')) {
            Chart.register(...registerables);
        }

        // Initialize Top Sources Chart
        this.initTopSourcesChart(Chart);

        // Initialize Top Types Chart
        this.initTopTypesChart(Chart);

        // Initialize Top Subjects Chart
        this.initTopSubjectsChart(Chart);

        // Setup enlarge button handlers
        this.setupEnlargeButtons();

        // Initial data update
        await this.update();

        console.log('[Analytics] Initialized');
    }

    /**
     * Initialize Top Sources Chart
     */
    initTopSourcesChart(Chart) {
        const canvas = document.getElementById('topSourcesChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        this.charts.topSources = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Events by Source',
                        data: [],
                        backgroundColor: 'rgba(108, 117, 125, 0.5)',
                        borderColor: 'rgba(108, 117, 125, 1)',
                        borderWidth: 1,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: context => {
                                return `${context.label}: ${context.parsed.x} events (click to filter)`;
                            },
                        },
                    },
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: { precision: 0 },
                    },
                },
                onClick: (event, elements) => {
                    if (elements.length > 0) {
                        const index = elements[0].index;
                        const source = this.charts.topSources.data.labels[index];
                        console.log('[Analytics] Source bar clicked, filtering by source:', source);

                        // Update global filters
                        const currentFilters = appState.get('filters') || {};
                        appState.set('filters', {
                            ...currentFilters,
                            source: source,
                        });
                    }
                },
            },
        });
    }

    /**
     * Initialize Top Types Chart
     */
    initTopTypesChart(Chart) {
        const canvas = document.getElementById('topTypesChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        this.charts.topTypes = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Events by Type',
                        data: [],
                        backgroundColor: 'rgba(25, 135, 84, 0.5)',
                        borderColor: 'rgba(25, 135, 84, 1)',
                        borderWidth: 1,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: context => {
                                return `${context.label}: ${context.parsed.x} events (click to filter)`;
                            },
                        },
                    },
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: { precision: 0 },
                    },
                },
                onClick: (event, elements) => {
                    if (elements.length > 0) {
                        const index = elements[0].index;
                        const type = this.charts.topTypes.data.labels[index];
                        console.log('[Analytics] Type bar clicked, filtering by type:', type);

                        // Update global filters
                        const currentFilters = appState.get('filters') || {};
                        appState.set('filters', {
                            ...currentFilters,
                            type: type,
                        });
                    }
                },
            },
        });
    }

    /**
     * Initialize Top Subjects Chart
     */
    initTopSubjectsChart(Chart) {
        const canvas = document.getElementById('topSubjectsChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        this.charts.topSubjects = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Events by Subject',
                        data: [],
                        backgroundColor: 'rgba(255, 193, 7, 0.5)',
                        borderColor: 'rgba(255, 193, 7, 1)',
                        borderWidth: 1,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: context => {
                                return `${context.label}: ${context.parsed.x} events (click to filter)`;
                            },
                        },
                    },
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: { precision: 0 },
                    },
                },
                onClick: (event, elements) => {
                    if (elements.length > 0) {
                        const index = elements[0].index;
                        const subject = this.charts.topSubjects.data.labels[index];
                        console.log('[Analytics] Subject bar clicked, filtering by subject:', subject);

                        // Update global filters
                        const currentFilters = appState.get('filters') || {};
                        appState.set('filters', {
                            ...currentFilters,
                            subject: subject,
                        });
                    }
                },
            },
        });
    }

    /**
     * Update analytics charts with current data
     */
    async update() {
        if (!this.storageManager) return;

        const filters = appState.get('filters');
        const filterOptions = this.buildFilterOptions(filters);
        const events = await this.storageManager.getRecentEvents({ ...filterOptions, limit: 100000 });

        // Top Sources
        if (this.charts.topSources) {
            const sourceCounts = {};
            events.forEach(e => {
                sourceCounts[e.source] = (sourceCounts[e.source] || 0) + 1;
            });
            const topSources = Object.entries(sourceCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10);

            this.charts.topSources.data.labels = topSources.map(([source]) => source);
            this.charts.topSources.data.datasets[0].data = topSources.map(([, count]) => count);
            this.charts.topSources.update();
        }

        // Top Types
        if (this.charts.topTypes) {
            const typeCounts = {};
            events.forEach(e => {
                typeCounts[e.type] = (typeCounts[e.type] || 0) + 1;
            });
            const topTypes = Object.entries(typeCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10);

            this.charts.topTypes.data.labels = topTypes.map(([type]) => type);
            this.charts.topTypes.data.datasets[0].data = topTypes.map(([, count]) => count);
            this.charts.topTypes.update();
        }

        // Top Subjects
        if (this.charts.topSubjects) {
            const subjectCounts = {};
            events.forEach(e => {
                if (e.subject) {
                    subjectCounts[e.subject] = (subjectCounts[e.subject] || 0) + 1;
                }
            });
            const topSubjects = Object.entries(subjectCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10);

            this.charts.topSubjects.data.labels = topSubjects.map(([subject]) => subject);
            this.charts.topSubjects.data.datasets[0].data = topSubjects.map(([, count]) => count);
            this.charts.topSubjects.update();
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
     * Setup enlarge button handlers
     */
    setupEnlargeButtons() {
        const buttons = [
            { id: 'topSourcesEnlargeBtn', chartKey: 'topSources', title: 'Top Sources' },
            { id: 'topTypesEnlargeBtn', chartKey: 'topTypes', title: 'Top Event Types' },
            { id: 'topSubjectsEnlargeBtn', chartKey: 'topSubjects', title: 'Top Subjects' },
        ];

        buttons.forEach(({ id, chartKey, title }) => {
            const button = document.getElementById(id);
            if (button) {
                button.addEventListener('click', () => this.enlargeChart(chartKey, title));
            }
        });
    }

    /**
     * Enlarge a chart in the modal
     */
    async enlargeChart(chartKey, title) {
        const chart = this.charts[chartKey];
        if (!chart) {
            console.warn(`[Analytics] Chart ${chartKey} not found`);
            return;
        }

        // Set modal title
        const modalLabel = document.getElementById('chartEnlargeModalLabel');
        if (modalLabel) {
            modalLabel.textContent = title;
        }

        // Get enlarged canvas
        const enlargedCanvas = document.getElementById('enlargedChart');
        if (!enlargedCanvas) {
            console.error('[Analytics] Enlarged chart canvas not found');
            return;
        }

        // Destroy existing enlarged chart if any
        if (this.charts.enlarged) {
            this.charts.enlarged.destroy();
        }

        // Import Chart.js
        const { Chart } = await import('chart.js');

        // Clone the chart configuration
        const ctx = enlargedCanvas.getContext('2d');
        this.charts.enlarged = new Chart(ctx, {
            type: chart.config.type,
            data: JSON.parse(JSON.stringify(chart.data)),
            options: JSON.parse(JSON.stringify(chart.options)),
        });

        // Show modal
        const modalElement = document.getElementById('chartEnlargeModal');
        if (modalElement) {
            const modal = new bootstrap.Modal(modalElement);
            modal.show();
        }
    }

    /**
     * Cleanup
     */
    destroy() {
        Object.values(this.charts).forEach(chart => {
            if (chart && chart.destroy) {
                chart.destroy();
            }
        });
    }
}

export { AnalyticsController };
