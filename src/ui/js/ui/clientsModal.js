/**
 * SSE Clients Modal Controller
 * Manages the display of current SSE client statistics and details
 */

import * as bootstrap from 'bootstrap';

export const clientsModalController = (() => {
    let modal = null;
    let isVisible = false;
    let clientCountBadge = null;
    let eventSource = null;
    let badgeEventSource = null;

    // DOM elements
    const elements = {
        totalCount: null,
        totalQueued: null,
        avgUtilization: null,
        slowCount: null,
        tableBody: null,
        noDataAlert: null,
        maxQueueSize: null,
        slowThreshold: null
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
            // Fetch initial data immediately when modal opens
            fetchInitialStats();
            setupSSEConnection();
        });

        modalElement.addEventListener('hidden.bs.modal', () => {
            console.log('[ClientsModal] Modal closed');
            isVisible = false;
            closeSSEConnection();
        });

        // Setup background SSE connection for badge updates
        setupBadgeSSEConnection();

        console.log('[ClientsModal] Initialized');
    };

    /**
     * Setup background SSE connection for badge updates
     * This runs constantly to keep the badge count updated
     */
    const setupBadgeSSEConnection = () => {
        console.log('[ClientsModal] Setting up badge SSE connection...');

        // Close existing connection if any
        if (badgeEventSource) {
            console.log('[ClientsModal] Closing existing badge SSE connection');
            badgeEventSource.close();
            badgeEventSource = null;
        }

        badgeEventSource = new EventSource('/stream/clients');

        badgeEventSource.addEventListener('open', () => {
            console.log('[ClientsModal] Badge SSE connection established');
        });

        badgeEventSource.addEventListener('message', (event) => {
            try {
                const data = JSON.parse(event.data);

                // Update badge with current client count
                updateBadgeCount(data.total_clients);

                // If modal is open, also update the UI
                if (isVisible) {
                    updateUI(data);
                }
            } catch (error) {
                console.error('[ClientsModal] Error parsing badge SSE message:', error);
            }
        });

        badgeEventSource.addEventListener('error', (error) => {
            console.error('[ClientsModal] Badge SSE connection error:', error);

            // If connection fails, try to reconnect after delay
            if (badgeEventSource.readyState === EventSource.CLOSED) {
                console.log('[ClientsModal] Badge SSE connection closed, will reconnect...');
                setTimeout(() => {
                    if (badgeEventSource && badgeEventSource.readyState === EventSource.CLOSED) {
                        setupBadgeSSEConnection();
                    }
                }, 5000);
            }
        });
    };

    /**
     * Fetch initial statistics when modal opens
     */
    const fetchInitialStats = async () => {
        console.log('[ClientsModal] Fetching initial stats...');
        try {
            const response = await fetch('/api/sse/stats');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            updateUI(data);
            console.log('[ClientsModal] Initial stats loaded');
        } catch (error) {
            console.error('[ClientsModal] Error fetching initial stats:', error);
            showError();
        }
    };

    /**
     * Setup SSE connection to listen for client changes when modal is open
     * This provides real-time updates to the modal UI
     */
    const setupSSEConnection = () => {
        console.log('[ClientsModal] Setting up modal SSE connection...');

        // We can reuse the badge connection since it's already streaming
        // Just need to ensure UI updates happen when modal is visible
        // The badge SSE connection will call updateUI when modal is open

        console.log('[ClientsModal] Using shared SSE connection for modal updates');
    };

    /**
     * Close SSE connection
     */
    const closeSSEConnection = () => {
        // We don't close the badge SSE connection when modal closes
        // It continues running in the background to keep badge updated
        console.log('[ClientsModal] Modal closed, SSE continues in background');
    };

    /**
     * Update the UI with fetched data
     */
    const updateUI = (data) => {
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
    const updateTable = (clients) => {
        if (!elements.tableBody) return;

        if (!clients || clients.length === 0) {
            elements.tableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center text-muted py-4">
                        <i class="bi bi-inbox me-2"></i>
                        No clients connected
                    </td>
                </tr>
            `;
            return;
        }

        const rows = clients.map(client => {
            const statusClass = client.is_slow ? 'danger' :
                client.utilization_pct > 50 ? 'warning' : 'success';
            const statusIcon = client.is_slow ? 'hourglass-split' :
                client.utilization_pct > 50 ? 'exclamation-triangle' : 'check-circle';
            const statusText = client.is_slow ? 'Slow' :
                client.utilization_pct > 50 ? 'Busy' : 'Normal';

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
                </tr>
            `;
        }).join('');

        elements.tableBody.innerHTML = rows;
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
    const updateBadgeCount = (count) => {
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
    const escapeHtml = (text) => {
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
        if (badgeEventSource) {
            badgeEventSource.close();
            badgeEventSource = null;
        }
        if (eventSource) {
            eventSource.close();
            eventSource = null;
        }
    };

    return {
        init,
        show,
        hide,
        updateBadgeCount,
        cleanup
    };
})();
