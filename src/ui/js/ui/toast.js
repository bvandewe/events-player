export const toastController = (() => {
    var bootstrap;

    const showToast = (result) => {
        console.log("result");
        console.log(result);
        const toastEl = document.getElementById('liveToast');        
        const toast = bootstrap.Toast.getOrCreateInstance(toastEl);        

        if ("detail" in result) {
            toastEl.classList.add("text-bg-warning");
            var message = `${result.detail[0].type}: ${result.detail[0].msg} in ${result.detail[0].loc.join(", ")}`;
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
    };

    return {
        init,
        showToast
    }
})();