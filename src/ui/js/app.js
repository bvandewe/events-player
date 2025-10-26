import * as bootstrap from 'bootstrap'

// Initialize authentication first
import { authManager } from './auth/auth';
import { authorizationManager } from './auth/authorization';

// Initialize event storage manager
import EventStorageManager from './storage/eventStorage';

// Get or create singleton storage manager instance
const storageManager = EventStorageManager.getInstance({
    maxRecentEvents: 5000,      // Keep 5K full events in IndexedDB
    maxRecentAge: 1800000,      // 30 minutes
    maxMetadataEvents: 100000,  // Keep 100K metadata entries
    maxMetadataAge: 86400000    // 24 hours
});

// Initialize storage manager
storageManager.init().then(() => {
    console.log('[App] Storage manager initialized');
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

var browser_queue_size = document.querySelector("body").getAttribute("data-browser_queue_size");

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

const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));

// Export for use in other modules
export { authManager, authorizationManager, storageManager };
