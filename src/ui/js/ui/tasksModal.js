/**
 * Tasks Modal Controller
 * Manages the admin interface for viewing and cancelling active generator tasks
 */

import * as bootstrap from 'bootstrap';
import { apiGet, apiPost } from '../utils/apiClient.js';
import { toastController } from './toast.js';

export const tasksModalController = (() => {
    let modal = null;
    let modalElement = null;
    let refreshInterval = null;

    // DOM elements
    let tasksList = null;
    let noTasksMessage = null;
    let activeTaskCount = null;
    let refreshTasksBtn = null;
    let cancelAllTasksBtn = null;

    /**
     * Initialize the tasks modal
     */
    const init = () => {
        console.log('[TasksModal] Initializing...');

        // Get DOM elements
        modalElement = document.getElementById('tasksModal');
        tasksList = document.getElementById('tasksList');
        noTasksMessage = document.getElementById('noTasksMessage');
        activeTaskCount = document.getElementById('activeTaskCount');
        refreshTasksBtn = document.getElementById('refreshTasksBtn');
        cancelAllTasksBtn = document.getElementById('cancelAllTasksBtn');

        if (!modalElement) {
            console.warn('[TasksModal] Modal element not found');
            return;
        }

        // Initialize Bootstrap modal
        modal = new bootstrap.Modal(modalElement);

        // Setup event listeners
        refreshTasksBtn.addEventListener('click', loadActiveTasks);
        cancelAllTasksBtn.addEventListener('click', handleCancelAll);

        // Load tasks when modal is shown
        modalElement.addEventListener('show.bs.modal', () => {
            console.log('[TasksModal] Modal shown, loading tasks...');
            loadActiveTasks();
            // Auto-refresh every 2 seconds while modal is open
            refreshInterval = setInterval(loadActiveTasks, 2000);
        });

        // Stop auto-refresh when modal is hidden
        modalElement.addEventListener('hide.bs.modal', () => {
            console.log('[TasksModal] Modal hidden, stopping auto-refresh');
            if (refreshInterval) {
                clearInterval(refreshInterval);
                refreshInterval = null;
            }
        });

        console.log('[TasksModal] Initialized');
    };

    /**
     * Show the tasks modal
     */
    const show = () => {
        if (modal) {
            modal.show();
        }
    };

    /**
     * Hide the tasks modal
     */
    const hide = () => {
        if (modal) {
            modal.hide();
        }
    };

    /**
     * Load active tasks from backend
     */
    const loadActiveTasks = async () => {
        try {
            const response = await apiGet('/api/tasks');

            if (!response.ok) {
                throw new Error(`Failed to load tasks: ${response.statusText}`);
            }

            const data = await response.json();
            const tasks = data.active_tasks || {};

            renderTasks(tasks);

        } catch (error) {
            console.error('[TasksModal] Failed to load tasks:', error);
            toastController.showToast({
                detail: [{
                    loc: ['tasks'],
                    msg: error.message || 'Failed to load active tasks',
                    type: 'error'
                }]
            });
        }
    };

    /**
     * Render tasks in the modal
     */
    const renderTasks = (tasks) => {
        const taskIds = Object.keys(tasks);
        const taskCount = taskIds.length;

        // Update task count badge
        activeTaskCount.textContent = taskCount;

        // Enable/disable cancel all button
        cancelAllTasksBtn.disabled = taskCount === 0;

        // Show/hide no tasks message
        if (taskCount === 0) {
            noTasksMessage.style.display = 'block';
            tasksList.innerHTML = '';
            tasksList.appendChild(noTasksMessage);
            return;
        }

        noTasksMessage.style.display = 'none';

        // Render task items
        tasksList.innerHTML = '';
        taskIds.forEach(taskId => {
            const task = tasks[taskId];
            const taskItem = createTaskItem(taskId, task);
            tasksList.appendChild(taskItem);
        });
    };

    /**
     * Create a task list item element
     */
    const createTaskItem = (taskId, task) => {
        const div = document.createElement('div');
        div.className = 'list-group-item';

        const statusBadgeClass = task.status === 'Running' ? 'bg-success' :
            task.status === 'Cancelling' ? 'bg-warning' :
                task.status === 'Completed' ? 'bg-info' : 'bg-secondary';

        div.innerHTML = `
            <div class="d-flex w-100 justify-content-between align-items-center">
                <div class="flex-grow-1">
                    <h6 class="mb-1">
                        <span class="badge ${statusBadgeClass}">${task.status}</span>
                        <span class="ms-2 text-muted small font-monospace">${taskId.substring(0, 8)}...</span>
                    </h6>
                    <div class="progress mt-2" style="height: 20px;">
                        <div class="progress-bar ${task.cancelled ? 'bg-warning' : 'bg-success'}" 
                             role="progressbar" 
                             style="width: ${task.progress}%"
                             aria-valuenow="${task.progress}" 
                             aria-valuemin="0" 
                             aria-valuemax="100">
                            ${task.progress}%
                        </div>
                    </div>
                </div>
                <div class="ms-3">
                    <button class="btn btn-sm btn-outline-danger cancel-task-btn" 
                            data-task-id="${taskId}"
                            ${task.cancelled || task.status === 'Completed' ? 'disabled' : ''}>
                        <i class="bi bi-stop-circle"></i> Cancel
                    </button>
                </div>
            </div>
        `;

        // Add event listener for cancel button
        const cancelBtn = div.querySelector('.cancel-task-btn');
        cancelBtn.addEventListener('click', () => handleCancelTask(taskId));

        return div;
    };

    /**
     * Handle cancel single task
     */
    const handleCancelTask = async (taskId) => {
        try {
            console.log('[TasksModal] Cancelling task:', taskId);

            const response = await apiPost(`/api/task/${taskId}/cancel`, {});

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to cancel task');
            }

            const result = await response.json();

            toastController.showToast({
                detail: [{
                    loc: ['task'],
                    msg: result.message || 'Task cancelled successfully',
                    type: 'success'
                }]
            });

            // Reload tasks to show updated status
            loadActiveTasks();

        } catch (error) {
            console.error('[TasksModal] Failed to cancel task:', error);
            toastController.showToast({
                detail: [{
                    loc: ['task'],
                    msg: error.message || 'Failed to cancel task',
                    type: 'error'
                }]
            });
        }
    };

    /**
     * Handle cancel all tasks
     */
    const handleCancelAll = async () => {
        try {
            if (!confirm('Are you sure you want to cancel all active tasks?')) {
                return;
            }

            console.log('[TasksModal] Cancelling all tasks...');

            const response = await apiPost('/api/tasks/cancel-all', {});

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to cancel tasks');
            }

            const result = await response.json();

            toastController.showToast({
                detail: [{
                    loc: ['tasks'],
                    msg: result.message || 'All tasks cancelled successfully',
                    type: 'success'
                }]
            });

            // Reload tasks to show updated status
            loadActiveTasks();

        } catch (error) {
            console.error('[TasksModal] Failed to cancel all tasks:', error);
            toastController.showToast({
                detail: [{
                    loc: ['tasks'],
                    msg: error.message || 'Failed to cancel tasks',
                    type: 'error'
                }]
            });
        }
    };

    return {
        init,
        show,
        hide
    };
})();
