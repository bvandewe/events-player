/**
 * Export Events Controller
 * Provides functionality to export filtered or all events to JSON
 * Restricted to admin and operator roles
 */

import * as bootstrap from 'bootstrap';
import { appState } from '../state/appState';
import { authorizationManager } from '../auth/authorization';

export const exportEventsController = (() => {
    let storageManager = null;
    let exportButton = null;
    let exportModal = null;
    let modalInstance = null;

    /**
     * Initialize the export controller
     */
    const init = storage => {
        storageManager = storage;
        exportButton = document.getElementById('exportEventsBtn');

        if (!exportButton) {
            console.warn('[ExportEvents] Export button not found');
            return;
        }

        console.log('[ExportEvents] Checking authorization...');
        console.log('[ExportEvents] isAdmin:', authorizationManager.isAdmin());
        console.log('[ExportEvents] isOperator:', authorizationManager.isOperator());
        console.log('[ExportEvents] User roles:', authorizationManager.userRoles);

        // Check authorization - only admins and operators can export
        if (!authorizationManager.isOperator()) {
            console.log('[ExportEvents] User not authorized - hiding export button');
            exportButton.style.display = 'none';
            return;
        }

        // Setup click handler
        exportButton.addEventListener('click', showExportModal);

        console.log('[ExportEvents] Initialized and button visible');
    };

    /**
     * Show the export modal to let user choose options
     */
    const showExportModal = () => {
        // Create modal if it doesn't exist
        if (!exportModal) {
            createExportModal();
        }

        // Update the modal with current filter information
        updateModalInfo();

        // Show modal
        if (!modalInstance) {
            modalInstance = new bootstrap.Modal(exportModal);
        }
        modalInstance.show();
    };

    /**
     * Create the export modal HTML
     */
    const createExportModal = () => {
        const modalHtml = `
            <div class="modal fade" id="exportModal" tabindex="-1" aria-labelledby="exportModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="exportModalLabel">
                                <i class="bi bi-download me-2"></i>Export Events
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <p class="text-secondary">Choose what events to export:</p>
                            </div>

                            <div class="form-check mb-3">
                                <input class="form-check-input" type="radio" name="exportType" id="exportFiltered" value="filtered" checked>
                                <label class="form-check-label" for="exportFiltered">
                                    <strong>Filtered Events</strong>
                                    <br>
                                    <small class="text-secondary" id="exportFilteredInfo">Export only the events matching current filters</small>
                                </label>
                            </div>

                            <div class="form-check mb-3">
                                <input class="form-check-input" type="radio" name="exportType" id="exportAll" value="all">
                                <label class="form-check-label" for="exportAll">
                                    <strong>All Events (Tier 1)</strong>
                                    <br>
                                    <small class="text-secondary" id="exportAllInfo">Export all full events from recent storage</small>
                                </label>
                            </div>

                            <div class="alert alert-info mt-3" role="alert">
                                <i class="bi bi-info-circle me-2"></i>
                                <small>Events will be downloaded as a JSON file that you can open, analyze, or share.</small>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary" id="confirmExportBtn">
                                <i class="bi bi-download me-2"></i>Download
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Append modal to body
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = modalHtml;
        document.body.appendChild(tempDiv.firstElementChild);

        exportModal = document.getElementById('exportModal');

        // Setup confirm button handler
        const confirmBtn = document.getElementById('confirmExportBtn');
        confirmBtn.addEventListener('click', handleExport);
    };

    /**
     * Update modal information based on current filters and stats
     */
    const updateModalInfo = async () => {
        if (!storageManager) return;

        const filters = appState.get('filters');
        const stats = storageManager.getStats();

        // Update filtered events info
        const filteredInfo = document.getElementById('exportFilteredInfo');
        if (filteredInfo) {
            const activeFilters = [];
            if (filters.type) activeFilters.push(`type: ${filters.type}`);
            if (filters.source) activeFilters.push(`source: ${filters.source}`);
            if (filters.subject) activeFilters.push(`subject: ${filters.subject}`);
            if (filters.timeRange && filters.timeRange !== 'all') activeFilters.push(`time: ${filters.timeRange}`);

            if (activeFilters.length > 0) {
                filteredInfo.innerHTML = `Export events matching current filters: ${activeFilters.join(', ')}`;
            } else {
                filteredInfo.innerHTML = 'No filters active - will export all visible events';
            }
        }

        // Update all events info
        const allInfo = document.getElementById('exportAllInfo');
        if (allInfo) {
            allInfo.innerHTML = `Export all ${stats.recentCount} full events from Tier 1 storage`;
        }
    };

    /**
     * Handle the export action
     */
    const handleExport = async () => {
        const exportType = document.querySelector('input[name="exportType"]:checked').value;

        try {
            let events = [];
            let filename = '';

            if (exportType === 'filtered') {
                // Export filtered events
                const filters = appState.get('filters');
                const filterOptions = buildFilterOptions(filters);

                events = await storageManager.getRecentEvents(filterOptions);

                // Build filename with filter info
                const filterParts = [];
                if (filters.type) filterParts.push(filters.type.replace(/[^a-z0-9]/gi, '_'));
                if (filters.source) filterParts.push(filters.source.replace(/[^a-z0-9]/gi, '_'));
                if (filters.timeRange && filters.timeRange !== 'all') filterParts.push(filters.timeRange);

                const filterSuffix = filterParts.length > 0 ? `_filtered_${filterParts.join('_')}` : '_filtered';
                filename = `cloudevents${filterSuffix}_${getTimestamp()}.json`;
            } else {
                // Export all events
                events = await storageManager.getRecentEvents({ limit: Number.MAX_SAFE_INTEGER });
                filename = `cloudevents_all_${getTimestamp()}.json`;
            }

            // Clean up internal storage attributes before export
            const cleanedEvents = events.map(event => {
                const { storedAt, insertionOrder, sequenceNumber, ...cleanEvent } = event;
                return cleanEvent;
            });

            // Create download
            downloadJSON(cleanedEvents, filename);

            // Close modal
            if (modalInstance) {
                modalInstance.hide();
            }

            // Show success message
            showSuccessToast(cleanedEvents.length);
        } catch (error) {
            console.error('[ExportEvents] Export failed:', error);
            showErrorToast(error.message);
        }
    };

    /**
     * Build filter options for storage query
     */
    const buildFilterOptions = filters => {
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
                '7d': 604800000,
            };
            const timeMs = ranges[filters.timeRange];
            if (timeMs) {
                options.startTime = now - timeMs;
            }
        }

        return options;
    };

    /**
     * Download data as JSON file
     */
    const downloadJSON = (data, filename) => {
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up
        setTimeout(() => URL.revokeObjectURL(url), 100);
    };

    /**
     * Get formatted timestamp for filename
     */
    const getTimestamp = () => {
        const now = new Date();
        return now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    };

    /**
     * Show success toast notification
     */
    const showSuccessToast = count => {
        const message = `Successfully exported ${count} event${count !== 1 ? 's' : ''}`;

        // Create a simple Bootstrap alert that auto-dismisses
        showNotification(message, 'success');
        console.log(`[ExportEvents] ${message}`);
    };

    /**
     * Show error toast notification
     */
    const showErrorToast = message => {
        showNotification(`Export failed: ${message}`, 'danger');
        console.error(`[ExportEvents] Export failed: ${message}`);
    };

    /**
     * Show a temporary notification banner
     */
    const showNotification = (message, type = 'info') => {
        const alertHtml = `
            <div class="alert alert-${type} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3"
                 role="alert" style="z-index: 9999; min-width: 300px;">
                <i class="bi bi-${type === 'success' ? 'check-circle' : type === 'danger' ? 'exclamation-circle' : 'info-circle'} me-2"></i>
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `;

        const alertDiv = document.createElement('div');
        alertDiv.innerHTML = alertHtml;
        const alert = alertDiv.firstElementChild;
        document.body.appendChild(alert);

        // Auto-dismiss after 3 seconds
        setTimeout(() => {
            const bsAlert = bootstrap.Alert.getOrCreateInstance(alert);
            bsAlert.close();
        }, 3000);

        // Remove from DOM after fade out
        alert.addEventListener('closed.bs.alert', () => {
            alert.remove();
        });
    };

    return {
        init,
    };
})();
