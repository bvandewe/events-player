import { toastController } from "./toast";
import { taskController } from "../sse/task";
import { authManager, authorizationManager } from "../app";
import { apiPost } from "../utils/apiClient.js";

export const generatorForm = (() => {

    const STORAGE_KEY = 'cloudevents-player-generator-state';

    /**
     * Save form state to localStorage
     */
    const saveFormState = () => {
        try {
            const state = {
                event_gateway: document.getElementById('event_gateway')?.value || '',
                event_source: document.getElementById('event_source')?.value || '',
                event_type: document.getElementById('event_type')?.value || '',
                event_subject: document.getElementById('event_subject')?.value || '',
                event_data: document.getElementById('event_data')?.value || '',
                iterations: document.getElementById('eventIterations')?.value || '1',
                delay: document.getElementById('eventDelay')?.value || '100'
            };

            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            console.log('[GeneratorForm] State saved:', state);
        } catch (error) {
            console.error('[GeneratorForm] Error saving state:', error);
        }
    };

    /**
     * Restore form state from localStorage
     */
    const restoreFormState = () => {
        try {
            const savedState = localStorage.getItem(STORAGE_KEY);
            if (!savedState) {
                console.log('[GeneratorForm] No saved state found');
                return;
            }

            const state = JSON.parse(savedState);
            console.log('[GeneratorForm] Restoring state:', state);

            // Restore form fields
            const gatewaySelect = document.getElementById('event_gateway');
            const sourceInput = document.getElementById('event_source');
            const typeInput = document.getElementById('event_type');
            const subjectInput = document.getElementById('event_subject');
            const dataTextarea = document.getElementById('event_data');
            const iterationsSlider = document.getElementById('eventIterations');
            const delaySlider = document.getElementById('eventDelay');

            if (gatewaySelect && state.event_gateway) {
                gatewaySelect.value = state.event_gateway;
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

            console.log('[GeneratorForm] State restored successfully');
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

    const handleSubmit = (event) => {
        event.preventDefault();
        const formData = new FormData(event.target);
        const data = Object.fromEntries(formData.entries());
        console.log('Form data:', data);
        console.log('Iterations:', data.iterations, 'type:', typeof data.iterations);
        console.log('Delay:', data.delay, 'type:', typeof data.delay);

        // Check if user is authorized
        if (!authorizationManager.isOperator()) {
            authorizationManager.showAuthorizationError('Only operators and administrators can generate events');
            return;
        }

        // Check if non-admin is trying to use iterations or custom delay
        // Default delay is 100ms, operators can use iterations=1 with delay=100
        if (!authorizationManager.isAdmin()) {
            const iterations = parseInt(data.iterations);
            const delay = parseInt(data.delay);
            console.log('Parsed - Iterations:', iterations, 'Delay:', delay);
            console.log('Check: iterations > 1?', iterations > 1, 'delay !== 100?', delay !== 100);

            if (iterations > 1 || delay !== 100) {
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
                Promise.all(
                    [
                        console.log(result),
                        taskController.handleTaskStatus(result.task_id),
                        toastController.showToast(result)
                    ]
                );
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

    const init = () => {

        // Restore saved state first
        restoreFormState();

        // Initialize sliders
        initSliders();

        // Setup form submit handler
        const form = document.getElementById('generatorForm');
        if (form) {
            form.addEventListener('submit', (event) => {
                handleSubmit(event);
            });
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

        console.log('[GeneratorForm] Initialized with state persistence');
    };

    return {
        init
    }

})();
