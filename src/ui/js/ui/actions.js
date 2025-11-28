import { sseEventsController } from '../sse/events';

export const actionsController = (() => {
    var bootstrap;
    var confirmModal;

    const toggleEventDetails = () => {
        var cloudeventMessages = document.getElementsByClassName('accordion-collapse');
        var toggleLink = document.getElementById('expandCollapseLink');
        var toggleIcon = document.getElementById('expandCollapseIcon');

        // Defensive check - if elements don't exist, do nothing
        if (!toggleLink || !toggleIcon) {
            return;
        }

        if (toggleIcon.classList.contains('bi-caret-down-fill')) {
            toggleIcon.classList.remove('bi-caret-down-fill');
            toggleIcon.classList.add('bi-caret-up-fill');
            toggleLink.innerText = 'Expand all';
            toggleLink.appendChild(toggleIcon);
        } else {
            toggleIcon.classList.remove('bi-caret-up-fill');
            toggleIcon.classList.add('bi-caret-down-fill');
            toggleLink.innerText = 'Collapse all';
            toggleLink.appendChild(toggleIcon);
        }

        for (var i = 0; i < cloudeventMessages.length; i++) {
            var item = new bootstrap.Collapse(cloudeventMessages[i]);
            item.hide();
        }
    };

    const confirmClearEvents = () => {
        // if there are events, show Confirmation dialog when clicking on the Viewer nav button
        var clearListLink = document.getElementById('clearListLink');
        confirmModal = new bootstrap.Modal(document.getElementById('confirmModal'));
        const events = document.getElementsByClassName('accordion-item');
        console.log(`Deleting ${events.length} events`);
        if (events.length > 0) {
            confirmModal.show();
        }
    };

    const deleteAllEvents = () => {
        if (typeof confirmModal !== 'undefined') {
            var events = document.getElementsByClassName('accordion-item');
            const eventsArray = Array.from(events);
            for (var i = 0; i < eventsArray.length; i++) {
                eventsArray[i].remove();
            }
            document.title = 'CloudEvents Viewer (0)';
            document.getElementById('event-count').innerHTML = 0;
            sseEventsController.resetEventsCount();
            confirmModal.hide();
        }
    };

    const toggleFiltersPanel = () => {
        const filtersPanel = document.getElementById('filtersPanel');
        const toggleIcon = document.getElementById('toggleFiltersIcon');
        const toggleText = document.getElementById('toggleFiltersText');

        if (filtersPanel.style.display === 'none') {
            // Show filters
            filtersPanel.style.display = '';
            toggleIcon.classList.remove('bi-funnel-fill');
            toggleIcon.classList.add('bi-funnel');
            toggleText.textContent = 'Hide Filters';
        } else {
            // Hide filters
            filtersPanel.style.display = 'none';
            toggleIcon.classList.remove('bi-funnel');
            toggleIcon.classList.add('bi-funnel-fill');
            toggleText.textContent = 'Show Filters';
        }
    };

    /**
     * Show a confirmation modal with custom message and callback
     * @param {Object} options - Configuration object
     * @param {string} options.title - Modal title
     * @param {string} options.message - Modal message
     * @param {string} options.confirmText - Confirm button text (default: "Confirm")
     * @param {string} options.confirmClass - Confirm button class (default: "btn-primary")
     * @param {Function} options.onConfirm - Callback function on confirm
     */
    const showConfirm = options => {
        const { title = 'Confirm Action', message = 'Are you sure you want to proceed?', confirmText = 'Confirm', confirmClass = 'btn-primary', onConfirm = () => {} } = options;

        // Get modal elements
        const modalEl = document.getElementById('confirmModal');
        const titleEl = document.getElementById('confirmModalLabel');
        const messageEl = document.getElementById('confirmModalMessage');
        const actionBtn = document.getElementById('confirmModalActionBtn');

        if (!modalEl || !titleEl || !messageEl || !actionBtn) {
            console.error('[Actions] Confirm modal elements not found');
            return;
        }

        // Set content
        titleEl.textContent = title;
        messageEl.innerHTML = message.replace(/\n/g, '<br>');
        actionBtn.textContent = confirmText;

        // Update button class
        actionBtn.className = `btn ${confirmClass}`;

        // Remove old listeners and add new one
        const newActionBtn = actionBtn.cloneNode(true);
        actionBtn.parentNode.replaceChild(newActionBtn, actionBtn);

        newActionBtn.addEventListener('click', () => {
            onConfirm();
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
        });

        // Show modal
        const modal = new bootstrap.Modal(modalEl);
        modal.show();

        // Ensure the confirmation modal and its backdrop are on top
        modalEl.addEventListener(
            'shown.bs.modal',
            () => {
                // Set z-index higher than any other modal
                modalEl.style.zIndex = '1060';

                // Find and update the backdrop z-index
                const backdrops = document.querySelectorAll('.modal-backdrop');
                if (backdrops.length > 0) {
                    const lastBackdrop = backdrops[backdrops.length - 1];
                    lastBackdrop.style.zIndex = '1059';
                }
            },
            { once: true }
        );
    };

    /**
     * Show an error modal with custom message and details
     * @param {Object} options - Configuration object
     * @param {string} options.title - Modal title (default: "Error")
     * @param {string} options.message - User-friendly error message
     * @param {string} options.details - Technical details (optional)
     * @param {Error} options.error - Error object (optional, will extract details from it)
     */
    const showError = options => {
        const { title = 'Error', message = 'An error occurred', details = null, error = null } = options;

        // Get modal elements
        const modalEl = document.getElementById('errorModal');
        const titleEl = document.getElementById('errorModalTitle');
        const messageEl = document.getElementById('errorModalMessage');
        const detailsContainerEl = document.getElementById('errorModalDetails');
        const detailsTextEl = document.getElementById('errorModalDetailsText');

        if (!modalEl || !titleEl || !messageEl || !detailsContainerEl || !detailsTextEl) {
            console.error('[Actions] Error modal elements not found');
            // Fallback to console and alert
            console.error('[Error]', message, details || error);
            alert(`${title}: ${message}`);
            return;
        }

        // Set content
        titleEl.textContent = title;
        messageEl.textContent = message;

        // Handle technical details
        let technicalDetails = details;
        if (!technicalDetails && error) {
            if (error.stack) {
                technicalDetails = error.stack;
            } else if (error.message) {
                technicalDetails = error.message;
            } else {
                technicalDetails = String(error);
            }
        }

        if (technicalDetails) {
            detailsTextEl.textContent = technicalDetails;
            detailsContainerEl.style.display = 'block';
        } else {
            detailsContainerEl.style.display = 'none';
        }

        // Show modal
        const modal = new bootstrap.Modal(modalEl);
        modal.show();

        // Ensure the error modal and its backdrop are on top
        modalEl.addEventListener(
            'shown.bs.modal',
            () => {
                // Set z-index higher than any other modal
                modalEl.style.zIndex = '1070';

                // Find and update the backdrop z-index
                const backdrops = document.querySelectorAll('.modal-backdrop');
                if (backdrops.length > 0) {
                    const lastBackdrop = backdrops[backdrops.length - 1];
                    lastBackdrop.style.zIndex = '1069';
                }
            },
            { once: true }
        );
    };

    /**
     * Show an info/success modal with custom message
     * @param {Object} options - Configuration object
     * @param {string} options.title - Modal title (default: "Information")
     * @param {string} options.message - Info/success message
     * @param {string} options.variant - 'success' or 'info' (default: 'info')
     */
    const showInfo = options => {
        const { title = 'Information', message = '', variant = 'info' } = options;

        // Use the confirm modal but style it as info/success
        const modalEl = document.getElementById('confirmModal');
        const titleEl = document.getElementById('confirmModalLabel');
        const messageEl = document.getElementById('confirmModalMessage');
        const actionBtn = document.getElementById('confirmModalActionBtn');
        const cancelBtn = modalEl?.querySelector('.modal-footer [data-bs-dismiss="modal"]');
        const closeBtn = modalEl?.querySelector('.btn-close');

        if (!modalEl || !titleEl || !messageEl || !actionBtn) {
            console.error('[Actions] Info modal elements not found');
            console.log('[Info]', message);
            return;
        }

        // Set content
        titleEl.textContent = title;
        messageEl.innerHTML = message.replace(/\n/g, '<br>');

        // Hide action button and close X button, show only OK button in footer
        actionBtn.style.display = 'none';
        if (closeBtn) {
            closeBtn.style.display = 'none';
        }

        // Update cancel button to say "OK"
        if (cancelBtn) {
            cancelBtn.textContent = 'OK';
            cancelBtn.className = variant === 'success' ? 'btn btn-success' : 'btn btn-primary';
        }

        // Show modal
        const modal = new bootstrap.Modal(modalEl);
        modal.show();

        // Reset button visibility when modal is hidden
        modalEl.addEventListener(
            'hidden.bs.modal',
            () => {
                actionBtn.style.display = '';
                if (closeBtn) {
                    closeBtn.style.display = '';
                }
                if (cancelBtn) {
                    cancelBtn.textContent = 'Cancel';
                    cancelBtn.className = 'btn btn-secondary';
                }
            },
            { once: true }
        );
    };

    const init = bs => {
        bootstrap = bs;

        var expandCollapse = document.getElementById('expandCollapseLink');
        if (expandCollapse) {
            expandCollapse.addEventListener('click', toggleEventDetails);
        }

        var deleteAllEventsBtn = document.getElementById('deleteAllEventsBtn');
        if (deleteAllEventsBtn) {
            deleteAllEventsBtn.addEventListener('click', deleteAllEvents);
        }

        // Also update the new generic confirm button
        var confirmModalActionBtn = document.getElementById('confirmModalActionBtn');
        if (confirmModalActionBtn) {
            // Default handler for legacy usage
            confirmModalActionBtn.addEventListener('click', deleteAllEvents);
        }

        var toggleFiltersBtn = document.getElementById('toggleFiltersBtn');
        if (toggleFiltersBtn) {
            toggleFiltersBtn.addEventListener('click', toggleFiltersPanel);
        }
    };

    return {
        init,
        showConfirm,
        showError,
        showInfo,
    };
})();
