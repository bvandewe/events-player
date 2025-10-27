import * as bootstrap from 'bootstrap'

// Initialize authentication first
import { authManager } from './auth/auth';
import { authorizationManager } from './auth/authorization';

// Initialize event storage manager
import EventStorageManager from './storage/eventStorage';

// Get body element for data attributes
const bodyElement = document.body;

// Initialize storage configuration from data attributes
const storageOptions = {
    maxRecentEvents: parseInt(bodyElement.getAttribute("data-storage-max-recent-events") || "5000"),
    maxMetadataEvents: parseInt(bodyElement.getAttribute("data-storage-max-metadata-events") || "100000")
};

console.log('[App] Storage configuration:', storageOptions);

// Get or create singleton storage manager instance
const storageManager = EventStorageManager.getInstance(storageOptions);

// Initialize storage manager
storageManager.init().then(() => {
    console.log('[App] Storage manager initialized');

    // Initialize global filters after storage is ready
    import('./ui/globalFilters').then(({ globalFilterController }) => {
        globalFilterController.init(storageManager).then(() => {
            console.log('[App] Global filters initialized');
        }).catch(error => {
            console.error('[App] Failed to initialize global filters:', error);
        });
    });
}).catch(error => {
    console.error('[App] Failed to initialize storage manager:', error);
});

authManager.init().then(() => {
    console.log('[App] Authentication initialized');

    // Initialize authorization based on user roles
    authorizationManager.init(authManager);
}).catch(error => {
    console.error('[App] Failed to initialize authentication:', error);
});

var browser_queue_size = bodyElement.getAttribute("data-browser_queue_size");

import { searchController } from "./ui/search";
searchController.init();

import { actionsController } from "./ui/actions";
actionsController.init(bootstrap);

import { sseEventsController } from "./sse/events"
sseEventsController.init(browser_queue_size, storageManager);

import { keyboardController } from "./ux/keyb-nav"
keyboardController.init(bootstrap);

import { toastController } from "./ui/toast";
toastController.init(bootstrap);

import { generatorForm } from "./ui/generatorForm"
generatorForm.init();

import { tasksModalController } from "./ui/tasksModal";
tasksModalController.init();
// Make it globally available for auth dropdown
window.tasksModalController = tasksModalController;

import { clientsModalController } from "./ui/clientsModal";
clientsModalController.init();
// Make it globally available for auth dropdown
window.clientsModalController = clientsModalController;

const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));

// Cleanup SSE connection when navigating away to prevent connection leaks
import { sseConnection } from "./sse/connection";

window.addEventListener('beforeunload', () => {
    console.log('[App] Page unloading, closing all SSE connections');
    sseConnection.close();
    clientsModalController.cleanup();
});

// Export for use in other modules
export { authManager, authorizationManager, storageManager };
