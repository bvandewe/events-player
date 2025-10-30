export const toastController = (() => {
    var bootstrap;
    let pendingToasts = [];

    const showToast = (result) => {
        // Guard against Bootstrap not being loaded yet
        if (!bootstrap) {
            console.warn('[Toast] Bootstrap not initialized yet, queuing toast');
            pendingToasts.push(result);
            return;
        }

        console.log("result");
        console.log(result);
        const toastEl = document.getElementById('liveToast');

        // Extra safety check - ensure element exists
        if (!toastEl) {
            console.error('[Toast] Toast element not found in DOM');
            return;
        }

        const toast = bootstrap.Toast.getOrCreateInstance(toastEl);

        if ("detail" in result) {
            toastEl.classList.add("text-bg-warning");

            // Handle different detail formats
            if (Array.isArray(result.detail)) {
                // FastAPI validation error format: array of error objects
                var message = `${result.detail[0].type}: ${result.detail[0].msg} in ${result.detail[0].loc.join(", ")}`;
            } else if (typeof result.detail === 'string') {
                // Simple string error message
                var message = result.detail;
            } else {
                // Unknown format
                var message = JSON.stringify(result.detail);
            }
        } else {
            toastEl.classList.add("text-bg-primary");
            var message = `${result.status}: ${result.message} (Task.id: ${result.task_id})`;
        }
        var toastBody = toastEl.querySelector(".toast-body");
        toastBody.textContent = message;
        toast.show();
    };

    const init = (bs) => {
        bootstrap = bs;
        const toastElList = document.querySelectorAll('.toast');
        const toastList = [...toastElList].map(toastEl => new bootstrap.Toast(toastEl));

        // Show any queued toasts that arrived before initialization
        if (pendingToasts.length > 0) {
            console.log(`[Toast] Processing ${pendingToasts.length} queued toast(s)`);
            pendingToasts.forEach(result => showToast(result));
            pendingToasts = [];
        }
    };

    return {
        init,
        showToast
    }
})();