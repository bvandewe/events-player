import * as bootstrap from 'bootstrap';

// Initialize authentication first
import { authManager } from './auth/auth';
import { authorizationManager } from './auth/authorization';

// Initialize event storage manager
import EventStorageManager from './storage/eventStorage';

// Get body element for data attributes
const bodyElement = document.body;

// Initialize storage configuration from data attributes
const storageOptions = {
    maxRecentEvents: parseInt(bodyElement.getAttribute('data-storage-max-recent-events') || '5000'),
    maxMetadataEvents: parseInt(bodyElement.getAttribute('data-storage-max-metadata-events') || '100000'),
};

console.log('[App] Storage configuration:', storageOptions);

// Get or create singleton storage manager instance
const storageManager = EventStorageManager.getInstance(storageOptions);

// Initialize storage manager
storageManager
    .init()
    .then(() => {
        console.log('[App] Storage manager initialized');

        // Initialize global filters after storage is ready
        import('./ui/globalFilters').then(({ globalFilterController }) => {
            globalFilterController
                .init(storageManager)
                .then(() => {
                    console.log('[App] Global filters initialized');
                })
                .catch(error => {
                    console.error('[App] Failed to initialize global filters:', error);
                });
        });

        // Initialize dashboard controller
        import('./main').then(({ dashboardController }) => {
            dashboardController.init();
            console.log('[App] Dashboard initialized');
        });
    })
    .catch(error => {
        console.error('[App] Failed to initialize storage manager:', error);
    });

// Wait for DOM to be ready before initializing auth UI
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuth);
} else {
    initAuth();
}

function initAuth() {
    authManager
        .init()
        .then(() => {
            console.log('[App] Authentication initialized');

            // Initialize authorization based on user roles
            authorizationManager.init(authManager);

            // Initialize export controller AFTER authorization is ready
            import('./ui/exportEvents')
                .then(({ exportEventsController }) => {
                    exportEventsController.init(storageManager);
                })
                .catch(error => {
                    console.error('[App] Failed to initialize export controller:', error);
                });

            // Initialize generator form AFTER auth is ready
            try {
                generatorForm.init();
                console.log('[App] Generator form initialized');
            } catch (error) {
                console.error('[App] Failed to initialize generator form:', error);
            }
        })
        .catch(error => {
            console.error('[App] Failed to initialize authentication:', error);
        });
}

var browser_queue_size = bodyElement.getAttribute('data-browser_queue_size');

import { searchController } from './ui/search';
searchController.init();

import { actionsController } from './ui/actions';
actionsController.init(bootstrap);

import { sseEventsController } from './sse/events';
sseEventsController.init(browser_queue_size, storageManager);

import { keyboardController } from './ux/keyb-nav';
keyboardController.init(bootstrap);

import { toastController } from './ui/toast';
toastController.init(bootstrap);
// Make it globally available
window.toastController = toastController;

import { storageButtonController } from './ui/storageButton';
storageButtonController.init();

import { initializeCollapseState } from './ui/collapseState';
// Initialize collapse state on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeCollapseState);
} else {
    initializeCollapseState();
}

import { generatorForm } from './ui/generatorForm';
// Generator form will be initialized after auth - see initAuth() function

import { tasksModalController } from './ui/tasksModal';
tasksModalController.init();
// Make it globally available for auth dropdown
window.tasksModalController = tasksModalController;

import { clientsModalController } from './ui/clientsModal';
clientsModalController.init();
// Make it globally available for auth dropdown
window.clientsModalController = clientsModalController;

// Initialize metadata SSE connection after all components are ready
// This provides a single SSE stream for tasks and clients metadata
import { metadataSSE } from './sse/metadata';
console.log('[App] Initializing metadata SSE connection...');
metadataSSE.init();

// Export controller will be initialized after auth - see initAuth() function

// Initialize all tooltips with better behavior to prevent overlapping and sticking
const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => {
    return new bootstrap.Tooltip(tooltipTriggerEl, {
        trigger: 'hover', // Only show on hover
        delay: { show: 300, hide: 0 }, // Quick to hide, slight delay to show
        animation: true,
    });
});

// Hide all tooltips when mouse leaves any element or on scroll
document.addEventListener('mouseleave', () => {
    tooltipList.forEach(tooltip => tooltip.hide());
});

document.addEventListener(
    'scroll',
    () => {
        tooltipList.forEach(tooltip => tooltip.hide());
    },
    true
); // Use capture to catch all scroll events

// Hide all tooltips on any click
document.addEventListener(
    'click',
    () => {
        tooltipList.forEach(tooltip => tooltip.hide());
    },
    true
); // Use capture to catch all click events

// Cleanup SSE connections when navigating away to prevent connection leaks
import { sseConnection } from './sse/connection';
import { metadataSSE } from './sse/metadata';

window.addEventListener('beforeunload', () => {
    console.log('[App] Page unloading, closing all SSE connections');
    sseConnection.close();
    metadataSSE.close();
});

// Export for use in other modules
export { authManager, authorizationManager, storageManager };
