export const toastController = (() => {
    var bootstrap;
    
    const setToastContent = (toast, result) => {
        var toastBody = toast.querySelector(".toast-body");
        toastBody.textContent = result["message"];
    };

    const showToast = (result) => {
        console.log(result);
        const toastEl = document.getElementById('liveToast');
        const toast = bootstrap.Toast.getOrCreateInstance(toastEl);
        var toastBody = toastEl.querySelector(".toast-body");
        toastBody.textContent = result["message"];
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