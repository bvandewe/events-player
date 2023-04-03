export const progressBarController = (() => {

    const updateProgressBar = (progressBarId, progress) => {
        const progressBar = document.getElementById(progressBarId);
        progressBar.style.width = progress + "%";
    }

    return {
        updateProgressBar
    }

})();