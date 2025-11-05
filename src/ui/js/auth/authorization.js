/**
 * Authorization Helper Module
 * 
 * Provides client-side authorization checks based on user roles.
 * Works in conjunction with server-side authorization enforcement.
 */

import * as bootstrap from 'bootstrap';

class AuthorizationManager {
    constructor() {
        this.userRoles = [];
        this.isAuthenticated = false;
        this.authRequired = false;
        this.roleMappings = null; // Store role mappings from backend (admin, operator, user)
    }

    /**
     * Initialize authorization manager with user info from authManager
     */
    init(authManager) {
        // Check if authentication is required from body data attribute
        const bodyElement = document.body;
        const authRequiredAttr = bodyElement.getAttribute('data-auth-required');
        this.authRequired = authRequiredAttr === 'true' || authRequiredAttr === 'True';

        console.log('[Authorization] Auth required:', this.authRequired);

        // If auth is not required, grant full access and skip restrictions
        if (!this.authRequired) {
            console.log('[Authorization] Auth not required - granting full access');
            this.isAuthenticated = true;
            this.userRoles = ['admin', 'operator', 'user']; // Grant all roles
            this.roleMappings = { admin: 'admin', operator: 'operator', user: 'user' }; // Default mappings
            return; // Skip applying UI restrictions
        }

        if (authManager && authManager.userInfo) {
            this.isAuthenticated = true;
            this.userRoles = authManager.userInfo.roles || [];
            this.roleMappings = authManager.roleMappings || { admin: 'admin', operator: 'operator', user: 'user' };
            console.log('[Authorization] User roles:', this.userRoles);
            console.log('[Authorization] Role mappings:', this.roleMappings);
        } else {
            this.isAuthenticated = false;
            this.userRoles = [];
            this.roleMappings = { admin: 'admin', operator: 'operator', user: 'user' }; // Default mappings
            console.log('[Authorization] No authenticated user');
        }

        // Apply UI restrictions only if auth is required
        this.applyUIRestrictions();
    }

    /**
     * Check if user has admin role
     */
    isAdmin() {
        if (!this.roleMappings) return false;
        return this.userRoles.includes(this.roleMappings.admin);
    }

    /**
     * Check if user has operator or admin role
     */
    isOperator() {
        if (!this.roleMappings) return false;
        return this.userRoles.includes(this.roleMappings.operator) || this.isAdmin();
    }

    /**
     * Check if user has basic user role
     */
    isUser() {
        if (!this.roleMappings) return false;
        return this.userRoles.includes(this.roleMappings.user);
    }

    /**
     * Apply UI restrictions based on user roles
     */
    applyUIRestrictions() {
        console.log('[Authorization] Applying UI restrictions...');

        // Restrict generator panel access to operators and admins
        if (!this.isOperator()) {
            this.hideGeneratorPanel();
        }

        // Restrict iterations and delay controls to admins only
        if (!this.isAdmin()) {
            this.disableAdminControls();
        }

        // Restrict event expansion to operators and admins
        if (!this.isOperator()) {
            this.disableEventExpansion();
        }
    }

    /**
     * Hide the generator panel for non-operators
     */
    hideGeneratorPanel() {
        console.log('[Authorization] Hiding generator panel for non-operator user');

        // Close the generator panel if it's open
        const generatorPanel = document.getElementById('generatorPanel');
        if (generatorPanel) {
            generatorPanel.classList.remove('show');
        }

        // Hide the generator navigation link
        const generatorLinks = document.querySelectorAll('[data-bs-target="#generatorPanel"]');
        generatorLinks.forEach(link => {
            link.style.display = 'none';
        });

        // Disable keyboard shortcuts for generator
        this.disableGeneratorShortcuts();
    }

    /**
     * Disable admin-only controls in the generator
     */
    disableAdminControls() {
        console.log('[Authorization] Disabling admin-only controls');

        const iterationsInput = document.getElementById('eventIterations');
        const delayInput = document.getElementById('eventDelay');

        if (iterationsInput) {
            // Lock to default value for operators (but keep enabled so it's in FormData)
            iterationsInput.min = 1;
            iterationsInput.max = 1;
            iterationsInput.value = 1;
            iterationsInput.style.opacity = '0.7';
            iterationsInput.setAttribute('data-bs-toggle', 'tooltip');
            iterationsInput.setAttribute('data-bs-placement', 'top');
            iterationsInput.setAttribute('data-bs-title', 'Only administrators can change iterations');
            new bootstrap.Tooltip(iterationsInput, {
                trigger: 'hover',
                delay: { show: 300, hide: 0 },
                animation: true
            });
        }

        if (delayInput) {
            // Lock to default value for operators (but keep enabled so it's in FormData)
            delayInput.min = 100;
            delayInput.max = 100;
            delayInput.value = 100;
            delayInput.style.opacity = '0.7';
            delayInput.setAttribute('data-bs-toggle', 'tooltip');
            delayInput.setAttribute('data-bs-placement', 'top');
            delayInput.setAttribute('data-bs-title', 'Only administrators can change delay');
            new bootstrap.Tooltip(delayInput, {
                trigger: 'hover',
                delay: { show: 300, hide: 0 },
                animation: true
            });
        }

        // Also disable the labels
        const iterationsLabel = document.querySelector('label[for="eventIterations"]');
        const delayLabel = document.querySelector('label[for="eventDelay"]');

        if (iterationsLabel) {
            iterationsLabel.style.opacity = '0.5';
        }
        if (delayLabel) {
            delayLabel.style.opacity = '0.5';
        }
    }

    /**
     * Disable event expansion for non-operators
     */
    disableEventExpansion() {
        console.log('[Authorization] Disabling event expansion for non-operator user');

        // Prevent accordion buttons from toggling and hide caret icon
        const accordionButtons = document.querySelectorAll('.accordion-button');
        accordionButtons.forEach(button => {
            button.classList.add('no-expand');
            button.style.cursor = 'not-allowed';
            button.removeAttribute('data-bs-toggle');
            button.removeAttribute('data-bs-target');
            button.setAttribute('aria-expanded', 'false');
        });

        // Listen for new accordion items being added
        const eventsStack = document.getElementById('events-stack');
        if (eventsStack) {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('accordion-item')) {
                            const button = node.querySelector('.accordion-button');
                            if (button) {
                                button.classList.add('no-expand');
                                button.style.cursor = 'not-allowed';
                                button.removeAttribute('data-bs-toggle');
                                button.removeAttribute('data-bs-target');
                                button.setAttribute('aria-expanded', 'false');
                            }
                        }
                    });
                });
            });

            observer.observe(eventsStack, { childList: true });
        }

        // Disable the expand/collapse all button
        const expandCollapseLink = document.getElementById('expandCollapseLink');
        if (expandCollapseLink) {
            expandCollapseLink.style.display = 'none';
        }
    }

    /**
     * Disable keyboard shortcuts for opening the generator
     */
    disableGeneratorShortcuts() {
        // This will be handled by the keyb-nav.js module
        // We'll add a flag that it can check
        window.generatorAccessDenied = true;
    }

    /**
     * Show an authorization error message
     */
    showAuthorizationError(message) {
        const toastController = window.toastController;
        if (toastController) {
            toastController.showToast({
                detail: [{
                    loc: ['authorization'],
                    msg: message || 'You do not have permission to perform this action',
                    type: 'authorization_error'
                }]
            });
        } else {
            alert(message || 'You do not have permission to perform this action');
        }
    }
}

// Create singleton instance
export const authorizationManager = new AuthorizationManager();
