export const toastController = (() => {
    var bootstrap;
    const showToast = (result) => {
        console.log(result);
        const toastLiveExample = document.getElementById('liveToast');
        const toast = bootstrap.Toast.getOrCreateInstance(toastLiveExample);
        // var toast = document.querySelector('.toast-message');        
        // if (Array.isArray(result.detail)) {
        //     // toast.classList.add('error');
        //     console.log(result.detail[0].msg);
        //     // toast.innerHTML = JSON.stringify(result.detail);
        //     toast.innerHTML = "<strong>" + result.detail[0].msg + " in " + result.detail[0].loc.join(", ") + "</strong>";
        // } else {
        //     toast.classList.add("success");
        //     toast.innerHTML = result.message;
        // }
        toast.show();
        // toast.classList.add('show');
        // setTimeout(function () {
        //     toast.hide();
        // }, 5000);
    }

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