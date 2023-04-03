export const toastController = (() => {

    const showToast = (result) => {
        console.log(result);
        var toast = document.querySelector('.toast-message');
        if (Array.isArray(result.detail)) {
            toast.classList.add('error');
            console.log(result.detail[0].msg);
            // toast.innerHTML = JSON.stringify(result.detail);
            toast.innerHTML = "<strong>" + result.detail[0].msg + " in " + result.detail[0].loc.join(", ") + "</strong>";
        } else {
            toast.classList.add("success");
            toast.innerHTML = result.message;
        }
        toast.classList.add('show');
        setTimeout(function () {
            toast.classList.remove('show');
            toast.classList.remove('error');
            toast.classList.remove('success');
        }, 5000);
    }

    return {
        showToast
    }
})();