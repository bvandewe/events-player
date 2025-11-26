/**
 * SSE Clients Modal Controller
 * Manages the display of current SSE client statistics and details
 */

import * as bootstrap from 'bootstrap';
import { metadataSSE } from '../sse/metadata.js';
import { authorizationManager } from '../auth/authorization.js';
import { apiFetch } from '../utils/apiClient.js';
import { actionsController } from './actions.js';

export const clientsModalController = (() => {
    let modal = null;
    let isVisible = false;
    let clientCountBadge = null;
    let unsubscribe = null; // Unsubscribe function for metadata stream
    let latestData = null; // Cache the latest SSE data

    // DOM elements
    const elements = {
        totalCount: null,
        totalQueued: null,
        avgUtilization: null,
        slowCount: null,
        tableBody: null,
        noDataAlert: null,
        maxQueueSize: null,
        slowThreshold: null,
    };

    /**
     * Initialize the controller
     */
    const init = () => {
        console.log('[ClientsModal] Initializing...');

        // Get DOM elements
        elements.totalCount = document.getElementById('clientsTotalCount');
        elements.totalQueued = document.getElementById('clientsTotalQueued');
        elements.avgUtilization = document.getElementById('clientsAvgUtilization');
        elements.slowCount = document.getElementById('clientsSlowCount');
        elements.tableBody = document.getElementById('clientsTableBody');
        elements.noDataAlert = document.getElementById('clientsNoDataAlert');
        elements.maxQueueSize = document.getElementById('clientsMaxQueueSize');
        elements.slowThreshold = document.getElementById('clientsSlowThreshold');

        const modalElement = document.getElementById('clientsModal');
        if (!modalElement) {
            console.error('[ClientsModal] Modal element not found');
            return;
        }

        // Initialize Bootstrap modal
        modal = new bootstrap.Modal(modalElement);

        // Listen for modal events
        modalElement.addEventListener('shown.bs.modal', () => {
            console.log('[ClientsModal] Modal opened');
            isVisible = true;

            // If we have cached data from SSE, use it immediately
            if (latestData) {
                console.log('[ClientsModal] Using cached SSE data');
                updateUI(latestData);
            } else {
                // Only fetch if we don't have cached data
                console.log('[ClientsModal] No cached data, fetching...');
                fetchInitialStats();
            }
        });

        modalElement.addEventListener('hidden.bs.modal', () => {
            console.log('[ClientsModal] Modal closed');
            isVisible = false;
        });

        // Subscribe to metadata stream for client updates
        setupMetadataSubscription();

        // Hide admin-only columns if user is not admin
        if (!authorizationManager.isAdmin()) {
            const adminOnlyElements = document.querySelectorAll('.admin-only');
            adminOnlyElements.forEach(el => (el.style.display = 'none'));
        }

        console.log('[ClientsModal] Initialized');
    };

    /**
     * Subscribe to the unified metadata stream for client updates
     */
    const setupMetadataSubscription = () => {
        console.log('[ClientsModal] Subscribing to metadata stream...');

        // Subscribe to 'clients' events from the unified metadata stream
        unsubscribe = metadataSSE.subscribe('clients', data => {
            console.log('[ClientsModal] Received clients update from metadata stream');

            // Cache the latest data
            latestData = data;

            // Update badge with current client count
            updateBadgeCount(data.total_clients);

            // If modal is open, also update the UI
            if (isVisible) {
                updateUI(data);
            }
        });

        console.log('[ClientsModal] Subscribed to metadata stream');
    };

    /**
     * Fetch initial statistics when modal opens
     * Only used if we don't have cached SSE data yet
     */
    const fetchInitialStats = async () => {
        console.log('[ClientsModal] Fetching initial stats from API...');
        try {
            const response = await apiFetch('/api/sse/stats');
            console.log('[ClientsModal] Fetch response status:', response.status);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            console.log('[ClientsModal] Fetched initial stats:', data);
            updateUI(data);
            console.log('[ClientsModal] Initial stats loaded successfully');
        } catch (error) {
            console.error('[ClientsModal] Error fetching initial stats:', error);
            showError();
        }
    };

    /**
     * Update the UI with fetched data
     */
    const updateUI = data => {
        // Update summary cards
        if (elements.totalCount) {
            elements.totalCount.textContent = data.total_clients || 0;
        }
        if (elements.totalQueued) {
            elements.totalQueued.textContent = data.total_queued_events || 0;
        }
        if (elements.avgUtilization) {
            elements.avgUtilization.textContent = `${data.avg_utilization_pct || 0}%`;
        }
        if (elements.slowCount) {
            const slowCount = data.clients ? data.clients.filter(c => c.is_slow).length : 0;
            elements.slowCount.textContent = slowCount;
        }

        // Update footer info
        if (elements.maxQueueSize) {
            elements.maxQueueSize.textContent = data.max_queue_size || '-';
        }
        if (elements.slowThreshold) {
            elements.slowThreshold.textContent = data.slow_client_threshold || '-';
        }

        // Update table
        updateTable(data.clients || []);

        // Show/hide no data alert
        if (elements.noDataAlert) {
            if (!data.clients || data.clients.length === 0) {
                elements.noDataAlert.classList.remove('d-none');
            } else {
                elements.noDataAlert.classList.add('d-none');
            }
        }
    };

    /**
     * Update the clients table
     */
    const updateTable = clients => {
        if (!elements.tableBody) return;

        if (!clients || clients.length === 0) {
            const isAdmin = authorizationManager.isAdmin();
            const colspan = isAdmin ? '5' : '4';
            elements.tableBody.innerHTML = `
                <tr>
                    <td colspan="${colspan}" class="text-center text-muted py-4">
                        <i class="bi bi-inbox me-2"></i>
                        No clients connected
                    </td>
                </tr>
            `;
            return;
        }

        const isAdmin = authorizationManager.isAdmin();
        const rows = clients
            .map(client => {
                const statusClass = client.is_slow ? 'danger' : client.utilization_pct > 50 ? 'warning' : 'success';
                const statusIcon = client.is_slow ? 'hourglass-split' : client.utilization_pct > 50 ? 'exclamation-triangle' : 'check-circle';
                const statusText = client.is_slow ? 'Slow' : client.utilization_pct > 50 ? 'Busy' : 'Normal';

                const disconnectButton = isAdmin
                    ? `
                <td class="text-center admin-only">
                    <button class="btn btn-sm btn-outline-danger disconnect-client-btn"
                            data-client-id="${escapeHtml(client.client_id)}"
                            data-bs-toggle="tooltip"
                            data-bs-title="Disconnect this client">
                        <i class="bi bi-x-circle"></i>
                    </button>
                </td>
            `
                    : '';

                return `
                <tr class="${client.is_slow ? 'table-danger' : ''}">
                    <td>
                        <code class="text-truncate d-inline-block" style="max-width: 400px;">
                            ${escapeHtml(client.client_id)}
                        </code>
                    </td>
                    <td class="text-end">
                        <span class="badge bg-secondary">${client.queue_size}</span>
                        ${client.queue_full ? '<i class="bi bi-exclamation-circle-fill text-danger ms-1" title="Queue Full"></i>' : ''}
                    </td>
                    <td class="text-end">
                        <div class="progress" style="height: 20px; min-width: 100px;">
                            <div class="progress-bar bg-${statusClass}"
                                 role="progressbar"
                                 style="width: ${client.utilization_pct}%"
                                 aria-valuenow="${client.utilization_pct}"
                                 aria-valuemin="0"
                                 aria-valuemax="100">
                                ${client.utilization_pct}%
                            </div>
                        </div>
                    </td>
                    <td class="text-center">
                        <span class="badge bg-${statusClass}">
                            <i class="bi bi-${statusIcon} me-1"></i>${statusText}
                        </span>
                    </td>
                    ${disconnectButton}
                </tr>
            `;
            })
            .join('');

        elements.tableBody.innerHTML = rows;

        // Initialize tooltips for disconnect buttons
        if (isAdmin) {
            const tooltipElements = elements.tableBody.querySelectorAll('[data-bs-toggle="tooltip"]');
            tooltipElements.forEach(el => new bootstrap.Tooltip(el));

            // Add click handlers for disconnect buttons
            const disconnectButtons = elements.tableBody.querySelectorAll('.disconnect-client-btn');
            disconnectButtons.forEach(btn => {
                btn.addEventListener('click', () => handleDisconnectClient(btn.dataset.clientId));
            });
        }
    };

    /**
     * Handle disconnect client button click
     */
    const handleDisconnectClient = async clientId => {
        console.log('[ClientsModal] Disconnect requested for client:', clientId);

        // Show Bootstrap confirmation modal
        actionsController.showConfirm({
            title: 'Disconnect Client',
            message: `Are you sure you want to disconnect client?\n\nClient ID: ${clientId}\n\nThis will force the client to reconnect.`,
            confirmText: 'Disconnect',
            confirmClass: 'btn-danger',
            onConfirm: async () => {
                try {
                    const response = await apiFetch(`/api/sse/disconnect/${encodeURIComponent(clientId)}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                    });

                    if (!response.ok) {
                        const error = await response.json();
                        throw new Error(error.detail || `HTTP error! status: ${response.status}`);
                    }

                    const result = await response.json();
                    console.log('[ClientsModal] Disconnect result:', result);

                    // Show success modal
                    actionsController.showInfo({
                        title: 'Client Disconnected',
                        message: `Client disconnected successfully.\n\nClient ID: ${clientId}\nStatus: ${result.message}`,
                        variant: 'success',
                    });

                    // Refresh the table
                    if (latestData) {
                        // Remove the disconnected client from cached data
                        if (latestData.clients) {
                            latestData.clients = latestData.clients.filter(c => c.client_id !== clientId);
                            latestData.total_clients = latestData.clients.length;
                        }
                        updateUI(latestData);
                    } else {
                        fetchInitialStats();
                    }
                } catch (error) {
                    console.error('[ClientsModal] Error disconnecting client:', error);
                    actionsController.showError({
                        title: 'Disconnect Failed',
                        message: `Failed to disconnect client: ${error.message}`,
                        error: error,
                    });
                }
            },
        });
    };

    /**
     * Show error state
     */
    const showError = () => {
        if (elements.tableBody) {
            elements.tableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center text-danger py-4">
                        <i class="bi bi-exclamation-triangle me-2"></i>
                        Error loading client data
                    </td>
                </tr>
            `;
        }
    };

    /**
     * Update the badge count in the menu
     */
    const updateBadgeCount = count => {
        // Find or create the badge element
        if (!clientCountBadge) {
            const menuItem = document.querySelector('[data-clients-menu]');
            if (menuItem) {
                clientCountBadge = menuItem.querySelector('.badge');
                if (!clientCountBadge) {
                    clientCountBadge = document.createElement('span');
                    clientCountBadge.className = 'badge bg-primary ms-2';
                    menuItem.appendChild(clientCountBadge);
                }
            }
        }

        // Update badge
        if (clientCountBadge && count !== undefined && count !== null) {
            clientCountBadge.textContent = count;
            if (count === 0) {
                clientCountBadge.classList.add('bg-secondary');
                clientCountBadge.classList.remove('bg-primary');
            } else {
                clientCountBadge.classList.add('bg-primary');
                clientCountBadge.classList.remove('bg-secondary');
            }
        }
    };

    /**
     * Escape HTML to prevent XSS
     */
    const escapeHtml = text => {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };

    /**
     * Show the modal
     */
    const show = () => {
        if (modal) {
            modal.show();
        }
    };

    /**
     * Hide the modal
     */
    const hide = () => {
        if (modal) {
            modal.hide();
        }
    };

    /**
     * Cleanup resources (close SSE connections)
     */
    const cleanup = () => {
        console.log('[ClientsModal] Cleaning up resources...');
        if (unsubscribe) {
            unsubscribe();
            unsubscribe = null;
        }
    };

    return {
        init,
        show,
        hide,
        updateBadgeCount,
        cleanup,
    };
})();
