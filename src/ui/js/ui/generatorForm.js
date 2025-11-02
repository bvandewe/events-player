import { toastController } from "./toast";
import { taskController } from "../sse/task";
import { authManager, authorizationManager } from "../app";
import { apiPost } from "../utils/apiClient.js";
import { actionsController } from "./actions";
import { tasksModalController } from "./tasksModal";
import * as bootstrap from 'bootstrap';

export const generatorForm = (() => {

    const STORAGE_KEY = 'cloudevents-player-generator-state';
    const CUSTOM_GATEWAY_KEY = 'cloudevents-player-custom-gateway';
    const HISTORY_KEY = 'cloudevents-player-generator-history';
    const MAX_HISTORY = 5;
    let initialized = false; // Track if already initialized
    let repeaterInterval = null;
    let repeaterRunCount = 0;
    let nextExecutionTimer = null;
    let repeaterStartFunction = null; // Store reference to start function to call after form submission

    /**
     * Save form state to localStorage
     */
    const saveFormState = () => {
        try {
            const state = {
                event_gateway: document.getElementById('event_gateway')?.value || '',
                custom_gateway_url: document.getElementById('custom_gateway_url')?.value || '',
                event_source: document.getElementById('event_source')?.value || '',
                event_type: document.getElementById('event_type')?.value || '',
                event_subject: document.getElementById('event_subject')?.value || '',
                event_data: document.getElementById('event_data')?.value || '',
                iterations: document.getElementById('eventIterations')?.value || '1',
                delay: document.getElementById('eventDelay')?.value || '100'
            };

            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

            // Save custom gateway separately for persistence
            if (state.custom_gateway_url) {
                localStorage.setItem(CUSTOM_GATEWAY_KEY, state.custom_gateway_url);
            }

            console.log('[GeneratorForm] State saved:', state);
        } catch (error) {
            console.error('[GeneratorForm] Error saving state:', error);
        }
    };

    /**
     * Save operation to history
     */
    const saveOperationToHistory = (operationData) => {
        try {
            let history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');

            // Get current user info
            const username = authManager.userInfo?.username ||
                authManager.userInfo?.preferred_username ||
                authManager.userInfo?.email ||
                'anonymous';

            // Add timestamp, ID, and user
            const operation = {
                id: `op_${Date.now()}`,
                timestamp: new Date().toISOString(),
                user: username,
                ...operationData
            };

            // Add to beginning of array
            history.unshift(operation);

            // Keep only last MAX_HISTORY operations
            if (history.length > MAX_HISTORY) {
                history = history.slice(0, MAX_HISTORY);
            }

            localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
            console.log('[GeneratorForm] Operation saved to history:', operation.id);

            // Update history dropdown and modal
            updateHistoryDropdown();
            updateHistoryModal();

            return operation.id;
        } catch (error) {
            console.error('[GeneratorForm] Error saving operation to history:', error);
        }
    };

    /**
     * Get operations history
     */
    const getOperationsHistory = () => {
        try {
            return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
        } catch (error) {
            console.error('[GeneratorForm] Error loading history:', error);
            return [];
        }
    };

    /**
     * Load operation from history
     */
    const loadOperationFromHistory = (operationId) => {
        try {
            const history = getOperationsHistory();
            const operation = history.find(op => op.id === operationId);

            if (!operation) {
                console.error('[GeneratorForm] Operation not found:', operationId);
                return;
            }

            console.log('[GeneratorForm] Loading operation:', operation);

            // Restore form fields
            const gatewaySelect = document.getElementById('event_gateway');
            const customGatewayInput = document.getElementById('custom_gateway_url');
            const sourceInput = document.getElementById('event_source');
            const typeInput = document.getElementById('event_type');
            const subjectInput = document.getElementById('event_subject');
            const dataTextarea = document.getElementById('event_data');
            const iterationsSlider = document.getElementById('eventIterations');
            const delaySlider = document.getElementById('eventDelay');

            if (gatewaySelect && operation.event_gateway) {
                gatewaySelect.value = operation.event_gateway;
                if (operation.event_gateway === '__custom__') {
                    toggleCustomGateway(true);
                }
            }
            if (customGatewayInput && operation.custom_gateway_url) {
                customGatewayInput.value = operation.custom_gateway_url;
            }
            if (sourceInput && operation.event_source) {
                sourceInput.value = operation.event_source;
            }
            if (typeInput && operation.event_type) {
                typeInput.value = operation.event_type;
            }
            if (subjectInput && operation.event_subject !== undefined) {
                subjectInput.value = operation.event_subject;
            }
            if (dataTextarea && operation.event_data) {
                dataTextarea.value = operation.event_data;
            }
            if (iterationsSlider && operation.iterations) {
                iterationsSlider.value = operation.iterations;
                const iterationsValueSpan = document.getElementById('eventIterationsValue');
                if (iterationsValueSpan) {
                    iterationsValueSpan.innerHTML = operation.iterations;
                }
            }
            if (delaySlider && operation.delay) {
                delaySlider.value = operation.delay;
                const delayValueSpan = document.getElementById('eventDelayValue');
                if (delayValueSpan) {
                    delayValueSpan.innerHTML = operation.delay;
                }
            }

            // Restore randomization states
            const randomSourceBtn = document.getElementById('randomSourceBtn');
            const randomTypeBtn = document.getElementById('randomTypeBtn');
            const randomSubjectBtn = document.getElementById('randomSubjectBtn');

            if (randomSourceBtn) {
                operation.randomize_source ?
                    randomSourceBtn.classList.add('active') :
                    randomSourceBtn.classList.remove('active');
            }
            if (randomTypeBtn) {
                operation.randomize_type ?
                    randomTypeBtn.classList.add('active') :
                    randomTypeBtn.classList.remove('active');
            }
            if (randomSubjectBtn) {
                operation.randomize_subject ?
                    randomSubjectBtn.classList.add('active') :
                    randomSubjectBtn.classList.remove('active');
            }

            toastController.showToast({
                status: 'info',
                message: 'Operation loaded from history'
            });
        } catch (error) {
            console.error('[GeneratorForm] Error loading operation from history:', error);
        }
    };

    /**
     * Update history dropdown
     */
    const updateHistoryDropdown = () => {
        const dropdown = document.getElementById('operationHistory');
        if (!dropdown) return;

        const history = getOperationsHistory();

        // Clear existing options except the first one
        dropdown.innerHTML = '<option value="" selected>New Operation</option>';

        // Add history options
        history.forEach(op => {
            const option = document.createElement('option');
            option.value = op.id;
            const date = new Date(op.timestamp);
            const timeStr = date.toLocaleString();
            option.textContent = `${timeStr} - ${op.event_type || 'Untitled'}`;
            dropdown.appendChild(option);
        });
    };

    /**
     * Update history modal
     */
    const updateHistoryModal = () => {
        const accordion = document.getElementById('operationsHistoryAccordion');
        const noOpsMessage = document.getElementById('noOperationsMessage');

        if (!accordion) return;

        const history = getOperationsHistory();

        if (history.length === 0) {
            accordion.innerHTML = '';
            if (noOpsMessage) noOpsMessage.classList.remove('d-none');
            return;
        }

        if (noOpsMessage) noOpsMessage.classList.add('d-none');

        // Build accordion items
        accordion.innerHTML = history.map((op, index) => {
            const date = new Date(op.timestamp);
            const timeStr = date.toLocaleString();

            return `
                <div class="accordion-item">
                    <h2 class="accordion-header" id="heading-${op.id}">
                        <button class="accordion-button ${index === 0 ? '' : 'collapsed'}" type="button" 
                                data-bs-toggle="collapse" data-bs-target="#collapse-${op.id}" 
                                aria-expanded="${index === 0 ? 'true' : 'false'}" aria-controls="collapse-${op.id}">
                            <div class="d-flex justify-content-between align-items-center w-100 me-3">
                                <div>
                                    <i class="bi bi-lightning-fill text-primary me-2"></i>
                                    <strong>${op.id}</strong>
                                    ${op.user ? `<span class="badge bg-secondary ms-2">${op.user}</span>` : ''}
                                </div>
                                <span class="text-muted small">${timeStr}</span>
                            </div>
                        </button>
                    </h2>
                    <div id="collapse-${op.id}" class="accordion-collapse collapse ${index === 0 ? 'show' : ''}" 
                         aria-labelledby="heading-${op.id}" data-bs-parent="#operationsHistoryAccordion">
                        <div class="accordion-body">
                            <dl class="row mb-0 small">
                                ${op.user ? `
                                <dt class="col-3">User</dt>
                                <dd class="col-9">
                                    <span class="badge bg-secondary">${op.user}</span>
                                </dd>
                                ` : ''}
                                
                                <dt class="col-3">Gateway</dt>
                                <dd class="col-9"><code>${op.event_gateway || 'N/A'}</code></dd>
                                
                                <dt class="col-3">Source</dt>
                                <dd class="col-9">
                                    <code>${op.event_source || 'N/A'}</code>
                                    ${op.event_source ? `
                                    <button class="btn btn-sm btn-outline-primary ms-2 py-0 px-1" 
                                            onclick="window.generatorForm.filterBySource('${op.event_source.replace(/'/g, "\\'")}')"
                                            title="Filter by this source">
                                        <i class="bi bi-funnel" style="font-size: 0.75rem;"></i>
                                    </button>
                                    ` : ''}
                                </dd>
                                
                                <dt class="col-3">Type</dt>
                                <dd class="col-9">
                                    <code>${op.event_type || 'N/A'}</code>
                                    ${op.event_type ? `
                                    <button class="btn btn-sm btn-outline-primary ms-2 py-0 px-1" 
                                            onclick="window.generatorForm.filterByType('${op.event_type.replace(/'/g, "\\'")}')"
                                            title="Filter by this type">
                                        <i class="bi bi-funnel" style="font-size: 0.75rem;"></i>
                                    </button>
                                    ` : ''}
                                </dd>
                                
                                <dt class="col-3">Subject</dt>
                                <dd class="col-9">
                                    <code>${op.event_subject || '(empty)'}</code>
                                    ${op.event_subject ? `
                                    <button class="btn btn-sm btn-outline-primary ms-2 py-0 px-1" 
                                            onclick="window.generatorForm.filterBySubject('${op.event_subject.replace(/'/g, "\\'")}')"
                                            title="Filter by this subject">
                                        <i class="bi bi-funnel" style="font-size: 0.75rem;"></i>
                                    </button>
                                    ` : ''}
                                </dd>
                                
                                <dt class="col-3">Data</dt>
                                <dd class="col-9"><pre class="bg-dark p-2 rounded"><code>${op.event_data || '{}'}</code></pre></dd>
                                
                                <dt class="col-3">Iterations</dt>
                                <dd class="col-9">${op.iterations || 1}</dd>
                                
                                <dt class="col-3">Delay</dt>
                                <dd class="col-9">${op.delay || 100} ms</dd>
                                
                                <dt class="col-3">Randomization</dt>
                                <dd class="col-9">
                                    ${op.randomize_source ? '<span class="badge bg-info me-1">Source</span>' : ''}
                                    ${op.randomize_type ? '<span class="badge bg-info me-1">Type</span>' : ''}
                                    ${op.randomize_subject ? '<span class="badge bg-info me-1">Subject</span>' : ''}
                                    ${!op.randomize_source && !op.randomize_type && !op.randomize_subject ? '<span class="text-muted">None</span>' : ''}
                                </dd>
                            </dl>
                            <div class="mt-3">
                                <button class="btn btn-sm btn-primary" onclick="window.generatorForm.loadOperation('${op.id}')">
                                    <i class="bi bi-arrow-repeat"></i> Load This Operation
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    };

    /**
     * Clear operations history
     */
    const clearOperationsHistory = () => {
        try {
            localStorage.removeItem(HISTORY_KEY);
            updateHistoryDropdown();
            updateHistoryModal();
            console.log('[GeneratorForm] Operations history cleared');

            toastController.showToast({
                status: 'info',
                message: 'Operations history cleared'
            });
        } catch (error) {
            console.error('[GeneratorForm] Error clearing history:', error);
        }
    };

    /**
     * Restore form state from localStorage
     */
    const restoreFormState = () => {
        try {
            const savedState = localStorage.getItem(STORAGE_KEY);
            if (!savedState) {
                return;
            }

            const state = JSON.parse(savedState);

            // Restore form fields
            const gatewaySelect = document.getElementById('event_gateway');
            const customGatewayInput = document.getElementById('custom_gateway_url');
            const sourceInput = document.getElementById('event_source');
            const typeInput = document.getElementById('event_type');
            const subjectInput = document.getElementById('event_subject');
            const dataTextarea = document.getElementById('event_data');
            const iterationsSlider = document.getElementById('eventIterations');
            const delaySlider = document.getElementById('eventDelay');

            if (gatewaySelect && state.event_gateway) {
                gatewaySelect.value = state.event_gateway;
                // Show custom gateway input if custom was selected
                if (state.event_gateway === '__custom__') {
                    toggleCustomGateway(true);
                }
            }
            if (customGatewayInput && state.custom_gateway_url) {
                customGatewayInput.value = state.custom_gateway_url;
            }
            if (sourceInput && state.event_source) {
                sourceInput.value = state.event_source;
            }
            if (typeInput && state.event_type) {
                typeInput.value = state.event_type;
            }
            if (subjectInput && state.event_subject) {
                subjectInput.value = state.event_subject;
            }
            if (dataTextarea && state.event_data) {
                dataTextarea.value = state.event_data;
            }
            if (iterationsSlider && state.iterations) {
                iterationsSlider.value = state.iterations;
                const iterationsValueSpan = document.getElementById('eventIterationsValue');
                if (iterationsValueSpan) {
                    iterationsValueSpan.innerHTML = state.iterations;
                }
            }
            if (delaySlider && state.delay) {
                delaySlider.value = state.delay;
                const delayValueSpan = document.getElementById('eventDelayValue');
                if (delayValueSpan) {
                    delayValueSpan.innerHTML = state.delay;
                }
            }
        } catch (error) {
            console.error('[GeneratorForm] Error restoring state:', error);
        }
    };

    const initSliders = () => {
        var eventIterations = document.getElementById("eventIterations");
        var eventIterationsValue = document.getElementById("eventIterationsValue");
        if (eventIterations && eventIterationsValue) {
            eventIterations.addEventListener("input", function () {
                var selectedValue = eventIterations.value;
                eventIterationsValue.innerHTML = selectedValue;
                saveFormState(); // Save on change
            });
        }

        var eventDelay = document.getElementById("eventDelay");
        var eventDelayValue = document.getElementById("eventDelayValue");
        if (eventDelay && eventDelayValue) {
            eventDelay.addEventListener("input", function () {
                var selectedValue = eventDelay.value;
                eventDelayValue.innerHTML = selectedValue;
                saveFormState(); // Save on change
            });
        }
    };

    /**
     * Toggle custom gateway input visibility
     */
    const toggleCustomGateway = (show) => {
        const customContainer = document.getElementById('custom_gateway_container');
        if (customContainer) {
            if (show) {
                customContainer.classList.remove('d-none');
            } else {
                customContainer.classList.add('d-none');
            }
        }
    };

    /**
     * Setup gateway select handler
     */
    const setupGatewayHandler = () => {
        const gatewaySelect = document.getElementById('event_gateway');
        const customGatewayInput = document.getElementById('custom_gateway_url');

        if (!gatewaySelect) return;

        // Check if user is admin or auth is disabled
        const isAdminOrNoAuth = !authManager.authRequired || authorizationManager.isAdmin();

        // If not admin and auth is enabled, remove custom option
        if (!isAdminOrNoAuth) {
            const customOption = Array.from(gatewaySelect.options).find(opt => opt.value === '__custom__');
            if (customOption) {
                customOption.remove();
            }
            return;
        }

        // Handle gateway selection change
        gatewaySelect.addEventListener('change', (e) => {
            if (e.target.value === '__custom__') {
                toggleCustomGateway(true);
                if (customGatewayInput) {
                    customGatewayInput.focus();
                }
            } else {
                toggleCustomGateway(false);
            }
            saveFormState();
        });

        // Handle custom gateway input
        if (customGatewayInput) {
            customGatewayInput.addEventListener('change', saveFormState);
            customGatewayInput.addEventListener('input', () => {
                let timeoutId;
                clearTimeout(timeoutId);
                timeoutId = setTimeout(saveFormState, 500);
            });
        }
    };

    const handleSubmit = (event) => {
        console.log('[GeneratorForm] handleSubmit called', event);
        event.preventDefault();
        event.stopPropagation();

        const formData = new FormData(event.target);
        const data = Object.fromEntries(formData.entries());

        console.log('[GeneratorForm] Form data collected:', data);

        // Convert numeric fields to integers
        data.iterations = parseInt(data.iterations, 10);
        data.delay = parseInt(data.delay, 10);

        // Remove custom_gateway_url from payload (not needed by API)
        delete data.custom_gateway_url;

        // Add randomization flags based on button states (only if iterations > 1)
        const randomSourceBtn = document.getElementById('randomSourceBtn');
        const randomTypeBtn = document.getElementById('randomTypeBtn');
        const randomSubjectBtn = document.getElementById('randomSubjectBtn');

        data.randomize_source = data.iterations > 1 && randomSourceBtn?.classList.contains('active') || false;
        data.randomize_type = data.iterations > 1 && randomTypeBtn?.classList.contains('active') || false;
        data.randomize_subject = data.iterations > 1 && randomSubjectBtn?.classList.contains('active') || false;

        // Use custom gateway URL if selected
        if (data.event_gateway === '__custom__') {
            const customGatewayUrl = document.getElementById('custom_gateway_url')?.value?.trim();
            if (!customGatewayUrl) {
                toastController.showToast({
                    detail: [{
                        loc: ['form', 'custom_gateway_url'],
                        msg: 'Please enter a custom gateway URL',
                        type: 'error'
                    }]
                });
                return;
            }
            data.event_gateway = customGatewayUrl;
        }

        console.log('Form data:', data);
        console.log('Iterations:', data.iterations, 'type:', typeof data.iterations);
        console.log('Delay:', data.delay, 'type:', typeof data.delay);
        console.log('Randomization:', {
            source: data.randomize_source,
            type: data.randomize_type,
            subject: data.randomize_subject
        });

        // Check if user is authorized
        if (!authorizationManager.isOperator()) {
            authorizationManager.showAuthorizationError('Only operators and administrators can generate events');
            return;
        }

        // Check if non-admin is trying to use iterations or custom delay
        // Default delay is 100ms, operators can use iterations=1 with delay=100
        if (!authorizationManager.isAdmin()) {
            console.log('Check: iterations > 1?', data.iterations > 1, 'delay !== 100?', data.delay !== 100);

            if (data.iterations > 1 || data.delay !== 100) {
                authorizationManager.showAuthorizationError('Only administrators can use iterations > 1 or custom delay settings');
                return;
            }
        }

        // Use apiPost which handles automatic token refresh on 401
        apiPost('/api/generate', data)
            .then(response => {
                if (response.status === 403) {
                    return response.json().then(error => {
                        throw new Error(error.detail || 'Forbidden: Insufficient permissions');
                    });
                }
                return response.json();
            })
            .then(result => {
                console.log('Form submitted successfully:', result);

                // Save operation to history
                saveOperationToHistory({
                    event_gateway: data.event_gateway,
                    custom_gateway_url: document.getElementById('custom_gateway_url')?.value || '',
                    event_source: data.event_source,
                    event_type: data.event_type,
                    event_subject: data.event_subject,
                    event_data: data.event_data,
                    iterations: data.iterations,
                    delay: data.delay,
                    randomize_source: data.randomize_source,
                    randomize_type: data.randomize_type,
                    randomize_subject: data.randomize_subject
                });

                Promise.all(
                    [
                        console.log(result),
                        taskController.handleTaskStatus(result.task_id),
                        toastController.showToast(result)
                    ]
                );

                // Start auto-repeat if enabled and not already running
                const repeaterEnabledCheckbox = document.getElementById('repeaterEnabled');
                if (repeaterEnabledCheckbox?.checked && !repeaterInterval && repeaterStartFunction) {
                    console.log('[GeneratorForm] Starting auto-repeat after successful submission');
                    repeaterStartFunction();
                }
            })
            .catch(error => {
                console.error('Error submitting form:', error);
                toastController.showToast({
                    detail: [{
                        loc: ['form'],
                        msg: error.message || 'Failed to generate events',
                        type: 'error'
                    }]
                });
            });
    };

    /**
     * Get default form values from the HTML placeholders/values
     */
    const getDefaultValues = () => {
        return {
            event_gateway: 'Select a gateway',
            custom_gateway_url: '',
            event_source: document.getElementById('event_source')?.getAttribute('value') || '',
            event_type: document.getElementById('event_type')?.getAttribute('value') || '',
            event_subject: document.getElementById('event_subject')?.getAttribute('value') || '',
            event_data: document.getElementById('event_data')?.textContent.trim() || '{}',
            iterations: '1',
            delay: '100'
        };
    };

    /**
     * Reset form to default values
     */
    const resetForm = () => {
        const defaults = getDefaultValues();

        // Reset form fields
        const gatewaySelect = document.getElementById('event_gateway');
        const customGatewayInput = document.getElementById('custom_gateway_url');
        const sourceInput = document.getElementById('event_source');
        const typeInput = document.getElementById('event_type');
        const subjectInput = document.getElementById('event_subject');
        const dataTextarea = document.getElementById('event_data');
        const iterationsSlider = document.getElementById('eventIterations');
        const delaySlider = document.getElementById('eventDelay');
        const iterationsValue = document.getElementById('eventIterationsValue');
        const delayValue = document.getElementById('eventDelayValue');

        if (gatewaySelect) gatewaySelect.value = defaults.event_gateway;
        if (customGatewayInput) customGatewayInput.value = defaults.custom_gateway_url;
        if (sourceInput) sourceInput.value = defaults.event_source;
        if (typeInput) typeInput.value = defaults.event_type;
        if (subjectInput) subjectInput.value = defaults.event_subject;
        if (dataTextarea) dataTextarea.value = defaults.event_data;
        if (iterationsSlider) iterationsSlider.value = defaults.iterations;
        if (delaySlider) delaySlider.value = defaults.delay;
        if (iterationsValue) iterationsValue.textContent = defaults.iterations;
        if (delayValue) delayValue.textContent = defaults.delay;

        // Clear randomization button states
        const randomSourceBtn = document.getElementById('randomSourceBtn');
        const randomTypeBtn = document.getElementById('randomTypeBtn');
        const randomSubjectBtn = document.getElementById('randomSubjectBtn');
        if (randomSourceBtn) randomSourceBtn.classList.remove('active');
        if (randomTypeBtn) randomTypeBtn.classList.remove('active');
        if (randomSubjectBtn) randomSubjectBtn.classList.remove('active');

        // Hide custom gateway container
        toggleCustomGateway(false);

        // Clear localStorage
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(CUSTOM_GATEWAY_KEY);

        console.log('[GeneratorForm] Form reset to defaults');
        toastController.showToast('Form reset to default values', 'success');
    };

    /**
     * Generate random source URL
     */
    const generateRandomSource = () => {
        const domains = ['example.com', 'myapp.io', 'service.net', 'platform.cloud', 'api.dev'];
        const services = ['payment', 'order', 'user', 'inventory', 'notification', 'analytics'];
        const domain = domains[Math.floor(Math.random() * domains.length)];
        const service = services[Math.floor(Math.random() * services.length)];
        return `https://${service}.${domain}/events`;
    };

    /**
     * Generate random event type
     */
    const generateRandomType = () => {
        const companies = ['com', 'io', 'net', 'org'];
        const domains = ['acme', 'contoso', 'fabrikam', 'northwind', 'adventure'];
        const services = ['order', 'payment', 'shipping', 'inventory', 'user', 'notification'];
        const actions = ['created', 'updated', 'deleted', 'completed', 'failed', 'cancelled'];
        const versions = ['v1', 'v2', 'v3'];

        const company = companies[Math.floor(Math.random() * companies.length)];
        const domain = domains[Math.floor(Math.random() * domains.length)];
        const service = services[Math.floor(Math.random() * services.length)];
        const action = actions[Math.floor(Math.random() * actions.length)];
        const version = versions[Math.floor(Math.random() * versions.length)];

        return `${company}.${domain}.${service}.${action}.${version}`;
    };

    /**
     * Generate random subject (UUID-like or alphanumeric)
     */
    const generateRandomSubject = () => {
        const types = ['uuid', 'numeric', 'alphanumeric'];
        const type = types[Math.floor(Math.random() * types.length)];

        if (type === 'uuid') {
            // Generate UUID v4-like string
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        } else if (type === 'numeric') {
            // Generate numeric ID
            return Math.floor(Math.random() * 1000000).toString();
        } else {
            // Generate alphanumeric ID
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            let result = '';
            for (let i = 0; i < 12; i++) {
                result += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return result;
        }
    };

    /**
     * Setup random value generators (admin only)
     */
    const setupRandomGenerators = () => {
        // Check if user is admin or auth is disabled
        const isAdminOrNoAuth = !authManager.authRequired || authorizationManager.isAdmin();

        const randomSourceBtn = document.getElementById('randomSourceBtn');
        const randomTypeBtn = document.getElementById('randomTypeBtn');
        const randomSubjectBtn = document.getElementById('randomSubjectBtn');

        if (isAdminOrNoAuth) {
            // Show buttons for admin
            if (randomSourceBtn) randomSourceBtn.classList.remove('d-none');
            if (randomTypeBtn) randomTypeBtn.classList.remove('d-none');
            if (randomSubjectBtn) randomSubjectBtn.classList.remove('d-none');

            // Add toggle event listeners
            if (randomSourceBtn) {
                randomSourceBtn.addEventListener('click', () => {
                    randomSourceBtn.classList.toggle('active');
                    const sourceInput = document.getElementById('event_source');
                    const isActive = randomSourceBtn.classList.contains('active');

                    if (isActive && sourceInput) {
                        sourceInput.value = generateRandomSource();
                        saveFormState();
                    }
                });
            }

            if (randomTypeBtn) {
                randomTypeBtn.addEventListener('click', () => {
                    randomTypeBtn.classList.toggle('active');
                    const typeInput = document.getElementById('event_type');
                    const isActive = randomTypeBtn.classList.contains('active');

                    if (isActive && typeInput) {
                        typeInput.value = generateRandomType();
                        saveFormState();
                    }
                });
            }

            if (randomSubjectBtn) {
                randomSubjectBtn.addEventListener('click', () => {
                    randomSubjectBtn.classList.toggle('active');
                    const subjectInput = document.getElementById('event_subject');
                    const isActive = randomSubjectBtn.classList.contains('active');

                    if (isActive && subjectInput) {
                        subjectInput.value = generateRandomSubject();
                        saveFormState();
                    }
                });
            }
        }
    };

    /**
     * Update title indicator for auto-repeat status
     */
    const updateTitleIndicator = (isActive) => {
        const titleSpan = document.querySelector('.navbar-brand .title');

        if (!titleSpan) return;

        // Remove existing indicator if any
        const existingIndicator = document.getElementById('autoRepeatIndicator');
        if (existingIndicator) {
            existingIndicator.remove();
        }

        if (isActive) {
            // Add active indicator with link to tasks modal
            const indicator = document.createElement('span');
            indicator.id = 'autoRepeatIndicator';
            indicator.className = 'ms-2';
            indicator.innerHTML = `
                <i class="bi bi-arrow-repeat text-warning" 
                   style="font-size: 1.2em; cursor: pointer; animation: spin 2s linear infinite;"
                   data-bs-toggle="modal" 
                   data-bs-target="#tasksModal"
                   title="Auto-repeat active - Click to view tasks"></i>
                <style>
                    @keyframes spin {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(360deg); }
                    }
                </style>
            `;
            titleSpan.appendChild(indicator);

            // Also change title color to orange/warning
            titleSpan.style.color = '#ffc107';
        } else {
            // Reset title color
            titleSpan.style.color = '';
        }
    };

    /**
     * Setup repeater functionality
     */
    const setupRepeater = () => {
        const repeaterEnabledCheckbox = document.getElementById('repeaterEnabled');
        const repeaterControls = document.getElementById('repeaterControls');
        const repeaterStatus = document.getElementById('repeaterStatus');
        const repeaterIntervalSelect = document.getElementById('repeaterInterval');
        const repeaterNextExecution = document.getElementById('repeaterNextExecution');
        const repeaterRunCountSpan = document.getElementById('repeaterRunCount');

        if (!repeaterEnabledCheckbox) return;

        // Toggle repeater controls visibility
        repeaterEnabledCheckbox.addEventListener('change', () => {
            if (repeaterEnabledCheckbox.checked) {
                repeaterControls?.classList.remove('d-none');
                // Don't start repeater immediately - wait for user to submit the form
                // The repeater will start after the first manual submission
                console.log('[GeneratorForm] Auto-repeat enabled - will start after next form submission');
            } else {
                repeaterControls?.classList.add('d-none');
                stopRepeater();
            }
        });

        // Update interval when changed
        if (repeaterIntervalSelect) {
            repeaterIntervalSelect.addEventListener('change', () => {
                if (repeaterEnabledCheckbox.checked && repeaterInterval) {
                    // Only restart if repeater is already running
                    // (i.e., form has been submitted at least once)
                    stopRepeater();
                    startRepeater();
                }
            });
        }

        /**
         * Start repeater
         */
        function startRepeater() {
            if (repeaterInterval) {
                clearInterval(repeaterInterval);
            }
            if (nextExecutionTimer) {
                clearInterval(nextExecutionTimer);
            }

            const interval = parseInt(repeaterIntervalSelect?.value || '5000');
            repeaterRunCount = 0;

            if (repeaterStatus) {
                repeaterStatus.textContent = 'Active';
                repeaterStatus.classList.remove('bg-secondary');
                repeaterStatus.classList.add('bg-success');
            }

            // Update title to indicate auto-repeat is active
            updateTitleIndicator(true);

            // Register browser task with the task manager
            const taskId = 'auto-repeat-generator';
            tasksModalController.registerBrowserTask(taskId, {
                name: 'Auto-Repeat Event Generator',
                onCancel: () => {
                    // This will be called when user cancels from task manager
                    const repeaterCheckbox = document.getElementById('repeaterEnabled');
                    if (repeaterCheckbox) {
                        repeaterCheckbox.checked = false;
                        repeaterCheckbox.dispatchEvent(new Event('change'));
                    }
                }
            });

            // Update next execution time
            updateNextExecutionTime();

            // Start the interval timer
            repeaterInterval = setInterval(() => {
                // Submit the form programmatically
                const form = document.getElementById('generatorForm');
                if (form) {
                    const event = new Event('submit', { bubbles: true, cancelable: true });
                    form.dispatchEvent(event);
                    repeaterRunCount++;
                    if (repeaterRunCountSpan) {
                        repeaterRunCountSpan.textContent = repeaterRunCount.toString();
                    }
                    updateNextExecutionTime();
                }
            }, interval);

            // Update next execution time every second
            nextExecutionTimer = setInterval(updateNextExecutionTime, 1000);

            console.log('[GeneratorForm] Repeater started with interval:', interval);
        }

        /**
         * Stop repeater
         */
        function stopRepeater() {
            if (repeaterInterval) {
                clearInterval(repeaterInterval);
                repeaterInterval = null;
            }
            if (nextExecutionTimer) {
                clearInterval(nextExecutionTimer);
                nextExecutionTimer = null;
            }

            if (repeaterStatus) {
                repeaterStatus.textContent = 'Inactive';
                repeaterStatus.classList.remove('bg-success');
                repeaterStatus.classList.add('bg-secondary');
            }

            if (repeaterNextExecution) {
                repeaterNextExecution.textContent = '--';
            }

            // Remove title indicator
            updateTitleIndicator(false);

            // Unregister browser task from task manager
            tasksModalController.unregisterBrowserTask('auto-repeat-generator');

            console.log('[GeneratorForm] Repeater stopped');
        }

        /**
         * Update next execution time display
         */
        function updateNextExecutionTime() {
            if (!repeaterNextExecution || !repeaterInterval) return;

            const interval = parseInt(repeaterIntervalSelect?.value || '5000');
            const nextTime = new Date(Date.now() + interval);

            // Format as relative time
            const seconds = Math.floor((nextTime - Date.now()) / 1000);

            if (seconds <= 0) {
                repeaterNextExecution.textContent = 'Now...';
            } else if (seconds < 60) {
                repeaterNextExecution.textContent = `in ${seconds}s`;
            } else {
                const minutes = Math.floor(seconds / 60);
                const secs = seconds % 60;
                repeaterNextExecution.textContent = `in ${minutes}m ${secs}s`;
            }
        }

        // Store reference to startRepeater so it can be called from handleSubmit
        repeaterStartFunction = startRepeater;
    };

    /**
     * Filter by source
     */
    const filterBySource = (source) => {
        console.log('[GeneratorForm] Filtering by source:', source);

        // Import appState dynamically to avoid circular dependencies
        import('../state/appState.js').then(({ appState }) => {
            appState.updateFilters({
                type: '',
                source: source,
                subject: null,
                timeRange: 'all'
            });

            // Close the modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('operationsHistoryModal'));
            if (modal) modal.hide();

            toastController.showToast({
                status: 'info',
                message: `Filtering by source: ${source}`
            });
        });
    };

    /**
     * Filter by type
     */
    const filterByType = (type) => {
        console.log('[GeneratorForm] Filtering by type:', type);

        import('../state/appState.js').then(({ appState }) => {
            appState.updateFilters({
                type: type,
                source: '',
                subject: null,
                timeRange: 'all'
            });

            // Close the modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('operationsHistoryModal'));
            if (modal) modal.hide();

            toastController.showToast({
                status: 'info',
                message: `Filtering by type: ${type}`
            });
        });
    };

    /**
     * Filter by subject
     */
    const filterBySubject = (subject) => {
        console.log('[GeneratorForm] Filtering by subject:', subject);

        import('../state/appState.js').then(({ appState }) => {
            appState.updateFilters({
                type: '',
                source: '',
                subject: subject,
                timeRange: 'all'
            });

            // Close the modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('operationsHistoryModal'));
            if (modal) modal.hide();

            toastController.showToast({
                status: 'info',
                message: `Filtering by subject: ${subject}`
            });
        });
    };

    const init = () => {
        // Prevent double initialization
        if (initialized) {
            return;
        }

        initialized = true;

        // Restore saved state first
        restoreFormState();

        // Initialize sliders
        initSliders();

        // Setup gateway selection handler
        setupGatewayHandler();

        // Setup random value generators (admin only)
        setupRandomGenerators();

        // Setup repeater
        setupRepeater();

        // Update history dropdown and modal
        updateHistoryDropdown();
        updateHistoryModal();

        // Setup history dropdown handler
        const historyDropdown = document.getElementById('operationHistory');
        if (historyDropdown) {
            historyDropdown.addEventListener('change', (e) => {
                if (e.target.value) {
                    loadOperationFromHistory(e.target.value);
                }
            });
        }

        // Setup clear history button in modal
        const clearHistoryBtn = document.getElementById('clearOperationsHistory');
        if (clearHistoryBtn) {
            clearHistoryBtn.addEventListener('click', () => {
                actionsController.showConfirm({
                    title: 'Clear Operations History?',
                    message: 'Are you sure you want to clear all operations history? This action cannot be undone.',
                    confirmText: 'Yes, clear history',
                    confirmClass: 'btn-danger',
                    onConfirm: clearOperationsHistory
                });
            });
        }

        // Setup reset button
        const resetBtn = document.getElementById('resetFormBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', resetForm);
        }

        // Setup form submit handler
        const form = document.getElementById('generatorForm');
        if (form) {
            console.log('[GeneratorForm] Attaching submit handler to form');
            form.addEventListener('submit', (event) => {
                console.log('[GeneratorForm] Form submit event triggered');
                handleSubmit(event);
            }, { capture: false, once: false });
        } else {
            console.error('[GeneratorForm] Form element not found!');
        }

        // Add input listeners to save state on change
        const inputs = [
            'event_gateway',
            'event_source',
            'event_type',
            'event_subject',
            'event_data'
        ];

        inputs.forEach(inputId => {
            const element = document.getElementById(inputId);
            if (element) {
                // Skip gateway select as it's handled by setupGatewayHandler
                if (inputId === 'event_gateway') return;

                element.addEventListener('change', saveFormState);
                // For textarea, also save on input (debounced would be better but keeping it simple)
                if (element.tagName === 'TEXTAREA') {
                    let timeoutId;
                    element.addEventListener('input', () => {
                        clearTimeout(timeoutId);
                        timeoutId = setTimeout(saveFormState, 500); // Debounce 500ms
                    });
                }
            }
        });
    };

    // Expose functions for global access (e.g., from modal buttons)
    window.generatorForm = {
        loadOperation: loadOperationFromHistory,
        filterBySource: filterBySource,
        filterByType: filterByType,
        filterBySubject: filterBySubject
    };

    return {
        init
    }

})();
