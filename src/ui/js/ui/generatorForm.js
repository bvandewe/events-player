import { toastController } from "./toast";
import { taskController } from "../sse/task";
import { authManager, authorizationManager } from "../app";
import { apiPost } from "../utils/apiClient.js";

export const generatorForm = (() => {

    const initSliders = () => {

        var eventIterations = document.getElementById("eventIterations");
        var eventIterationsValue = document.getElementById("eventIterationsValue");
        eventIterations.addEventListener("input", function () {
            var selectedValue = eventIterations.value;
            eventIterationsValue.innerHTML = selectedValue;
        });

        var eventDelay = document.getElementById("eventDelay");
        var eventDelayValue = document.getElementById("eventDelayValue");
        eventDelay.addEventListener("input", function () {
            var selectedValue = eventDelay.value;
            eventDelayValue.innerHTML = selectedValue;
        });
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

        initSliders();

        const form = document.getElementById('generatorForm');
        form.addEventListener('submit', (event) => {
            handleSubmit(event);
        });
    };

    return {
        init
    }

})();
